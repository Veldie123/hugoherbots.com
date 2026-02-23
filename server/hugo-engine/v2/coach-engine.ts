/**
 * COACH_CHAT Engine - Natural coaching conversations with Hugo
 * 
 * This engine powers the COACH_CHAT mode where Hugo acts as a warm, 
 * Socratic sales coach. Uses RAG to ground responses in Hugo's actual
 * training materials.
 * 
 * Key differences from ROLEPLAY:
 * - Hugo is himself (coach), not a customer persona
 * - No evaluation/scoring of seller techniques
 * - RAG-grounded responses from Hugo's methodology
 * - Natural conversation, not structured Q&A
 * 
 * v8.1 - Simplified config: only coaching_richtlijn, doel, role from config
 *        All prompt structure/templates built inline
 */

import { getOpenAIClient, searchRag, type RagDocument } from "./rag-service";
import * as fs from "fs";
import * as path from "path";
import { getTechnique } from "../ssot-loader";
import {
  loadTechniquesIndex,
  loadDetectors,
  loadKlantHoudingen,
  loadPersonaTemplates,
  loadEvaluatorOverlay,
  loadVideoMapping,
  loadGlobalConfig,
  loadCoachOverlay,
  getSlotDefinitions,
  getFlowRules,
  getTechniqueOverlay,
  buildMethodologyContext,
  buildDetectorPatterns,
  buildAttitudesContext,
  buildPersonaContext,
  buildEvaluationCriteria,
  getVideosForTechnique
} from "./prompt-context";
import { mergeUserAndSessionContext, getRequiredSlotsForTechnique } from './context_engine';
import { storage } from '../storage';
import { buildCoachingPrompt, buildFeedbackPrompt, getHugoIdentity, getHugoRole } from '../hugo-persona-loader';
import { getHistoricalContext, type HistoricalContext } from './historical-context-service';
import type { CustomerSignal, Persona, EpicPhase } from "./customer_engine";
import type { CustomerDynamics } from "../houding-selector";
import type { EvaluationEvent } from "./evaluator";
import { validateAndRepair, buildValidatorDebugInfo, type ValidatorDebugInfo } from "./response-repair";

// ============================================================================
// SIMPLIFIED CONFIG - Only coaching_richtlijn, doel, role from config
// ============================================================================

/**
 * CoachPromptConfig v8.1 - Simplified
 * 
 * Only reads behavioral guidance from config.
 * All prompt structure/templates are built inline in code.
 */
interface CoachPromptConfig {
  _meta?: {
    version: string;
    purpose: string;
  };
  coaching_richtlijn?: {
    tekst: string;
  };
  doel?: string;
  role?: {
    what_you_are: string;
    what_you_are_not: string;
  };
}

let coachPromptConfig: CoachPromptConfig | null = null;

function loadCoachPromptConfig(): CoachPromptConfig {
  if (coachPromptConfig) return coachPromptConfig;
  
  const configPath = path.join(process.cwd(), "config", "prompts", "coach_prompt.json");
  
  if (!fs.existsSync(configPath)) {
    console.warn(`[COACH] Config file not found: ${configPath}, using defaults`);
    coachPromptConfig = {};
    return coachPromptConfig;
  }
  
  const data = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(data);
  
  coachPromptConfig = config as CoachPromptConfig;
  console.log("[COACH] Loaded coach_prompt.json config (simplified v8.1)");
  return coachPromptConfig;
}

// Simple fallback messages for technical errors (not coaching, just error states)
const TECHNICAL_FALLBACKS = {
  client_unavailable: 'Technisch probleem. Probeer opnieuw.',
  error_generic: 'Er ging iets mis. Probeer het opnieuw.',
};

// Inline defaults for prompt building
const INLINE_DEFAULTS = {
  rag_context_header: "RELEVANTE TRAININGSCONTEXT:",
  video_context_header: "BESCHIKBARE VIDEO'S:",
  no_context_found: "(Geen specifieke trainingscontext gevonden)",
  no_videos_available: "(Geen video's beschikbaar)",
  document_title_fallback: "Trainingsfragment",
};

// Get coaching guideline from config (or empty string)
function getCoachingRichtlijn(): string {
  const cfg = loadCoachPromptConfig();
  return cfg.coaching_richtlijn?.tekst || "";
}

// Get doel from config (or default)
function getDoel(): string {
  const cfg = loadCoachPromptConfig();
  return cfg.doel || "De coachee voelt zich begrepen en verlaat het gesprek met concrete inzichten.";
}

// Build base system prompt - ONLY Hugo persona from hugo-persona-loader
function buildBaseSystemPrompt(): string {
  const hugoPrompt = buildCoachingPrompt("");
  return hugoPrompt;
}

// Build system prompt for regular chat responses
function buildSystemPrompt(ragContextStr: string, videoContextStr: string): string {
  const hugoPrompt = buildCoachingPrompt(ragContextStr);
  
  let prompt = hugoPrompt + "\n\n";
  
  const richtlijn = getCoachingRichtlijn();
  if (richtlijn) {
    prompt += "**Richtlijn voor coaching:**\n\n" + richtlijn + "\n\n";
  }
  
  prompt += INLINE_DEFAULTS.rag_context_header + "\n" + ragContextStr + "\n\n";
  prompt += INLINE_DEFAULTS.video_context_header + "\n" + videoContextStr + "\n\n";
  prompt += "Verwijs naar video's wanneer relevant, maar parafraseer of citeer niet letterlijk - het is jouw eigen kennis.";
  
  return prompt;
}

