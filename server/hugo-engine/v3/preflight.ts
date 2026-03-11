/**
 * Preflight Brain Generation — Hugo's Session Preparation
 *
 * At login, Sonnet + extended thinking processes ALL user context and generates
 * Hugo's "brain" — a coaching plan, customer persona, and pre-computed answers.
 * This brain is injected into the system prompt at session start, eliminating
 * the need for slow tool calls (recall_memories, get_user_profile, etc.)
 *
 * Architecture:
 *   Login → buildUserBriefing() + extra data → Sonnet (thinking) → Brain document → Cache
 *   Session start → Load cached brain → Inject in system prompt → Fast responses
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { getAnthropicClient, COACHING_MODEL } from "./anthropic-client";
import { buildUserBriefing, formatBriefingForPrompt } from "./user-briefing";
import { getMemoriesForUser } from "./memory-service";
import { getActiveBrainTemplate } from "./brain-template";
import { pool } from "../db";
import { supabase } from "../supabase-client";

// ── Types ───────────────────────────────────────────────────────────────────

export interface BrainResult {
  brain: string;
  contextHash: string;
  templateVersion: number;
  cached: boolean;
  timing: {
    totalMs: number;
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
  };
}

// ── In-Memory Cache ─────────────────────────────────────────────────────────

const brainCache = new Map<string, { brain: string; hash: string; version: number; ts: number }>();
const MEMORY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── SSOT Data Loading (cached) ──────────────────────────────────────────────

let cachedTechniqueList: string | null = null;
let cachedHoudingen: string | null = null;

function getCompactTechniqueList(): string {
  if (cachedTechniqueList) return cachedTechniqueList;
  try {
    const techPath = join(process.cwd(), "config/ssot/technieken_index.json");
    const techniques = JSON.parse(readFileSync(techPath, "utf-8"));
    cachedTechniqueList = techniques
      .map((t: any) => `${t.id || t.nummer}: ${t.naam || t.title}`)
      .join("\n");
  } catch {
    cachedTechniqueList = "(technieken niet beschikbaar)";
  }
  return cachedTechniqueList;
}

function getCompactHoudingen(): string {
  if (cachedHoudingen) return cachedHoudingen;
  try {
    const hPath = join(process.cwd(), "config/klant_houdingen.json");
    const houdingen = JSON.parse(readFileSync(hPath, "utf-8"));
    cachedHoudingen = houdingen
      .map((h: any) => `${h.id}: ${h.naam} — ${h.houding_beschrijving?.slice(0, 80) || ""}`)
      .join("\n");
  } catch {
    cachedHoudingen = "(houdingen niet beschikbaar)";
  }
  return cachedHoudingen;
}

// ── Extra Data Fetchers ─────────────────────────────────────────────────────

async function fetchSellerContext(userId: string): Promise<any> {
  try {
    const result = await pool.query(
      `SELECT context FROM v2_sessions
       WHERE user_id = $1 AND context IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.context || {};
  } catch {
    return {};
  }
}

async function fetchRecentAnalysesSummaries(userId: string): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT result->'insights'->'summaryMarkdown' as summary,
              result->'insights'->'strengths' as strengths,
              result->'insights'->'improvements' as improvements
       FROM conversation_analyses
       WHERE user_id = $1 AND status = 'complete' AND id NOT LIKE 'session-%'
       ORDER BY completed_at DESC LIMIT 3`,
      [userId]
    );
    return result.rows
      .filter((r: any) => r.summary)
      .map((r: any) => {
        const parts = [r.summary];
        if (r.strengths) parts.push(`Sterke punten: ${JSON.stringify(r.strengths)}`);
        if (r.improvements) parts.push(`Verbeterpunten: ${JSON.stringify(r.improvements)}`);
        return parts.join("\n");
      });
  } catch {
    return [];
  }
}

// ── Context Hash ────────────────────────────────────────────────────────────

function computeContextHash(
  briefing: any,
  memories: any[],
  sellerContext: any,
  analyses: string[],
  templateVersion: number
): string {
  const data = JSON.stringify({
    name: briefing.name,
    sector: briefing.sector,
    product: briefing.product,
    sessions: briefing.sessionsPlayed,
    mastery: briefing.mastery?.map((m: any) => `${m.technique}:${m.score}`).sort(),
    memoryCount: memories.length,
    lastMemory: memories[0]?.content?.slice(0, 50),
    koopredenen: sellerContext.koopredenen,
    verliesredenen: sellerContext.verliesredenen,
    analysesCount: analyses.length,
    templateVersion,
  });
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

// ── DB Cache Operations ─────────────────────────────────────────────────────

async function loadCachedBrain(userId: string): Promise<{
  brain: string;
  hash: string;
  version: number;
  generatedAt: string;
} | null> {
  try {
    const { data } = await supabase
      .from("user_brain_cache")
      .select("brain_document, context_hash, template_version, generated_at")
      .eq("user_id", userId)
      .single();

    if (!data) return null;

    // Check TTL (24 hours)
    const age = Date.now() - new Date(data.generated_at).getTime();
    if (age > 24 * 60 * 60 * 1000) return null;

    return {
      brain: data.brain_document,
      hash: data.context_hash,
      version: data.template_version,
      generatedAt: data.generated_at,
    };
  } catch {
    return null;
  }
}

async function saveBrainToCache(
  userId: string,
  brain: string,
  hash: string,
  templateVersion: number,
  metadata: any
): Promise<void> {
  try {
    await supabase.from("user_brain_cache").upsert({
      user_id: userId,
      brain_document: brain,
      context_hash: hash,
      template_version: templateVersion,
      generated_at: new Date().toISOString(),
      metadata,
    }, { onConflict: "user_id" });
  } catch (err: any) {
    console.error("[Preflight] Cache save failed:", err.message);
  }
}

// ── Main Preflight Function ─────────────────────────────────────────────────

/**
 * Generate or retrieve Hugo's brain for a user.
 *
 * 1. Fetch all context data in parallel
 * 2. Compute context hash
 * 3. Check cache (memory → DB)
 * 4. If cache hit + hash match → return cached
 * 5. If cache miss → generate via Sonnet + thinking → cache result
 */
