/**
 * Hugo V3 Agent Routes
 *
 * API routes for the V3 agent. Access controlled via v3_access table
 * (superadmin always has full access). Sessions persisted to Supabase.
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth-middleware";
import { chat, chatStream, createSession, type V3SessionState, type V3StreamEvent, type V3ContentBlock, type ThinkingMode } from "./agent";
import { isV3Available, getAnthropicClient } from "./anthropic-client";
import { buildUserBriefing } from "./user-briefing";
import { saveMemory } from "./memory-service";
import { generateBrain, getCachedBrain } from "./preflight";
import { supabase } from "../supabase-client";
import { pool } from "../db";
import { randomUUID } from "crypto";
import { voiceRoutes } from "./voice-routes";
import { trace } from "@opentelemetry/api";

// File upload: 5MB limit, images + PDF only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Alleen afbeeldingen en PDF bestanden toegestaan."));
    }
  },
});

const router = Router();

// In-memory session store with Supabase write-through
const sessions = new Map<string, V3SessionState>();
// Track when sessions were last active (for cleanup)
const sessionLastActive = new Map<string, number>();

const SUPERADMIN_EMAIL = "stephane@hugoherbots.com";

// Cleanup stale V3 sessions every 30 minutes (sessions idle >2 hours)
const V3_SESSION_MAX_IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, lastActive] of sessionLastActive) {
    if (now - lastActive > V3_SESSION_MAX_IDLE_MS) {
      sessions.delete(id);
      sessionLastActive.delete(id);
      summarizedSessions.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[V3] Cleaned ${cleaned} stale sessions (${sessions.size} remaining)`);
  }
}, 30 * 60 * 1000);

/** Enrich the current OpenTelemetry span with V3 session metadata */
function enrichTraceMetadata(req: Request, sessionId: string, mode: string): void {
  try {
    const span = trace.getActiveSpan();
    if (!span) return;
    span.setAttributes({
      "langwatch.user.id": req.userId || "unknown",
      "langwatch.thread.id": sessionId,
      "hugoclaw.mode": mode,
      "hugoclaw.user_email": req.userEmail || "unknown",
      "hugoclaw.thinking_mode": req.body?.thinkingMode || "auto",
    });
  } catch {
    // Tracing is best-effort — never break the request
  }
}

/** Track which sessions have already been summarized (prevents duplicate summaries) */
const summarizedSessions = new Set<string>();

/** Save session to Supabase (async, non-blocking).
 *  Only persists when the user has sent at least one message. */
async function persistSession(session: V3SessionState): Promise<void> {
  const userMessageCount = session.messages.filter(m => m.role === "user").length;
  if (userMessageCount === 0) return; // don't save sessions where the user hasn't spoken

  try {
    await supabase.from("v3_sessions").upsert({
      id: session.sessionId,
      user_id: session.userId,
      mode: session.mode,
      messages: session.messages,
      user_profile: session.userProfile || null,
      metadata: {
        engineVersion: session.engineVersion,
        messageSummary: session.messageSummary || null,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    // Auto-generate session summary after enough real conversation (fire-and-forget)
    if (session.mode === "coaching" && userMessageCount >= 3 && !summarizedSessions.has(session.sessionId)) {
      summarizedSessions.add(session.sessionId);
      saveSessionSummary(session).catch(() => {});
    }
  } catch (err: any) {
    console.error("[V3] Session persist failed:", err.message);
  }
}

/** Generate and save a session summary using Claude Haiku (fire-and-forget) */
async function saveSessionSummary(session: V3SessionState): Promise<void> {
  const userMessages = session.messages.filter(m => m.role === "user");
  if (userMessages.length < 2) return; // not enough content

  try {
    const transcript = session.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 300) : "[multimodal]"}`)
      .join("\n");

    const anthropic = getAnthropicClient();
    const summaryResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Vat dit coaching gesprek samen in 2-3 zinnen. Focus op: onderwerp, belangrijkste inzichten, en waar de verkoper aan werkte.\n\n${transcript.slice(0, 4000)}`,
      }],
    });

    const summary = summaryResponse.content[0]?.type === "text"
      ? summaryResponse.content[0].text
      : "";

    if (summary) {
      await saveMemory({
        userId: session.userId,
        content: summary,
        memoryType: "session_summary",
        source: "autonomous",
        sessionId: session.sessionId,
        metadata: { messageCount: session.messages.length },
      });
      console.log(`[V3] Session summary saved for ${session.sessionId}`);
    }
  } catch (err: any) {
    console.warn("[V3] Session summary generation failed:", err.message);
  }
}