/**
 * Build complete coachee context from all gathered slots
 */
function buildCoacheeContext(
  mergedContext: Record<string, string>,
  userName?: string
): string {
  const parts: string[] = [];
  
  if (userName) {
    parts.push(`Naam: ${userName}`);
  }
  
  const slotDefs = getSlotDefinitions();
  const coreSlots = slotDefs.base;
  const extendedSlots = slotDefs.extended;
  
  for (const slot of coreSlots) {
    if (mergedContext[slot]?.trim()) {
      const label = slot.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
      parts.push(`${label}: ${mergedContext[slot]}`);
    }
  }
  
  for (const slot of extendedSlots) {
    if (mergedContext[slot]?.trim()) {
      const label = slot.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
      parts.push(`${label}: ${mergedContext[slot]}`);
    }
  }
  
  const knownSlots = new Set([...coreSlots, ...extendedSlots]);
  for (const [key, value] of Object.entries(mergedContext)) {
    if (!knownSlots.has(key) && value?.trim() && !key.startsWith('_')) {
      const label = key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
      parts.push(`${label}: ${value}`);
    }
  }
  
  return parts.length > 0 ? parts.join("\n") : "(Nog geen context verzameld)";
}

/**
 * Build 3-LAYER prompt structure v8.1 - HARDCODED STRUCTURE
 * 
 * Architectuur: Prompt-structuur zit in CODE, niet in config files.
 * Config files bevatten alleen KENNIS (wat) en STIJL (hoe gedragen).
 */
