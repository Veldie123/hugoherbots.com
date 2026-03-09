/**
 * Hero Text Service — AI-generated personalized hero text per module
 *
 * Uses Claude Haiku to generate badge/title/subtitle for each module's
 * HeroBanner, based on user activity data. Results are cached 24h in DB
 * with data-hash invalidation.
 */
import crypto from "crypto";
import { pool } from "./db";
import { getAnthropicClient, isV3Available, HERO_MODEL } from "./v3/anthropic-client";
import { buildUserBriefing, formatBriefingForPrompt, type UserBriefing } from "./v3/user-briefing";
import { supabase } from "./supabase-client";

// ── Types ───────────────────────────────────────────────────────────────────

type ModuleType = "dashboard" | "hugo-ai" | "analysis" | "webinar" | "techniques";

interface HeroText {
  badge: string;
  title: string;
  subtitle: string;
  fromCache: boolean;
}

interface ModuleData {
  [key: string]: any;
}

// ── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Je bent Hugo Herbots, een 82-jarige Belgische sales coach.
Schrijf korte, persoonlijke hero-teksten voor het HugoHerbots.com platform.

Regels:
- Taal: Nederlands (Belgisch)
- Badge: 2-4 woorden, kort en krachtig (bijv. "Ga verder", "Jouw groei", "Volgende stap")
- Title: max 6 woorden, persoonlijk en motiverend
- Subtitle: 2-3 zinnen, 150-250 karakters. Inspirerend, concreet, verwijzend naar de data van de gebruiker.
- Als de gebruiker nieuw is (geen data): schrijf een warm welkom en motiveer om te starten.
- Verwijs NOOIT naar specifieke scores als die 0 zijn of ontbreken.
- Gebruik de E.P.I.C. TECHNIQUE methodologie als relevant.

