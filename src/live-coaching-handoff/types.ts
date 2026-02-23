// ============================================
// HugoHerbots.ai Live Coaching - Type Definitions
// ============================================

/**
 * Live Session Status
 */
export type SessionStatus = "upcoming" | "live" | "ended";

/**
 * Live Coaching Session
 */
export interface LiveSession {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string; // ISO 8601 format
  duration: number; // minutes
  topic: string; // e.g. "Fase 2 • Ontdekkingsfase"
  phaseId: 1 | 2 | 3 | 4; // Sales phase
  status: SessionStatus;
  videoUrl?: string; // Livestream URL (live) or recording URL (ended)
  thumbnailUrl?: string;
  viewerCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat Message
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userInitials: string;
  message: string;
  isHost: boolean;
  createdAt: string; // ISO 8601 format
}

/**
 * Poll
 */
export interface Poll {
  id: string;
  sessionId: string;
  question: string;
  isActive: boolean;
  options: PollOption[];
  totalVotes: number;
  userVoted: boolean;
  userVoteOptionId?: string;
  createdAt: string;
}

/**
 * Poll Option
 */
export interface PollOption {
  id: string;
  pollId: string;
  text: string;
  voteCount: number;
}

/**
 * Poll Vote
 */
export interface PollVote {
  id: string;
  pollId: string;
  userId: string;
  optionId: string;
  createdAt: string;
}

/**
 * Session Reminder
 */
export interface SessionReminder {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * GET /api/live/sessions
 */
export interface GetSessionsRequest {
  status?: SessionStatus;
  limit?: number;
}

export interface GetSessionsResponse {
  sessions: LiveSession[];
}

/**
 * GET /api/live/sessions/:sessionId
 */
export interface GetSessionResponse extends LiveSession {
  hasReminder: boolean;
}

/**
 * POST /api/live/sessions/:sessionId/reminder
 */
export interface CreateReminderRequest {
  userId: string;
}

export interface CreateReminderResponse {
  success: boolean;
  reminderId: string;
}

/**
 * DELETE /api/live/sessions/:sessionId/reminder
 */
export interface DeleteReminderResponse {
  success: boolean;
}

/**
 * GET /api/live/sessions/:sessionId/chat
 */
export interface GetChatMessagesRequest {
  limit?: number;
  before?: string; // ISO timestamp for pagination
}

export interface GetChatMessagesResponse {
  messages: ChatMessage[];
  hasMore: boolean;
}

/**
 * POST /api/live/sessions/:sessionId/chat
 */
export interface SendChatMessageRequest {
  userId: string;
  message: string;
}

export interface SendChatMessageResponse extends ChatMessage {}

/**
 * GET /api/live/sessions/:sessionId/polls
 */
export interface GetPollsResponse {
  polls: Poll[];
}

/**
 * POST /api/live/polls/:pollId/vote
 */
export interface VotePollRequest {
  userId: string;
  optionId: string;
}

export interface VotePollResponse {
  success: boolean;
  poll: Poll;
}

// ============================================
// WebSocket Event Types
// ============================================

/**
 * WebSocket Message Base
 */
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
}

/**
 * Server → Client: New chat message
 */
export interface ChatMessageEvent {
  type: "chat:message";
  data: ChatMessage;
}

/**
 * Server → Client: Poll vote update
 */
export interface PollUpdateEvent {
  type: "poll:update";
  data: {
    pollId: string;
    optionId: string;
    voteCount: number;
    totalVotes: number;
  };
}

/**
 * Server → Client: Session status change
 */
export interface SessionStatusEvent {
  type: "session:status";
  data: {
    sessionId: string;
    status: SessionStatus;
    viewerCount?: number;
  };
}

/**
 * Server → Client: Viewer count update
 */
export interface ViewerCountEvent {
  type: "viewer:count";
  data: {
    sessionId: string;
    viewerCount: number;
  };
}

/**
 * Client → Server: Send chat message
 */
export interface SendChatEvent {
  type: "chat:send";
  data: {
    message: string;
  };
}

/**
 * Client → Server: Vote on poll
 */
export interface VotePollEvent {
  type: "poll:vote";
  data: {
    pollId: string;
    optionId: string;
  };
}

/**
 * Union type of all server events
 */
export type ServerEvent =
  | ChatMessageEvent
  | PollUpdateEvent
  | SessionStatusEvent
  | ViewerCountEvent;

/**
 * Union type of all client events
 */
export type ClientEvent = SendChatEvent | VotePollEvent;

// ============================================
// Calendar Export Types
// ============================================

/**
 * Calendar Event for .ics export
 */
export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  description: string;
  location: string;
  uid: string;
}

// ============================================
// Frontend Component Props
// ============================================

/**
 * LiveCoaching Page Props
 */
export interface LiveCoachingProps {
  navigate?: (page: string) => void;
  isPreview?: boolean;
}

/**
 * Session Card Props
 */
export interface SessionCardProps {
  session: LiveSession;
  hasReminder?: boolean;
  onAddToCalendar: (sessionId: string) => void;
  onSetReminder: (sessionId: string) => void;
  onRemoveReminder: (sessionId: string) => void;
  onClick?: (sessionId: string) => void;
}

/**
 * Chat Panel Props
 */
export interface ChatPanelProps {
  sessionId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

/**
 * Poll Panel Props
 */
export interface PollPanelProps {
  polls: Poll[];
  onVote: (pollId: string, optionId: string) => void;
  isLoading?: boolean;
}

// ============================================
// Utility Types
// ============================================

/**
 * API Error Response
 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
