import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, real, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  scenarioId: text("scenario_id"),
  fase: integer("fase").default(1).notNull(),
  mode: text("mode").default("COACH_CHAT").notNull(),
  houding: text("houding"),
  techniqueId: text("technique_id"),
  techniqueContext: jsonb("technique_context"),
  contextQuestionIndex: integer("context_question_index"),
  customerProfile: jsonb("customer_profile"),
  stapStack: jsonb("stap_stack").default([]),
  lockedThemes: jsonb("locked_themes").default([]),
  usedTechniques: jsonb("used_techniques").default([]),
  pendingObjections: jsonb("pending_objections").default([]),
  scoreTotal: integer("score_total").default(0),
  lastCustomerAttitude: text("last_customer_attitude"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const turns = pgTable("turns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  text: text("text").notNull(),
  techniqueId: text("technique_id"),
  mode: text("mode"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lockEvents = pgTable("lock_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").notNull(),
  theme: text("theme"),
  techniqueId: text("technique_id"),
  type: text("type"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const techniqueSessions = pgTable("technique_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  techniqueId: text("technique_id").notNull(),
  context: jsonb("context"),
  lastUsed: timestamp("last_used").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videos = pgTable("videos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"),
  courseModule: text("course_module"),
  techniqueId: text("technique_id"),
  order: integer("order").default(0),
  muxAssetId: text("mux_asset_id"),
  muxPlaybackId: text("mux_playback_id"),
  transcript: text("transcript"),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoProgress = pgTable("video_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  videoId: text("video_id").notNull(),
  watchedSeconds: integer("watched_seconds").default(0),
  totalSeconds: integer("total_seconds").default(0),
  completed: boolean("completed").default(false),
  lastPosition: integer("last_position").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const liveSessions = pgTable("live_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title").notNull(),
  description: text("description"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").default(90),
  topic: varchar("topic"),
  phaseId: integer("phase_id"),
  status: varchar("status").default("upcoming"),
  dailyRoomName: varchar("daily_room_name"),
  dailyRoomUrl: varchar("daily_room_url"),
  videoUrl: varchar("video_url"),
  thumbnailUrl: varchar("thumbnail_url"),
  viewersCount: integer("viewer_count").default(0),
  hostId: uuid("host_id"),
  recordingId: varchar("recording_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const liveSessionAttendees = pgTable("live_session_attendees", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  userId: uuid("user_id").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  reminderSet: integer("reminder_set").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const liveChatMessages = pgTable("live_chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  userId: uuid("user_id").notNull(),
  message: text("message").notNull(),
  isHost: boolean("is_host").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const livePolls = pgTable("live_polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  question: text("question").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const livePollOptions = pgTable("live_poll_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollId: uuid("poll_id").notNull(),
  optionText: varchar("option_text").notNull(),
  votes: integer("vote_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const livePollVotes = pgTable("live_poll_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollId: uuid("poll_id").notNull(),
  optionId: uuid("option_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userStats = pgTable("user_stats", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  totalSessions: integer("total_sessions").default(0).notNull(),
  totalTimeSeconds: integer("total_time_seconds").default(0).notNull(),
  totalVideoTimeSeconds: integer("total_video_time_seconds").default(0).notNull(),
  averageScore: integer("average_score").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  weeklySessionCounts: jsonb("weekly_session_counts").default([]),
  lastActiveDate: text("last_active_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const techniqueMastery = pgTable("technique_mastery", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  techniqueId: text("technique_id").notNull(),
  techniqueName: text("technique_name"),
  attemptCount: integer("attempt_count").default(0).notNull(),
  successCount: integer("success_count").default(0).notNull(),
  totalScore: integer("total_score").default(0).notNull(),
  averageScore: integer("average_score").default(0).notNull(),
  masteryLevel: text("mastery_level").default("beginner").notNull(),
  lastPracticed: timestamp("last_practiced"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  score: integer("score"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userContext = pgTable("user_context", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  product: text("product"),
  klantType: text("klant_type"),
  sector: text("sector"),
  setting: text("setting"),
  additionalContext: jsonb("additional_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const v2Sessions = pgTable("v2_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  techniqueId: text("technique_id").notNull(),
  isActive: integer("is_active").default(1).notNull(),
  totalScore: integer("total_score").default(0).notNull(),
  turnNumber: integer("turn_number").default(0).notNull(),
  context: jsonb("context"),
  events: jsonb("events"),
  feedback: jsonb("feedback"),
  epicPhase: text("epic_phase"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userTrainingProfile = pgTable("user_training_profile", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  currentDifficulty: integer("current_difficulty").default(1).notNull(),
  successStreak: integer("success_streak").default(0).notNull(),
  totalSessions: integer("total_sessions").default(0).notNull(),
  totalSuccesses: integer("total_successes").default(0).notNull(),
  strugglePatterns: jsonb("struggle_patterns").default({}),
  recentPersonas: jsonb("recent_personas").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const personaHistory = pgTable("persona_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  sessionId: text("session_id").notNull(),
  customerProfile: jsonb("customer_profile"),
  techniqueId: text("technique_id"),
  outcome: text("outcome"),
  successSignals: integer("success_signals").default(0),
  struggleSignals: jsonb("struggle_signals"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessionArtifacts = pgTable("session_artifacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").notNull(),
  userId: text("user_id").notNull(),
  artifactType: text("artifact_type").notNull(),
  techniqueId: text("technique_id").notNull(),
  content: jsonb("content"),
  epicPhase: text("epic_phase"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ragDocuments = pgTable("rag_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  docType: text("doc_type").notNull(),
  sourceId: text("source_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  techniekId: text("techniek_id"),
  fase: text("fase"),
  categorie: text("categorie"),
  wordCount: integer("word_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type Turn = typeof turns.$inferSelect;
export type InsertTurn = typeof turns.$inferInsert;

export type LockEvent = typeof lockEvents.$inferSelect;
export type InsertLockEvent = typeof lockEvents.$inferInsert;

export type TechniqueSession = typeof techniqueSessions.$inferSelect;
export type InsertTechniqueSession = typeof techniqueSessions.$inferInsert;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

export type VideoProgress = typeof videoProgress.$inferSelect;
export type InsertVideoProgress = typeof videoProgress.$inferInsert;

export type LiveSession = typeof liveSessions.$inferSelect;
export type InsertLiveSession = typeof liveSessions.$inferInsert;

export type LiveSessionAttendee = typeof liveSessionAttendees.$inferSelect;

export type LiveChatMessage = typeof liveChatMessages.$inferSelect;
export type InsertLiveChatMessage = typeof liveChatMessages.$inferInsert;

export type LivePoll = typeof livePolls.$inferSelect;
export type InsertLivePoll = typeof livePolls.$inferInsert;

export type LivePollOption = typeof livePollOptions.$inferSelect;
export type InsertLivePollOption = typeof livePollOptions.$inferInsert;

export type LivePollVote = typeof livePollVotes.$inferSelect;

export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = typeof userStats.$inferInsert;

export type TechniqueMastery = typeof techniqueMastery.$inferSelect;
export type InsertTechniqueMastery = typeof techniqueMastery.$inferInsert;

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

export type UserContext = typeof userContext.$inferSelect;
export type InsertUserContext = typeof userContext.$inferInsert;

export type V2Session = typeof v2Sessions.$inferSelect;
export type InsertV2Session = typeof v2Sessions.$inferInsert;

export type SessionArtifact = typeof sessionArtifacts.$inferSelect;
export type InsertSessionArtifact = typeof sessionArtifacts.$inferInsert;

export interface SessionState {
  sessionId: string;
  scenarioId: string | null;
  fase: 1 | 2 | 3 | 4;
  mode: string;
  houding: string | null;
  stapStack: string[];
  lockedThemes: string[];
  usedTechniques: string[];
  pendingObjections: string[];
  lastCustomerAttitude: string | null;
  scoreTotal: number | null;
}

export interface CustomerProfile {
  behavior_style: "controlerend" | "faciliterend" | "analyserend" | "promoverend";
  buying_clock: "00-06" | "06-08" | "08-11" | "11-12";
  experience_level: 0 | 1;
  difficulty: 1 | 2 | 3 | 4;
}

export interface MessageResponse {
  assistant: string;
  speechText: string;
  fase: 1 | 2 | 3 | 4;
  applied_technique: string;
  locks: string[];
  score: {
    delta: number;
    total: number;
  };
  next_allowed: string[];
  warnings: string[];
  mistakes_detected: string[];
  feedback: any;
  metadata: any;
  debug?: any;
}
