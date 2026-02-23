/**
 * customer_engine.ts - Hugo as Customer
 * 
 * Generates customer responses during roleplay.
 * Input: ContextState + persona + attitude + last seller message
 * Output: Customer response + customer_signal label
 * 
 * KEY DESIGN: Compact prompt (~15 sentences), no rule bloat
 * CONFIG DRIVEN: All Dutch text loaded from config files (STRICT mode)
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { ContextState, formatContextForPrompt } from './context_engine';
import { CustomerDynamics } from '../houding-selector';
import { validateAndRepair, buildValidatorDebugInfo, type ValidatorDebugInfo } from './response-repair';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
  return openaiClient;
}

/**
 * Config types for strict loading
 */
interface RoleplayPromptConfig {
  epic_phase_guidelines: Record<string, string>;
  response_template: {
    template: string;
    dynamics_section: string;
    history_prefix: string;
  };
  fallback_error: string;
}

interface HoudingEntry {
  id: string;
  naam: string;
  fallback_response: string;
  generation_examples?: string[];
  fase_restrictie?: {
    allowed_phases: number[];
    allowed_at_any_phase: boolean;
  };
}

interface HoudingenConfig {
  houdingen: Record<string, HoudingEntry>;
}

let roleplayPromptCache: RoleplayPromptConfig | null = null;
let houdingCache: HoudingenConfig | null = null;

/**
 * STRICT config loader - throws if required keys are missing
 */
function loadRoleplayPromptConfig(): RoleplayPromptConfig {
  if (roleplayPromptCache) return roleplayPromptCache;
  
  const configPath = path.join(process.cwd(), 'config', 'prompts', 'roleplay_prompt.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  if (!raw.epic_phase_guidelines) {
    throw new Error('[customer_engine] STRICT: Missing epic_phase_guidelines in roleplay_prompt.json');
  }
  if (!raw.response_template?.template) {
    throw new Error('[customer_engine] STRICT: Missing response_template.template in roleplay_prompt.json');
  }
  if (!raw.fallback_error) {
    throw new Error('[customer_engine] STRICT: Missing fallback_error in roleplay_prompt.json');
  }
  if (!raw.response_template?.dynamics_section) {
    throw new Error('[customer_engine] STRICT: Missing response_template.dynamics_section in roleplay_prompt.json');
  }
  if (!raw.response_template?.history_prefix) {
    throw new Error('[customer_engine] STRICT: Missing response_template.history_prefix in roleplay_prompt.json');
  }
  
  const requiredPhases = ['explore', 'probe', 'impact', 'commit'];
  for (const phase of requiredPhases) {
    if (!raw.epic_phase_guidelines[phase]) {
      throw new Error(`[customer_engine] STRICT: Missing epic_phase_guidelines.${phase} in roleplay_prompt.json`);
    }
  }
  
  roleplayPromptCache = {
    epic_phase_guidelines: raw.epic_phase_guidelines,
    response_template: {
      template: raw.response_template.template,
      dynamics_section: raw.response_template.dynamics_section,
      history_prefix: raw.response_template.history_prefix
    },
    fallback_error: raw.fallback_error
  };
  
  return roleplayPromptCache;
}

function loadHoudingen(): HoudingenConfig {
  if (houdingCache) return houdingCache;
  
  const configPath = path.join(process.cwd(), 'config', 'klant_houdingen.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  if (!raw.houdingen) {
    throw new Error('[customer_engine] STRICT: Missing houdingen in klant_houdingen.json');
  }
  
  const requiredAttitudes = ['positief', 'negatief', 'vaag', 'ontwijkend', 'vraag', 'twijfel', 'bezwaar', 'uitstel', 'angst'];
  for (const attitude of requiredAttitudes) {
    if (!raw.houdingen[attitude]) {
      throw new Error(`[customer_engine] STRICT: Missing houdingen.${attitude} in klant_houdingen.json`);
    }
    if (!raw.houdingen[attitude].fallback_response) {
      throw new Error(`[customer_engine] STRICT: Missing houdingen.${attitude}.fallback_response in klant_houdingen.json`);
    }
  }
  
  houdingCache = raw as HoudingenConfig;
  return houdingCache;
}

/**
 * Get fallback response for a specific attitude from config
 */
function getAttitudeFallback(attitude: CustomerSignal): string {
  const config = loadHoudingen();
  const entry = config.houdingen[attitude];
  if (!entry?.fallback_response) {
    throw new Error(`[customer_engine] STRICT: No fallback_response for attitude ${attitude}`);
  }
  return entry.fallback_response;
}

