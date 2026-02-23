/**
 * Performance Tracker Service
 * 
 * Tracks user performance and automatically adjusts competence level (1-4)
 * Level system is invisible to users - adapts based on roleplay outcomes
 * 
 * Competence levels:
 * 1 = onbewuste_onkunde (full assistance)
 * 2 = bewuste_onkunde (guidance available)
 * 3 = bewuste_kunde (minimal hints)
 * 4 = onbewuste_kunde (blind play, no hints)
 */

import { db } from "../db";
import { userTrainingProfile, techniqueMastery, activityLog } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface PerformanceResult {
  techniqueId: string;
  techniqueName: string;
  score: number; // 0-100
  outcome: "success" | "partial" | "struggle";
  struggleSignals?: string[]; // e.g., ["te snel vertellen", "geen commitment"]
}

export interface LevelTransition {
  previousLevel: number;
  newLevel: number;
  reason: string;
  shouldCongratulate: boolean;
}

const LEVEL_NAMES = [
  "onbewuste_onkunde",
  "bewuste_onkunde", 
  "bewuste_kunde",
  "onbewuste_kunde"
];

const SUCCESS_THRESHOLD = 70; // Score >= 70 is considered success
const STREAK_TO_LEVEL_UP = 3; // 3 consecutive successes to level up
const FAILURES_TO_LEVEL_DOWN = 2; // 2 consecutive failures to level down

export class PerformanceTracker {
  
  /**
   * Get current competence level for user (1-4)
   */
  async getCurrentLevel(userId: string): Promise<number> {
    const profile = await this.getOrCreateProfile(userId);
    return profile.currentDifficulty;
  }

  /**
   * Get level name for display
   */
  getLevelName(level: number): string {
    return LEVEL_NAMES[level - 1] || "onbewuste_onkunde";
  }

  /**
   * Record roleplay performance and potentially adjust level
   */
  async recordPerformance(
    userId: string,
    result: PerformanceResult
  ): Promise<LevelTransition | null> {
    const profile = await this.getOrCreateProfile(userId);
    const previousLevel = profile.currentDifficulty;
    
    // Determine outcome from score
    const outcome = result.score >= SUCCESS_THRESHOLD ? "success" : 
                    result.score >= 50 ? "partial" : "struggle";
    
    // Update technique mastery
    await this.updateTechniqueMastery(userId, result);
    
    // Update streak and determine new level
    let newStreak = profile.successStreak;
    let newLevel = previousLevel;
    
    if (outcome === "success") {
      // Reset negative streak on success, then increment
      newStreak = newStreak < 0 ? 1 : newStreak + 1;
      
      // Check for level up: 3 consecutive successes
      if (newStreak >= STREAK_TO_LEVEL_UP && previousLevel < 4) {
        newLevel = previousLevel + 1;
        newStreak = 0; // Reset streak after level up
      }
    } else if (outcome === "struggle") {
      // Reset positive streak on failure, then decrement
      newStreak = newStreak > 0 ? -1 : newStreak - 1;
      
      // Check for level down: 2 consecutive failures (newStreak is now -2 after second failure)
      if (newStreak <= -FAILURES_TO_LEVEL_DOWN && previousLevel > 1) {
        newLevel = previousLevel - 1;
        newStreak = 0; // Reset streak after level down
      }
    } else {
      // Partial success - reset streak to 0 (neutral)
      newStreak = 0;
    }
    
    // Update struggle patterns if any
    const strugglePatterns = profile.strugglePatterns as Record<string, number> || {};
    if (result.struggleSignals) {
      for (const signal of result.struggleSignals) {
        strugglePatterns[signal] = (strugglePatterns[signal] || 0) + 1;
      }
    }
    
    // Save updated profile
    await db.update(userTrainingProfile)
      .set({
        currentDifficulty: newLevel,
        successStreak: newStreak,
        totalSessions: profile.totalSessions + 1,
        totalSuccesses: outcome === "success" ? profile.totalSuccesses + 1 : profile.totalSuccesses,
        strugglePatterns: strugglePatterns,
        updatedAt: new Date(),
      })
      .where(eq(userTrainingProfile.userId, userId));
    
    // Log activity
    await db.insert(activityLog).values({
      userId,
      eventType: "technique_attempt",
      entityType: "technique",
      entityId: result.techniqueId,
      score: result.score,
      metadata: {
        techniqueName: result.techniqueName,
        outcome,
        previousLevel,
        newLevel,
        struggleSignals: result.struggleSignals,
      },
    });
    
    // Return level transition if changed
    if (newLevel !== previousLevel) {
      return {
        previousLevel,
        newLevel,
        reason: newLevel > previousLevel 
          ? `Je hebt ${STREAK_TO_LEVEL_UP} rollenspellen achter elkaar goed gedaan!`
          : `Geen zorgen, we passen het niveau aan zodat je beter kunt oefenen.`,
        shouldCongratulate: newLevel > previousLevel,
      };
    }
    
    return null;
  }

