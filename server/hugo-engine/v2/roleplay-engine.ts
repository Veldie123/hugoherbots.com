/**
 * roleplay-engine.ts - V2 Orchestrator
 * 
 * Central coordinator for the new simplified roleplay system.
 * Manages: mode selection, context gathering, customer simulation, evaluation.
 * 
 * KEY DESIGN: Clean separation of concerns, compact state, no prompt bloat.
 */

import * as fs from 'fs';
import * as path from 'path';
import { HugoMode, getMode, getTechnique, getPhase, canRoleplay } from './router';
import { 
  ContextState, 
  createContextState, 
  getNextQuestion, 
  getNextSlotKey,
  processAnswer, 
  formatContextForPrompt,
  getQuestionsForTechnique,
  DialogueState,
  createDialogueState,
  interpretAnswer,
  generateHugoResponse,
  getThemeForSlot,
  getMaxClarificationsPerSlot,
  getFallbackAfterMax,
  incrementClarificationCount,
  hasReachedMaxClarifications,
  generateQuestionForSlot,
  isLensSlot,
  areBaseSlotsComplete,
  isLensPhaseComplete,
  LENS_SLOTS,
  getAIDialogueTemplates,
  AI_DIALOGUE_CONFIG
} from './context_engine';
import { 
  CustomerResponse, 
  CustomerSignal, 
  Persona, 
  buildPersona,
  generateRandomPersonaParams,
  generateCustomerResponse, 
  sampleAttitude,
  classifySignalFromResponse,
  EpicPhase
} from './customer_engine';
import { 
  evaluateConceptually, 
  evaluateFirstTurn,
  DetectionResult, 
  EvaluationEvent, 
  generateSessionFeedback 
} from './evaluator';
import { generateCoachResponse, generateCoachOpening, generateHugoDebrief, DebriefContext } from './coach-engine';
import { saveReferenceAnswer } from './reference-answers';
import { 
  CustomerDynamics, 
  initializeCustomerDynamics, 
  updateCustomerDynamics,
  ResolvedPersona 
} from '../houding-selector';
import { loadMergedTechniques } from '../ssot-loader';
import { getOpenAI } from '../openai-client';
import { formatValidatorContext, buildValidatorContextString } from './historical-context-service';
import type { ValidatorDebugInfo } from './response-repair';
import { getArtifactsMap } from './artifact-service';
import { 
  getOrchestrator, 
  getInitialEpicPhase, 
  getDefaultAttitude,
  checkRoleplayGates,
  canTechniqueRoleplay,
  isV3Enabled,
  type GateCheckResult
} from './orchestrator';
import { 
  performanceTracker, 
  type PerformanceResult, 
  type LevelTransition 
} from './performance-tracker';

/**
 * Cache for klant_houdingen.json
 */
let klantHoudingenCache: any = null;

/**
 * Cache for persona_templates.json
 */
let personaTemplatesCache: any = null;

/**
 * Cache for customer_dynamics.json
 */
let customerDynamicsCache: any = null;

/**
 * Load persona_templates.json for dynamics initialization
 */
function loadPersonaTemplates(): any {
  if (personaTemplatesCache) return personaTemplatesCache;
  const configPath = path.join(process.cwd(), 'config', 'persona_templates.json');
  personaTemplatesCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return personaTemplatesCache;
}

/**
 * Load customer_dynamics.json for level labels
 */
function loadCustomerDynamicsConfig(): any {
  if (customerDynamicsCache) return customerDynamicsCache;
  const configPath = path.join(process.cwd(), 'config', 'customer_dynamics.json');
  customerDynamicsCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return customerDynamicsCache;
}

/**
 * Cache for ai_prompt.json templates
 */
let aiPromptCache: any = null;

/**
 * Load and validate ai_prompt.json - STRICT mode, throws if keys missing
 */
function loadAiPromptConfig(): any {
  if (aiPromptCache) return aiPromptCache;
  
  const configPath = path.join(process.cwd(), 'config', 'ai_prompt.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // STRICT validation - throw if required keys are missing
  // NOTE: roleplay_start templates removed since opening is now AI-generated
  const requiredPaths = [
    'templates.roleplay.validation.too_short',
    'templates.roleplay.validation.too_long',
    'templates.roleplay.validation.gibberish',
    'templates.roleplay.validation.repeated_chars',
    'templates.errors.unknown_mode'
  ];
  
  for (const keyPath of requiredPaths) {
    const keys = keyPath.split('.');
    let value = config;
    for (const key of keys) {
      value = value?.[key];
    }
    if (value === undefined || value === null) {
      throw new Error(`[roleplay-engine] Missing required config key: ${keyPath} in ai_prompt.json`);
    }
  }
  
  aiPromptCache = config;
  return aiPromptCache;
}

/**
 * Get a nested config value by dot-notation path
 * STRICT mode - throws if key is missing
 */
function getConfigText(keyPath: string): string {
  const config = loadAiPromptConfig();
  const keys = keyPath.split('.');
  let value = config;
  for (const key of keys) {
    value = value?.[key];
  }
  if (value === undefined || value === null) {
    throw new Error(`[roleplay-engine] Missing config key: ${keyPath}`);
  }
  return value;
}

/**
 * Replace template placeholders with actual values
 */
function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }
  return result;
}

/**
 * Get a dialogue template from HARDCODED AI_DIALOGUE_CONFIG
 * Uses templates exported from context_engine.ts
 */
function getDialogueTemplate(key: string): string {
  const templates = getAIDialogueTemplates();
  const template = templates[key as keyof typeof templates];
  if (!template) {
    throw new Error(`[STRICT] Missing dialogue template: ${key}`);
  }
  return template;
}

/**
 * Apply variables to a dialogue template
 * Uses {{placeholder}} syntax
 */
