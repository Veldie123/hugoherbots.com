/**
 * V3 User Briefing — Pre-fetches user context for personalized session openings
 *
 * Aggregates activity, mastery, memories, and profile data into a compact
 * briefing that gets injected into the V3 system prompt. This gives the
 * Claude agent immediate context about the seller without needing tool calls.
 */
import { supabase } from "../supabase-client";
import { pool } from "../db";
import { getMemoriesForUser, type Memory } from "./memory-service";

// ── Types ───────────────────────────────────────────────────────────────────

export interface UserBriefing {
  name: string;
  company?: string;
  sector?: string;
  product?: string;
  klantType?: string;
  /** Activity stats */
  sessionsPlayed: number;
  avgScore: number;
  analysesCount: number;
  videosWatched: number;
  webinarsAttended: number;
  /** Last activity description */
  lastActivity?: { type: string; name: string; when: string };
  /** Per-technique mastery */
  mastery: Array<{
    technique: string;
    name?: string;
    score: number;
    attempts: number;
    trend: string;
  }>;
  /** Recent memories (goals, struggles, insights) */
  memories: Array<{ type: string; content: string }>;
  /** Whether this is a new user with no history */
  isNewUser: boolean;
}

// ── Technique name lookup ───────────────────────────────────────────────────

import { readFileSync } from "fs";
import { join } from "path";

let cachedTechniques: any[] | null = null;

function getTechniqueName(id: string): string {
  if (!cachedTechniques) {
    try {
      const techPath = join(process.cwd(), "config/ssot/technieken_index.json");
      cachedTechniques = JSON.parse(readFileSync(techPath, "utf-8"));
    } catch {
      cachedTechniques = [];
    }
  }
  const t = cachedTechniques!.find(
    (t: any) => t.id === id || t.nummer === id
  );
  return t?.naam || t?.title || id;
}

// ── Time ago helper ─────────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 7) return `${Math.floor(days / 7)} weken geleden`;
  if (days > 1) return `${days} dagen geleden`;
  if (days === 1) return "gisteren";
  if (hours > 1) return `${hours} uur geleden`;
  if (hours === 1) return "een uur geleden";
  return "net";
}

// ── Main Briefing Builder ───────────────────────────────────────────────────

export async function buildUserBriefing(
  userId: string
): Promise<UserBriefing> {
  const briefing: UserBriefing = {
    name: "daar",
    sessionsPlayed: 0,
    avgScore: 0,
    analysesCount: 0,
    videosWatched: 0,
    webinarsAttended: 0,
    mastery: [],
    memories: [],
    isNewUser: true,
  };

  // Run all queries in parallel for speed
  const [nameResult, sessionsResult, masteryResult, memoriesResult, activityResult, analysesResult] =
    await Promise.allSettled([
      fetchUserName(userId),
      fetchSessions(userId),
      fetchMastery(userId),
      fetchRecentMemories(userId),
      fetchActivityStats(userId),
      fetchAnalysesCount(userId),
    ]);

  // User name
  if (nameResult.status === "fulfilled" && nameResult.value) {
    briefing.name = nameResult.value.name;
    if (nameResult.value.company) briefing.company = nameResult.value.company;
    if (nameResult.value.sector) briefing.sector = nameResult.value.sector;
    if (nameResult.value.product) briefing.product = nameResult.value.product;
    if (nameResult.value.klantType) briefing.klantType = nameResult.value.klantType;
  }

  // Sessions
  if (sessionsResult.status === "fulfilled" && sessionsResult.value) {
    const s = sessionsResult.value;
    briefing.sessionsPlayed = s.count;
    briefing.avgScore = s.avgScore;
    briefing.isNewUser = s.count === 0;
    if (s.lastActivity) briefing.lastActivity = s.lastActivity;
  }

  // Mastery
  if (masteryResult.status === "fulfilled") {
    briefing.mastery = masteryResult.value;
  }

  // Memories
  if (memoriesResult.status === "fulfilled") {
    briefing.memories = memoriesResult.value;
  }

  // Activity (videos, webinars)
  if (activityResult.status === "fulfilled") {
    briefing.videosWatched = activityResult.value.videosWatched;
    briefing.webinarsAttended = activityResult.value.webinarsAttended;
  }

  // Analyses
  if (analysesResult.status === "fulfilled") {
    briefing.analysesCount = analysesResult.value;
  }

  // Final isNewUser check
  briefing.isNewUser = briefing.sessionsPlayed === 0 &&
    briefing.videosWatched === 0 &&
    briefing.webinarsAttended === 0 &&
    briefing.analysesCount === 0;

  return briefing;
}

// ── Individual Data Fetchers ────────────────────────────────────────────────

