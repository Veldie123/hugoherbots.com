/**
 * orchestrator.ts - V3 Orchestration Service
 * 
 * Loads coach_overlay_v3.json and provides gate checking for roleplay.
 * Controls: learning_function, context_depth, artifacts_in/out, initial_epic_phase
 * 
 * V3.0 - Initial implementation with basis gates
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export type LearningFunction = 'COACH_TRANSLATE' | 'MICRO_DRILL' | 'ROLEPLAY_DRILL' | 'ROLEPLAY_INTEGRATED';
export type ContextDepth = 'LIGHT' | 'STANDARD' | 'DEEP';
export type ContextLayer = 'base' | 'scenario' | 'value_map' | 'objection_bank' | 'offer_map';
export type ArtifactType = 'scenario_snapshot' | 'discovery_brief' | 'offer_brief';
export type PersonaPolicy = 'session_random' | 'reuse_scenario_snapshot_if_available';
export type EpicPhase = 'explore' | 'probe' | 'impact' | 'commit';

export interface RoleplayConfig {
  initial_epic_phase: EpicPhase;
  default_attitude: string | null;
  persona_policy: PersonaPolicy;
  offer_policy: string;
}

export interface Orchestrator {
  practice_unit: string;
  learning_function: LearningFunction;
  context_depth: ContextDepth;
  context_layers_required: ContextLayer[];
  recommended_bundle: string | null;
  artifacts_in: ArtifactType[];
  artifacts_out: ArtifactType[];
  roleplay: RoleplayConfig | null;
}

export interface TechniqueConfig {
  default_mode: 'COACH_CHAT' | 'COACH_CHAT_THEN_ROLEPLAY';
  roleplay_capable: boolean;
  roleplay_default: boolean;
  orchestrator?: Orchestrator;
}

export interface FlowRules {
  _philosophy: string;
  always_start_with: string;
  context_gathering_purpose: {
    before_roleplay: string;
    before_coach_chat: string;
  };
  after_context: {
    rule: string;
    COACH_CHAT: string;
    COACH_CHAT_THEN_ROLEPLAY: string;
  };
  feedback_trigger: {
    when: string;
    never_after: string[];
    reason: string;
  };
}

export interface CoachOverlayV3 {
  _meta: {
    version: string;
    description: string;
    source: string;
    activated_in: string;
  };
  flow_rules: FlowRules;
  technieken: Record<string, TechniqueConfig>;
}

// Gate check result
export interface GateCheckResult {
  allowed: boolean;
  gate_type?: 'technique' | 'context' | 'artifact' | 'phase';
  message?: string;
  recommended_bundle?: string | null;
  missing_context?: ContextLayer[];
  missing_artifacts?: ArtifactType[];
}

// ============================================================================
// CACHE & LOADING
// ============================================================================

let overlayV3Cache: CoachOverlayV3 | null = null;
let overlayV2Cache: any = null;

/**
 * Check if V3 orchestration is enabled via feature flag
 */
export function isV3Enabled(): boolean {
  return process.env.V3_ORCHESTRATION_ENABLED === 'true';
}

/**
 * Load coach_overlay_v3.json
 */
function loadOverlayV3(): CoachOverlayV3 {
  if (overlayV3Cache) return overlayV3Cache;
  
  const configPath = path.join(process.cwd(), 'config', 'ssot', 'coach_overlay_v3.json');
  
  if (!fs.existsSync(configPath)) {
    console.error('[Orchestrator] coach_overlay_v3.json not found at', configPath);
    throw new Error('coach_overlay_v3.json not found');
  }
  
  const data = fs.readFileSync(configPath, 'utf-8');
  overlayV3Cache = JSON.parse(data) as CoachOverlayV3;
  console.log('[Orchestrator] Loaded coach_overlay_v3.json (version', overlayV3Cache._meta.version + ')');
  return overlayV3Cache;
}

/**
 * Load coach_overlay.json (V2 fallback)
 */