function buildNestedOpeningPrompt(
  coacheeContext: string,
  techniqueNarrative: string,
  historicalContext: string,
  videoContextStr: string,
  ragContextStr: string,
  userName?: string,
  techniqueId?: string
): string {
  let prompt = "";
  
  // ══════════════════════════════════════════════════════════════════════════
  // LAAG 1: ACHTERGROND - Jouw kennis en referentiemateriaal
  // ══════════════════════════════════════════════════════════════════════════
  
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "ACHTERGROND - Jouw kennis en referentiemateriaal\n";
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "Dit is wie je bent en wat je weet. Gebruik dit als achtergrondkennis.\n\n";
  
  prompt += "── WIE JE BENT ──\n";
  prompt += buildBaseSystemPrompt() + "\n\n";
  
  prompt += "── WAT DIT PLATFORM IS ──\n";
  prompt += "Dit is jouw AI-gestuurd sales trainingsplatform. Je coacht verkopers 1-op-1 in jouw EPIC sales methodologie.\n\n";
  
  prompt += "── JOUW VOLLEDIGE METHODOLOGIE ──\n";
  prompt += "Dit is je complete EPIC sales methodologie met alle fases en technieken.\n";
  prompt += buildMethodologyContext() + "\n\n";
  
  prompt += "── HOE JE TECHNIEKEN HERKENT ──\n";
  prompt += "Patronen om te herkennen of een techniek correct wordt toegepast.\n";
  prompt += buildDetectorPatterns(techniqueId) + "\n\n";
  
  prompt += "── KLANTHOUDINGEN ──\n";
  prompt += "De 6 klanthoudingen die verkopers tegenkomen.\n";
  prompt += buildAttitudesContext() + "\n\n";
  
  prompt += "── KLANT PERSONA'S ──\n";
  prompt += "Gedragsstijlen, koopfases en ervaringsniveaus.\n";
  prompt += buildPersonaContext() + "\n\n";
  
  prompt += "── EVALUATIE CRITERIA ──\n";
  prompt += "Waar je op let per techniek.\n";
  prompt += buildEvaluationCriteria(techniqueId) + "\n\n";
  
  if (videoContextStr && videoContextStr !== INLINE_DEFAULTS.no_videos_available) {
    prompt += "── TRAININGSVIDEO'S ──\n";
    prompt += "Beschikbare video's per techniek.\n";
    prompt += videoContextStr + "\n\n";
  }
  
  if (ragContextStr && ragContextStr !== INLINE_DEFAULTS.no_context_found) {
    prompt += "── JOUW WOORDEN EN STIJL ──\n";
    prompt += "Fragmenten uit jouw trainingsvideo's. Gebruik de toon en stijl, vertaal naar een 1-op-1 coachend gesprek.\n";
    prompt += ragContextStr + "\n\n";
  }
  
  const coachingStyle = getCoachingRichtlijn();
  if (coachingStyle) {
    prompt += "── HOE EEN GOEDE COACH WERKT ──\n";
    prompt += "Jouw coaching filosofie.\n";
    prompt += coachingStyle + "\n\n";
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // LAAG 2: SITUATIE - Wat er nu speelt
  // ══════════════════════════════════════════════════════════════════════════
  
  prompt += "\n══════════════════════════════════════════════════════════════\n";
  prompt += "SITUATIE - Wat er nu speelt\n";
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "Dit is de concrete situatie waarin je je nu bevindt.\n\n";
  
  if (coacheeContext) {
    prompt += "── DE COACHEE ──\n";
    prompt += coacheeContext + "\n\n";
  }
  
  if (techniqueNarrative) {
    prompt += "── HUIDIGE FOCUS ──\n";
    prompt += "Let op: deze techniek maakt deel uit van een groter geheel. Gebruik je methodologie-kennis om context te geven.\n\n";
    prompt += techniqueNarrative + "\n\n";
  }
  
  if (historicalContext) {
    prompt += "── JULLIE HISTORIE ──\n";
    prompt += historicalContext + "\n\n";
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // LAAG 3: OPDRACHT - Simpele directief
  // ══════════════════════════════════════════════════════════════════════════
  
  prompt += "\n══════════════════════════════════════════════════════════════\n";
  prompt += "OPDRACHT\n";
  prompt += "══════════════════════════════════════════════════════════════\n";
  
  const technique = techniqueId ? getTechnique(techniqueId) : null;
  const techName = technique?.naam || "de geselecteerde techniek";
  const displayName = userName || "de coachee";
  
  prompt += `Je zit met ${displayName} aan tafel. Dit is een echt gesprek, een dialoog. Praat zoals je zou praten, niet zoals je zou schrijven.\n\n`;
  
  const doel = getDoel();
  prompt += `── DOEL ──\n${doel.replace("{{techniek_naam}}", techName)}`;
  
  return prompt;
}

// ============================================================================
// HELPER FUNCTIONS - Technique narratives and historical context
// ============================================================================

interface FullTechnique {
  nummer?: string;
  naam?: string;
  fase?: string;
  parent?: string;
  is_fase?: boolean;
  kan_starten_op_klant_signaal?: boolean;
  doel?: string;
  wat?: string;
  waarom?: string;
  wanneer?: string;
  hoe?: string;
  stappenplan?: readonly string[];
  voorbeeld?: string | readonly string[];
  tags?: readonly string[];
  verkoper_intentie?: readonly string[];
  context_requirements?: readonly string[];
  themas?: readonly string[];
}

function buildFullTechniqueNarrative(technique: FullTechnique | null): string {
  if (!technique) {
    return "";
  }
  
  const parts: string[] = [];
  
  parts.push(`Techniek: ${technique.naam || "Onbekende techniek"} (nummer ${technique.nummer || "?"})`);
  parts.push(`Fase: ${technique.fase || "?"}`);
  if (technique.parent) {
    parts.push(`Onderdeel van: ${technique.parent}`);
  }
  
  if (technique.wat) {
    parts.push(`\nWat deze techniek is:\n${technique.wat}`);
  }
  
  if (technique.doel) {
    parts.push(`\nWat het doel is van deze techniek:\n${technique.doel}`);
  }
  
  if (technique.waarom) {
    parts.push(`\nWaarom dit belangrijk is:\n${technique.waarom}`);
  }
  
  if (technique.wanneer) {
    parts.push(`\nWanneer je dit toepast:\n${technique.wanneer}`);
  }
  
  if (technique.hoe) {
    parts.push(`\nHoe je dit doet:\n${technique.hoe}`);
  }
  
  if (technique.voorbeeld) {
    const examples = Array.isArray(technique.voorbeeld) 
      ? technique.voorbeeld 
      : [technique.voorbeeld];
    if (examples.length > 0) {
      parts.push(`\nConcrete voorbeeldzinnen die de verkoper kan gebruiken:`);
      examples.forEach(ex => {
        parts.push(`- "${ex}"`);
      });
    }
  }
  
  if (technique.stappenplan && technique.stappenplan.length > 0) {
    parts.push(`\nStappenplan:`);
    technique.stappenplan.forEach((step, i) => {
      parts.push(`${i + 1}. ${step}`);
    });
  }
  
  if (technique.tags && technique.tags.length > 0) {
    parts.push(`\nTags: ${technique.tags.join(", ")}`);
  }
  
  if (technique.verkoper_intentie && technique.verkoper_intentie.length > 0) {
    parts.push(`De verkoper wil hiermee: ${technique.verkoper_intentie.join(", ")}`);
  }
  
  return parts.join("\n");
}

/**
 * Build historical score context - inline formatting
 */
async function buildHistoricalScoreContext(
  userId: string,
  techniqueId: string,
  techniqueName: string
): Promise<string> {
  try {
    const historicalContext = await getHistoricalContext(userId, techniqueId, 5);
    
    if (!historicalContext.techniqueMastery && historicalContext.totalSessionsWithTechnique === 0) {
      return `Dit is de eerste keer dat we ${techniqueName} oefenen.`;
    }
    
    const parts: string[] = [];
    parts.push("Jullie geschiedenis met deze techniek:");
    
    if (historicalContext.totalSessionsWithTechnique > 0) {
      parts.push(`- ${historicalContext.totalSessionsWithTechnique} eerdere sessies met ${techniqueName}`);
      
      if (historicalContext.lastSessionDaysAgo !== null) {
        if (historicalContext.lastSessionDaysAgo === 0) {
          parts.push("- Laatste sessie: vandaag");
        } else if (historicalContext.lastSessionDaysAgo === 1) {
          parts.push("- Laatste sessie: gisteren");
        } else {
          parts.push(`- Laatste sessie: ${historicalContext.lastSessionDaysAgo} dagen geleden`);
        }
      }
    }
    
    if (historicalContext.techniqueMastery) {
      const m = historicalContext.techniqueMastery;
      parts.push(`\nVoortgang:`);
      parts.push(`- Gemiddelde score: ${m.averageScore}`);
      parts.push(`- Niveau: ${m.masteryLevel}`);
      
      if (m.progression) {
        if (m.progression.trend === 'improving') {
          parts.push(`- Trend: verbetering (${m.progression.firstScore} → ${m.progression.lastScore})`);
        } else if (m.progression.trend === 'declining') {
          parts.push(`- Trend: achteruitgang (${m.progression.firstScore} → ${m.progression.lastScore})`);
        } else {
          parts.push(`- Trend: stabiel`);
        }
      }
    }
    
    if (historicalContext.strugglePatterns.length > 0) {
      parts.push(`\nAandachtspunten:`);
      historicalContext.strugglePatterns.slice(0, 3).forEach(sp => {
        parts.push(`- ${sp.pattern} (${sp.count}x voorgekomen)`);
      });
    }
    
    return parts.join("\n");
  } catch (error) {
    console.warn("[COACH] Error loading historical context:", error);
    return `Dit is de eerste keer dat we ${techniqueName} oefenen.`;
  }
}

// ============================================================================
// PUBLIC INTERFACES
// ============================================================================

export interface CoachMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CoachContext {
  userId?: string;
  techniqueId?: string;
  techniqueName?: string;
  userName?: string;
  sector?: string;
  product?: string;
  klantType?: string;
  sessionContext?: Record<string, string>;
  contextGatheringHistory?: Array<{ role: 'seller' | 'customer'; content: string }>;
}

export interface CoachResponse {
  message: string;
  ragContext?: RagDocument[];
  debug?: {
    ragQuery: string;
    documentsFound: number;
    searchTimeMs: number;
    wasRepaired?: boolean;
    repairAttempts?: number;
  };
  promptsUsed?: {
    systemPrompt: string;
    userPrompt: string;
  };
  validatorInfo?: ValidatorDebugInfo;
}

// ============================================================================
// CORE ENGINE FUNCTIONS
// ============================================================================

/**
 * Build the enhanced system prompt and messages for a coach response.
 * Shared between streaming and non-streaming paths.
 * Loads RAG + video in parallel for speed.
 */
async function prepareCoachPrompt(
  userMessage: string,
  conversationHistory: CoachMessage[],
  context: CoachContext = {}
): Promise<{ messages: CoachMessage[]; enhancedSystemPrompt: string; ragResult: any; ragQuery: string }> {
  let ragQuery = userMessage;
  if (context.techniqueName) {
    ragQuery = `${context.techniqueName}: ${userMessage}`;
  }

  const [ragResult, videoContextStr] = await Promise.all([
    searchRag(ragQuery, { limit: 4, threshold: 0.3 }),
    (async () => {
      if (context.techniqueId) {
        const videos = getVideosForTechnique(context.techniqueId);
        if (videos.length > 0) {
          return videos.map(v => `- "${v.title}": ${v.beschrijving}`).join("\n");
        }
      }
      return INLINE_DEFAULTS.no_videos_available;
    })(),
  ]);

  let ragContextStr = "";
  if (ragResult.documents.length > 0) {
    ragContextStr = ragResult.documents
      .map((doc: any, i: number) => `[${i + 1}] ${doc.title || INLINE_DEFAULTS.document_title_fallback}:\n${doc.content}`)
      .join("\n\n");
  } else {
    ragContextStr = INLINE_DEFAULTS.no_context_found;
  }

  const systemPrompt = buildSystemPrompt(ragContextStr, videoContextStr);

  let enhancedSystemPrompt = systemPrompt;
  
  if (context.techniqueName) {
    enhancedSystemPrompt += `\n\nHuidige focus: ${context.techniqueName}`;
    if (context.techniqueId) {
      enhancedSystemPrompt += ` (${context.techniqueId})`;
    }
  }
  if (context.sector) {
    enhancedSystemPrompt += `\nSector van coachee: ${context.sector}`;
  }
  if (context.product) {
    enhancedSystemPrompt += `\nProduct van coachee: ${context.product}`;
  }
  if (context.userName) {
    enhancedSystemPrompt += `\nNaam coachee: ${context.userName}`;
  }

  enhancedSystemPrompt += `\n\n**BELANGRIJK — gedragsregels:**
- Als de gebruiker een letter antwoordt (A, B, C, D) of een nummer (1, 2, 3), koppel dit aan de opties uit jouw VORIGE bericht. Reageer direct op die keuze zonder opnieuw te vragen wat ze bedoelen.
- Houd antwoorden kort en concreet. Maximaal 3-4 zinnen tenzij uitleg echt nodig is. Geen lange opsommingen.
- Als de gebruiker een audiobestand heeft bijgevoegd met een verzoek om te analyseren, zeg dan iets als: "Top, ik ga dat voor je analyseren!" Het systeem handelt de analyse automatisch af — jij hoeft de gebruiker NIET te verwijzen naar een ander menu of pagina. Jij BENT de agent die het regelt.
- Als de gebruiker vraagt om een video of webinar te bekijken over een techniek, toon die dan inline. Het systeem voegt automatisch video's en webinars toe aan je antwoord wanneer relevant.`;

  const messages: CoachMessage[] = [
    { role: "system", content: enhancedSystemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  return { messages, enhancedSystemPrompt, ragResult, ragQuery };
}

/**
 * Generate a coaching response from Hugo (non-streaming, with validation)
 */
export async function generateCoachResponse(
  userMessage: string,
  conversationHistory: CoachMessage[],
  context: CoachContext = {}
): Promise<CoachResponse> {
  const client = getOpenAIClient();
  
  if (!client) {
    return {
      message: TECHNICAL_FALLBACKS.client_unavailable,
    };
  }

  const { messages, enhancedSystemPrompt, ragResult, ragQuery } = await prepareCoachPrompt(
    userMessage, conversationHistory, context
  );

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: messages.map(m => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      max_completion_tokens: 2000,
    });

    const assistantMessage = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;
    
    if (!assistantMessage || finishReason === 'length') {
      console.warn("[COACH] Response issue:", { finishReason, contentLength: assistantMessage?.length || 0 });
    }

    const rawMessage = assistantMessage || TECHNICAL_FALLBACKS.error_generic;
    
    const repairResult = await validateAndRepair(rawMessage, "COACH_CHAT", {
      originalSystemPrompt: enhancedSystemPrompt,
      conversationHistory: conversationHistory.map(m => ({ role: m.role, content: m.content })),
    });
    
    if (repairResult.wasRepaired) {
      console.log(`[COACH] Response repaired: ${repairResult.validationResult.label}`);
    }
    
    const validatorInfo = buildValidatorDebugInfo("COACH_CHAT", repairResult);

    return {
      message: repairResult.repairedResponse,
      ragContext: ragResult.documents,
      debug: {
        ragQuery,
        documentsFound: ragResult.documents.length,
        searchTimeMs: ragResult.searchTimeMs,
        wasRepaired: repairResult.wasRepaired,
        repairAttempts: repairResult.repairAttempts,
      },
      promptsUsed: {
        systemPrompt: enhancedSystemPrompt,
        userPrompt: userMessage
      },
      validatorInfo
    };
  } catch (error) {
    console.error("[COACH] Error generating response:", error);
    return {
      message: TECHNICAL_FALLBACKS.error_generic,
    };
  }
}

/**
 * Generate a STREAMING coaching response from Hugo.
 * Yields tokens as they arrive from OpenAI. Much faster time-to-first-token.
 */
export async function generateCoachResponseStream(
  userMessage: string,
  conversationHistory: CoachMessage[],
  context: CoachContext = {},
  onToken: (token: string) => void,
  onDone: (fullText: string, debug?: any) => void,
  onError: (error: Error) => void
): Promise<void> {
  const client = getOpenAIClient();
  
  if (!client) {
    onToken(TECHNICAL_FALLBACKS.client_unavailable);
    onDone(TECHNICAL_FALLBACKS.client_unavailable);
    return;
  }

  const { messages, enhancedSystemPrompt, ragResult, ragQuery } = await prepareCoachPrompt(
    userMessage, conversationHistory, context
  );

  try {
    const stream = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: messages.map(m => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      max_completion_tokens: 2000,
      stream: true,
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onToken(delta);
      }
    }

    onDone(fullText || TECHNICAL_FALLBACKS.error_generic, {
      ragQuery,
      documentsFound: ragResult.documents.length,
      searchTimeMs: ragResult.searchTimeMs,
    });
  } catch (error: any) {
    console.error("[COACH] Streaming error:", error);
    onError(error);
  }
}

/**
 * Generate an opening message from Hugo for a new coach session
 */
export async function generateCoachOpening(context: CoachContext): Promise<CoachResponse> {
  const client = getOpenAIClient();
  
  if (!client) {
    return {
      message: TECHNICAL_FALLBACKS.client_unavailable,
    };
  }

  const technique = context.techniqueId ? getTechnique(context.techniqueId) : null;
  const techniqueName = technique?.naam || context.techniqueName || "";
  
  let mergedContext: Record<string, string> = {};
  if (context.userId) {
    const sessionContext = context.sessionContext || {
      sector: context.sector || "",
      product: context.product || "",
      klant_type: context.klantType || ""
    };
    mergedContext = await mergeUserAndSessionContext(context.userId, sessionContext);
  } else {
    mergedContext = {
      sector: context.sector || "",
      product: context.product || "",
      klant_type: context.klantType || ""
    };
  }

  let ragResult = { documents: [] as RagDocument[], searchTimeMs: 0 };
  if (techniqueName) {
    ragResult = await searchRag(techniqueName, {
      limit: 2,
      threshold: 0.3,
    });
  }

  const coacheeContextStr = buildCoacheeContext(mergedContext, context.userName);
  const fullTechniqueNarrative = buildFullTechniqueNarrative(technique as FullTechnique || null);
  
  let historicalScoreContext = "";
  if (context.userId && context.techniqueId) {
    historicalScoreContext = await buildHistoricalScoreContext(
      context.userId, 
      context.techniqueId, 
      techniqueName
    );
  }

  let ragContextStr = "";
  if (ragResult.documents.length > 0) {
    ragContextStr = ragResult.documents
      .map((doc, i) => `[Fragment ${i + 1}] ${doc.title || INLINE_DEFAULTS.document_title_fallback}:\n${doc.content}`)
      .join("\n\n");
  } else {
    ragContextStr = INLINE_DEFAULTS.no_context_found;
  }
  
  let videoContextStr = INLINE_DEFAULTS.no_videos_available;
  if (context.techniqueId) {
    const videos = getVideosForTechnique(context.techniqueId);
    if (videos.length > 0) {
      videoContextStr = videos.map(v => `- "${v.title}": ${v.beschrijving}`).join("\n");
    }
  }
  
  const systemPrompt = buildNestedOpeningPrompt(
    coacheeContextStr, 
    fullTechniqueNarrative, 
    historicalScoreContext, 
    videoContextStr,
    ragContextStr,
    context.userName,
    context.techniqueId
  );
  
  // Build opening user prompt inline
  let openingPrompt = "Begin een coachend gesprek met de coachee";
  if (context.userName) {
    openingPrompt = `Begin een coachend gesprek met ${context.userName}`;
  }
  if (techniqueName) {
    openingPrompt += ` over de techniek '${techniqueName}'.`;
  } else {
    openingPrompt += ".";
  }
  openingPrompt += " Begroet warm, wees nieuwsgierig naar de situatie, en laat de coachee leiden.";
  
  // Build context gathering transcript if available
  if (context.contextGatheringHistory && context.contextGatheringHistory.length > 0) {
    openingPrompt += "\n\n── WAT ER AL BESPROKEN IS ──\nDit gesprek is al begonnen. Hier is wat er tot nu toe is gezegd:\n\n";
    openingPrompt += context.contextGatheringHistory.map(msg => {
      const speaker = msg.role === 'customer' ? 'Hugo' : 'Coachee';
      return `${speaker}: ${msg.content}`;
    }).join("\n\n");
    openingPrompt += "\n\n(Dit gesprek loopt al. Bouw voort op wat er gezegd is.)";
  }
  
  console.log("\n========== COACH OPENING PROMPT DEBUG ==========");
  console.log("USER ID:", context.userId);
  console.log("\n--- SYSTEM PROMPT ---");
  console.log(systemPrompt);
  console.log("\n--- USER PROMPT ---");
  console.log(openingPrompt);
  console.log("========== END DEBUG ==========\n");
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: openingPrompt },
      ],
      max_completion_tokens: 4000,
    });
    
    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;
    
    if (!content || finishReason === 'length') {
      console.warn("[COACH] Opening issue:", { finishReason, contentLength: content?.length || 0 });
    }

    const rawMessage = content || TECHNICAL_FALLBACKS.error_generic;
    
    const repairResult = await validateAndRepair(rawMessage, "COACH_CHAT", {
      originalSystemPrompt: systemPrompt,
    });
    
    if (repairResult.wasRepaired) {
      console.log(`[COACH] Opening repaired: ${repairResult.validationResult.label}`);
    }
    
    const validatorInfo = buildValidatorDebugInfo("COACH_CHAT", repairResult);

    return {
      message: repairResult.repairedResponse,
      ragContext: ragResult.documents,
      promptsUsed: {
        systemPrompt,
        userPrompt: openingPrompt
      },
      validatorInfo
    };
  } catch (error) {
    console.error("[COACH] Error generating opening:", error);
    return {
      message: TECHNICAL_FALLBACKS.error_generic,
    };
  }
}

