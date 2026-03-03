/**
 * V3 Analysis Service — Claude-powered conversation analysis
 *
 * Replaces OpenAI LLM calls in the V2 analysis pipeline with Claude.
 * Reuses V2's transcription, turn building, and phase calculation (pure code).
 * Used only for superadmin (stephane@hugoherbots.com).
 */
import { getAnthropicClient, COACHING_MODEL } from "./anthropic-client";
import { getTechnique } from "../ssot-loader";
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
import * as path from "path";
import * as fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: COACHING_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const textBlocks = response.content.filter(
    (b): b is { type: "text"; text: string } => b.type === "text"
  );
  return textBlocks.map((b) => b.text).join("");
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    return JSON.parse(cleaned);
  } catch {
    console.warn("[V3 Analysis] JSON parse failed, using fallback");
    return fallback;
  }
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ── V3 Evaluate Seller Turns ─────────────────────────────────────────────────

async function evaluateSellerTurnsV3(
  turns: TranscriptTurn[]
): Promise<TurnEvaluation[]> {
  const sellerTurns = turns.filter((t) => t.speaker === "seller");
  if (sellerTurns.length === 0) return [];

  // Build transcript context
  const transcriptContext = turns
    .map(
      (t) =>
        `[${t.idx}] ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`
    )
    .join("\n");

  const systemPrompt = `Je bent een expert in de EPIC verkoopmethodologie van Hugo Herbots. Evalueer elk seller-bericht in het transcript op gebruikte technieken.

EPIC Fasen:
- Fase 1 (Opening): Koopklimaat (1.1), Gentleman's Agreement (1.2), Instapvraag (1.3)
- Fase 2 (Ontdekking): Explore (2.1.x), Probe/Storytelling (2.2.x), Impact (2.3.x), Commit (2.4.x)
- Fase 3 (Aanbeveling): OVB (3.1), USP's (3.2), Mening vragen (3.3)
- Fase 4 (Beslissing): Bezwaarbehandeling (4.1.x), Closing (4.2.x)

Kwaliteitsniveaus:
- perfect: alle stappen correct toegepast
- goed: meeste stappen correct
- bijna: intentie aanwezig maar onvolledig
- gemist: techniek niet toegepast waar het had moeten

Antwoord als JSON array van evaluaties, één per seller-turn:
[
  {
    "turnIdx": 0,
    "techniques": [{"id": "2.1.3", "naam": "Doorvragen", "quality": "goed", "score": 7}],
    "overallQuality": "goed",
    "rationale": "Korte uitleg waarom"
  }
]

Wees concreet en verwijs naar specifieke techniek-IDs.`;

  const result = await callClaude(
    systemPrompt,
    `TRANSCRIPT:\n${transcriptContext}\n\nEvalueer alle seller-turns (${sellerTurns.map((t) => t.idx).join(", ")}).`,
    3000
  );

  const parsed = parseJSON<TurnEvaluation[]>(result, []);

  // Ensure all seller turns have evaluations
  const evaluatedIdxs = new Set(parsed.map((e) => e.turnIdx));
  for (const turn of sellerTurns) {
    if (!evaluatedIdxs.has(turn.idx)) {
      parsed.push({
        turnIdx: turn.idx,
        techniques: [],
        overallQuality: "gemist",
        rationale: "Geen specifieke techniek gedetecteerd.",
      });
    }
  }

  return parsed.sort((a, b) => a.turnIdx - b.turnIdx);
}

// ── V3 Detect Customer Signals ───────────────────────────────────────────────

async function detectCustomerSignalsV3(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[]
): Promise<CustomerSignalResult[]> {
  const customerTurns = turns.filter((t) => t.speaker === "customer");
  if (customerTurns.length === 0) return [];

  // Determine current phase from evaluations
  let currentPhase = 1;
  for (const evalItem of evaluations) {
    for (const tech of evalItem.techniques) {
      const phaseNum = parseInt(tech.id.charAt(0));
      if (phaseNum > currentPhase) currentPhase = phaseNum;
    }
  }

  const transcriptContext = turns
    .map(
      (t) =>
        `[${t.idx}] ${t.speaker === "seller" ? "VERKOPER" : "KLANT"}: ${t.text}`
    )
    .join("\n");

  const systemPrompt = `Je classificeert klant-reacties in een verkoopgesprek op basis van de EPIC-methodologie.

Mogelijke houdingen:
- positief: klant toont interesse, bevestigt, is enthousiast
- negatief: klant uit ontevredenheid, kritiek
- vaag: klant geeft geen duidelijk standpunt
- ontwijkend: klant wijkt bewust af van de vraag
- vraag: klant stelt een vraag
- interesse: klant toont expliciete interesse
- akkoord: klant stemt in
- neutraal: neutraal antwoord
${currentPhase >= 3 ? "- twijfel: klant is onzeker over beslissing\n- bezwaar: klant brengt tegenargument\n- uitstel: klant wil beslissing uitstellen" : ""}

Antwoord als JSON array:
[
  {
    "turnIdx": 0,
    "houding": "positief",
    "confidence": 0.85,
    "recommendedTechniqueIds": ["2.1.3"],
    "currentPhase": 2
  }
]`;

  const result = await callClaude(
    systemPrompt,
    `TRANSCRIPT:\n${transcriptContext}\n\nClassificeer alle klant-turns (${customerTurns.map((t) => t.idx).join(", ")}).`,
    2000
  );

  const parsed = parseJSON<CustomerSignalResult[]>(result, []);

  // Ensure all customer turns have signals
  const signalledIdxs = new Set(parsed.map((s) => s.turnIdx));
  for (const turn of customerTurns) {
    if (!signalledIdxs.has(turn.idx)) {
      parsed.push({
        turnIdx: turn.idx,
        houding: "neutraal",
        confidence: 0.5,
        recommendedTechniqueIds: [],
        currentPhase,
      });
    }
  }

  return parsed.sort((a, b) => a.turnIdx - b.turnIdx);
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

  const systemPrompt = `Je bent Hugo Herbots, verkoopcoach en expert in de EPIC-methode. Je schrijft een coachrapport in het Nederlands over een verkoopgesprek.

Stijl: concreet, coachend, niet academisch. Gebruik "je" (informeel). Geef concrete voorbeelden met quotes uit het gesprek.

EPIC staat voor: Explore (2.1), Probe (2.2), Impact (2.3), Commitment (2.4).

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

  // Add video recommendations
  try {
    const enriched = buildVideoRecommendationsForMoments(moments);
    moments.splice(0, moments.length, ...enriched);
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

    console.log(`[V3 Analysis] Evaluating ${turns.length} turns with Claude`);
    const [evaluations, signals] = await Promise.all([
      evaluateSellerTurnsV3(turns),
      detectCustomerSignalsV3(turns, []), // First pass without evals
    ]);

    // Re-detect signals with evaluation context
    const signalsWithContext = await detectCustomerSignalsV3(turns, evaluations);

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
    } catch {}

    console.log(
      `[V3 Analysis] Complete: ${conversationId} — score ${insights.overallScore}%`
    );
  } catch (err: any) {
    console.error(`[V3 Analysis] Failed: ${conversationId}`, err);
    job.status = "failed";
    job.error = err.message || "Onbekende fout";
    analysisJobsV3.set(conversationId, { ...job });

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, error = $2 WHERE id = $3`,
        ["failed", err.message || "Onbekende fout", conversationId]
      );
    } catch (dbErr: any) {
      console.warn("[V3 Analysis] DB error update failed:", dbErr.message);
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
  } catch {}
}
