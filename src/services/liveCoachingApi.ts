import { supabase } from '../utils/supabase/client';
import type { 
  LiveSession, 
  LiveChatMessage, 
  LivePoll, 
  CreateSessionRequest, 
  UpdateSessionRequest,
  CreatePollRequest 
} from '../types/liveCoaching';

function mapRowToSession(row: any): LiveSession {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    scheduledDate: row.scheduled_date,
    durationMinutes: row.duration_minutes,
    topic: row.topic,
    phaseId: row.phase_id,
    status: row.status,
    dailyRoomName: row.daily_room_name,
    dailyRoomUrl: row.daily_room_url,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    viewerCount: row.viewer_count,
    hostId: row.host_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const liveCoachingApi = {
  sessions: {
    list: async (status?: string): Promise<{ sessions: LiveSession[] }> => {
      let query = supabase
        .from('live_sessions')
        .select('*')
        .order('scheduled_date', { ascending: true });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: sessions, error } = await query;
      
      if (error) {
        console.error('❌ Database query failed:', error);
        throw new Error('Kon sessies niet laden: ' + error.message);
      }
      
      return { sessions: (sessions || []).map(mapRowToSession) };
    },

    get: async (id: string): Promise<LiveSession> => {
      const { data: session, error } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('❌ Database query failed:', error);
        throw new Error('Sessie niet gevonden');
      }
      
      return mapRowToSession(session);
    },

    create: async (data: CreateSessionRequest): Promise<LiveSession> => {
      const { data: session, error } = await supabase
        .from('live_sessions')
        .insert({
          title: data.title,
          description: data.description,
          scheduled_date: data.scheduledDate,
          duration_minutes: data.durationMinutes || 60,
          topic: data.topic,
          phase_id: data.phaseId,
          status: 'upcoming',
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database insert failed:', error);
        throw new Error('Kon sessie niet aanmaken: ' + error.message);
      }
      
      console.log('✅ Session created:', session.id);
      return mapRowToSession(session);
    },

    update: async (id: string, data: UpdateSessionRequest): Promise<LiveSession> => {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.scheduledDate !== undefined) updateData.scheduled_date = data.scheduledDate;
      if (data.durationMinutes !== undefined) updateData.duration_minutes = data.durationMinutes;
      if (data.topic !== undefined) updateData.topic = data.topic;
      if (data.phaseId !== undefined) updateData.phase_id = data.phaseId;
      if (data.status !== undefined) updateData.status = data.status;
      
      const { data: session, error } = await supabase
        .from('live_sessions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database update failed:', error);
        throw new Error('Kon sessie niet bijwerken: ' + error.message);
      }
      
      console.log('✅ Session updated:', id);
      return mapRowToSession(session);
    },

    delete: async (id: string): Promise<{ success: boolean }> => {
      const response = await fetch(`/api/admin/sessions/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('❌ Delete failed:', result.message);
        throw new Error('Kon sessie niet verwijderen: ' + (result.message || 'Onbekende fout'));
      }
      
      console.log('✅ Session deleted:', id);
      return { success: true };
    },

    start: async (id: string): Promise<LiveSession & { dailyRoomName: string; dailyRoomUrl: string }> => {
      const response = await fetch(`/api/admin/sessions/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('❌ Failed to start session:', result.message);
        throw new Error('Kon sessie niet starten: ' + (result.message || 'Onbekende fout'));
      }
      
      console.log('✅ Session started:', id);
      const session = result.session;
      return {
        id: session.id,
        title: session.title,
        description: '',
        scheduledDate: '',
        durationMinutes: 60,
        topic: '',
        phaseId: null,
        status: session.status,
        dailyRoomName: session.dailyRoomName || '',
        dailyRoomUrl: session.dailyRoomUrl || '',
        videoUrl: null,
        thumbnailUrl: null,
        viewerCount: 0,
        hostId: null,
        createdAt: '',
        updatedAt: '',
      };
    },

    end: async (id: string): Promise<LiveSession> => {
      const response = await fetch(`/api/admin/sessions/${id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('❌ Failed to end session:', result.message);
        throw new Error('Kon sessie niet beëindigen: ' + (result.message || 'Onbekende fout'));
      }
      
      console.log('✅ Session ended:', id);
      return mapRowToSession(result.session);
    },

    getToken: async (id: string): Promise<{ 
      token: string; 
      roomUrl: string; 
      roomName: string; 
      isHost: boolean 
    }> => {
      const response = await fetch(`/api/admin/sessions/${id}/token`);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('❌ Failed to get token:', result.message);
        throw new Error('Kon meeting token niet ophalen: ' + (result.message || 'Onbekende fout'));
      }
      
      return {
        token: result.token,
        roomUrl: result.roomUrl,
        roomName: result.roomName,
        isHost: result.isHost,
      };
    },
  },

  reminders: {
    create: async (sessionId: string): Promise<{ success: boolean; reminderId: string }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');
      
      const { data, error } = await supabase
        .from('session_reminders')
        .insert({ session_id: sessionId, user_id: user.id })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Failed to create reminder:', error);
        throw new Error('Kon herinnering niet instellen');
      }
      
      return { success: true, reminderId: data.id };
    },

    delete: async (sessionId: string): Promise<{ success: boolean }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');
      
      const { error } = await supabase
        .from('session_reminders')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('❌ Failed to delete reminder:', error);
        throw new Error('Kon herinnering niet verwijderen');
      }
      
      return { success: true };
    },
  },

  chat: {
    list: async (sessionId: string, limit = 50): Promise<{ messages: LiveChatMessage[]; hasMore: boolean }> => {
      const { data: messages, error } = await supabase
        .from('session_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('❌ Failed to load chat:', error);
        return { messages: [], hasMore: false };
      }
      
      return { 
        messages: (messages || []).reverse().map((m: any) => ({
          id: m.id,
          sessionId: m.session_id,
          userId: m.user_id,
          userName: m.user_name,
          userInitials: (m.user_name || '??').substring(0, 2).toUpperCase(),
          message: m.message,
          isHost: m.is_host || false,
          createdAt: m.created_at,
        })),
        hasMore: messages?.length === limit 
      };
    },

    send: async (sessionId: string, message: string): Promise<LiveChatMessage> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');
      
      const { data, error } = await supabase
        .from('session_chat_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          user_name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Gebruiker',
          message,
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Failed to send message:', error);
        throw new Error('Kon bericht niet versturen');
      }
      
      const userName = data.user_name || 'Gebruiker';
      return {
        id: data.id,
        sessionId: data.session_id,
        userId: data.user_id,
        userName: userName,
        userInitials: userName.substring(0, 2).toUpperCase(),
        message: data.message,
        isHost: data.is_host || false,
        createdAt: data.created_at,
      };
    },
  },

  polls: {
    list: async (sessionId: string): Promise<{ polls: LivePoll[] }> => {
      const { data: polls, error } = await supabase
        .from('session_polls')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Failed to load polls:', error);
        return { polls: [] };
      }
      
      return { 
        polls: (polls || []).map((p: any) => {
          const options = p.options || [];
          const totalVotes = options.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
          return {
            id: p.id,
            sessionId: p.session_id,
            question: p.question,
            options: options.map((opt: any) => ({
              id: opt.id,
              pollId: p.id,
              optionText: opt.text || opt.optionText || '',
              voteCount: opt.votes || opt.voteCount || 0,
            })),
            isActive: p.is_active,
            totalVotes,
            userVoted: false,
            userVoteOptionId: null,
            createdAt: p.created_at,
          };
        })
      };
    },

    create: async (sessionId: string, data: CreatePollRequest): Promise<LivePoll> => {
      const options = data.options.map((text, index) => ({
        id: `opt_${index}`,
        text,
        votes: 0,
      }));
      
      const { data: poll, error } = await supabase
        .from('session_polls')
        .insert({
          session_id: sessionId,
          question: data.question,
          options,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Failed to create poll:', error);
        throw new Error('Kon poll niet aanmaken');
      }
      
      return {
        id: poll.id,
        sessionId: poll.session_id,
        question: poll.question,
        options: poll.options.map((opt: any) => ({
          id: opt.id,
          pollId: poll.id,
          optionText: opt.text || '',
          voteCount: opt.votes || 0,
        })),
        isActive: poll.is_active,
        totalVotes: 0,
        userVoted: false,
        userVoteOptionId: null,
        createdAt: poll.created_at,
      };
    },

    vote: async (pollId: string, optionId: string): Promise<{ success: boolean; poll: LivePoll }> => {
      const { data: poll, error: fetchError } = await supabase
        .from('session_polls')
        .select('*')
        .eq('id', pollId)
        .single();
      
      if (fetchError || !poll) {
        throw new Error('Poll niet gevonden');
      }
      
      const updatedOptions = poll.options.map((opt: any) => 
        opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
      );
      
      const { data: updatedPoll, error } = await supabase
        .from('session_polls')
        .update({ options: updatedOptions })
        .eq('id', pollId)
        .select()
        .single();
      
      if (error) {
        throw new Error('Kon stem niet registreren');
      }
      
      const options = updatedPoll.options || [];
      const totalVotes = options.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
      return {
        success: true,
        poll: {
          id: updatedPoll.id,
          sessionId: updatedPoll.session_id,
          question: updatedPoll.question,
          options: options.map((opt: any) => ({
            id: opt.id,
            pollId: updatedPoll.id,
            optionText: opt.text || '',
            voteCount: opt.votes || 0,
          })),
          isActive: updatedPoll.is_active,
          totalVotes,
          userVoted: true,
          userVoteOptionId: optionId,
          createdAt: updatedPoll.created_at,
        },
      };
    },

    close: async (pollId: string): Promise<{ success: boolean }> => {
      const { error } = await supabase
        .from('session_polls')
        .update({ is_active: false })
        .eq('id', pollId);
      
      if (error) {
        throw new Error('Kon poll niet sluiten');
      }
      
      return { success: true };
    },
  },

  recording: {
    start: async (sessionId: string, roomName?: string): Promise<{ success: boolean; recording: { id: string; status: string } }> => {
      console.log('Recording start requested for session:', sessionId, 'room:', roomName);
      
      if (!roomName) {
        const { data: session } = await supabase
          .from('live_sessions')
          .select('daily_room_name')
          .eq('id', sessionId)
          .single();
        roomName = session?.daily_room_name;
      }
      
      if (!roomName) {
        throw new Error('Geen room naam gevonden voor deze sessie');
      }
      
      const response = await fetch('/api/daily/recording/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, sessionId })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Recording starten mislukt');
      }
      
      return { success: true, recording: result.recording };
    },

    stop: async (sessionId: string, roomName?: string): Promise<{ success: boolean }> => {
      console.log('Recording stop requested for session:', sessionId, 'room:', roomName);
      
      if (!roomName) {
        const { data: session } = await supabase
          .from('live_sessions')
          .select('daily_room_name, recording_id')
          .eq('id', sessionId)
          .single();
        roomName = session?.daily_room_name;
      }
      
      if (!roomName) {
        throw new Error('Geen room naam gevonden voor deze sessie');
      }
      
      const response = await fetch('/api/daily/recording/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, sessionId })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Recording stoppen mislukt');
      }
      
      return { success: true };
    },

    getStatus: async (sessionId: string): Promise<{ isRecording: boolean; recordingId: string | null }> => {
      const { data: session } = await supabase
        .from('live_sessions')
        .select('is_recording, recording_id')
        .eq('id', sessionId)
        .single();
      
      return { 
        isRecording: session?.is_recording || false, 
        recordingId: session?.recording_id || null 
      };
    },

    list: async (roomName?: string): Promise<{ recordings: any[]; totalCount: number }> => {
      let url = '/api/daily/recordings';
      if (roomName) {
        url += `?roomName=${encodeURIComponent(roomName)}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Recordings ophalen mislukt');
      }
      
      return { recordings: result.recordings, totalCount: result.totalCount };
    },

    getAccessLink: async (recordingId: string): Promise<{ downloadLink: string; expiresAt: string }> => {
      const response = await fetch(`/api/daily/recordings/${recordingId}/access-link`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Download link ophalen mislukt');
      }
      
      return { downloadLink: result.downloadLink, expiresAt: result.expiresAt };
    },

    importToVideos: async (recordingId: string, options?: {
      sessionId?: string;
      title?: string;
      description?: string;
      courseModule?: string;
      techniqueId?: string;
    }): Promise<{ success: boolean; videoId: string; muxAssetId: string; status: string }> => {
      return { success: false, videoId: '', muxAssetId: '', status: 'not_implemented' };
    },
  },
};