// ============================================================================
// DEBRIEF GENERATION - Hugo-style feedback after roleplay
// ============================================================================

export interface DebriefContext {
  techniqueId: string;
  techniqueName?: string;
  persona: Persona;
  customerDynamics: CustomerDynamics;
  initialDynamics?: CustomerDynamics;
  events: EvaluationEvent[];
  conversationHistory: Array<{ role: 'seller' | 'customer'; content: string }>;
  contextData?: Record<string, string>;
  epicPhase: EpicPhase;
  totalScore: number;
  turnNumber: number;
}

interface AttitudeCount {
  name: string;
  count: number;
}

/**
 * Load feedback prompt config from config/prompts/feedback_prompt.json
 */
interface FeedbackPromptConfig {
  _meta: { version: string; purpose: string };
  feedback_richtlijn?: { tekst: string };
  doel?: string;
  role?: { what_you_are: string; what_you_are_not: string };
}

let feedbackPromptCache: FeedbackPromptConfig | null = null;

function loadFeedbackPromptConfig(): FeedbackPromptConfig | null {
  if (feedbackPromptCache) return feedbackPromptCache;
  
  const configPath = path.join(process.cwd(), "config", "prompts", "feedback_prompt.json");
  
  if (!fs.existsSync(configPath)) {
    console.warn('[coach-engine] feedback_prompt.json not found');
    return null;
  }
  
  try {
    const configStr = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configStr) as FeedbackPromptConfig;
    
    feedbackPromptCache = config;
    console.log(`[coach-engine] Loaded feedback_prompt.json v${config._meta?.version || 'unknown'}`);
    return feedbackPromptCache;
  } catch (e) {
    console.warn('[coach-engine] Error parsing feedback_prompt.json:', e);
    return null;
  }
}