async function fetchUserName(userId: string): Promise<{
  name: string;
  company?: string;
  sector?: string;
  product?: string;
  klantType?: string;
} | null> {
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const name = userData?.user?.user_metadata?.first_name || null;

    // Also fetch user context from last session
    let context: any = null;
    try {
      const contextResult = await pool.query(
        `SELECT context FROM v2_sessions
         WHERE user_id = $1 AND context IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      context = contextResult.rows[0]?.context;
    } catch (e) { console.error('[UserBriefing] Error fetching session context:', e); }

    return {
      name: name || "daar",
      company: context?.bedrijfsnaam,
      sector: context?.sector,
      product: context?.product,
      klantType: context?.klant_type || context?.klantType,
    };
  } catch {
    return null;
  }
}

async function fetchSessions(userId: string): Promise<{
  count: number;
  avgScore: number;
  lastActivity?: { type: string; name: string; when: string };
}> {
  try {
    const { data: sessions } = await supabase
      .from("v2_sessions")
      .select("technique_id, mode, total_score, conversation_history, created_at")
      .eq("user_id", userId)
      .eq("is_active", 1)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!sessions || sessions.length === 0) {
      return { count: 0, avgScore: 0 };
    }

    const scores = sessions.map(
      (s) => Math.min(100, Math.round(50 + (s.conversation_history?.length || 0) * 2.5))
    );
    const avgScore = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );

    const last = sessions[0];
    const techName = last.technique_id
      ? getTechniqueName(last.technique_id)
      : null;

    return {
      count: sessions.length,
      avgScore,
      lastActivity: techName
        ? {
            type: last.mode || "sessie",
            name: techName,
            when: timeAgo(last.created_at),
          }
        : undefined,
    };
  } catch {
    return { count: 0, avgScore: 0 };
  }
}

async function fetchMastery(userId: string): Promise<UserBriefing["mastery"]> {
  try {
    const { data } = await supabase
      .from("user_technique_mastery")
      .select("*")
      .eq("user_id", userId);

    if (!data || data.length === 0) return [];

    return data.map((m: any) => ({
      technique: m.technique_id,
      name: getTechniqueName(m.technique_id),
      score: m.average_score,
      attempts: m.attempt_count,
      trend: m.trend || "→",
    }));
  } catch {
    return [];
  }
}

async function fetchRecentMemories(
  userId: string
): Promise<Array<{ type: string; content: string }>> {
  try {
    const memories = await getMemoriesForUser(userId, 10);
    // Prioritize: goals, struggles, then insights
    const prioritized = [
      ...memories.filter((m) => m.memoryType === "goal"),
      ...memories.filter((m) => m.memoryType === "struggle"),
      ...memories.filter((m) => m.memoryType === "insight"),
      ...memories.filter((m) => m.memoryType === "personal"),
    ];
    return prioritized.slice(0, 5).map((m) => ({
      type: m.memoryType,
      content: m.content,
    }));
  } catch {
    return [];
  }
}

async function fetchActivityStats(
  userId: string
): Promise<{ videosWatched: number; webinarsAttended: number }> {
  try {
    const { data, error } = await supabase
      .from("user_activity")
      .select("activity_type, video_id, webinar_id")
      .eq("user_id", userId)
      .in("activity_type", ["video_view", "video_complete", "webinar_attend", "webinar_complete"]);

    if (error || !data) return { videosWatched: 0, webinarsAttended: 0 };

    // Count DISTINCT content items, not total activity rows
    const uniqueVideos = new Set(
      data
        .filter((a: any) => (a.activity_type === "video_view" || a.activity_type === "video_complete") && a.video_id)
        .map((a: any) => a.video_id)
    );
    const uniqueWebinars = new Set(
      data
        .filter((a: any) => (a.activity_type === "webinar_attend" || a.activity_type === "webinar_complete") && a.webinar_id)
        .map((a: any) => a.webinar_id)
    );

    return {
      videosWatched: uniqueVideos.size,
      webinarsAttended: uniqueWebinars.size,
    };
  } catch {
    return { videosWatched: 0, webinarsAttended: 0 };
  }
}

async function fetchAnalysesCount(userId: string): Promise<number> {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) as total FROM conversation_analyses WHERE user_id = $1 AND id NOT LIKE 'session-%'",
      [userId]
    );
    return parseInt(result.rows[0]?.total || "0");
  } catch {
    return 0;
  }
}

// ── Format Briefing for System Prompt ───────────────────────────────────────

export function formatBriefingForPrompt(b: UserBriefing): string {
  const lines: string[] = [];

  if (b.isNewUser) {
    lines.push("Nieuwe gebruiker. Geen eerdere sessies of activiteit.");
    const contextParts: string[] = [];
    if (b.sector) contextParts.push(`Sector: ${b.sector}`);
    if (b.product) contextParts.push(`Verkoopt: ${b.product}`);
    if (b.company) contextParts.push(`Bedrijf: ${b.company}`);
    if (contextParts.length > 0) {
      lines.push(contextParts.join(" | "));
    }
    return lines.join("\n");
  }

  // Identity line
  const idParts = [`Naam: ${b.name}`];
  if (b.company) idParts.push(`Bedrijf: ${b.company}`);
  if (b.sector) idParts.push(`Sector: ${b.sector}`);
  if (b.product) idParts.push(`Verkoopt: ${b.product}`);
  lines.push(idParts.join(" | "));

  // Activity stats
  const statParts = [`${b.sessionsPlayed} sessies`, `gem. ${b.avgScore}%`];
  if (b.analysesCount > 0) statParts.push(`${b.analysesCount} analyses`);
  if (b.videosWatched > 0) statParts.push(`${b.videosWatched} video's bekeken`);
  if (b.webinarsAttended > 0) statParts.push(`${b.webinarsAttended} webinars gevolgd`);
  lines.push(`\nACTIVITEIT:\n- ${statParts.join(" • ")}`);

  if (b.lastActivity) {
    lines.push(
      `- Laatst: ${b.lastActivity.when} een ${b.lastActivity.type} over "${b.lastActivity.name}"`
    );
  }

  // Mastery
  if (b.mastery.length > 0) {
    lines.push("\nBEHEERSING:");
    for (const m of b.mastery) {
      lines.push(
        `- ${m.name || m.technique}: ${m.score}% (${m.attempts} pogingen, trend ${m.trend})`
      );
    }
  }

  // Memories
  if (b.memories.length > 0) {
    lines.push("\nHERINNERINGEN:");
    for (const m of b.memories) {
      lines.push(`- [${m.type}] ${m.content}`);
    }
  }

  return lines.join("\n");
}
