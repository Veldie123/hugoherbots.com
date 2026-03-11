/**
 * V3 Admin Tools
 *
 * 31 admin tools for the V3 Claude agent — platform management,
 * analytics, content, users, proactive insights, and notifications.
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

  // ══════════════════════════════════════════════════════════════════════════════
  // ONBOARDING TOOLS (27-29)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── 27. get_onboarding_status ────────────────────────────────────────────────
  {
    name: "get_onboarding_status",
    description:
      "Haal de onboarding-status op: hoeveel technieken en houdingen zijn al gereviewd door Hugo.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ── 28. get_next_review_item ─────────────────────────────────────────────────
  {
    name: "get_next_review_item",
    description:
      "Haal het volgende item op dat Hugo moet reviewen (techniek of houding). Toont alle details voor presentatie.",
    input_schema: {
      type: "object" as const,
      properties: {
        module: {
          type: "string",
          enum: ["technieken", "houdingen"],
          description:
            "Welke module ophalen. Laat leeg voor het eerstvolgende pending item over alle modules.",
        },
      },
      required: [],
    },
  },
  // ── 29. submit_review ────────────────────────────────────────────────────────
  {
    name: "submit_review",
    description:
      "Registreer Hugo's oordeel over een onboarding-item: goedkeuren, feedback geven, of overslaan.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_key: {
          type: "string",
          description: "De key van het item (bijv. '2.1' voor een techniek, 'positief' voor een houding)",
        },
        action: {
          type: "string",
          enum: ["approved", "feedback", "skipped"],
          description: "Hugo's beslissing: approved, feedback (met tekst), of skipped",
        },
        feedback_text: {
          type: "string",
          description: "Hugo's feedback of correctie (alleen bij action='feedback')",
        },
      },
      required: ["item_key", "action"],
    },
  },
  // ── 30. compare_ai_vs_expected ─────────────────────────────────────────────
  {
    name: "compare_ai_vs_expected",
    description:
      "Haal een coaching-sessie transcript op zodat Hugo kan vergelijken wat de AI zei vs wat hij zou zeggen.",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string", description: "ID van de coaching-sessie" },
        turn_index: {
          type: "number",
          description: "Optioneel: specifieke beurt (0-based). Zonder geeft heel transcript.",
        },
      },
      required: ["session_id"],
    },
  },
  // ── 31. send_user_notification ─────────────────────────────────────────────
  {
    name: "send_user_notification",
    description:
      "Verstuur een notificatie naar een gebruiker (motivatie, tip, herinnering).",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string", description: "UUID van de gebruiker" },
        title: { type: "string", description: "Korte titel (max 60 tekens)" },
        message: { type: "string", description: "Notificatie-inhoud" },
      },
      required: ["user_id", "title", "message"],
    },
  },
  // ── 32. navigate_user ───────────────────────────────────────────────────────
  {
    name: "navigate_user",
    description:
      "Stuur Hugo naar een specifieke pagina in het admin-platform. Gebruik ALLEEN als het overzicht echt nodig is. Data opvragen, analyses en acties → altijd inline via tools. Leg altijd eerst kort in tekst uit wat er gaat gebeuren.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination: {
          type: "string",
          enum: ["users", "sessions", "analytics", "settings"],
          description: "Pagina: 'users' voor gebruikersbeheer, 'sessions' voor sessie-overzicht, 'analytics' voor statistieken, 'settings' voor instellingen.",
        },
      },
      required: ["destination"],
    },
  },
];

// ── Tool name registry ───────────────────────────────────────────────────────

export const ADMIN_TOOLS: Set<string> = new Set(
  adminToolDefinitions.map((t) => t.name)
);

// ── Cached config loaders ────────────────────────────────────────────────────

interface TechniqueEntry {
  id?: string;
  nummer?: string;
  naam?: string;
  title?: string;
  fase?: string;
  is_fase?: boolean;
  doel?: string;
  themas?: string[];
  tags?: string[];
  [key: string]: unknown;
}

interface MasteryEntry {
  technique_id: string;
  average_score: number;
  attempt_count?: number;
  trend?: string;
  [key: string]: unknown;
}

let cachedTechniques: Record<string, unknown> | null = null;

function loadTechniques(): Record<string, unknown> {
  if (cachedTechniques) return cachedTechniques;
  const techPath = join(process.cwd(), "config/ssot/technieken_index.json");
  cachedTechniques = JSON.parse(readFileSync(techPath, "utf-8")) as Record<string, unknown>;
  return cachedTechniques;
}

let cachedHoudingen: Record<string, unknown> | null = null;

function loadHoudingen(): Record<string, unknown> {
  if (cachedHoudingen) return cachedHoudingen;
  const houdPath = join(process.cwd(), "config/klant_houdingen.json");
  cachedHoudingen = JSON.parse(readFileSync(houdPath, "utf-8")) as Record<string, unknown>;
  return cachedHoudingen;
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
      case "get_onboarding_status":
        return await execGetOnboardingStatus();
      case "get_next_review_item":
        return await execGetNextReviewItem(input.module);
      case "submit_review":
        return await execSubmitReview(input.item_key, input.action, input.feedback_text);
      case "compare_ai_vs_expected":
        return await execCompareAiVsExpected(input.session_id, input.turn_index);
      case "send_user_notification":
        return await execSendUserNotification(input.user_id, input.title, input.message);
      case "navigate_user":
        return JSON.stringify({ destination: input.destination, ok: true });
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
    const rawTech = loadTechniques();
    const technieken = Object.values((rawTech as { technieken?: Record<string, TechniqueEntry> }).technieken || rawTech) as TechniqueEntry[];
    const q = idOrName?.toLowerCase();
    const found = technieken.find(
      (t: TechniqueEntry) =>
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
      techniques: technieken.slice(0, 5).map((t: TechniqueEntry) => ({
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
    const result = await pool.query(
      `INSERT INTO admin_corrections (type, field, original_value, new_value, context, submitted_by, source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.type || "config_change",
        input.field || "",
        input.current_value || "",
        input.proposed_value,
        input.reason || "",
        "Hugo (AI)",
        "v3_agent_proposal",
        "pending",
      ]
    );
    const correctionId = result.rows[0]?.id;
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["config_proposal", `Config voorstel: ${input.field || input.type}`, input.reason || "", "content", "medium", correctionId, "admin-config-review"]
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
    const result = await pool.query(
      `INSERT INTO admin_corrections (type, field, original_value, new_value, context, submitted_by, source, original_json, new_json, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        "slide_edit",
        slideId,
        currentSlide ? JSON.stringify(currentSlide) : "",
        JSON.stringify(changes),
        reason,
        "Hugo (AI)",
        "v3_agent_proposal",
        currentSlide ? JSON.stringify(currentSlide) : null,
        JSON.stringify(changes),
        "pending",
      ]
    );
    const correctionId = result.rows[0]?.id;
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["config_proposal", `Slide voorstel: ${slideId}`, reason, "content", "medium", correctionId, "admin-config-review"]
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
        detail.mastery = mastery.map((m: MasteryEntry) => ({
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
    const result = await pool.query(
      `INSERT INTO admin_corrections (type, field, original_value, new_value, context, submitted_by, source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        "rag_edit",
        input.fragment_id || "",
        input.action || "",
        input.content || "",
        input.reason || "",
        "Hugo (AI)",
        "v3_agent_proposal",
        "pending",
      ]
    );
    const correctionId = result.rows[0]?.id;
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["config_proposal", `RAG voorstel: ${input.action} ${input.fragment_id || "nieuw"}`, input.reason || "", "content", "medium", correctionId, "admin-config-review"]
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
    const rawTech = loadTechniques();
    const techEntries = Object.values((rawTech as { technieken?: Record<string, TechniqueEntry> }).technieken || rawTech) as TechniqueEntry[];
    const current = techEntries.find(
      (t: TechniqueEntry) =>
        t.id?.toLowerCase() === input.technique_id?.toLowerCase() ||
        t.nummer?.toLowerCase() === input.technique_id?.toLowerCase()
    );

    const result = await pool.query(
      `INSERT INTO admin_corrections (type, field, original_value, new_value, context, submitted_by, source, target_file, target_key, original_json, new_json, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        "technique_edit",
        current?.naam || input.technique_id,
        current ? JSON.stringify(current) : "",
        JSON.stringify(input.changes),
        input.reason || "",
        "Hugo (AI)",
        "v3_agent_proposal",
        "config/ssot/technieken_index.json",
        input.technique_id,
        current ? JSON.stringify(current) : null,
        JSON.stringify(input.changes),
        "pending",
      ]
    );
    const correctionId = result.rows[0]?.id;
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["config_proposal", `Techniek voorstel: ${current?.naam || input.technique_id}`, input.reason || "", "content", "high", correctionId, "admin-config-review"]
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

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING TOOL EXECUTORS (27-29)
// ══════════════════════════════════════════════════════════════════════════════

const ADMIN_USER_ID = "stephane@hugoherbots.com";

async function ensureOnboardingSeed(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM admin_onboarding_progress WHERE admin_user_id = $1`,
    [ADMIN_USER_ID]
  );
  if (parseInt(rows[0].count, 10) > 0) return;

  // Seed all techniques
  const techData = loadTechniques();
  const technieken = (techData.technieken || techData) as Record<string, TechniqueEntry>;
  for (const [key, tech] of Object.entries(technieken) as [string, TechniqueEntry][]) {
    await pool.query(
      `INSERT INTO admin_onboarding_progress (admin_user_id, module, item_key, item_name, status)
       VALUES ($1, 'technieken', $2, $3, 'pending')
       ON CONFLICT (admin_user_id, module, item_key) DO NOTHING`,
      [ADMIN_USER_ID, key, tech.naam || key]
    );
  }

  // Seed all houdingen
  const houdData = loadHoudingen();
  const houdingen = (houdData.houdingen || houdData) as Record<string, { naam?: string; [key: string]: unknown }>;
  for (const [key, houd] of Object.entries(houdingen) as [string, { naam?: string; [key: string]: unknown }][]) {
    await pool.query(
      `INSERT INTO admin_onboarding_progress (admin_user_id, module, item_key, item_name, status)
       VALUES ($1, 'houdingen', $2, $3, 'pending')
       ON CONFLICT (admin_user_id, module, item_key) DO NOTHING`,
      [ADMIN_USER_ID, key, houd.naam || key]
    );
  }
}

// 27. get_onboarding_status
async function execGetOnboardingStatus(): Promise<string> {
  try {
    await ensureOnboardingSeed();

    const result = await pool.query(
      `SELECT module, status, COUNT(*) as count
       FROM admin_onboarding_progress
       WHERE admin_user_id = $1
       GROUP BY module, status
       ORDER BY module, status`,
      [ADMIN_USER_ID]
    );

    const modules: Record<string, Record<string, number>> = {};
    let total = 0;
    let approved = 0;
    let skipped = 0;
    let feedback = 0;
    let pending = 0;

    for (const row of result.rows) {
      if (!modules[row.module]) modules[row.module] = {};
      const count = parseInt(row.count, 10);
      modules[row.module][row.status] = count;
      total += count;
      if (row.status === "approved") approved += count;
      else if (row.status === "skipped") skipped += count;
      else if (row.status === "feedback") feedback += count;
      else pending += count;
    }

    return JSON.stringify({
      total,
      approved,
      skipped,
      feedback_given: feedback,
      pending,
      isComplete: pending === 0 && total > 0,
      modules,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Onboarding status ophalen mislukt: ${err.message}` });
  }
}

// 28. get_next_review_item
async function execGetNextReviewItem(module?: string): Promise<string> {
  try {
    await ensureOnboardingSeed();

    let query = `SELECT module, item_key, item_name
       FROM admin_onboarding_progress
       WHERE admin_user_id = $1 AND status = 'pending'`;
    const params: (string | number | boolean | null)[] = [ADMIN_USER_ID];

    if (module) {
      query += ` AND module = $2`;
      params.push(module);
    }
    query += ` ORDER BY module, item_key LIMIT 1`;

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      return JSON.stringify({
        done: true,
        message: module
          ? `Alle ${module} zijn al gereviewd.`
          : "Alle onboarding items zijn gereviewd!",
      });
    }

    const item = rows[0];
    let itemData: Record<string, unknown> | null = null;
    let itemNumber = 0;
    let totalInModule = 0;

    // Count position
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM admin_onboarding_progress WHERE admin_user_id = $1 AND module = $2`,
      [ADMIN_USER_ID, item.module]
    );
    totalInModule = parseInt(countResult.rows[0].total, 10);

    const posResult = await pool.query(
      `SELECT COUNT(*) as pos FROM admin_onboarding_progress
       WHERE admin_user_id = $1 AND module = $2 AND status != 'pending'`,
      [ADMIN_USER_ID, item.module]
    );
    itemNumber = parseInt(posResult.rows[0].pos, 10) + 1;

    // Load item data from config
    if (item.module === "technieken") {
      const techData = loadTechniques();
      const technieken = (techData.technieken || techData) as Record<string, Record<string, unknown>>;
      itemData = technieken[item.item_key] ?? null;
    } else if (item.module === "houdingen") {
      const houdData = loadHoudingen();
      const houdingen = (houdData.houdingen || houdData) as Record<string, Record<string, unknown>>;
      itemData = houdingen[item.item_key] ?? null;
    }

    return JSON.stringify({
      type: item.module,
      key: item.item_key,
      name: item.item_name,
      itemNumber,
      totalInModule,
      data: itemData || { error: `Data voor '${item.item_key}' niet gevonden in config.` },
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Volgend review item ophalen mislukt: ${err.message}` });
  }
}

// 29. submit_review
async function execSubmitReview(
  itemKey: string,
  action: string,
  feedbackText?: string
): Promise<string> {
  try {
    const validActions = ["approved", "feedback", "skipped"];
    if (!validActions.includes(action)) {
      return JSON.stringify({ error: `Ongeldige actie: ${action}. Gebruik: ${validActions.join(", ")}` });
    }

    const status = action === "feedback" ? "feedback" : action;

    await pool.query(
      `UPDATE admin_onboarding_progress
       SET status = $1, feedback_text = $2, reviewed_at = NOW()
       WHERE admin_user_id = $3 AND item_key = $4`,
      [status, feedbackText || null, ADMIN_USER_ID, itemKey]
    );

    // If feedback, also store as admin_correction
    if (action === "feedback" && feedbackText) {
      try {
        const corrResult = await pool.query(
          `INSERT INTO admin_corrections (admin_user_id, category, original_text, corrected_text, context)
           VALUES ($1, 'onboarding_review', $2, $3, $4)
           RETURNING id`,
          [ADMIN_USER_ID, `Item: ${itemKey}`, feedbackText, `Onboarding review feedback for ${itemKey}`]
        );
        if (corrResult.rows[0]) {
          await pool.query(
            `UPDATE admin_onboarding_progress SET correction_id = $1 WHERE admin_user_id = $2 AND item_key = $3`,
            [corrResult.rows[0].id, ADMIN_USER_ID, itemKey]
          );
        }
      } catch {
        // admin_corrections table might not exist yet, continue
      }
    }

    // Count remaining
    const remaining = await pool.query(
      `SELECT COUNT(*) as count FROM admin_onboarding_progress WHERE admin_user_id = $1 AND status = 'pending'`,
      [ADMIN_USER_ID]
    );
    const remainingCount = parseInt(remaining.rows[0].count, 10);

    return JSON.stringify({
      success: true,
      item_key: itemKey,
      action,
      remaining: remainingCount,
      isComplete: remainingCount === 0,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Review opslaan mislukt: ${err.message}` });
  }
}

// 30. compare_ai_vs_expected
async function execCompareAiVsExpected(sessionId: string, turnIndex?: number): Promise<string> {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, result FROM conversation_analyses WHERE id = $1 AND status = 'completed'`,
      [sessionId]
    );
    if (rows.length === 0) {
      return JSON.stringify({ error: `Geen voltooide analyse gevonden voor sessie ${sessionId}` });
    }

    const analysis = rows[0];
    const result = typeof analysis.result === "string" ? JSON.parse(analysis.result) : analysis.result;

    const transcript: Array<{ role: string; text: string }> = [];
    if (result?.transcript) {
      for (const turn of result.transcript) {
        transcript.push({
          role: turn.speaker === "seller" ? "verkoper" : "klant",
          text: turn.text,
        });
      }
    }

    if (turnIndex !== undefined && turnIndex >= 0 && turnIndex < transcript.length) {
      return JSON.stringify({
        session_title: analysis.title,
        turn: transcript[turnIndex],
        turn_index: turnIndex,
        total_turns: transcript.length,
        ai_scores: {
          overall: result?.insights?.overallScore,
          technique: result?.insights?.phaseCoverage,
        },
      });
    }

    return JSON.stringify({
      session_title: analysis.title,
      transcript,
      total_turns: transcript.length,
      ai_scores: {
        overall: result?.insights?.overallScore,
        technique: result?.insights?.phaseCoverage,
      },
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Sessie ophalen mislukt: ${err.message}` });
  }
}

// 31. send_user_notification
async function execSendUserNotification(userId: string, title: string, message: string): Promise<string> {
  try {
    const { rows: userRows } = await pool.query(
      `SELECT id, full_name FROM profiles WHERE id = $1`,
      [userId]
    );
    if (userRows.length === 0) {
      return JSON.stringify({ error: `Gebruiker ${userId} niet gevonden` });
    }

    await pool.query(
      `INSERT INTO platform_feedback (id, user_id, feedback_type, metadata, created_at)
       VALUES (gen_random_uuid(), $1, 'admin_notification', $2, NOW())`,
      [userId, JSON.stringify({ title, message })]
    );

    return JSON.stringify({
      success: true,
      recipient: userRows[0].full_name || userId,
      title,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Notificatie versturen mislukt: ${err.message}` });
  }
}