export function clearFeedbackPromptCache(): void {
  feedbackPromptCache = null;
}

/**
 * Build debrief system prompt - inline with all methodology context
 */
function buildDebriefSystemPrompt(ragContextStr: string, techniqueId?: string): string {
  const feedbackCfg = loadFeedbackPromptConfig();
  const hugoPrompt = buildFeedbackPrompt(ragContextStr);
  
  let prompt = "";
  
  // ══════════════════════════════════════════════════════════════════════════
  // LAAG 1: ACHTERGROND
  // ══════════════════════════════════════════════════════════════════════════
  
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "ACHTERGROND - Jouw kennis en referentiemateriaal\n";
  prompt += "══════════════════════════════════════════════════════════════\n\n";
  
  prompt += "── WIE JE BENT ──\n";
  prompt += hugoPrompt + "\n\n";
  
  prompt += "── WAT DIT PLATFORM IS ──\n";
  prompt += "Dit is jouw AI-gestuurd sales trainingsplatform. Je geeft feedback na een rollenspel.\n\n";
  
  prompt += "── JOUW METHODOLOGIE ──\n";
  prompt += buildMethodologyContext() + "\n\n";
  
  prompt += "── HOE TECHNIEKEN TE HERKENNEN ──\n";
  prompt += buildDetectorPatterns(techniqueId) + "\n\n";
  
  prompt += "── KLANTHOUDINGEN ──\n";
  prompt += buildAttitudesContext() + "\n\n";
  
  prompt += "── PERSONA'S ──\n";
  prompt += buildPersonaContext() + "\n\n";
  
  prompt += "── EVALUATIE CRITERIA ──\n";
  prompt += buildEvaluationCriteria(techniqueId) + "\n\n";
  
  if (ragContextStr && ragContextStr !== INLINE_DEFAULTS.no_context_found) {
    prompt += "── JOUW WOORDEN EN STIJL ──\n";
    prompt += ragContextStr + "\n\n";
  }
  
  // Feedback richtlijn from config
  const feedbackRichtlijn = feedbackCfg?.feedback_richtlijn?.tekst || 
    "Je bent in de feedback-fase: help de verkoper reflecteren. Citeer letterlijk uit het transcript, stel reflectieve vragen, geef één concrete actie.";
  
  prompt += "── HOE JE FEEDBACK GEEFT ──\n";
  prompt += feedbackRichtlijn + "\n\n";
  
  // ══════════════════════════════════════════════════════════════════════════
  // LAAG 2: SITUATIE (gets filled in by user prompt with session summary)
  // ══════════════════════════════════════════════════════════════════════════
  
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "SITUATIE - Wat er zojuist gebeurde\n";
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "De sessie-samenvatting volgt in het user prompt.\n\n";
  
  // ══════════════════════════════════════════════════════════════════════════
  // LAAG 3: OPDRACHT
  // ══════════════════════════════════════════════════════════════════════════
  
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "OPDRACHT\n";
  prompt += "══════════════════════════════════════════════════════════════\n";
  prompt += "Dit is een gesprek, geen rapport. Help de verkoper zelf inzichten ontdekken.\n\n";
  
  const feedbackDoel = feedbackCfg?.doel || 
    "De verkoper reflecteert op wat er gebeurde en ontdekt zelf wat beter kan.";
  prompt += `── DOEL ──\n${feedbackDoel}`;
  
  return prompt;
}

