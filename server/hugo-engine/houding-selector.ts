/**
 * Houding Selector - Selecteert klanthouding per beurt op basis van Customer Dynamics Model
 * 
 * SINGLE SOURCE OF TRUTH:
 * - Houding definities → klant_houdingen.json
 * - Customer Dynamics config → customer_dynamics.json
 * - Persona templates → persona_templates.json
 * 
 * ARCHITECTURE: 3 dynamische variabelen (rapport, valueTension, commitReadiness)
 * die evolueren per turn op basis van verkoper technieken uit SSOT
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SelectedHouding {
  id: string;
  key: string;
  naam: string;
  beschrijving: string;
  signalen: string[];
  techniek_reactie: string | object;
  techniek_nummer: string | null;
  stappenplan?: string[];
  detection_patterns: string[];
}

export interface ResolvedPersona {
  behavior_style: string;
  buying_clock_stage: string;
  experience_level: string;
  difficulty_level: string;
}

export interface CustomerDynamics {
  rapport: number;       // 0..1
  valueTension: number;  // 0..1
  commitReadiness: number; // 0..1
}

let dynamicsConfigCache: any = null;

function loadDynamicsConfig(): any {
  if (dynamicsConfigCache) return dynamicsConfigCache;
  const configPath = path.join(process.cwd(), 'config', 'customer_dynamics.json');
  dynamicsConfigCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return dynamicsConfigCache;
}

/**
 * Initialize CustomerDynamics based on persona parameters
 * Uses customer_dynamics.json for all configuration values
 */
export function initializeCustomerDynamics(
  persona: ResolvedPersona,
  personaTemplates: any
): CustomerDynamics {
  const config = loadDynamicsConfig();
  const startValues = config.start_values;
  const clockValues = config.buying_clock_valueTension;
  const stageFactors = config.buying_clock_stage_factor;
  const formula = config.commitReadiness_formula;
  
  // Base values
  let rapport = startValues.rapport_base;
  let valueTension = clockValues[persona.buying_clock_stage] || startValues.valueTension_base;
  
  // Apply behavior_style modifiers
  const behaviorMod = startValues.behavior_style_modifiers?.[persona.behavior_style];
  if (behaviorMod) {
    rapport += behaviorMod.rapport || 0;
    valueTension += behaviorMod.valueTension || 0;
  }
  
  // Apply difficulty modifiers
  const diffMod = startValues.difficulty_modifiers?.[persona.difficulty_level];
  if (diffMod) {
    rapport += diffMod.rapport || 0;
    valueTension += diffMod.valueTension || 0;
  }
  
  // Calculate commitReadiness
  const stageFactor = stageFactors[persona.buying_clock_stage] || 0.5;
  const commitReadiness = Math.min(1, Math.max(0,
    (formula.base + formula.valueTension_weight * valueTension + formula.rapport_weight * rapport) * stageFactor
  ));
  
  return {
    rapport: Math.min(1, Math.max(0, rapport)),
    valueTension: Math.min(1, Math.max(0, valueTension)),
    commitReadiness
  };
}

/**
 * Update CustomerDynamics based on evaluation quality and detected themes
 * 
 * @param dynamics - Current dynamics state
 * @param evaluationQuality - 'perfect', 'goed', 'bijna', or 'niet'
 * @param epicPhase - Current EPIC phase (explore/probe/impact/commit)
 * @param detectedThema - Optional detected theme (Bron, Motivatie, etc.)
 */
export function updateCustomerDynamics(
  dynamics: CustomerDynamics,
  evaluationQuality: 'perfect' | 'goed' | 'bijna' | 'niet' | 'gemist',
  epicPhase?: string,
  detectedThema?: string
): CustomerDynamics {
  const config = loadDynamicsConfig();
  let { rapport, valueTension, commitReadiness } = dynamics;
  
  // 1. Apply evaluation quality effects (primary driver)
  const evalEffects = config.evaluation_effects?.[evaluationQuality];
  if (evalEffects) {
    rapport += evalEffects.rapport || 0;
    valueTension += evalEffects.valueTension || 0;
    commitReadiness += evalEffects.commitReadiness || 0;
  }
  
  // 2. Apply EPIC phase effects (when technique matches phase)
  if (epicPhase && evaluationQuality !== 'niet') {
    const phaseEffects = config.epic_phase_effects?.[epicPhase];
    if (phaseEffects) {
      rapport += phaseEffects.rapport || 0;
      valueTension += phaseEffects.valueTension || 0;
      commitReadiness += phaseEffects.commitReadiness || 0;
    }
  }
  
  // 3. Apply thema effects (bonus for specific themes in Explore)
  if (detectedThema && evaluationQuality === 'goed') {
    const themaEffects = config.thema_effects?.[detectedThema];
    if (themaEffects) {
      rapport += themaEffects.rapport || 0;
      valueTension += themaEffects.valueTension || 0;
      commitReadiness += themaEffects.commitReadiness || 0;
    }
  }
  
  // Clamp all values to 0-1 range
  return {
    rapport: Math.min(1, Math.max(0, rapport)),
    valueTension: Math.min(1, Math.max(0, valueTension)),
    commitReadiness: Math.min(1, Math.max(0, commitReadiness))
  };
}

