/**
 * context_engine.ts - Progressive context gathering per technique
 * 
 * ARCHITECTURE (v10.0 - Simplified Config):
 * - Reads technique definitions from SSOT via ssot-loader.ts
 * - context_prompt.json only contains: _meta, context_richtlijn, doel, role
 * - All slot definitions, themes, and dialogue settings are HARDCODED in this file
 * - context_richtlijn.tekst provides LSD (Luisteren, Samenvatten, Doorvragen) guidance
 * 
 * HARDCODED ELEMENTS (previously in context_prompt.json):
 * - BASE_SLOTS: sector, product, verkoopkanaal, klant_type, ervaring
 * - SLOT_THEMES: Theme and intent per slot for AI question generation
 * - MINIMUM_REQUIREMENTS: Slots required for roleplay vs coaching
 * - AI_DIALOGUE settings: max_clarifications, fallback message, interpret prompt
 * - COACHING_LENS: Strategic questioning dimensions
 * 
 * Output: ContextState (compact object) stored per user/session.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getTechnique } from '../ssot-loader';
import { getOpenAI } from '../openai-client';
import { searchRag } from './rag-service';
import { storage } from '../storage';
import { buildContextGatheringPrompt } from '../hugo-persona-loader';
import { getHistoricalContext, type HistoricalContext } from './historical-context-service';
import type { UserContext } from '@shared/schema';
import {
  buildMethodologyContext,
  buildDetectorPatterns,
  buildAttitudesContext,
  buildPersonaContext,
  buildEvaluationCriteria
} from './prompt-context';
import { validateAndRepair, buildValidatorDebugInfo, type ValidatorDebugInfo } from './response-repair';

// ============================================================================
// HARDCODED CONFIGURATION (previously in context_prompt.json)
// ============================================================================

/**
 * Base slots - universal context to gather for every technique
 * Phase 1: BASIS (who, what, how)
 * Phase 2: BEDRIJF (company details)
 * Phase 3: KOOPREDENEN (why they buy - LSD deep-dive to baten/pijnpunten)
 * Phase 4: VERLIESREDENEN (why they don't buy - bezwaren/twijfels/uitstel)
 */
export const BASE_SLOTS = [
  'sector', 'product', 'verkoopkanaal', 'klant_type', 'ervaring',
  'bedrijfsnaam', 'dealgrootte', 'salescycle',
  'koopredenen', 'verliesredenen'
] as const;
export type BaseSlotId = typeof BASE_SLOTS[number];

export const SLOT_PHASES = {
  basis: ['sector', 'product', 'verkoopkanaal', 'klant_type', 'ervaring'] as const,
  bedrijf: ['bedrijfsnaam', 'dealgrootte', 'salescycle'] as const,
  reverse_engineering: ['koopredenen', 'verliesredenen'] as const,
};

/**
 * Slot themes - defines what each slot is about for AI question generation
 */
export const SLOT_THEMES: Record<BaseSlotId, { theme: string; intent: string; info_needed?: string[] }> = {
  sector: {
    theme: 'In welke sector/branche werkt de verkoper?',
    intent: 'Begrijp de context van de verkoper voor gepersonaliseerde coaching',
    info_needed: ['industrie type', 'markt segment', 'B2B of B2C']
  },
  product: {
    theme: 'Wat verkoopt de verkoper precies?',
    intent: 'Begrijp het product/dienst om relevante voorbeelden te geven',
    info_needed: ['product type', 'dienst omschrijving', 'prijsniveau']
  },
  verkoopkanaal: {
    theme: 'Hoe verkoopt de verkoper? (telefonisch, fysiek, online)',
    intent: 'Pas coaching aan op het verkoopkanaal',
    info_needed: ['face-to-face', 'telefonisch', 'online/remote', 'hybrid']
  },
  klant_type: {
    theme: 'Wat voor type klanten heeft de verkoper?',
    intent: 'Begrijp de doelgroep voor realistische rollenspellen',
    info_needed: ['decision makers', 'bedrijfsgrootte', 'aankoop patroon']
  },
  ervaring: {
    theme: 'Hoeveel ervaring heeft de verkoper?',
    intent: 'Pas het niveau van coaching aan op de ervaring',
    info_needed: ['jaren ervaring', 'huidige rol', 'achtergrond']
  },
  bedrijfsnaam: {
    theme: 'Voor welk bedrijf werkt de verkoper? (naam en eventueel website)',
    intent: 'Begrijp het bedrijf om coaching te personaliseren met bedrijfsspecifieke context',
    info_needed: ['bedrijfsnaam', 'website URL', 'korte omschrijving']
  },
  dealgrootte: {
    theme: 'Wat is de gemiddelde dealgrootte / ticketsize?',
    intent: 'Pas coaching aan op de dealomvang — een €500 verkoop vraagt een ander gesprek dan €500.000',
    info_needed: ['gemiddelde orderwaarde', 'range klein-groot', 'eenmalig of recurring']
  },
  salescycle: {
    theme: 'Hoe lang duurt het typische verkoopproces?',
    intent: 'Begrijp de salescycle voor relevante strategieën',
    info_needed: ['one-call-close', 'weken', 'maanden', 'enterprise cycle']
  },
  koopredenen: {
    theme: 'Waarom kochten de laatste 10 klanten? Wat waren de échte baten of pijnpunten?',
    intent: 'Reverse engineering: ontdek de echte koopredenen (baten die klanten wilden verwerven, pijnpunten die ze wilden vermijden) — niet de features',
    info_needed: ['concrete baten', 'pijnpunten die ze wilden oplossen', 'emotionele drijfveren', 'zakelijke impact']
  },
  verliesredenen: {
    theme: 'Van de veelbelovende prospects die NIET kochten — wat waren de redenen?',
    intent: 'Begrijp de typische blokkades: bezwaren, twijfels, uitstel, prijs, timing, DMU-dynamiek',
    info_needed: ['concrete bezwaren', 'twijfels', 'pogingen tot uitstel', 'prijsbezwaren', 'DMU blokkades']
  }
};