/**
 * Customer signal - what attitude the customer displayed
 */
export type CustomerSignal = 
  | 'positief'
  | 'negatief'
  | 'vaag'
  | 'ontwijkend'
  | 'vraag'
  | 'twijfel'
  | 'bezwaar'
  | 'uitstel'
  | 'angst';

/**
 * Persona configuration (loaded from persona_templates.json)
 */
export interface Persona {
  behavior_style: string;
  buying_clock_stage: string;
  experience_level: string;
  difficulty_level: string;
  principles: string[];
}

/**
 * Customer engine output
 */
export interface CustomerResponse {
  message: string;
  signal: CustomerSignal;
  dynamics?: CustomerDynamics;
  debug?: {
    persona: Persona;
    attitude: CustomerSignal;
    dynamics?: CustomerDynamics;
    promptTokens?: number;
    rawResponse?: string | null;
    error?: string;
    wasRepaired?: boolean;
    repairAttempts?: number;
  };
  validatorInfo?: ValidatorDebugInfo;
}

/**
 * Attitude examples for the AI (from klant_houdingen.json)
 */
interface AttitudeConfig {
  id: string;
  naam: string;
  signalen: string[];
}

let personaCache: any = null;
let dynamicsConfigCache: any = null;

function loadDynamicsConfig(): any {
  if (dynamicsConfigCache) return dynamicsConfigCache;
  const configPath = path.join(process.cwd(), 'config', 'customer_dynamics.json');
  dynamicsConfigCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return dynamicsConfigCache;
}

function getDynamicsInstructions(dynamics: CustomerDynamics): string {
  const config = loadDynamicsConfig();
  const instructions = config.prompt_instructions;
  const lines: string[] = [];
  
  if (dynamics.rapport < 0.35) {
    lines.push(instructions.rapport_low);
  } else if (dynamics.rapport > 0.65) {
    lines.push(instructions.rapport_high);
  }
  
  if (dynamics.valueTension < 0.30) {
    lines.push(instructions.valueTension_low);
  } else if (dynamics.valueTension > 0.60) {
    lines.push(instructions.valueTension_high);
  }
  
  if (dynamics.commitReadiness < 0.40) {
    lines.push(instructions.commitReadiness_low);
  } else if (dynamics.commitReadiness > 0.70) {
    lines.push(instructions.commitReadiness_high);
  }
  
  return lines.join(' ');
}

function formatDynamicsLevel(value: number, lowThreshold: number, highThreshold: number): string {
  const config = loadRoleplayPromptConfig();
  const dynamicsConfig = loadDynamicsConfig();
  const levelLabels = dynamicsConfig.level_labels || { low: 'laag', medium: 'gemiddeld', high: 'hoog' };
  
  if (value < lowThreshold) return levelLabels.low;
  if (value > highThreshold) return levelLabels.high;
  return levelLabels.medium;
}

function loadPersonaTemplates(): any {
  if (personaCache) return personaCache;
  const configPath = path.join(process.cwd(), 'config', 'persona_templates.json');
  personaCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return personaCache;
}

/**
 * POST-GENERATION SIGNAL CLASSIFIER
 * 
 * ARCHITECTURE NOTE (v2.0):
 * klant_houdingen.json is now a pure detection overlay with semantic_markers only.
 * Detection is AI-based, not regex-based. The AI customer engine generates responses
 * WITH the instructed attitude, and we trust the AI to follow instructions.
 * 
 * This function now serves as:
 * 1. Phase restriction enforcement (some attitudes only in fase 3/4)
 * 2. Fallback to allowed attitude if phase restricts the sampled one
 * 
 * Future enhancement: Use AI classifier with semantic_markers for validation.
 */
export function classifySignalFromResponse(
  responseText: string,
  sampledAttitude: CustomerSignal,
  phase: number
): CustomerSignal {
  const houdingen = loadHoudingen();
  
  const attitudeConfig = houdingen.houdingen?.[sampledAttitude];
  if (attitudeConfig) {
    const faseRestrictie = attitudeConfig.fase_restrictie;
    if (faseRestrictie && !faseRestrictie.allowed_at_any_phase) {
      const allowedPhases = faseRestrictie.allowed_phases || [];
      if (!allowedPhases.includes(phase)) {
        console.log(`[classifier] ${sampledAttitude} blocked in fase ${phase}, falling back`);
        
        const fallbackOrder: CustomerSignal[] = ['vaag', 'ontwijkend', 'positief'];
        for (const fallback of fallbackOrder) {
          const fbConfig = houdingen.houdingen?.[fallback];
          const fbRestriction = fbConfig?.fase_restrictie;
          if (fbRestriction?.allowed_at_any_phase || 
              (fbRestriction?.allowed_phases?.includes(phase))) {
            return fallback;
          }
        }
        return 'positief';
      }
    }
  }
  
  return sampledAttitude;
}

