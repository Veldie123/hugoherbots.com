import type {
  ChatMessage,
  ChatResponse,
  ActivitySummary,
  HugoContext,
} from '@/types/crossPlatform';
import { CHAT_ENDPOINTS } from '@/types/crossPlatform';

export type { ChatMessage, ChatResponse, ActivitySummary, HugoContext };

async function apiCall(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = endpoint;
  console.log(`[HugoAI] Calling: ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    console.error(`[HugoAI] ${endpoint} returned ${response.status}`);
  }
  
  return response;
}

export const hugoAiApi = {
  async sendMessage(
    message: string,
    userId?: string,
    conversationHistory?: ChatMessage[],
    techniqueContext?: string,
    sessionId?: string
  ): Promise<ChatResponse> {
    const payload: Record<string, unknown> = {
      message,
      userId,
      sourceApp: 'com',
    };

    if (sessionId) {
      payload.sessionId = sessionId;
    }

    if (conversationHistory?.length) {
      payload.conversationHistory = conversationHistory;
      payload.messages = conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      }));
    }

    if (techniqueContext) {
      payload.techniqueContext = techniqueContext;
    }

    const chatEndpoints = [...CHAT_ENDPOINTS];

    try {
      let response: Response | null = null;
      
      for (const endpoint of chatEndpoints) {
        try {
          response = await apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (response.ok) break;
        } catch {
          console.log(`[HugoAI] Endpoint ${endpoint} failed, trying next...`);
        }
      }

      if (!response || !response.ok) {
        throw new Error('All chat endpoints failed');
      }

      const data = await response.json();
      console.log('[HugoAI] Chat response received');
      
      return {
        message: data.response || data.message || data.content || data.text || 'Sorry, ik kon geen antwoord genereren.',
        sessionId: data.sessionId,
        mode: data.mode,
        technique: data.technique || data.techniek,
        sources: data.sources || data.bronnen,
        suggestions: data.suggestions,
      };
    } catch (error) {
      console.error('[HugoAI] Failed to send message:', error);
      throw error;
    }
  },

  async createSession(
    userId: string,
    techniqueId?: string,
    techniqueName?: string
  ): Promise<{ sessionId: string; greeting: string; mode: string }> {
    try {
      const response = await apiCall('/api/v2/sessions', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          techniqueId,
          techniqueName,
          isExpert: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Session creation returned ${response.status}`);
      }

      const data = await response.json();
      return {
        sessionId: data.sessionId,
        greeting: data.greeting || '',
        mode: data.mode || 'CONTEXT_GATHERING',
      };
    } catch (error) {
      console.error('[HugoAI] Failed to create session:', error);
      throw error;
    }
  },

  async getActivitySummary(userId: string): Promise<ActivitySummary | null> {
    try {
      const response = await apiCall(`/api/v2/user/activity-summary?userId=${userId}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        console.log('[HugoAI] Activity summary endpoint returned', response.status);
        return null;
      }

      const data = await response.json();
      return {
        videosWatched: data.summary?.videosWatched || data.summary?.videos_watched || 0,
        webinarsAttended: data.summary?.webinarsAttended || data.summary?.webinars_attended || 0,
        techniquesExplored: data.summary?.techniquesExplored || 0,
        totalChatSessions: data.summary?.totalChatSessions || data.summary?.chat_sessions || 0,
        welcomeMessage: data.welcomeMessage || data.summary?.welcomeMessage,
      };
    } catch (error) {
      console.error('[HugoAI] Error getting activity summary:', error);
      return null;
    }
  },

  async getHugoContext(userId: string): Promise<HugoContext | null> {
    try {
      const response = await apiCall(`/api/v2/user/hugo-context?userId=${userId}`, {
        method: 'GET',
      });

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('[HugoAI] Error getting Hugo context:', error);
      return null;
    }
  },

  async getWelcomeMessage(userId?: string): Promise<string> {
    if (!userId) {
      return 'Hallo! Ik ben Hugo, je persoonlijke sales coach. Waar kan ik je vandaag mee helpen?';
    }

    try {
      const context = await this.getHugoContext(userId);
      
      if (context?.welcomeMessage) {
        return context.welcomeMessage;
      }

      const summary = await this.getActivitySummary(userId);
      
      if (summary?.welcomeMessage) {
        return summary.welcomeMessage;
      }

      if (summary && (summary.videosWatched > 0 || summary.webinarsAttended > 0)) {
        const parts = [];
        if (summary.videosWatched > 0) {
          parts.push(`${summary.videosWatched} video's bekeken`);
        }
        if (summary.webinarsAttended > 0) {
          parts.push(`${summary.webinarsAttended} webinars bijgewoond`);
        }
        
        if (parts.length > 0) {
          return `Welkom terug! Je hebt al ${parts.join(' en ')}. Waar kan ik je vandaag mee helpen?`;
        }
      }

      return 'Hallo! Waar kan ik je vandaag mee helpen?';
    } catch {
      return 'Hallo! Waar kan ik je vandaag mee helpen?';
    }
  },

  async checkConnection(): Promise<{ connected: boolean; version?: string }> {
    try {
      const response = await apiCall('/api/health', { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        return { connected: true, version: data.engine };
      }
      return { connected: false };
    } catch {
      return { connected: false };
    }
  },
};