/** Load session from Supabase if not in memory */
async function loadSession(sessionId: string): Promise<V3SessionState | null> {
  // Check memory first
  const cached = sessions.get(sessionId);
  if (cached) {
    sessionLastActive.set(sessionId, Date.now());
    // Ensure briefing exists for coaching sessions (may be lost after server restart)
    if (cached.mode === "coaching" && !cached.briefing) {
      try {
        cached.briefing = await buildUserBriefing(cached.userId);
      } catch { /* continue without */ }
    }
    // Ensure brain is loaded if available (may be lost after server restart)
    if (cached.mode === "coaching" && !cached.brain) {
      try {
        cached.brain = (await getCachedBrain(cached.userId)) || undefined;
      } catch { /* brain is optional */ }
    }
    return cached;
  }

  // Try Supabase
  try {
    const { data, error } = await supabase
      .from("v3_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !data) return null;

    const session: V3SessionState = {
      sessionId: data.id,
      userId: data.user_id,
      mode: data.mode as "coaching" | "admin",
      messages: data.messages || [],
      messageSummary: data.metadata?.messageSummary || undefined,
      userProfile: data.user_profile,
      engineVersion: "v3",
    };

    // Rebuild briefing + brain for coaching sessions so system prompt has user context
    if (session.mode === "coaching") {
      try {
        session.brain = (await getCachedBrain(session.userId)) || undefined;
      } catch { /* brain is optional */ }
      try {
        session.briefing = await buildUserBriefing(session.userId);
        console.log(`[V3] Briefing rebuilt for loaded session ${sessionId}${session.brain ? ' (brain available)' : ''}`);
      } catch {
        // Briefing is nice-to-have, continue without
      }
    }

    sessions.set(sessionId, session);
    sessionLastActive.set(sessionId, Date.now());
    return session;
  } catch {
    return null;
  }
}

/** V3 access control — check v3_access table with in-memory cache */
const accessCache = new Map<string, { admin_v3: boolean; coaching_v3: boolean; ts: number }>();
const ACCESS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getV3Access(email: string): Promise<{ admin_v3: boolean; coaching_v3: boolean }> {
  // Superadmin always has access
  if (email.toLowerCase() === SUPERADMIN_EMAIL) {
    return { admin_v3: true, coaching_v3: true };
  }

  // Check cache
  const cached = accessCache.get(email);
  if (cached && Date.now() - cached.ts < ACCESS_CACHE_TTL) {
    return { admin_v3: cached.admin_v3, coaching_v3: cached.coaching_v3 };
  }

  // Check Supabase
  try {
    const { data } = await supabase
      .from("v3_access")
      .select("admin_v3, coaching_v3")
      .eq("user_email", email.toLowerCase())
      .single();

    const access = {
      admin_v3: data?.admin_v3 ?? true,
      coaching_v3: data?.coaching_v3 ?? true,
    };
    accessCache.set(email, { ...access, ts: Date.now() });
    return access;
  } catch {
    // No row found → default to V3 access for all users
    const defaultAccess = { admin_v3: true, coaching_v3: true };
    accessCache.set(email, { ...defaultAccess, ts: Date.now() });
    return defaultAccess;
  }
}

function requireV3Access(mode: "admin" | "coaching") {
  return async (req: Request, res: Response, next: Function) => {
    const email = req.userEmail;
    if (!email) {
      return res.status(401).json({ error: "Niet ingelogd." });
    }

    const access = await getV3Access(email);
    const hasAccess = mode === "admin" ? access.admin_v3 : access.coaching_v3;

    if (!hasAccess) {
      return res.status(403).json({ error: "V3 is niet beschikbaar voor dit account." });
    }
    next();
  };
}

/** Validate user owns the session AND has access to its mode (backend safety net) */
async function validateSessionAccess(session: V3SessionState, userEmail: string, userId?: string): Promise<boolean> {
  // Ownership check: only session owner or superadmin can access
  if (userId && session.userId !== userId && userEmail !== SUPERADMIN_EMAIL) {
    return false;
  }
  const access = await getV3Access(userEmail);
  return session.mode === "admin" ? access.admin_v3 : access.coaching_v3;
}

/** Health check — is V3 available? */
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    available: isV3Available(),
    version: "v3",
    engine: "claude-agent",
    message: isV3Available()
      ? "Hugo V3 agent is gereed."
      : "ANTHROPIC_API_KEY niet geconfigureerd.",
  });
});