/**
 * Format session summary - inline formatting
 */
function formatSessionSummary(context: DebriefContext): string {
  const sections: string[] = [];
  
  const technique = getTechnique(context.techniqueId);
  const techniqueName = technique?.naam || context.techniqueName || context.techniqueId;
  sections.push(`**Geoefende techniek:** ${techniqueName}`);
  
  // Persona section
  sections.push("\n**Klant persona:**");
  sections.push(`- Gedragsstijl: ${context.persona.behavior_style || "Onbekend"}`);
  sections.push(`- Koopfase: ${context.persona.buying_clock_stage || "Onbekend"}`);
  sections.push(`- Ervaring: ${context.persona.experience_level || "Onbekend"}`);
  sections.push(`- Moeilijkheid: ${context.persona.difficulty_level || "Onbekend"}`);
  
  // Dynamics evolution
  sections.push("\n**Dynamiek evolutie:**");
  const initial = context.initialDynamics || { rapport: 0.5, valueTension: 0.05, commitReadiness: 0.08 };
  const final = context.customerDynamics;
  
  let rapportLabel = "stabiel";
  if (final.rapport > initial.rapport + 0.1) rapportLabel = "verbeterd";
  else if (final.rapport < initial.rapport - 0.1) rapportLabel = "verslechterd";
  
  sections.push(`- Rapport: ${(initial.rapport * 100).toFixed(0)}% → ${(final.rapport * 100).toFixed(0)}% (${rapportLabel})`);
  sections.push(`- Spanning: ${(initial.valueTension * 100).toFixed(0)}% → ${(final.valueTension * 100).toFixed(0)}%`);
  sections.push(`- Koopbereidheid: ${(initial.commitReadiness * 100).toFixed(0)}% → ${(final.commitReadiness * 100).toFixed(0)}%`);
  
  // Attitudes seen
  const attitudeCounts: Record<string, number> = {};
  for (const event of context.events) {
    const signal = event.customerSignal;
    if (signal) {
      attitudeCounts[signal] = (attitudeCounts[signal] || 0) + 1;
    }
  }
  
  if (Object.keys(attitudeCounts).length > 0) {
    sections.push("\n**Waargenomen klanthoudingen:**");
    for (const [name, count] of Object.entries(attitudeCounts)) {
      sections.push(`- ${name}: ${count}x`);
    }
  }
  
  // Turn-by-turn evaluation
  sections.push("\n**Evaluatie per beurt:**");
  
  if (context.events.length === 0 && context.conversationHistory && context.conversationHistory.length > 0) {
    sections.push("(Coaching gesprek - geen formeel rollenspel met evaluatie)");
    sections.push("\nGesprek samenvatting:");
    const recentHistory = context.conversationHistory.slice(-6);
    for (let i = 0; i < recentHistory.length; i++) {
      const msg = recentHistory[i];
      const roleLabel = msg.role === 'seller' ? 'Verkoper' : 'Hugo';
      const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + "..." : msg.content;
      sections.push(`- ${roleLabel}: "${preview}"`);
    }
  } else {
    for (const event of context.events) {
      const sellerPreview = event.sellerMessage.length > 80 
        ? event.sellerMessage.substring(0, 80) + "..." 
        : event.sellerMessage;
      const qualityNote = event.quality && event.quality !== "goed" ? `, ${event.quality}` : "";
      
      sections.push(`- Beurt ${event.turnNumber}: "${sellerPreview}" → ${event.customerSignal}, score: ${event.score}${qualityNote}`);
    }
  }
  
  // Context data if available
  if (context.contextData && Object.keys(context.contextData).length > 0) {
    sections.push("\n**Sessie context:**");
    for (const [key, value] of Object.entries(context.contextData)) {
      sections.push(`- ${key}: ${value}`);
    }
  }
  
  // Summary stats
  const detected = context.events.filter(e => e.detected).length;
  const total = context.events.length;
  const percentage = total > 0 ? Math.round((detected / total) * 100) : 0;
  
  if (total > 0) {
    sections.push(`\n**Eindresultaat:** Score ${context.totalScore} | ${detected}/${total} correct (${percentage}%)`);
  } else if (context.conversationHistory && context.conversationHistory.length > 0) {
    sections.push(`\nCoaching gesprek: ${context.conversationHistory.length} berichten uitgewisseld`);
  }
  
  return sections.join("\n");
}