/**
 * Minimum requirements for roleplay and coaching
 */
export const MINIMUM_REQUIREMENTS = {
  for_roleplay: ['sector', 'product'],
  for_coaching: ['sector']
};

/**
 * AI dialogue settings for interpretation and clarification
 */
export const AI_DIALOGUE_CONFIG = {
  max_clarifications_per_slot: 2,
  max_deep_dive_rounds: 3,
  fallback_after_max: "Geen probleem, laten we verder gaan. We kunnen hier later op terugkomen.",
  interpret_prompt: `Je bent een context-interpretatie module. Analyseer het antwoord van de verkoper op de vraag over "{{theme}}".

ANTWOORD VAN VERKOPER: "{{answer}}"

Bepaal:
1. ACCEPT: Antwoord bevat concrete, bruikbare informatie over {{slot}}
2. CLARIFY: Antwoord is vaag, of vraagt om verduidelijking
3. UNUSABLE: Off-topic, onbruikbaar, of te kort

Reageer in JSON: {"decision": "accept|clarify|unusable", "extracted_value": "...", "reason": "..."}`,
  deep_dive_interpret_prompt: `Je bent een context-interpretatie module voor REVERSE ENGINEERING.
De verkoper beantwoordt een vraag over "{{theme}}".

ANTWOORD: "{{answer}}"

DOEL: We zoeken de ECHTE baten of pijnpunten, niet features of oppervlakkige voordelen.

Bepaal:
1. DEEP_ENOUGH: Antwoord bevat echte baten (financieel, operationeel, strategisch, emotioneel) of echte pijnpunten die klanten wilden vermijden. Concreet en kwantificeerbaar.
2. NEEDS_DEEPER: Antwoord beschrijft features, oppervlakkige voordelen, of algemene termen. We moeten doorvragen: "Maar wat BETEKENDE dat concreet voor die klant? Wat kostte het ze? Wat leverden ze in?"
3. UNUSABLE: Off-topic of onbruikbaar.

Reageer in JSON: {"decision": "deep_enough|needs_deeper|unusable", "extracted_value": "...", "depth_level": "feature|voordeel|baat|pijnpunt", "suggested_followup": "..."}`,
  prompt_templates: {
    transition_situation: "Je hebt zojuist informatie over {{previous_slot}} verzameld. Nu ga je vragen naar {{current_slot}}.",
    transition_task: "Stel een natuurlijke overgangsvraag die bouwt op wat je al weet en vraagt naar {{theme}}.",
    clarify_situation: "De verkoper gaf een vaag antwoord over {{slot}}: '{{answer}}'",
    clarify_task: "Vraag vriendelijk om verduidelijking, geef een voorbeeld van wat je zoekt.",
    deep_dive_koopredenen: `De verkoper gaf een antwoord over koopredenen, maar het is nog op {{depth_level}}-niveau: "{{answer}}"
Je wilt doorvragen tot we bij ECHTE baten of pijnpunten zitten.
Antwoord als Hugo — warm, Socratisch, met LSD-techniek.
Vat samen wat ze zeiden, en vraag: "Maar wat betekende dat concreet voor die klant? Wat kostte het ze dat ze het nog niet hadden?"
OF: "Oké, dat is het voordeel. Maar welk PROBLEEM loste dat op? Wat was het GEVOLG als ze dat niet hadden?"`,
    deep_dive_verliesredenen: `De verkoper gaf een antwoord over verliesredenen, maar het is nog op {{depth_level}}-niveau: "{{answer}}"
Je wilt doorvragen tot we echte bezwaren, twijfels, of uitstelredenen begrijpen.
Antwoord als Hugo — warm, Socratisch.
Vat samen wat ze zeiden, en vraag: "Was dat het ECHTE bezwaar, of zat er iets anders achter?"
OF: "Wat maakte dat ze uiteindelijk niet over de streep kwamen? Was het de prijs, het vertrouwen, of iets anders?"`
  }
};

/**
 * Coaching lens dimensions for strategic questioning
 * Used in lens phase after base slots are collected
 */