/**
 * Generate random persona parameters from available options in config
 * Returns random values for each of the 4 persona axes
 */
export function generateRandomPersonaParams(): {
  behaviorStyle: string;
  buyingClockStage: string;
  experienceLevel: string;
  difficultyLevel: string;
} {
  const templates = loadPersonaTemplates();
  
  const behaviorStyles = Object.keys(templates.behavior_styles || {});
  const buyingClockStages = (templates.buying_clock?.stages || []).map((s: any) => s.id);
  const experienceLevels = Object.keys(templates.experience_levels || {});
  const difficultyLevels = Object.keys(templates.difficulty_levels || {});
  
  const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  return {
    behaviorStyle: randomChoice(behaviorStyles) || templates.defaults.behavior_style,
    buyingClockStage: randomChoice(buyingClockStages) || templates.defaults.buying_clock_stage,
    experienceLevel: randomChoice(experienceLevels) || templates.defaults.experience_level,
    difficultyLevel: randomChoice(difficultyLevels) || templates.defaults.difficulty_level
  };
}

/**
 * Build persona from templates
 */
export function buildPersona(
  behaviorStyle?: string,
  buyingClockStage?: string,
  experienceLevel?: string,
  difficultyLevel?: string
): Persona {
  const templates = loadPersonaTemplates();
  const defaults = templates.defaults;
  
  const style = behaviorStyle || defaults.behavior_style;
  const clock = buyingClockStage || defaults.buying_clock_stage;
  const experience = experienceLevel || defaults.experience_level;
  const difficulty = difficultyLevel || defaults.difficulty_level;
  
  const principles: string[] = [];
  
  const behaviorConfig = templates.behavior_styles?.[style];
  if (behaviorConfig?.principles) {
    principles.push(...behaviorConfig.principles.slice(0, 2));
  }
  
  const clockStages = templates.buying_clock?.stages || [];
  const clockConfig = clockStages.find((s: any) => s.id === clock);
  if (clockConfig?.principles) {
    principles.push(clockConfig.principles[0]);
  }
  
  const expConfig = templates.experience_levels?.[experience];
  if (expConfig?.principles) {
    principles.push(expConfig.principles[0]);
  }
  
  return {
    behavior_style: style,
    buying_clock_stage: clock,
    experience_level: experience,
    difficulty_level: difficulty,
    principles
  };
}

/**
 * Get attitude examples for prompt (from generation_examples field)
 */
function getAttitudeExamples(attitude: CustomerSignal): string[] {
  const houdingen = loadHoudingen();
  const houdingConfig = houdingen.houdingen?.[attitude];
  return houdingConfig?.generation_examples || [];
}

/**
 * EPIC phase type
 */
export type EpicPhase = 'explore' | 'probe' | 'impact' | 'commit';

/**
 * Get EPIC-specific response guidelines based on current phase (from config)
 */
function getEpicResponseGuidelines(epicPhase: EpicPhase): string {
  const config = loadRoleplayPromptConfig();
  const guideline = config.epic_phase_guidelines[epicPhase];
  if (!guideline) {
    throw new Error(`[customer_engine] STRICT: No epic_phase_guidelines for phase ${epicPhase}`);
  }
  return guideline;
}

/**
 * Build compact customer prompt using template from config
 */
