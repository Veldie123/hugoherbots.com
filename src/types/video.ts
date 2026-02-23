export interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mux_upload_id: string | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  duration: number | null;
  course_module: string | null;
  technique_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VideoProgress {
  id: string;
  user_id: string;
  video_id: string;
  watched_seconds: number;
  last_position: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVideoRequest {
  title: string;
  description?: string;
  course_module?: string;
  technique_id?: string;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  course_module?: string;
  technique_id?: string;
  sort_order?: number;
}

export interface UpdateProgressRequest {
  watched_seconds: number;
  last_position: number;
  completed?: boolean;
}

export interface MuxUploadResponse {
  upload_url: string;
  upload_id: string;
  video_id: string;
}

export interface VideoTechniek {
  techniek_id: string;
  confidence: number;
  source: string;
  is_primary: boolean;
}

export interface VideoWithProgress extends Video {
  progress?: VideoProgress | null;
}