export const COACHING_LENS = {
  reverse_engineering: {
    eindpunt: "Waar wil je dat het gesprek eindigt?",
    koopredenen: "Welke koopredenen wil je ontdekken?",
    disqualificatie: "Wanneer zou je de prospect disqualificeren?",
    blokkades: "Welke blokkades verwacht je?",
    sturing: "Hoe stuur je richting jouw doel?"
  },
  situatie_herkenning: {
    wanneer: "Wanneer is deze techniek nodig?",
    consequenties: "Wat gebeurt er als je het niet toepast?",
    alternatieven: "Welke alternatieven zijn er?"
  }
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Context state - the compact object we store per session
 */
export interface ContextState {
  userId: string;
  sessionId: string;
  techniqueId: string;
  gathered: Record<string, string>;
  questionsAsked: string[];
  questionsAnswered: string[];
  isComplete: boolean;
  currentQuestionKey: string | null;
  lensPhase: boolean;
  lensQuestionsAsked: string[];
  deepDiveRounds: Record<string, number>;
  companyProfile?: string;
}

/**
 * Dialogue state - tracks per-slot clarification attempts for AI dialogue
 */
export interface DialogueState {
  clarificationCount: Record<string, number>;
}

/**
 * AI interpretation result from interpretAnswer()
 */
export interface InterpretResult {
  decision: 'accept' | 'clarify' | 'unusable';
  extractedValue?: string;
  reason?: string;
}

/**
 * Slot theme definition - replaces static questions with AI generation themes
 */
export interface SlotTheme {
  theme: string;
  intent: string;
  technique_context?: string;
  examples_of_info_needed?: string[];
}

/**
 * Context question definition (for compatibility with existing code)
 */
export interface ContextQuestion {
  key: string;
  question: string;
  required: boolean;
  examples?: string[];
}

/**
 * Simplified context prompt config structure from context_prompt.json (v10.0)
 * Only contains: _meta, context_richtlijn, doel, role
 * All other configuration is HARDCODED in this file
 */
interface ContextPromptConfig {
  _meta: { version: string; purpose: string; architecture?: string };
  context_richtlijn: {
    tekst: string;
  };
  doel: string;
  role: {
    what_you_are: string;
    what_you_are_not: string;
  };
}

let contextPromptCache: ContextPromptConfig | null = null;

/**
 * Simplified config validation - only checks for required fields in v10.0 structure
 */
function validateContextPromptConfig(config: unknown): ContextPromptConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('[context_engine] Config is null or not an object');
  }
  
  const cfg = config as Record<string, unknown>;
  
  // Check for context_richtlijn.tekst
  const contextRichtlijn = cfg.context_richtlijn as Record<string, unknown> | undefined;
  if (!contextRichtlijn || typeof contextRichtlijn !== 'object') {
    throw new Error('[context_engine] Missing context_richtlijn object');
  }
  if (typeof contextRichtlijn.tekst !== 'string' || !contextRichtlijn.tekst) {
    throw new Error('[context_engine] Missing or empty context_richtlijn.tekst');
  }
  
  // Check for doel
  if (typeof cfg.doel !== 'string' || !cfg.doel) {
    throw new Error('[context_engine] Missing or empty doel');
  }
  
  // Check for role
  const role = cfg.role as Record<string, unknown> | undefined;
  if (!role || typeof role !== 'object') {
    throw new Error('[context_engine] Missing role object');
  }
  
  console.log('[context_engine] Config validated successfully (v10.0 simplified structure)');
  return config as ContextPromptConfig;
}

/**
 * Load and validate context prompt config from JSON
 */
export function loadContextPromptConfig(): ContextPromptConfig {
  if (contextPromptCache) return contextPromptCache;
  
  const configPath = path.join(process.cwd(), 'config', 'prompts', 'context_prompt.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`[context_engine] Config file not found: ${configPath}`);
  }
  
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  
  contextPromptCache = validateContextPromptConfig(parsed);
  return contextPromptCache;
}

/**
 * Get LSD richtlijn text from config
 * This is the main content we read from context_prompt.json
 */
export function getContextRichtlijn(): string {
  const config = loadContextPromptConfig();
  return config.context_richtlijn.tekst;
}

/**
 * Get doel (goal) from config
 */
export function getContextDoel(): string {
  const config = loadContextPromptConfig();
  return config.doel;
}

/**
 * Get role info from config
 */
export function getContextRole(): { what_you_are: string; what_you_are_not: string } {
  const config = loadContextPromptConfig();
  return config.role;
}

/**
 * Get theme for a slot - uses HARDCODED SLOT_THEMES
 */
export function getThemeForSlot(slotId: string): SlotTheme {
  const theme = SLOT_THEMES[slotId as BaseSlotId];
  
  if (theme) {
    return {
      theme: theme.theme,
      intent: theme.intent,
      examples_of_info_needed: theme.info_needed
    };
  }
  
  // Special handling for lens slots - use human-readable themes
  if (slotId === 'lens_reverse_engineering') {
    return {
      theme: 'strategisch denken over het gespreksdoel',
      intent: 'Help de verkoper nadenken over wat ze willen bereiken'
    };
  }
  if (slotId === 'lens_situatie_herkenning') {
    return {
      theme: 'herkennen wanneer deze techniek nodig is',
      intent: 'Help de verkoper situaties herkennen waarin deze techniek past'
    };
  }
  
  // Fallback for other non-base slots
  console.warn(`[context_engine] getThemeForSlot(${slotId}): Not a base slot - using fallback.`);
  return {
    theme: slotId.replace(/_/g, ' ').replace(/lens /g, ''),
    intent: `Verzamel informatie over ${slotId.replace(/_/g, ' ')}`
  };
}

/**
 * Build prompt for technique-specific context gathering
 * Injects technique from SSOT + gathered context
 */
export function buildTechniquePrompt(
  techniqueId: string,
  gatheredContext: Record<string, string>,
  historicalContext: string
): string {
  const technique = getTechnique(techniqueId);
  const richtlijn = getContextRichtlijn();
  const doel = getContextDoel();
  
  let prompt = `=== CONTEXT RICHTLIJN ===
${richtlijn}

=== DOEL ===
${doel}

`;
  
  if (technique) {
    prompt += `=== TECHNIEK: ${technique.naam} ===
Nummer: ${technique.nummer}
`;
    if (technique.doel) prompt += `Doel: ${technique.doel}\n`;
    if (technique.wat) prompt += `Wat: ${technique.wat}\n`;
    if (technique.waarom) prompt += `Waarom: ${technique.waarom}\n`;
    if (technique.wanneer) prompt += `Wanneer: ${technique.wanneer}\n`;
    if (technique.hoe) prompt += `Hoe: ${technique.hoe}\n`;
    if (technique.stappenplan?.length) {
      prompt += `Stappenplan: ${technique.stappenplan.join('; ')}\n`;
    }
    prompt += '\n';
  } else {
    prompt += `=== TECHNIEK: ${techniqueId} (niet gevonden) ===\n\n`;
  }
  
  prompt += `=== WAT JE AL WEET ===
${formatGatheredContext(gatheredContext)}

=== HISTORISCHE CONTEXT ===
${historicalContext || 'Eerste sessie.'}
`;
  
  return prompt;
}

/**
 * Format gathered context for prompt injection
 */
function formatGatheredContext(gathered: Record<string, string>): string {
  const entries = Object.entries(gathered).filter(([_, v]) => v && v.trim());
  if (entries.length === 0) {
    return 'Nog niets - dit is het begin van het gesprek.';
  }
  return entries.map(([k, v]) => `${k}: ${v}`).join('\n');
}

