/**
 * Live Coaching API Routes
 * HugoHerbots.ai - Daily.co Integration
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAuth, formatError, logSuccess, logError } from "./middleware.tsx";

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY') || '';
const DAILY_API_URL = 'https://api.daily.co/v1';

const liveCoaching = new Hono();

const chatRateLimits = new Map<string, { count: number; resetAt: number }>();
const CHAT_RATE_LIMIT = 5;
const CHAT_RATE_WINDOW = 60 * 1000;

function checkChatRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = chatRateLimits.get(userId);
  
  if (!limit || now > limit.resetAt) {
    chatRateLimits.set(userId, { count: 1, resetAt: now + CHAT_RATE_WINDOW });
    return true;
  }
  
  if (limit.count >= CHAT_RATE_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
}

async function isSessionHost(supabase: any, sessionId: string, userId: string): Promise<boolean> {
  const { data: session } = await supabase
    .from('live_sessions')
    .select('host_id')
    .eq('id', sessionId)
    .single();
  return session?.host_id === userId;
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: user } = await supabase.auth.admin.getUserById(userId);
  return user?.user?.user_metadata?.role === 'admin' || user?.user?.app_metadata?.role === 'admin';
}

// Helper: Daily API request
async function dailyRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DAILY_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DAILY_API_KEY}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.info || `Daily API error: ${response.status}`);
  }

  return response.json();
}

// Helper: Create Daily room
async function createDailyRoom(sessionId: string): Promise<{ name: string; url: string }> {
  const roomName = `hh-live-${sessionId.slice(0, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  
  const room = await dailyRequest<any>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        nbf: now - 60,
        exp: now + (180 * 60), // 3 hours
        max_participants: 100,
        enable_chat: true,
        enable_screenshare: true,
        enable_recording: 'cloud',
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  return { name: room.name, url: room.url };
}

// Helper: Create meeting token
async function createMeetingToken(
  roomName: string, 
  userId: string, 
  userName: string, 
  isOwner: boolean
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const response = await dailyRequest<{ token: string }>('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId,
        user_name: userName,
        nbf: now - 60,
        exp: now + (180 * 60),
        is_owner: isOwner,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  return response.token;
}

// Helper: Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Helper: Map session row to API response
function mapSession(row: any, hasReminder?: boolean) {
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
    ...(hasReminder !== undefined && { hasReminder }),
  };
}

// ============================================
// SESSION ROUTES
// ============================================

// GET /api/live/sessions - List all sessions
liveCoaching.get('/sessions', requireAuth, async (c) => {
  try {
    const { status, limit = '20' } = c.req.query();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabase
      .from('live_sessions')
      .select('*')
      .order('scheduled_date', { ascending: true })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      return formatError(c, error.message, 'Failed to fetch sessions', 'FETCH_SESSIONS_ERROR', 500);
    }

    logSuccess(c, 'Sessions fetched', { count: sessions?.length || 0 });

    return c.json({
      sessions: (sessions || []).map(s => mapSession(s)),
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Sessions fetch error', 'SESSIONS_ERROR', 500);
  }
});

// GET /api/live/sessions/:id - Get session details
liveCoaching.get('/sessions/:id', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get session
    const { data: session, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return formatError(c, 'Session not found', 'Session not found', 'SESSION_NOT_FOUND', 404);
    }

    // Check if user has reminder
    const { data: reminder } = await supabase
      .from('live_session_reminders')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    logSuccess(c, 'Session fetched', { sessionId });

    return c.json(mapSession(session, !!reminder));

  } catch (error: any) {
    return formatError(c, error.message, 'Session fetch error', 'SESSION_ERROR', 500);
  }
});

// POST /api/live/sessions - Create session (Admin only)
liveCoaching.post('/sessions', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { title, description, scheduledDate, durationMinutes, topic, phaseId, thumbnailUrl } = body;

    if (!title || !scheduledDate) {
      return formatError(c, 'Missing fields', 'title and scheduledDate required', 'MISSING_FIELDS', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const admin = await isAdmin(supabase, userId);
    if (!admin) {
      return formatError(c, 'Forbidden', 'Only admins can create sessions', 'ADMIN_REQUIRED', 403);
    }

    const { data: session, error } = await supabase
      .from('live_sessions')
      .insert({
        title,
        description,
        scheduled_date: scheduledDate,
        duration_minutes: durationMinutes || 60,
        topic,
        phase_id: phaseId,
        thumbnail_url: thumbnailUrl,
        host_id: userId,
        status: 'upcoming',
      })
      .select()
      .single();

    if (error) {
      return formatError(c, error.message, 'Failed to create session', 'CREATE_SESSION_ERROR', 500);
    }

    logSuccess(c, 'Session created', { sessionId: session.id });

    return c.json(mapSession(session), 201);

  } catch (error: any) {
    return formatError(c, error.message, 'Create session error', 'CREATE_ERROR', 500);
  }
});

// PUT /api/live/sessions/:id - Update session
liveCoaching.put('/sessions/:id', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');
    const body = await c.req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isHost = await isSessionHost(supabase, sessionId, userId);
    const admin = await isAdmin(supabase, userId);
    if (!isHost && !admin) {
      return formatError(c, 'Forbidden', 'Only session host or admin can update', 'UNAUTHORIZED', 403);
    }

    const updates: any = {};
    if (body.title) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.scheduledDate) updates.scheduled_date = body.scheduledDate;
    if (body.durationMinutes) updates.duration_minutes = body.durationMinutes;
    if (body.topic !== undefined) updates.topic = body.topic;
    if (body.phaseId !== undefined) updates.phase_id = body.phaseId;
    if (body.status) updates.status = body.status;
    if (body.thumbnailUrl !== undefined) updates.thumbnail_url = body.thumbnailUrl;
    if (body.videoUrl !== undefined) updates.video_url = body.videoUrl;

    const { data: session, error } = await supabase
      .from('live_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      return formatError(c, error.message, 'Failed to update session', 'UPDATE_SESSION_ERROR', 500);
    }

    logSuccess(c, 'Session updated', { sessionId });

    return c.json(mapSession(session));

  } catch (error: any) {
    return formatError(c, error.message, 'Update session error', 'UPDATE_ERROR', 500);
  }
});

// DELETE /api/live/sessions/:id - Delete session
liveCoaching.delete('/sessions/:id', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isHost = await isSessionHost(supabase, sessionId, userId);
    const admin = await isAdmin(supabase, userId);
    if (!isHost && !admin) {
      return formatError(c, 'Forbidden', 'Only session host or admin can delete', 'UNAUTHORIZED', 403);
    }

    const { error } = await supabase
      .from('live_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      return formatError(c, error.message, 'Failed to delete session', 'DELETE_SESSION_ERROR', 500);
    }

    logSuccess(c, 'Session deleted', { sessionId });

    return c.json({ success: true });

  } catch (error: any) {
    return formatError(c, error.message, 'Delete session error', 'DELETE_ERROR', 500);
  }
});

// POST /api/live/sessions/:id/start - Start session (create Daily room)
liveCoaching.post('/sessions/:id/start', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isHost = await isSessionHost(supabase, sessionId, userId);
    const admin = await isAdmin(supabase, userId);
    if (!isHost && !admin) {
      return formatError(c, 'Forbidden', 'Only session host or admin can start', 'UNAUTHORIZED', 403);
    }

    // Get session
    const { data: session, error: fetchError } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return formatError(c, 'Session not found', 'Session not found', 'SESSION_NOT_FOUND', 404);
    }

    // Create Daily room if not exists
    let roomName = session.daily_room_name;
    let roomUrl = session.daily_room_url;

    if (!roomName) {
      const room = await createDailyRoom(sessionId);
      roomName = room.name;
      roomUrl = room.url;
    }

    // Update session to live
    const { data: updatedSession, error: updateError } = await supabase
      .from('live_sessions')
      .update({
        status: 'live',
        daily_room_name: roomName,
        daily_room_url: roomUrl,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      return formatError(c, updateError.message, 'Failed to start session', 'START_SESSION_ERROR', 500);
    }

    logSuccess(c, 'Session started', { sessionId, roomName });

    return c.json({
      ...mapSession(updatedSession),
      dailyRoomName: roomName,
      dailyRoomUrl: roomUrl,
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Start session error', 'START_ERROR', 500);
  }
});

// POST /api/live/sessions/:id/end - End session
liveCoaching.post('/sessions/:id/end', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isHost = await isSessionHost(supabase, sessionId, userId);
    const admin = await isAdmin(supabase, userId);
    if (!isHost && !admin) {
      return formatError(c, 'Forbidden', 'Only session host or admin can end', 'UNAUTHORIZED', 403);
    }

    const { data: session, error } = await supabase
      .from('live_sessions')
      .update({ status: 'ended' })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      return formatError(c, error.message, 'Failed to end session', 'END_SESSION_ERROR', 500);
    }

    logSuccess(c, 'Session ended', { sessionId });

    return c.json(mapSession(session));

  } catch (error: any) {
    return formatError(c, error.message, 'End session error', 'END_ERROR', 500);
  }
});

// POST /api/live/sessions/:id/token - Get meeting token
liveCoaching.post('/sessions/:id/token', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get session
    const { data: session, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return formatError(c, 'Session not found', 'Session not found', 'SESSION_NOT_FOUND', 404);
    }

    if (!session.daily_room_name) {
      return formatError(c, 'Room not ready', 'Session has not started yet', 'ROOM_NOT_READY', 400);
    }

    const isHost = session.host_id === userId;

    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const authUser = userData?.user;
    const userName = authUser?.user_metadata?.first_name 
      ? `${authUser.user_metadata.first_name} ${authUser.user_metadata.last_name || ''}`.trim()
      : authUser?.email?.split('@')[0] || 'Deelnemer';

    const token = await createMeetingToken(
      session.daily_room_name,
      userId,
      userName,
      isHost
    );

    logSuccess(c, 'Token generated', { sessionId, isHost });

    return c.json({
      token,
      roomUrl: session.daily_room_url,
      roomName: session.daily_room_name,
      isHost,
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Token generation error', 'TOKEN_ERROR', 500);
  }
});

// ============================================
// REMINDER ROUTES
// ============================================

// POST /api/live/sessions/:id/reminder - Create reminder
liveCoaching.post('/sessions/:id/reminder', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if already exists
    const { data: existing } = await supabase
      .from('live_session_reminders')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return c.json({
        error: 'ReminderAlreadyExists',
        message: 'Je hebt al een reminder voor deze sessie',
      }, 409);
    }

    const { data: reminder, error } = await supabase
      .from('live_session_reminders')
      .insert({ session_id: sessionId, user_id: userId })
      .select()
      .single();

    if (error) {
      return formatError(c, error.message, 'Failed to create reminder', 'CREATE_REMINDER_ERROR', 500);
    }

    logSuccess(c, 'Reminder created', { sessionId });

    return c.json({ success: true, reminderId: reminder.id }, 201);

  } catch (error: any) {
    return formatError(c, error.message, 'Create reminder error', 'REMINDER_ERROR', 500);
  }
});

// GET /api/live/sessions/:id/reminder - Check if user has reminder
liveCoaching.get('/sessions/:id/reminder', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: reminder, error } = await supabase
      .from('live_session_reminders')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ hasReminder: false });
      }
      logError(c, `Failed to check reminder: ${error.message}`, 'CHECK_REMINDER_ERROR');
      return formatError(c, error.message, 'Failed to check reminder', 'CHECK_REMINDER_ERROR', 500);
    }

    return c.json({ hasReminder: !!reminder });

  } catch (error: any) {
    logError(c, `Reminder check error: ${error.message}`, 'REMINDER_CHECK_EXCEPTION');
    return formatError(c, error.message, 'Reminder check error', 'REMINDER_CHECK_ERROR', 500);
  }
});

// DELETE /api/live/sessions/:id/reminder - Delete reminder
liveCoaching.delete('/sessions/:id/reminder', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabase
      .from('live_session_reminders')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      return formatError(c, error.message, 'Failed to delete reminder', 'DELETE_REMINDER_ERROR', 500);
    }

    logSuccess(c, 'Reminder deleted', { sessionId });

    return c.json({ success: true });

  } catch (error: any) {
    return formatError(c, error.message, 'Delete reminder error', 'REMINDER_ERROR', 500);
  }
});

// ============================================
// CHAT ROUTES
// ============================================

// GET /api/live/sessions/:id/chat - Get chat messages
liveCoaching.get('/sessions/:id/chat', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const { limit = '50', before } = c.req.query();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabase
      .from('live_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      return formatError(c, error.message, 'Failed to fetch chat', 'FETCH_CHAT_ERROR', 500);
    }

    // Get user names for messages
    const userIds = [...new Set((messages || []).map(m => m.user_id))];
    const { data: users } = await supabase.auth.admin.listUsers();
    
    const userMap = new Map();
    (users?.users || []).forEach(u => {
      const name = u.user_metadata?.first_name 
        ? `${u.user_metadata.first_name} ${u.user_metadata.last_name || ''}`.trim()
        : u.email?.split('@')[0] || 'Guest';
      userMap.set(u.id, { name, initials: getInitials(name) });
    });

    logSuccess(c, 'Chat fetched', { sessionId, count: messages?.length || 0 });

    return c.json({
      messages: (messages || []).map(m => ({
        id: m.id,
        sessionId: m.session_id,
        userId: m.user_id,
        userName: userMap.get(m.user_id)?.name || 'Guest',
        userInitials: userMap.get(m.user_id)?.initials || 'G',
        message: m.message,
        isHost: m.is_host,
        createdAt: m.created_at,
      })),
      hasMore: (messages?.length || 0) >= parseInt(limit),
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Chat fetch error', 'CHAT_ERROR', 500);
  }
});

// POST /api/live/sessions/:id/chat - Send chat message
liveCoaching.post('/sessions/:id/chat', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');
    const user = c.get('user');
    const body = await c.req.json();
    const { message } = body;

    if (!checkChatRateLimit(userId)) {
      const limit = chatRateLimits.get(userId);
      const retryAfter = limit ? Math.ceil((limit.resetAt - Date.now()) / 1000) : 30;
      return c.json({
        error: 'RateLimitExceeded',
        message: 'Maximum 5 berichten per minuut. Probeer het later opnieuw.',
        retryAfter,
      }, 429);
    }

    if (!message || message.trim().length === 0) {
      return formatError(c, 'Message required', 'Message is required', 'MESSAGE_REQUIRED', 400);
    }

    if (message.length > 500) {
      return c.json({
        error: 'MessageTooLong',
        message: 'Bericht mag maximaal 500 karakters zijn',
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user is host
    const { data: session } = await supabase
      .from('live_sessions')
      .select('host_id')
      .eq('id', sessionId)
      .single();

    const isHost = session?.host_id === userId;

    const { data: chatMessage, error } = await supabase
      .from('live_chat_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        message: message.trim(),
        is_host: isHost,
      })
      .select()
      .single();

    if (error) {
      return formatError(c, error.message, 'Failed to send message', 'SEND_MESSAGE_ERROR', 500);
    }

    const userName = user?.user_metadata?.first_name 
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user?.email?.split('@')[0] || 'Guest';

    logSuccess(c, 'Message sent', { sessionId });

    return c.json({
      id: chatMessage.id,
      sessionId: chatMessage.session_id,
      userId: chatMessage.user_id,
      userName,
      userInitials: getInitials(userName),
      message: chatMessage.message,
      isHost: chatMessage.is_host,
      createdAt: chatMessage.created_at,
    }, 201);

  } catch (error: any) {
    return formatError(c, error.message, 'Send message error', 'CHAT_ERROR', 500);
  }
});

// ============================================
// POLL ROUTES
// ============================================

// GET /api/live/sessions/:id/polls - Get polls for session
liveCoaching.get('/sessions/:id/polls', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get polls with options
    const { data: polls, error } = await supabase
      .from('live_polls')
      .select(`
        *,
        options:live_poll_options(*)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      return formatError(c, error.message, 'Failed to fetch polls', 'FETCH_POLLS_ERROR', 500);
    }

    // Get user votes
    const pollIds = (polls || []).map(p => p.id);
    const { data: votes } = await supabase
      .from('live_poll_votes')
      .select('poll_id, option_id')
      .eq('user_id', userId)
      .in('poll_id', pollIds);

    const voteMap = new Map();
    (votes || []).forEach(v => voteMap.set(v.poll_id, v.option_id));

    logSuccess(c, 'Polls fetched', { sessionId, count: polls?.length || 0 });

    return c.json({
      polls: (polls || []).map(p => {
        const totalVotes = (p.options || []).reduce((sum: number, o: any) => sum + o.vote_count, 0);
        return {
          id: p.id,
          sessionId: p.session_id,
          question: p.question,
          isActive: p.is_active,
          options: (p.options || []).map((o: any) => ({
            id: o.id,
            pollId: o.poll_id,
            optionText: o.option_text,
            voteCount: o.vote_count,
          })),
          totalVotes,
          userVoted: voteMap.has(p.id),
          userVoteOptionId: voteMap.get(p.id) || null,
          createdAt: p.created_at,
        };
      }),
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Polls fetch error', 'POLLS_ERROR', 500);
  }
});

// POST /api/live/sessions/:id/polls - Create poll (Host/Admin only)
liveCoaching.post('/sessions/:id/polls', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const userId = c.get('userId');
    const body = await c.req.json();
    const { question, options } = body;

    if (!question || !options || options.length < 2) {
      return formatError(c, 'Invalid poll data', 'Question and at least 2 options required', 'INVALID_POLL', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isHost = await isSessionHost(supabase, sessionId, userId);
    const admin = await isAdmin(supabase, userId);
    if (!isHost && !admin) {
      return formatError(c, 'Forbidden', 'Only session host or admin can create polls', 'UNAUTHORIZED', 403);
    }

    // Create poll
    const { data: poll, error: pollError } = await supabase
      .from('live_polls')
      .insert({ session_id: sessionId, question })
      .select()
      .single();

    if (pollError) {
      return formatError(c, pollError.message, 'Failed to create poll', 'CREATE_POLL_ERROR', 500);
    }

    // Create options
    const { data: pollOptions, error: optionsError } = await supabase
      .from('live_poll_options')
      .insert(options.map((text: string) => ({
        poll_id: poll.id,
        option_text: text,
      })))
      .select();

    if (optionsError) {
      return formatError(c, optionsError.message, 'Failed to create poll options', 'CREATE_OPTIONS_ERROR', 500);
    }

    logSuccess(c, 'Poll created', { sessionId, pollId: poll.id });

    return c.json({
      id: poll.id,
      sessionId: poll.session_id,
      question: poll.question,
      isActive: poll.is_active,
      options: (pollOptions || []).map(o => ({
        id: o.id,
        pollId: o.poll_id,
        optionText: o.option_text,
        voteCount: o.vote_count,
      })),
      totalVotes: 0,
      userVoted: false,
      userVoteOptionId: null,
      createdAt: poll.created_at,
    }, 201);

  } catch (error: any) {
    return formatError(c, error.message, 'Create poll error', 'POLL_ERROR', 500);
  }
});

// POST /api/live/polls/:id/vote - Vote on poll
liveCoaching.post('/polls/:id/vote', requireAuth, async (c) => {
  try {
    const pollId = c.req.param('id');
    const userId = c.get('userId');
    const body = await c.req.json();
    const { optionId } = body;

    if (!optionId) {
      return formatError(c, 'Option required', 'optionId is required', 'OPTION_REQUIRED', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify option belongs to the poll
    const { data: option } = await supabase
      .from('live_poll_options')
      .select('id, poll_id')
      .eq('id', optionId)
      .eq('poll_id', pollId)
      .single();

    if (!option) {
      return formatError(c, 'Invalid option', 'Option does not belong to this poll', 'INVALID_OPTION', 400);
    }

    // Check if poll is still active
    const { data: poll } = await supabase
      .from('live_polls')
      .select('is_active')
      .eq('id', pollId)
      .single();

    if (!poll?.is_active) {
      return formatError(c, 'Poll closed', 'This poll is no longer accepting votes', 'POLL_CLOSED', 400);
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from('live_poll_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('user_id', userId)
      .single();

    if (existingVote) {
      return c.json({
        error: 'AlreadyVoted',
        message: 'Je hebt al gestemd op deze poll',
      }, 409);
    }

    // Create vote and increment count atomically via RPC
    const { error: voteError } = await supabase
      .from('live_poll_votes')
      .insert({ poll_id: pollId, user_id: userId, option_id: optionId });

    if (voteError) {
      if (voteError.code === '23505') {
        return c.json({ error: 'AlreadyVoted', message: 'Je hebt al gestemd op deze poll' }, 409);
      }
      return formatError(c, voteError.message, 'Failed to vote', 'VOTE_ERROR', 500);
    }

    // Increment vote count
    await supabase.rpc('increment_poll_vote', { option_id: optionId });

    // Get updated poll
    const { data: updatedPoll } = await supabase
      .from('live_polls')
      .select(`
        *,
        options:live_poll_options(*)
      `)
      .eq('id', pollId)
      .single();

    const totalVotes = (updatedPoll?.options || []).reduce((sum: number, o: any) => sum + o.vote_count, 0);

    logSuccess(c, 'Vote recorded', { pollId, optionId });

    return c.json({
      success: true,
      poll: {
        id: updatedPoll.id,
        question: updatedPoll.question,
        options: (updatedPoll.options || []).map((o: any) => ({
          id: o.id,
          optionText: o.option_text,
          voteCount: o.vote_count,
        })),
        totalVotes,
        userVoted: true,
        userVoteOptionId: optionId,
      },
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Vote error', 'VOTE_ERROR', 500);
  }
});

// PUT /api/live/polls/:id/close - Close poll (Host/Admin only)
liveCoaching.put('/polls/:id/close', requireAuth, async (c) => {
  try {
    const pollId = c.req.param('id');
    const userId = c.get('userId');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get poll's session to check host
    const { data: poll } = await supabase
      .from('live_polls')
      .select('session_id')
      .eq('id', pollId)
      .single();

    if (!poll) {
      return formatError(c, 'Poll not found', 'Poll not found', 'POLL_NOT_FOUND', 404);
    }

    const isHost = await isSessionHost(supabase, poll.session_id, userId);
    const admin = await isAdmin(supabase, userId);
    if (!isHost && !admin) {
      return formatError(c, 'Forbidden', 'Only session host or admin can close polls', 'UNAUTHORIZED', 403);
    }

    const { error } = await supabase
      .from('live_polls')
      .update({ is_active: false })
      .eq('id', pollId);

    if (error) {
      return formatError(c, error.message, 'Failed to close poll', 'CLOSE_POLL_ERROR', 500);
    }

    logSuccess(c, 'Poll closed', { pollId });

    return c.json({ success: true });

  } catch (error: any) {
    return formatError(c, error.message, 'Close poll error', 'POLL_ERROR', 500);
  }
});

export { liveCoaching };
