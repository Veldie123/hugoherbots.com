/**
 * Live Analyse Service — Real-time coaching tip generation
 *
 * Claude detects the customer attitude (H1-H9), then this service
 * looks up recommended techniques from SSOT configs (klant_houdingen.json
 * + technieken_index.json) to build SSOT-bound coaching tips.
 *
 * Tips ALWAYS use exact SSOT terminology — never paraphrased names.
 */

import { getAnthropicClient } from "./anthropic-client";
import { getTechnique } from "../ssot-loader";
import { buildLiveAnalyseSystemPrompt } from "./live-analyse-prompt";
import * as fs from "fs";
import * as path from "path";

// Use Sonnet for speed (~1-2s per call)
const LIVE_ANALYSE_MODEL = "claude-sonnet-4-20250514";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClaudeAnalysis {
  houding_id: string;
  houding_naam: string;
  detected_technique: string | null;
  phase: number;
  new_phase: number | null;
}

export interface TipResult {
  tipType: "wedervraag" | "lock" | "waarschuwing" | "open" | "positief";
  tipText: string;
  houdingId: string;
  houdingNaam: string;
  detectedTechnique: string | null;
  recommendedTechnique: string | null;
  phase: number;
  newPhase: number | null;
}

// ── Houding → Tip Type mapping ───────────────────────────────────────────────

const HOUDING_TIP_TYPE: Record<string, TipResult["tipType"]> = {
  H1: "positief",
  H2: "waarschuwing",
  H3: "open",
  H4: "open",
  H5: "wedervraag",
  H6: "lock",
  H7: "lock",
  H8: "lock",
  H9: "lock",
};

// ── Tip labels (what the seller sees) ────────────────────────────────────────

const TIP_LABELS: Record<TipResult["tipType"], string> = {
  positief: "Goed bezig",
  waarschuwing: "Let op",
  open: "Verdiep",
  wedervraag: "Wedervraag",
  lock: "Lock",
};

// ── SSOT Houding loader ──────────────────────────────────────────────────────

interface HoudingData {
  id: string;
  naam: string;
  recommended_technique_ids: string[];
}

let houdingCache: Map<string, HoudingData> | null = null;

function loadHoudingen(): Map<string, HoudingData> {
  if (houdingCache) return houdingCache;

  const filePath = path.join(process.cwd(), "config/klant_houdingen.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  houdingCache = new Map();
  for (const [, houding] of Object.entries(data.houdingen) as [string, any][]) {
    houdingCache.set(houding.id, {
      id: houding.id,
      naam: houding.naam,
      recommended_technique_ids: houding.recommended_technique_ids || [],
    });
  }
  return houdingCache;
}

// ── Core analysis function ───────────────────────────────────────────────────

/**
 * Analyze a customer turn and generate a coaching tip.
 *
 * Flow:
 * 1. Send transcript to Claude → get houding_id
 * 2. Look up recommended_technique_ids from klant_houdingen.json
 * 3. Look up technique naam + stappenplan from technieken_index.json
 * 4. Build tip text using exact SSOT terminology
 */
export async function analyzeTurn(
  recentTranscript: string,
  currentPhase: number,
  sessionContext?: string
): Promise<TipResult | null> {
  const client = getAnthropicClient();
  const systemPrompt = buildLiveAnalyseSystemPrompt(currentPhase);

  let userPrompt = `Laatste transcript:\n${recentTranscript}`;
  if (sessionContext) {
    userPrompt = `Context: ${sessionContext}\n\n${userPrompt}`;
  }

  const response = await client.messages.create({
    model: LIVE_ANALYSE_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Parse Claude's JSON response
  let analysis: ClaudeAnalysis;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    analysis = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[LiveAnalyse] Failed to parse Claude response:", text);
    return null;
  }

  // Validate houding_id
  const houdingId = analysis.houding_id?.toUpperCase();
  if (!houdingId || !/^H[1-9]$/.test(houdingId)) {
    console.error("[LiveAnalyse] Invalid houding_id:", analysis.houding_id);
    return null;
  }

  // Look up SSOT data
  const houdingen = loadHoudingen();
  const houding = houdingen.get(houdingId);
  if (!houding) return null;

  const tipType = HOUDING_TIP_TYPE[houdingId] || "open";
  const tipLabel = TIP_LABELS[tipType];

  // Get first recommended technique from SSOT
  const recommendedIds = houding.recommended_technique_ids;
  const firstRecId = recommendedIds[0];
  const technique = firstRecId ? getTechnique(String(firstRecId)) : undefined;

  // Build tip text using EXACT SSOT terminology
  let tipText: string;
  if (technique) {
    const firstStep = technique.stappenplan?.[0] || "";
    const stepSuffix = firstStep ? ` — ${firstStep}` : "";
    tipText = `${tipLabel}: Gebruik **${technique.naam}** (${technique.nummer})${stepSuffix}`;
  } else {
    // Fallback: still use SSOT houding name
    tipText = `${tipLabel}: ${houding.naam} gedetecteerd`;
  }

  return {
    tipType,
    tipText,
    houdingId,
    houdingNaam: houding.naam,
    detectedTechnique: analysis.detected_technique || null,
    recommendedTechnique: technique ? `${technique.nummer}: ${technique.naam}` : null,
    phase: analysis.phase || currentPhase,
    newPhase: analysis.new_phase || null,
  };
}