Antwoord ALLEEN in dit JSON-formaat, geen extra tekst:
{"badge":"...","title":"...","subtitle":"..."}`;

// ── Main Entry Point ────────────────────────────────────────────────────────

export async function getHeroTexts(
  userId: string,
  modules: ModuleType[]
): Promise<Record<string, HeroText>> {
  if (!isV3Available()) return {};

  // Build briefing once, share across all modules
  let briefing: UserBriefing;
  try {
    briefing = await buildUserBriefing(userId);
  } catch (err) {
    console.error("[HeroText] Failed to build user briefing:", err);
    return {};
  }

  const results: Record<string, HeroText> = {};

  // Process modules in parallel
  await Promise.allSettled(
    modules.map(async (module) => {
      try {
        const result = await getHeroTextForModule(userId, module, briefing);
        if (result) results[module] = result;
      } catch (err) {
        console.error(`[HeroText] Error for module ${module}:`, err);
      }
    })
  );

  return results;
}

// ── Per-Module Logic ────────────────────────────────────────────────────────

async function getHeroTextForModule(
  userId: string,
  module: ModuleType,
  briefing: UserBriefing
): Promise<HeroText | null> {
  // Collect module-specific data
  const moduleData = await collectModuleData(module, userId);
  const dataHash = computeDataHash(briefing, moduleData);

  // Check cache
  const cached = await getCachedHeroText(userId, module, dataHash);
  if (cached) return cached;

  // Generate new text via Claude
  return generateAndCacheHeroText(userId, module, briefing, moduleData, dataHash);
}

// ── Module Data Collection ──────────────────────────────────────────────────

async function collectModuleData(
  module: ModuleType,
  userId: string
): Promise<ModuleData> {
  switch (module) {
    case "hugo-ai":
      return collectHugoAiData(userId);
    case "analysis":
      return collectAnalysisData(userId);
    case "webinar":
      return collectWebinarData(userId);
    case "techniques":
      return collectTechniquesData(userId);
    case "dashboard":
    default:
      return {};
  }
}

async function collectHugoAiData(userId: string): Promise<ModuleData> {
  try {
    // Get most recent sessions with scores from v2_sessions
    const { data: sessions } = await supabase
      .from("v2_sessions")
      .select("technique_id, mode, total_score, created_at")
      .eq("user_id", userId)
      .eq("is_active", 1)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!sessions || sessions.length === 0) return { hasData: false };

    const last = sessions[0];
    return {
      hasData: true,
      lastTechniqueId: last.technique_id,
      lastMode: last.mode,
      lastScore: last.total_score,
      lastDate: last.created_at,
      totalSessions: sessions.length,
    };
  } catch {
    return { hasData: false };
  }
}

async function collectAnalysisData(userId: string): Promise<ModuleData> {
  try {
    const result = await pool.query(
      `SELECT id, title, overall_score, created_at
       FROM conversation_analyses
       WHERE user_id = $1 AND id NOT LIKE 'session-%' AND overall_score IS NOT NULL
       ORDER BY created_at DESC LIMIT 2`,
      [userId]
    );

    if (result.rows.length === 0) return { hasData: false };

    const latest = result.rows[0];
    const previous = result.rows[1];

    return {
      hasData: true,
      latestTitle: latest.title || "Gespreksanalyse",
      latestScore: latest.overall_score,
      previousScore: previous?.overall_score || null,
      growthDelta: previous ? latest.overall_score - previous.overall_score : null,
    };
  } catch {
    return { hasData: false };
  }
}

async function collectWebinarData(userId: string): Promise<ModuleData> {
  try {
    // Get next upcoming session
    const { data: sessions } = await supabase
      .from("live_sessions")
      .select("id, title, topic, scheduled_date, description")
      .eq("status", "upcoming")
      .gte("scheduled_date", new Date().toISOString())
      .order("scheduled_date", { ascending: true })
      .limit(1);

    if (!sessions || sessions.length === 0) return { hasData: false, hasUpcoming: false };

    const next = sessions[0];

    // Check if user is registered
    const { data: attendee } = await supabase
      .from("live_session_attendees")
      .select("id")
      .eq("session_id", next.id)
      .eq("user_id", userId)
      .limit(1);

    const isRegistered = attendee && attendee.length > 0;

    return {
      hasData: true,
      hasUpcoming: true,
      nextTitle: next.title,
      nextTopic: next.topic,
      nextDate: next.scheduled_date,
      nextDescription: next.description,
      isRegistered,
    };
  } catch {
    return { hasData: false, hasUpcoming: false };
  }
}

async function collectTechniquesData(userId: string): Promise<ModuleData> {
  try {
    const { data: mastery } = await supabase
      .from("user_technique_mastery")
      .select("technique_id, average_score")
      .eq("user_id", userId);

    return {
      masteredCount: mastery?.length || 0,
      totalTechniques: 54,
    };
  } catch {
    return { masteredCount: 0, totalTechniques: 54 };
  }
}

// ── Cache ───────────────────────────────────────────────────────────────────

async function getCachedHeroText(
  userId: string,
  module: string,
  currentHash: string
): Promise<HeroText | null> {
  try {
    const result = await pool.query(
      `SELECT badge_label, title, subtitle, data_hash
       FROM hero_text_cache
       WHERE user_id = $1 AND module = $2
         AND generated_at > now() - interval '24 hours'`,
      [userId, module]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    // Invalidate if data has changed
    if (row.data_hash !== currentHash) return null;

    return {
      badge: row.badge_label,
      title: row.title,
      subtitle: row.subtitle,
      fromCache: true,
    };
  } catch {
    return null;
  }
}

async function upsertCache(
  userId: string,
  module: string,
  badge: string,
  title: string,
  subtitle: string,
  dataHash: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO hero_text_cache (user_id, module, badge_label, title, subtitle, data_hash, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_id, module)
       DO UPDATE SET badge_label = $3, title = $4, subtitle = $5, data_hash = $6, generated_at = now()`,
      [userId, module, badge, title, subtitle, dataHash]
    );
  } catch (err) {
    console.error("[HeroText] Cache upsert failed:", err);
  }
}

// ── AI Generation ───────────────────────────────────────────────────────────