function buildCustomerPrompt(
  context: ContextState,
  persona: Persona,
  attitude: CustomerSignal,
  sellerMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  epicPhase: EpicPhase = 'explore',
  dynamics?: CustomerDynamics
): string {
  const config = loadRoleplayPromptConfig();
  const contextStr = formatContextForPrompt(context);
  const attitudeExamples = getAttitudeExamples(attitude);
  const epicGuidelines = getEpicResponseGuidelines(epicPhase);
  
  const recentHistory = conversationHistory.slice(-4);
  const historyStr = recentHistory
    .map(h => `${h.role === 'seller' ? 'Verkoper' : 'Klant'}: ${h.content}`)
    .join('\n');
  
  let dynamicsSection = '';
  if (dynamics) {
    const rapportLevel = formatDynamicsLevel(dynamics.rapport, 0.35, 0.65);
    const tensionLevel = formatDynamicsLevel(dynamics.valueTension, 0.30, 0.60);
    const commitLevel = formatDynamicsLevel(dynamics.commitReadiness, 0.40, 0.70);
    
    dynamicsSection = config.response_template.dynamics_section
      .replace('{{rapport_level}}', rapportLevel)
      .replace('{{tension_level}}', tensionLevel)
      .replace('{{commit_level}}', commitLevel);
  }
  
  const examplesStr = attitudeExamples.length > 0 
    ? `Voorbeelden: ${attitudeExamples.slice(0, 2).map(e => `"${e}"`).join(' of ')}`
    : '';
  const historySection = historyStr ? `${config.response_template.history_prefix}${historyStr}\n` : '';
  
  return config.response_template.template
    .replace('{{context}}', contextStr)
    .replace('{{attitude}}', attitude)
    .replace('{{examples}}', examplesStr)
    .replace('{{dynamics}}', dynamicsSection)
    .replace('{{epic_guidelines}}', epicGuidelines)
    .replace('{{history}}', historySection)
    .replace('{{seller_message}}', sellerMessage);
}

/**
 * Generate customer response
 */
export async function generateCustomerResponse(
  context: ContextState,
  persona: Persona,
  attitude: CustomerSignal,
  sellerMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  epicPhase: EpicPhase = 'explore',
  dynamics?: CustomerDynamics
): Promise<CustomerResponse> {
  const config = loadRoleplayPromptConfig();
  
  const prompt = buildCustomerPrompt(
    context,
    persona,
    attitude,
    sellerMessage,
    conversationHistory,
    epicPhase,
    dynamics
  );
  
  try {
    console.log('[customer_engine] Calling OpenAI with prompt length:', prompt.length);
    console.log('[customer_engine] PROMPT:', prompt.substring(0, 500) + '...');
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-5.1',  // Changed from gpt-5-mini - may fix empty content issue
      messages: [
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 500,
    });
    
    // Extensive logging to debug empty responses
    const choice = response.choices[0];
    const rawContent = choice?.message?.content;
    console.log('[customer_engine] finish_reason:', choice?.finish_reason);
    console.log('[customer_engine] RAW content:', JSON.stringify(rawContent));
    console.log('[customer_engine] message object:', JSON.stringify(choice?.message));
    console.log('[customer_engine] completion_tokens:', response.usage?.completion_tokens);
    console.log('[customer_engine] prompt_tokens:', response.usage?.prompt_tokens);
    
    const rawMessage = rawContent?.trim() || config.fallback_error;
    
    if (!rawContent?.trim()) {
      console.warn('[customer_engine] Empty response - finish_reason:', choice?.finish_reason);
      console.warn('[customer_engine] Full choice object:', JSON.stringify(choice));
    }
    
    const repairResult = await validateAndRepair(rawMessage, "ROLEPLAY", {
      originalSystemPrompt: prompt,
    });
    
    if (repairResult.wasRepaired) {
      console.log(`[customer_engine] Response repaired: ${repairResult.validationResult.label}`);
    }
    
    const validatorInfo = buildValidatorDebugInfo("ROLEPLAY", repairResult);
    
    return {
      message: repairResult.repairedResponse,
      signal: attitude,
      dynamics: dynamics,
      debug: {
        persona,
        attitude,
        dynamics,
        promptTokens: response.usage?.prompt_tokens,
        rawResponse: rawContent,
        wasRepaired: repairResult.wasRepaired,
        repairAttempts: repairResult.repairAttempts
      },
      validatorInfo
    };
    
  } catch (error: any) {
    console.error('[customer_engine] OpenAI error:', error.message);
    console.error('[customer_engine] Full error:', error);
    
    return {
      message: getAttitudeFallback(attitude),
      signal: attitude,
      dynamics: dynamics,
      debug: { persona, attitude, dynamics, error: error.message }
    };
  }
}

/**
 * All possible customer attitudes
 */
const ALL_ATTITUDES: CustomerSignal[] = [
  'positief', 'negatief', 'vaag', 'ontwijkend', 'vraag',
  'twijfel', 'bezwaar', 'uitstel', 'angst'
];

/**
 * Quality level from evaluator - affects attitude sampling
 */
export type EvaluationQuality = 'perfect' | 'goed' | 'bijna' | 'gemist';