/** Start a new V3 session */
router.post(
  "/session",
  requireAuth,
  async (req: Request, res: Response) => {
    if (!isV3Available()) {
      return res.status(503).json({
        error: "V3 agent niet beschikbaar. Configureer ANTHROPIC_API_KEY.",
      });
    }

    const { techniqueId, userProfile, mode, thinkingMode } = req.body;
    const sessionMode = mode === "admin" ? "admin" as const : "coaching" as const;
    const resolvedThinkingMode = (thinkingMode === "fast" || thinkingMode === "deep") ? thinkingMode : "auto";

    // Access check based on requested mode
    const access = await getV3Access(req.userEmail!);
    const hasAccess = sessionMode === "admin" ? access.admin_v3 : access.coaching_v3;
    if (!hasAccess) {
      return res.status(403).json({ error: "V3 is niet beschikbaar voor dit account." });
    }

    const sessionId = `v3_${randomUUID()}`;

    // Fetch rich user context for personalized opening (coaching only)
    let briefing;
    let brain: string | null = null;
    if (sessionMode === "coaching") {
      try {
        // Try to load pre-computed brain first (generated at login via /preflight)
        brain = await getCachedBrain(req.userId!);
        if (brain) {
          console.log(`[V3] Brain loaded from cache for ${req.userId} (${brain.length} chars)`);
        }
      } catch {
        // Brain is optional — fall back to briefing
      }

      try {
        briefing = await buildUserBriefing(req.userId!);
        console.log(`[V3] Briefing loaded for ${briefing.name}: ${briefing.isNewUser ? 'new user' : `${briefing.sessionsPlayed} sessions`}`);
      } catch (err) {
        console.warn("[V3] Briefing fetch failed, continuing without:", err);
      }
    }

    const session = createSession(sessionId, req.userId!, sessionMode, userProfile, briefing, brain);
    sessions.set(sessionId, session);
    sessionLastActive.set(sessionId, Date.now());
    enrichTraceMetadata(req, sessionId, sessionMode);
    persistSession(session);
    console.log(`[V3] Session created: ${sessionId} (mode: ${sessionMode})`);

    // Auto-summarize previous coaching session (fire-and-forget)
    if (sessionMode === "coaching") {
      (async () => {
        try {
          const { data } = await supabase
            .from("v3_sessions")
            .select("id, messages, user_id, mode")
            .eq("user_id", req.userId!)
            .eq("mode", "coaching")
            .neq("id", sessionId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

          if (data && data.messages) {
            const prevSession: V3SessionState = {
              sessionId: data.id,
              userId: data.user_id,
              mode: data.mode,
              messages: data.messages,
              engineVersion: "v3",
            };
            await saveSessionSummary(prevSession);
          }
        } catch {
          // No previous session — that's fine
        }
      })();
    }

    // Auto-send opening message with context-aware prompt
    try {
      let openingPrompt: string;

      if (sessionMode === "admin") {
        // Admin mode: check onboarding status first
        let onboardingComplete = false;
        let onboardingApproved = 0;
        let onboardingTotal = 0;
        try {
          const obResult = await pool.query(
            `SELECT status, COUNT(*) as count FROM admin_onboarding_progress WHERE admin_user_id = $1 GROUP BY status`,
            [SUPERADMIN_EMAIL]
          );
          for (const row of obResult.rows) {
            const count = parseInt(row.count, 10);
            onboardingTotal += count;
            if (row.status === "approved" || row.status === "skipped") onboardingApproved += count;
          }
          onboardingComplete = onboardingTotal > 0 && onboardingApproved === onboardingTotal;
        } catch {
          // Table might not be seeded yet — tools will handle that
        }

        if (!onboardingComplete && onboardingTotal > 0) {
          openingPrompt = `De onboarding is nog niet compleet: ${onboardingApproved} van ${onboardingTotal} items zijn afgehandeld. Begroet Hugo warm. Meld de onboarding-status en stel voor om verder te gaan met de review. Maar geef ook aan dat hij vrij is om iets anders te doen — schets kort de mogelijkheden (platform analytics, webinars, video's, content). Als Hugo akkoord gaat met reviewen, gebruik get_next_review_item om het eerste item te tonen. Gebruik GEEN andere tools tenzij Hugo erom vraagt.`;
        } else if (onboardingComplete) {
          openingPrompt = `De onboarding is compleet — alle items zijn gereviewd. Begroet Hugo kort als zijn platformassistent. Geef hem een overzicht van wat je kunt doen: platform analytics bekijken, webinars beheren, video-bibliotheek organiseren, coachingsessies bekijken, content aanpassen, rapport genereren. Vraag wat hij wil doen. Gebruik GEEN tools tenzij hij erom vraagt.`;
        } else {
          // No onboarding data yet — first time, tools will seed on first call
          openingPrompt = `Begroet Hugo warm als zijn platformassistent. Dit is mogelijk zijn eerste sessie. Check de onboarding-status met get_onboarding_status om te zien of er items klaarstaan voor review. Presenteer de resultaten en bied Hugo de keuze: onboarding starten of iets anders doen.`;
        }
      } else {
        // Coaching mode: personalized opening
        const hasSpecificTechnique = techniqueId && techniqueId !== "general";
        if (hasSpecificTechnique) {
          openingPrompt = `De seller wil werken aan techniek ${techniqueId}. Begroet hem kort en natuurlijk als Hugo. Verwijs naar wat je weet over deze seller uit je briefing.`;
        } else if (briefing && !briefing.isNewUser) {
          openingPrompt = `Je hebt de briefing van deze seller gelezen. Begroet hem warm als Hugo. Verwijs kort naar zijn activiteit (video's, analyses, eerdere sessies). Maar Hugo begint ALTIJD met begrijpen: als je niet weet wat hij verkoopt of aan wie (check je briefing — staat er een product of sector?), vraag dat eerst. Hugo stelt pas iets voor (oefening, rollenspel, coaching) als hij de concrete situatie van de seller snapt. Eindig met een open vraag.`;
        } else {
          openingPrompt = `Dit is een nieuwe seller${briefing?.sector ? ` in de sector ${briefing.sector}` : ''}. Begroet hem warm als Hugo. Hugo is nieuwsgierig: wie is deze verkoper? Wat verkoopt hij? Aan wie? Waar loopt hij tegenaan? Stel een open, warme vraag om zijn situatie te leren kennen. Noem nog geen oefeningen of rollenspellen — die komen pas als je zijn wereld begrijpt.`;
        }
      }

      const response = await chat(session, openingPrompt, resolvedThinkingMode as any);
      persistSession(session);

      res.json({
        sessionId,
        engineVersion: "v3",
        mode: sessionMode,
        opening: {
          text: response.text,
          toolsUsed: response.toolsUsed,
          model: response.model,
        },
        usage: {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          thinkingTokens: response.thinkingTokens,
        },
      });
    } catch (err: any) {
      console.error("[V3] Session start error:", err.message);
      console.error("[V3] Stack:", err.stack);
      res.status(500).json({
        error: "Kon V3 sessie niet starten.",
        details: err.message,
      });
    }
  }
);

/** Send a message in an active V3 session */
router.post(
  "/session/:sessionId/message",
  requireAuth,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { message, thinkingMode } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is verplicht." });
    }

    const session = await loadSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: "Sessie niet gevonden. Start een nieuwe sessie.",
      });
    }

    // Mode-guard: validate user has access to this session's mode
    if (!await validateSessionAccess(session, req.userEmail!, req.userId)) {
      return res.status(403).json({ error: "Geen toegang tot deze sessie mode." });
    }

    enrichTraceMetadata(req, sessionId, session.mode);

    try {
      const response = await chat(session, message.trim(), (thinkingMode as ThinkingMode) || "auto");
      persistSession(session);

      res.json({
        sessionId,
        response: {
          text: response.text,
          toolsUsed: response.toolsUsed,
          navigationDestination: response.navigationDestination,
          navigationItemId: response.navigationItemId,
          navigationLabel: response.navigationLabel,
          model: response.model,
        },
        usage: {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          thinkingTokens: response.thinkingTokens,
        },
        messageCount: session.messages.length,
      });
    } catch (err: any) {
      console.error("[V3] Message error:", err);
      res.status(500).json({
        error: "Fout bij verwerken van bericht.",
        details: err.message,
      });
    }
  }
);