/**
 * Format historical context for context gathering prompts
 */
function formatHistoricalForContextGathering(historical: HistoricalContext): string {
  const parts: string[] = [];
  
  if (historical.totalSessionsWithTechnique > 0) {
    parts.push(`Aantal eerdere sessies: ${historical.totalSessionsWithTechnique}`);
  }
  
  if (historical.previousSessions.length > 0) {
    const lastSession = historical.previousSessions[0];
    if (lastSession.context && Object.keys(lastSession.context).length > 0) {
      parts.push('Eerder verzamelde context:');
      for (const [k, v] of Object.entries(lastSession.context)) {
        if (v && typeof v === 'string') {
          parts.push(`  ${k}: ${v}`);
        }
      }
    }
  }
  
  if (historical.strugglePatterns.length > 0) {
    parts.push(`Aandachtspunten: ${historical.strugglePatterns.map(s => s.pattern).join(', ')}`);
  }
  
  return parts.join('\n');
}

/**
 * Build lens-specific prompt for strategic questioning
 * Uses HARDCODED COACHING_LENS dimensions
 */
function buildLensPrompt(
  lensSlotId: LensSlotId,
  techniqueId: string,
  gatheredContext: Record<string, string>,
  historicalContext: string
): string {
  const technique = getTechnique(techniqueId);
  const techniqueName = technique?.naam || techniqueId;
  const techniqueWat = technique?.wat || '';
  const techniqueWaarom = technique?.waarom || '';
  
  const dimension = getLensDimension(lensSlotId);
  
  let lensContent: string;
  if (dimension === 'reverse_engineering') {
    const re = COACHING_LENS.reverse_engineering;
    lensContent = `REVERSE ENGINEERING - STRATEGISCH DENKEN:
- Eindpunt: ${re.eindpunt}
- Koopredenen: ${re.koopredenen}
- Disqualificatie: ${re.disqualificatie}
- Blokkades: ${re.blokkades}
- Sturing: ${re.sturing}

FOCUS: Help de verkoper nadenken over het DOEL van het gesprek.`;
  } else {
    const sh = COACHING_LENS.situatie_herkenning;
    lensContent = `SITUATIE HERKENNING - WANNEER & HOE:
- Wanneer: ${sh.wanneer}
- Consequenties: ${sh.consequenties}
- Alternatieven: ${sh.alternatieven}

FOCUS: Help de verkoper herkennen WANNEER deze techniek nodig is.`;
  }
  
  return `TECHNIEK: ${techniqueName}
Wat: ${techniqueWat}
Waarom: ${techniqueWaarom}

${lensContent}

WAT JE AL WEET OVER DEZE VERKOPER:
${formatGatheredContext(gatheredContext)}

HISTORISCHE CONTEXT:
${historicalContext || 'Eerste sessie.'}

DOEL:
${getContextDoel()}`;
}

/**
 * Build an enriched system prompt for context gathering
 */
function buildEnrichedContextSystemPrompt(
  hugoPrompt: string,
  techniqueId: string | undefined,
  gatheredContext: Record<string, string>,
  historyStr: string,
  slotTheme?: { theme: string; examples_of_info_needed?: string[] }
): string {
  const parts: string[] = [];
  const richtlijn = getContextRichtlijn();
  const doel = getContextDoel();
  const role = getContextRole();
  
  // LAAG 1: WIE JE BENT
  parts.push("═══ LAAG 1: ACHTERGROND ═══\n");
  parts.push("── WIE JE BENT ──");
  parts.push(hugoPrompt);
  parts.push(`\nJe bent: ${role.what_you_are}`);
  parts.push(`Je bent NIET: ${role.what_you_are_not}\n`);
  
  // METHODOLOGIE
  parts.push("── JOUW METHODOLOGIE ──");
  parts.push(buildMethodologyContext());
  
  // TECHNIEKEN & EVALUATIE (if technique specified)
  if (techniqueId) {
    parts.push("\n── HOE JE TECHNIEKEN HERKENT ──");
    parts.push(buildDetectorPatterns(techniqueId));
    
    parts.push("\n── EVALUATIE CRITERIA ──");
    parts.push(buildEvaluationCriteria(techniqueId));
  }
  
  // KLANT CONTEXT
  parts.push("\n── KLANTHOUDINGEN ──");
  parts.push(buildAttitudesContext());
  
  parts.push("\n── PERSONA TEMPLATES ──");
  parts.push(buildPersonaContext());
  
  // LAAG 2: SITUATIE
  parts.push("\n═══ LAAG 2: HUIDIGE SITUATIE ═══\n");
  
  parts.push("── WAT JE AL WEET OVER DEZE VERKOPER ──");
  parts.push(formatGatheredContext(gatheredContext) || "(Nog geen context verzameld)");
  
  parts.push("\n── JULLIE HISTORIE ──");
  parts.push(historyStr || "Eerste sessie met deze verkoper.");
  
  if (techniqueId) {
    const technique = getTechnique(techniqueId);
    if (technique) {
      parts.push("\n── DE TECHNIEK DIE JE GAAT COACHEN ──");
      parts.push(`${technique.nummer} - ${technique.naam}`);
      if (technique.doel) parts.push(`Doel: ${technique.doel}`);
    }
  }
  
  if (slotTheme) {
    parts.push("\n── HUIDIGE VRAAG ──");
    parts.push(`Je wilt meer weten over: "${slotTheme.theme}"`);
    if (slotTheme.examples_of_info_needed) {
      parts.push(`Voorbeelden van info die je zoekt: ${slotTheme.examples_of_info_needed.join(', ')}`);
    }
  }
  
  // LAAG 3: OPDRACHT
  parts.push("\n═══ LAAG 3: JOUW OPDRACHT ═══\n");
  
  parts.push("── CONTEXT RICHTLIJN (LSD) ──");
  parts.push(richtlijn);
  
  parts.push("\n── DOEL ──");
  parts.push(doel);
  
  console.log(`[context_engine] Built enriched prompt with ${techniqueId ? 'technique-specific' : 'general'} context`);
  
  return parts.join('\n');
}

