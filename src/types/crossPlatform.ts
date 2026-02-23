export type Platform = 'com' | 'ai';
export type PlatformTarget = 'com' | 'ai' | 'both';

export type ActivityType =
  | 'video_view'
  | 'video_complete'
  | 'webinar_attend'
  | 'webinar_complete'
  | 'chat_session'
  | 'chat_message'
  | 'technique_practice'
  | 'technique_mastered'
  | 'roleplay_complete'
  | 'login'
  | 'page_view';

export type EntityType = 'video' | 'webinar' | 'technique' | 'session';

export interface ActivityMetadata {
  duration_watched?: number;
  percentage?: number;
  messages_count?: number;
  topic?: string;
  score?: number;
  feedback?: string;
  title?: string;
  progress?: number;
  session_title?: string;
  [key: string]: unknown;
}

export interface ActivityPayload {
  userId: string;
  activityType: ActivityType;
  sourceApp: Platform;
  entityType?: EntityType;
  entityId?: string;
  metadata?: ActivityMetadata;
  durationSeconds?: number;
  score?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestPayload {
  message: string;
  userId?: string;
  sourceApp: Platform;
  sessionId?: string;
  conversationHistory?: ChatMessage[];
  messages?: Array<{ role: string; content: string }>;
  techniqueContext?: string;
}

export interface ChatResponse {
  message: string;
  sessionId?: string;
  mode?: string;
  technique?: string;
  sources?: ChatSource[];
  suggestions?: string[];
}

export interface ChatSource {
  title: string;
  videoId?: string;
  chunk?: string;
}

export interface SessionCreatePayload {
  userId: string;
  techniqueId?: string;
  techniqueName?: string;
  isExpert?: boolean;
}

export interface SessionCreateResponse {
  sessionId: string;
  greeting: string;
  mode: string;
}

export interface ActivitySummary {
  videosWatched: number;
  videosCompleted?: number;
  webinarsAttended: number;
  techniquesExplored: number;
  totalChatSessions: number;
  totalActivities?: number;
  lastActivity?: string | null;
  welcomeMessage?: string;
}

export interface ActivitySummaryApiResponse {
  summary: {
    videosWatched?: number;
    videos_watched?: number;
    videosCompleted?: number;
    videos_completed?: number;
    webinarsAttended?: number;
    webinars_attended?: number;
    techniquesExplored?: number;
    totalChatSessions?: number;
    chat_sessions?: number;
    welcomeMessage?: string;
  };
  welcomeMessage?: string;
}

export interface HugoContext {
  welcomeMessage: string;
  userProfile?: Record<string, unknown>;
  recentActivity?: Array<Record<string, unknown>>;
  mastery?: Record<string, unknown>;
  suggestedTopics?: string[];
}

export interface HandoffResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface HandoffValidation {
  valid: boolean;
  userId?: string;
  targetPath?: string;
}

export type SyncMessageType = 'api_spec' | 'config' | 'request' | 'response' | 'notification';
export type SyncMessageStatus = 'pending' | 'read' | 'implemented' | 'rejected';

export interface SyncMessage {
  id: string;
  source_platform: Platform;
  target_platform: PlatformTarget;
  message_type: SyncMessageType;
  title: string;
  content: Record<string, unknown>;
  status: SyncMessageStatus;
  created_at: string;
  updated_at: string;
  read_at: string | null;
}

export interface HealthCheckApiResponse {
  status: string;
  engine?: string;
}

export interface HealthCheckResult {
  connected: boolean;
  version?: string;
}

export interface UserActivityRow {
  user_id: string;
  activity_type: ActivityType;
  source_app: Platform;
  video_id: string | null;
  webinar_id: string | null;
  session_id: string | null;
  techniek_id: string | null;
  metadata: Record<string, unknown>;
}

export interface RagSource {
  type: 'technique' | 'video' | 'webinar' | 'slide';
  title: string;
  snippet: string;
  relevance: number;
  metadata?: Record<string, unknown>;
}

export interface RichContent {
  type: 'card' | 'video' | 'slide' | 'webinar' | 'action' | 'roleplay' | 'epic_slide';
  data: CardContent | VideoEmbed | SlideContent | WebinarLink | ActionButton | RoleplayProposal | EpicSlideContent;
}

export interface CardContent {
  title: string;
  description: string;
  image?: string;
  techniqueId?: string;
  phase?: string;
  link?: string;
}

export interface VideoEmbed {
  title: string;
  muxPlaybackId?: string;
  videoId?: string;
  thumbnailUrl?: string;
  duration?: number;
  techniqueId?: string;
}

export interface SlideContent {
  title: string;
  slideUrl?: string;
  thumbnailUrl?: string;
  techniqueId?: string;
  slideIndex?: number;
  totalSlides?: number;
}

export interface EpicSlideContent {
  id: string;
  titel: string;
  kernboodschap: string;
  bulletpoints: string[];
  phase: string;
  techniqueId: string;
  visual_type: 'diagram' | 'lijst' | 'matrix' | 'quote';
  personalized_context?: Record<string, string>;
}

export interface WebinarLink {
  title: string;
  description?: string;
  url: string;
  date?: string;
  isLive?: boolean;
  techniqueId?: string;
}

export interface ActionButton {
  label: string;
  action: 'start_roleplay' | 'watch_video' | 'view_slide' | 'join_webinar' | 'practice_technique' | 'open_link';
  payload?: Record<string, unknown>;
}

export interface RoleplayProposal {
  title: string;
  description: string;
  scenario: string;
  techniqueId: string;
  difficulty: 'onbewuste_onkunde' | 'bewuste_onkunde' | 'bewuste_kunde' | 'onbewuste_kunde';
  estimatedMinutes?: number;
}

export const CHAT_ENDPOINTS = ['/api/v2/chat', '/api/chat', '/api/chat/message'] as const;

export const SHARED_SUPABASE_TABLES = [
  'user_activity',
  'platform_sync',
  'sso_handoff_tokens',
  'features',
  'plans',
  'plan_features',
] as const;
