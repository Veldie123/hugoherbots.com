/**
 * V3 Analysis Service — Claude-powered conversation analysis
 *
 * Replaces OpenAI LLM calls in the V2 analysis pipeline with Claude.
 * Reuses V2's transcription, turn building, and phase calculation (pure code).
 * Used only for superadmin (stephane@hugoherbots.com).
 */
import { getAnthropicClient, COACHING_MODEL, EVALUATION_MODEL } from "./anthropic-client";
import { getTechnique, getTechniqueName, getAllTechniqueNummers, getFases, getChildTechniques } from "../ssot-loader";
import { pool } from "../db";
import {
  transcribeAudio,
  buildTurns,
  calculatePhaseCoverage,
  type TranscriptTurn,
  type TurnEvaluation,
  type CustomerSignalResult,
  type PhaseCoverage,
  type MissedOpportunity,
  type CoachMoment,
  type CoachDebrief,
  type CoachDebriefMessage,
  type AnalysisInsights,
  type FullAnalysisResult,
  type ConversationAnalysis,
} from "../v2/analysis-service";
import {
  buildSSOTContextForEvaluation,
  buildVideoRecommendationsForMoments,
} from "../v2/ssot-context-builder";
import { searchRag } from "../v2/rag-service";
import { computeDetailedMetrics } from "../v2/detailed-metrics";
import { sanitizeAnalysisError } from "../error-utils";
import * as path from "path";
import * as fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000,
  model: string = COACHING_MODEL,
  thinkingBudget?: number
): Promise<string> {
  const client = getAnthropicClient();
  const createParams: Parameters<typeof client.messages.create>[0] = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  };
  if (thinkingBudget) {
    (createParams as any).thinking = { type: "enabled", budget_tokens: thinkingBudget };
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let response;
      if (thinkingBudget) {
        // Streaming required for large max_tokens + thinking budget combinations
        const stream = client.messages.stream(createParams as any);
        response = await stream.finalMessage();
      } else {
        response = await client.messages.create(createParams);
      }
      const textBlocks = response.content.filter(
        (b): b is { type: "text"; text: string } => b.type === "text"
      );
      return textBlocks.map((b) => b.text).join("");
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.message?.includes("rate_limit") || err?.message?.includes("overloaded");
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const waitMs = (attempt + 1) * 60_000;
        console.warn(`[callClaude] Rate limited. Wachten ${waitMs / 1000}s (poging ${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("[callClaude] Max retries bereikt.");
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    return JSON.parse(cleaned);
  } catch {
    console.warn("[V3 Analysis] JSON parse failed. Raw (first 500 chars):", raw.substring(0, 500));
    return fallback;
  }
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Build a compact technique list from SSOT for use in analysis prompts */
function buildSSOTTechniqueList(): string {
  const nummers = getAllTechniqueNummers();
  const fases: Record<string, string[]> = {};
  for (const nr of nummers) {
    const name = getTechniqueName(nr);
    if (!name) continue;
    // Group by top-level fase (0, 1, 2, 3, 4)
    const fase = nr.split(".")[0];
    if (!fases[fase]) fases[fase] = [];
    // Only include up to 2 levels deep for readability (e.g. "2.1.1" but not "2.1.1.3")
    const depth = nr.split(".").length;
    if (depth <= 3) {
      fases[fase].push(`${nr}: ${name}`);
    }
  }
  const faseLabels: Record<string, string> = {
    "0": "Fase 0 (Voorbereiding)",
    "1": "Fase 1 (Opening)",
    "2": "Fase 2 (Ontdekking/EPIC)",
    "3": "Fase 3 (Aanbeveling)",
    "4": "Fase 4 (Beslissing)",
  };
  return Object.entries(fases)
    .map(([fase, techniques]) => `- ${faseLabels[fase] || `Fase ${fase}`}: ${techniques.join(", ")}`)
    .join("\n");
}

/** Build houding → verwachte technieken mapping from SSOT for use in evaluation prompts */
function buildHoudingReactieMapping(): string {
  const filePath = path.join(process.cwd(), "config/klant_houdingen.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const lines: string[] = [];
  for (const [, h] of Object.entries(data.houdingen) as [string, any][]) {
    const techNames = (h.recommended_technique_ids as string[])
      .map((id) => `${getTechniqueName(id) || id} (${id})`)
      .join(", ");
    lines.push(`${h.id} (${h.naam}): verwachte technieken = [${techNames || "geen specifieke verwachting"}]`);
  }
  return lines.join("\n");
}

/** Build EPIC phase sequence context from SSOT for use in evaluation prompts */
function buildEPICSequenceContext(): string {
  const fases = getFases().filter((f) => ["1", "2", "3", "4"].includes(f.nummer));
  const lines: string[] = [];
  for (const fase of fases) {
    const children = getChildTechniques(fase.nummer);
    if (children.length === 0) continue;
    const isFase2 = fase.nummer === "2";
    const isFase3 = fase.nummer === "3";
    const separator = isFase2 || isFase3 ? " → " : ", ";
    const childList = children.map((c) => `${c.nummer}: ${c.naam}`).join(separator);
    lines.push(`Fase ${fase.nummer} (${fase.naam}): ${childList}`);
    if (isFase2) {
      lines.push("  ↪ Fase 2 sequentie is verplicht in volgorde. Fase 3 vereist voltooide Fase 2 (inclusief het laatste onderdeel van Fase 2).");
    }
    if (isFase3) {
      lines.push("  ↪ OVB-sequentie verplicht in volgorde. De Baat-stap vereist grondslag in klantuitspraken uit Fase 2.");
    }
  }
  return lines.join("\n");
}

// ── Conversation Narrative ────────────────────────────────────────────────────

interface ConversationNarrative {
  phases: Array<{
    phase: number;
    startTurn: number;
    endTurn: number;
    description: string;
  }>;
  nonTechniqueTurns: number[];
  transitions: Array<{
    turnIdx: number;
    from: number;
    to: number;
    trigger: string;
  }>;
  narrative: string;
  customerRevelations: Array<{
    turnIdx: number;
    summary: string;
    type: "need" | "problem" | "impact" | "commitment" | "objection";
  }>;
  epicSequenceAudit: {
    exploreHappened: boolean;
    probeHappened: boolean;
    impactHappened: boolean;
    commitmentBeforeSolution: boolean;
    solutionPresentedPrematurely: boolean;
    comments: string;
  };
}

async function analyzeConversationNarrative(
  turns: TranscriptTurn[]
): Promise<ConversationNarrative> {
  const transcriptContext = turns
    .map((t) => `[${t.idx}] ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`)
    .join("\n");

  const lastTurnIdx = turns.length > 0 ? turns[turns.length - 1].idx : 0;

  const systemPrompt = `Je bent een expert in de EPIC verkoopmethodologie van Hugo Herbots. Analyseer de structuur van een verkoopgesprek.

EPIC METHODOLOGIE SEQUENTIE (SSOT):
${buildEPICSequenceContext()}

Antwoord als JSON (geen markdown, geen uitleg buiten het JSON):
{
  "phases": [
    { "phase": 1, "startTurn": 0, "endTurn": 12, "description": "Korte omschrijving" }
  ],
  "nonTechniqueTurns": [0, 1, 3, 5],
  "transitions": [
    { "turnIdx": 13, "from": 1, "to": 2, "trigger": "Eerste echte EPIC-vraag" }
  ],
  "narrative": "2-3 zinnen over het verloop van het gesprek",
  "customerRevelations": [
    { "turnIdx": 5, "summary": "Klant noemde dat ze 12 verkopers hebben zonder structuur", "type": "need" }
  ],
  "epicSequenceAudit": {
    "exploreHappened": true,
    "probeHappened": false,
    "impactHappened": false,
    "commitmentBeforeSolution": false,
    "solutionPresentedPrematurely": true,
    "comments": "Verkoper sprong van Explore direct naar Oplossing zonder Probe/Impact/Commitment"
  }
}`;

  const userPrompt = `TRANSCRIPT (${turns.length} turns, indices 0-${lastTurnIdx}):
${transcriptContext}

Analyseer de structuur van dit gesprek:
1. Verdeel het gesprek in EPIC-fases (startTurn/endTurn zijn inclusief).
2. Geef alle turn-indices die puur small talk, begroetingen, fillers of te kort zijn voor enige verkooptechniek (nonTechniqueTurns). Wees ruimhartig — twijfelgevallen horen erbij.
3. Identificeer de fase-overgangen met de trigger die de overgang markeert.
4. Schrijf een korte narratief over het gesprek.
5. Identificeer alle klant-onthullingen (customerRevelations): wat onthulde de klant over hun situatie, problemen, gevolgen of commitment? Alleen inhoudelijk relevante turns (geen small talk).
6. Analyseer de EPIC sequentie (epicSequenceAudit): werden alle onderdelen van Fase 2 voltooid voordat Fase 3 startte? Was er een te vroege overgang naar Fase 3?`;

  const result = await callClaude(systemPrompt, userPrompt, 12000, EVALUATION_MODEL, 8000);

  const fallback: ConversationNarrative = {
    phases: [{ phase: 1, startTurn: 0, endTurn: lastTurnIdx, description: "Volledig gesprek" }],
    nonTechniqueTurns: [],
    transitions: [],
    narrative: "Gespreksstructuur kon niet worden bepaald.",
    customerRevelations: [],
    epicSequenceAudit: {
      exploreHappened: false,
      probeHappened: false,
      impactHappened: false,
      commitmentBeforeSolution: false,
      solutionPresentedPrematurely: false,
      comments: "Sequentie-analyse niet beschikbaar.",
    },
  };

  const parsed = parseJSON<ConversationNarrative>(result, fallback);

  // Safety: ensure phases cover all turns with no gaps
  if (!parsed.phases || parsed.phases.length === 0) return fallback;

  console.log(`[V3 Analysis] Narrative: ${parsed.phases.length} phases, ${parsed.nonTechniqueTurns.length} non-technique turns, narrative: "${parsed.narrative.substring(0, 80)}..."`);
  return parsed;
}

// ── V3 Evaluate Seller Turns ─────────────────────────────────────────────────

async function evaluateSellerTurnsV3(
  turns: TranscriptTurn[],
  narrative: ConversationNarrative,
  customerSignals: CustomerSignalResult[] = []
): Promise<TurnEvaluation[]> {
  const sellerTurns = turns.filter((t) => t.speaker === "seller");
  if (sellerTurns.length === 0) return [];

  // Full transcript for context (read-only, passed to every chunk)
  const transcriptContext = turns
    .map(
      (t) =>
        `[${t.idx}] ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`
    )
    .join("\n");

  // Build EPIC technique list from SSOT (exact canonical names)
  const ssotTechniqueList = buildSSOTTechniqueList();

  const houdingReactieMapping = buildHoudingReactieMapping();
  const epicSequenceContext = buildEPICSequenceContext();

  const systemPrompt = `Je bent een expert in de EPIC verkoopmethodologie van Hugo Herbots. Evalueer elk verkoper-bericht op gebruikte technieken — maar ook op de JUISTHEID van die keuze gezien de klanthouding en de fase-sequentie.

BESCHIKBARE TECHNIEKEN (SSOT):
${ssotTechniqueList}

EPIC METHODOLOGIE SEQUENTIE (SSOT):
${epicSequenceContext}

HOUDING-REACTIE VERWACHTINGEN (SSOT):
${houdingReactieMapping}

KWALITEITSNIVEAUS:
- perfect: techniek correct gekozen én goed uitgevoerd
- goed: techniek acceptabel gekozen, meeste stappen correct
- bijna: intentie aanwezig maar verkeerde techniek of onvolledige uitvoering
- gemist: foute keuze gegeven klanthouding of fase-sequentie, of techniek niet toegepast

EVALUATIELOGICA per seller-turn (drie lagen):
1. HOUDING CHECK: Kijk naar de vorige klanthouding (zie VORIGE KLANTHOUDING PER SELLER-TURN in de user prompt).
   Gebruikte de verkoper een techniek uit de HOUDING-REACTIE tabel voor die houding?
   - Ja → positief voor quality
   - Nee → vermeld in rationale: "Klant toonde [houding], verwacht: [techniek]. Verkoper deed: [andere techniek]."

2. SEQUENTIE CHECK: Mocht de verkoper deze Fase-N techniek hier gebruiken gegeven de EPIC SEQUENTIE STATUS?
   Gebruik de EPIC METHODOLOGIE SEQUENTIE en de epicSequenceAudit-flags om te beoordelen.
   Een Fase-3 techniek zonder voltooide Fase-2 = quality verlaagt (verkoper vertelt i.p.v. te ontdekken).
   Een Baat/Voordeel-stap zonder traceerbare grondslag in KLANT ONTHULDE = quality "bijna".

3. UITVOERING: Hoe goed werd de techniek technisch uitgevoerd (los van keuze en timing)?

Quality is de combinatie van 1+2+3. Geef max 2 technieken per turn.

OVERIGE REGELS:
- Actief luisteren vereist MINIMAAL parafraseren/samenvatten. Alleen "Ja", "Oké", "Hmhm" = GEEN techniek.
- Geef GEEN techniek als de turn te kort of te generiek is.
- Reserveer "perfect" voor volledige correcte toepassing.

Antwoord als JSON array van evaluaties, één per seller-turn:
[
  {
    "turnIdx": 0,
    "techniques": [{"id": "...", "naam": "...", "quality": "goed", "score": 7}],
    "overallQuality": "goed",
    "rationale": "Concrete uitleg — houding, sequentie én uitvoering"
  }
]`;

  // Build narrative context block for the prompt
  const revelationsText = narrative.customerRevelations?.length > 0
    ? `KLANT ONTHULDE (voor Baat/Voordeel grondslag-check):\n${narrative.customerRevelations.map((r) => `Turn ${r.turnIdx}: ${r.summary} [${r.type}]`).join("\n")}`
    : "";

  const auditText = narrative.epicSequenceAudit
    ? `EPIC SEQUENTIE STATUS:\nExplore: ${narrative.epicSequenceAudit.exploreHappened} | Probe: ${narrative.epicSequenceAudit.probeHappened} | Impact: ${narrative.epicSequenceAudit.impactHappened} | Commitment vóór oplossing: ${narrative.epicSequenceAudit.commitmentBeforeSolution}\nOplossing te vroeg gepresenteerd: ${narrative.epicSequenceAudit.solutionPresentedPrematurely}\nOpmerkingen: ${narrative.epicSequenceAudit.comments}`
    : "";

  const narrativeContext = [
    `GESPREKSSTRUCTUUR (LEES DIT EERST — evalueer turns in deze context):`,
    `${narrative.narrative}`,
    ``,
    `FASE-SEGMENTATIE:`,
    ...narrative.phases.map((p) => `- Turns ${p.startTurn}-${p.endTurn}: Fase ${p.phase} — ${p.description}`),
    ``,
    narrative.nonTechniqueTurns.length > 0
      ? `TURNS ZONDER TECHNIEK (begroetingen, fillers, small talk, te kort — geef hier NOOIT een techniek):\nTurns: ${narrative.nonTechniqueTurns.join(", ")}`
      : ``,
    revelationsText,
    auditText,
  ].filter(Boolean).join("\n");

  // Helper: find the most recent customer signal before a given seller turn
  const getPreviousCustomerHouding = (sellerTurnIdx: number): CustomerSignalResult | null => {
    return customerSignals
      .filter((s) => s.turnIdx < sellerTurnIdx)
      .sort((a, b) => b.turnIdx - a.turnIdx)[0] ?? null;
  };

  // Pre-fill evaluations for turns the narrative marks as non-technique
  const nonTechSet = new Set(narrative.nonTechniqueTurns);
  const turnsToEvaluate = sellerTurns.filter((t) => !nonTechSet.has(t.idx));
  const skippedCount = sellerTurns.length - turnsToEvaluate.length;
  if (skippedCount > 0) {
    console.log(`[V3 Analysis] Skipping ${skippedCount} non-technique turns (from narrative)`);
  }

  // Chunk evaluation to avoid output truncation on long conversations
  const CHUNK_SIZE = 25;
  const allEvaluations: TurnEvaluation[] = [];

  // Add empty evaluations for non-technique turns immediately
  for (const turn of sellerTurns) {
    if (nonTechSet.has(turn.idx)) {
      allEvaluations.push({
        turnIdx: turn.idx,
        techniques: [],
        overallQuality: "gemist",
        rationale: "Small talk / begroeting / te kort — geen techniek (narratief).",
      });
    }
  }

  const totalChunks = Math.ceil(turnsToEvaluate.length / CHUNK_SIZE);
  console.log(`[V3 Analysis] Evaluating ${turnsToEvaluate.length} seller turns in ${totalChunks} parallel chunks of ${CHUNK_SIZE}`);

  const evalChunks: TranscriptTurn[][] = [];
  for (let i = 0; i < turnsToEvaluate.length; i += CHUNK_SIZE) {
    evalChunks.push(turnsToEvaluate.slice(i, i + CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    evalChunks.map((chunk, chunkIdx) => {
      const chunkIdxs = chunk.map((t) => t.idx);
      const chunkNum = chunkIdx + 1;
      console.log(`[V3 Analysis] Chunk ${chunkNum}/${totalChunks}: evaluating turns ${chunkIdxs[0]}-${chunkIdxs[chunkIdxs.length - 1]}`);

      const turnHoudingContext = chunk
        .map((t) => {
          const prev = getPreviousCustomerHouding(t.idx);
          if (!prev) return `Turn ${t.idx}: geen voorafgaande klanthouding`;
          const expectedTechs = (prev.recommendedTechniqueIds ?? [])
            .map((id) => `${getTechniqueName(id) || id} (${id})`)
            .join(", ");
          return `Turn ${t.idx}: vorige klanthouding = ${prev.houding} — verwacht: [${expectedTechs || "n.v.t."}]`;
        })
        .join("\n");

      return callClaude(
        systemPrompt,
        `${narrativeContext}\n\nVORIGE KLANTHOUDING PER SELLER-TURN:\n${turnHoudingContext}\n\nTRANSCRIPT:\n${transcriptContext}\n\nEvalueer ALLEEN de volgende seller-turns: ${chunkIdxs.join(", ")}. Negeer alle andere turns in je output.`,
        8000,
        EVALUATION_MODEL
      ).then((result) => {
        const parsed = parseJSON<TurnEvaluation[]>(result, []);
        console.log(`[V3 Analysis] Chunk ${chunkNum}: ${parsed.length} evaluations returned`);
        return parsed;
      });
    })
  );

  for (const parsed of chunkResults) {
    allEvaluations.push(...parsed);
  }

  // Ensure all seller turns have evaluations
  const evaluatedIdxs = new Set(allEvaluations.map((e) => e.turnIdx));
  const missingCount = sellerTurns.filter((t) => !evaluatedIdxs.has(t.idx)).length;
  if (missingCount > 0) {
    console.log(`[V3 Analysis] Adding fallback for ${missingCount} unevaluated turns`);
  }
  for (const turn of sellerTurns) {
    if (!evaluatedIdxs.has(turn.idx)) {
      allEvaluations.push({
        turnIdx: turn.idx,
        techniques: [],
        overallQuality: "gemist",
        rationale: "Geen specifieke techniek gedetecteerd.",
      });
    }
  }

  return allEvaluations.sort((a, b) => a.turnIdx - b.turnIdx);
}

// ── SSOT Houding list builder ────────────────────────────────────────────────

function buildSSOTHoudingList(currentPhase: number): string {
  const filePath = path.join(process.cwd(), "config/klant_houdingen.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const lines: string[] = [];
  for (const [, h] of Object.entries(data.houdingen) as [string, any][]) {
    const restricted = h.fase_restrictie;
    if (!restricted.allowed_at_any_phase && !restricted.allowed_phases.includes(currentPhase)) {
      continue;
    }
    const shortDesc = h.houding_beschrijving.split("\n")[0];
    lines.push(`- ${h.id}: ${h.naam} — ${shortDesc}`);
  }
  return lines.join("\n");
}

// ── V3 Detect Customer Signals ───────────────────────────────────────────────

async function detectCustomerSignalsV3(
  turns: TranscriptTurn[],
  narrative: ConversationNarrative
): Promise<CustomerSignalResult[]> {
  const customerTurns = turns.filter((t) => t.speaker === "customer");
  if (customerTurns.length === 0) return [];

  // Phase lookup from narrative (replaces technique-count heuristic)
  const getPhaseForTurn = (turnIdx: number): number => {
    for (const p of narrative.phases) {
      if (turnIdx >= p.startTurn && turnIdx <= p.endTurn) return p.phase;
    }
    return narrative.phases[narrative.phases.length - 1]?.phase ?? 1;
  };

  // Overall phase for houdingList: use the highest phase in the narrative
  const overallPhase = Math.max(...narrative.phases.map((p) => p.phase), 1);

  const transcriptContext = turns
    .map((t) => `[${t.idx}] ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`)
    .join("\n");

  const houdingList = buildSSOTHoudingList(overallPhase);

  const narrativeContext = [
    `GESPREKSSTRUCTUUR:`,
    `${narrative.narrative}`,
    ``,
    `FASE-SEGMENTATIE (gebruik dit voor currentPhase per turn — volg deze indeling strikt):`,
    ...narrative.phases.map((p) => `- Turns ${p.startTurn}-${p.endTurn}: Fase ${p.phase} — ${p.description}`),
  ].join("\n");

  const systemPrompt = `Je classificeert klant-reacties in een verkoopgesprek op basis van de EPIC-methodologie.

KLANTHOUDINGEN (gebruik ALTIJD deze exacte IDs en namen):
${houdingList}

FASE-INSTRUCTIE:
- De currentPhase per turn ligt vast in de fase-segmentatie die je krijgt. Volg deze — wijk er alleen van af als het gesprek echt al duidelijk is overgegaan naar een andere fase.
- recommendedTechniqueIds: één of twee technieken die de VERKOPER NU zou moeten toepassen, gegeven de houding van de klant.

Antwoord als JSON array:
[
  {
    "turnIdx": 0,
    "houding": "H1: Positief antwoord",
    "confidence": 0.85,
    "recommendedTechniqueIds": ["2.1.1"],
    "currentPhase": 1
  }
]`;

  // Chunk customer turns to avoid JSON output truncation
  const CHUNK_SIZE = 25;
  const allSignals: CustomerSignalResult[] = [];

  const totalSignalChunks = Math.ceil(customerTurns.length / CHUNK_SIZE);
  console.log(`[V3 Analysis] Classifying ${customerTurns.length} customer turns in ${totalSignalChunks} parallel chunks of ${CHUNK_SIZE}`);

  const signalChunks: TranscriptTurn[][] = [];
  for (let i = 0; i < customerTurns.length; i += CHUNK_SIZE) {
    signalChunks.push(customerTurns.slice(i, i + CHUNK_SIZE));
  }

  const signalChunkResults = await Promise.all(
    signalChunks.map((chunk, chunkIdx) => {
      const chunkIdxs = chunk.map((t) => t.idx);
      const chunkNum = chunkIdx + 1;
      console.log(`[V3 Analysis] Signal chunk ${chunkNum}/${totalSignalChunks}: turns ${chunkIdxs[0]}-${chunkIdxs[chunkIdxs.length - 1]}`);

      return callClaude(
        systemPrompt,
        `${narrativeContext}\n\nTRANSCRIPT:\n${transcriptContext}\n\nClassificeer ALLEEN deze klant-turns: ${chunkIdxs.join(", ")}. Negeer alle andere turns in je output.`,
        4096,
        COACHING_MODEL  // Sonnet volstaat voor houding-classificatie
      ).then((result) => {
        const parsed = parseJSON<CustomerSignalResult[]>(result, []);
        console.log(`[V3 Analysis] Signal chunk ${chunkNum}: ${parsed.length} signals returned`);
        return parsed;
      });
    })
  );

  for (const parsed of signalChunkResults) {
    allSignals.push(...parsed);
  }

  // Ensure all customer turns have signals — fallback uses narrative phase
  const signalledIdxs = new Set(allSignals.map((s) => s.turnIdx));
  for (const turn of customerTurns) {
    if (!signalledIdxs.has(turn.idx)) {
      allSignals.push({
        turnIdx: turn.idx,
        houding: "H4: Te algemeen antwoord",
        confidence: 0.5,
        recommendedTechniqueIds: [],
        currentPhase: getPhaseForTurn(turn.idx),
      });
    }
  }

  // Enforce narrative phase — override Claude's currentPhase with narrative where they differ significantly
  for (const signal of allSignals) {
    const narrativePhase = getPhaseForTurn(signal.turnIdx);
    // Only override if Claude jumps more than 1 phase away from narrative
    if (Math.abs((signal.currentPhase ?? 1) - narrativePhase) > 1) {
      signal.currentPhase = narrativePhase;
    }
  }

  return allSignals.sort((a, b) => a.turnIdx - b.turnIdx);
}

// ── V3 Detect Missed Opportunities ──────────────────────────────────────────

async function detectMissedOpportunitiesV3(
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[],
  turns: TranscriptTurn[]
): Promise<MissedOpportunity[]> {
  const transcriptContext = turns
    .map(
      (t) =>
        `[${t.idx}] ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`
    )
    .join("\n");

  const evalContext = evaluations
    .map(
      (e) =>
        `Turn ${e.turnIdx}: ${e.techniques.map((t) => `${t.id} (${t.quality})`).join(", ") || "geen techniek"}`
    )
    .join("\n");

  const signalContext = signals
    .map((s) => `Turn ${s.turnIdx}: ${s.houding} (fase ${s.currentPhase})`)
    .join("\n");

  const systemPrompt = `Je bent een EPIC-verkoopcoach. Identificeer gemiste kansen in dit verkoopgesprek.

Types gemiste kansen:
- te_vroeg_fase_3_4: verkoper springt te vroeg naar fase 3/4 zonder voldoende discovery
- probe_gemist: kans om door te vragen (2.2) maar niet gedaan
- impact_gemist: kans om impact-vraag te stellen (2.3) maar niet gedaan
- commit_gemist: kans om commitment te vragen (2.4) maar niet gedaan
- twijfel_niet_uitgepakt: klant twijfelt maar verkoper gaat er niet op in
- bezwaar_overgeslagen: klant heeft bezwaar maar verkoper negeert het
- baat_niet_gemaakt: kans om baat concreet te maken maar niet gedaan

Antwoord als JSON array (max 5 gemiste kansen, meest impactvolle eerst):
[
  {
    "turnIdx": 5,
    "type": "probe_gemist",
    "description": "Klant noemde X maar verkoper ging er niet op door",
    "sellerSaid": "letterlijk citaat verkoper",
    "customerSaid": "letterlijk citaat klant",
    "betterQuestion": "Concrete betere vraag die de verkoper had kunnen stellen"
  }
]`;

  const result = await callClaude(
    systemPrompt,
    `TRANSCRIPT:\n${transcriptContext}\n\nEVALUATIES:\n${evalContext}\n\nKLANTSIGNALEN:\n${signalContext}\n\nIdentificeer de belangrijkste gemiste kansen.`,
    2000
  );

  return parseJSON<MissedOpportunity[]>(result, []);
}

// ── V3 Generate Coach Report ─────────────────────────────────────────────────

async function generateCoachReportV3(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[],
  phaseCoverage: PhaseCoverage,
  missedOpps: MissedOpportunity[],
  ssotContext: string,
  ragContext: string
): Promise<AnalysisInsights> {
  const turnSummaries = turns
    .map(
      (t) =>
        `[${t.idx}] ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`
    )
    .join("\n");

  const evalSummaries = evaluations
    .map(
      (e) =>
        `Turn ${e.turnIdx} (${e.overallQuality}): ${e.techniques.map((t) => `${t.id} ${t.naam} [${t.quality}]`).join(", ") || "geen"} — ${e.rationale}`
    )
    .join("\n");

  const signalSummaries = signals
    .map((s) => `Turn ${s.turnIdx}: ${s.houding} (fase ${s.currentPhase})`)
    .join("\n");

  const missedSummaries = missedOpps
    .map((m) => `Turn ${m.turnIdx} [${m.type}]: ${m.description}`)
    .join("\n");

  const ssotNames = buildSSOTTechniqueList();

  const systemPrompt = `Je bent Hugo Herbots, verkoopcoach en expert in de EPIC-methode. Je schrijft een coachrapport in het Nederlands over een verkoopgesprek.

Stijl: concreet, coachend, niet academisch. Gebruik "je" (informeel). Geef concrete voorbeelden met quotes uit het gesprek.

EPIC Technieken (gebruik ALTIJD deze exacte namen, NOOIT informele alternatieven):
${ssotNames}

REGELS:
- strengths: technieken die goed of perfect werden toegepast.
- improvements: technieken die beter konden.
- microExperiments: 3 concrete oefentips gebaseerd op SPECIFIEKE zwakke punten.

Genereer het rapport als JSON met deze structuur:
{
  "summaryMarkdown": "Korte samenvatting in markdown (3-4 zinnen)",
  "strengths": [{"text": "techniek-ID techniek-naam – kwaliteit", "quote": "letterlijk citaat", "turnIdx": 0}],
  "improvements": [{"text": "...", "quote": "...", "turnIdx": 0, "betterApproach": "..."}],
  "microExperiments": ["concrete oefening 1", "oefening 2", "oefening 3"],
  "overallScore": 65
}

Geef exact 3 strengths, 3 improvements en 3 micro-experimenten. Score van 0-100.`;

  const userPrompt = `GESPREKSTRANSCRIPT:\n${turnSummaries}\n\nTECHNIEK-EVALUATIES:\n${evalSummaries}\n\nKLANTSIGNALEN:\n${signalSummaries}\n\nFASE COVERAGE:\nFase 1: ${phaseCoverage.phase1.score}%\nFase 2: ${phaseCoverage.phase2.overall.score}% (Explore: ${phaseCoverage.phase2.explore.score}%, Probe: ${phaseCoverage.phase2.probe.found ? "ja" : "nee"}, Impact: ${phaseCoverage.phase2.impact.found ? "ja" : "nee"}, Commit: ${phaseCoverage.phase2.commit.found ? "ja" : "nee"})\nFase 3: ${phaseCoverage.phase3.score}%\nFase 4: ${phaseCoverage.phase4.score}%\nOverall: ${phaseCoverage.overall}%\n\nGEMISTE KANSEN:\n${missedSummaries || "Geen"}${ssotContext ? `\n\nMETHODIEK-CONTEXT:\n${ssotContext}` : ""}${ragContext ? `\n${ragContext}` : ""}\n\nSchrijf het coachrapport als JSON.`;

  const result = await callClaude(systemPrompt, userPrompt, 2000);
  const parsed = parseJSON<{
    summaryMarkdown: string;
    strengths: Array<{ text: string; quote: string; turnIdx: number }>;
    improvements: Array<{
      text: string;
      quote: string;
      turnIdx: number;
      betterApproach: string;
    }>;
    microExperiments: string[];
    overallScore: number;
  }>(result, {
    summaryMarkdown: "Analyse niet beschikbaar.",
    strengths: [],
    improvements: [],
    microExperiments: [],
    overallScore: phaseCoverage.overall,
  });

  return {
    phaseCoverage,
    missedOpportunities: missedOpps,
    summaryMarkdown: parsed.summaryMarkdown,
    strengths: parsed.strengths,
    improvements: parsed.improvements,
    microExperiments: parsed.microExperiments,
    overallScore: parsed.overallScore || phaseCoverage.overall,
  };
}

// ── V3 Generate Coach Artifacts ──────────────────────────────────────────────

async function generateCoachArtifactsV3(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[],
  phaseCoverage: PhaseCoverage,
  missedOpps: MissedOpportunity[],
  insights: AnalysisInsights,
  ssotContext: string,
  ragContext: string
): Promise<{ coachDebrief: CoachDebrief; moments: CoachMoment[] }> {
  const turnSummaries = turns
    .map(
      (t) =>
        `[${t.idx}] ${formatTimestamp(t.startMs)} ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`
    )
    .join("\n");

  const evalSummaries = evaluations
    .map(
      (e) =>
        `Turn ${e.turnIdx} (${e.overallQuality}): ${e.techniques.map((t) => `${t.id} [${t.quality}]`).join(", ") || "geen"}`
    )
    .join("\n");

  const signalSummaries = signals
    .map((s) => `Turn ${s.turnIdx}: ${s.houding}`)
    .join("\n");

  const missedSummaries = missedOpps
    .map(
      (m) =>
        `Turn ${m.turnIdx} [${m.type}]: ${m.description} — beter: "${m.betterQuestion}"`
    )
    .join("\n");

  const systemPrompt = `Je bent Hugo Herbots, verkoopcoach. Je genereert een coach-debrief en 3 key moments uit een verkoopgesprek.

STIJL: Coachend, direct, informeel ("je"). GEEN rapport-taal, GEEN schoolcijfers. Praat alsof je naast de verkoper zit na het gesprek.

Je output is JSON met deze structuur:
{
  "oneliner": "1 zin die de kern samenvat, coachend en specifiek",
  "epicMomentum": "Kort (1-2 zinnen) over hoe goed de EPIC-flow liep",
  "moments": [
    {
      "type": "big_win",
      "turnIndex": 0,
      "label": "Korte beschrijving van het moment",
      "whyItMatters": "Waarom dit goed was, in coachtaal",
      "betterAlternative": "",
      "recommendedTechniques": ["2.1"]
    },
    {
      "type": "quick_fix",
      "turnIndex": 0,
      "label": "Korte beschrijving",
      "whyItMatters": "Waarom dit beter kan",
      "betterAlternative": "Concrete betere vraag of aanpak",
      "recommendedTechniques": ["2.3"]
    },
    {
      "type": "turning_point",
      "turnIndex": 0,
      "label": "Korte beschrijving",
      "whyItMatters": "Waarom dit het scharnierpunt is",
      "betterAlternative": "Concrete betere aanpak",
      "recommendedTechniques": ["2.2"]
    }
  ],
  "debriefMessages": [
    {"type": "coach_text", "text": "..."},
    {"type": "moment_ref", "momentType": "big_win"},
    {"type": "coach_text", "text": "..."},
    {"type": "moment_ref", "momentType": "quick_fix"},
    {"type": "coach_text", "text": "..."},
    {"type": "moment_ref", "momentType": "turning_point"}
  ]
}

REGELS:
- big_win: het sterkste moment. Geen betterAlternative nodig.
- quick_fix: iets met 1 kleine aanpassing. betterAlternative verplicht.
- turning_point: HET scharnierpunt met hoogste impact. betterAlternative verplicht.
- turnIndex moet verwijzen naar echte turn (gebruik [idx] nummers).
- recommendedTechniques: gebruik techniek-IDs (bv "2.1", "2.3").
- Schrijf in het Nederlands.`;

  const userPrompt = `TRANSCRIPT (${turns.length} turns):\n${turnSummaries}\n\nTECHNIEK-EVALUATIES:\n${evalSummaries}\n\nKLANTSIGNALEN:\n${signalSummaries}\n\nGEMISTE KANSEN:\n${missedSummaries || "Geen"}\n\nFASE SCORES: Overall ${phaseCoverage.overall}%, F1: ${phaseCoverage.phase1.score}%, F2: ${phaseCoverage.phase2.overall.score}%, F3: ${phaseCoverage.phase3.score}%, F4: ${phaseCoverage.phase4.score}%${ssotContext ? `\n\nMETHODIEK-CONTEXT:\n${ssotContext}` : ""}${ragContext ? `\n${ragContext}` : ""}\n\nGenereer de coach debrief + 3 moments als JSON.`;

  const result = await callClaude(systemPrompt, userPrompt, 3000);

  const parsed = parseJSON<{
    oneliner: string;
    epicMomentum: string;
    moments: Array<{
      type: "big_win" | "quick_fix" | "turning_point";
      turnIndex: number;
      label: string;
      whyItMatters: string;
      betterAlternative: string;
      recommendedTechniques: string[];
    }>;
    debriefMessages: Array<{
      type: "coach_text" | "moment_ref" | "scoreboard";
      text?: string;
      momentType?: string;
    }>;
  }>(result, {
    oneliner: "Analyse niet beschikbaar.",
    epicMomentum: "",
    moments: [],
    debriefMessages: [],
  });

  // Build CoachMoments with full context
  const moments: CoachMoment[] = parsed.moments.map((m, i) => {
    const turn = turns[m.turnIndex] || turns[0];
    const prevTurn =
      turns.find(
        (t) => t.idx === m.turnIndex - 1 && t.speaker !== turn?.speaker
      ) || turns[Math.max(0, m.turnIndex - 1)];
    const signal = signals.find((s) => s.turnIdx === m.turnIndex);

    // Determine phase from evaluation
    const evalForTurn = evaluations.find((e) => e.turnIdx === m.turnIndex);
    let phase = signal?.currentPhase || 2;
    if (evalForTurn?.techniques?.[0]?.id) {
      const p = parseInt(evalForTurn.techniques[0].id.charAt(0));
      if (p >= 1 && p <= 4) phase = p;
    }

    return {
      id: `moment-${m.type}-${i}`,
      timestamp: turn ? formatTimestamp(turn.startMs) : "00:00",
      turnIndex: m.turnIndex,
      phase,
      label: m.label,
      type: m.type,
      customerSignal: signal?.houding,
      sellerText:
        turn?.speaker === "seller"
          ? turn.text
          : prevTurn?.text || "",
      customerText:
        turn?.speaker === "customer"
          ? turn.text
          : prevTurn?.text || "",
      whyItMatters: m.whyItMatters,
      betterAlternative: m.betterAlternative || "",
      recommendedTechniques: m.recommendedTechniques || [],
      replay: {
        startTurnIndex: Math.max(0, m.turnIndex - 2),
        contextTurns: 4,
      },
    };
  });

  // Add video recommendations (Map<momentType, VideoRecommendation[]>)
  try {
    const videoMap = buildVideoRecommendationsForMoments(moments);
    for (const moment of moments) {
      const videos = videoMap.get(moment.type);
      if (videos && videos.length > 0) {
        (moment as any).videoRecommendations = videos;
      }
    }
  } catch {
    // Video recommendations are optional
  }

  // Build debrief
  const messages: CoachDebriefMessage[] = (parsed.debriefMessages || []).map(
    (msg) => {
      if (msg.type === "moment_ref") {
        const moment = moments.find((m) => m.type === msg.momentType);
        return {
          type: "moment_ref" as const,
          momentId: moment?.id || `moment-${msg.momentType}-0`,
        };
      }
      return {
        type: "coach_text" as const,
        text: msg.text || "",
      };
    }
  );

  const coachDebrief: CoachDebrief = {
    oneliner: parsed.oneliner,
    epicMomentum: parsed.epicMomentum,
    messages,
  };

  return { coachDebrief, moments };
}

// ── V3 Full Analysis Pipeline ────────────────────────────────────────────────

const analysisJobsV3 = new Map<string, ConversationAnalysis>();
const analysisResultsV3 = new Map<string, FullAnalysisResult>();

export async function runFullAnalysisV3(
  conversationId: string,
  storageKey: string,
  userId: string,
  title?: string
): Promise<void> {
  const effectiveTitle =
    title || `Analyse ${new Date().toLocaleDateString("nl-NL")}`;
  const job: ConversationAnalysis = {
    id: conversationId,
    userId,
    title: effectiveTitle,
    type: "upload",
    status: "transcribing",
    consentConfirmed: true,
    createdAt: new Date().toISOString(),
  };
  analysisJobsV3.set(conversationId, job);

  try {
    await pool.query(
      `INSERT INTO conversation_analyses (id, user_id, title, status, created_at, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET status = $4, storage_key = $6`,
      [
        conversationId,
        userId,
        effectiveTitle,
        "transcribing",
        new Date().toISOString(),
        storageKey,
      ]
    );
  } catch (err: any) {
    console.warn("[V3 Analysis] DB initial insert failed:", err.message);
  }

  try {
    // 1. Transcribe (reuse V2 — Whisper is Whisper)
    console.log(`[V3 Analysis] Transcribing: ${conversationId}`);
    const segments = await transcribeAudio(storageKey);

    // 2. Build turns (pure code)
    job.status = "analyzing";
    analysisJobsV3.set(conversationId, { ...job });
    await persistStatus(conversationId, "analyzing");
    const turns = await buildTurns(segments);

    if (turns.length === 0) {
      throw new Error("Geen spraak gedetecteerd in het audiobestand.");
    }

    // 3. Evaluate with Claude
    job.status = "evaluating";
    analysisJobsV3.set(conversationId, { ...job });
    await persistStatus(conversationId, "evaluating");

    console.log(`[V3 Analysis] Analyzing conversation narrative`);
    // 3a. Narrative analysis — understand the conversation before evaluating turns
    const narrative = await analyzeConversationNarrative(turns);

    console.log(`[V3 Analysis] Evaluating ${turns.length} turns with Claude`);
    // Sequential to avoid concurrent Claude calls hitting rate limits
    // Both functions now receive the narrative for grounded context
    // Detect customer signals FIRST so seller evaluation gets klanthouding context
    const signalsWithContext = await detectCustomerSignalsV3(turns, narrative);
    const evaluations = await evaluateSellerTurnsV3(turns, narrative, signalsWithContext);

    // 4. Calculate phase coverage (pure code)
    const phaseCoverage = calculatePhaseCoverage(evaluations, turns);

    // 5. Detect missed opportunities with Claude
    const missedOpps = await detectMissedOpportunitiesV3(
      evaluations,
      signalsWithContext,
      turns
    );

    // 6. Build SSOT + RAG context
    const allDetectedTechIds = evaluations.flatMap((e) =>
      e.techniques.map((t) => t.id)
    );
    const uniqueTechIds = [...new Set(allDetectedTechIds)];
    const ssotContext = buildSSOTContextForEvaluation(uniqueTechIds);

    let ragContext = "";
    try {
      const techNames = uniqueTechIds
        .slice(0, 3)
        .map((id) => {
          const t = getTechnique(id);
          return t ? t.naam : id;
        })
        .join(", ");
      const ragQuery = `verkooptechnieken feedback: ${techNames}`;
      const ragResult = await searchRag(ragQuery, {
        limit: 3,
        threshold: 0.25,
      });
      if (ragResult.documents.length > 0) {
        ragContext =
          "\nRAG GROUNDING (cursusmateriaal & eerdere correcties):\n" +
          ragResult.documents
            .map(
              (d) =>
                `- [${d.docType}] ${d.title}: ${d.content.substring(0, 200)}`
            )
            .join("\n");
      }
    } catch (ragErr: any) {
      console.warn(
        "[V3 Analysis] RAG search failed (non-fatal):",
        ragErr.message
      );
    }

    // 7. Generate coach report with Claude
    job.status = "generating_report";
    analysisJobsV3.set(conversationId, { ...job });
    await persistStatus(conversationId, "generating_report");

    console.log(`[V3 Analysis] Generating coach report with Claude`);
    const insights = await generateCoachReportV3(
      turns,
      evaluations,
      signalsWithContext,
      phaseCoverage,
      missedOpps,
      ssotContext,
      ragContext
    );

    // 8. Generate coach artifacts with Claude
    const { coachDebrief, moments } = await generateCoachArtifactsV3(
      turns,
      evaluations,
      signalsWithContext,
      phaseCoverage,
      missedOpps,
      insights,
      ssotContext,
      ragContext
    );
    insights.coachDebrief = coachDebrief;
    insights.moments = moments;

    // 9. Compute detailed metrics
    try {
      const detailedMetrics = await computeDetailedMetrics(
        turns,
        evaluations,
        signalsWithContext,
        phaseCoverage
      );
      insights.detailedMetrics = detailedMetrics;
    } catch (err: any) {
      console.warn(
        "[V3 Analysis] Detailed metrics failed (non-fatal):",
        err.message
      );
    }

    // 10. Store results
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    analysisJobsV3.set(conversationId, { ...job });

    const fullResult: FullAnalysisResult = {
      conversation: { ...job },
      transcript: turns,
      evaluations,
      signals: signalsWithContext,
      insights,
    };

    analysisResultsV3.set(conversationId, fullResult);

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, completed_at = $2, result = $3 WHERE id = $4`,
        [
          "completed",
          new Date().toISOString(),
          JSON.stringify(fullResult),
          conversationId,
        ]
      );
    } catch (err: any) {
      console.warn("[V3 Analysis] DB completed update failed:", err.message);
    }

    // Cleanup temp file
    try {
      const cleanupPath = path.join(UPLOAD_DIR, storageKey);
      if (fs.existsSync(cleanupPath)) {
        fs.unlinkSync(cleanupPath);
      }
    } catch { /* cleanup best-effort */ }

    console.log(
      `[V3 Analysis] Complete: ${conversationId} — score ${insights.overallScore}%`
    );
  } catch (err: any) {
    console.error(`[V3 Analysis] Failed: ${conversationId}`, err);
    job.status = "failed";
    job.error = sanitizeAnalysisError(err);
    analysisJobsV3.set(conversationId, { ...job });

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, error = $2 WHERE id = $3`,
        ["failed", sanitizeAnalysisError(err), conversationId]
      );
    } catch (dbErr: any) {
      console.warn("[V3 Analysis] DB error update failed:", dbErr.message);
    }
  }
}

// ── V3 Re-Analyze from existing transcript (no audio needed) ────────────────

export async function reAnalyzeFromTranscriptV3(
  conversationId: string,
  existingTurns: TranscriptTurn[],
  userId: string,
  title?: string
): Promise<void> {
  const effectiveTitle = title || `Analyse ${new Date().toLocaleDateString("nl-NL")}`;
  const job: ConversationAnalysis = {
    id: conversationId,
    userId,
    title: effectiveTitle,
    type: "upload",
    status: "evaluating",
    consentConfirmed: true,
    createdAt: new Date().toISOString(),
  };
  analysisJobsV3.set(conversationId, job);

  try {
    const turns = existingTurns;
    if (turns.length === 0) {
      throw new Error("Geen transcript turns beschikbaar voor re-analyse.");
    }

    console.log(`[V3 Re-Analysis] Re-evaluating ${turns.length} turns with Claude for ${conversationId}`);

    // Steps 3-10 identical to runFullAnalysisV3
    job.status = "evaluating";
    analysisJobsV3.set(conversationId, { ...job });
    await persistStatus(conversationId, "evaluating");

    console.log(`[V3 Re-Analysis] Analyzing conversation narrative`);
    const narrative = await analyzeConversationNarrative(turns);

    // Detect customer signals FIRST so seller evaluation gets klanthouding context
    const signalsWithContext = await detectCustomerSignalsV3(turns, narrative);
    const evaluations = await evaluateSellerTurnsV3(turns, narrative, signalsWithContext);
    const phaseCoverage = calculatePhaseCoverage(evaluations, turns);

    const missedOpps = await detectMissedOpportunitiesV3(evaluations, signalsWithContext, turns);

    const allDetectedTechIds = evaluations.flatMap((e) => e.techniques.map((t) => t.id));
    const uniqueTechIds = [...new Set(allDetectedTechIds)];
    const ssotContext = buildSSOTContextForEvaluation(uniqueTechIds);

    let ragContext = "";
    try {
      const techNames = uniqueTechIds.slice(0, 3).map((id) => {
        const t = getTechnique(id);
        return t ? t.naam : id;
      }).join(", ");
      const ragResult = await searchRag(`verkooptechnieken feedback: ${techNames}`, { limit: 3, threshold: 0.25 });
      if (ragResult.documents.length > 0) {
        ragContext = "\nRAG GROUNDING (cursusmateriaal & eerdere correcties):\n" +
          ragResult.documents.map((d) => `- [${d.docType}] ${d.title}: ${d.content.substring(0, 200)}`).join("\n");
      }
    } catch (ragErr: any) {
      console.warn("[V3 Re-Analysis] RAG search failed (non-fatal):", ragErr.message);
    }

    job.status = "generating_report";
    analysisJobsV3.set(conversationId, { ...job });
    await persistStatus(conversationId, "generating_report");

    const insights = await generateCoachReportV3(turns, evaluations, signalsWithContext, phaseCoverage, missedOpps, ssotContext, ragContext);
    const { coachDebrief, moments } = await generateCoachArtifactsV3(turns, evaluations, signalsWithContext, phaseCoverage, missedOpps, insights, ssotContext, ragContext);
    insights.coachDebrief = coachDebrief;
    insights.moments = moments;

    try {
      const detailedMetrics = await computeDetailedMetrics(turns, evaluations, signalsWithContext, phaseCoverage);
      insights.detailedMetrics = detailedMetrics;
    } catch (err: any) {
      console.warn("[V3 Re-Analysis] Detailed metrics failed (non-fatal):", err.message);
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    analysisJobsV3.set(conversationId, { ...job });

    const fullResult: FullAnalysisResult = {
      conversation: { ...job },
      transcript: turns,
      evaluations,
      signals: signalsWithContext,
      insights,
    };
    analysisResultsV3.set(conversationId, fullResult);

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, completed_at = $2, result = $3 WHERE id = $4`,
        ["completed", new Date().toISOString(), JSON.stringify(fullResult), conversationId]
      );
    } catch (err: any) {
      console.warn("[V3 Re-Analysis] DB completed update failed:", err.message);
    }

    console.log(`[V3 Re-Analysis] Complete: ${conversationId} — score ${insights.overallScore}%`);
  } catch (err: any) {
    console.error(`[V3 Re-Analysis] Failed: ${conversationId}`, err);
    job.status = "failed";
    job.error = sanitizeAnalysisError(err);
    analysisJobsV3.set(conversationId, { ...job });
    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, error = $2 WHERE id = $3`,
        ["failed", sanitizeAnalysisError(err), conversationId]
      );
    } catch (dbErr: any) {
      console.warn("[V3 Re-Analysis] DB error update failed:", dbErr.message);
    }
  }
}

async function persistStatus(
  conversationId: string,
  status: string
): Promise<void> {
  try {
    await pool.query(
      "UPDATE conversation_analyses SET status = $1 WHERE id = $2",
      [status, conversationId]
    );
  } catch (e) { console.error('[V3 Analysis] Error updating analysis status:', e); }
}