/**
 * Selecteert een klanthouding op basis van Customer Dynamics Model
 * Vervangt de oude 4-assige geometric mean met dynamics-based scoring
 * 
 * NOTE: This function delegates to getHoudingProbabilities() for scoring/normalization
 * to avoid double-normalization bugs. Probabilities are computed exactly ONCE.
 * 
 * @param persona - Resolved persona parameters (4 assen)
 * @param personaTemplates - Loaded persona_templates.json
 * @param klantHoudingen - Loaded klant_houdingen.json
 * @param phase - Current phase (optional, for phase-specific adjustments)
 * @param dynamics - Current CustomerDynamics state (optional, will initialize if not provided)
 * @param lastDetectedTechniques - Last detected techniques for trigger filtering (optional)
 * @returns Selected houding with all details from klant_houdingen.json
 */
export function selectHoudingForTurn(
  persona: ResolvedPersona,
  personaTemplates: any,
  klantHoudingen: any,
  phase?: number,
  dynamics?: CustomerDynamics,
  lastDetectedTechniques?: string[]
): SelectedHouding {
  const houdingen = klantHoudingen.houdingen as Record<string, any>;
  
  if (!houdingen) {
    console.warn("[houding-selector] Missing houdingen config - using default houding");
    return getDefaultHouding(klantHoudingen);
  }
  
  const probabilities = getHoudingProbabilities(
    persona,
    personaTemplates,
    klantHoudingen,
    phase,
    dynamics,
    lastDetectedTechniques
  );
  
  const keys = Object.keys(probabilities);
  
  if (keys.length === 0) {
    console.warn("[houding-selector] No probabilities returned - falling back to default");
    return getDefaultHouding(klantHoudingen);
  }
  
  let rand = Math.random();
  for (const key of keys) {
    rand -= probabilities[key];
    if (rand <= 0) {
      return buildSelectedHouding(key, houdingen[key]);
    }
  }
  
  const fallbackKey = keys[0];
  return buildSelectedHouding(fallbackKey, houdingen[fallbackKey]);
}

/**
 * Build SelectedHouding from houding data
 */
function buildSelectedHouding(key: string, houding: any): SelectedHouding {
  return {
    id: houding.id,
    key,
    naam: houding.naam,
    beschrijving: houding.houding_beschrijving || houding.beschrijving || '',
    signalen: houding.signalen || [],
    techniek_reactie: houding.techniek_reactie || '',
    techniek_nummer: houding.techniek_nummer || null,
    stappenplan: houding.stappenplan,
    detection_patterns: houding.detection_patterns || houding.semantic_markers || [],
  };
}

/**
 * Get probability distribution for debugging/logging
 * Returns normalized probabilities for all houdingen using Customer Dynamics Model
 */
export function getHoudingProbabilities(
  persona: ResolvedPersona,
  personaTemplates: any,
  klantHoudingen: any,
  phase?: number,
  dynamics?: CustomerDynamics,
  lastDetectedTechniques?: string[]
): Record<string, number> {
  const config = loadDynamicsConfig();
  const houdingen = klantHoudingen.houdingen as Record<string, any>;
  
  if (!houdingen) {
    return {};
  }
  
  // Get factors from config
  const expFactor = config.experience_factor?.[persona.experience_level] || 0.5;
  const diffFactor = config.difficulty_factor?.[persona.difficulty_level] || 0.25;
  const riskOrientation = personaTemplates.behavior_styles?.[persona.behavior_style]?.axis_position?.risico_orientatie || 0.5;
  
  // Use dynamics or initialize
  const dyn = dynamics || initializeCustomerDynamics(persona, personaTemplates);
  
  // Apply same filtering as selectHoudingForTurn
  const allowedKeys = Object.keys(houdingen).filter(key => {
    if (key.startsWith('_')) return false;
    const h = houdingen[key];
    const fr = h.fase_restrictie;
    if (!fr) return true;
    if (fr.allowed_at_any_phase) return true;
    if (phase && fr.allowed_phases && !fr.allowed_phases.includes(phase)) return false;
    if (fr.trigger_techniques && fr.trigger_techniques.length > 0) {
      const hasTrigger = lastDetectedTechniques?.some(t => fr.trigger_techniques.includes(t));
      if (!hasTrigger) return false;
    }
    return true;
  });
  
  const weights = config.attitude_weights;
  const scores: Record<string, number> = {};
  let total = 0;
  
  for (const key of allowedKeys) {
    const w = weights?.[key];
    if (!w) {
      scores[key] = 0.1;
      total += 0.1;
      continue;
    }
    
    let score = w.base || 0.1;
    score += (w.rapport || 0) * (w.rapport > 0 ? dyn.rapport : (1 - dyn.rapport));
    score += (w.valueTension || 0) * (w.valueTension > 0 ? dyn.valueTension : (1 - dyn.valueTension));
    score += (w.commitReadiness || 0) * dyn.commitReadiness;
    
    if (w.difficulty_bonus) score += w.difficulty_bonus * diffFactor;
    if (w.difficulty_penalty) score += w.difficulty_penalty * diffFactor;
    if (w.experience_bonus) score += w.experience_bonus * expFactor;
    if (w.experience_penalty) score += w.experience_penalty * (1 - expFactor);
    if (w.risk_orientation_penalty) score += w.risk_orientation_penalty * (1 - riskOrientation);
    
    const finalScore = Math.max(0.01, score);
    scores[key] = finalScore;
    total += finalScore;
  }
  
  // Normalize (use exact values for proper sampling, not rounded)
  const probabilities: Record<string, number> = {};
  for (const key of allowedKeys) {
    probabilities[key] = scores[key] / total;
  }
  
  return probabilities;
}