/** Stream a message response via SSE (supports optional file uploads) */
router.post(
  "/session/:sessionId/stream",
  requireAuth,
  upload.array("files", 5),
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is verplicht." });
    }

    const session = await loadSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Sessie niet gevonden. Start een nieuwe sessie." });
    }

    // Mode-guard: validate user has access to this session's mode
    if (!await validateSessionAccess(session, req.userEmail!, req.userId)) {
      return res.status(403).json({ error: "Geen toegang tot deze sessie mode." });
    }

    enrichTraceMetadata(req, sessionId, session.mode);

    // Build content: text + optional file attachments as content blocks
    const files = (req.files as Express.Multer.File[]) || [];
    let userContent: string | V3ContentBlock[];

    if (files.length > 0) {
      const contentBlocks: V3ContentBlock[] = [
        { type: "text", text: message.trim() },
      ];
      for (const file of files) {
        const base64 = file.buffer.toString("base64");
        if (file.mimetype === "application/pdf") {
          contentBlocks.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          });
        } else {
          contentBlocks.push({
            type: "image",
            source: { type: "base64", media_type: file.mimetype, data: base64 },
          });
        }
      }
      userContent = contentBlocks;
      console.log(`[V3] Stream with ${files.length} file(s): ${files.map(f => f.originalname).join(", ")}`);
    } else {
      userContent = message.trim();
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    const thinkingMode = (req.body.thinkingMode as ThinkingMode) || "auto";

    try {
      for await (const event of chatStream(session, userContent, thinkingMode)) {
        if (clientDisconnected) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      persistSession(session);
    } catch (err: any) {
      console.error("[V3] Stream error:", err.message);
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`);
      }
    }

    res.end();
  }
);

/** Get session history */
router.get(
  "/session/:sessionId",
  requireAuth,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const session = await loadSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Sessie niet gevonden." });
    }

    // Mode-guard: validate user has access to this session's mode
    if (!await validateSessionAccess(session, req.userEmail!, req.userId)) {
      return res.status(403).json({ error: "Geen toegang tot deze sessie mode." });
    }

    res.json({
      sessionId: session.sessionId,
      engineVersion: session.engineVersion,
      mode: session.mode,
      messageCount: session.messages.length,
      messages: session.messages,
    });
  }
);

/** Save an admin correction as agent memory */
router.post(
  "/memory/save",
  requireAuth,
  requireV3Access("admin"),
  async (req: Request, res: Response) => {
    const { content, memoryType, techniqueId, metadata } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Content is verplicht." });
    }

    try {
      const result = await saveMemory({
        userId: "hugo-admin",
        content,
        memoryType: memoryType || "admin_correction",
        source: "admin_correction",
        techniqueId,
        metadata,
      });

      if (result.success) {
        res.json({ success: true, memoryId: result.memoryId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (err: any) {
      console.error("[V3] Memory save error:", err);
      res.status(500).json({ error: "Fout bij opslaan herinnering." });
    }
  }
);

/** Check V3 access for current user */
router.get("/access", requireAuth, async (req: Request, res: Response) => {
  const email = req.userEmail;
  if (!email) return res.json({ admin_v3: false, coaching_v3: false });

  const access = await getV3Access(email);
  res.json(access);
});

// ── Admin maintenance endpoints ──────────────────────────────────────────────

/** Backfill session summaries for all existing coaching sessions */
router.post("/admin/backfill-summaries", requireAuth, async (req: Request, res: Response) => {
  if (req.userEmail !== SUPERADMIN_EMAIL) {
    return res.status(403).json({ error: "Alleen superadmin." });
  }

  try {
    const { data } = await supabase
      .from("v3_sessions")
      .select("id, user_id, mode, messages")
      .eq("mode", "coaching");

    let saved = 0;
    for (const row of data || []) {
      const userMsgs = (row.messages || []).filter((m: any) => m.role === "user");
      if (userMsgs.length < 2) continue;

      await saveSessionSummary({
        sessionId: row.id,
        userId: row.user_id,
        mode: row.mode,
        messages: row.messages,
        engineVersion: "v3",
      } as V3SessionState);
      saved++;
    }

    res.json({ backfilled: saved, total: (data || []).length });
  } catch (err: any) {
    console.error("[V3] Backfill error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Delete empty coaching sessions (no real user messages) */
router.post("/admin/cleanup-empty-sessions", requireAuth, async (req: Request, res: Response) => {
  if (req.userEmail !== SUPERADMIN_EMAIL) {
    return res.status(403).json({ error: "Alleen superadmin." });
  }

  try {
    const { data } = await supabase
      .from("v3_sessions")
      .select("id, messages")
      .eq("mode", "coaching");

    const emptyIds = (data || [])
      .filter(row => (row.messages || []).filter((m: any) => m.role === "user").length < 2)
      .map(row => row.id);

    if (emptyIds.length > 0) {
      await supabase.from("v3_sessions").delete().in("id", emptyIds);
    }

    res.json({ deleted: emptyIds.length, remaining: (data || []).length - emptyIds.length });
  } catch (err: any) {
    console.error("[V3] Cleanup error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Preflight Brain ─────────────────────────────────────────────────────────

/** Trigger brain generation (fire-and-forget from frontend at login) */
router.post("/preflight", requireAuth, async (req: Request, res: Response) => {
  if (!isV3Available()) {
    return res.status(503).json({ error: "V3 niet beschikbaar." });
  }

  // Only superadmin for now (V3 is superadmin-only)
  const access = await getV3Access(req.userEmail!);
  if (!access.coaching_v3) {
    return res.status(403).json({ error: "Geen V3 toegang." });
  }

  try {
    const result = await generateBrain(req.userId!);
    console.log(`[Preflight] Done for ${req.userId}: cached=${result.cached}, ${result.timing.totalMs}ms`);
    res.json({
      cached: result.cached,
      templateVersion: result.templateVersion,
      timing: result.timing,
    });
  } catch (err: any) {
    console.error("[Preflight] Endpoint error:", err.message);
    res.status(500).json({ error: "Brain generatie mislukt.", details: err.message });
  }
});

// Mount voice routes at /api/v3/voice/*
router.use("/voice", voiceRoutes);

export { router as v3Routes };