function loadOverlayV2(): any {
  if (overlayV2Cache) return overlayV2Cache;
  
  const configPath = path.join(process.cwd(), 'config', 'ssot', 'coach_overlay.json');
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  const data = fs.readFileSync(configPath, 'utf-8');
  overlayV2Cache = JSON.parse(data);
  return overlayV2Cache;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get orchestrator config for a technique
 * Falls back to V2 if V3 not enabled or technique not found
 */
export function getOrchestrator(techniqueId: string): Orchestrator | null {
  if (!isV3Enabled()) {
    return null;
  }
  
  const overlay = loadOverlayV3();
  const config = overlay.technieken[techniqueId];
  
  if (!config?.orchestrator) {
    console.log(`[Orchestrator] No V3 config for technique ${techniqueId}, using V2 fallback`);
    return null;
  }
  
  return config.orchestrator;
}

/**
 * Get technique config (V3 or V2 fallback)
 */
export function getTechniqueConfig(techniqueId: string): TechniqueConfig | null {
  if (isV3Enabled()) {
    const overlay = loadOverlayV3();
    if (overlay.technieken[techniqueId]) {
      return overlay.technieken[techniqueId];
    }
  }
  
  // Fallback to V2
  const v2 = loadOverlayV2();
  if (v2?.technieken?.[techniqueId]) {
    return {
      default_mode: v2.technieken[techniqueId].default_mode,
      roleplay_capable: v2.technieken[techniqueId].roleplay_capable,
      roleplay_default: v2.technieken[techniqueId].roleplay_default
    };
  }
  
  return null;
}

/**
 * Get flow rules
 */
export function getFlowRules(): FlowRules | null {
  if (!isV3Enabled()) {
    return null;
  }
  
  const overlay = loadOverlayV3();
  return overlay.flow_rules;
}

/**
 * Get initial epic phase for roleplay
 */
export function getInitialEpicPhase(techniqueId: string): EpicPhase {
  const orchestrator = getOrchestrator(techniqueId);
  
  if (orchestrator?.roleplay?.initial_epic_phase) {
    return orchestrator.roleplay.initial_epic_phase;
  }
  
  // Default to explore for backwards compatibility
  return 'explore';
}

/**
 * Get default attitude for roleplay (for afritten drills)
 */
export function getDefaultAttitude(techniqueId: string): string | null {
  const orchestrator = getOrchestrator(techniqueId);
  return orchestrator?.roleplay?.default_attitude || null;
}

/**
 * Get persona policy
 */
export function getPersonaPolicy(techniqueId: string): PersonaPolicy {
  const orchestrator = getOrchestrator(techniqueId);
  return orchestrator?.roleplay?.persona_policy || 'session_random';
}

// ============================================================================
// GATE CHECKING
// ============================================================================

/**
 * UX messages for gate failures
 */
const GATE_MESSAGES = {
  technique_not_roleplay: (bundle: string | null) => 
    bundle 
      ? `Deze techniek is bedoeld als vertaalslag, niet als rollenspel. Wil je oefenen in de ${bundle}-bundel?`
      : 'Deze techniek is bedoeld als vertaalslag, niet als rollenspel.',
  
  missing_context: (layers: ContextLayer[]) =>
    `Voor een realistisch rollenspel heb ik nog wat context nodig over: ${layers.join(', ')}. Zullen we dat eerst kort in kaart brengen?`,
  
  missing_discovery_brief: 
    'Ik kan fase 3 pas realistisch spelen als ik weet wat we in fase 2 ontdekt hebben. Wil je eerst fase 2 oefenen of zal ik je 3 gerichte vragen stellen om die samenvatting te maken?',
  
  missing_offer_brief:
    'Voor de beslissingsfase heb ik je aanbod-samenvatting nodig uit fase 3. Zullen we eerst je OVB (Oplossing-Voordeel-Baat) pitch doorlopen?',
  
  missing_artifact: (artifact: ArtifactType) =>
    `We missen nog de ${artifact} uit een eerdere fase. Zullen we die eerst maken?`
};

/**
 * Check all roleplay gates for a technique
 * 
 * Gate types:
 * - technique: learning_function doesn't allow roleplay
 * - context: required context layers not present
 * - artifact: required artifacts_in not present
 * - phase: initial_epic_phase mismatch (future)
 */
export function checkRoleplayGates(
  techniqueId: string,
  gatheredContext: Record<string, string>,
  sessionArtifacts: Record<string, any> = {}
): GateCheckResult {
  
  // If V3 not enabled, allow all (V2 behavior)
  if (!isV3Enabled()) {
    return { allowed: true };
  }
  
  const config = getTechniqueConfig(techniqueId);
  const orchestrator = getOrchestrator(techniqueId);
  
  // Gate A: Technique gate - check roleplay_capable
  if (config && !config.roleplay_capable) {
    return {
      allowed: false,
      gate_type: 'technique',
      message: GATE_MESSAGES.technique_not_roleplay(orchestrator?.recommended_bundle || null),
      recommended_bundle: orchestrator?.recommended_bundle
    };
  }
  
  // Gate B: Learning function gate - COACH_TRANSLATE never allows roleplay
  if (orchestrator?.learning_function === 'COACH_TRANSLATE') {
    return {
      allowed: false,
      gate_type: 'technique',
      message: GATE_MESSAGES.technique_not_roleplay(orchestrator.recommended_bundle),
      recommended_bundle: orchestrator.recommended_bundle
    };
  }
  
  // Gate C: Artifact gate - check artifacts_in
  if (orchestrator?.artifacts_in && orchestrator.artifacts_in.length > 0) {
    const missingArtifacts = orchestrator.artifacts_in.filter(
      artifact => !sessionArtifacts[artifact]
    );
    
    if (missingArtifacts.length > 0) {
      // Special messages for specific artifacts
      let message: string;
      if (missingArtifacts.includes('discovery_brief')) {
        message = GATE_MESSAGES.missing_discovery_brief;
      } else if (missingArtifacts.includes('offer_brief')) {
        message = GATE_MESSAGES.missing_offer_brief;
      } else {
        message = GATE_MESSAGES.missing_artifact(missingArtifacts[0]);
      }
      
      return {
        allowed: false,
        gate_type: 'artifact',
        message,
        missing_artifacts: missingArtifacts
      };
    }
  }
  
  // Gate D: Context gate - check context_layers_required
  // Note: For V3.0, we only check base layer since extended layers (value_map etc) aren't implemented yet
  if (orchestrator?.context_layers_required) {
    const missingLayers: ContextLayer[] = [];
    
    for (const layer of orchestrator.context_layers_required) {
      if (layer === 'base') {
        // Check base slots
        const baseSlots = ['sector', 'product'];
        const hasBase = baseSlots.some(slot => gatheredContext[slot]?.trim());
        if (!hasBase) {
          missingLayers.push('base');
        }
      }
      // Future: check scenario, value_map, objection_bank, offer_map
      // For V3.0, we skip these checks as the layers aren't implemented yet
    }
    
    if (missingLayers.length > 0) {
      return {
        allowed: false,
        gate_type: 'context',
        message: GATE_MESSAGES.missing_context(missingLayers),
        missing_context: missingLayers
      };
    }
  }
  
  // All gates passed
  return { allowed: true };
}

/**
 * Check if a technique supports roleplay at all
 */
export function canTechniqueRoleplay(techniqueId: string): boolean {
  const config = getTechniqueConfig(techniqueId);
  if (!config) return false;
  
  // V3: also check learning_function
  const orchestrator = getOrchestrator(techniqueId);
  if (orchestrator) {
    return config.roleplay_capable && orchestrator.learning_function !== 'COACH_TRANSLATE';
  }
  
  return config.roleplay_capable;
}

/**
 * Get recommended bundle for a micro-technique
 */
export function getRecommendedBundle(techniqueId: string): string | null {
  const orchestrator = getOrchestrator(techniqueId);
  return orchestrator?.recommended_bundle || null;
}

/**
 * Get artifacts that should be produced after this technique's roleplay
 */
export function getArtifactsOut(techniqueId: string): ArtifactType[] {
  const orchestrator = getOrchestrator(techniqueId);
  return orchestrator?.artifacts_out || [];
}

/**
 * Clear caches (useful for testing)
 */
export function clearOrchestratorCache(): void {
  overlayV3Cache = null;
  overlayV2Cache = null;
}
