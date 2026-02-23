/**
 * Roleplay Uploads API Service
 * Connects frontend to Supabase roleplay_uploads table
 */

import { supabase } from '../utils/supabase/client';

export interface RoleplayUpload {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  duration_seconds?: number;
  title?: string;
  description?: string;
  techniek_id?: string;
  fase?: string;
  status: 'pending' | 'processing' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  error_message?: string;
  retry_count: number;
  transcript_text?: string;
  transcript_path?: string;
  language_code?: string;
  ai_score?: number;
  ai_quality?: 'excellent' | 'good' | 'needs-improvement';
  ai_feedback?: {
    strengths: string[];
    improvements: string[];
  };
  created_at: string;
  updated_at: string;
  processed_at?: string;
  // Joined user data (for admin view)
  user_email?: string;
  user_name?: string;
}

export interface UploadStats {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  avgScore: number;
}

const BUCKET_NAME = 'roleplay-uploads';

/**
 * Upload a roleplay audio/video file
 */
export async function uploadRoleplay(
  file: File,
  metadata: {
    title?: string;
    description?: string;
    techniek_id?: string;
    fase?: string;
  }
): Promise<{ data: RoleplayUpload | null; error: string | null }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Je moet ingelogd zijn om te uploaden' };
    }

    // Generate unique file path
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${timestamp}_${safeName}`;

    console.log('📤 Uploading to Supabase Storage:', storagePath);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Storage upload failed:', uploadError);
      return { data: null, error: `Upload mislukt: ${uploadError.message}` };
    }

    console.log('✅ File uploaded, creating database record...');

    // Create database record
    const { data: upload, error: dbError } = await supabase
      .from('roleplay_uploads')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: `${BUCKET_NAME}/${storagePath}`,
        title: metadata.title,
        description: metadata.description,
        techniek_id: metadata.techniek_id,
        fase: metadata.fase,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database insert failed:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      return { data: null, error: `Database fout: ${dbError.message}` };
    }

    console.log('✅ Upload complete:', upload);
    return { data: upload, error: null };

  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    return { data: null, error: err.message || 'Onverwachte fout' };
  }
}

/**
 * Get user's own uploads
 */
export async function getUserUploads(): Promise<{ data: RoleplayUpload[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('roleplay_uploads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Get single upload by ID
 */
export async function getUploadById(id: string): Promise<{ data: RoleplayUpload | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('roleplay_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Get all uploads (admin only)
 */
export async function getAllUploads(filters?: {
  status?: string;
  quality?: string;
  search?: string;
}): Promise<{ data: RoleplayUpload[]; error: string | null }> {
  try {
    let query = supabase
      .from('roleplay_uploads')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status && filters.status !== 'all') {
      // Map frontend status to database status
      const statusMap: Record<string, string[]> = {
        'analyzed': ['completed'],
        'processing': ['processing', 'transcribing', 'analyzing'],
        'pending': ['pending'],
        'failed': ['failed'],
      };
      const dbStatuses = statusMap[filters.status] || [filters.status];
      query = query.in('status', dbStatuses);
    }

    if (filters?.quality && filters.quality !== 'all') {
      query = query.eq('ai_quality', filters.quality);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: error.message };
    }

    // If search filter, apply client-side (Supabase free tier doesn't have full-text search)
    let results = data || [];
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(u => 
        u.file_name?.toLowerCase().includes(search) ||
        u.title?.toLowerCase().includes(search) ||
        u.techniek_id?.toLowerCase().includes(search)
      );
    }

    return { data: results, error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Get upload statistics (admin)
 */
export async function getUploadStats(): Promise<{ data: UploadStats | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('roleplay_uploads')
      .select('status, ai_score');

    if (error) {
      return { data: null, error: error.message };
    }

    const uploads = data || [];
    const completed = uploads.filter(u => u.status === 'completed');
    const scores = completed.filter(u => u.ai_score !== null).map(u => u.ai_score!);

    const stats: UploadStats = {
      total: uploads.length,
      completed: completed.length,
      processing: uploads.filter(u => ['processing', 'transcribing', 'analyzing'].includes(u.status)).length,
      pending: uploads.filter(u => u.status === 'pending').length,
      failed: uploads.filter(u => u.status === 'failed').length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    };

    return { data: stats, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Get signed URL for playback
 */
export async function getPlaybackUrl(storagePath: string): Promise<{ url: string | null; error: string | null }> {
  try {
    // Remove bucket prefix if present
    const path = storagePath.replace(`${BUCKET_NAME}/`, '');
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hour

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  } catch (err: any) {
    return { url: null, error: err.message };
  }
}

/**
 * Delete an upload (user can only delete own)
 */
export async function deleteUpload(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // First get the upload to get storage path
    const { data: upload, error: fetchError } = await supabase
      .from('roleplay_uploads')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Delete from storage
    if (upload?.storage_path) {
      const path = upload.storage_path.replace(`${BUCKET_NAME}/`, '');
      await supabase.storage.from(BUCKET_NAME).remove([path]);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('roleplay_uploads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const roleplayUploadsApi = {
  uploadRoleplay,
  getUserUploads,
  getUploadById,
  getAllUploads,
  getUploadStats,
  getPlaybackUrl,
  deleteUpload,
};

export default roleplayUploadsApi;
