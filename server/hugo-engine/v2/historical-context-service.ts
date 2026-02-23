/**
 * historical-context-service.ts - Retrieves historical data for coaching context
 * 
 * SSOT COMPLIANT: Returns structured data only. All Dutch text comes from config files.
 * 
 * Provides Hugo with historical context from:
 * - Previous V2 sessions (context, feedback, conversation)
 * - Technique mastery scores
 * - Struggle patterns from training profile
 * 
 * This enables personalized coaching:
 * - "Je scoorde vorige keer 6/10 op Impactvragen"
 * - "Vorige keer had je moeite met commitment vragen"
 * - "Hoe ging het in de praktijk sinds ons laatste gesprek?"
 */

import { v2Sessions, techniqueMastery, userTrainingProfile } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';

export interface HistoricalSession {
  sessionId: string;
  techniqueId: string;
  techniqueName?: string;
  createdAt: Date;
  totalScore: number;
  turnNumber: number;
  context: Record<string, string>;
  events?: any[];
}

export interface TechniqueMasteryData {
  techniqueId: string;
  techniqueName?: string;
  attemptCount: number;
  successCount: number;
  averageScore: number;
  masteryLevel: string;
  lastPracticed?: Date;
  progression?: {
    firstScore: number;
    lastScore: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

export interface StrugglePattern {
  pattern: string;
  count: number;
}

export interface HistoricalContext {
  previousSessions: HistoricalSession[];
  techniqueMastery: TechniqueMasteryData | null;
  strugglePatterns: StrugglePattern[];
  totalSessionsWithTechnique: number;
  overallStats: {
    totalSessions: number;
    averageScore: number;
    currentStreak: number;
  };
  lastSessionDaysAgo: number | null;
}

/**
 * Get all historical context for a user and technique
 * Returns structured data only - no Dutch text (comes from config)
 */
export async function getHistoricalContext(
  userId: string,
  techniqueId: string,
  limit: number = 5
): Promise<HistoricalContext> {
  const [previousSessions, mastery, profile] = await Promise.all([
    getPreviousSessions(userId, techniqueId, limit),
    getTechniqueMasteryData(userId, techniqueId),
    getUserStrugglePatterns(userId)
  ]);

  const totalSessionsWithTechnique = await countSessionsForTechnique(userId, techniqueId);
  
  let lastSessionDaysAgo: number | null = null;
  if (previousSessions.length > 0) {
    const lastSession = previousSessions[0];
    const daysDiff = Math.floor((Date.now() - lastSession.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    lastSessionDaysAgo = daysDiff;
  }

  return {
    previousSessions,
    techniqueMastery: mastery,
    strugglePatterns: profile.strugglePatterns,
    totalSessionsWithTechnique,
    overallStats: {
      totalSessions: profile.totalSessions,
      averageScore: profile.averageScore,
      currentStreak: profile.currentStreak
    },
    lastSessionDaysAgo
  };
}

/**
 * Get previous V2 sessions for a user and technique
 */
async function getPreviousSessions(
  userId: string,
  techniqueId: string,
  limit: number
): Promise<HistoricalSession[]> {
  try {
    const sessions = await db
      .select()
      .from(v2Sessions)
      .where(
        and(
          eq(v2Sessions.userId, userId),
          eq(v2Sessions.techniqueId, techniqueId),
          eq(v2Sessions.isActive, 0) // Only completed sessions
        )
      )
      .orderBy(desc(v2Sessions.createdAt))
      .limit(limit);

    return sessions.map(s => ({
      sessionId: s.id,
      techniqueId: s.techniqueId,
      createdAt: s.createdAt,
      totalScore: s.totalScore,
      turnNumber: s.turnNumber,
      context: (s.context as Record<string, any>)?.gathered || {},
      events: s.events as any[]
    }));
  } catch (error) {
    console.error('[historical-context] Error fetching previous sessions:', error);
    return [];
  }
}

/**
 * Get technique mastery data for a user
 */
async function getTechniqueMasteryData(
  userId: string,
  techniqueId: string
): Promise<TechniqueMasteryData | null> {
  try {
    const masteryRecords = await db
      .select()
      .from(techniqueMastery)
      .where(
        and(
          eq(techniqueMastery.userId, userId),
          eq(techniqueMastery.techniqueId, techniqueId)
        )
      )
      .limit(1);

    if (masteryRecords.length === 0) return null;

    const m = masteryRecords[0];
    
    // Calculate progression from previous sessions
    const sessions = await getPreviousSessions(userId, techniqueId, 10);
    let progression: TechniqueMasteryData['progression'] | undefined;
    
    if (sessions.length >= 2) {
      const scores = sessions.map(s => s.totalScore).reverse(); // Oldest first
      const firstScore = scores[0];
      const lastScore = scores[scores.length - 1];
      const trend = lastScore > firstScore + 5 ? 'improving' : 
                    lastScore < firstScore - 5 ? 'declining' : 'stable';
      progression = { firstScore, lastScore, trend };
    }

    return {
      techniqueId: m.techniqueId,
      techniqueName: m.techniqueName || undefined,
      attemptCount: m.attemptCount,
      successCount: m.successCount,
      averageScore: m.averageScore,
      masteryLevel: m.masteryLevel,
      lastPracticed: m.lastPracticed || undefined,
      progression
    };
  } catch (error) {
    console.error('[historical-context] Error fetching technique mastery:', error);
    return null;
  }
}

/**
 * Get user struggle patterns from training profile
 */
async function getUserStrugglePatterns(userId: string): Promise<{
  strugglePatterns: StrugglePattern[];
  totalSessions: number;
  averageScore: number;
  currentStreak: number;
}> {
  try {
    const profiles = await db
      .select()
      .from(userTrainingProfile)
      .where(eq(userTrainingProfile.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { strugglePatterns: [], totalSessions: 0, averageScore: 0, currentStreak: 0 };
    }

    const profile = profiles[0];
    const patterns = profile.strugglePatterns as Record<string, number> || {};
    
    const strugglePatterns: StrugglePattern[] = Object.entries(patterns)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 struggle patterns

    return {
      strugglePatterns,
      totalSessions: profile.totalSessions,
      averageScore: 0, // Not stored in training profile, would need to calculate
      currentStreak: profile.successStreak
    };
  } catch (error) {
    console.error('[historical-context] Error fetching user training profile:', error);
    return { strugglePatterns: [], totalSessions: 0, averageScore: 0, currentStreak: 0 };
  }
}

/**
 * Count total sessions for a technique
 */
async function countSessionsForTechnique(userId: string, techniqueId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(v2Sessions)
      .where(
        and(
          eq(v2Sessions.userId, userId),
          eq(v2Sessions.techniqueId, techniqueId)
        )
      );
    return result[0]?.count || 0;
  } catch (error) {
    console.error('[historical-context] Error counting sessions:', error);
    return 0;
  }
}

/**
 * Format historical context for validator - 3 lagen context
 * Used to give the validator facts about this seller's history
 */
export interface ValidatorContext {
  thisConversation: string | null;
  recentHistory: string | null;
  patterns: string | null;
}

export async function formatValidatorContext(
  userId: string,
  techniqueId: string,
  currentConversation?: Array<{ role: string; content: string }>
): Promise<ValidatorContext> {
  const history = await getHistoricalContext(userId, techniqueId, 5);
  
  // Layer 1: This conversation
  let thisConversation: string | null = null;
  if (currentConversation && currentConversation.length > 0) {
    const lastMessages = currentConversation.slice(-4);
    thisConversation = lastMessages
      .map(m => `${m.role === 'user' ? 'Verkoper' : 'Hugo'}: ${m.content}`)
      .join('\n');
  }
  
  // Layer 2: Recent history (last 3-5 sessions with this technique)
  let recentHistory: string | null = null;
  if (history.previousSessions.length > 0) {
    const recentSummaries = history.previousSessions.slice(0, 3).map(s => {
      const daysAgo = Math.floor((Date.now() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return `- ${daysAgo} dagen geleden: score ${s.totalScore}/10`;
    });
    recentHistory = `Laatste ${recentSummaries.length} sessies met deze techniek:\n${recentSummaries.join('\n')}`;
  }
  
  // Layer 3: Patterns (mastery, struggle areas)
  let patterns: string | null = null;
  const patternParts: string[] = [];
  
  if (history.techniqueMastery) {
    const m = history.techniqueMastery;
    patternParts.push(`Mastery: ${m.masteryLevel} (${m.averageScore.toFixed(1)}/10 gemiddeld, ${m.attemptCount} pogingen)`);
    
    if (m.progression) {
      const trendNL = m.progression.trend === 'improving' ? 'stijgend' : 
                      m.progression.trend === 'declining' ? 'dalend' : 'stabiel';
      patternParts.push(`Trend: ${trendNL} (van ${m.progression.firstScore} naar ${m.progression.lastScore})`);
    }
  }
  
  if (history.strugglePatterns.length > 0) {
    const struggles = history.strugglePatterns.slice(0, 3)
      .map(p => p.pattern)
      .join(', ');
    patternParts.push(`Moeite met: ${struggles}`);
  }
  
  if (patternParts.length > 0) {
    patterns = patternParts.join('\n');
  }
  
  return {
    thisConversation,
    recentHistory,
    patterns
  };
}

/**
 * Build a full context string for validator/repair
 * Combines all 3 layers into one string
 */
export function buildValidatorContextString(context: ValidatorContext): string {
  const sections: string[] = [];
  
  if (context.thisConversation) {
    sections.push(`=== DIT GESPREK ===\n${context.thisConversation}`);
  }
  
  if (context.recentHistory) {
    sections.push(`=== RECENTE HISTORIE ===\n${context.recentHistory}`);
  }
  
  if (context.patterns) {
    sections.push(`=== PATRONEN ===\n${context.patterns}`);
  }
  
  return sections.length > 0 ? sections.join('\n\n') : '';
}