/**
 * Build slot to theme map - uses HARDCODED SLOT_THEMES
 */
export function buildSlotToThemeMap(): Map<string, SlotTheme> {
  const map = new Map<string, SlotTheme>();
  
  for (const slot of BASE_SLOTS) {
    const theme = SLOT_THEMES[slot];
    map.set(slot, {
      theme: theme.theme,
      intent: theme.intent,
      examples_of_info_needed: theme.info_needed
    });
  }
  
  return map;
}

/**
 * Coaching lens pseudo-slot IDs
 */
export const LENS_SLOTS = [
  'lens_reverse_engineering',
  'lens_situatie_herkenning'
] as const;

export type LensSlotId = typeof LENS_SLOTS[number];

/**
 * Check if a slot ID is a lens pseudo-slot
 */
export function isLensSlot(slotId: string): slotId is LensSlotId {
  return LENS_SLOTS.includes(slotId as LensSlotId);
}

/**
 * Get the coaching_lens dimension for a lens slot
 */
export function getLensDimension(slotId: LensSlotId): string {
  switch (slotId) {
    case 'lens_reverse_engineering':
      return 'reverse_engineering';
    case 'lens_situatie_herkenning':
      return 'situatie_herkenning';
    default:
      return slotId;
  }
}

/**
 * Create a new empty context state
 */
export function createContextState(
  userId: string, 
  sessionId: string, 
  techniqueId: string
): ContextState {
  return {
    userId,
    sessionId,
    techniqueId,
    gathered: {},
    questionsAsked: [],
    questionsAnswered: [],
    isComplete: false,
    currentQuestionKey: null,
    lensPhase: false,
    lensQuestionsAsked: [],
    deepDiveRounds: {}
  };
}

/**
 * Get themes for a technique - returns BASE_SLOTS with their themes
 */
export function getThemesForTechnique(techniqueId: string): Array<{ key: string; theme: SlotTheme; required: boolean }> {
  const themeMap = buildSlotToThemeMap();
  const themes: Array<{ key: string; theme: SlotTheme; required: boolean }> = [];
  
  for (const slot of BASE_SLOTS) {
    const theme = themeMap.get(slot) || getThemeForSlot(slot);
    themes.push({
      key: slot,
      theme,
      required: true
    });
  }
  
  return themes;
}

/**
 * Get questions for a technique - returns BASE_SLOTS as context questions
 */
export function getQuestionsForTechnique(techniqueId: string): ContextQuestion[] {
  const themes = getThemesForTechnique(techniqueId);
  
  return themes.map(t => ({
    key: t.key,
    question: `[AI Generated: ${t.theme.theme}]`,
    required: t.required,
    examples: t.theme.examples_of_info_needed
  }));
}

/**
 * Get the question type for a technique (coaching vs context_gathering)
 */
export function getQuestionType(techniqueId: string): 'coaching' | 'context_gathering' {
  const technique = getTechnique(techniqueId);
  if (technique?.fase === '0') {
    return 'coaching';
  }
  return 'context_gathering';
}

/**
 * Get the next unanswered slot key
 */
export function getNextQuestion(state: ContextState): ContextQuestion | null {
  const themes = getThemesForTechnique(state.techniqueId);
  
  for (const t of themes) {
    if (!state.questionsAnswered.includes(t.key)) {
      return {
        key: t.key,
        question: `[AI Generated: ${t.theme.theme}]`,
        required: t.required
      };
    }
  }
  
  return null;
}

/**
 * Check if all base slots are complete
 */
export function areBaseSlotsComplete(state: ContextState): boolean {
  const themes = getThemesForTechnique(state.techniqueId);
  return themes.every(t => state.questionsAnswered.includes(t.key));
}

/**
 * Get next lens slot that hasn't been asked yet
 */
export function getNextLensSlot(state: ContextState): LensSlotId | null {
  for (const lensSlot of LENS_SLOTS) {
    if (!state.lensQuestionsAsked.includes(lensSlot)) {
      return lensSlot;
    }
  }
  return null;
}

/**
 * Check if lens phase is complete
 */
export function isLensPhaseComplete(state: ContextState): boolean {
  return LENS_SLOTS.every(slot => state.lensQuestionsAsked.includes(slot));
}

/**
 * Get the next unanswered slot key (for dynamic question generation)
 */
export function getNextSlotKey(state: ContextState, expertModeSlotLimit?: number): string | null {
  // Expert mode: stop after reaching slot limit
  if (expertModeSlotLimit !== undefined && state.questionsAnswered.length >= expertModeSlotLimit) {
    console.log(`[context_engine] Expert mode slot limit reached: ${state.questionsAnswered.length}/${expertModeSlotLimit}`);
    return null;
  }
  
  // PHASE 1: BASE SLOTS
  const themes = getThemesForTechnique(state.techniqueId);
  
  for (const t of themes) {
    if (!state.questionsAnswered.includes(t.key)) {
      return t.key;
    }
  }
  
  // PHASE 2: LENS SLOTS
  const nextLensSlot = getNextLensSlot(state);
  if (nextLensSlot) {
    console.log(`[context_engine] Base slots complete, entering lens phase: ${nextLensSlot}`);
    return nextLensSlot;
  }
  
  return null;
}

/**
 * Process an answer and update state
 */