/**
 * Positive attitudes that good sales technique should increase
 */
const POSITIVE_ATTITUDES: CustomerSignal[] = ['positief', 'vraag'];

/**
 * Negative attitudes that poor sales technique should increase
 */
const NEGATIVE_ATTITUDES: CustomerSignal[] = ['negatief', 'vaag', 'ontwijkend'];

/**
 * Apply verkoper-kwaliteit modifier to weights
 * Good technique → shift toward positive attitudes
 * Poor technique → shift toward negative/neutral attitudes
 */
function applyQualityModifier(
  weights: Record<CustomerSignal, number>,
  quality?: EvaluationQuality
): Record<CustomerSignal, number> {
  if (!quality) return weights;
  
  const modified = { ...weights };
  
  const qualityMultipliers: Record<EvaluationQuality, { positive: number; negative: number }> = {
    perfect: { positive: 1.8, negative: 0.4 },
    goed:    { positive: 1.4, negative: 0.7 },
    bijna:   { positive: 1.0, negative: 1.0 },
    gemist:  { positive: 0.6, negative: 1.5 }
  };
  
  const { positive: posMultiplier, negative: negMultiplier } = qualityMultipliers[quality];
  
  for (const attitude of POSITIVE_ATTITUDES) {
    if (modified[attitude] !== undefined) {
      modified[attitude] *= posMultiplier;
    }
  }
  
  for (const attitude of NEGATIVE_ATTITUDES) {
    if (modified[attitude] !== undefined) {
      modified[attitude] *= negMultiplier;
    }
  }
  
  return modified;
}

/**
 * Sample attitude using 4-axis weights from persona_templates.json
 * Combines behavior_style, buying_clock, experience_level, difficulty_level
 * Applies verkoper-kwaliteit modifier to shift probabilities based on performance
 */
export function sampleAttitude(
  phase: number, 
  techniqueId: string,
  persona?: Persona,
  evaluationQuality?: EvaluationQuality
): CustomerSignal {
  const templates = loadPersonaTemplates();
  const houdingWeights = templates.houding_weights;
  const defaults = templates.defaults;
  const fallbackWeight = defaults?.houding_weights_fallback || 0.05;
  
  const behaviorStyle = persona?.behavior_style || defaults?.behavior_style || 'analyserend';
  const buyingClock = persona?.buying_clock_stage || defaults?.buying_clock_stage || 'market_research';
  const experienceLevel = persona?.experience_level || defaults?.experience_level || 'enige_ervaring';
  const difficultyLevel = persona?.difficulty_level || defaults?.difficulty_level || 'bewuste_kunde';
  
  const byBehavior = houdingWeights?.by_behavior_style?.[behaviorStyle] || {};
  const byBuyingClock = houdingWeights?.by_buying_clock?.[buyingClock] || {};
  const byExperience = houdingWeights?.by_experience_level?.[experienceLevel] || {};
  const byDifficulty = houdingWeights?.by_difficulty_level?.[difficultyLevel] || {};
  
  const isClosingContext = phase === 4 || 
    techniqueId.startsWith('3.5') || 
    techniqueId.startsWith('4.');
  
  const availableAttitudes = isClosingContext 
    ? ALL_ATTITUDES 
    : ALL_ATTITUDES.slice(0, 5);
  
  let combinedWeights: Record<CustomerSignal, number> = {} as any;
  
  for (const attitude of availableAttitudes) {
    const w1 = byBehavior[attitude] ?? fallbackWeight;
    const w2 = byBuyingClock[attitude] ?? fallbackWeight;
    const w3 = byExperience[attitude] ?? fallbackWeight;
    const w4 = byDifficulty[attitude] ?? fallbackWeight;
    
    combinedWeights[attitude] = Math.pow(w1 * w2 * w3 * w4, 0.25);
  }
  
  combinedWeights = applyQualityModifier(combinedWeights, evaluationQuality);
  
  const total = Object.values(combinedWeights).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return availableAttitudes[Math.floor(Math.random() * availableAttitudes.length)];
  }
  
  let r = Math.random() * total;
  
  for (const attitude of availableAttitudes) {
    r -= combinedWeights[attitude];
    if (r <= 0) return attitude;
  }
  
  return 'vaag';
}

/**
 * Clear caches (for testing)
 */
export function clearCustomerCaches(): void {
  personaCache = null;
  houdingCache = null;
  dynamicsConfigCache = null;
  roleplayPromptCache = null;
}