export async function exportSessionsCsv(): Promise<void> {
  const { data: sessions, error } = await supabase
    .from('live_sessions')
    .select('*')
    .order('scheduled_date', { ascending: false });
  
  if (error) {
    throw new Error('Export mislukt: ' + error.message);
  }
  
  const headers = ['ID', 'Titel', 'Onderwerp', 'Datum', 'Duur (min)', 'Status', 'Aangemaakt'];
  const rows = (sessions || []).map(s => [
    s.id,
    s.title,
    s.topic || '',
    s.scheduled_date,
    s.duration_minutes,
    s.status,
    s.created_at,
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'live_sessions_export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateIcsFile(session: LiveSession): string {
  const startDate = new Date(session.scheduledDate);
  const endDate = new Date(startDate.getTime() + session.durationMinutes * 60 * 1000);
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HugoHerbots.ai//Live Coaching//NL
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${session.title}
DESCRIPTION:Live coaching sessie met Hugo Herbots${session.topic ? ` - ${session.topic}` : ''}. ${session.description || ''}
LOCATION:HugoHerbots.ai Live Coaching
UID:${session.id}@hugoherbots.ai
URL:https://app.hugoherbots.ai/live/${session.id}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT24H
ACTION:DISPLAY
DESCRIPTION:Live Coaching sessie begint over 24 uur
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Live Coaching sessie begint over 1 uur
END:VALARM
END:VEVENT
END:VCALENDAR`;
}

export function downloadIcsFile(session: LiveSession): void {
  const icsContent = generateIcsFile(session);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `live-coaching-${session.id.slice(0, 8)}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
