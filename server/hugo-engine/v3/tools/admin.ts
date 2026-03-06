/**
 * V3 Admin Tools
 *
 * 26 admin tools for the V3 Claude agent — platform management,
 * analytics, content, users, and proactive insights.
 *
 * Converts 16 existing tools from the GPT-4 powered hugo-agent.ts
 * and adds 10 new tools for slides, sessions, users, RAG, and reporting.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../../db";
import { supabase } from "../../supabase-client";
import {
  getAllSlides,
  getSlidesForPhase,
  getSlidesForTechnique,
  getSlideById,
} from "../../v2/epic-slides-service";

const PROCESSOR_BASE = "http://localhost:3001";

// ── Tool Definitions (Claude / Anthropic format) ─────────────────────────────

export const adminToolDefinitions: Anthropic.Tool[] = [
  // ── 1. get_platform_analytics ──────────────────────────────────────────────
  {
    name: "get_platform_analytics",
    description:
      "Haal platform-brede statistieken op: actieve gebruikers, sessies, video views, etc.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ── 2. get_content_performance ─────────────────────────────────────────────
  {
    name: "get_content_performance",
    description:
      "Haal content-prestaties op: welke video's en webinars het best presteren.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ── 3. list_webinars ───────────────────────────────────────────────────────
  {
    name: "list_webinars",
    description:
      "Lijst alle webinars op (aankomend, afgelopen, of alles).",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          enum: ["upcoming", "past", "all"],
          description: "Welke webinars ophalen. Default: 'all'",
        },
      },
      required: [],
    },
  },
  // ── 4. update_webinar ──────────────────────────────────────────────────────
  {
    name: "update_webinar",
    description:
      "Pas een webinar aan: verander de titel, datum of beschrijving.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Het ID van de webinar" },
        title: { type: "string", description: "Nieuwe titel" },
        scheduled_date: {
          type: "string",
          description: "Nieuwe datum (ISO 8601 formaat, bijv. 2026-03-15T14:00:00Z)",
        },
        description: { type: "string", description: "Nieuwe beschrijving" },
      },
      required: ["id"],
    },
  },
  // ── 5. create_webinar ──────────────────────────────────────────────────────
  {
    name: "create_webinar",
    description: "Plan een nieuw webinar in.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Titel van het webinar" },
        scheduled_date: { type: "string", description: "Datum en tijd (ISO 8601)" },
        description: { type: "string", description: "Beschrijving van het webinar" },
        topic: { type: "string", description: "Onderwerp/techniek" },
      },
      required: ["title", "scheduled_date"],
    },
  },
  // ── 6. start_webinar ───────────────────────────────────────────────────────
  {
    name: "start_webinar",
    description:
      "Geef de instructie om een webinar te starten. Toont een startknop aan Hugo.",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "Het ID van de webinar die gestart moet worden",
        },
        session_title: {
          type: "string",
          description: "De naam van de webinar (voor in de knop)",
        },
      },
      required: ["session_id"],
    },
  },
  // ── 7. get_video_order ─────────────────────────────────────────────────────
  {
    name: "get_video_order",
    description: "Haal de huidige afspeelvolgorde van de video's op.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ── 8. reorder_videos ──────────────────────────────────────────────────────
  {
    name: "reorder_videos",
    description:
      "Pas de volgorde van video's aan. Geef een array met video ID's en hun nieuwe positie.",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          description: "Array van video objecten met id en playback_order",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              playback_order: { type: "number" },
            },
          },
        },
      },
      required: ["items"],
    },
  },
  // ── 9. list_analyses ───────────────────────────────────────────────────────
  {
    name: "list_analyses",
    description: "Lijst recente gespreksanalyses op.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Aantal analyses (default 10)" },
      },
      required: [],
    },
  },
  // ── 10. get_analysis_detail ────────────────────────────────────────────────
  {
    name: "get_analysis_detail",
    description: "Haal de details van een specifieke gespreksanalyse op.",
    input_schema: {
      type: "object" as const,
      properties: {
        analysis_id: { type: "string", description: "Het ID van de analyse" },
      },
      required: ["analysis_id"],
    },
  },
  // ── 11. search_rag ─────────────────────────────────────────────────────────
  {
    name: "search_rag",
    description: "Doorzoek de kennisbank (RAG) op een onderwerp of techniek.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "De zoekterm of vraag" },
      },
      required: ["query"],
    },
  },
  // ── 12. get_technique_details ──────────────────────────────────────────────
  {
    name: "get_technique_details",
    description: "Haal de details op van een EPIC-techniek uit de SSOT.",
    input_schema: {
      type: "object" as const,
      properties: {
        technique_id_or_name: {
          type: "string",
          description: "ID (bijv. '2.1') of naam van de techniek",
        },
      },
      required: ["technique_id_or_name"],
    },
  },
  // ── 13. propose_config_change ──────────────────────────────────────────────
  {
    name: "propose_config_change",
    description:
      "Stel een wijziging voor aan de SSOT/config die ter review naar Stéphane gaat.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Type wijziging: 'techniek', 'persona', 'prompt', 'rag_addition', 'video_suggestion'",
        },
        field: { type: "string", description: "Welk veld of onderdeel wordt gewijzigd" },
        current_value: { type: "string", description: "Huidige waarde (indien bekend)" },
        proposed_value: { type: "string", description: "Voorgestelde nieuwe waarde" },
        reason: { type: "string", description: "Waarom deze wijziging nodig is" },
      },
      required: ["type", "proposed_value", "reason"],
    },
  },
  // ── 14. get_stuck_users ────────────────────────────────────────────────────
  {
    name: "get_stuck_users",
    description:
      "Lijst gebruikers op die meer dan 14 dagen niet actief waren of vastgelopen zijn.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ── 15. get_webinar_pipeline_status ────────────────────────────────────────
  {
    name: "get_webinar_pipeline_status",
    description:
      "Controleer hoeveel webinars er nog gepland staan. Geeft een waarschuwing als er minder dan 3 zijn.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ── 16. get_low_performing_techniques ──────────────────────────────────────
  {
    name: "get_low_performing_techniques",
    description:
      "Haal technieken op met lage gemiddelde scores (< 60%) in de laatste 30 dagen.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // NEW TOOLS (17-26)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── 17. list_slides ────────────────────────────────────────────────────────
  {
    name: "list_slides",
    description:
      "Lijst EPIC coaching slides op. Optioneel filteren op fase of techniek.",
    input_schema: {
      type: "object" as const,
      properties: {
        phase: {
          type: "string",
          description: "Filter op EPIC fase (bijv. 'explore', 'present').",
        },
        technique_id: {
          type: "string",
          description: "Filter op techniek-ID (bijv. '2.1').",
        },
      },
      required: [],
    },
  },
  // ── 18. get_slide ──────────────────────────────────────────────────────────
  {
    name: "get_slide",
    description: "Haal de details op van een specifieke coaching slide.",
    input_schema: {
      type: "object" as const,
      properties: {
        slide_id: { type: "string", description: "Het ID van de slide" },
      },
      required: ["slide_id"],
    },
  },
  // ── 19. propose_slide_change ───────────────────────────────────────────────
  {
    name: "propose_slide_change",
    description:
      "Stel een wijziging voor aan een coaching slide. Gaat ter review naar Stéphane.",
    input_schema: {
      type: "object" as const,
      properties: {
        slide_id: { type: "string", description: "Het ID van de slide" },
        changes: {
          type: "object",
          description:
            "Object met optionele velden: titel, kernboodschap, bulletpoints (array).",
          properties: {
            titel: { type: "string", description: "Nieuwe titel voor de slide" },
            kernboodschap: { type: "string", description: "Nieuwe kernboodschap" },
            bulletpoints: {
              type: "array",
              items: { type: "string" },
              description: "Nieuwe bulletpoints",
            },
          },
        },
        reason: { type: "string", description: "Waarom deze wijziging nodig is" },
      },
      required: ["slide_id", "changes", "reason"],
    },
  },
  // ── 20. read_user_session ──────────────────────────────────────────────────
  {
    name: "read_user_session",
    description:
      "Lees de details van een coaching sessie: transcript, scores, en analyse-resultaat.",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string", description: "Het ID van de sessie/analyse" },
      },
      required: ["session_id"],
    },
  },
  // ── 21. list_user_sessions ─────────────────────────────────────────────────
  {
    name: "list_user_sessions",
    description:
      "Lijst coaching sessies van een specifieke gebruiker op.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string", description: "Het user ID" },
        limit: { type: "number", description: "Max aantal sessies (default 10)" },
      },
      required: ["user_id"],
    },
  },
  // ── 22. get_user_detail ────────────────────────────────────────────────────
  {
    name: "get_user_detail",
    description:
      "Haal het volledige profiel op van een gebruiker: profiel, activiteit, mastery-data.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string", description: "Het user ID" },
      },
      required: ["user_id"],
    },
  },
  // ── 23. propose_rag_change ─────────────────────────────────────────────────
  {
    name: "propose_rag_change",
    description:
      "Stel een wijziging voor aan de kennisbank (RAG): fragment toevoegen, wijzigen of verwijderen.",
    input_schema: {
      type: "object" as const,
      properties: {
        fragment_id: {
          type: "string",
          description: "ID van het bestaande fragment (voor update/delete).",
        },
        content: { type: "string", description: "De content van het fragment" },
        reason: { type: "string", description: "Waarom deze wijziging nodig is" },
        action: {
          type: "string",
          enum: ["add", "update", "delete"],
          description: "Actie: toevoegen, wijzigen of verwijderen",
        },
      },
      required: ["content", "reason", "action"],
    },
  },
  // ── 24. propose_technique_change ───────────────────────────────────────────
  {
    name: "propose_technique_change",
    description:
      "Stel een wijziging voor aan een EPIC techniek. Gaat ter review naar Stéphane.",
    input_schema: {
      type: "object" as const,
      properties: {
        technique_id: { type: "string", description: "Het techniek-ID (bijv. '2.1')" },
        changes: {
          type: "object",
          description:
            "Object met de velden die gewijzigd moeten worden (bijv. naam, beschrijving, stappenplan).",
        },
        reason: { type: "string", description: "Waarom deze wijziging nodig is" },
      },
      required: ["technique_id", "changes", "reason"],
    },
  },
  // ── 25. generate_summary_report ────────────────────────────────────────────
  {
    name: "generate_summary_report",
    description:
      "Genereer een samenvattend rapport van het platform: gebruikers, sessies, analyses, webinars.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: {
          type: "string",
          enum: ["week", "month"],
          description: "Rapportperiode: 'week' (default) of 'month'.",
        },
      },
      required: [],
    },
  },
  // ── 26. get_technique_usage_trends ─────────────────────────────────────────
  {
    name: "get_technique_usage_trends",
    description:
      "Haal trends op van techniek-gebruik: welke technieken worden het meest geoefend.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── Tool name registry ───────────────────────────────────────────────────────

export const ADMIN_TOOLS: Set<string> = new Set(
  adminToolDefinitions.map((t) => t.name)
);

// ── Cached config loaders ────────────────────────────────────────────────────

let cachedTechniques: any[] | null = null;

function loadTechniques(): any[] {
  if (cachedTechniques) return cachedTechniques;
  const techPath = join(process.cwd(), "config/ssot/technieken_index.json");
  cachedTechniques = JSON.parse(readFileSync(techPath, "utf-8"));
  return cachedTechniques;
}

// ── Main executor ────────────────────────────────────────────────────────────

export async function executeAdminTool(
  name: string,
  input: Record<string, any>
): Promise<string> {
  try {
    switch (name) {
      case "get_platform_analytics":
        return await execGetPlatformAnalytics();
      case "get_content_performance":
        return await execGetContentPerformance();
      case "list_webinars":
        return await execListWebinars(input.filter);
      case "update_webinar":
        return await execUpdateWebinar(input.id, input);
      case "create_webinar":
        return await execCreateWebinar(input);
      case "start_webinar":
        return await execStartWebinar(input.session_id, input.session_title);
      case "get_video_order":
        return await execGetVideoOrder();
      case "reorder_videos":
        return await execReorderVideos(input.items);
      case "list_analyses":
        return await execListAnalyses(input.limit);
      case "get_analysis_detail":
        return await execGetAnalysisDetail(input.analysis_id);
      case "search_rag":
        return await execSearchRag(input.query);
      case "get_technique_details":
        return await execGetTechniqueDetails(input.technique_id_or_name);
      case "propose_config_change":
        return await execProposeConfigChange(input);
      case "get_stuck_users":
        return await execGetStuckUsers();
      case "get_webinar_pipeline_status":
        return await execGetWebinarPipelineStatus();
      case "get_low_performing_techniques":
        return await execGetLowPerformingTechniques();
      case "list_slides":
        return await execListSlides(input.phase, input.technique_id);
      case "get_slide":
        return await execGetSlide(input.slide_id);
      case "propose_slide_change":
        return await execProposeSlideChange(input.slide_id, input.changes, input.reason);
      case "read_user_session":
        return await execReadUserSession(input.session_id);
      case "list_user_sessions":
        return await execListUserSessions(input.user_id, input.limit);
      case "get_user_detail":
        return await execGetUserDetail(input.user_id);
      case "propose_rag_change":
        return await execProposeRagChange(input);
      case "propose_technique_change":
        return await execProposeTechniqueChange(input);
      case "generate_summary_report":
        return await execGenerateSummaryReport(input.period);
      case "get_technique_usage_trends":
        return await execGetTechniqueUsageTrends();
      default:
        return JSON.stringify({ error: `Onbekende admin tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Onbekende fout bij admin tool" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — Existing 16 (converted from hugo-agent.ts)
// ══════════════════════════════════════════════════════════════════════════════

// 1. get_platform_analytics
async function execGetPlatformAnalytics(): Promise<string> {
  try {
    const res = await fetch(`${PROCESSOR_BASE}/api/analytics/platform`);
    const data = await res.json();
    return JSON.stringify({ analytics: data });
  } catch (err: any) {
    return JSON.stringify({ error: `Analytics ophalen mislukt: ${err.message}` });
  }
}

// 2. get_content_performance
async function execGetContentPerformance(): Promise<string> {
  try {
    const res = await fetch(`${PROCESSOR_BASE}/api/analytics/content-performance`);
    const data = await res.json();
    return JSON.stringify({ content_performance: data });
  } catch (err: any) {
    return JSON.stringify({ error: `Content performance ophalen mislukt: ${err.message}` });
  }
}

// 3. list_webinars
async function execListWebinars(filter?: string): Promise<string> {
  try {
    const f = filter || "all";
    let query = supabase
      .from("live_sessions")
      .select("*")
      .order("scheduled_date", { ascending: false });

    if (f === "upcoming") {
      query = query.gte("scheduled_date", new Date().toISOString());
    } else if (f === "past") {
      query = query.lt("scheduled_date", new Date().toISOString());
    }

    const { data, error } = await query.limit(20);
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ webinars: data || [] });
  } catch (err: any) {
    return JSON.stringify({ error: `Webinars ophalen mislukt: ${err.message}` });
  }
}

// 4. update_webinar
async function execUpdateWebinar(
  id: string,
  input: Record<string, any>
): Promise<string> {
  try {
    const { id: _id, ...patch } = input;
    const res = await fetch(`${PROCESSOR_BASE}/api/admin/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    return JSON.stringify({ updated: data });
  } catch (err: any) {
    return JSON.stringify({ error: `Webinar bijwerken mislukt: ${err.message}` });
  }
}

// 5. create_webinar
async function execCreateWebinar(input: Record<string, any>): Promise<string> {
  try {
    const res = await fetch(`${PROCESSOR_BASE}/api/admin/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return JSON.stringify({ created: data });
  } catch (err: any) {
    return JSON.stringify({ error: `Webinar aanmaken mislukt: ${err.message}` });
  }
}

// 6. start_webinar
async function execStartWebinar(
  sessionId: string,
  sessionTitle?: string
): Promise<string> {
  return JSON.stringify({
    action: "start_webinar",
    session_id: sessionId,
    session_title: sessionTitle || "Webinar",
  });
}

// 7. get_video_order
async function execGetVideoOrder(): Promise<string> {
  try {
    const res = await fetch(`${PROCESSOR_BASE}/api/videos/playback-order`);
    const data = (await res.json()) as any;
    return JSON.stringify({ videos: data?.videos || data || [] });
  } catch (err: any) {
    return JSON.stringify({ error: `Video-volgorde ophalen mislukt: ${err.message}` });
  }
}

// 8. reorder_videos
async function execReorderVideos(
  items: Array<{ id: string; playback_order: number }>
): Promise<string> {
  try {
    const res = await fetch(`${PROCESSOR_BASE}/api/videos/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videos: items }),
    });
    const data = await res.json();
    return JSON.stringify({ reordered: data });
  } catch (err: any) {
    return JSON.stringify({ error: `Video's herordenen mislukt: ${err.message}` });
  }
}

// 9. list_analyses
async function execListAnalyses(limit?: number): Promise<string> {
  try {
    const l = limit || 10;
    const result = await pool.query(
      `SELECT id, title, status, created_at, completed_at,
        result->>'overallScore' as score
       FROM conversation_analyses
       WHERE id NOT LIKE 'session-%'
       ORDER BY created_at DESC LIMIT $1`,
      [l]
    );
    return JSON.stringify({ analyses: result.rows });
  } catch (err: any) {
    return JSON.stringify({ error: `Analyses ophalen mislukt: ${err.message}` });
  }
}

// 10. get_analysis_detail
async function execGetAnalysisDetail(analysisId: string): Promise<string> {
  try {
    const result = await pool.query(
      `SELECT id, title, status, created_at, result
       FROM conversation_analyses WHERE id = $1`,
      [analysisId]
    );
    if (result.rows.length === 0) {
      return JSON.stringify({ error: `Analyse '${analysisId}' niet gevonden.` });
    }
    return JSON.stringify({ analysis: result.rows[0] });
  } catch (err: any) {
    return JSON.stringify({ error: `Analyse detail ophalen mislukt: ${err.message}` });
  }
}

// 11. search_rag
async function execSearchRag(query: string): Promise<string> {
  try {
    const res = await fetch(`${PROCESSOR_BASE}/api/rag/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });
    const data = await res.json();
    return JSON.stringify({ results: data });
  } catch (err: any) {
    return JSON.stringify({ error: `RAG zoeken mislukt: ${err.message}` });
  }
}

// 12. get_technique_details
async function execGetTechniqueDetails(idOrName: string): Promise<string> {
  try {
    const technieken = loadTechniques();
    const q = idOrName?.toLowerCase();
    const found = technieken.find(
      (t: any) =>
        t.id?.toLowerCase() === q ||
        t.naam?.toLowerCase().includes(q) ||
        t.title?.toLowerCase().includes(q)
    );
    if (found) {
      return JSON.stringify({ technique: found });
    }
    // Return first 5 as overview when no match
    return JSON.stringify({
      message: `Geen exacte match voor '${idOrName}'. Hier zijn de eerste technieken:`,
      techniques: technieken.slice(0, 5).map((t: any) => ({
        id: t.id || t.nummer,
        naam: t.naam || t.title,
        fase: t.fase,
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Techniek ophalen mislukt: ${err.message}` });
  }
}

// 13. propose_config_change
async function execProposeConfigChange(
  input: Record<string, any>
): Promise<string> {
  try {
    await pool.query(
      `INSERT INTO config_proposals (proposed_by, type, field, current_value, proposed_value, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "hugo",
        input.type,
        input.field || "",
        input.current_value || "",
        input.proposed_value,
        input.reason,
      ]
    );
    return JSON.stringify({
      proposed: true,
      type: input.type,
      field: input.field,
      reason: input.reason,
      status: "pending",
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Voorstel opslaan mislukt: ${err.message}` });
  }
}

// 14. get_stuck_users
async function execGetStuckUsers(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, last_seen_at, created_at")
      .lt(
        "last_seen_at",
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("last_seen_at", { ascending: true })
      .limit(20);

    if (error) {
      // Fallback: try users table
      const { data: altData } = await supabase
        .from("users")
        .select("id, full_name, email, updated_at")
        .limit(10);
      return JSON.stringify({ stuck_users: altData || [] });
    }
    return JSON.stringify({ stuck_users: data || [] });
  } catch (err: any) {
    return JSON.stringify({ error: `Vastgelopen gebruikers ophalen mislukt: ${err.message}` });
  }
}

// 15. get_webinar_pipeline_status
async function execGetWebinarPipelineStatus(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("live_sessions")
      .select("id, title, scheduled_date, status")
      .gte("scheduled_date", new Date().toISOString())
      .eq("status", "scheduled")
      .order("scheduled_date");

    const upcoming = data || [];
    return JSON.stringify({
      upcoming_count: upcoming.length,
      webinars: upcoming,
      warning: upcoming.length < 3,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Pipeline status ophalen mislukt: ${err.message}` });
  }
}

// 16. get_low_performing_techniques
async function execGetLowPerformingTechniques(): Promise<string> {
  try {
    const result = await pool.query(`
      SELECT
        result->>'technique' as technique,
        AVG((result->>'overallScore')::numeric) as avg_score,
        COUNT(*) as count
      FROM conversation_analyses
      WHERE status = 'completed'
        AND created_at > NOW() - INTERVAL '30 days'
        AND result->>'overallScore' IS NOT NULL
      GROUP BY result->>'technique'
      HAVING AVG((result->>'overallScore')::numeric) < 60
      ORDER BY avg_score ASC
      LIMIT 10
    `);
    return JSON.stringify({ low_performing: result.rows });
  } catch (err: any) {
    return JSON.stringify({ error: `Lage scores ophalen mislukt: ${err.message}` });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTORS — New 10 tools (17-26)
// ══════════════════════════════════════════════════════════════════════════════

// 17. list_slides
async function execListSlides(
  phase?: string,
  techniqueId?: string
): Promise<string> {
  try {
    let slides;
    if (techniqueId) {
      slides = getSlidesForTechnique(techniqueId);
    } else if (phase) {
      slides = getSlidesForPhase(phase);
    } else {
      slides = getAllSlides();
    }
    return JSON.stringify({
      slides: slides.map((s) => ({
        id: s.id,
        phase: s.phase,
        titel: s.titel,
        kernboodschap: s.kernboodschap,
        techniqueIds: s.techniqueIds,
      })),
      count: slides.length,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Slides ophalen mislukt: ${err.message}` });
  }
}

// 18. get_slide
async function execGetSlide(slideId: string): Promise<string> {
  try {
    const slide = getSlideById(slideId);
    if (!slide) {
      return JSON.stringify({ error: `Slide '${slideId}' niet gevonden.` });
    }
    return JSON.stringify({ slide });
  } catch (err: any) {
    return JSON.stringify({ error: `Slide ophalen mislukt: ${err.message}` });
  }
}

// 19. propose_slide_change
async function execProposeSlideChange(
  slideId: string,
  changes: Record<string, any>,
  reason: string
): Promise<string> {
  try {
    const currentSlide = getSlideById(slideId);
    await pool.query(
      `INSERT INTO config_proposals (proposed_by, type, field, current_value, proposed_value, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "hugo",
        "slide",
        slideId,
        currentSlide ? JSON.stringify(currentSlide) : "",
        JSON.stringify(changes),
        reason,
      ]
    );
    return JSON.stringify({
      proposed: true,
      slide_id: slideId,
      changes,
      reason,
      status: "pending",
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Slide voorstel opslaan mislukt: ${err.message}` });
  }
}

// 20. read_user_session
async function execReadUserSession(sessionId: string): Promise<string> {
  try {
    const result = await pool.query(
      `SELECT id, title, status, created_at, completed_at, result
       FROM conversation_analyses WHERE id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      return JSON.stringify({ error: `Sessie '${sessionId}' niet gevonden.` });
    }
    return JSON.stringify({ session: result.rows[0] });
  } catch (err: any) {
    return JSON.stringify({ error: `Sessie lezen mislukt: ${err.message}` });
  }
}

// 21. list_user_sessions
async function execListUserSessions(
  userId: string,
  limit?: number
): Promise<string> {
  try {
    const l = limit || 10;
    // Try matching user_id in the result JSON or title field
    const result = await pool.query(
      `SELECT id, title, status, created_at, completed_at,
        result->>'overallScore' as score,
        result->>'technique' as technique
       FROM conversation_analyses
       WHERE (result->>'userId' = $1 OR result->>'user_id' = $1 OR title ILIKE '%' || $1 || '%')
         AND id NOT LIKE 'session-%'
       ORDER BY created_at DESC LIMIT $2`,
      [userId, l]
    );

    if (result.rows.length === 0) {
      // Fallback: return most recent analyses
      const fallback = await pool.query(
        `SELECT id, title, status, created_at, completed_at,
          result->>'overallScore' as score
         FROM conversation_analyses
         WHERE id NOT LIKE 'session-%'
         ORDER BY created_at DESC LIMIT $1`,
        [l]
      );
      return JSON.stringify({
        sessions: fallback.rows,
        note: `Geen sessies gevonden voor user '${userId}'. Dit zijn de meest recente analyses.`,
      });
    }

    return JSON.stringify({ sessions: result.rows });
  } catch (err: any) {
    return JSON.stringify({ error: `Gebruiker-sessies ophalen mislukt: ${err.message}` });
  }
}

// 22. get_user_detail
async function execGetUserDetail(userId: string): Promise<string> {
  try {
    const detail: Record<string, any> = {};

    // Profile from Supabase
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profile && !profileError) {
      detail.profile = profile;
    }

    // Analysis count from pool
    try {
      const countResult = await pool.query(
        `SELECT COUNT(*) as total,
          AVG((result->>'overallScore')::numeric) as avg_score
         FROM conversation_analyses
         WHERE (result->>'userId' = $1 OR result->>'user_id' = $1)
           AND status = 'completed'`,
        [userId]
      );
      if (countResult.rows[0]) {
        detail.activity = {
          total_analyses: parseInt(countResult.rows[0].total, 10),
          avg_score: countResult.rows[0].avg_score
            ? parseFloat(countResult.rows[0].avg_score).toFixed(1)
            : null,
        };
      }
    } catch {
      // Table may not have these columns
    }

    // Mastery data from Supabase
    try {
      const { data: mastery } = await supabase
        .from("user_technique_mastery")
        .select("*")
        .eq("user_id", userId);
      if (mastery && mastery.length > 0) {
        detail.mastery = mastery.map((m: any) => ({
          technique: m.technique_id,
          score: m.average_score,
          attempts: m.attempt_count,
          trend: m.trend,
        }));
      }
    } catch {
      // Table may not exist
    }

    if (Object.keys(detail).length === 0) {
      return JSON.stringify({
        error: `Gebruiker '${userId}' niet gevonden of geen data beschikbaar.`,
      });
    }

    return JSON.stringify({ user: detail });
  } catch (err: any) {
    return JSON.stringify({ error: `Gebruiker ophalen mislukt: ${err.message}` });
  }
}

// 23. propose_rag_change
async function execProposeRagChange(
  input: Record<string, any>
): Promise<string> {
  try {
    await pool.query(
      `INSERT INTO config_proposals (proposed_by, type, field, current_value, proposed_value, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "hugo",
        "rag_fragment",
        input.fragment_id || "",
        input.action,
        input.content,
        input.reason,
      ]
    );
    return JSON.stringify({
      proposed: true,
      action: input.action,
      fragment_id: input.fragment_id || null,
      reason: input.reason,
      status: "pending",
    });
  } catch (err: any) {
    return JSON.stringify({ error: `RAG voorstel opslaan mislukt: ${err.message}` });
  }
}

// 24. propose_technique_change
async function execProposeTechniqueChange(
  input: Record<string, any>
): Promise<string> {
  try {
    // Load current technique for reference
    const technieken = loadTechniques();
    const current = technieken.find(
      (t: any) =>
        t.id?.toLowerCase() === input.technique_id?.toLowerCase() ||
        t.nummer?.toLowerCase() === input.technique_id?.toLowerCase()
    );

    await pool.query(
      `INSERT INTO config_proposals (proposed_by, type, field, current_value, proposed_value, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "hugo",
        "technique",
        input.technique_id,
        current ? JSON.stringify(current) : "",
        JSON.stringify(input.changes),
        input.reason,
      ]
    );
    return JSON.stringify({
      proposed: true,
      technique_id: input.technique_id,
      changes: input.changes,
      reason: input.reason,
      status: "pending",
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Techniek voorstel opslaan mislukt: ${err.message}` });
  }
}

// 25. generate_summary_report
async function execGenerateSummaryReport(period?: string): Promise<string> {
  try {
    const p = period || "week";
    const interval = p === "month" ? "30 days" : "7 days";
    const report: Record<string, any> = { period: p };

    // Platform analytics from processor
    try {
      const res = await fetch(`${PROCESSOR_BASE}/api/analytics/platform`);
      report.platform = await res.json();
    } catch {
      report.platform = { error: "Analytics niet beschikbaar" };
    }

    // User count from Supabase
    try {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      report.total_users = count || 0;
    } catch {
      report.total_users = "onbekend";
    }

    // Active users in period
    try {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte(
          "last_seen_at",
          new Date(
            Date.now() - (p === "month" ? 30 : 7) * 24 * 60 * 60 * 1000
          ).toISOString()
        );
      report.active_users = count || 0;
    } catch {
      report.active_users = "onbekend";
    }

    // Analysis count in period
    try {
      const analysisResult = await pool.query(
        `SELECT COUNT(*) as total,
          AVG((result->>'overallScore')::numeric) as avg_score
         FROM conversation_analyses
         WHERE status = 'completed'
           AND created_at > NOW() - INTERVAL '${interval}'`,
      );
      report.analyses = {
        total: parseInt(analysisResult.rows[0]?.total || "0", 10),
        avg_score: analysisResult.rows[0]?.avg_score
          ? parseFloat(analysisResult.rows[0].avg_score).toFixed(1)
          : null,
      };
    } catch {
      report.analyses = { error: "Analyses niet beschikbaar" };
    }

    // Upcoming webinars
    try {
      const { data } = await supabase
        .from("live_sessions")
        .select("id, title, scheduled_date")
        .gte("scheduled_date", new Date().toISOString())
        .eq("status", "scheduled")
        .order("scheduled_date")
        .limit(5);
      report.upcoming_webinars = data || [];
    } catch {
      report.upcoming_webinars = [];
    }

    return JSON.stringify({ report });
  } catch (err: any) {
    return JSON.stringify({ error: `Rapport genereren mislukt: ${err.message}` });
  }
}

// 26. get_technique_usage_trends
async function execGetTechniqueUsageTrends(): Promise<string> {
  try {
    const result = await pool.query(`
      SELECT
        result->>'technique' as technique,
        COUNT(*) as practice_count,
        AVG((result->>'overallScore')::numeric) as avg_score,
        MIN(created_at) as first_practice,
        MAX(created_at) as last_practice
      FROM conversation_analyses
      WHERE status = 'completed'
        AND created_at > NOW() - INTERVAL '30 days'
        AND result->>'technique' IS NOT NULL
      GROUP BY result->>'technique'
      ORDER BY practice_count DESC
      LIMIT 20
    `);
    return JSON.stringify({ trends: result.rows });
  } catch (err: any) {
    return JSON.stringify({ error: `Techniek trends ophalen mislukt: ${err.message}` });
  }
}
