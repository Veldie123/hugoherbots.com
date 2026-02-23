/**
 * Persona Engine - Hidden session dimension for ROLEPLAY customer selection
 * 
 * Generates customer profiles based on 4 independent axes:
 * 1. behavior_style: how the customer communicates
 * 2. buying_clock: where in the decision process
 * 3. experience_level: familiarity with similar purchases
 * 4. difficulty: how challenging the roleplay is
 * 
 * All selection is server-side and opaque to the user.
 */

import { db } from "./db";
import { userTrainingProfile, personaHistory, CustomerProfile } from "@shared/schema";
import { eq } from "drizzle-orm";

// Valid values for each axis
const BEHAVIOR_STYLES = ["controlerend", "faciliterend", "analyserend", "promoverend"] as const;
const BUYING_CLOCKS = ["00-06", "06-08", "08-11", "11-12"] as const;
const EXPERIENCE_LEVELS = [0, 1] as const;
const DIFFICULTY_LEVELS = [1, 2, 3, 4] as const;

// Cooldown settings
const COOLDOWN_HISTORY_SIZE = 3; // Don't repeat same persona in last N sessions
const SUCCESS_THRESHOLD_FOR_DIFFICULTY_INCREASE = 3; // Need X consecutive successes to increase difficulty

// Map persona_templates.json values to our compact format
const BEHAVIOR_STYLE_MAP: Record<string, CustomerProfile["behavior_style"]> = {
  "controlerend": "controlerend",
  "faciliterend": "faciliterend",
  "analyserend": "analyserend",
  "promoverend": "promoverend"
};

const BUYING_CLOCK_MAP: Record<string, CustomerProfile["buying_clock"]> = {
  "situation_as_is": "00-06",
  "field_of_tension": "06-08",
  "market_research": "08-11",
  "hesitation": "11-12",
  "decision": "11-12" // Map decision to same as hesitation (late stage)
};

const EXPERIENCE_MAP: Record<string, 0 | 1> = {
  "geen_ervaring": 0,
  "enige_ervaring": 1,
  "veel_ervaring": 1
};

const DIFFICULTY_MAP: Record<string, 1 | 2 | 3 | 4> = {
  "onbewuste_onkunde": 1,
  "bewuste_onkunde": 2,
  "bewuste_kunde": 3,
  "onbewuste_kunde": 4
};

/**
 * Generate a unique hash for a persona combination (for cooldown tracking)
 */
function personaHash(profile: CustomerProfile): string {
  return `${profile.behavior_style}-${profile.buying_clock}-${profile.experience_level}-${profile.difficulty}`;
}

/**
 * Validate that a customer profile has valid values
 */
export function validateCustomerProfile(profile: any): profile is CustomerProfile {
  if (!profile || typeof profile !== "object") return false;
  
  if (!BEHAVIOR_STYLES.includes(profile.behavior_style)) return false;
  if (!BUYING_CLOCKS.includes(profile.buying_clock)) return false;
  if (!EXPERIENCE_LEVELS.includes(profile.experience_level)) return false;
  if (!DIFFICULTY_LEVELS.includes(profile.difficulty)) return false;
  
  return true;
}

/**
 * Get or create user training profile
 */
async function getOrCreateTrainingProfile(userId: string) {
  const existing = await db.select().from(userTrainingProfile).where(eq(userTrainingProfile.userId, userId)).limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Create new profile with defaults
  const [newProfile] = await db.insert(userTrainingProfile).values({
    userId,
    currentDifficulty: 1,
    successStreak: 0,
    totalSessions: 0,
    totalSuccesses: 0,
    strugglePatterns: {},
    recentPersonas: []
  }).returning();
  
  return newProfile;
}

/**
 * Check if a persona is on cooldown (used too recently)
 */
function isOnCooldown(profile: CustomerProfile, recentPersonas: string[]): boolean {
  const hash = personaHash(profile);
  return recentPersonas.slice(0, COOLDOWN_HISTORY_SIZE).includes(hash);
}

/**
 * Random selection from array
 */
function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a new customer profile with smart randomization
 * 
 * Rules:
 * - Difficulty is based on user's current level (can only go up after X successes)
 * - Behavior style is random but respects cooldown
 * - Buying clock is random
 * - Experience is random but weighted based on difficulty
 */
export async function generateCustomerProfile(userId: string): Promise<CustomerProfile> {
  const trainingProfile = await getOrCreateTrainingProfile(userId);
  const recentPersonas = (trainingProfile.recentPersonas || []) as string[];
  
  // Difficulty comes from user's progression
  const difficulty = trainingProfile.currentDifficulty as 1 | 2 | 3 | 4;
  
  // Experience is weighted: lower difficulty = more likely novice
  const experienceWeight = difficulty <= 2 ? 0.3 : 0.6;
  const experience: 0 | 1 = Math.random() < experienceWeight ? 1 : 0;
  
  // Generate candidates and pick one not on cooldown
  let attempts = 0;
  let profile: CustomerProfile;
  
  do {
    profile = {
      behavior_style: randomFrom(BEHAVIOR_STYLES),
      buying_clock: randomFrom(BUYING_CLOCKS),
      experience_level: experience,
      difficulty
    };
    attempts++;
  } while (isOnCooldown(profile, recentPersonas) && attempts < 20);
  
  return profile;
}

/**
 * Record that a session started with this persona
 */