async function generateAndCacheHeroText(
  userId: string,
  module: ModuleType,
  briefing: UserBriefing,
  moduleData: ModuleData,
  dataHash: string
): Promise<HeroText | null> {
  const client = getAnthropicClient();
  const userPrompt = buildModulePrompt(module, briefing, moduleData);

  try {
    const response = await client.messages.create({
      model: HERO_MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[HeroText] No JSON found in response:", text);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.badge || !parsed.title || !parsed.subtitle) {
      console.error("[HeroText] Incomplete JSON:", parsed);
      return null;
    }

    // Cache the result
    await upsertCache(userId, module, parsed.badge, parsed.title, parsed.subtitle, dataHash);

    return {
      badge: parsed.badge,
      title: parsed.title,
      subtitle: parsed.subtitle,
      fromCache: false,
    };
  } catch (err) {
    console.error("[HeroText] AI generation failed:", err);
    return null;
  }
}

// ── Prompt Builder ──────────────────────────────────────────────────────────

function buildModulePrompt(
  module: ModuleType,
  briefing: UserBriefing,
  data: ModuleData
): string {
  const briefingText = formatBriefingForPrompt(briefing);
  const isNew = briefing.isNewUser;

  switch (module) {
    case "dashboard":
      return `Module: Dashboard (welkomstpagina).
Gebruikersprofiel:
${briefingText}

${isNew
  ? "Dit is een nieuwe gebruiker. Schrijf een warm welkom bij het platform."
  : `Schrijf een persoonlijk welkomstbericht. Verwijs naar recente activiteit en motiveer om door te gaan.`
}`;

    case "hugo-ai":
      return `Module: Talk to Hugo AI (AI coaching sessies).
Gebruikersprofiel:
${briefingText}

${data.hasData
  ? `Laatste sessie: techniek ${data.lastTechniqueId}, score ${data.lastScore}%, modus ${data.lastMode}, datum ${data.lastDate}.
Motiveer de gebruiker om verder te oefenen of een nieuwe techniek te proberen.`
  : "Nieuwe gebruiker zonder sessies. Motiveer om de eerste AI-coaching sessie te starten."
}`;

    case "analysis":
      return `Module: Gespreksanalyse (upload verkoopgesprekken voor E.P.I.C. feedback).
Gebruikersprofiel:
${briefingText}

${data.hasData
  ? `Laatste analyse: "${data.latestTitle}" met score ${data.latestScore}%.${
      data.growthDelta !== null
        ? ` Dat is ${data.growthDelta > 0 ? data.growthDelta + " punten hoger" : Math.abs(data.growthDelta) + " punten lager"} dan de vorige analyse.`
        : ""
    }
Motiveer om een nieuw gesprek te uploaden en de groei voort te zetten.`
  : "Nieuwe gebruiker zonder analyses. Motiveer om het eerste verkoopgesprek te uploaden."
}`;

    case "webinar":
      return `Module: Live Coaching / Webinar met Hugo.
Gebruikersprofiel:
${briefingText}

${data.hasUpcoming
  ? `Volgend webinar: "${data.nextTitle}"${data.nextTopic ? ` over ${data.nextTopic}` : ""} op ${formatDate(data.nextDate)}.${
      data.nextDescription ? ` Beschrijving: ${data.nextDescription}` : ""
    }
Gebruiker is ${data.isRegistered ? "AL ingeschreven" : "NIET ingeschreven"}.
${data.isRegistered
  ? "Bevestig de inschrijving en maak enthousiast over het onderwerp."
  : "Motiveer om zich in te schrijven. Benadruk het onderwerp en de waarde van live interactie met Hugo."
}`
  : `Geen gepland webinar. Webinars zijn wekelijks op dinsdag om 10:00. Motiveer om de volgende sessie in de gaten te houden.`
}`;

    case "techniques":
      return `Module: Technieken Bibliotheek (54 E.P.I.C. TECHNIQUE verkooptechnieken).
Gebruikersprofiel:
${briefingText}

${data.masteredCount > 0
  ? `Gebruiker heeft ${data.masteredCount} van de ${data.totalTechniques} technieken geoefend. Motiveer om meer technieken te ontdekken en te beheersen.`
  : "Nieuwe gebruiker. Motiveer om de eerste techniek te verkennen en de E.P.I.C. TECHNIQUE methode te leren kennen."
}`;

    default:
      return `Module: ${module}. Schrijf een generieke motiverende hero tekst.\n${briefingText}`;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeDataHash(briefing: UserBriefing, moduleData: ModuleData): string {
  const key = JSON.stringify({
    sessions: briefing.sessionsPlayed,
    avgScore: briefing.avgScore,
    analyses: briefing.analysesCount,
    videos: briefing.videosWatched,
    webinars: briefing.webinarsAttended,
    isNew: briefing.isNewUser,
    ...moduleData,
  });
  return crypto.createHash("md5").update(key).digest("hex").slice(0, 12);
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("nl-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}