/**
 * Get houding by key from klant_houdingen.json
 */
export function getHoudingByKey(
  key: string,
  klantHoudingen: any
): SelectedHouding | null {
  const houding = klantHoudingen.houdingen?.[key];
  
  if (!houding) {
    return null;
  }
  
  return buildSelectedHouding(key, houding);
}

/**
 * Get technique mapping from klant_houdingen.json
 */
export function getTechniqueForHouding(
  houdingKey: string,
  klantHoudingen: any
): { nummer: string | null; naam: string | null } {
  const houding = klantHoudingen.houdingen?.[houdingKey];
  const mapping = klantHoudingen.techniek_mapping || {};
  
  if (!houding) {
    return { nummer: null, naam: null };
  }
  
  const nummer = houding.techniek_nummer;
  const naam = nummer ? mapping[nummer] || null : null;
  
  return { nummer, naam };
}

/**
 * Build houding instruction section for AI prompt
 * All content comes from klant_houdingen.json - NO hardcoding
 */
export function buildHoudingSection(houding: SelectedHouding): string {
  const signalenList = houding.signalen.slice(0, 4).map(s => `  - "${s}"`).join('\n');
  
  let techniekInfo = '';
  if (typeof houding.techniek_reactie === 'object') {
    // Complex techniek (like positief with bij_baat/bij_voordeel)
    const reactie = houding.techniek_reactie as Record<string, any>;
    const entries = Object.entries(reactie)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]: [string, any]) => `  - ${k}: ${v.techniek || v.beschrijving || JSON.stringify(v)}`)
      .join('\n');
    techniekInfo = `MOGELIJKE TECHNIEKEN:\n${entries}`;
  } else if (houding.techniek_reactie) {
    techniekInfo = `VERWACHTE TECHNIEK: ${houding.techniek_reactie}`;
  }
  
  let stappenplanInfo = '';
  if (houding.stappenplan && houding.stappenplan.length > 0) {
    stappenplanInfo = `\nSTAPPENPLAN (wat verkoper moet doen):\n${houding.stappenplan.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;
  }
  
  return `═══════════════════════════════════════════════════════════════
🎭 KLANTHOUDING VOOR DEZE BEURT
═══════════════════════════════════════════════════════════════
HOUDING: ${houding.naam} (${houding.id})
${houding.beschrijving}

SIGNALEN DIE JE KUNT GEVEN:
${signalenList}

${techniekInfo}${stappenplanInfo}

⚠️ JE SPEELT DEZE HOUDING CONSISTENT - GEEN TIPS GEVEN!
═══════════════════════════════════════════════════════════════`;
}

/**
 * Default houding fallback
 */
function getDefaultHouding(klantHoudingen: any): SelectedHouding {
  // Try vaag first (most neutral for fallback)
  const vaag = klantHoudingen?.houdingen?.vaag;
  
  if (vaag) {
    return buildSelectedHouding('vaag', vaag);
  }
  
  // Try positief as second fallback
  const positief = klantHoudingen?.houdingen?.positief;
  if (positief) {
    return buildSelectedHouding('positief', positief);
  }
  
  // Ultimate fallback
  return {
    id: 'H3',
    key: 'vaag',
    naam: 'Vaag antwoord',
    beschrijving: 'Klant geeft geen concreet antwoord op de vraag',
    signalen: ['misschien', 'zou kunnen', 'dat hangt ervan af'],
    techniek_reactie: '2.1.3 - Concretiseren',
    techniek_nummer: '2.1.3',
    stappenplan: [],
    detection_patterns: ['vagueness', 'noncommittal'],
  };
}

/**
 * Clear the dynamics config cache (useful for testing or config reload)
 */
export function clearDynamicsConfigCache(): void {
  dynamicsConfigCache = null;
}
