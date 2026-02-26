/**
 * Hugo Agent — AI-powered platform management assistant for Hugo Herbots
 * 
 * Agent-first interface: Hugo types natural Dutch messages,
 * the AI uses function calling to manage the platform.
 */

import { Router, type Request, Response } from "express";
import { pool } from "./db";
import { supabase } from "./supabase-client";
import { getOpenAIClient } from "./v2/rag-service";
import fs from "fs";
import path from "path";

const router = Router();

const PROCESSOR_BASE = "http://localhost:3001";

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Je bent de persoonlijke platformassistent van Hugo Herbots, de oprichter van HugoHerbots.ai.
Hugo is 82 jaar en werkt het liefst met korte, duidelijke berichten.

JOUW ROL:
- Je beheert het hele platform namens Hugo via eenvoudige gespreksbevelen
- Je communiceert ALTIJD in het Nederlands, warm en direct
- Je eindigt ALTIJD elk antwoord met het "suggestions" veld: 3 korte vervolgvragen/acties
- Je bent proactief: je signaleert problemen voor Hugo ze ziet

BESCHIKBARE ACTIES (gebruik de tools):
- Webinars: bekijken, aanmaken, datum/titel wijzigen, lanceren
- Video's: volgorde bekijken en aanpassen
- Analytics: platformstatistieken en gebruikersvoortgang
- Analyses: gespreksanalyses bekijken
- RAG: kennisbank doorzoeken
- Config: SSOT-technieken bekijken en verbeteringen voorstellen
- Gebruikers: overzicht en signalering van vastgelopen gebruikers

STIJLREGELS:
- Gebruik eenvoudige, duidelijke taal
- Geen jargon tenzij noodzakelijk
- Wees bondig maar volledig
- Bij acties: bevestig wat je gedaan hebt
- Bij fouten: leg duidelijk uit wat er mis ging

