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
import { buildUserBriefing } from "./user-briefing";
import { buildVoiceSystemPrompt } from "./system-prompt-voice";
import { extractUserMessage, claudeStreamToOpenaiSSE } from "./voice-adapter";
import { supabase } from "../supabase-client";
import { randomUUID } from "crypto";

const router = Router();

// Voice sessions: ElevenLabs conversation_id → V3 session
const voiceSessions = new Map<string, V3SessionState>();

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
    // Create new V3 session for this voice conversation
    const sessionId = `v3_voice_${randomUUID()}`;
    // Voice sessions use a default user until we implement user linking
    const userId = "voice-user";

    let briefing;
    try {
      briefing = await buildUserBriefing(userId);
    } catch {
      // No briefing for anonymous voice users — that's fine
    }

    session = createSession(sessionId, userId, "coaching", undefined, briefing);
    voiceSessions.set(conversationId, session);
    console.log(`[V3 Voice] New session: ${sessionId} (conversation: ${conversationId})`);
  }

  // SSE headers (OpenAI streaming format)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let clientDisconnected = false;
  req.on("close", () => { clientDisconnected = true; });

  try {
    // Tag session for voice-mode system prompt
    session.voiceMode = true;

    const v3Stream = chatStream(session, userMessage);

    for await (const chunk of claudeStreamToOpenaiSSE(v3Stream)) {
      if (clientDisconnected) break;
      res.write(chunk);
    }

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
 * POST /voice/signed-url — Get a conversation token for ElevenLabs WebRTC
 *
 * Frontend calls this to start a voice session. We request a signed URL
 * from ElevenLabs and return it. Supports both WebRTC (token) and WebSocket (signed URL).
 */
router.post("/signed-url", requireAuth, async (req: Request, res: Response) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "ElevenLabs API key niet geconfigureerd." });
  }

  try {
    // Try signed URL endpoint (works for both WebRTC and WebSocket)
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: "GET",
        headers: { "xi-api-key": apiKey },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[V3 Voice] ElevenLabs signed-url error:", response.status, errorText);
      return res.status(502).json({ error: "Kon geen voice sessie starten." });
    }

    const data = await response.json();
    console.log(`[V3 Voice] Signed URL generated for user ${req.userId}`);

    res.json({
      signedUrl: data.signed_url,
      agentId: ELEVENLABS_AGENT_ID,
    });
  } catch (err: any) {
    console.error("[V3 Voice] Signed URL fetch error:", err.message);
    res.status(500).json({ error: "Voice verbinding mislukt." });
  }
});

/**
 * GET /voice/health — Voice subsystem health check
 */
router.get("/health", (_req: Request, res: Response) => {
  const hasApiKey = !!process.env.ELEVENLABS_API_KEY;
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