function applyDialogueTemplate(key: string, vars: Record<string, string>): string {
  let template = getDialogueTemplate(key);
  for (const [k, v] of Object.entries(vars)) {
    template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return template;
}

import { getTechnique as getSsotTechnique, getTechniqueName as getSsotTechniqueName } from '../ssot-loader';

/**
 * Get official technique name from SSOT
 * Returns formatted string: "nummer - naam"
 */
function getOfficialTechniqueName(techniqueId: string): string {
  const technique = getSsotTechnique(techniqueId);
  if (technique) {
    return `${technique.nummer} - ${technique.naam}`;
  }
  return techniqueId; // Fallback to raw ID if not found
}

/**
 * Extract all technique IDs from various formats like "2.1.2 Meningvraag of 2.1.6 Actief luisteren"
 */
function extractAllTechniqueIds(text: string): string[] {
  // Match all patterns like "2.1.2", "2.1.1.1", etc.
  const matches = text.match(/\b(\d+(?:\.\d+)+)\b/g);
  return matches || [];
}

/**
 * Normalize expected move to use official technique names
 * Handles multi-technique strings like "2.1.2 of 2.1.6"
 */
function normalizeExpectedMove(move: string): string {
  const techniqueIds = extractAllTechniqueIds(move);
  if (techniqueIds.length === 0) {
    return move; // Return as-is if no technique ID found
  }
  if (techniqueIds.length === 1) {
    return getOfficialTechniqueName(techniqueIds[0]);
  }
  // Multiple techniques: join with " of "
  return techniqueIds.map(id => getOfficialTechniqueName(id)).join(' of ');
}

/**
 * Deduplicate expected moves by extracting technique IDs
 * Keeps the first occurrence of each technique
 */
function deduplicateExpectedMoves(moves: string[]): string[] {
  const seenIds = new Set<string>();
  const result: string[] = [];
  
  for (const move of moves) {
    const ids = extractAllTechniqueIds(move);
    if (ids.length === 0) {
      // No technique ID - skip generic text entries
      continue;
    }
    
    // Check if any of these IDs are already seen
    const newIds = ids.filter(id => !seenIds.has(id));
    if (newIds.length > 0) {
      // Add all IDs to seen set
      ids.forEach(id => seenIds.add(id));
      result.push(move);
    }
  }
  
  return result;
}

/**
 * Load klant_houdingen.json for debug telemetry
 */
function loadKlantHoudingen(): any {
  if (klantHoudingenCache) return klantHoudingenCache;
  const configPath = path.join(process.cwd(), 'config', 'klant_houdingen.json');
  klantHoudingenCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return klantHoudingenCache;
}

/**
 * Get full attitude config from klant_houdingen.json
 */
function getAttitudeConfig(signal: CustomerSignal): any {
  const houdingen = loadKlantHoudingen();
  return houdingen.houdingen?.[signal] || null;
}

/**
 * Session state for V2 engine
 */
export interface V2SessionState {
  // Identifiers
  userId: string;
  sessionId: string;
  techniqueId: string;
  
  // Mode & Phase
  mode: HugoMode;
  currentMode: 'CONTEXT_GATHERING' | 'ROLEPLAY' | 'COACH_CHAT' | 'DEBRIEF';
  phase: number;
  
  // EPIC phase tracking - determines customer response depth and expected techniques
  // explore: Fact-based questions, no pijn/baat yet
  // probe: The P of ePic - hypothetical scenarios, awareness building  
  // impact: Impact questions, customer reveals pijn/baat
  // commit: Commitment questions, explicit confirmation
  epicPhase: EpicPhase;
  
  // Track which EPIC milestones have been achieved
  epicMilestones: {
    probeUsed: boolean;      // Has seller used probe/storytelling?
    impactAsked: boolean;    // Has seller asked impact questions?
    commitReady: boolean;    // Has customer expressed pijn/baat?
  };
  
  // Context
  context: ContextState;
  dialogueState: DialogueState;
  
  // Roleplay state
  persona: Persona;
  currentAttitude: CustomerSignal | null;  // null at turn 0 (customer hasn't spoken yet)
  turnNumber: number;
  conversationHistory: Array<{ role: 'seller' | 'customer'; content: string }>;
  
  // Customer Dynamics - evolving relationship state
  customerDynamics: CustomerDynamics;
  
  // Evaluation
  events: EvaluationEvent[];
  totalScore: number;
  
  // Expert Mode - for recording reference answers
  expertMode?: boolean;
}

/**
 * Engine response
 */
export interface EngineResponse {
  message: string;
  type: 'context_question' | 'customer_response' | 'coach_response' | 'feedback' | 'debrief';
  signal?: CustomerSignal;
  evaluation?: DetectionResult;
  sessionState: V2SessionState;
  coachMode?: boolean;
  ragDocuments?: number;
  promptsUsed?: {
    systemPrompt: string;
    userPrompt: string;
  };
  levelTransition?: LevelTransition;
  debug?: {
    prompt?: string;
    persona?: Persona;
    attitude?: CustomerSignal;
    sampledAttitude?: CustomerSignal;  // Original pre-sampled attitude (for debugging prompt effectiveness)
    expectedMoves?: string[];
    signal?: CustomerSignal;
    detectorPatterns?: string[];
    context?: Record<string, any>;
    promptUsed?: string;
    attitudeConfig?: {
      id: string;
      naam: string;
      signalen: string[];
      techniek_reactie: any;
      detection_patterns?: string[];
    };
    // Enhanced debug info
    customerDynamics?: CustomerDynamics;
    epicPhase?: EpicPhase;
    evaluationQuality?: 'goed' | 'bijna' | 'niet';
    dynamicsLevels?: {
      rapport: string;
      valueTension: string;
      commitReadiness: string;
    };
    // Validator/Repair debug info (AI Freedom Philosophy v4.0)
    validatorInfo?: ValidatorDebugInfo;
    // V3 Orchestrator gate check result
    gateResult?: GateCheckResult;
  };
}

/**
 * Existing user context from database
 */
export interface ExistingUserContext {
  sector?: string | null;
  product?: string | null;
  klantType?: string | null;
  setting?: string | null;
}

/**
 * Initialize a new V2 session with optional pre-loaded context
 */
export function initSession(
  userId: string,
  sessionId: string,
  techniqueId: string,
  existingContext?: ExistingUserContext
): V2SessionState {
  const mode = getMode(techniqueId);
  const phase = getPhase(techniqueId);
  const context = createContextState(userId, sessionId, techniqueId);
  
  // Generate RANDOM persona for variety - each session gets a different customer type
  const personaParams = generateRandomPersonaParams();
  const persona = buildPersona(
    personaParams.behaviorStyle,
    personaParams.buyingClockStage,
    personaParams.experienceLevel,
    personaParams.difficultyLevel
  );
  console.log(`[roleplay-engine] Generated random persona: ${personaParams.behaviorStyle}/${personaParams.buyingClockStage}/${personaParams.experienceLevel}/${personaParams.difficultyLevel}`);
  
  // Initialize customer dynamics based on persona
  const resolvedPersona: ResolvedPersona = {
    behavior_style: personaParams.behaviorStyle,
    buying_clock_stage: personaParams.buyingClockStage,
    experience_level: personaParams.experienceLevel,
    difficulty_level: personaParams.difficultyLevel
  };
  const personaTemplates = loadPersonaTemplates();
  const customerDynamics = initializeCustomerDynamics(resolvedPersona, personaTemplates);
  console.log(`[roleplay-engine] Initial dynamics: rapport=${customerDynamics.rapport.toFixed(2)}, valueTension=${customerDynamics.valueTension.toFixed(2)}, commitReadiness=${customerDynamics.commitReadiness.toFixed(2)}`);
  
  // Pre-fill context from database if available
  if (existingContext) {
    if (existingContext.sector) {
      context.gathered['sector'] = existingContext.sector;
      context.questionsAnswered.push('sector');
    }
    if (existingContext.product) {
      context.gathered['product'] = existingContext.product;
      context.questionsAnswered.push('product');
    }
    if (existingContext.klantType) {
      context.gathered['klant_type'] = existingContext.klantType;
      context.questionsAnswered.push('klant_type');
    }
    if (existingContext.setting) {
      context.gathered['verkoopkanaal'] = existingContext.setting;
      context.questionsAnswered.push('verkoopkanaal');
    }
    
    // NOTE: Do NOT set context.isComplete=true here even if all base slots are pre-filled
    // The lens phase (strategic questioning) must still run after base slots complete
    // isComplete will be set to true only after lens phase completes in processAnswer()
  }
  
  // Set initial mode based on context completeness and roleplay capability
  let currentMode: 'CONTEXT_GATHERING' | 'ROLEPLAY' | 'COACH_CHAT' | 'DEBRIEF';
  if (context.isComplete) {
    // Check if technique supports roleplay
    if (canRoleplay(techniqueId)) {
      currentMode = 'ROLEPLAY';
    } else {
      currentMode = 'COACH_CHAT'; // Pure coaching for non-roleplay techniques
    }
  } else {
    currentMode = 'CONTEXT_GATHERING';
  }
  
  return {
    userId,
    sessionId,
    techniqueId,
    mode,
    currentMode,
    phase,
    epicPhase: getInitialEpicPhase(techniqueId), // V3: Use orchestrator config, fallback to 'explore'
    epicMilestones: {
      probeUsed: false,
      impactAsked: false,
      commitReady: false
    },
    context,
    dialogueState: createDialogueState(),
    persona,
    currentAttitude: null, // null at start - customer hasn't spoken yet
    turnNumber: 0,
    conversationHistory: [],
    customerDynamics,
    events: [],
    totalScore: 0,
    expertMode: false // Will be set by routes.ts if expert mode is enabled
  };
}

/**
 * Get opening message for a session
 * 
 * AI Freedom Philosophy: Opening is fully AI-generated based on:
 * - Technique theme and intent
 * - Historical context about this seller
 * - Hugo's persona
 */
export async function getOpeningMessage(state: V2SessionState, userId: string = 'demo-user'): Promise<EngineResponse> {
  // Context gathering happens for ALL modes if context is not complete
  // The currentMode is already correctly set in initSession() based on context.isComplete
  // - If context.isComplete=false → currentMode=CONTEXT_GATHERING
  // - If context.isComplete=true → currentMode=COACH_CHAT or ROLEPLAY
  
  if (state.currentMode === 'CONTEXT_GATHERING') {
    const nextSlotKey = getNextSlotKey(state.context);
    
    if (nextSlotKey) {
      // AI Freedom Philosophy: Generate the opening question dynamically
      // No static templates, no placeholder text
      // v7.0: Pass techniqueId for coaching_lens integration
      
      // Convert conversationHistory to the format expected by generateQuestionForSlot
      const contextHistory = state.conversationHistory.map(msg => ({
        role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content
      }));
      
      // Generate question for the next slot
      // generateQuestionForSlot returns HugoResponseResult {message, validatorInfo}
      const result = await generateQuestionForSlot(
        nextSlotKey,
        state.context.gathered,
        state.techniqueId,
        contextHistory
      );
      
      // Extract the message string from the result
      const generatedQuestion = result.message;
      
      // Store AI question in conversationHistory for continuity across modes
      const updatedHistory = [
        ...state.conversationHistory,
        { role: 'customer' as const, content: generatedQuestion }
      ];
      
      return {
        message: generatedQuestion,
        type: 'context_question',
        sessionState: {
          ...state,
          context: { ...state.context, currentQuestionKey: nextSlotKey },
          conversationHistory: updatedHistory
        },
        promptsUsed: result.promptsUsed
      };
    }
  }
  
  // If context is already complete, check roleplay capability
  if (state.currentMode === 'COACH_CHAT' || !canRoleplay(state.techniqueId)) {
    return startCoachChat(state);
  }
  
  return await startRoleplay(state);
}

/**
 * Process user input
 */
export async function processInput(
  state: V2SessionState,
  userMessage: string,
  enableDebug: boolean = false
): Promise<EngineResponse> {
  
  switch (state.currentMode) {
    case 'CONTEXT_GATHERING':
      return processContextAnswer(state, userMessage);
      
    case 'ROLEPLAY':
      return processSellerMessage(state, userMessage, enableDebug);
      
    case 'COACH_CHAT':
      return processCoachMessage(state, userMessage);
      
    case 'DEBRIEF':
      return processDebriefMessage(state, userMessage);
      
    default:
      return {
        message: getConfigText('templates.errors.unknown_mode'),
        type: 'feedback',
        sessionState: state
      };
  }
}

/**
 * Validate a context answer - returns error message if invalid, null if valid
 */
function validateContextAnswer(answer: string, questionKey: string): string | null {
  const trimmed = answer.trim();
  
  // Check minimum length (at least 2 meaningful characters)
  if (trimmed.length < 2) {
    return getConfigText('templates.roleplay.validation.too_short');
  }
  
  // Check maximum length (prevent spam)
  if (trimmed.length > 500) {
    return getConfigText('templates.roleplay.validation.too_long');
  }
  
  // Check for gibberish: must contain mostly letters and spaces
  const lettersAndSpaces = (trimmed.match(/[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ\s]/g) || []).length;
  const total = trimmed.length;
  const cleanRatio = lettersAndSpaces / total;
  
  // If less than 80% letters+spaces, probably gibberish (allows for hyphens, apostrophes in names)
  if (cleanRatio < 0.8 && total > 3) {
    return getConfigText('templates.roleplay.validation.gibberish');
  }
  
  // Check for repeated characters (keyboard mashing like "aaaaaaa" or "asdfasdf")
  const repeatedPattern = /(.)\1{4,}|(.{2,4})\2{2,}/;
  if (repeatedPattern.test(trimmed.toLowerCase())) {
    return getConfigText('templates.roleplay.validation.repeated_chars');
  }
  
  // Check for random case mixing (like "kJfPsL" - unlikely in normal text)
  const words = trimmed.split(/\s+/);
  const suspiciousWords = words.filter(word => {
    if (word.length < 4) return false;
    // Count case switches within word
    let switches = 0;
    for (let i = 1; i < word.length; i++) {
      const prevIsUpper = word[i-1] === word[i-1].toUpperCase() && word[i-1] !== word[i-1].toLowerCase();
      const currIsUpper = word[i] === word[i].toUpperCase() && word[i] !== word[i].toLowerCase();
      if (prevIsUpper !== currIsUpper) switches++;
    }
    // More than 2 case switches in a single word is suspicious
    return switches > 2;
  });
  
  if (suspiciousWords.length > 0 && trimmed.length > 5) {
    return getConfigText('templates.roleplay.validation.gibberish');
  }
  
  // All checks passed
  return null;
}

// Expert mode: max 3 context slots per session to avoid overwhelming users
const EXPERT_MODE_SLOT_LIMIT = 3;

/**
 * Process context gathering answer using AI-based dialogue
 * 
 * DUAL-PHASE ARCHITECTURE (v8.0):
 * 1. BASE PHASE: Collects universal context (sector, product, verkoopkanaal, klant_type)
 * 2. LENS PHASE: Strategic questioning using coaching_lens dimensions
 * 
 * Two-layer AI approach:
 * Layer 1: interpretAnswer() - classify user response (accept/clarify/unusable)
 * Layer 2: generateHugoResponse() - generate Hugo's next utterance
 */
async function processContextAnswer(
  state: V2SessionState,
  answer: string
): Promise<EngineResponse> {
  const currentKey = state.context.currentQuestionKey;
  
  if (!currentKey) {
    return await startRoleplay(state);
  }
  
  // Determine expert mode slot limit (skips lens phase)
  const slotLimit = state.expertMode ? EXPERT_MODE_SLOT_LIMIT : undefined;
  
  // Check if current slot is a lens slot
  const isCurrentLensSlot = isLensSlot(currentKey);
  
  // Get current question text from config (for base slots only)
  const currentQ = !isCurrentLensSlot 
    ? getQuestionsForTechnique(state.techniqueId).find(q => q.key === currentKey)
    : null;
  const questionText = currentQ?.question || currentKey;
  
  // AI Layer 1: Interpret the answer
  const interpretation = await interpretAnswer(currentKey, questionText, answer);
  
  if (interpretation.decision === 'accept') {
    // Store the extracted value (or original if not extracted)
    const valueToStore = interpretation.extractedValue || answer.trim();
    const newContext = processAnswer(state.context, currentKey, valueToStore, slotLimit);
    
    // Add user answer to conversation history for continuity across modes
    const historyWithUserAnswer = [
      ...state.conversationHistory,
      { role: 'seller' as const, content: answer }
    ];
    
    const newState = { ...state, context: newContext, conversationHistory: historyWithUserAnswer };
    
    // Check if we need more questions - use getNextSlotKey for dual-phase support
    const nextSlotKey = getNextSlotKey(newContext, slotLimit);
    
    if (nextSlotKey && !newContext.isComplete) {
      // Check if next slot is a lens slot - generate question dynamically
      if (isLensSlot(nextSlotKey)) {
        console.log(`[roleplay-engine] Transitioning to lens phase: ${nextSlotKey}`);
        
        // Convert conversation history for generateQuestionForSlot
        const contextHistory = historyWithUserAnswer.map(msg => ({
          role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content
        }));
        
        // Expert mode: include full prompts for debugging
        if (state.expertMode) {
          const result = await generateQuestionForSlot(
            nextSlotKey,
            newContext.gathered,
            state.techniqueId,
            contextHistory
          );
          
          // Add AI question to history
          const updatedHistory = [
            ...historyWithUserAnswer,
            { role: 'customer' as const, content: result.message }
          ];
          
          return {
            message: result.message,
            type: 'context_question',
            sessionState: {
              ...newState,
              context: { ...newContext, currentQuestionKey: nextSlotKey, lensPhase: true },
              conversationHistory: updatedHistory
            },
            promptsUsed: result.promptsUsed
          };
        }
        
        // Generate lens question using AI with coaching_lens + conversation history
        const lensResult = await generateQuestionForSlot(
          nextSlotKey,
          newContext.gathered,
          state.techniqueId,
          contextHistory
        );
        const lensQuestion = lensResult.message;
        
        // Add AI question to history
        const updatedHistory = [
          ...historyWithUserAnswer,
          { role: 'customer' as const, content: lensQuestion }
        ];
        
        return {
          message: lensQuestion,
          type: 'context_question',
          sessionState: {
            ...newState,
            context: { ...newContext, currentQuestionKey: nextSlotKey, lensPhase: true },
            conversationHistory: updatedHistory
          },
          promptsUsed: lensResult.promptsUsed
        };
      }
      
      // Base slot - use existing flow with getNextQuestion
      const nextQ = getNextQuestion(newContext);
      if (nextQ) {
        // AI Layer 2: Generate Hugo's response to transition to next question
        const situation = applyDialogueTemplate('transition_situation', {
          answer: valueToStore,
          slot: currentKey,
          next_slot: nextQ.key
        });
        const task = applyDialogueTemplate('transition_task', {
          next_question: nextQ.question
        });
        
        // Convert conversation history for generateHugoResponse
        const contextHistory = historyWithUserAnswer.map(msg => ({
          role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content
        }));
        
        // Build historical context for validator
        const validatorContext = await formatValidatorContext(state.userId, state.techniqueId, contextHistory);
        const historicalContext = buildValidatorContextString(validatorContext);
        
        const hugoResult = await generateHugoResponse(situation, task, {
          conversationHistory: contextHistory,
          historicalContext
        });
        
        // Add AI question to history
        const updatedHistory = [
          ...historyWithUserAnswer,
          { role: 'customer' as const, content: hugoResult.message }
        ];
        
        return {
          message: hugoResult.message,
          type: 'context_question',
          sessionState: {
            ...newState,
            context: { ...newContext, currentQuestionKey: nextQ.key },
            conversationHistory: updatedHistory
          },
          debug: hugoResult.validatorInfo ? { validatorInfo: hugoResult.validatorInfo } : undefined,
          promptsUsed: hugoResult.promptsUsed
        };
      }
    }
    
    // Context complete (both base and lens phases)
    console.log(`[roleplay-engine] Context gathering complete. Base slots: ${newContext.questionsAnswered.length}, Lens slots: ${newContext.lensQuestionsAsked.length}`);
    
    if (!canRoleplay(newState.techniqueId)) {
      return startCoachChat(newState);
    }
    return await startRoleplay(newState);
  }
  
  if (interpretation.decision === 'clarify') {
    // Check if max clarifications reached
    if (hasReachedMaxClarifications(state.dialogueState, currentKey)) {
      // Skip this slot
      const fallbackMsg = getFallbackAfterMax();
      const newContext = processAnswer(state.context, currentKey, '[overgeslagen]', slotLimit);
      const newState = { ...state, context: newContext };
      
      // Use getNextSlotKey for dual-phase support
      const nextSlotKey = getNextSlotKey(newContext, slotLimit);
      if (nextSlotKey && !newContext.isComplete) {
        // Generate next question - handle lens slots dynamically with conversation history
        let nextQuestion: string;
        if (isLensSlot(nextSlotKey)) {
          const contextHistory = state.conversationHistory.map(msg => ({
            role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: msg.content
          }));
          const nextResult = await generateQuestionForSlot(
            nextSlotKey,
            newContext.gathered,
            state.techniqueId,
            contextHistory
          );
          nextQuestion = nextResult.message;
        } else {
          const nextQ = getNextQuestion(newContext);
          nextQuestion = nextQ?.question || 'Vertel me meer.';
        }
        
        return {
          message: `${fallbackMsg} ${nextQuestion}`,
          type: 'context_question',
          sessionState: {
            ...newState,
            context: { ...newContext, currentQuestionKey: nextSlotKey }
          }
        };
      }
      
      if (!canRoleplay(newState.techniqueId)) {
        return startCoachChat(newState);
      }
      return await startRoleplay(newState);
    }
    
    // Increment clarification count
    const newDialogueState = incrementClarificationCount(state.dialogueState, currentKey);
    
    // AI Layer 2: Generate clarification response (AI Freedom Philosophy)
    // For lens slots, re-generate the question with context + conversation history
    if (isCurrentLensSlot) {
      // Include conversation history so Hugo can respond to what user said
      const contextHistory = state.conversationHistory.map(msg => ({
        role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content
      }));
      // Add the current answer to history
      contextHistory.push({ role: 'user', content: answer });
      
      const lensResult = await generateQuestionForSlot(
        currentKey,
        state.context.gathered,
        state.techniqueId,
        contextHistory
      );
      const lensQuestion = lensResult.message;
      
      return {
        message: `${lensQuestion}`,
        type: 'context_question',
        sessionState: {
          ...state,
          dialogueState: newDialogueState,
          conversationHistory: [
            ...state.conversationHistory,
            { role: 'seller' as const, content: answer },
            { role: 'customer' as const, content: lensQuestion }
          ]
        },
        promptsUsed: lensResult.promptsUsed
      };
    }
    
    const theme = getThemeForSlot(currentKey);
    const situation = applyDialogueTemplate('clarify_situation', {
      answer: answer,
      question: questionText
    });
    const task = applyDialogueTemplate('clarify_task', {
      template: `Vraag naar: ${theme.theme}. Intent: ${theme.intent}`
    });
    
    // Convert conversation history for generateHugoResponse
    const clarifyHistory = state.conversationHistory.map(msg => ({
      role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content
    }));
    clarifyHistory.push({ role: 'user', content: answer });
    
    // Build historical context for validator
    const validatorCtx = await formatValidatorContext(state.userId, state.techniqueId, clarifyHistory);
    const histCtx = buildValidatorContextString(validatorCtx);
    
    const hugoResult = await generateHugoResponse(situation, task, {
      conversationHistory: clarifyHistory,
      historicalContext: histCtx
    });
    
    return {
      message: hugoResult.message,
      type: 'context_question',
      sessionState: {
        ...state,
        dialogueState: newDialogueState,
        conversationHistory: [
          ...state.conversationHistory,
          { role: 'seller' as const, content: answer },
          { role: 'customer' as const, content: hugoResult.message }
        ]
      },
      debug: hugoResult.validatorInfo ? { validatorInfo: hugoResult.validatorInfo } : undefined,
      promptsUsed: hugoResult.promptsUsed
    };
  }
  
  // interpretation.decision === 'unusable'
  // Check if max clarifications reached - if so, just accept what we have and move on
  if (hasReachedMaxClarifications(state.dialogueState, currentKey)) {
    // Accept whatever we got and move to next question
    const newContext = processAnswer(state.context, currentKey, answer || '[geen antwoord]', slotLimit);
    const newState = { ...state, context: newContext };
    
    // Use getNextSlotKey for dual-phase support
    const nextSlotKey = getNextSlotKey(newContext, slotLimit);
    if (nextSlotKey && !newContext.isComplete) {
      // Generate next question - handle lens slots dynamically with conversation history
      let nextQuestion: string;
      if (isLensSlot(nextSlotKey)) {
        const contextHistory = state.conversationHistory.map(msg => ({
          role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content
        }));
        const nextResult = await generateQuestionForSlot(
          nextSlotKey,
          newContext.gathered,
          state.techniqueId,
          contextHistory
        );
        nextQuestion = nextResult.message;
      } else {
        const nextQ = getNextQuestion(newContext);
        nextQuestion = nextQ?.question || 'Vertel me meer.';
      }
      
      return {
        message: nextQuestion,
        type: 'context_question',
        sessionState: {
          ...newState,
          context: { ...newContext, currentQuestionKey: nextSlotKey }
        }
      };
    }
    
    // Context complete - start roleplay
    if (!canRoleplay(newState.techniqueId)) {
      return startCoachChat(newState);
    }
    return await startRoleplay(newState);
  }
  
  // Use AI Layer 2 for a natural response (AI Freedom Philosophy)
  const newDialogueState = incrementClarificationCount(state.dialogueState, currentKey);
  
  // For lens slots, re-generate the question with context + conversation history
  if (isCurrentLensSlot) {
    // Include conversation history so Hugo can respond to what user said
    const contextHistory = state.conversationHistory.map(msg => ({
      role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content
    }));
    contextHistory.push({ role: 'user', content: answer });
    
    const lensResult = await generateQuestionForSlot(
      currentKey,
      state.context.gathered,
      state.techniqueId,
      contextHistory
    );
    const lensQuestion = lensResult.message;
    
    return {
      message: lensQuestion,
      type: 'context_question',
      sessionState: {
        ...state,
        dialogueState: newDialogueState
      }
    };
  }
  
  const themeForSlot = getThemeForSlot(currentKey);
  const situation = applyDialogueTemplate('clarify_situation', {
    answer: answer,
    question: questionText
  });
  const task = applyDialogueTemplate('clarify_task', {
    template: `Vraag naar: ${themeForSlot.theme}. Intent: ${themeForSlot.intent}`
  });
  
  // Convert conversation history for generateHugoResponse
  const unusableHistory = state.conversationHistory.map(msg => ({
    role: (msg.role === 'seller' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: msg.content
  }));
  unusableHistory.push({ role: 'user', content: answer });
  
  // Build historical context for validator
  const unusableValidatorCtx = await formatValidatorContext(state.userId, state.techniqueId, unusableHistory);
  const unusableHistCtx = buildValidatorContextString(unusableValidatorCtx);
  
  const hugoResult = await generateHugoResponse(situation, task, {
    conversationHistory: unusableHistory,
    historicalContext: unusableHistCtx
  });
  
  return {
    message: hugoResult.message,
    type: 'context_question',
    sessionState: {
      ...state,
      dialogueState: newDialogueState,
      conversationHistory: [
        ...state.conversationHistory,
        { role: 'seller' as const, content: answer },
        { role: 'customer' as const, content: hugoResult.message }
      ]
    },
    debug: hugoResult.validatorInfo ? { validatorInfo: hugoResult.validatorInfo } : undefined
  };
}

/**
 * Start pure coach chat mode (for roleplay_capable: false techniques)
 */
async function startCoachChat(state: V2SessionState): Promise<EngineResponse> {
  const technique = getTechnique(state.techniqueId);
  const techniqueName = technique?.naam || state.techniqueId;
  const context = state.context.gathered;
  
  // Generate dynamic opening using AI + RAG (unique per session/technique)
  // Pass userId and full sessionContext for merged context, historical scores, personalized examples
  // Also pass contextGatheringHistory so Hugo knows what was already discussed
  const coachContext = {
    techniqueId: state.techniqueId,
    techniqueName,
    userId: state.userId,
    sessionContext: context,
    sector: context.sector,
    product: context.product,
    klantType: context.klant_type || context.klantType,
    contextGatheringHistory: state.conversationHistory, // Pass conversation history for continuity
  };
  
  const coachResponse = await generateCoachOpening(coachContext);
  
  return {
    message: coachResponse.message,
    type: 'coach_response',
    coachMode: true,
    ragDocuments: coachResponse.ragContext?.length || 0,
    promptsUsed: coachResponse.promptsUsed,
    sessionState: {
      ...state,
      currentMode: 'COACH_CHAT',
    }
  };
}

/**
 * Process coach chat message
 * 
 * FIX: Now properly tracks turns and can transition to ROLEPLAY mode
 * when user requests roleplay practice
 */
async function processCoachMessage(
  state: V2SessionState,
  userMessage: string
): Promise<EngineResponse> {
  const technique = getTechnique(state.techniqueId);
  const techniqueName = technique?.naam || state.techniqueId;
  const context = state.context.gathered;
  
  // FIX: Check if user is requesting to start roleplay
  const roleplayTriggers = [
    'rollenspel', 'oefenen', 'practice', 'laten we oefenen',
    'start roleplay', 'begin rollenspel', 'wil oefenen', 'kan ik oefenen',
    'laat me oefenen', 'proberen', 'simulatie', 'scenario'
  ];
  const userLower = userMessage.toLowerCase();
  const wantsRoleplay = roleplayTriggers.some(t => userLower.includes(t));
  
  // If user wants roleplay AND technique supports it, check V3 gates first
  if (wantsRoleplay && canRoleplay(state.techniqueId)) {
    // V3.1: Load session artifacts for gate checking
    const sessionArtifacts = await getArtifactsMap(state.sessionId);
    
    // V3: Check orchestrator gates before allowing roleplay
    const gateResult = checkRoleplayGates(
      state.techniqueId,
      state.context.gathered,
      sessionArtifacts
    );
    
    if (!gateResult.allowed) {
      console.log(`[roleplay-engine] Roleplay gate failed: ${gateResult.gate_type} - ${gateResult.message}`);
      
      // Return coach response with gate denial message
      const newHistory = [
        ...state.conversationHistory,
        { role: 'seller' as const, content: userMessage },
        { role: 'customer' as const, content: gateResult.message || 'Roleplay is niet beschikbaar voor deze techniek.' }
      ];
      
      return {
        message: gateResult.message || 'Roleplay is niet beschikbaar voor deze techniek.',
        type: 'coach_response',
        coachMode: true,
        sessionState: {
          ...state,
          conversationHistory: newHistory,
        },
        debug: {
          gateResult
        }
      };
    }
    
    console.log(`[roleplay-engine] User requested roleplay, gates passed, transitioning from COACH_CHAT to ROLEPLAY`);
    
    // Mark context as complete (we have enough from the coaching conversation)
    const updatedContext = { ...state.context, isComplete: true };
    const updatedState = { ...state, context: updatedContext };
    
    return await startRoleplay(updatedState);
  }
  
  // Build conversation history from state
  const conversationHistory = state.conversationHistory.map(h => ({
    role: h.role === 'seller' ? 'user' as const : 'assistant' as const,
    content: h.content
  }));
  
  // Generate coach response using RAG
  // Pass userId and full sessionContext for merged context, historical scores, personalized examples
  const coachContext = {
    techniqueId: state.techniqueId,
    techniqueName,
    userId: state.userId,
    sessionContext: context,
    sector: context.sector,
    product: context.product,
    klantType: context.klant_type || context.klantType,
  };
  
  const coachResponse = await generateCoachResponse(
    userMessage,
    conversationHistory,
    coachContext
  );
  
  // Update conversation history
  const newHistory = [
    ...state.conversationHistory,
    { role: 'seller' as const, content: userMessage },
    { role: 'customer' as const, content: coachResponse.message } // Using customer role for assistant messages
  ];
  
  // FIX: Increment turn counter even in coach mode to track conversation length
  const newTurnNumber = state.turnNumber + 1;
  
  return {
    message: coachResponse.message,
    type: 'coach_response',
    coachMode: true,
    ragDocuments: coachResponse.ragContext?.length || 0,
    promptsUsed: coachResponse.promptsUsed,
    sessionState: {
      ...state,
      conversationHistory: newHistory,
      turnNumber: newTurnNumber, // FIX: Track turns in coach mode
    },
    // Pass through validatorInfo from coach-engine for debug panel
    debug: coachResponse.validatorInfo ? { validatorInfo: coachResponse.validatorInfo } : undefined
  };
}

/**
 * Generate roleplay opening using AI
 * 
 * AI Freedom Philosophy: Lightweight theme+intent prompt.
 * No static sentences, no heavy coaching prompts.
 * Includes timeout guardrail for latency budget.
 */
async function generateRoleplayOpening(
  techniqueName: string,
  klantType: string,
  sectorPhrase: string,
  product: string
): Promise<string> {
  const openai = getOpenAI();
  
  // Lightweight system prompt - theme + intent only, no scripted sentences
  const systemPrompt = `Je bent Hugo Herbots, sales coach. Genereer een korte openingszin om een rollenspel te starten. Wees direct, informeel, en nodig uit om te beginnen.`;
  
  const userPrompt = `THEMA: Rollenspel starten voor "${techniqueName}"
CONTEXT: ${klantType} ${sectorPhrase}, product: ${product}
INTENT: Zet kort de scene, zeg dat jij de klant speelt, en nodig uit om te starten.`;

  try {
    // Guaranteed timeout using Promise.race (3 seconds max)
    const TIMEOUT_MS = 3000;
    const startTime = Date.now();
    
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
    );
    
    // AI Freedom: Use temperature for variation (requires reasoning_effort='none')
    const completionPromise = openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_completion_tokens: 100,
      reasoning_effort: 'none', // Disable reasoning to enable temperature
      temperature: 0.8 // Higher temperature for more varied openings
    } as any); // Type assertion needed for reasoning_effort
    
    const response = await Promise.race([completionPromise, timeoutPromise]);
    
    // Log latency for monitoring
    const latencyMs = Date.now() - startTime;
    console.log(`[ROLEPLAY] Opening generated in ${latencyMs}ms`);
    
    if (response) {
      const content = response.choices[0]?.message?.content;
      if (content) {
        return content.trim();
      }
    }
  } catch (error: any) {
    if (error?.message === 'TIMEOUT') {
      console.warn("[ROLEPLAY] Opening generation timed out (>3s), using fallback");
    } else {
      console.error("[ROLEPLAY] Error generating opening:", error);
    }
  }
  
  // Technical fallback - minimal functional text
  return "We gaan oefenen. Ik speel de klant. Start het gesprek.";
}