  /**
   * Get assistance level for current user level
   * Returns what UI elements should be shown
   */
  getAssistanceConfig(level: number): AssistanceConfig {
    switch (level) {
      case 1: // onbewuste_onkunde - full help
        return {
          showHouding: true,
          showExpectedTechnique: true,
          showStepIndicators: true,
          showTipButton: true,
          showExamples: true,
          blindPlay: false,
        };
      case 2: // bewuste_onkunde - guidance
        return {
          showHouding: true,
          showExpectedTechnique: false, // Hide expected, only show after attempt
          showStepIndicators: true,
          showTipButton: true,
          showExamples: false,
          blindPlay: false,
        };
      case 3: // bewuste_kunde - minimal
        return {
          showHouding: false, // Only show after they ask
          showExpectedTechnique: false,
          showStepIndicators: false,
          showTipButton: true, // Available but not prominent
          showExamples: false,
          blindPlay: false,
        };
      case 4: // onbewuste_kunde - blind
        return {
          showHouding: false,
          showExpectedTechnique: false,
          showStepIndicators: false,
          showTipButton: false,
          showExamples: false,
          blindPlay: true, // No hints during play, only feedback after
        };
      default:
        return this.getAssistanceConfig(1);
    }
  }

  /**
   * Generate congratulation message for level up
   */
  getCongratulationMessage(transition: LevelTransition): string {
    const newLevelName = this.getLevelName(transition.newLevel);
    
    const messages: Record<number, string> = {
      2: `Geweldig! Je bent nu op niveau '${newLevelName}'. Je begint de technieken bewust te herkennen. Blijf zo doorgaan!`,
      3: `Fantastisch! Je hebt niveau '${newLevelName}' bereikt. De technieken worden steeds natuurlijker voor je. Je krijgt nu minder hulp, maar je kunt het aan!`,
      4: `Uitstekend! Je speelt nu op het hoogste niveau: '${newLevelName}'. De technieken zitten in je systeem - je past ze automatisch toe. Blijf oefenen om scherp te blijven!`,
    };
    
    return messages[transition.newLevel] || transition.reason;
  }

  /**
   * Get user's technique mastery summary
   */
  async getTechniqueMasterySummary(userId: string): Promise<TechniqueMasterySummary[]> {
    const mastery = await db.select()
      .from(techniqueMastery)
      .where(eq(techniqueMastery.userId, userId));
    
    return mastery.map(m => ({
      techniqueId: m.techniqueId,
      techniqueName: m.techniqueName || m.techniqueId,
      attemptCount: m.attemptCount,
      successRate: m.attemptCount > 0 
        ? Math.round((m.successCount / m.attemptCount) * 100)
        : 0,
      averageScore: m.averageScore,
      masteryLevel: m.masteryLevel as "beginner" | "intermediate" | "advanced" | "master",
      lastPracticed: m.lastPracticed,
    }));
  }

  private async getOrCreateProfile(userId: string) {
    const existing = await db.select()
      .from(userTrainingProfile)
      .where(eq(userTrainingProfile.userId, userId))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Create new profile
    const [newProfile] = await db.insert(userTrainingProfile)
      .values({
        userId,
        currentDifficulty: 1, // Start at level 1
        successStreak: 0,
        totalSessions: 0,
        totalSuccesses: 0,
        strugglePatterns: {},
        recentPersonas: [],
      })
      .returning();
    
    return newProfile;
  }

  private async updateTechniqueMastery(userId: string, result: PerformanceResult) {
    const existing = await db.select()
      .from(techniqueMastery)
      .where(
        and(
          eq(techniqueMastery.userId, userId),
          eq(techniqueMastery.techniqueId, result.techniqueId)
        )
      )
      .limit(1);
    
    const isSuccess = result.score >= SUCCESS_THRESHOLD;
    
    if (existing.length > 0) {
      const m = existing[0];
      const newAttempts = m.attemptCount + 1;
      const newSuccesses = m.successCount + (isSuccess ? 1 : 0);
      const newTotalScore = m.totalScore + result.score;
      const newAverage = Math.round(newTotalScore / newAttempts);
      
      // Determine mastery level
      const masteryLevel = this.calculateMasteryLevel(newSuccesses, newAttempts, newAverage);
      
      await db.update(techniqueMastery)
        .set({
          attemptCount: newAttempts,
          successCount: newSuccesses,
          totalScore: newTotalScore,
          averageScore: newAverage,
          masteryLevel,
          lastPracticed: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(techniqueMastery.id, m.id));
    } else {
      await db.insert(techniqueMastery).values({
        userId,
        techniqueId: result.techniqueId,
        techniqueName: result.techniqueName,
        attemptCount: 1,
        successCount: isSuccess ? 1 : 0,
        totalScore: result.score,
        averageScore: result.score,
        masteryLevel: "beginner",
        lastPracticed: new Date(),
      });
    }
  }

  private calculateMasteryLevel(
    successCount: number,
    attemptCount: number,
    averageScore: number
  ): "beginner" | "intermediate" | "advanced" | "master" {
    if (attemptCount < 3) return "beginner";
    
    const successRate = successCount / attemptCount;
    
    if (successRate >= 0.9 && averageScore >= 85 && attemptCount >= 5) {
      return "master";
    }
    if (successRate >= 0.75 && averageScore >= 70) {
      return "advanced";
    }
    if (successRate >= 0.5 && averageScore >= 50) {
      return "intermediate";
    }
    return "beginner";
  }
}

export interface AssistanceConfig {
  showHouding: boolean;
  showExpectedTechnique: boolean;
  showStepIndicators: boolean;
  showTipButton: boolean;
  showExamples: boolean;
  blindPlay: boolean;
}

export interface TechniqueMasterySummary {
  techniqueId: string;
  techniqueName: string;
  attemptCount: number;
  successRate: number;
  averageScore: number;
  masteryLevel: "beginner" | "intermediate" | "advanced" | "master";
  lastPracticed: Date | null;
}

// Export singleton instance
export const performanceTracker = new PerformanceTracker();
