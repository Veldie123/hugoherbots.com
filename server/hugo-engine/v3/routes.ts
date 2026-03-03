/**
 * Hugo V3 Agent Routes
 *
 * API routes for the V3 agent. Only accessible to superadmin (stephane@hugoherbots.com).
 * All other users continue to use V2.
 */
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth-middleware";
import { chat, createSession, type V3SessionState } from "./agent";
import { isV3Available } from "./anthropic-client";
import { buildUserBriefing } from "./user-briefing";
import { randomUUID } from "crypto";

const router = Router();

// In-memory session store (will be replaced with DB persistence in later phase)
const sessions = new Map<string, V3SessionState>();

const SUPERADMIN_EMAIL = "stephane@hugoherbots.com";

/** Only allow superadmin access to V3 */
function requireSuperAdmin(req: Request, res: Response, next: Function) {
  if (req.userEmail?.toLowerCase() !== SUPERADMIN_EMAIL) {
    return res.status(403).json({
      error: "V3 agent is alleen beschikbaar voor superadmin.",
    });
  }
  next();
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
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    if (!isV3Available()) {
      return res.status(503).json({
        error: "V3 agent niet beschikbaar. Configureer ANTHROPIC_API_KEY.",
      });
    }

    const { techniqueId, userProfile } = req.body;
    const sessionId = `v3_${randomUUID()}`;

    // Fetch rich user context for personalized opening
    let briefing;
    try {
      briefing = await buildUserBriefing(req.userId!);
      console.log(`[V3] Briefing loaded for ${briefing.name}: ${briefing.isNewUser ? 'new user' : `${briefing.sessionsPlayed} sessions`}`);
    } catch (err) {
      console.warn("[V3] Briefing fetch failed, continuing without:", err);
    }

    const session = createSession(sessionId, req.userId!, userProfile, briefing);
    sessions.set(sessionId, session);

    // Auto-send opening message with context-aware prompt
    try {
      let openingPrompt: string;
      const hasSpecificTechnique = techniqueId && techniqueId !== "general";
      if (hasSpecificTechnique) {
        openingPrompt = `De seller wil werken aan techniek ${techniqueId}. Begroet hem kort en natuurlijk als Hugo. Verwijs naar wat je weet over deze seller uit je briefing.`;
      } else if (briefing && !briefing.isNewUser) {
        openingPrompt = `Je hebt zojuist de briefing van deze seller gelezen in je system prompt. Begroet hem kort en natuurlijk als Hugo. Verwijs naar iets concreets uit zijn geschiedenis en stel een logische volgende stap voor. Eindig met "of zit je ergens anders mee?" zodat hij ook vrij kan kiezen.`;
      } else {
        openingPrompt = `Dit is een nieuwe seller${briefing?.sector ? ` in de sector ${briefing.sector}` : ''}. Begroet hem warm als Hugo. Vertel kort wat je voor hem kunt doen (oefenen met technieken, rollenspel, feedback op gesprekken, analyse van echte verkoopgesprekken) en vraag wat hij verkoopt en waar hij tegenaan loopt, zodat je hem gericht kunt helpen.`;
      }

      const response = await chat(session, openingPrompt);

      res.json({
        sessionId,
        engineVersion: "v3",
        opening: {
          text: response.text,
          toolsUsed: response.toolsUsed,
          model: response.model,
        },
        usage: {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        },
      });
    } catch (err: any) {
      console.error("[V3] Session start error:", err);
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
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is verplicht." });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: "Sessie niet gevonden. Start een nieuwe sessie.",
      });
    }

    try {
      const response = await chat(session, message.trim());

      res.json({
        sessionId,
        response: {
          text: response.text,
          toolsUsed: response.toolsUsed,
          model: response.model,
        },
        usage: {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
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

/** Get session history */
router.get(
  "/session/:sessionId",
  requireAuth,
  requireSuperAdmin,
  (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Sessie niet gevonden." });
    }

    res.json({
      sessionId: session.sessionId,
      engineVersion: session.engineVersion,
      messageCount: session.messages.length,
      messages: session.messages,
    });
  }
);

export { router as v3Routes };