export async function generateHugoDebrief(context: DebriefContext): Promise<{
  message: string;
  ragContext?: RagDocument[];
  validatorInfo?: ValidatorDebugInfo;
  promptsUsed?: {
    systemPrompt: string;
    userPrompt: string;
  };
}> {
  const client = getOpenAIClient();
  if (!client) {
    return { message: TECHNICAL_FALLBACKS.client_unavailable };
  }
  
  const technique = getTechnique(context.techniqueId);
  const techniqueName = technique?.naam || context.techniqueId;
  
  const ragQuery = `feedback geven verkoper ${techniqueName} evaluatie`;
  const ragResult = await searchRag(ragQuery, { limit: 3 });
  
  let ragContextStr = "";
  if (ragResult.documents.length > 0) {
    ragContextStr = ragResult.documents
      .map((doc, i) => `[${i + 1}] ${doc.title || INLINE_DEFAULTS.document_title_fallback}:\n${doc.content}`)
      .join("\n\n");
  } else {
    ragContextStr = INLINE_DEFAULTS.no_context_found;
  }
  
  const systemPrompt = buildDebriefSystemPrompt(ragContextStr, context.techniqueId);
  const sessionSummary = formatSessionSummary(context);
  
  const userPrompt = `Hier is de samenvatting van de rollenspel sessie. Geef feedback als coach:\n\n${sessionSummary}`;
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 5000,
    });
    
    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;
    
    if (!content || finishReason === 'length') {
      console.warn("[COACH] Debrief issue:", { finishReason, contentLength: content?.length || 0 });
    }
    
    const rawMessage = content || TECHNICAL_FALLBACKS.error_generic;
    
    const repairResult = await validateAndRepair(rawMessage, "FEEDBACK", {
      originalSystemPrompt: systemPrompt,
    });
    
    if (repairResult.wasRepaired) {
      console.log(`[COACH] Debrief repaired: ${repairResult.validationResult.label}`);
    }
    
    const validatorInfo = buildValidatorDebugInfo("FEEDBACK", repairResult);
    
    return {
      message: repairResult.repairedResponse,
      ragContext: ragResult.documents,
      validatorInfo,
      promptsUsed: {
        systemPrompt,
        userPrompt
      }
    };
  } catch (error) {
    console.error("[COACH] Error generating debrief:", error);
    return { message: TECHNICAL_FALLBACKS.error_generic };
  }
}
