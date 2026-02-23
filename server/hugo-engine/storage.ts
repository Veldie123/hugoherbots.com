// Database storage implementation using PostgreSQL
import { 
  users, sessions, turns, lockEvents, techniqueSessions, videos, videoProgress,
  liveSessions, liveSessionAttendees, liveChatMessages, livePolls, livePollOptions, livePollVotes,
  userStats, techniqueMastery, activityLog, userContext, v2Sessions,
  type User, type InsertUser,
  type Session, type InsertSession,
  type Turn, type InsertTurn,
  type LockEvent, type InsertLockEvent,
  type TechniqueSession, type InsertTechniqueSession,
  type SessionState,
  type Video, type InsertVideo,
  type VideoProgress, type InsertVideoProgress,
  type LiveSession, type InsertLiveSession,
  type LiveChatMessage, type InsertLiveChatMessage,
  type LivePoll, type InsertLivePoll,
  type LivePollOption, type InsertLivePollOption,
  type LiveSessionAttendee, type LivePollVote,
  type UserStats, type InsertUserStats,
  type TechniqueMastery, type InsertTechniqueMastery,
  type ActivityLog, type InsertActivityLog,
  type UserContext, type InsertUserContext,
  type V2Session, type InsertV2Session
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Mode } from "./mode-transitions";
import { loadFases } from "./config-loader";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Sessions
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session>;
  getSessionState(id: string): Promise<SessionState | undefined>;
  
  // Turns
  createTurn(turn: InsertTurn): Promise<Turn>;
  getSessionTurns(sessionId: string): Promise<Turn[]>;
  deleteSessionTurns(sessionId: string): Promise<void>;
  updateTurnMeta(turnId: string, meta: any): Promise<Turn>;
  updateTurn(turnId: string, updates: Partial<Turn>): Promise<Turn>;
  
  // Commitment events (uses lockEvents table for backwards compatibility)
  createLockEvent(lockEvent: InsertLockEvent): Promise<LockEvent>;
  getSessionLocks(sessionId: string): Promise<LockEvent[]>;
  // Commitment aliases (same underlying implementation)
  createCommitmentEvent(event: InsertLockEvent): Promise<LockEvent>;
  getSessionCommitments(sessionId: string): Promise<LockEvent[]>;
  
  // Technique sessions
  createTechniqueSession(session: InsertTechniqueSession): Promise<TechniqueSession>;
  getTechniqueSession(userId: string, techniqueId: string): Promise<TechniqueSession | undefined>;
  updateTechniqueSession(id: string, context: any): Promise<TechniqueSession>;
  countUserTechniqueSessions(userId: string): Promise<number>;
  
  // Videos
  createVideo(video: InsertVideo): Promise<Video>;
  getVideo(id: string): Promise<Video | undefined>;
  getVideos(): Promise<Video[]>;
  updateVideo(id: string, updates: Partial<Video>): Promise<Video>;
  getVideosByModule(module: string): Promise<Video[]>;
  getVideosByTechniqueId(techniqueId: string): Promise<Video[]>;
  
  // Video progress
  createVideoProgress(progress: InsertVideoProgress): Promise<VideoProgress>;
  getVideoProgress(userId: string, videoId: string): Promise<VideoProgress | undefined>;
  updateVideoProgress(id: string, updates: Partial<VideoProgress>): Promise<VideoProgress>;
  getUserVideoProgress(userId: string): Promise<VideoProgress[]>;
  
  // Live sessions
  createLiveSession(session: InsertLiveSession): Promise<LiveSession>;
  getLiveSession(id: string): Promise<LiveSession | undefined>;
  getLiveSessions(): Promise<LiveSession[]>;
  getLiveSessionsByStatus(status: string): Promise<LiveSession[]>;
  updateLiveSession(id: string, updates: Partial<LiveSession>): Promise<LiveSession>;
  
  // Live chat
  createChatMessage(message: InsertLiveChatMessage): Promise<LiveChatMessage>;
  getSessionChatMessages(sessionId: string): Promise<LiveChatMessage[]>;
  
  // Live polls
  createPoll(poll: InsertLivePoll): Promise<LivePoll>;
  getPoll(id: string): Promise<LivePoll | undefined>;
  getSessionPolls(sessionId: string): Promise<LivePoll[]>;
  updatePoll(id: string, updates: Partial<LivePoll>): Promise<LivePoll>;
  createPollOption(option: InsertLivePollOption): Promise<LivePollOption>;
  getPollOptions(pollId: string): Promise<LivePollOption[]>;
  votePoll(pollId: string, optionId: string, userId: string): Promise<void>;
  getUserPollVote(pollId: string, userId: string): Promise<LivePollVote | undefined>;
  
  // Attendees
  joinLiveSession(sessionId: string, userId: string): Promise<void>;
  leaveLiveSession(sessionId: string, userId: string): Promise<void>;
  setReminder(sessionId: string, userId: string): Promise<void>;
  
  // User Analytics
  getUserStats(userId: string): Promise<UserStats | undefined>;
  createOrUpdateUserStats(userId: string, updates: Partial<InsertUserStats>): Promise<UserStats>;
  incrementUserStats(userId: string, field: 'totalSessions' | 'totalTimeSeconds' | 'totalVideoTimeSeconds', amount: number): Promise<void>;
  updateUserAverageScore(userId: string, sessionScore: number): Promise<void>;
  updateStreak(userId: string): Promise<UserStats>;
  
  // Technique Mastery
  getTechniqueMastery(userId: string, techniqueId: string): Promise<TechniqueMastery | undefined>;
  getUserTechniqueMasteries(userId: string): Promise<TechniqueMastery[]>;
  recordTechniqueAttempt(userId: string, techniqueId: string, techniqueName: string, score: number, success: boolean): Promise<TechniqueMastery>;
  
  // Activity Log
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  getUserActivityLog(userId: string, limit?: number): Promise<ActivityLog[]>;
  getUserSessionsThisWeek(userId: string): Promise<number>;
  getUserSessionsByWeek(userId: string, weeks: number): Promise<number[]>;
  
  // User Context
  getUserContext(userId: string): Promise<UserContext | undefined>;
  createOrUpdateUserContext(userId: string, context: Partial<InsertUserContext>): Promise<UserContext>;
  
  // V2 Sessions
  saveV2Session(session: InsertV2Session): Promise<V2Session>;
  getV2Session(sessionId: string): Promise<V2Session | undefined>;
  updateV2Session(sessionId: string, updates: Partial<InsertV2Session>): Promise<V2Session>;
  deleteV2Session(sessionId: string): Promise<void>;
  getActiveV2Sessions(userId: string): Promise<V2Session[]>;
  getRecentV2Sessions(userId: string, limitDays?: number): Promise<V2Session[]>;
  endV2Session(sessionId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Sessions
  async createSession(insertSession: InsertSession): Promise<Session> {
    // Use provided fase or default to 1
    const fase = insertSession.fase || 1;
    
    // Initialize stapStack based on fase configuration
    let defaultStapStack: string[] = [];
    if (fase === 1) {
      // Get phase 1 configuration
      const fases = loadFases();
      const faseData = fases.find(f => f.fase === 1);
      if (faseData) {
        // Extract technique IDs from phase 1 config
        // Phase 1 uses object format with verplicht_volgnummer for ordering
        defaultStapStack = faseData.technieken
          .filter((t): t is { nummer?: string; naam: string; verplicht_volgnummer?: number } => 
            typeof t === 'object' && t !== null
          )
          .sort((a, b) => (a.verplicht_volgnummer || 0) - (b.verplicht_volgnummer || 0))
          .map(t => t.nummer || `1.${t.verplicht_volgnummer || 1}`);
      } else {
        // Fallback if no fase config found
        defaultStapStack = ["1.1"];
      }
    }
    
    const [session] = await db
      .insert(sessions)
      .values({
        ...insertSession,
        fase,
        stapStack: defaultStapStack,
        lockedThemes: [],
        usedTechniques: [],
        pendingObjections: [],
        scoreTotal: 0,
      })
      .returning();
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const [session] = await db
      .update(sessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  async getSessionState(id: string): Promise<SessionState | undefined> {
    const session = await this.getSession(id);
    if (!session) return undefined;

    return {
      sessionId: session.id,
      scenarioId: session.scenarioId,
      fase: session.fase as 1 | 2 | 3 | 4,
      mode: session.mode as Mode,
      houding: session.houding,
      stapStack: session.stapStack as string[],
      lockedThemes: session.lockedThemes as string[],
      usedTechniques: session.usedTechniques as string[],
      pendingObjections: session.pendingObjections as string[],
      lastCustomerAttitude: session.lastCustomerAttitude,
      scoreTotal: session.scoreTotal,
    };
  }

  // Turns
  async createTurn(insertTurn: InsertTurn): Promise<Turn> {
    const [turn] = await db
      .insert(turns)
      .values(insertTurn)
      .returning();
    return turn;
  }

  async getSessionTurns(sessionId: string): Promise<Turn[]> {
    return await db
      .select()
      .from(turns)
      .where(eq(turns.sessionId, sessionId))
      .orderBy(turns.createdAt);
  }

  async deleteSessionTurns(sessionId: string): Promise<void> {
    await db.delete(turns).where(eq(turns.sessionId, sessionId));
  }

  async updateTurnMeta(turnId: string, meta: any): Promise<Turn> {
    const [existingTurn] = await db.select().from(turns).where(eq(turns.id, turnId));
    const mergedMeta = { ...(existingTurn?.meta as object || {}), ...meta };
    const [updatedTurn] = await db
      .update(turns)
      .set({ meta: mergedMeta })
      .where(eq(turns.id, turnId))
      .returning();
    return updatedTurn;
  }

  async updateTurn(turnId: string, updates: Partial<Turn>): Promise<Turn> {
    const [updatedTurn] = await db
      .update(turns)
      .set(updates)
      .where(eq(turns.id, turnId))
      .returning();
    return updatedTurn;
  }

  // Commitment events (uses lockEvents table for backwards compatibility)
  async createLockEvent(insertLockEvent: InsertLockEvent): Promise<LockEvent> {
    const [lockEvent] = await db
      .insert(lockEvents)
      .values(insertLockEvent)
      .returning();
    return lockEvent;
  }

  async getSessionLocks(sessionId: string): Promise<LockEvent[]> {
    return await db
      .select()
      .from(lockEvents)
      .where(eq(lockEvents.sessionId, sessionId))
      .orderBy(desc(lockEvents.createdAt));
  }

  // Commitment event aliases (point to same underlying implementation)
  async createCommitmentEvent(event: InsertLockEvent): Promise<LockEvent> {
    return this.createLockEvent(event);
  }

  async getSessionCommitments(sessionId: string): Promise<LockEvent[]> {
    return this.getSessionLocks(sessionId);
  }

  // Technique sessions
  async createTechniqueSession(insertSession: InsertTechniqueSession): Promise<TechniqueSession> {
    // Server-side validation: prevent null technique_id from being inserted
    if (!insertSession.techniqueId) {
      throw new Error("technique_id is required and cannot be null");
    }
    const [session] = await db
      .insert(techniqueSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getTechniqueSession(userId: string, techniqueId: string): Promise<TechniqueSession | undefined> {
    const [session] = await db
      .select()
      .from(techniqueSessions)
      .where(
        and(
          eq(techniqueSessions.userId, userId),
          eq(techniqueSessions.techniqueId, techniqueId)
        )
      );
    return session || undefined;
  }

  async updateTechniqueSession(id: string, context: any): Promise<TechniqueSession> {
    const [session] = await db
      .update(techniqueSessions)
      .set({ 
        context,
        lastUsed: new Date()
      })
      .where(eq(techniqueSessions.id, id))
      .returning();
    return session;
  }

  async countUserTechniqueSessions(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(techniqueSessions)
      .where(eq(techniqueSessions.userId, userId));
    return result.length;
  }
  
  // Videos
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const [video] = await db
      .insert(videos)
      .values(insertVideo)
      .returning();
    return video;
  }
  
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }
  
  async getVideos(): Promise<Video[]> {
    return await db
      .select()
      .from(videos)
      .orderBy(videos.order, videos.createdAt);
  }
  
  async updateVideo(id: string, updates: Partial<Video>): Promise<Video> {
    const [video] = await db
      .update(videos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return video;
  }
  
  async getVideosByModule(module: string): Promise<Video[]> {
    return await db
      .select()
      .from(videos)
      .where(eq(videos.courseModule, module))
      .orderBy(videos.order, videos.createdAt);
  }
  
  async getVideosByTechniqueId(techniqueId: string): Promise<Video[]> {
    return await db
      .select()
      .from(videos)
      .where(eq(videos.techniqueId, techniqueId))
      .orderBy(videos.order, videos.createdAt);
  }
  
  // Video progress
  async createVideoProgress(insertProgress: InsertVideoProgress): Promise<VideoProgress> {
    const [progress] = await db
      .insert(videoProgress)
      .values(insertProgress)
      .returning();
    return progress;
  }
  
  async getVideoProgress(userId: string, videoId: string): Promise<VideoProgress | undefined> {
    const [progress] = await db
      .select()
      .from(videoProgress)
      .where(
        and(
          eq(videoProgress.userId, userId),
          eq(videoProgress.videoId, videoId)
        )
      );
    return progress || undefined;
  }
  
  async updateVideoProgress(id: string, updates: Partial<VideoProgress>): Promise<VideoProgress> {
    const [progress] = await db
      .update(videoProgress)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoProgress.id, id))
      .returning();
    return progress;
  }
  
  async getUserVideoProgress(userId: string): Promise<VideoProgress[]> {
    return await db
      .select()
      .from(videoProgress)
      .where(eq(videoProgress.userId, userId))
      .orderBy(desc(videoProgress.updatedAt));
  }
  
  // Live sessions
  async createLiveSession(insertSession: InsertLiveSession): Promise<LiveSession> {
    const [session] = await db
      .insert(liveSessions)
      .values(insertSession)
      .returning();
    return session;
  }
  
  async getLiveSession(id: string): Promise<LiveSession | undefined> {
    const [session] = await db.select().from(liveSessions).where(eq(liveSessions.id, id));
    return session || undefined;
  }
  
  async getLiveSessions(): Promise<LiveSession[]> {
    return await db.select().from(liveSessions).orderBy(desc(liveSessions.scheduledDate));
  }
  
  async getLiveSessionsByStatus(status: string): Promise<LiveSession[]> {
    return await db.select().from(liveSessions)
      .where(eq(liveSessions.status, status))
      .orderBy(liveSessions.scheduledDate);
  }
  
  async updateLiveSession(id: string, updates: Partial<LiveSession>): Promise<LiveSession> {
    const [session] = await db
      .update(liveSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(liveSessions.id, id))
      .returning();
    return session;
  }
  
  // Live chat
  async createChatMessage(insertMessage: InsertLiveChatMessage): Promise<LiveChatMessage> {
    const [message] = await db
      .insert(liveChatMessages)
      .values(insertMessage)
      .returning();
    return message;
  }
  
  async getSessionChatMessages(sessionId: string): Promise<LiveChatMessage[]> {
    return await db.select().from(liveChatMessages)
      .where(eq(liveChatMessages.sessionId, sessionId))
      .orderBy(liveChatMessages.createdAt);
  }
  
  // Live polls
  async createPoll(insertPoll: InsertLivePoll): Promise<LivePoll> {
    const [poll] = await db
      .insert(livePolls)
      .values(insertPoll)
      .returning();
    return poll;
  }
  
  async getPoll(id: string): Promise<LivePoll | undefined> {
    const [poll] = await db.select().from(livePolls).where(eq(livePolls.id, id));
    return poll || undefined;
  }
  
  async getSessionPolls(sessionId: string): Promise<LivePoll[]> {
    return await db.select().from(livePolls)
      .where(eq(livePolls.sessionId, sessionId))
      .orderBy(desc(livePolls.createdAt));
  }
  
  async updatePoll(id: string, updates: Partial<LivePoll>): Promise<LivePoll> {
    const [poll] = await db
      .update(livePolls)
      .set(updates)
      .where(eq(livePolls.id, id))
      .returning();
    return poll;
  }
  
  async createPollOption(insertOption: InsertLivePollOption): Promise<LivePollOption> {
    const [option] = await db
      .insert(livePollOptions)
      .values(insertOption)
      .returning();
    return option;
  }
  
  async getPollOptions(pollId: string): Promise<LivePollOption[]> {
    return await db.select().from(livePollOptions)
      .where(eq(livePollOptions.pollId, pollId));
  }
  
  async votePoll(pollId: string, optionId: string, userId: string): Promise<void> {
    await db.insert(livePollVotes).values({ pollId, optionId, userId });
    await db.update(livePollOptions)
      .set({ votes: sql`${livePollOptions.votes} + 1` })
      .where(eq(livePollOptions.id, optionId));
  }
  
  async getUserPollVote(pollId: string, userId: string): Promise<LivePollVote | undefined> {
    const [vote] = await db.select().from(livePollVotes)
      .where(and(eq(livePollVotes.pollId, pollId), eq(livePollVotes.userId, userId)));
    return vote || undefined;
  }
  
  // Attendees
  async joinLiveSession(sessionId: string, userId: string): Promise<void> {
    await db.insert(liveSessionAttendees).values({ sessionId, userId });
    await db.update(liveSessions)
      .set({ viewersCount: sql`${liveSessions.viewersCount} + 1` })
      .where(eq(liveSessions.id, sessionId));
  }
  
  async leaveLiveSession(sessionId: string, userId: string): Promise<void> {
    await db.update(liveSessionAttendees)
      .set({ leftAt: new Date() })
      .where(and(
        eq(liveSessionAttendees.sessionId, sessionId),
        eq(liveSessionAttendees.userId, userId)
      ));
    await db.update(liveSessions)
      .set({ viewersCount: sql`GREATEST(${liveSessions.viewersCount} - 1, 0)` })
      .where(eq(liveSessions.id, sessionId));
  }
  
  async setReminder(sessionId: string, userId: string): Promise<void> {
    const [existing] = await db.select().from(liveSessionAttendees)
      .where(and(
        eq(liveSessionAttendees.sessionId, sessionId),
        eq(liveSessionAttendees.userId, userId)
      ));
    
    if (existing) {
      await db.update(liveSessionAttendees)
        .set({ reminderSet: 1 })
        .where(eq(liveSessionAttendees.id, existing.id));
    } else {
      await db.insert(liveSessionAttendees).values({ 
        sessionId, 
        userId, 
        reminderSet: 1 
      });
    }
  }

  // =====================
  // USER ANALYTICS
  // =====================
  
  async getUserStats(userId: string): Promise<UserStats | undefined> {
    const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));
    return stats || undefined;
  }
  
  async createOrUpdateUserStats(userId: string, updates: Partial<InsertUserStats>): Promise<UserStats> {
    const existing = await this.getUserStats(userId);
    
    if (existing) {
      const updateData: any = { ...updates, updatedAt: new Date() };
      const [updated] = await db.update(userStats)
        .set(updateData)
        .where(eq(userStats.userId, userId))
        .returning();
      return updated;
    } else {
      const insertData: any = { userId, ...updates };
      const [created] = await db.insert(userStats)
        .values(insertData)
        .returning();
      return created;
    }
  }
  
  async incrementUserStats(userId: string, field: 'totalSessions' | 'totalTimeSeconds' | 'totalVideoTimeSeconds', amount: number): Promise<void> {
    const existing = await this.getUserStats(userId);
    
    if (existing) {
      const fieldMap = {
        totalSessions: userStats.totalSessions,
        totalTimeSeconds: userStats.totalTimeSeconds,
        totalVideoTimeSeconds: userStats.totalVideoTimeSeconds,
      };
      await db.update(userStats)
        .set({ 
          [field]: sql`${fieldMap[field]} + ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(userStats.userId, userId));
    } else {
      // Create new record with all required defaults explicitly
      const defaults: Partial<InsertUserStats> = {
        totalSessions: 0,
        totalTimeSeconds: 0,
        totalVideoTimeSeconds: 0,
        averageScore: 0,
        currentStreak: 0,
        longestStreak: 0,
        weeklySessionCounts: [],
      };
      await db.insert(userStats)
        .values({ userId, ...defaults, [field]: amount });
    }
  }
  
  // Update running average score for user after each session
  // Note: Call AFTER incrementUserStats('totalSessions') so totalSessions is already incremented
  async updateUserAverageScore(userId: string, sessionScore: number): Promise<void> {
    // Re-fetch to get the updated totalSessions count
    const existing = await this.getUserStats(userId);
    
    if (!existing) {
      // This shouldn't happen if incrementUserStats was called first, but handle it
      console.warn(`[storage] updateUserAverageScore called but no user_stats for ${userId}`);
      return;
    }
    
    // Calculate new weighted average: (oldAvg * (n-1) + newScore) / n
    // where n is totalSessions (which was already incremented)
    const n = existing.totalSessions;
    const newAverage = n > 0 
      ? Math.round(((existing.averageScore * (n - 1)) + sessionScore) / n)
      : sessionScore;
    
    await db.update(userStats)
      .set({ 
        averageScore: newAverage,
        updatedAt: new Date()
      })
      .where(eq(userStats.userId, userId));
  }
  
  async updateStreak(userId: string): Promise<UserStats> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const existing = await this.getUserStats(userId);
    
    if (!existing) {
      const [created] = await db.insert(userStats)
        .values({ userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today })
        .returning();
      return created;
    }
    
    const lastActive = existing.lastActiveDate;
    
    if (lastActive === today) {
      return existing;
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let newStreak = 1;
    if (lastActive === yesterdayStr) {
      newStreak = existing.currentStreak + 1;
    }
    
    const newLongest = Math.max(existing.longestStreak, newStreak);
    
    const [updated] = await db.update(userStats)
      .set({ 
        currentStreak: newStreak, 
        longestStreak: newLongest, 
        lastActiveDate: today,
        updatedAt: new Date()
      })
      .where(eq(userStats.userId, userId))
      .returning();
    
    return updated;
  }
  
  // =====================
  // TECHNIQUE MASTERY
  // =====================
  
  async getTechniqueMastery(userId: string, techniqueId: string): Promise<TechniqueMastery | undefined> {
    const [mastery] = await db.select().from(techniqueMastery)
      .where(and(
        eq(techniqueMastery.userId, userId),
        eq(techniqueMastery.techniqueId, techniqueId)
      ));
    return mastery || undefined;
  }
  
  async getUserTechniqueMasteries(userId: string): Promise<TechniqueMastery[]> {
    return db.select().from(techniqueMastery)
      .where(eq(techniqueMastery.userId, userId))
      .orderBy(desc(techniqueMastery.averageScore));
  }
  
  async recordTechniqueAttempt(userId: string, techniqueId: string, techniqueName: string, score: number, success: boolean): Promise<TechniqueMastery> {
    const existing = await this.getTechniqueMastery(userId, techniqueId);
    
    if (existing) {
      const newAttemptCount = existing.attemptCount + 1;
      const newSuccessCount = existing.successCount + (success ? 1 : 0);
      const newTotalScore = existing.totalScore + score;
      const newAverageScore = Math.round(newTotalScore / newAttemptCount);
      
      let masteryLevel = 'beginner';
      if (newAverageScore >= 90 && newAttemptCount >= 10) masteryLevel = 'master';
      else if (newAverageScore >= 75 && newAttemptCount >= 5) masteryLevel = 'advanced';
      else if (newAverageScore >= 50 && newAttemptCount >= 3) masteryLevel = 'intermediate';
      
      const [updated] = await db.update(techniqueMastery)
        .set({
          attemptCount: newAttemptCount,
          successCount: newSuccessCount,
          totalScore: newTotalScore,
          averageScore: newAverageScore,
          masteryLevel,
          lastPracticed: new Date(),
          updatedAt: new Date()
        })
        .where(eq(techniqueMastery.id, existing.id))
        .returning();
      
      return updated;
    } else {
      const [created] = await db.insert(techniqueMastery)
        .values({
          userId,
          techniqueId,
          techniqueName,
          attemptCount: 1,
          successCount: success ? 1 : 0,
          totalScore: score,
          averageScore: score,
          masteryLevel: 'beginner',
          lastPracticed: new Date()
        })
        .returning();
      
      return created;
    }
  }
  
  // =====================
  // ACTIVITY LOG
  // =====================
  
  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLog)
      .values(activity)
      .returning();
    return log;
  }
  
  async getUserActivityLog(userId: string, limit: number = 50): Promise<ActivityLog[]> {
    return db.select().from(activityLog)
      .where(eq(activityLog.userId, userId))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }
  
  async getUserSessionsThisWeek(userId: string): Promise<number> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .where(and(
        eq(activityLog.userId, userId),
        eq(activityLog.eventType, 'session_end'),
        sql`${activityLog.createdAt} >= ${weekAgo}`
      ));
    
    return result[0]?.count || 0;
  }
  
  async getUserSessionsByWeek(userId: string, weeks: number = 8): Promise<number[]> {
    const result: number[] = [];
    
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      
      const count = await db.select({ count: sql<number>`count(*)` })
        .from(activityLog)
        .where(and(
          eq(activityLog.userId, userId),
          eq(activityLog.eventType, 'session_end'),
          sql`${activityLog.createdAt} >= ${weekStart}`,
          sql`${activityLog.createdAt} < ${weekEnd}`
        ));
      
      result.push(count[0]?.count || 0);
    }
    
    return result.reverse();
  }
  
  // =====================
  // USER CONTEXT
  // =====================
  
  async getUserContext(userId: string): Promise<UserContext | undefined> {
    const [context] = await db.select().from(userContext).where(eq(userContext.userId, userId));
    return context || undefined;
  }
  
  async createOrUpdateUserContext(userId: string, context: Partial<InsertUserContext>): Promise<UserContext> {
    const existing = await this.getUserContext(userId);
    
    if (existing) {
      const [updated] = await db.update(userContext)
        .set({ ...context, updatedAt: new Date() })
        .where(eq(userContext.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userContext)
        .values({ userId, ...context })
        .returning();
      return created;
    }
  }
  
  // =====================
  // V2 SESSIONS
  // =====================
  
  async saveV2Session(session: InsertV2Session): Promise<V2Session> {
    const existing = await this.getV2Session(session.id);
    
    if (existing) {
      return this.updateV2Session(session.id, session);
    }
    
    const [created] = await db.insert(v2Sessions)
      .values(session as any) // Type cast needed due to Drizzle JSONB inference
      .returning();
    return created;
  }
  
  async getV2Session(sessionId: string): Promise<V2Session | undefined> {
    const [session] = await db.select()
      .from(v2Sessions)
      .where(eq(v2Sessions.id, sessionId));
    return session || undefined;
  }
  
  async updateV2Session(sessionId: string, updates: Partial<InsertV2Session>): Promise<V2Session> {
    const [updated] = await db.update(v2Sessions)
      .set({ ...updates, updatedAt: new Date() } as any) // Type cast for JSONB fields
      .where(eq(v2Sessions.id, sessionId))
      .returning();
    return updated;
  }
  
  async deleteV2Session(sessionId: string): Promise<void> {
    await db.delete(v2Sessions)
      .where(eq(v2Sessions.id, sessionId));
  }
  
  async getActiveV2Sessions(userId: string): Promise<V2Session[]> {
    return db.select()
      .from(v2Sessions)
      .where(and(
        eq(v2Sessions.userId, userId),
        eq(v2Sessions.isActive, 1)
      ))
      .orderBy(desc(v2Sessions.updatedAt));
  }
  
  async getRecentV2Sessions(userId: string, limitDays: number = 30): Promise<V2Session[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - limitDays);
    
    return db.select()
      .from(v2Sessions)
      .where(and(
        eq(v2Sessions.userId, userId),
        sql`${v2Sessions.updatedAt} >= ${cutoffDate}`
      ))
      .orderBy(desc(v2Sessions.updatedAt));
  }
  
  async endV2Session(sessionId: string): Promise<void> {
    await db.update(v2Sessions)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(v2Sessions.id, sessionId));
  }
}

export const storage = new DatabaseStorage();
