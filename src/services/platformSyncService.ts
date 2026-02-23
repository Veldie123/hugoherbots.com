import { supabase } from '@/utils/supabase/client';
import type { SyncMessage } from '@/types/crossPlatform';

export type { SyncMessage };

export const platformSyncService = {
  async sendMessage(
    targetPlatform: 'com' | 'ai' | 'both',
    messageType: SyncMessage['message_type'],
    title: string,
    content: Record<string, unknown>
  ): Promise<SyncMessage | null> {
    try {
      const { data, error } = await supabase
        .from('platform_sync')
        .insert({
          source_platform: 'com',
          target_platform: targetPlatform,
          message_type: messageType,
          title,
          content,
        })
        .select()
        .single();

      if (error) {
        console.error('[PlatformSync] Error sending message:', error);
        return null;
      }

      console.log('[PlatformSync] Message sent:', data);
      return data;
    } catch (error) {
      console.error('[PlatformSync] Failed to send message:', error);
      return null;
    }
  },

  async getPendingMessages(): Promise<SyncMessage[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_pending_sync_messages', { p_target_platform: 'com' });

      if (error) {
        console.error('[PlatformSync] Error getting messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[PlatformSync] Failed to get messages:', error);
      return [];
    }
  },

  async getAllMessages(limit = 50): Promise<SyncMessage[]> {
    try {
      const { data, error } = await supabase
        .from('platform_sync')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[PlatformSync] Error getting all messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[PlatformSync] Failed to get all messages:', error);
      return [];
    }
  },

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .rpc('mark_sync_message_read', { p_message_id: messageId });

      if (error) {
        console.error('[PlatformSync] Error marking message as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[PlatformSync] Failed to mark as read:', error);
      return false;
    }
  },

  async updateStatus(messageId: string, status: SyncMessage['status']): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('platform_sync')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) {
        console.error('[PlatformSync] Error updating status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[PlatformSync] Failed to update status:', error);
      return false;
    }
  },

  async sendApiSpec(spec: Record<string, unknown>): Promise<SyncMessage | null> {
    return this.sendMessage('ai', 'api_spec', 'API Specification Update', {
      spec,
      timestamp: new Date().toISOString(),
      description: 'Updated API endpoints that .ai platform should implement',
    });
  },

  async requestFromAi(title: string, details: Record<string, unknown>): Promise<SyncMessage | null> {
    return this.sendMessage('ai', 'request', title, {
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  async subscribeToMessages(callback: (message: SyncMessage) => void) {
    const subscription = supabase
      .channel('platform_sync_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'platform_sync',
          filter: `target_platform=in.(com,both)`,
        },
        (payload) => {
          console.log('[PlatformSync] New message received:', payload);
          callback(payload.new as SyncMessage);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },
};

export async function syncApiSpecToAiPlatform() {
  const apiSpec = {
    endpoints: [
      {
        method: 'POST',
        path: '/api/v2/chat',
        description: 'Chat with Hugo AI',
        request: {
          message: 'string',
          userId: 'string (optional)',
          conversationHistory: 'array of {role, content}',
          techniqueContext: 'string (optional)',
          sourceApp: "'com' | 'ai'",
        },
        response: {
          message: 'string',
          technique: 'string (optional)',
          sources: 'array (optional)',
        },
      },
      {
        method: 'GET',
        path: '/api/v2/user/activity-summary',
        description: 'Get user activity summary for personalization',
        params: { userId: 'string' },
        response: {
          summary: {
            videos_watched: 'number',
            videos_completed: 'number',
            webinars_attended: 'number',
            welcomeMessage: 'string (optional)',
          },
        },
      },
    ],
    cors: {
      allowedOrigins: [
        'https://hugoherbots-com.replit.app',
        'https://hugoherbots.com',
      ],
    },
    database: {
      supabaseProjectId: 'pckctmojjrrgzuufsqoo',
      sharedTables: ['user_activity', 'platform_sync'],
    },
  };

  return platformSyncService.sendApiSpec(apiSpec);
}
