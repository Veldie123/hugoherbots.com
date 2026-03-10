/**
 * V3 Voice Routes — ElevenLabs Conversational AI integration
 *
 * ElevenLabs handles WebRTC, STT (Scribe v2), TTS (Hugo's cloned voice),
 * turn-taking, and interruptions. We provide the "brain" via Custom LLM webhook.
 *
 * Architecture:
 *   Browser ←WebRTC→ ElevenLabs ←HTTP/SSE→ This server (Claude V3 Agent)
 */
import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth-middleware";
import { chatStream, createSession, type V3SessionState } from "./agent";
import { buildUserBriefing, type UserBriefing } from "./user-briefing";
import { extractUserMessage, claudeStreamToOpenaiSSE } from "./voice-adapter";
import { supabase } from "../supabase-client";
import { randomUUID } from "crypto";

const router = Router();

// Voice sessions: ElevenLabs conversation_id → V3 session
const voiceSessions = new Map<string, V3SessionState>();

// Pre-fetched voice data: stored at /signed-url (where we have auth), consumed by /llm (no auth)
const pendingVoiceData = new Map<string, { userId: string; briefing?: UserBriefing; ts: number }>();

// Support both casing conventions for the ElevenLabs API key
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.Elevenlabs_api_key || "";
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || "agent_3501kcs7vst6f1jvv85sjm27ba7r";

/** Save voice session to Supabase (async, non-blocking) */
async function persistVoiceSession(session: V3SessionState): Promise<void> {
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
        voiceSession: true,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  } catch (err: any) {
    console.error("[V3 Voice] Session persist failed:", err.message);
  }
}

/**
 * POST /voice/llm — Custom LLM webhook for ElevenLabs
 *
 * ElevenLabs sends OpenAI Chat Completions format:
 *   { model, messages: [{role, content}...], stream: true }
 *
 * We respond with SSE in OpenAI format:
 *   data: {"choices":[{"delta":{"content":"..."}}]}\n\n
 *   data: [DONE]\n\n
 *
 * NOTE: This endpoint is called by ElevenLabs servers, not by our frontend.
 * Authentication is handled by ElevenLabs signed URLs.
 */
// ElevenLabs appends /chat/completions to the Server URL, so we handle both paths
const llmHandler = async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[V3 Voice] ANTHROPIC_API_KEY is missing — voice LLM will fail");
    return res.status(503).json({ error: "AI backend niet beschikbaar" });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing messages array" });
  }

  const userMessage = extractUserMessage(messages);
  if (!userMessage) {
    return res.status(400).json({ error: "No user message found" });
  }

  // Session management: use ElevenLabs conversation ID or create one
  const conversationId = req.headers["x-elevenlabs-conversation-id"] as string
    || req.headers["x-conversation-id"] as string
    || `voice_${randomUUID()}`;

  let session = voiceSessions.get(conversationId);

  if (!session) {
    const sessionId = `v3_voice_${randomUUID()}`;

    // Find pre-fetched user data (stored at /signed-url where we have auth)
    let userId = "voice-user";
    let briefing: UserBriefing | undefined;
    for (const [key, data] of pendingVoiceData) {
      if (Date.now() - data.ts < 60_000) {
        userId = data.userId;
        briefing = data.briefing;
        pendingVoiceData.delete(key);
        break;
      }
    }

    session = createSession(sessionId, userId, "coaching", undefined, briefing);
    voiceSessions.set(conversationId, session);
    console.log(`[V3 Voice] New session: ${sessionId} user=${userId} briefing=${briefing ? "yes" : "no"} (conversation: ${conversationId})`);
  }

  // SSE headers (OpenAI streaming format)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let clientDisconnected = false;
  req.on("close", () => { clientDisconnected = true; });

  const t0 = Date.now();
  try {
    // Tag session for voice-mode system prompt
    session.voiceMode = true;

    const v3Stream = chatStream(session, userMessage);

    let firstChunkMs = 0;
    for await (const chunk of claudeStreamToOpenaiSSE(v3Stream)) {
      if (clientDisconnected) break;
      if (!firstChunkMs) firstChunkMs = Date.now() - t0;
      res.write(chunk);
    }

    console.log(`[V3 Voice] Response: first_chunk=${firstChunkMs}ms total=${Date.now() - t0}ms user=${session.userId}`);
    persistVoiceSession(session);
  } catch (err: any) {
    console.error("[V3 Voice] LLM error:", err.message);
    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-err-${Date.now()}`,
        object: "chat.completion.chunk",
        choices: [{
          index: 0,
          delta: { content: "Sorry, er ging even iets mis. Kun je dat herhalen?" },
          finish_reason: null,
        }],
      })}\n\n`);
      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-err-${Date.now()}`,
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      })}\n\n`);
      res.write("data: [DONE]\n\n");
    }
  } finally {
    session.voiceMode = false;
  }

  res.end();
};

// Register on both paths: /llm (direct) and /chat/completions (ElevenLabs default)
router.post("/llm", llmHandler);
router.post("/chat/completions", llmHandler);

/**
 * POST /voice/signed-url — Auth gate for ElevenLabs WebRTC voice session
 *
 * Returns the agentId so the frontend can connect directly via WebRTC.
 * The agent is public (requires_auth=false) so no server-side token is needed.
 */
router.post("/signed-url", requireAuth, async (req: Request, res: Response) => {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    return res.status(503).json({ error: "ElevenLabs niet geconfigureerd." });
  }

  const userId = (req as any).userId as string;
  const t0 = Date.now();

  // Pre-fetch user briefing (memories, profile, mastery) while we have auth context
  let briefing: UserBriefing | undefined;
  try {
    briefing = await buildUserBriefing(userId);
  } catch (err: any) {
    console.warn(`[V3 Voice] Briefing pre-fetch failed for ${userId}:`, err.message);
  }

  // Store for the LLM handler to pick up (ElevenLabs calls /llm without our auth)
  pendingVoiceData.set(userId, { userId, briefing, ts: Date.now() });

  // Cleanup stale entries (>60s)
  for (const [key, data] of pendingVoiceData) {
    if (Date.now() - data.ts > 60_000) pendingVoiceData.delete(key);
  }

  console.log(`[V3 Voice] signed-url: user=${userId} briefing=${briefing ? "yes" : "no"} (${Date.now() - t0}ms)`);
  res.json({ agentId: ELEVENLABS_AGENT_ID });
});

/**
 * GET /voice/health — Voice subsystem health check
 */
router.get("/health", (_req: Request, res: Response) => {
  const hasApiKey = !!ELEVENLABS_API_KEY;
  const hasAgentId = !!ELEVENLABS_AGENT_ID;

  res.json({
    available: hasApiKey && hasAgentId,
    agentId: ELEVENLABS_AGENT_ID,
    activeSessions: voiceSessions.size,
    message: hasApiKey && hasAgentId
      ? "Voice agent is gereed."
      : `Ontbreekt: ${!hasApiKey ? "ELEVENLABS_API_KEY" : ""} ${!hasAgentId ? "ELEVENLABS_AGENT_ID" : ""}`.trim(),
  });
});

export { router as voiceRoutes };