/**
 * Format sector for grammatically correct Dutch
 * "vastgoed" → "in vastgoed" (no article needed)
 * "automotive" → "in de automotive" 
 * "de bouw" → "in de bouw" (already has article)
 */
function formatSectorPhrase(sector: string): string {
  if (!sector) return 'in jouw sector';
  
  const lowerSector = sector.toLowerCase().trim();
  
  // Sectors that don't need an article
  const noArticleSectors = ['vastgoed', 'horeca', 'retail', 'transport', 'logistiek'];
  if (noArticleSectors.some(s => lowerSector.includes(s))) {
    return `in ${sector}`;
  }
  
  // Already has article
  if (lowerSector.startsWith('de ') || lowerSector.startsWith('het ')) {
    return `in ${sector}`;
  }
  
  // Default: add "de" article
  return `in de ${sector}`;
}

/**
 * Start roleplay mode
 * 
 * AI Freedom Philosophy: Opening is generated dynamically by AI.
 * No static sentences - AI generates fresh opening based on context.
 */
async function startRoleplay(state: V2SessionState): Promise<EngineResponse> {
  // Use the persona that was already generated at session init (random per session)
  const persona = state.persona;
  
  // DON'T sample attitude yet - wait for seller's first message
  // Customer hasn't spoken, so no attitude/signal should be shown
  
  // Build opening scenario description
  const context = state.context.gathered;
  const sector = context.sector || 'jouw sector';
  const product = context.product || 'jouw product';
  const klantType = context.klant_type || 'een potentiële klant';
  
  const technique = getTechnique(state.techniqueId);
  const techniqueName = technique?.naam || state.techniqueId;
  
  // Use helper for grammatically correct Dutch
  const sectorPhrase = formatSectorPhrase(sector);
  
  // AI Freedom Philosophy: Generate the roleplay opening dynamically
  const openingMessage = await generateRoleplayOpening(
    techniqueName,
    klantType,
    sectorPhrase,
    product
  );
  
  return {
    message: openingMessage,
    type: 'customer_response',
    // NO signal - customer hasn't spoken yet, this is just scene-setting
    sessionState: {
      ...state,
      currentMode: 'ROLEPLAY',
      persona,
      currentAttitude: null, // No attitude until customer actually responds
      turnNumber: 0
    }
  };
}