export function processAnswer(
  state: ContextState, 
  questionKey: string, 
  answer: string,
  expertModeSlotLimit?: number
): ContextState {
  const newState = { ...state };
  
  // Handle lens slots differently
  if (isLensSlot(questionKey)) {
    if (!newState.lensQuestionsAsked.includes(questionKey)) {
      newState.lensQuestionsAsked = [...newState.lensQuestionsAsked, questionKey];
    }
    newState.lensPhase = true;
    
    const lensComplete = isLensPhaseComplete(newState);
    if (lensComplete) {
      newState.isComplete = true;
      console.log(`[context_engine] Lens phase complete, context gathering finished`);
    }
    
    const nextKey = getNextSlotKey(newState, expertModeSlotLimit);
    newState.currentQuestionKey = nextKey;
    
    return newState;
  }
  
  // Handle base slots
  newState.gathered = { ...newState.gathered, [questionKey]: answer };
  
  if (!newState.questionsAnswered.includes(questionKey)) {
    newState.questionsAnswered = [...newState.questionsAnswered, questionKey];
  }
  
  const themes = getThemesForTechnique(state.techniqueId);
  const requiredKeys = themes.filter(t => t.required).map(t => t.key);
  const allRequiredAnswered = requiredKeys.every(key => 
    newState.questionsAnswered.includes(key)
  );
  
  // Expert mode: mark complete if slot limit reached
  const expertModeComplete = expertModeSlotLimit !== undefined && 
    newState.questionsAnswered.length >= expertModeSlotLimit;
  
  if (expertModeComplete) {
    newState.isComplete = true;
    console.log(`[context_engine] Expert mode: Context marked complete after ${newState.questionsAnswered.length} slots`);
  }
  
  const nextKey = getNextSlotKey(newState, expertModeSlotLimit);
  newState.currentQuestionKey = nextKey;
  
  return newState;
}

/**
 * Format context for AI prompt (compact)
 */
