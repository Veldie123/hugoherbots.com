/**
 * router.ts - Mode selection per technique
 * 
 * Determines which mode Hugo operates in based on the selected technique:
 * - COACH_ONLY: Pure coaching, no roleplay
 * - ROLEPLAY_CUSTOMER: Hugo plays customer immediately
 * - COACH_CHAT_THEN_ROLEPLAY: Coach chat first, then transition to roleplay
 * - DEBUG: Testing mode
 */

import { loadMergedTechniques, getTechnique as getSsotTechnique, type MergedTechnique } from '../ssot-loader';

export type HugoMode = 'COACH_ONLY' | 'COACH_CHAT' | 'ROLEPLAY_CUSTOMER' | 'COACH_CHAT_THEN_ROLEPLAY' | 'DEBUG';

export interface TechniqueConfig extends MergedTechnique {}

/**
 * Get technique configuration by nummer (e.g., "2.1", "1.2")
 */
export function getTechnique(nummer: string): TechniqueConfig | null {
  return getSsotTechnique(nummer) || null;
}

/**
 * Determine mode for a technique
 */
export function getMode(nummer: string): HugoMode {
  const technique = getTechnique(nummer);
  
  if (!technique) {
    console.warn(`[router] Technique ${nummer} not found, defaulting to COACH_CHAT`);
    return 'COACH_CHAT';
  }
  
  const practice = technique.practice;
  
  if (!practice) {
    return 'COACH_CHAT';
  }
  
  // Map practice.default_mode to HugoMode
  if (practice.default_mode === 'COACH_CHAT') {
    return 'COACH_CHAT';
  } else if (practice.default_mode === 'COACH_CHAT_THEN_ROLEPLAY') {
    return 'COACH_CHAT_THEN_ROLEPLAY';
  }
  
  // Fallback based on roleplay capability
  return practice.roleplay_capable && practice.roleplay_default 
    ? 'COACH_CHAT_THEN_ROLEPLAY' 
    : 'COACH_CHAT';
}

/**
 * Check if technique supports roleplay
 */
export function canRoleplay(nummer: string): boolean {
  const technique = getTechnique(nummer);
  return technique?.practice?.roleplay_capable ?? false;
}

/**
 * Get phase number for a technique
 */
export function getPhase(nummer: string): number {
  const technique = getTechnique(nummer);
  return technique ? parseInt(technique.fase, 10) : 1;
}

import { clearCache as clearSsotCache } from '../ssot-loader';

/**
 * Clear catalog cache (for testing)
 */
export function clearCache(): void {
  clearSsotCache();
}