export async function generateBrain(userId: string): Promise<BrainResult> {
  const t0 = Date.now();

  // 1. Fetch all data in parallel
  const [briefing, allMemories, sellerContext, analyses, templateInfo] = await Promise.all([
    buildUserBriefing(userId),
    getMemoriesForUser(userId, 15).catch(() => []),
    fetchSellerContext(userId),
    fetchRecentAnalysesSummaries(userId),
    getActiveBrainTemplate(),
  ]);

  // 2. Compute context hash
  const contextHash = computeContextHash(
    briefing,
    allMemories,
    sellerContext,
    analyses,
    templateInfo.version
  );

  // 3. Check in-memory cache
  const memCached = brainCache.get(userId);
  if (memCached && memCached.hash === contextHash && Date.now() - memCached.ts < MEMORY_CACHE_TTL) {
    console.log(`[Preflight] Memory cache hit for ${userId} (${Date.now() - t0}ms)`);
    return {
      brain: memCached.brain,
      contextHash,
      templateVersion: memCached.version,
      cached: true,
      timing: { totalMs: Date.now() - t0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0 },
    };
  }

  // 4. Check DB cache
  const dbCached = await loadCachedBrain(userId);
  if (dbCached && dbCached.hash === contextHash) {
    brainCache.set(userId, { brain: dbCached.brain, hash: contextHash, version: dbCached.version, ts: Date.now() });
    console.log(`[Preflight] DB cache hit for ${userId} (${Date.now() - t0}ms)`);
    return {
      brain: dbCached.brain,
      contextHash,
      templateVersion: dbCached.version,
      cached: true,
      timing: { totalMs: Date.now() - t0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0 },
    };
  }

  // 5. Generate new brain via Sonnet + extended thinking
  console.log(`[Preflight] Generating brain for ${userId}...`);

  const inputParts: string[] = [];

  // Seller briefing
  inputParts.push(`──── SELLER BRIEFING ────\n${formatBriefingForPrompt(briefing)}`);

  // Full memories (not just top 5 like briefing)
  if (allMemories.length > 0) {
    const memLines = allMemories.map((m: any) => `[${m.memoryType}${m.source === "admin_correction" ? " ADMIN" : ""}] ${m.content}`);
    inputParts.push(`\n──── ALLE HERINNERINGEN (${allMemories.length}) ────\n${memLines.join("\n")}`);
  }

  // Seller context (koopredenen, verliesredenen, etc.)
  const ctxParts: string[] = [];
  if (sellerContext.koopredenen?.length) {
    ctxParts.push(`Koopredenen: ${sellerContext.koopredenen.join(", ")}`);
  }
  if (sellerContext.verliesredenen?.length) {
    ctxParts.push(`Verliesredenen: ${sellerContext.verliesredenen.join(", ")}`);
  }
  if (sellerContext.concurrenten?.length) {
    ctxParts.push(`Concurrenten: ${sellerContext.concurrenten.join(", ")}`);
  }
  if (sellerContext.eigen_usps?.length) {
    ctxParts.push(`USPs: ${sellerContext.eigen_usps.join(", ")}`);
  }
  if (sellerContext.dealgrootte) {
    ctxParts.push(`Dealgrootte: ${sellerContext.dealgrootte}`);
  }
  if (sellerContext.salescycle) {
    ctxParts.push(`Sales cycle: ${sellerContext.salescycle}`);
  }
  if (ctxParts.length > 0) {
    inputParts.push(`\n──── SECTOR & DEAL CONTEXT ────\n${ctxParts.join("\n")}`);
  }

  // Recent analyses
  if (analyses.length > 0) {
    inputParts.push(`\n──── RECENTE ANALYSES (${analyses.length}) ────\n${analyses.join("\n---\n")}`);
  }

  // SSOT reference
  inputParts.push(`\n──── TECHNIEKEN (SSOT) ────\n${getCompactTechniqueList()}`);
  inputParts.push(`\n──── KLANTHOUDINGEN (SSOT) ────\n${getCompactHoudingen()}`);

  const userContent = inputParts.join("\n\n");

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: COACHING_MODEL,
      max_tokens: 6000,
      thinking: { type: "enabled", budget_tokens: 10000 },
      system: [{ type: "text", text: templateInfo.template }],
      messages: [{ role: "user", content: userContent }],
    });

    // Extract text blocks (skip thinking blocks)
    const textBlocks = response.content.filter((b: any) => b.type === "text");
    const brain = textBlocks.map((b: any) => b.text).join("");

    const thinkingTokens = (response.usage as any).thinking_tokens || 0;
    const metadata = {
      model: COACHING_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      thinkingTokens,
      generationMs: Date.now() - t0,
    };

    // Cache in memory + DB
    brainCache.set(userId, { brain, hash: contextHash, version: templateInfo.version, ts: Date.now() });
    saveBrainToCache(userId, brain, contextHash, templateInfo.version, metadata);

    console.log(`[Preflight] Brain generated for ${userId}: ${response.usage.input_tokens}in/${response.usage.output_tokens}out/${thinkingTokens}think (${Date.now() - t0}ms)`);

    return {
      brain,
      contextHash,
      templateVersion: templateInfo.version,
      cached: false,
      timing: {
        totalMs: Date.now() - t0,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        thinkingTokens,
      },
    };
  } catch (err: any) {
    console.error("[Preflight] Brain generation failed:", err.message);
    throw err;
  }
}

/**
 * Get a cached brain without generating (for fast session start).
 * Returns null if no valid cache exists.
 */
export async function getCachedBrain(userId: string): Promise<string | null> {
  // Check memory cache first
  const memCached = brainCache.get(userId);
  if (memCached && Date.now() - memCached.ts < MEMORY_CACHE_TTL) {
    return memCached.brain;
  }

  // Check DB cache
  const dbCached = await loadCachedBrain(userId);
  if (dbCached) {
    brainCache.set(userId, { brain: dbCached.brain, hash: dbCached.hash, version: dbCached.version, ts: Date.now() });
    return dbCached.brain;
  }

  return null;
}
