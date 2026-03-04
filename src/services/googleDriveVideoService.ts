import { google, drive_v3 } from 'googleapis';
import { supabase } from '../utils/supabase/client';

interface VideoIngestJob {
  id: string;
  drive_file_id: string;
  drive_modified_time: string;
  status: string;
  rag_document_id?: string;
}

let cachedAuth: { client: any; expiry: number } | null = null;

async function getServiceAccountAuth() {
  if (cachedAuth && Date.now() < cachedAuth.expiry) {
    return cachedAuth.client;
  }

  const secret = typeof process !== 'undefined' ? process.env.GOOGLE_CLOUD_SECRET : null;
  if (!secret) {
    throw new Error('GOOGLE_CLOUD_SECRET niet ingesteld — kan niet authenticeren met Google Drive');
  }

  let keyData: Record<string, any>;
  try {
    keyData = JSON.parse(secret);
  } catch {
    try {
      keyData = JSON.parse(Buffer.from(secret, 'base64').toString());
    } catch {
      throw new Error('GOOGLE_CLOUD_SECRET is geen geldige JSON of base64');
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const client = await auth.getClient();
  cachedAuth = { client, expiry: Date.now() + 55 * 60_000 };
  return client;
}

async function getGoogleDriveClient(): Promise<drive_v3.Drive> {
  const authClient = await getServiceAccountAuth();
  return google.drive({ version: 'v3', auth: authClient });
}

export interface VideoFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  folderId?: string;
  folderPath?: string;
}

export interface SyncResult {
  added: VideoFile[];
  deleted: string[];
  unchanged: number;
  errors: string[];
}

async function listSubfolders(drive: drive_v3.Drive, folderId: string): Promise<{id: string, name: string}[]> {
  const folders: {id: string, name: string}[] = [];
  let pageToken: string | undefined;
  
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken
    });
    
    if (response.data.files) {
      for (const file of response.data.files) {
        folders.push({ id: file.id!, name: file.name! });
      }
    }
    
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  
  return folders;
}

export async function listVideosInFolder(folderId: string, recursive: boolean = true): Promise<VideoFile[]> {
  const drive = await getGoogleDriveClient();
  
  const videos: VideoFile[] = [];
  
  async function scanFolder(currentFolderId: string, folderPath: string = '') {
    let pageToken: string | undefined;
    
    do {
      const response = await drive.files.list({
        q: `'${currentFolderId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
        pageSize: 100,
        pageToken
      });
      
      if (response.data.files) {
        for (const file of response.data.files) {
          videos.push({
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            size: parseInt(file.size || '0'),
            modifiedTime: file.modifiedTime!,
            folderId: file.parents?.[0],
            folderPath: folderPath || undefined
          });
        }
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    if (recursive) {
      const subfolders = await listSubfolders(drive, currentFolderId);
      for (const subfolder of subfolders) {
        const newPath = folderPath ? `${folderPath}/${subfolder.name}` : subfolder.name;
        await scanFolder(subfolder.id, newPath);
      }
    }
  }
  
  await scanFolder(folderId);
  
  return videos;
}

export async function syncVideosFromFolder(folderId: string): Promise<SyncResult> {
  const result: SyncResult = {
    added: [],
    deleted: [],
    unchanged: 0,
    errors: []
  };
  
  try {
    const driveVideos = await listVideosInFolder(folderId);
    
    const { data: existingJobs, error: fetchError } = await supabase
      .from('video_ingest_jobs')
      .select('id, drive_file_id, drive_modified_time, status')
      .neq('status', 'deleted');
    
    if (fetchError) {
      result.errors.push(`Fout bij ophalen bestaande jobs: ${fetchError.message}`);
      return result;
    }
    
    const existingMap = new Map(
      (existingJobs || []).map(job => [job.drive_file_id, job])
    );
    
    const driveFileIds = new Set(driveVideos.map(v => v.id));
    
    for (const video of driveVideos) {
      const existing = existingMap.get(video.id);
      
      if (!existing) {
        // Extract techniek nummer from folder path (e.g., "Fase 2 - .../2.1.5 Pingpong" -> "2.1.5")
        let detectedTechniek: string | null = null;
        if (video.folderPath) {
          // Match deepest techniek number (e.g., "2.1.5" from "Fase 2 - .../2.1 Explore/2.1.5 Pingpong")
          const parts = video.folderPath.split('/');
          for (let i = parts.length - 1; i >= 0; i--) {
            const match = parts[i].match(/^(\d+(?:\.\d+)+)\s+/);
            if (match) {
              detectedTechniek = match[1];
              break;
            }
          }
        }
        
        const { error: insertError } = await supabase
          .from('video_ingest_jobs')
          .insert({
            drive_file_id: video.id,
            drive_file_name: video.name,
            drive_folder_id: video.folderId,
            drive_file_size: video.size,
            drive_modified_time: video.modifiedTime,
            status: 'pending',
            video_title: video.name.replace(/\.[^/.]+$/, ''),
            techniek_id: detectedTechniek
          });
        
        if (insertError) {
          result.errors.push(`Fout bij toevoegen ${video.name}: ${insertError.message}`);
        } else {
          result.added.push(video);
        }
      } else {
        const existingModified = new Date(existing.drive_modified_time).getTime();
        const newModified = new Date(video.modifiedTime).getTime();
        
        if (newModified > existingModified) {
          const { error: updateError } = await supabase
            .from('video_ingest_jobs')
            .update({
              drive_modified_time: video.modifiedTime,
              drive_file_size: video.size,
              status: 'pending',
              error_message: null,
              retry_count: 0
            })
            .eq('id', existing.id);
          
          if (updateError) {
            result.errors.push(`Fout bij updaten ${video.name}: ${updateError.message}`);
          } else {
            result.added.push(video);
          }
        } else {
          result.unchanged++;
        }
      }
    }
    
    for (const [driveFileId, job] of existingMap) {
      if (!driveFileIds.has(driveFileId)) {
        const { error: deleteError } = await supabase
          .from('video_ingest_jobs')
          .update({ 
            status: 'deleted',
            deleted_at: new Date().toISOString()
          })
          .eq('id', job.id);
        
        if (deleteError) {
          result.errors.push(`Fout bij verwijderen job: ${deleteError.message}`);
        } else {
          result.deleted.push(driveFileId);
          
          const { data: jobData } = await supabase
            .from('video_ingest_jobs')
            .select('rag_document_id')
            .eq('id', job.id)
            .single();
          
          if (jobData?.rag_document_id) {
            await supabase
              .from('rag_documents')
              .delete()
              .eq('id', jobData.rag_document_id);
          }
        }
      }
    }
    
  } catch (error) {
    result.errors.push(`Sync fout: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
  }
  
  return result;
}

export async function getVideoJobStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const { data, error } = await supabase
    .from('video_ingest_jobs')
    .select('status')
    .neq('status', 'deleted');
  
  if (error || !data) {
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  }
  
  const stats = {
    total: data.length,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  for (const job of data) {
    switch (job.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'downloading':
      case 'processing':
      case 'extracting_audio':
      case 'transcribing':
      case 'embedding':
        stats.processing++;
        break;
      case 'completed':
        stats.completed++;
        break;
      case 'failed':
        stats.failed++;
        break;
    }
  }
  
  return stats;
}

export async function getRecentJobs(limit: number = 20): Promise<any[]> {
  const { data, error } = await supabase
    .from('video_ingest_jobs')
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Fout bij ophalen jobs:', error);
    return [];
  }
  
  return data || [];
}
