export interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  scheduledDate: string;
  durationMinutes: number;
  topic: string | null;
  phaseId: number | null;
  status: 'upcoming' | 'live' | 'ended';
  dailyRoomName: string | null;
  dailyRoomUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  viewerCount: number;
  hostId: string | null;
  createdAt: string;
  updatedAt: string;
  hasReminder?: boolean;
  recordingUrl?: string | null;
  isRecording?: boolean;
  recordingId?: string | null;
  dailyRecordingId?: string | null;
  dailyRecordingUrl?: string | null;
  recordingReady?: number;
  muxPlaybackId?: string | null;
  muxAssetId?: string | null;
  transcript?: string | null;
  aiSummary?: string | null;
}

export interface LiveChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userInitials: string;
  message: string;
  isHost: boolean;
  createdAt: string;
}

export interface LivePoll {
  id: string;
  sessionId: string;
  question: string;
  isActive: boolean;
  options: LivePollOption[];
  totalVotes: number;
  userVoted: boolean;
  userVoteOptionId: string | null;
  createdAt: string;
}

export interface LivePollOption {
  id: string;
  pollId: string;
  optionText: string;
  voteCount: number;
}

export interface LiveSessionReminder {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: string;
}

export interface CreateSessionRequest {
  title: string;
  description?: string;
  scheduledDate: string;
  durationMinutes?: number;
  topic?: string;
  phaseId?: number;
  thumbnailUrl?: string;
}

export interface UpdateSessionRequest {
  title?: string;
  description?: string;
  scheduledDate?: string;
  durationMinutes?: number;
  topic?: string;
  phaseId?: number;
  status?: 'upcoming' | 'live' | 'ended';
  thumbnailUrl?: string;
  videoUrl?: string;
}

export interface CreatePollRequest {
  question: string;
  options: string[];
}

export interface SendChatRequest {
  message: string;
}

export interface VotePollRequest {
  optionId: string;
}

export type WebSocketEventType = 
  | 'connected'
  | 'chat:message'
  | 'poll:created'
  | 'poll:update'
  | 'poll:closed'
  | 'session:status'
  | 'viewer:count'
  | 'error';

export interface WebSocketMessage<T = any> {
  type: WebSocketEventType;
  data: T;
}

export interface ChatMessageEvent {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userInitials: string;
  message: string;
  isHost: boolean;
  createdAt: string;
}

export interface PollUpdateEvent {
  pollId: string;
  optionId: string;
  voteCount: number;
  totalVotes: number;
}

export interface SessionStatusEvent {
  sessionId: string;
  status: 'upcoming' | 'live' | 'ended';
  viewerCount: number;
}

export interface ViewerCountEvent {
  sessionId: string;
  viewerCount: number;
}