/**
 * Check if a technique ID matches a target (exact or parent match)
 * e.g., "2.2.1" matches "2.2", "2.1.1.1" matches "2.1.1" and "2.1"
 */
function techniqueMatches(detectedId: string, targetId: string): boolean {
  if (!detectedId) return false;
  if (detectedId === targetId) return true;
  // Check if detected is a subtechnique of target
  return detectedId.startsWith(targetId + '.');
}

/**
 * Determine EPIC phase based on detected techniques
 * Returns updated epicPhase and epicMilestones
 * Now handles both single moveId and techniques array from evaluator
 */
function updateEpicState(
  currentEpicPhase: EpicPhase,
  currentMilestones: V2SessionState['epicMilestones'],
  detectedTechniqueId: string | null,
  techniques?: Array<{ id: string; naam: string; quality: string }>
): { epicPhase: EpicPhase; epicMilestones: V2SessionState['epicMilestones'] } {
  const milestones = { ...currentMilestones };
  let epicPhase = currentEpicPhase;
  
  // Collect all detected technique IDs
  const allDetectedIds: string[] = [];
  if (detectedTechniqueId) {
    allDetectedIds.push(detectedTechniqueId);
  }
  if (techniques && techniques.length > 0) {
    for (const t of techniques) {
      if (t.id && !allDetectedIds.includes(t.id)) {
        allDetectedIds.push(t.id);
      }
    }
  }
  
  if (allDetectedIds.length === 0) {
    return { epicPhase, epicMilestones: milestones };
  }
  
  // Check each detected technique for EPIC phase triggers
  for (const techId of allDetectedIds) {
    // Probe techniques: 2.2 and subtechniques (storytelling)
    if (techniqueMatches(techId, '2.2')) {
      milestones.probeUsed = true;
      if (epicPhase === 'explore') {
        epicPhase = 'probe';
      }
    }
    
    // Impact techniques: 2.3 and subtechniques (impact question)
    if (techniqueMatches(techId, '2.3')) {
      milestones.impactAsked = true;
      milestones.commitReady = true; // Customer has now expressed pijn/baat
      if (epicPhase === 'explore' || epicPhase === 'probe') {
        epicPhase = 'impact';
      }
    }
    
    // Commitment: 2.4 - only advance if impact was asked
    if (techniqueMatches(techId, '2.4') && milestones.impactAsked) {
      epicPhase = 'commit';
    }
  }
  
  return { epicPhase, epicMilestones: milestones };
}

