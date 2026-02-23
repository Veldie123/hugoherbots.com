/**
 * technique-sequence.ts - Technique sequence enforcement
 * 
 * DESIGN PRINCIPLES:
 * - Users must complete techniques in order (can't skip ahead)
 * - Expert mode can jump to any technique but gathers context gradually (max 3 slots/session)
 * - Sequence is determined by technique numbering: 0.1 < 0.2 < ... < 1.1 < 1.2 < ... < 2.1 < 2.1.1 ...
 */

import { storage } from '../storage';
import { getAllTechniqueNummers, getTechnique, loadMergedTechniques } from '../ssot-loader';

/**
 * Check if a technique is trainable (not a phase header)
 * Phase headers have is_fase: true and are containers, not actual trainable techniques
 */
function isTrainableTechnique(techniqueId: string): boolean {
  const technique = getTechnique(techniqueId);
  if (!technique) return false;
  
  // Phase headers (is_fase: true) are not trainable - they're just containers
  if (technique.is_fase === true) return false;
  
  return true;
}

/**
 * Get all TRAINABLE techniques in sequential order
 * Excludes phase headers (is_fase: true) as they're not actual trainable techniques
 * Sorting: 0.1 < 0.2 < 0.3 < 0.4 < 1.1 < 1.2 < 1.3 < 1.4 < 2.1 < 2.1.1 < 2.1.2 ...
 */
export function getOrderedTechniqueIds(): string[] {
  const ids = getAllTechniqueNummers();
  
  // Filter out phase headers (is_fase: true) - they're not trainable
  const trainableIds = ids.filter(isTrainableTechnique);
  
  return trainableIds.sort((a, b) => {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    const maxLen = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLen; i++) {
      const valA = partsA[i] ?? -1; // Parent comes before children
      const valB = partsB[i] ?? -1;
      if (valA !== valB) return valA - valB;
    }
    return 0;
  });
}

/**
 * Get the index of a technique in the ordered sequence
 * Returns -1 if not found
 */
export function getTechniqueIndex(techniqueId: string): number {
  const ordered = getOrderedTechniqueIds();
  return ordered.indexOf(techniqueId);
}

/**
 * Get all techniques that come before the given technique
 */
export function getPredecessorTechniques(techniqueId: string): string[] {
  const ordered = getOrderedTechniqueIds();
  const index = ordered.indexOf(techniqueId);
  if (index <= 0) return [];
  return ordered.slice(0, index);
}

/**
 * Get the next technique in the sequence
 */
export function getNextTechnique(techniqueId: string): string | null {
  const ordered = getOrderedTechniqueIds();
  const index = ordered.indexOf(techniqueId);
  if (index === -1 || index >= ordered.length - 1) return null;
  return ordered[index + 1];
}

/**
 * Check if user has completed a technique
 * A technique is "completed" if it has at least one mastery record with attemptCount > 0
 */
export async function hasCompletedTechnique(userId: string, techniqueId: string): Promise<boolean> {
  const mastery = await storage.getTechniqueMastery(userId, techniqueId);
  return mastery !== undefined && mastery !== null && mastery.attemptCount > 0;
}

/**
 * Check if user has completed all predecessor techniques
 * Returns: { canAccess: boolean, missingTechniques: string[], nextInSequence: string | null }
 */
export async function canAccessTechnique(userId: string, techniqueId: string): Promise<{
  canAccess: boolean;
  missingTechniques: string[];
  nextInSequence: string | null;
}> {
  const predecessors = getPredecessorTechniques(techniqueId);
  const missingTechniques: string[] = [];
  
  for (const predId of predecessors) {
    const completed = await hasCompletedTechnique(userId, predId);
    if (!completed) {
      missingTechniques.push(predId);
    }
  }
  
  // Find the first incomplete technique (the one they should do next)
  const ordered = getOrderedTechniqueIds();
  let nextInSequence: string | null = null;
  for (const techId of ordered) {
    const completed = await hasCompletedTechnique(userId, techId);
    if (!completed) {
      nextInSequence = techId;
      break;
    }
  }
  
  return {
    canAccess: missingTechniques.length === 0,
    missingTechniques,
    nextInSequence
  };
}

/**
 * Get user's technique progress summary
 * Returns: { completedCount: number, totalCount: number, completedTechniques: string[], nextTechnique: string | null }
 */
export async function getUserProgress(userId: string): Promise<{
  completedCount: number;
  totalCount: number;
  completedTechniques: string[];
  nextTechnique: string | null;
  progressPercent: number;
}> {
  const ordered = getOrderedTechniqueIds();
  const completedTechniques: string[] = [];
  let nextTechnique: string | null = null;
  
  for (const techId of ordered) {
    const completed = await hasCompletedTechnique(userId, techId);
    if (completed) {
      completedTechniques.push(techId);
    } else if (!nextTechnique) {
      nextTechnique = techId;
    }
  }
  
  return {
    completedCount: completedTechniques.length,
    totalCount: ordered.length,
    completedTechniques,
    nextTechnique,
    progressPercent: Math.round((completedTechniques.length / ordered.length) * 100)
  };
}

/**
 * Expert mode: Calculate which context slots are missing for a technique
 * considering cumulative requirements from all predecessor techniques
 */
export function getCumulativeContextRequirements(techniqueId: string): string[] {
  const predecessors = getPredecessorTechniques(techniqueId);
  const currentTech = getTechnique(techniqueId);
  
  const allRequirements = new Set<string>();
  
  // Add requirements from all predecessors
  for (const predId of predecessors) {
    const tech = getTechnique(predId);
    if (tech?.context_requirements) {
      for (const req of tech.context_requirements) {
        allRequirements.add(req);
      }
    }
  }
  
  // Add requirements from current technique
  if (currentTech?.context_requirements) {
    for (const req of currentTech.context_requirements) {
      allRequirements.add(req);
    }
  }
  
  return Array.from(allRequirements);
}

/**
 * Expert mode: Get missing context slots (max 3 per session)
 * Returns only the slots that haven't been gathered yet
 */
export function getMissingContextSlots(
  techniqueId: string, 
  gatheredContext: Record<string, string>,
  maxSlots: number = 3
): string[] {
  const allRequired = getCumulativeContextRequirements(techniqueId);
  const missing = allRequired.filter(slot => !gatheredContext[slot]);
  return missing.slice(0, maxSlots);
}