PROACTIEF GEDRAG:
- Signaleer als webinar-pipeline bijna leeg is (< 3 geplande webinars)
- Signaleer lage techniek-scores (< 60%)
- Signaleer gebruikers die lang niet actief waren
- Stel nieuwe video-opnames voor bij terugkerende vragen
`;

// ── Tool definitions ────────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_platform_analytics",
      description: "Haal platform-brede statistieken op: actieve gebruikers, sessies, video views, etc.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_content_performance",
      description: "Haal content-prestaties op: welke video's en webinars het best presteren.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_webinars",
      description: "Lijst alle webinars op (aankomend, afgelopen, of alles).",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["upcoming", "past", "all"],
            description: "Welke webinars ophalen. Default: 'all'"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_webinar",
      description: "Pas een webinar aan: verander de titel, datum of beschrijving.",
      parameters: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Het ID van de webinar" },
          title: { type: "string", description: "Nieuwe titel" },
          scheduled_date: { type: "string", description: "Nieuwe datum (ISO 8601 formaat, bijv. 2026-03-15T14:00:00Z)" },
          description: { type: "string", description: "Nieuwe beschrijving" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_webinar",
      description: "Plan een nieuw webinar in.",
      parameters: {
        type: "object",
        required: ["title", "scheduled_date"],
        properties: {
          title: { type: "string", description: "Titel van het webinar" },
          scheduled_date: { type: "string", description: "Datum en tijd (ISO 8601)" },
          description: { type: "string", description: "Beschrijving van het webinar" },
          topic: { type: "string", description: "Onderwerp/techniek" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_webinar",
      description: "Geef de instructie om een webinar te starten. Toont een startknop aan Hugo.",
      parameters: {
        type: "object",
        required: ["session_id"],
        properties: {
          session_id: { type: "string", description: "Het ID van de webinar die gestart moet worden" },
          session_title: { type: "string", description: "De naam van de webinar (voor in de knop)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_video_order",
      description: "Haal de huidige afspeelvolgorde van de video's op.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "reorder_videos",
      description: "Pas de volgorde van video's aan. Geef een array met video ID's en hun nieuwe positie.",
      parameters: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            description: "Array van video objecten met id en playback_order",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                playback_order: { type: "number" }
              }
            }
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_analyses",
      description: "Lijst recente gespreksanalyses op.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Aantal analyses (default 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_analysis_detail",
      description: "Haal de details van een specifieke gespreksanalyse op.",
      parameters: {
        type: "object",
        required: ["analysis_id"],
        properties: {
          analysis_id: { type: "string", description: "Het ID van de analyse" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_rag",
      description: "Doorzoek de kennisbank (RAG) op een onderwerp of techniek.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "De zoekterm of vraag" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_technique_details",
      description: "Haal de details op van een EPIC-techniek uit de SSOT.",
      parameters: {
        type: "object",
        required: ["technique_id_or_name"],
        properties: {
          technique_id_or_name: { type: "string", description: "ID (bijv. '2.1') of naam van de techniek" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "propose_config_change",
      description: "Stel een wijziging voor aan de SSOT/config die ter review naar Stéphane gaat.",
      parameters: {
        type: "object",
        required: ["type", "proposed_value", "reason"],
        properties: {
          type: { type: "string", description: "Type wijziging: 'techniek', 'persona', 'prompt', 'rag_addition', 'video_suggestion'" },
          field: { type: "string", description: "Welk veld of onderdeel wordt gewijzigd" },
          current_value: { type: "string", description: "Huidige waarde (indien bekend)" },
          proposed_value: { type: "string", description: "Voorgestelde nieuwe waarde" },
          reason: { type: "string", description: "Waarom deze wijziging nodig is" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_stuck_users",
      description: "Lijst gebruikers op die meer dan 14 dagen niet actief waren of vastgelopen zijn.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_webinar_pipeline_status",
      description: "Controleer hoeveel webinars er nog gepland staan. Geeft een waarschuwing als er minder dan 3 zijn.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_low_performing_techniques",
      description: "Haal technieken op met lage gemiddelde scores (< 60%) in de laatste 30 dagen.",
      parameters: { type: "object", properties: {} }
    }
  }
];

// ── Tool execution ──────────────────────────────────────────────────────────────
async function executeTool(name: string, args: any): Promise<{ data: any; display_type: string; error?: string }> {
  try {
    switch (name) {

      case "get_platform_analytics": {
        const res = await fetch(`${PROCESSOR_BASE}/api/analytics/platform`);
        const data = await res.json() as any;
        return { data, display_type: "analytics" };
      }

      case "get_content_performance": {
        const res = await fetch(`${PROCESSOR_BASE}/api/analytics/content-performance`);
        const data = await res.json() as any;
        return { data, display_type: "analytics" };
      }

      case "list_webinars": {
        const filter = args.filter || "all";
        let query = supabase.from("live_sessions").select("*").order("scheduled_date", { ascending: false });
        if (filter === "upcoming") {
          query = query.gte("scheduled_date", new Date().toISOString());
        } else if (filter === "past") {
          query = query.lt("scheduled_date", new Date().toISOString());
        }
        const { data, error } = await query.limit(20);
        if (error) return { data: null, display_type: "webinar_list", error: error.message };
        return { data: data || [], display_type: "webinar_list" };
      }

      case "update_webinar": {
        const { id, ...patch } = args;
        const res = await fetch(`${PROCESSOR_BASE}/api/admin/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
        const data = await res.json() as any;
        return { data, display_type: "webinar_list" };
      }

      case "create_webinar": {
        const res = await fetch(`${PROCESSOR_BASE}/api/admin/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        });
        const data = await res.json() as any;
        return { data, display_type: "webinar_list" };
      }

      case "start_webinar": {
        return {
          data: { action: "start_webinar", session_id: args.session_id, session_title: args.session_title || "Webinar" },
          display_type: "start_button"
        };
      }

      case "get_video_order": {
        const res = await fetch(`${PROCESSOR_BASE}/api/videos/playback-order`);
        const data = await res.json() as any;
        return { data: data?.videos || data || [], display_type: "video_order" };
      }

      case "reorder_videos": {
        const res = await fetch(`${PROCESSOR_BASE}/api/videos/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videos: args.items })
        });
        const data = await res.json() as any;
        return { data, display_type: "video_order" };
      }

      case "list_analyses": {
        const limit = args.limit || 10;
        const result = await pool.query(
          `SELECT id, title, status, created_at, completed_at,
            result->>'overallScore' as score
           FROM conversation_analyses
           WHERE id NOT LIKE 'session-%'
           ORDER BY created_at DESC LIMIT $1`,
          [limit]
        );
        return { data: result.rows, display_type: "analysis_list" };
      }

      case "get_analysis_detail": {
        const result = await pool.query(
          `SELECT id, title, status, created_at, result FROM conversation_analyses WHERE id = $1`,
          [args.analysis_id]
        );
        return { data: result.rows[0] || null, display_type: "transcript" };
      }

      case "search_rag": {
        const res = await fetch(`${PROCESSOR_BASE}/api/rag/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: args.query, limit: 5 })
        });
        const data = await res.json() as any;
        return { data, display_type: "rag_results" };
      }

      case "get_technique_details": {
        const techniekPath = path.join(process.cwd(), "config", "ssot", "technieken_index.json");
        const raw = fs.readFileSync(techniekPath, "utf-8");
        const technieken = JSON.parse(raw);
        const query = args.technique_id_or_name?.toLowerCase();
        const found = technieken.find((t: any) =>
          t.id?.toLowerCase() === query ||
          t.naam?.toLowerCase().includes(query) ||
          t.title?.toLowerCase().includes(query)
        );
        return { data: found || technieken.slice(0, 5), display_type: "rag_results" };
      }

      case "propose_config_change": {
        await pool.query(
          `INSERT INTO config_proposals (proposed_by, type, field, current_value, proposed_value, reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          ["hugo", args.type, args.field || "", args.current_value || "", args.proposed_value, args.reason]
        );
        return {
          data: {
            type: args.type,
            field: args.field,
            current_value: args.current_value,
            proposed_value: args.proposed_value,
            reason: args.reason,
            status: "pending"
          },
          display_type: "config_proposal"
        };
      }

      case "get_stuck_users": {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, last_seen_at, created_at")
          .lt("last_seen_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .order("last_seen_at", { ascending: true })
          .limit(20);
        if (error) {
          const { data: altData } = await supabase
            .from("users")
            .select("id, full_name, email, updated_at")
            .limit(10);
          return { data: altData || [], display_type: "user_list" };
        }
        return { data: data || [], display_type: "user_list" };
      }

      case "get_webinar_pipeline_status": {
        const { data, error } = await supabase
          .from("live_sessions")
          .select("id, title, scheduled_date, status")
          .gte("scheduled_date", new Date().toISOString())
          .eq("status", "scheduled")
          .order("scheduled_date");
        const upcoming = data || [];
        return {
          data: {
            upcoming_count: upcoming.length,
            webinars: upcoming,
            warning: upcoming.length < 3
          },
          display_type: "analytics"
        };
      }

      case "get_low_performing_techniques": {
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
          return { data: result.rows, display_type: "analytics" };
        } catch {
          return { data: [], display_type: "analytics" };
        }
      }

      default:
        return { data: null, display_type: "text", error: `Onbekende tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`[HugoAgent] Tool error (${name}):`, err.message);
    return { data: null, display_type: "text", error: err.message };
  }
}

// ── Main chat endpoint ──────────────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response) => {
  const { message, history = [], isFirstLoad = false } = req.body;

  const openai = getOpenAIClient();
  if (!openai) {
    res.status(500).json({ error: "OpenAI is niet geconfigureerd op deze server." });
    return;
  }

  try {
    const systemMessage = { role: "system" as const, content: SYSTEM_PROMPT };
    const userMessage = isFirstLoad
      ? {
          role: "user" as const,
          content: "Geef me een dagelijkse briefing. Check: hoeveel webinars er gepland staan, de platform analytics van vandaag, en of er iets urgents is dat ik moet weten."
        }
      : { role: "user" as const, content: message };

    const messages: any[] = [
      systemMessage,
      ...history.slice(-20),
      userMessage
    ];

    let toolResults: Array<{ tool: string; data: any; display_type: string; error?: string }> = [];
    let finalReply = "";
    let suggestions: string[] = [];
    let urgencyFlags: Array<{ type: string; message: string }> = [];

    let currentMessages = [...messages];
    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (loopCount < MAX_LOOPS) {
      loopCount++;
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: currentMessages,
        tools: TOOLS as any,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: 2000
      });
      const choice = completion.choices?.[0];

      if (!choice) break;

      if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls) {
        currentMessages.push(choice.message as any);

        for (const toolCall of choice.message.tool_calls || []) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

          console.log(`[HugoAgent] Executing tool: ${toolName}`, toolArgs);

          const result = await executeTool(toolName, toolArgs);
          toolResults.push({ tool: toolName, ...result });

          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result.error ? { error: result.error } : result.data)
          });

          if (toolName === "get_webinar_pipeline_status" && result.data?.warning) {
            urgencyFlags.push({
              type: "warning",
              message: `Webinar-pipeline bijna leeg: nog maar ${result.data.upcoming_count} webinar(s) gepland!`
            });
          }
        }
        continue;
      }

      finalReply = choice.message?.content || "";
      break;
    }

    const suggestionPrompt: any[] = [
      systemMessage,
      ...currentMessages.slice(1),
      {
        role: "user",
        content: `Geef nu precies 3 korte vervolgacties/vragen voor Hugo als JSON array. 
Formaat: {"suggestions": ["...", "...", "..."]}
De suggesties moeten aansluiten op het laatste antwoord en Hugo helpen proactief te handelen.
Antwoord ALLEEN met de JSON, niets anders.`
      }
    ];

    try {
      const suggCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: suggestionPrompt,
        temperature: 0.5,
        max_tokens: 200
      });
      const suggContent = suggCompletion.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(suggContent);
      suggestions = parsed.suggestions || [];
    } catch {
      suggestions = [
        "Bekijk de aankomende webinars",
        "Controleer de video-volgorde",
        "Toon de platform analytics"
      ];
    }

    res.json({
      reply: finalReply,
      tool_results: toolResults,
      suggestions,
      urgency_flags: urgencyFlags
    });

  } catch (err: any) {
    console.error("[HugoAgent] Chat error:", err);
    res.status(500).json({
      error: "Er ging iets mis. Probeer opnieuw.",
      details: err.message
    });
  }
});

export { router as hugoAgentRouter };
