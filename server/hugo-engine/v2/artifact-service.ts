/**
 * artifact-service.ts - V3.1 Artifact Storage Service
 * 
 * Stores and retrieves session artifacts (briefs and snapshots)
 * that enable cross-phase continuity in roleplay.
 * 
 * Artifact Types:
 * - scenario_snapshot: Captured persona + context for phase continuity
 * - discovery_brief: Summary of what was discovered in phase 2 (Explore)
 * - offer_brief: Summary of the offer presented in phase 3 (Recommend)
 */

import { db } from '../db';
import { sessionArtifacts, type InsertSessionArtifact, type SessionArtifact } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { ArtifactType as OrchestratorArtifactType, EpicPhase } from './orchestrator';

export type ArtifactType = OrchestratorArtifactType;

// ============================================================================
// TYPES
// ============================================================================

export interface ScenarioSnapshot {
  persona: {
    naam: string;
    bedrijf: string;
    functie: string;
    gedragsstijl: string;
  };
  context: {
    sector: string;
    product: string;
    klantType: string;
    situation?: string;
  };
  attitudes: string[];
  capturedAt: string;
}

export interface DiscoveryBrief {
  klantSituatie: string;
  hoofdBehoeften: string[];
  pijnpunten: string[];
  verwachtingen: string[];
  budget?: string;
  timing?: string;
  beslissers?: string[];
  keyQuotes: string[];
  generatedAt: string;
}

export interface OfferBrief {
  gepresenteerdeOplossing: string;
  gekoppeldeVoordelen: string[];
  gekoppeldeBaten: string[];
  klantReacties: string[];
  openBezwaren: string[];
  commitmentSignalen: string[];
  generatedAt: string;
}

export type ArtifactContent = ScenarioSnapshot | DiscoveryBrief | OfferBrief | Record<string, unknown>;

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Save an artifact for a session
 */
export async function saveArtifact(
  sessionId: string,
  userId: string,
  artifactType: ArtifactType,
  techniqueId: string,
  content: ArtifactContent,
  epicPhase?: EpicPhase
): Promise<SessionArtifact> {
  const [artifact] = await db
    .insert(sessionArtifacts)
    .values({
      sessionId,
      userId,
      artifactType,
      techniqueId,
      content,
      epicPhase,
    })
    .returning();
  
  console.log(`[Artifact] Saved ${artifactType} for session ${sessionId}`);
  return artifact;
}

/**
 * Get an artifact by type for a session
 */
export async function getArtifact(
  sessionId: string,
  artifactType: ArtifactType
): Promise<SessionArtifact | null> {
  const [artifact] = await db
    .select()
    .from(sessionArtifacts)
    .where(
      and(
        eq(sessionArtifacts.sessionId, sessionId),
        eq(sessionArtifacts.artifactType, artifactType)
      )
    )
    .orderBy(desc(sessionArtifacts.createdAt))
    .limit(1);
  
  return artifact || null;
}

/**
 * Get all artifacts for a session
 */
export async function getSessionArtifacts(
  sessionId: string
): Promise<SessionArtifact[]> {
  return await db
    .select()
    .from(sessionArtifacts)
    .where(eq(sessionArtifacts.sessionId, sessionId))
    .orderBy(desc(sessionArtifacts.createdAt));
}

/**
 * Get latest artifacts for a user (across all sessions)
 * Useful for resuming with previous context
 */
export async function getUserLatestArtifacts(
  userId: string,
  artifactType?: ArtifactType
): Promise<SessionArtifact[]> {
  if (artifactType) {
    return await db
      .select()
      .from(sessionArtifacts)
      .where(
        and(
          eq(sessionArtifacts.userId, userId),
          eq(sessionArtifacts.artifactType, artifactType)
        )
      )
      .orderBy(desc(sessionArtifacts.createdAt))
      .limit(5);
  }
  
  return await db
    .select()
    .from(sessionArtifacts)
    .where(eq(sessionArtifacts.userId, userId))
    .orderBy(desc(sessionArtifacts.createdAt))
    .limit(10);
}

/**
 * Check if required artifacts exist for a session
 */
export async function hasRequiredArtifacts(
  sessionId: string,
  requiredArtifacts: ArtifactType[]
): Promise<{ complete: boolean; missing: ArtifactType[] }> {
  const artifacts = await getSessionArtifacts(sessionId);
  const presentTypes = artifacts.map(a => a.artifactType as ArtifactType);
  
  const missing = requiredArtifacts.filter(type => !presentTypes.includes(type));
  
  return {
    complete: missing.length === 0,
    missing
  };
}

/**
 * Get artifacts as a map for gate checking
 */
export async function getArtifactsMap(
  sessionId: string
): Promise<Record<string, ArtifactContent>> {
  const artifacts = await getSessionArtifacts(sessionId);
  const map: Record<string, ArtifactContent> = {};
  
  for (const artifact of artifacts) {
    map[artifact.artifactType] = artifact.content as ArtifactContent;
  }
  
  return map;
}

// ============================================================================
// ARTIFACT GENERATION HELPERS
// ============================================================================

/**
 * Create a scenario snapshot from session state
 */
export function createScenarioSnapshot(
  persona: { naam: string; bedrijf: string; functie: string; gedragsstijl: string },
  context: { sector: string; product: string; klantType: string; situation?: string },
  attitudes: string[]
): ScenarioSnapshot {
  return {
    persona,
    context,
    attitudes,
    capturedAt: new Date().toISOString()
  };
}

/**
 * Create a discovery brief structure (content to be filled by AI)
 */
export function createEmptyDiscoveryBrief(): DiscoveryBrief {
  return {
    klantSituatie: '',
    hoofdBehoeften: [],
    pijnpunten: [],
    verwachtingen: [],
    keyQuotes: [],
    generatedAt: new Date().toISOString()
  };
}

/**
 * Create an offer brief structure (content to be filled by AI)
 */
export function createEmptyOfferBrief(): OfferBrief {
  return {
    gepresenteerdeOplossing: '',
    gekoppeldeVoordelen: [],
    gekoppeldeBaten: [],
    klantReacties: [],
    openBezwaren: [],
    commitmentSignalen: [],
    generatedAt: new Date().toISOString()
  };
}
