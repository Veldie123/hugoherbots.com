/**
 * V3 Knowledge Tools
 *
 * Tools the Hugo agent uses to look up methodology, training materials,
 * user profiles, videos, and episodic memories.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { searchRag, getTrainingContext } from "../../v2/rag-service";
import { pool } from "../../db";
import { supabase } from "../../supabase-client";
import {
  saveMemory,
  recallMemories as recallMemoriesFromService,
  getMemoriesForUser,
  type MemoryType,
} from "../memory-service";

// ── Tool Definitions (Claude format) ────────────────────────────────────────

export const knowledgeToolDefinitions: Anthropic.Tool[] = [
  {
    name: "search_methodology",
    description:
      "Zoek in Hugo's EPIC sales methodologie naar een techniek, fase, of stappenplan. Gebruik dit wanneer je specifieke techniek-details nodig hebt (wat, waarom, wanneer, hoe, stappenplan, voorbeeldzinnen).",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Zoekterm: techniek-ID (bv. '2.1'), techniek-naam (bv. 'Explore'), fase-naam (bv. 'ontdekkingsfase'), of vrije zoekterm.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_training_materials",
    description:
      "Doorzoek Hugo's trainingsmateriaal (RAG corpus) voor relevante fragmenten uit zijn echte trainingen. Gebruik dit om je antwoorden te gronden in Hugo's eigen woorden en stijl.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Zoekterm of onderwerp om trainingsmateriaal over te vinden.",
        },
        technique_id: {
          type: "string",
          description: "Optioneel: filter op specifieke techniek-ID.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user_profile",
    description:
      "Haal het profiel op van de huidige seller: sector, product, klanttype, techniek-beheersing, struggle patterns, en moeilijkheidsgraad. Gebruik dit aan het begin van een sessie.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: {
          type: "string",
          description: "Het user ID van de seller.",
        },
      },
      required: ["user_id"],
    },
  },
  {
    name: "suggest_video",
    description:
      "Zoek een relevante trainingsvideo voor een specifieke techniek. Retourneert video-details met Mux playback URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        technique_id: {
          type: "string",
          description: "De techniek-ID waarvoor een video gezocht wordt.",
        },
      },
      required: ["technique_id"],
    },
  },
  {
    name: "recall_memories",
    description:
      "Herinner eerdere inzichten over deze seller uit vorige sessies. Semantisch zoeken in episodisch geheugen. Gebruik dit om te verwijzen naar wat je eerder geleerd hebt over de seller.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: {
          type: "string",
          description: "Het user ID van de seller.",
        },
        query: {
          type: "string",
          description: "Wat je wilt herinneren (bv. 'vorige sessie', 'struggle met discovery').",
        },
        memory_type: {
          type: "string",
          enum: ["insight", "struggle", "goal", "personal", "session_summary"],
          description: "Optioneel: filter op type herinnering.",
        },
      },
      required: ["user_id"],
    },
  },
  {
    name: "get_technique_script",
    description:
      "Haal het volledige transcript op van een trainingsvideo voor een specifieke techniek. Geeft de tekst terug die Hugo in de video uitspreekt, gesegmenteerd per paragraaf. Gebruik dit in avatar-modus om de les-content via de avatar te presenteren. Optioneel: vertaal naar een doeltaal.",
    input_schema: {
      type: "object" as const,
      properties: {
        technique_id: {
          type: "string",
          description: "De techniek-ID waarvoor het script opgehaald wordt (bv. '1.1', '2.1.3').",
        },
        target_language: {
          type: "string",
          enum: ["nl", "fr", "en", "de"],
          description: "Doeltaal voor vertaling. Default: nl (origineel, geen vertaling).",
        },
      },
      required: ["technique_id"],
    },
  },
  {
    name: "navigate_user",
    description:
      "Stuur de verkoper naar een specifieke pagina of item. Gebruik ALLEEN als de actie niet inline kan. Voor video's: eerst suggest_video aanroepen om technique_id te weten, dan navigate_user met itemId. Coaching/rollenspel/uitleg → altijd inline.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination: {
          type: "string",
          enum: ["videos", "upload-analysis", "dashboard", "settings", "live"],
          description: "Pagina: 'videos' voor trainingen, 'upload-analysis' om gesprek te uploaden, 'dashboard' voor voortgang, 'live' voor webinars.",
        },
        itemId: {
          type: "string",
          description: "Optioneel: specifiek item. Voor videos: technique_id (bv. '2.1'). Voor live: session_id.",
        },
        label: {
          type: "string",
          description: "Leesbare naam voor de navigatiekaart, bv. 'Video: Probe technieken' of 'Webinar: EPIC Intro'.",
        },
      },
      required: ["destination", "label"],
    },
  },
  {
    name: "save_insight",
    description:
      "Sla een inzicht of observatie op over deze seller. Wordt opgeslagen in episodisch geheugen en is beschikbaar in toekomstige sessies. Gebruik dit na belangrijke observaties, patronen, of persoonlijke context.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: {
          type: "string",
          description: "Het user ID van de seller.",
        },
        content: {
          type: "string",
          description: "Het inzicht om op te slaan (bv. 'Seller worstelt met concretiseren bij analyserend klanttype.').",
        },
        memory_type: {
          type: "string",
          enum: ["insight", "struggle", "goal", "personal", "session_summary"],
          description: "Type herinnering. Default: insight.",
        },
        technique_id: {
          type: "string",
          description: "Optioneel: gerelateerde techniek-ID.",
        },
      },
      required: ["user_id", "content"],
    },
  },
];

// ── Tool Execution ──────────────────────────────────────────────────────────

let cachedTechniques: any[] | null = null;

function loadTechniques(): any[] {
  if (cachedTechniques) return cachedTechniques;
  const techPath = join(process.cwd(), "config/ssot/technieken_index.json");
  cachedTechniques = JSON.parse(readFileSync(techPath, "utf-8"));
  return cachedTechniques;
}

export async function executeKnowledgeTool(
  name: string,
  input: Record<string, any>
): Promise<string> {
  switch (name) {
    case "search_methodology":
      return await searchMethodology(input.query);
    case "search_training_materials":
      return await searchTrainingMaterials(input.query, input.technique_id);
    case "get_user_profile":
      return await getUserProfile(input.user_id);
    case "suggest_video":
      return await suggestVideo(input.technique_id);
    case "get_technique_script":
      return await getTechniqueScript(input.technique_id, input.target_language);
    case "recall_memories":
      return await recallMemories(input.user_id, input.query, input.memory_type);
    case "navigate_user":
      return JSON.stringify({ destination: input.destination, ok: true });
    case "save_insight":
      return await saveInsight(input.user_id, input.content, input.memory_type, input.technique_id);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ── Individual Tool Implementations ─────────────────────────────────────────

async function searchMethodology(query: string): Promise<string> {
  const techniques = loadTechniques();
  const q = query.toLowerCase();

  // Try exact ID match first
  const exact = techniques.find(
    (t: any) => t.id?.toLowerCase() === q || t.nummer?.toLowerCase() === q
  );
  if (exact) {
    return JSON.stringify(formatTechnique(exact));
  }

  // Try name/title match
  const nameMatch = techniques.filter(
    (t: any) =>
      t.naam?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q) ||
      t.beschrijving?.toLowerCase().includes(q)
  );
  if (nameMatch.length > 0) {
    return JSON.stringify(nameMatch.slice(0, 5).map(formatTechnique));
  }

  // Try phase match
  const phaseMatch = techniques.filter(
    (t: any) =>
      t.fase?.toString() === q ||
      t.fase_naam?.toLowerCase().includes(q)
  );
  if (phaseMatch.length > 0) {
    return JSON.stringify(
      phaseMatch.map((t: any) => ({
        id: t.id || t.nummer,
        naam: t.naam || t.title,
        fase: t.fase,
      }))
    );
  }

  // Fallback: fuzzy search across all fields
  const fuzzy = techniques.filter((t: any) =>
    JSON.stringify(t).toLowerCase().includes(q)
  );
  return JSON.stringify(
    fuzzy.length > 0
      ? fuzzy.slice(0, 5).map(formatTechnique)
      : { message: `Geen techniek gevonden voor '${query}'.` }
  );
}

function formatTechnique(t: any): any {
  return {
    id: t.id || t.nummer,
    naam: t.naam || t.title,
    fase: t.fase,
    fase_naam: t.fase_naam,
    wat: t.wat,
    waarom: t.waarom,
    wanneer: t.wanneer,
    hoe: t.hoe,
    stappenplan: t.stappenplan,
    voorbeeld_zinnen: t.voorbeeld_zinnen,
    parent_id: t.parent_id,
  };
}

async function searchTrainingMaterials(
  query: string,
  techniqueId?: string
): Promise<string> {
  const result = await searchRag(query, {
    limit: 5,
    threshold: 0.4,
    docType: "hugo_training",
    technikId: techniqueId,
  });

  if (result.documents.length === 0) {
    return JSON.stringify({
      message: "Geen trainingsmateriaal gevonden.",
      query,
    });
  }

  return JSON.stringify(
    result.documents.map((doc) => ({
      title: doc.title,
      content: doc.content.slice(0, 800),
      similarity: doc.similarity
        ? `${(doc.similarity * 100).toFixed(0)}%`
        : undefined,
    }))
  );
}

async function getUserProfile(userId: string): Promise<string> {
  const profile: any = {};

  // User context (sector, product, etc.)
  try {
    const contextResult = await pool.query(
      `SELECT context FROM v2_sessions
       WHERE user_id = $1 AND context IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (contextResult.rows[0]?.context) {
      profile.context = contextResult.rows[0].context;
    }
  } catch {
    // Table may not exist yet
  }

  // Technique mastery
  try {
    const { data } = await supabase
      .from("user_technique_mastery")
      .select("*")
      .eq("user_id", userId);
    if (data && data.length > 0) {
      profile.mastery = data.map((m: any) => ({
        technique: m.technique_id,
        score: m.average_score,
        attempts: m.attempt_count,
        trend: m.trend,
      }));
    }
  } catch {
    // Table may not exist yet
  }

  // Recent sessions
  try {
    const sessionResult = await pool.query(
      `SELECT technique_id, mode, total_score, created_at
       FROM v2_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );
    if (sessionResult.rows.length > 0) {
      profile.recentSessions = sessionResult.rows;
    }
  } catch {
    // Table may not exist yet
  }

  return JSON.stringify(
    Object.keys(profile).length > 0
      ? profile
      : { message: "Geen profiel gevonden. Dit is waarschijnlijk een nieuwe seller." }
  );
}

async function suggestVideo(techniqueId: string): Promise<string> {
  try {
    const mappingPath = join(process.cwd(), "config/video_mapping.json");
    const videos = JSON.parse(readFileSync(mappingPath, "utf-8"));
    const matches = videos.filter(
      (v: any) =>
        v.techniek === techniqueId ||
        v.techniek_id === techniqueId ||
        v.technique_id === techniqueId
    );

    if (matches.length > 0) {
      return JSON.stringify(
        matches.map((v: any) => ({
          title: v.title,
          mux_playback_id: v.mux_playback_id,
          duration: v.duration_seconds,
          technique: v.techniek || v.techniek_id,
        }))
      );
    }

    return JSON.stringify({
      message: `Geen video gevonden voor techniek ${techniqueId}.`,
    });
  } catch {
    return JSON.stringify({ error: "Video mapping niet beschikbaar." });
  }
}

async function getTechniqueScript(
  techniqueId: string,
  targetLanguage?: string
): Promise<string> {
  try {
    // Load video mapping to find videos for this technique
    const mappingPath = join(process.cwd(), "config/video_mapping.json");
    const mapping = JSON.parse(readFileSync(mappingPath, "utf-8"));
    const videoEntries = Object.values(mapping.videos || mapping) as any[];

    // Find video for this technique
    const video = videoEntries.find(
      (v: any) =>
        v.techniek === techniqueId ||
        v.techniek_id === techniqueId ||
        v.technique_id === techniqueId
    );

    if (!video) {
      return JSON.stringify({
        error: `Geen video gevonden voor techniek ${techniqueId}.`,
        fallback: "Gebruik de techniek-definitie uit de SSOT om de les zelf te presenteren.",
      });
    }

    // Fetch transcript from Supabase (video_ingest_jobs table)
    const { data: jobData, error: jobError } = await supabase
      .from("video_ingest_jobs")
      .select("transcript, video_title, ai_attractive_title, ai_summary")
      .or(`techniek_id.eq.${techniqueId},ai_suggested_techniek_id.eq.${techniqueId}`)
      .not("transcript", "is", null)
      .limit(1)
      .single();

    if (jobError || !jobData?.transcript) {
      // Fallback: try matching by video file name
      const fileName = video.file_name;
      if (fileName) {
        const { data: fallbackData } = await supabase
          .from("video_ingest_jobs")
          .select("transcript, video_title, ai_attractive_title, ai_summary")
          .eq("drive_file_name", fileName)
          .not("transcript", "is", null)
          .limit(1)
          .single();

        if (fallbackData?.transcript) {
          return formatScriptResponse(fallbackData, techniqueId, targetLanguage);
        }
      }

      return JSON.stringify({
        error: `Transcript niet gevonden voor techniek ${techniqueId}.`,
        fallback: "Gebruik de techniek-definitie uit de SSOT om de les zelf te presenteren.",
      });
    }

    return formatScriptResponse(jobData, techniqueId, targetLanguage);
  } catch (error: any) {
    return JSON.stringify({ error: `Script ophalen mislukt: ${error.message}` });
  }
}

function formatScriptResponse(
  jobData: any,
  techniqueId: string,
  targetLanguage?: string
): string {
  const transcript: string = jobData.transcript;

  // Split transcript into segments (paragraphs or sentences)
  const segments = transcript
    .split(/\n\n+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  const result: any = {
    technique_id: techniqueId,
    title: jobData.ai_attractive_title || jobData.video_title,
    summary: jobData.ai_summary,
    language: "nl",
    segment_count: segments.length,
    segments,
    instruction:
      "Presenteer deze segmenten één voor één via de avatar. " +
      "Pauzeer kort tussen segmenten zodat de seller kan onderbreken. " +
      "Als de seller onderbreekt, schakel naar coaching modus. " +
      "Na coaching, hervat bij het volgende segment.",
  };

  if (targetLanguage && targetLanguage !== "nl") {
    result.translation_needed = true;
    result.target_language = targetLanguage;
    result.translation_instruction =
      `Vertaal elk segment naar ${targetLanguage} voordat je het via de avatar uitspreekt. ` +
      "Behoud Hugo's persoonlijke stijl en toon. " +
      "Verkooptermen mogen in het Engels blijven (explore, probe, etc.). " +
      "Whiteboard-termen mogen in het Nederlands blijven — leg ze uit in de doeltaal.";
  }

  return JSON.stringify(result);
}

async function recallMemories(
  userId: string,
  query?: string,
  memoryType?: string
): Promise<string> {
  try {
    // Semantic search in episodic memory
    const memories = await recallMemoriesFromService({
      userId,
      query: query || "recente sessies en inzichten",
      limit: 5,
      threshold: 0.35,
      memoryType: memoryType as MemoryType | undefined,
    });

    if (memories.length > 0) {
      return JSON.stringify({
        memories: memories.map((m) => ({
          content: m.content,
          type: m.memoryType,
          technique: m.techniqueId,
          date: m.createdAt,
          similarity: m.similarity
            ? `${(m.similarity * 100).toFixed(0)}%`
            : undefined,
        })),
      });
    }

    // Fallback 1: recent memories directly (no semantic search, just newest entries)
    const recentMemories = await getMemoriesForUser(userId, 5);
    if (recentMemories.length > 0) {
      return JSON.stringify({
        memories: recentMemories.map((m) => ({
          content: m.content,
          type: m.memoryType,
          date: m.createdAt,
        })),
      });
    }

    // Fallback 2: V2 historical sessions
    const result = await pool.query(
      `SELECT technique_id, mode, total_score, context, created_at
       FROM v2_sessions
       WHERE user_id = $1 AND context IS NOT NULL
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({
        message: "Geen herinneringen of eerdere sessies gevonden voor deze seller.",
      });
    }

    return JSON.stringify({
      memories: [],
      previous_sessions: result.rows.map((r: any) => ({
        technique: r.technique_id,
        mode: r.mode,
        score: r.total_score,
        context: r.context,
        date: r.created_at,
      })),
    });
  } catch {
    return JSON.stringify({
      message: "Geheugen niet beschikbaar.",
    });
  }
}

async function saveInsight(
  userId: string,
  content: string,
  memoryType?: string,
  techniqueId?: string
): Promise<string> {
  try {
    const result = await saveMemory({
      userId,
      content,
      memoryType: (memoryType as MemoryType) || "insight",
      source: "autonomous",
      techniqueId,
    });

    if (result.success) {
      return JSON.stringify({
        saved: true,
        memory_id: result.memoryId,
        message: `Inzicht opgeslagen: "${content.slice(0, 80)}..."`,
      });
    }

    return JSON.stringify({
      saved: false,
      error: result.error || "Opslaan mislukt.",
    });
  } catch (err: any) {
    return JSON.stringify({
      saved: false,
      error: err.message || "Opslaan mislukt.",
    });
  }
}