/**
 * Process seller message during roleplay
 */
async function processSellerMessage(
  state: V2SessionState,
  sellerMessage: string,
  enableDebug: boolean
): Promise<EngineResponse> {
  
  // IMPORTANT: Evaluate FIRST against the PREVIOUS attitude (what the customer showed last turn)
  // The seller is responding to what the customer just said, not to what they will say next
  const previousAttitude = state.currentAttitude;
  const isFirstTurn = state.turnNumber === 0;
  
  // Only evaluate if we have a previous attitude to evaluate against (not first turn)
  // On first turn, check if seller is using valid Explore techniques
  let evaluation: DetectionResult;
  
  // Get last customer message for context in evaluation
  const lastCustomerMessage = state.conversationHistory
    .filter(h => h.role === 'customer')
    .pop()?.content || '';
  
  if (isFirstTurn || !previousAttitude) {
    // First turn or no previous attitude: Check if seller is asking valid Explore questions
    // Don't penalize - just detect if they're using good techniques
    evaluation = evaluateFirstTurn(sellerMessage, state.techniqueId, state.phase);
  } else {
    // Subsequent turns: Evaluate conceptually against previous customer attitude
    // Pass epicPhase so evaluator can filter allExpected appropriately
    evaluation = await evaluateConceptually(
      sellerMessage,
      lastCustomerMessage,
      previousAttitude,
      state.techniqueId,
      state.phase,
      state.epicPhase
    );
  }
  
  // Update EPIC state based on detected techniques (including all from techniques array)
  const { epicPhase: newEpicPhase, epicMilestones: newMilestones } = updateEpicState(
    state.epicPhase,
    state.epicMilestones,
    evaluation.moveId,
    evaluation.techniques
  );
  
  // NOW sample new attitude for customer's response using persona's 4-axis weights
  // Apply verkoper-kwaliteit modifier: good technique -> more positive, poor -> more negative
  const evaluationQuality = evaluation.quality || 'bijna';
  const attitude = sampleAttitude(state.phase, state.techniqueId, state.persona, evaluationQuality);
  
  // Update customer dynamics based on evaluation quality and detected themes
  // Extract detected theme from evaluation (e.g., "Motivatie" from "2.1.1.2 - Motivatie")
  const detectedThema = evaluation.moveLabel?.match(/- (Bron|Motivatie|Ervaring|Verwachtingen|Alternatieven|Budget|Timing|Beslissingscriteria)/)?.[1];
  
  const updatedDynamics = updateCustomerDynamics(
    state.customerDynamics,
    evaluationQuality as 'perfect' | 'goed' | 'bijna' | 'niet' | 'gemist',
    newEpicPhase,
    detectedThema
  );
  console.log(`[roleplay-engine] Dynamics update: quality=${evaluationQuality}, thema=${detectedThema || 'none'}, rapport=${updatedDynamics.rapport.toFixed(2)}, valueTension=${updatedDynamics.valueTension.toFixed(2)}, commitReadiness=${updatedDynamics.commitReadiness.toFixed(2)}`);
  
  // Generate customer response with the new attitude, EPIC phase, AND dynamics
  // This determines what kind of response the customer can give (facts only vs pijn/baat)
  const customerResponse = await generateCustomerResponse(
    state.context,
    state.persona,
    attitude,
    sellerMessage,
    state.conversationHistory,
    newEpicPhase,
    updatedDynamics
  );
  
  // POST-GENERATION SIGNAL CLASSIFICATION
  // The AI may generate a response that doesn't match the instructed attitude.
  // Classify the actual response to get the real signal.
  const classifiedAttitude = classifySignalFromResponse(
    customerResponse.message,
    attitude,  // sampled attitude as fallback/prior
    state.phase
  );
  
  // Log if there was a mismatch (for debugging prompt effectiveness)
  if (classifiedAttitude !== attitude) {
    console.log(`[roleplay-engine] Signal correction: sampled=${attitude}, classified=${classifiedAttitude} for: "${customerResponse.message.substring(0, 50)}..."`);
  }
  
  // Log evaluation event
  const event: EvaluationEvent = {
    timestamp: new Date(),
    turnNumber: state.turnNumber + 1,
    customerSignal: previousAttitude || 'positief', // What seller was responding to (positief as fallback for first turn)
    sellerMessage,
    detected: evaluation.detected,
    expectedMoves: evaluation.allExpected.map(m => normalizeExpectedMove(m.label)),
    detectedMove: evaluation.moveLabel,
    score: evaluation.score
  };
  
  // Update conversation history
  const newHistory = [
    ...state.conversationHistory,
    { role: 'seller' as const, content: sellerMessage },
    { role: 'customer' as const, content: customerResponse.message }
  ];
  
  // Build response - use classifiedAttitude (actual detected signal)
  const response: EngineResponse = {
    message: customerResponse.message,
    type: 'customer_response',
    signal: classifiedAttitude,
    evaluation,
    sessionState: {
      ...state,
      epicPhase: newEpicPhase,
      epicMilestones: newMilestones,
      currentAttitude: classifiedAttitude,
      turnNumber: state.turnNumber + 1,
      conversationHistory: newHistory,
      customerDynamics: updatedDynamics,
      events: [...state.events, event],
      totalScore: state.totalScore + evaluation.score
    }
  };
  
  // Add debug info if enabled or expertMode is on
  if (enableDebug || state.expertMode) {
    const attitudeConfig = getAttitudeConfig(classifiedAttitude);
    
    // Use ONLY evaluator.allExpected (already filtered by EPIC phase via SSOT)
    // klant_houdingen.json is for detection/attitude only, not for expectation scaffolding
    const normalizedMoves = evaluation.allExpected
      .map(m => normalizeExpectedMove(m.label));
    const deduplicatedMoves = deduplicateExpectedMoves(normalizedMoves);
    
    // Helper to convert dynamics value to level label (from config - STRICT mode)
    const dynamicsConfig = loadCustomerDynamicsConfig();
    if (!dynamicsConfig.level_labels || !dynamicsConfig.level_labels.low || !dynamicsConfig.level_labels.medium || !dynamicsConfig.level_labels.high) {
      throw new Error('[STRICT] customer_dynamics.json missing required level_labels (low, medium, high)');
    }
    const levelLabels = dynamicsConfig.level_labels;
    const getDynamicsLevel = (value: number, lowThreshold: number, highThreshold: number): string => {
      if (value < lowThreshold) return levelLabels.low;
      if (value > highThreshold) return levelLabels.high;
      return levelLabels.medium;
    };
    
    response.debug = {
      persona: state.persona,
      attitude: classifiedAttitude,
      signal: classifiedAttitude,
      sampledAttitude: attitude,  // Keep original for debugging prompt effectiveness
      expectedMoves: deduplicatedMoves,
      detectorPatterns: attitudeConfig?.detection_patterns || [],
      context: {
        sector: state.context.gathered['sector'],
        product: state.context.gathered['product'],
        klant_type: state.context.gathered['klant_type'],
        verkoopkanaal: state.context.gathered['verkoopkanaal'],
        isComplete: state.context.isComplete,
        turnNumber: state.turnNumber + 1,
        phase: state.phase,
        techniqueId: state.techniqueId,
      },
      promptUsed: `Customer prompt for ${attitude} attitude in ${state.context.gathered['sector'] || 'unknown'} sector, persona: ${state.persona.behavior_style}/${state.persona.difficulty_level}`,
      attitudeConfig: attitudeConfig ? {
        id: attitudeConfig.id,
        naam: attitudeConfig.naam,
        signalen: attitudeConfig.signalen || [],
        techniek_reactie: attitudeConfig.techniek_reactie,
        detection_patterns: attitudeConfig.detection_patterns || [],
      } : undefined,
      // Enhanced debug info
      customerDynamics: updatedDynamics,
      epicPhase: newEpicPhase,
      evaluationQuality: evaluationQuality as 'goed' | 'bijna' | 'niet',
      dynamicsLevels: {
        rapport: getDynamicsLevel(updatedDynamics.rapport, 0.35, 0.65),
        valueTension: getDynamicsLevel(updatedDynamics.valueTension, 0.30, 0.60),
        commitReadiness: getDynamicsLevel(updatedDynamics.commitReadiness, 0.40, 0.70),
      },
      // Validator debug info (shows if response was repaired)
      validatorInfo: customerResponse.validatorInfo,
    };
  }
  
  // Expert Mode: Save seller's response as reference answer (only in ROLEPLAY mode with complete context)
  // NOTE: This auto-save happens on every turn. The "Opslaan als Golden Standard" button
  // in the UI calls a separate endpoint that includes the user's selected technique.
  // This auto-save uses the session's technique, not the user's selection per turn.
  if (state.expertMode && state.currentMode === 'ROLEPLAY' && state.context.isComplete) {
    try {
      // Check if detection differs from session technique (potential learning opportunity)
      const detectedTechnique = evaluation.moveId;
      const isCorrection = detectedTechnique !== null && detectedTechnique !== state.techniqueId;
      
      saveReferenceAnswer({
        techniqueId: state.techniqueId,
        customerSignal: isFirstTurn || !previousAttitude ? 'opening' : previousAttitude,
        customerMessage: isFirstTurn ? '(Start van gesprek)' : lastCustomerMessage,
        sellerResponse: sellerMessage,
        context: {
          sector: state.context.gathered['sector'],
          product: state.context.gathered['product'],
          klantType: state.context.gathered['klant_type'],
        },
        recordedBy: state.userId,
        // Voortschrijdend inzicht: track what AI detected vs what expert intended
        detectedTechnique: detectedTechnique || undefined,
        detectedConfidence: evaluation.score > 0 ? evaluation.score / 10 : undefined, // Normalize score to 0-1
        isCorrection,
      });
      console.log(`[reference-answers] Saved expert answer for turn ${state.turnNumber + 1}${isCorrection ? ' (CORRECTION: detected ' + detectedTechnique + ' but expert used ' + state.techniqueId + ')' : ''}`);
    } catch (err) {
      console.error('[reference-answers] Failed to save:', err);
    }
  }
  
  return response;
}

