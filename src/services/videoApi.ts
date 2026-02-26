import type { Video, VideoProgress, CreateVideoRequest, UpdateVideoRequest, UpdateProgressRequest, MuxUploadResponse, VideoWithProgress } from '@/types/video';
import { supabase } from '@/utils/supabase/client';
import { projectId } from '@/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/api/videos`;
const LOCAL_API_BASE = '/api/videos';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}

export const videoApi = {
  async getVideos(status?: string, module?: string): Promise<Video[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (module) params.append('module', module);
    
    const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
    const response = await fetch(url, { headers: await getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch videos');
    return response.json();
  },

  async getVideo(id: string): Promise<VideoWithProgress> {
    const response = await fetch(`${API_BASE}/${id}`, { headers: await getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch video');
    return response.json();
  },

  async getVideosByModule(module: string): Promise<Video[]> {
    const response = await fetch(`${API_BASE}/module/${encodeURIComponent(module)}`, { headers: await getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch videos by module');
    return response.json();
  },

  async createUpload(data: CreateVideoRequest): Promise<MuxUploadResponse> {
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create upload');
    return response.json();
  },

  async updateVideo(id: string, data: UpdateVideoRequest): Promise<Video> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update video');
    return response.json();
  },

  async deleteVideo(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete video');
  },

  async getProgress(videoId: string): Promise<VideoProgress | null> {
    const response = await fetch(`${API_BASE}/${videoId}/progress`, { headers: await getAuthHeaders() });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch progress');
    return response.json();
  },

  async updateProgress(videoId: string, data: UpdateProgressRequest): Promise<VideoProgress> {
    const response = await fetch(`${API_BASE}/${videoId}/progress`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update progress');
    return response.json();
  },

  async getUserStats(): Promise<{ totalVideos: number; completedVideos: number; totalWatchTime: number }> {
    const response = await fetch(`${API_BASE}/stats`, { headers: await getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  async importFromUrl(data: { url: string; title: string; description?: string; course_module?: string; technique_id?: string }): Promise<{ video_id: string; asset_id: string; status: string }> {
    const response = await fetch(`${API_BASE}/import-url`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to import video' }));
      throw new Error(error.error || 'Failed to import video');
    }
    return response.json();
  },

  async getAdminProgress(): Promise<Array<{
    user_id: string;
    name: string;
    email: string;
    totalVideosWatched: number;
    completedVideos: number;
    totalWatchTimeMinutes: number;
    lastActivity: string | null;
  }>> {
    const response = await fetch(`${API_BASE}/admin/progress`, { headers: await getAuthHeaders() });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Kon voortgang niet ophalen' }));
      throw new Error(error.error || 'Kon voortgang niet ophalen');
    }
    return response.json();
  },

  async getLibrary(status?: string, fase?: string, includeHidden: boolean = false): Promise<Array<{
    id: string;
    title: string;
    original_title: string | null;
    description: string | null;
    thumbnail_url: string | null;
    mux_asset_id: string | null;
    mux_playback_id: string | null;
    status: string;
    duration: number | null;
    course_module: string | null;
    technique_id: string | null;
    has_transcript: boolean;
    has_rag: boolean;
    has_mux: boolean;
    has_audio: boolean;
    ai_suggested_techniek_id: string | null;
    ai_confidence: number | null;
    drive_file_id: string | null;
    drive_folder_id: string | null;
    source: 'pipeline' | 'manual';
    playback_order: number | null;
    ai_summary: string | null;
    ai_attractive_title: string | null;
    created_at: string;
    updated_at: string;
  }>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (fase) params.append('fase', fase);
    if (includeHidden) params.append('include_hidden', 'true');
    
    const url = params.toString() ? `${LOCAL_API_BASE}/library?${params}` : `${LOCAL_API_BASE}/library`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch video library');
    return response.json();
  },

  async getVideosByTechnique(techniqueId: string): Promise<Array<{
    id: string;
    title: string;
    mux_playback_id: string | null;
    duration: number | null;
    source: 'pipeline' | 'manual';
  }>> {
    const library = await this.getLibrary('completed');
    return library.filter(v => v.technique_id === techniqueId && v.mux_playback_id);
  },

  async getLibraryVideo(id: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    full_transcript: string | null;
    thumbnail_url: string | null;
    mux_asset_id: string | null;
    mux_playback_id: string | null;
    status: string;
    duration: number | null;
    course_module: string | null;
    technique_id: string | null;
    drive_file_id: string;
    created_at: string;
    updated_at: string;
  }> {
    const response = await fetch(`${API_BASE}/library/${id}`, { headers: await getAuthHeaders() });
    if (!response.ok) throw new Error('Video niet gevonden');
    return response.json();
  },

  async updateLibraryVideo(id: string, data: { title?: string; techniek_id?: string; fase?: string }): Promise<any> {
    const response = await fetch(`${API_BASE}/library/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Video bijwerken mislukt');
    return response.json();
  },

  async deleteLibraryVideo(id: string, source: 'pipeline' | 'manual'): Promise<void> {
    const response = await fetch(`${LOCAL_API_BASE}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id, source }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Video verwijderen mislukt');
    }
  },

  async updateTitle(id: string, title: string): Promise<{ success: boolean; title: string }> {
    const response = await fetch(`${LOCAL_API_BASE}/update-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id, title }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Titel bijwerken mislukt');
    }
    return response.json();
  },

  async toggleHidden(id: string, isHidden: boolean): Promise<void> {
    const response = await fetch(`${LOCAL_API_BASE}/toggle-hidden`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id, isHidden }),
    });
    if (!response.ok) throw new Error('Video verbergen/tonen mislukt');
  },

  async getPlaybackOrder(): Promise<Array<{
    id: string;
    title: string;
    technique_id: string | null;
    playback_order: number | null;
    mux_playback_id: string | null;
    duration: number | null;
    thumbnail_url: string | null;
    source: 'pipeline' | 'manual';
  }>> {
    const response = await fetch(`${LOCAL_API_BASE}/playback-order`);
    if (!response.ok) throw new Error('Failed to fetch playback order');
    return response.json();
  },

  async updatePlaybackOrder(orders: Array<{ id: string; playback_order: number; source: 'pipeline' | 'manual' }>): Promise<{ success: boolean; updated: number }> {
    const response = await fetch(`${LOCAL_API_BASE}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
    if (!response.ok) throw new Error('Failed to update playback order');
    return response.json();
  },

  async exportCsv(): Promise<void> {
    const response = await fetch(`${API_BASE}/export/csv`, { headers: await getAuthHeaders() });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Export mislukt';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'videos_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