export function formatContextForPrompt(state: ContextState): string {
  const lines: string[] = [];
  
  for (const [key, value] of Object.entries(state.gathered)) {
    if (value && value.trim()) {
      lines.push(`${key}: ${value}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Get minimum slots required for roleplay - HARDCODED
 */
export function getMinimumSlotsForRoleplay(): string[] {
  return [...MINIMUM_REQUIREMENTS.for_roleplay];
}

/**
 * Get minimum slots required for coaching - HARDCODED
 */
export function getMinimumSlotsForCoaching(): string[] {
  return [...MINIMUM_REQUIREMENTS.for_coaching];
}

/**
 * Get required slots for mode (roleplay or coaching) - HARDCODED
 */
export function getRequiredSlotsForMode(mode: 'roleplay' | 'coaching'): string[] {
  return mode === 'roleplay' 
    ? [...MINIMUM_REQUIREMENTS.for_roleplay]
    : [...MINIMUM_REQUIREMENTS.for_coaching];
}

/**
 * Get the system prompt for context gathering - uses context_richtlijn from config
 */
export function getContextSystemPrompt(): string {
  return getContextRichtlijn();
}

/**
 * Check if state has minimum context for roleplay
 */
export function hasMinimumContextForRoleplay(state: ContextState): boolean {
  const minSlots = getMinimumSlotsForRoleplay();
  const answeredSlots = Object.keys(state.gathered).filter(k => state.gathered[k]?.trim());
  return minSlots.filter(s => answeredSlots.includes(s)).length >= 2;
}

/**
 * Get required slots for a technique - returns BASE_SLOTS
 */
export function getRequiredSlotsForTechnique(techniqueId: string): string[] {
  return [...BASE_SLOTS];
}

/**
 * Merge user-level context with session context
 */
export async function mergeUserAndSessionContext(
  userId: string,
  sessionContext: Record<string, string>
): Promise<Record<string, string>> {
  const userContext = await storage.getUserContext(userId);
  
  const merged: Record<string, string> = {};
  
  if (userContext) {
    if (userContext.sector) merged.sector = userContext.sector;
    if (userContext.product) merged.product = userContext.product;
    if (userContext.klantType) merged.klant_type = userContext.klantType;
    if (userContext.setting) merged.verkoopkanaal = userContext.setting;
    
    if (userContext.additionalContext && typeof userContext.additionalContext === 'object') {
      const additional = userContext.additionalContext as Record<string, unknown>;
      for (const [key, value] of Object.entries(additional)) {
        if (typeof value === 'string' && value.trim()) {
          merged[key] = value;
        }
      }
    }
  }
  
  for (const [key, value] of Object.entries(sessionContext)) {
    if (value && value.trim()) {
      merged[key] = value;
    }
  }
  
  return merged;
}

/**
 * Clear cache (for testing/hot-reload)
 */
export function clearContextCache(): void {
  contextPromptCache = null;
}

// ============================================================================
// AI DIALOGUE FUNCTIONS
// ============================================================================

/**
 * Get max clarifications per slot - HARDCODED
 */
export function getMaxClarificationsPerSlot(): number {
  return AI_DIALOGUE_CONFIG.max_clarifications_per_slot;
}

/**
 * Get fallback message after max clarifications - HARDCODED
 */
export function getFallbackAfterMax(): string {
  return AI_DIALOGUE_CONFIG.fallback_after_max;
}

/**
 * Get AI dialogue prompt templates - HARDCODED
 */
export function getAIDialogueTemplates(): typeof AI_DIALOGUE_CONFIG.prompt_templates {
  return AI_DIALOGUE_CONFIG.prompt_templates;
}

/**
 * Create a new empty dialogue state
 */
export function createDialogueState(): DialogueState {
  return {
    clarificationCount: {}
  };
}

/**
 * Increment clarification count for a slot
 */
export function incrementClarificationCount(
  dialogueState: DialogueState,
  slot: string
): DialogueState {
  const newState = { ...dialogueState };
  newState.clarificationCount = { ...newState.clarificationCount };
  newState.clarificationCount[slot] = (newState.clarificationCount[slot] || 0) + 1;
  return newState;
}

/**
 * Check if max clarifications reached for a slot
 */
export function hasReachedMaxClarifications(
  dialogueState: DialogueState,
  slot: string
): boolean {
  const count = dialogueState.clarificationCount[slot] || 0;
  return count >= AI_DIALOGUE_CONFIG.max_clarifications_per_slot;
}

/**
 * AI Layer 1: Interpret user's answer to a context question
 */
export async function interpretAnswer(
  slot: string,
  themeOrQuestion: string,
  answer: string
): Promise<InterpretResult> {
  const theme = getThemeForSlot(slot);
  
  const prompt = AI_DIALOGUE_CONFIG.interpret_prompt
    .replace(/\{\{theme\}\}/g, theme.theme)
    .replace(/\{\{question\}\}/g, themeOrQuestion)
    .replace(/\{\{slot\}\}/g, slot)
    .replace(/\{\{answer\}\}/g, answer)
    .replace(/\{\{intent\}\}/g, theme.intent);
  
  const openai = getOpenAI();
  
  try {
    console.log('[context_engine] interpretAnswer for slot:', slot);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[context_engine] Empty response from interpretAnswer - using fallback');
      return { decision: 'accept', extractedValue: answer };
    }
    
    const parsed = JSON.parse(content);
    
    const decision = parsed.decision as 'accept' | 'clarify' | 'unusable';
    if (!['accept', 'clarify', 'unusable'].includes(decision)) {
      console.error('[context_engine] Invalid decision from AI:', parsed.decision);
      return { decision: 'accept', extractedValue: answer };
    }
    
    return {
      decision,
      extractedValue: parsed.extracted_value || parsed.extractedValue || answer,
      reason: parsed.reason
    };
    
  } catch (error) {
    console.error('[context_engine] Error in interpretAnswer:', error);
    return { decision: 'accept', extractedValue: answer };
  }
}

/**
 * Deep-dive interpretation result for reverse engineering slots
 */
export interface DeepDiveResult {
  decision: 'deep_enough' | 'needs_deeper' | 'unusable';
  extractedValue?: string;
  depthLevel?: 'feature' | 'voordeel' | 'baat' | 'pijnpunt';
  suggestedFollowup?: string;
}

/**
 * Check if a slot requires deep-dive LSD questioning (koopredenen, verliesredenen)
 */
export function isDeepDiveSlot(slotId: string): boolean {
  return slotId === 'koopredenen' || slotId === 'verliesredenen';
}

/**
 * AI Layer 1b: Deep-dive interpretation for reverse engineering slots
 * Checks if answer is at feature/voordeel level and needs deeper probing to baten/pijnpunten
 */
export async function interpretDeepDiveAnswer(
  slot: string,
  answer: string
): Promise<DeepDiveResult> {
  const theme = getThemeForSlot(slot);
  
  const prompt = AI_DIALOGUE_CONFIG.deep_dive_interpret_prompt
    .replace(/\{\{theme\}\}/g, theme.theme)
    .replace(/\{\{answer\}\}/g, answer);
  
  const openai = getOpenAI();
  
  try {
    console.log(`[context_engine] interpretDeepDiveAnswer for slot: ${slot}`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { decision: 'deep_enough', extractedValue: answer };
    }
    
    const parsed = JSON.parse(content);
    
    const decision = parsed.decision as 'deep_enough' | 'needs_deeper' | 'unusable';
    if (!['deep_enough', 'needs_deeper', 'unusable'].includes(decision)) {
      return { decision: 'deep_enough', extractedValue: answer };
    }
    
    return {
      decision,
      extractedValue: parsed.extracted_value || answer,
      depthLevel: parsed.depth_level,
      suggestedFollowup: parsed.suggested_followup
    };
    
  } catch (error) {
    console.error('[context_engine] Error in interpretDeepDiveAnswer:', error);
    return { decision: 'deep_enough', extractedValue: answer };
  }
}

/**
 * Generate a deep-dive follow-up question for koopredenen or verliesredenen
 * Uses LSD technique to probe from features/voordelen down to baten/pijnpunten
 */
export async function generateDeepDiveQuestion(
  slotId: string,
  currentAnswer: string,
  depthLevel: string,
  gatheredContext: Record<string, string>,
  conversationHistory?: ConversationMessage[]
): Promise<HugoResponseResult> {
  const templateKey = slotId === 'koopredenen' 
    ? 'deep_dive_koopredenen' 
    : 'deep_dive_verliesredenen';
  
  const template = AI_DIALOGUE_CONFIG.prompt_templates[templateKey as keyof typeof AI_DIALOGUE_CONFIG.prompt_templates];
  
  const situation = (template || '')
    .replace(/\{\{depth_level\}\}/g, depthLevel)
    .replace(/\{\{answer\}\}/g, currentAnswer);
  
  const task = `Stel een natuurlijke doorvraag die de verkoper helpt dieper na te denken.
Wat je al weet:
${formatGatheredContext(gatheredContext)}

BELANGRIJK: 
- Vat eerst kort samen wat ze zeiden (LSD - Samenvatten)
- Vraag dan door naar de ECHTE baten of pijnpunten (LSD - Doorvragen)
- Gebruik concrete voorbeelden uit hun sector als je die kent
- Maximaal 2-3 zinnen`;

  return generateHugoResponse(situation, task, { conversationHistory });
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HugoResponseOptions {
  conversationHistory?: ConversationMessage[];
  historicalContext?: string;
}

export interface HugoResponseResult {
  message: string;
  validatorInfo?: ValidatorDebugInfo;
  promptsUsed?: {
    systemPrompt: string;
    userPrompt: string;
  };
}

/**
 * AI Layer 2: Generate Hugo's response based on situation and task
 */
export async function generateHugoResponse(
  situation: string,
  task: string,
  options?: HugoResponseOptions | ConversationMessage[]
): Promise<HugoResponseResult> {
  const opts: HugoResponseOptions = Array.isArray(options) 
    ? { conversationHistory: options } 
    : (options || {});
  
  const { conversationHistory, historicalContext } = opts;
  const openai = getOpenAI();
  
  try {
    const ragResults = await searchRag(situation, { limit: 3 });
    const ragContext = ragResults.documents.length > 0 
      ? ragResults.documents.map(r => r.content).join('\n\n---\n\n')
      : '';
    
    console.log('[context_engine] RAG results for context gathering:', ragResults.documents.length);
    
    const hugoPrompt = buildContextGatheringPrompt(ragContext);
    
    // Use context_richtlijn from config for LSD guidance
    const richtlijn = getContextRichtlijn();
    const doel = getContextDoel();
    
    const userPrompt = `HUIDIGE SITUATIE:
${situation}

── JOUW COACHING STIJL ──
${richtlijn}

── DOEL ──
${doel}

JOUW TAAK:
${task}

INSTRUCTIE: Reageer als Hugo Herbots. Kort, to the point, persoonlijk. Stel maximaal 1 vraag.`;
    
    console.log('[context_engine] generateHugoResponse with RAG...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: hugoPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 1500,
      temperature: 0.7
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[context_engine] Empty response from generateHugoResponse - generating fallback');
      const fallbackMessage = await generateFallbackResponse();
      return { message: fallbackMessage };
    }
    
    const rawMessage = content.trim();
    
    // Ensure conversationHistory is a valid array
    const historyArray = Array.isArray(conversationHistory) ? conversationHistory : [];
    
    // Build conversation context string for validator
    const conversationContext = historyArray.length > 0
      ? historyArray.map(m => `${m.role === 'user' ? 'Verkoper' : 'Hugo'}: ${m.content}`).join('\n')
      : undefined;
    
    const repairResult = await validateAndRepair(rawMessage, "CONTEXT_GATHERING", {
      originalSystemPrompt: hugoPrompt,
      conversationHistory: historyArray.map(m => ({ role: m.role, content: m.content })),
      conversationContext,
      historicalContext,
    });
    
    if (repairResult.wasRepaired) {
      console.log(`[context_engine] Response repaired: ${repairResult.validationResult.label}`);
    }
    
    const validatorInfo = buildValidatorDebugInfo("CONTEXT_GATHERING", repairResult);
    
    return {
      message: repairResult.repairedResponse,
      validatorInfo,
      promptsUsed: {
        systemPrompt: hugoPrompt,
        userPrompt
      }
    };
    
  } catch (error) {
    console.error('[context_engine] Error in generateHugoResponse:', error);
    const fallback = await generateFallbackResponse();
    return { message: fallback };
  }
}

/**
 * Generate a fallback response using AI
 */
async function generateFallbackResponse(): Promise<string> {
  const openai = getOpenAI();
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Je bent Hugo Herbots, een vriendelijke sales coach.' },
        { role: 'user', content: 'Genereer een korte, vriendelijke vraag om meer context te verzamelen over de verkoper.' }
      ],
      max_completion_tokens: 100
    });
    
    return response.choices[0]?.message?.content?.trim() || 
      "Vertel eens, in welke branche werk je precies?";
  } catch (error) {
    console.error('[context_engine] Fallback generation failed:', error);
    return "Vertel eens, in welke branche werk je precies?";
  }
}

/**
 * Generate question for a specific slot using AI
 */
export async function generateQuestionForSlot(
  slotId: string,
  gatheredContext: Record<string, string>,
  techniqueId: string,
  conversationHistory?: ConversationMessage[]
): Promise<HugoResponseResult> {
  const theme = getThemeForSlot(slotId);
  const technique = getTechnique(techniqueId);
  
  const situation = `Je bent bezig met context verzamelen voor techniek "${technique?.naam || techniqueId}".
Wat je al weet:
${formatGatheredContext(gatheredContext)}

Nu wil je meer weten over: ${theme.theme}
${theme.examples_of_info_needed ? `Voorbeelden van info die je zoekt: ${theme.examples_of_info_needed.join(', ')}` : ''}`;

  // Gebruik theme.theme in plaats van slotId om interne IDs te vermijden in de output
  const task = `Stel een natuurlijke vraag om meer te weten te komen over "${theme.theme}". 
Bouw voort op wat je al weet. Stel maximaal 1 vraag. 
BELANGRIJK: Noem NOOIT interne termen zoals "lens_reverse_engineering" of andere technische slot-IDs in je antwoord.`;

  return generateHugoResponse(situation, task, { conversationHistory });
}

/**
 * Handle clarification request from user
 */
export async function handleClarificationRequest(
  slotId: string,
  userQuestion: string,
  gatheredContext: Record<string, string>,
  techniqueId: string,
  conversationHistory?: ConversationMessage[]
): Promise<HugoResponseResult> {
  const theme = getThemeForSlot(slotId);
  
  const situation = `De verkoper vraagt om verduidelijking over "${theme.theme}".
Hun vraag: "${userQuestion}"

Wat je al weet:
${formatGatheredContext(gatheredContext)}`;

  const task = `Beantwoord de vraag kort en vriendelijk. 
Leg uit wat je bedoelt en geef een concreet voorbeeld.
Vraag daarna opnieuw naar de informatie die je zoekt.`;

  return generateHugoResponse(situation, task, { conversationHistory });
}

/**
 * Generate transition message when moving to next slot
 */
export async function generateTransitionMessage(
  previousSlotId: string,
  nextSlotId: string,
  gatheredContext: Record<string, string>,
  techniqueId: string,
  conversationHistory?: ConversationMessage[]
): Promise<HugoResponseResult> {
  const prevTheme = getThemeForSlot(previousSlotId);
  const nextTheme = getThemeForSlot(nextSlotId);
  
  const templates = AI_DIALOGUE_CONFIG.prompt_templates;
  
  const situation = templates.transition_situation
    .replace(/\{\{previous_slot\}\}/g, prevTheme.theme)
    .replace(/\{\{current_slot\}\}/g, nextTheme.theme);
  
  const task = templates.transition_task
    .replace(/\{\{theme\}\}/g, nextTheme.theme);

  return generateHugoResponse(situation, task, { conversationHistory });
}