/**
 * Process debrief message
 */
function processDebriefMessage(
  state: V2SessionState,
  userMessage: string
): EngineResponse {
  // For now, generate session feedback
  const feedback = generateSessionFeedback(state.events);
  
  return {
    message: `${feedback.summary}\n\n${feedback.details.join('\n')}`,
    type: 'debrief',
    sessionState: state
  };
}

/**
 * End roleplay and get debrief - Hugo-style feedback
 */
export async function endRoleplay(state: V2SessionState): Promise<EngineResponse> {
  // Build debrief context from session state
  const debriefContext: DebriefContext = {
    techniqueId: state.techniqueId,
    persona: state.persona,
    customerDynamics: state.customerDynamics,
    events: state.events,
    conversationHistory: state.conversationHistory,
    contextData: state.context.gathered || {},
    epicPhase: state.epicPhase,
    totalScore: state.totalScore,
    turnNumber: state.turnNumber,
  };
  
  // Generate Hugo-style debrief
  const hugoDebrief = await generateHugoDebrief(debriefContext);
  
  // Record performance for invisible auto-adaptive level system
  let levelTransition: LevelTransition | null = null;
  try {
    // Calculate average score per turn (normalize to 0-100 scale)
    // totalScore is cumulative, so we divide by turns to get average performance
    const averageScore = state.turnNumber > 0 
      ? Math.round((state.totalScore / state.turnNumber) * 10) // Scale: 10 points per turn max = 100
      : 0;
    
    // Get technique name from SSOT
    const technique = getTechnique(state.techniqueId);
    const techniqueName = technique?.naam || state.techniqueId;
    
    const performanceResult: PerformanceResult = {
      techniqueId: state.techniqueId,
      techniqueName,
      score: Math.min(100, averageScore), // Cap at 100
      outcome: averageScore >= 70 ? "success" : averageScore >= 50 ? "partial" : "struggle",
    };
    
    // Record performance and get potential level transition
    levelTransition = await performanceTracker.recordPerformance(
      state.userId,
      performanceResult
    );
    
    if (levelTransition) {
      console.log(`[roleplay-engine] Level transition: ${levelTransition.previousLevel} → ${levelTransition.newLevel} (${levelTransition.reason})`);
    }
  } catch (error) {
    console.error('[roleplay-engine] Failed to record performance:', error);
    // Continue without blocking - level system is non-critical
  }
  
  return {
    message: hugoDebrief.message,
    type: 'debrief',
    sessionState: {
      ...state,
      currentMode: 'DEBRIEF'
    },
    levelTransition: levelTransition || undefined,
    // Pass through validatorInfo from debrief for debug panel
    debug: hugoDebrief.validatorInfo ? { validatorInfo: hugoDebrief.validatorInfo } : undefined,
    promptsUsed: hugoDebrief.promptsUsed
  };
}

/**
 * Check if session is in roleplay mode
 */
export function isInRoleplay(state: V2SessionState): boolean {
  return state.currentMode === 'ROLEPLAY';
}

/**
 * Get session summary for debug
 */
export function getSessionSummary(state: V2SessionState): {
  technique: string;
  mode: string;
  phase: number;
  turns: number;
  score: number;
  contextComplete: boolean;
} {
  const technique = getTechnique(state.techniqueId);
  
  return {
    technique: technique?.naam || state.techniqueId,
    mode: state.currentMode,
    phase: state.phase,
    turns: state.turnNumber,
    score: state.totalScore,
    contextComplete: state.context.isComplete
  };
}
