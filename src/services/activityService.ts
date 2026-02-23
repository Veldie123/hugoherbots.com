import { supabase } from '@/utils/supabase/client';
import type { ActivityType, ActivityMetadata } from '@/types/crossPlatform';

const HUGO_AI_API_URL = import.meta.env.VITE_HUGO_AI_API_URL || 'https://hugoherbots-ai-chat.replit.app';

async function notifyAiPlatform(
  userId: string,
  activityType: ActivityType,
  options: {
    videoId?: string;
    webinarId?: string;
    sessionId?: string;
    techniekId?: string;
    metadata?: ActivityMetadata;
  }
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      userId,
      activityType,
      sourceApp: 'com',
    };

    if (options.videoId) {
      payload.entityType = 'video';
      payload.entityId = options.videoId;
    } else if (options.webinarId) {
      payload.entityType = 'webinar';
      payload.entityId = options.webinarId;
    } else if (options.techniekId) {
      payload.entityType = 'technique';
      payload.entityId = options.techniekId;
    } else if (options.sessionId) {
      payload.entityType = 'session';
      payload.entityId = options.sessionId;
    }

    if (options.metadata) {
      payload.metadata = options.metadata;
      if (options.metadata.duration_watched) {
        payload.durationSeconds = options.metadata.duration_watched;
      }
      if (options.metadata.score) {
        payload.score = options.metadata.score;
      }
    }

    await fetch(`${HUGO_AI_API_URL}/api/v2/user/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[Activity] Notified .ai platform: ${activityType}`);
  } catch (err) {
    console.warn('[Activity] Failed to notify .ai platform (non-blocking):', err);
  }
}

export const activityService = {
  async logActivity(
    activityType: ActivityType,
    options: {
      videoId?: string;
      webinarId?: string;
      sessionId?: string;
      techniekId?: string;
      metadata?: ActivityMetadata;
    } = {}
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Activity] No authenticated user, skipping activity log');
        return;
      }

      const [supabaseResult, aiResult] = await Promise.allSettled([
        supabase.from('user_activity').insert({
          user_id: user.id,
          activity_type: activityType,
          source_app: 'com',
          video_id: options.videoId || null,
          webinar_id: options.webinarId || null,
          session_id: options.sessionId || null,
          techniek_id: options.techniekId || null,
          metadata: options.metadata || {},
        }),
        notifyAiPlatform(user.id, activityType, options),
      ]);

      if (supabaseResult.status === 'fulfilled') {
        const { error } = supabaseResult.value as any;
        if (error) {
          console.error('[Activity] Supabase insert failed:', error.message);
        } else {
          console.log(`[Activity] Logged: ${activityType}`);
        }
      } else {
        console.error('[Activity] Supabase insert rejected:', supabaseResult.reason);
      }

      if (aiResult.status === 'rejected') {
        console.warn('[Activity] AI platform notify rejected:', aiResult.reason);
      }
    } catch (err) {
      console.error('[Activity] Error logging activity:', err);
    }
  },

  async logVideoView(videoId: string, techniekId?: string, durationWatched?: number, percentage?: number): Promise<void> {
    await this.logActivity('video_view', {
      videoId,
      techniekId,
      metadata: {
        duration_watched: durationWatched,
        percentage,
      },
    });
  },

  async logVideoComplete(videoId: string, techniekId?: string): Promise<void> {
    await this.logActivity('video_complete', {
      videoId,
      techniekId,
    });
  },

  async logWebinarAttend(webinarId: string, sessionTitle?: string): Promise<void> {
    await this.logActivity('webinar_attend', {
      webinarId,
      metadata: sessionTitle ? { session_title: sessionTitle } : undefined,
    });
  },

  async logWebinarComplete(webinarId: string): Promise<void> {
    await this.logActivity('webinar_complete', {
      webinarId,
    });
  },

  async logTechniquePractice(techniekId: string, score?: number): Promise<void> {
    await this.logActivity('technique_practice', {
      techniekId,
      metadata: score !== undefined ? { score } : undefined,
    });
  },

  async logLogin(): Promise<void> {
    await this.logActivity('login');
  },

  async getActivitySummary(): Promise<{
    videos_watched: number;
    videos_completed: number;
    webinars_attended: number;
    chat_sessions: number;
    total_activities: number;
    last_activity: string | null;
  } | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase.rpc('get_user_activity_summary', {
        p_user_id: user.id,
      });

      if (error) {
        console.error('[Activity] Failed to get summary:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[Activity] Error getting summary:', err);
      return null;
    }
  },
};