export async function recordPersonaStart(
  userId: string, 
  sessionId: string, 
  profile: CustomerProfile,
  techniqueId?: string
): Promise<void> {
  // Add to persona history
  await db.insert(personaHistory).values({
    userId,
    sessionId,
    customerProfile: profile,
    techniqueId,
    outcome: null,
    successSignals: 0,
    struggleSignals: []
  });
  
  // Update recent personas for cooldown
  const trainingProfile = await getOrCreateTrainingProfile(userId);
  const recentPersonas = (trainingProfile.recentPersonas || []) as string[];
  const hash = personaHash(profile);
  
  // Add to front, keep only last N
  const updatedRecent = [hash, ...recentPersonas].slice(0, COOLDOWN_HISTORY_SIZE + 2);
  
  await db.update(userTrainingProfile)
    .set({
      recentPersonas: updatedRecent,
      totalSessions: trainingProfile.totalSessions + 1,
      updatedAt: new Date()
    })
    .where(eq(userTrainingProfile.userId, userId));
}

/**
 * Record session outcome and update progression
 */
export async function recordSessionOutcome(
  userId: string,
  sessionId: string,
  outcome: "success" | "partial" | "struggle",
  struggleSignals: string[] = []
): Promise<void> {
  // Update persona history
  await db.update(personaHistory)
    .set({
      outcome,
      struggleSignals
    })
    .where(eq(personaHistory.sessionId, sessionId));
  
  // Get current training profile
  const trainingProfile = await getOrCreateTrainingProfile(userId);
  
  // Calculate new values based on outcome
  let newSuccessStreak = trainingProfile.successStreak;
  let newDifficulty = trainingProfile.currentDifficulty;
  let newTotalSuccesses = trainingProfile.totalSuccesses;
  
  if (outcome === "success") {
    newSuccessStreak++;
    newTotalSuccesses++;
    
    // Check if difficulty should increase
    if (newSuccessStreak >= SUCCESS_THRESHOLD_FOR_DIFFICULTY_INCREASE && newDifficulty < 4) {
      newDifficulty++;
      newSuccessStreak = 0; // Reset streak after difficulty increase
    }
  } else if (outcome === "struggle") {
    newSuccessStreak = 0; // Reset streak on struggle
    
    // Optionally decrease difficulty if really struggling
    // (not implemented yet - could add after more data)
  } else {
    // Partial success doesn't break streak but doesn't count toward increase
    newSuccessStreak = Math.max(0, newSuccessStreak - 1);
  }
  
  // Update struggle patterns
  const strugglePatterns = (trainingProfile.strugglePatterns || {}) as Record<string, number>;
  for (const signal of struggleSignals) {
    strugglePatterns[signal] = (strugglePatterns[signal] || 0) + 1;
  }
  
  // Persist updates
  await db.update(userTrainingProfile)
    .set({
      successStreak: newSuccessStreak,
      currentDifficulty: newDifficulty,
      totalSuccesses: newTotalSuccesses,
      strugglePatterns,
      updatedAt: new Date()
    })
    .where(eq(userTrainingProfile.userId, userId));
}

/**
 * Get difficulty modulators based on difficulty level
 * These are abstract rules, not scripts
 */
export function getDifficultyModulators(difficulty: 1 | 2 | 3 | 4): {
  spontaneousContext: "veel" | "matig" | "weinig" | "minimaal";
  resistanceSpeed: "langzaam" | "normaal" | "snel" | "direct";
  objectionExplicitness: "zeer expliciet" | "expliciet" | "impliciet" | "verborgen";
  decisionStyle: "open" | "diplomatiek" | "terughoudend" | "strategisch";
} {
  switch (difficulty) {
    case 1:
      return {
        spontaneousContext: "veel",
        resistanceSpeed: "langzaam",
        objectionExplicitness: "zeer expliciet",
        decisionStyle: "open"
      };
    case 2:
      return {
        spontaneousContext: "matig",
        resistanceSpeed: "normaal",
        objectionExplicitness: "expliciet",
        decisionStyle: "diplomatiek"
      };
    case 3:
      return {
        spontaneousContext: "weinig",
        resistanceSpeed: "snel",
        objectionExplicitness: "impliciet",
        decisionStyle: "terughoudend"
      };
    case 4:
      return {
        spontaneousContext: "minimaal",
        resistanceSpeed: "direct",
        objectionExplicitness: "verborgen",
        decisionStyle: "strategisch"
      };
  }
}

/**
 * Get user's current training stats (for internal use / analytics)
 */
export async function getUserTrainingStats(userId: string) {
  const profile = await getOrCreateTrainingProfile(userId);
  
  return {
    currentDifficulty: profile.currentDifficulty,
    successStreak: profile.successStreak,
    totalSessions: profile.totalSessions,
    totalSuccesses: profile.totalSuccesses,
    successRate: profile.totalSessions > 0 
      ? Math.round((profile.totalSuccesses / profile.totalSessions) * 100) 
      : 0,
    topStruggleAreas: Object.entries(profile.strugglePatterns as Record<string, number>)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([signal]) => signal)
  };
}

/**
 * Map from persona_templates.json format to CustomerProfile format
 */
export function mapToCustomerProfile(
  behaviorStyle?: string,
  buyingClock?: string,
  experienceLevel?: string,
  difficultyLevel?: string
): CustomerProfile {
  return {
    behavior_style: BEHAVIOR_STYLE_MAP[behaviorStyle || "analyserend"] || "analyserend",
    buying_clock: BUYING_CLOCK_MAP[buyingClock || "market_research"] || "08-11",
    experience_level: EXPERIENCE_MAP[experienceLevel || "enige_ervaring"] ?? 1,
    difficulty: DIFFICULTY_MAP[difficultyLevel || "bewuste_kunde"] || 3
  };
}
