/**
 * Live Analyse WebSocket Handler
 *
 * Proxies audio to ElevenLabs Scribe for STT, then pipes transcripts
 * to Claude for real-time coaching tip generation.
 *
 * Follows the pattern from elevenlabs-stt.ts.
 */

import { WebSocket as WS, WebSocketServer } from "ws";
import type { Server } from "http";
import { supabase } from "./supabase-client";
import { analyzeTurn, type TipResult } from "./v3/live-analyse-service";
import { pool } from "./db";

const MAX_WS_CONNECTIONS = 20;
const MAX_WS_MESSAGE_SIZE = 256 * 1024;
const DEBOUNCE_MS = 3000;

interface LiveAnalyseConnection {
  clientWs: WS;
  elevenLabsWs: WS | null;
  isConnected: boolean;
  sessionId: string;
  userId: string;
  currentPhase: number;
  currentSpeaker: "you" | "client";
  transcriptBuffer: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  transcript: Array<{ speaker: "you" | "client"; text: string; timestamp: string }>;
  tips: Array<TipResult & { id: string; timestamp: string }>;
  phaseHistory: Array<{ from: number; to: number; timestamp: string }>;
  startTime: number;
  isAnalyzing: boolean;
}

const connections = new Map<string, LiveAnalyseConnection>();

export function setupLiveAnalyseWebSocket(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_MESSAGE_SIZE,
  });

  wss.on("connection", async (clientWs, req) => {
    // Auth: verify JWT token from query string
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    if (!token) {
      clientWs.send(JSON.stringify({ type: "la:error", message: "Authentication required" }));
      clientWs.close();
      return;
    }

    let userId: string;
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        clientWs.send(JSON.stringify({ type: "la:error", message: "Invalid token" }));
        clientWs.close();
        return;
      }
      userId = user.id;
    } catch {
      clientWs.send(JSON.stringify({ type: "la:error", message: "Auth failed" }));
      clientWs.close();
      return;
    }

    // Connection limit
    if (connections.size >= MAX_WS_CONNECTIONS) {
      clientWs.send(JSON.stringify({ type: "la:error", message: "Server at capacity. Try again later." }));
      clientWs.close();
      return;
    }

    const sessionId = `la-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[LiveAnalyse] Client connected: ${sessionId} (${connections.size + 1}/${MAX_WS_CONNECTIONS})`);

    // Create DB session
    try {
      await pool.query(
        `INSERT INTO live_analyse_sessions (id, user_id, status) VALUES ($1, $2, 'active')`,
        [sessionId, userId]
      );
    } catch (e: any) {
      console.error("[LiveAnalyse] Failed to create session:", e.message);
    }

    // Connect to ElevenLabs Scribe
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      clientWs.send(JSON.stringify({ type: "la:error", message: "ElevenLabs API key not configured" }));
      clientWs.close();
      return;
    }

    const elevenLabsUrl = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
    elevenLabsUrl.searchParams.set("model_id", "scribe_v2_realtime");
    elevenLabsUrl.searchParams.set("sample_rate", "16000");
    elevenLabsUrl.searchParams.set("language_code", "nl");
    elevenLabsUrl.searchParams.set("vad_commit_strategy", "true");
    elevenLabsUrl.searchParams.set("vad_silence_threshold_secs", "0.5");
    elevenLabsUrl.searchParams.set("vad_threshold", "0.5");

    const elevenLabsWs = new WS(elevenLabsUrl.toString(), {
      headers: { "xi-api-key": apiKey },
    });

    const connection: LiveAnalyseConnection = {
      clientWs,
      elevenLabsWs,
      isConnected: false,
      sessionId,
      userId,
      currentPhase: 1,
      currentSpeaker: "client",
      transcriptBuffer: "",
      debounceTimer: null,
      transcript: [],
      tips: [],
      phaseHistory: [],
      startTime: Date.now(),
      isAnalyzing: false,
    };
    connections.set(sessionId, connection);

    // ElevenLabs → process transcripts
    elevenLabsWs.on("open", () => {
      console.log(`[LiveAnalyse] Connected to ElevenLabs for ${sessionId}`);
      connection.isConnected = true;
      clientWs.send(JSON.stringify({
        type: "la:session_started",
        sessionId,
      }));
    });

    elevenLabsWs.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.message_type === "partial_transcript" && message.text) {
          clientWs.send(JSON.stringify({ type: "partial_transcript", text: message.text }));
        } else if (
          message.message_type === "committed_transcript" ||
          message.message_type === "committed_transcript_with_timestamps"
        ) {
          if (!message.text?.trim()) return;

          // Store in transcript
          const entry = {
            speaker: connection.currentSpeaker,
            text: message.text,
            timestamp: new Date().toISOString(),
          };
          connection.transcript.push(entry);

          // Forward to client
          clientWs.send(JSON.stringify({
            type: "committed_transcript",
            text: message.text,
            speaker: connection.currentSpeaker,
          }));

          // Only analyze client turns
          if (connection.currentSpeaker === "client") {
            connection.transcriptBuffer += `\nKLANT: ${message.text}`;
            scheduleAnalysis(connection);
          } else {
            connection.transcriptBuffer += `\nVERKOPER: ${message.text}`;
          }
        } else if (message.message_type === "error") {
          clientWs.send(JSON.stringify({ type: "la:error", message: message.error }));
        }
      } catch (e) {
        console.error(`[LiveAnalyse] Parse error:`, e);
      }
    });

    elevenLabsWs.on("error", (error) => {
      console.error(`[LiveAnalyse] ElevenLabs error:`, error.message);
      clientWs.send(JSON.stringify({ type: "la:error", message: "STT connection error" }));
    });

    elevenLabsWs.on("close", () => {
      connection.isConnected = false;
    });

    // Handle client messages (audio + control)
    clientWs.on("message", (data, isBinary) => {
      if (!connection.isConnected || !elevenLabsWs) return;

      try {
        if (isBinary || Buffer.isBuffer(data)) {
          // Forward audio to ElevenLabs
          const base64Audio = Buffer.from(data as Buffer).toString("base64");
          elevenLabsWs.send(JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: base64Audio,
          }));
        } else {
          const strData = data.toString();
          try {
            const message = JSON.parse(strData);

            if (message.type === "speaker_mark") {
              connection.currentSpeaker = message.speaker === "you" ? "you" : "client";
            } else if (message.type === "stop_session") {
              completeSession(connection);
            } else if (message.type === "commit") {
              elevenLabsWs.send(JSON.stringify({
                message_type: "input_audio_chunk",
                audio_base_64: "",
                commit: true,
              }));
            }
          } catch {
            // Not JSON, treat as audio
            const base64Audio = Buffer.from(data as unknown as Buffer).toString("base64");
            elevenLabsWs.send(JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: base64Audio,
            }));
          }
        }
      } catch (e) {
        console.error(`[LiveAnalyse] Error handling client message:`, e);
      }
    });

    // Client disconnect → save session
    clientWs.on("close", () => {
      console.log(`[LiveAnalyse] Client disconnected: ${sessionId}`);
      completeSession(connection);
      if (elevenLabsWs) elevenLabsWs.close();
      connections.delete(sessionId);
    });

    clientWs.on("error", (error) => {
      console.error(`[LiveAnalyse] Client error:`, error);
    });
  });

  console.log("[LiveAnalyse] WebSocket server setup on /ws/live-analyse");
  return wss;
}

// ── Analysis scheduling with 3s debounce ─────────────────────────────────────

function scheduleAnalysis(connection: LiveAnalyseConnection) {
  if (connection.debounceTimer) {
    clearTimeout(connection.debounceTimer);
  }

  connection.debounceTimer = setTimeout(async () => {
    if (connection.isAnalyzing || !connection.transcriptBuffer.trim()) return;
    connection.isAnalyzing = true;

    try {
      const result = await analyzeTurn(
        connection.transcriptBuffer,
        connection.currentPhase
      );

      if (result && connection.clientWs.readyState === WS.OPEN) {
        const tipId = `tip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const tipWithMeta = { ...result, id: tipId, timestamp: new Date().toISOString() };
        connection.tips.push(tipWithMeta);

        connection.clientWs.send(JSON.stringify({
          type: "la:tip",
          tip: {
            id: tipId,
            type: result.tipType,
            text: result.tipText,
            houding: `${result.houdingId} — ${result.houdingNaam}`,
            detectedTechnique: result.detectedTechnique,
            recommendedTechnique: result.recommendedTechnique,
            phase: result.phase,
            timestamp: tipWithMeta.timestamp,
          },
        }));

        // Phase transition
        if (result.newPhase && result.newPhase !== connection.currentPhase) {
          const transition = {
            from: connection.currentPhase,
            to: result.newPhase,
            timestamp: new Date().toISOString(),
          };
          connection.phaseHistory.push(transition);
          connection.currentPhase = result.newPhase;

          connection.clientWs.send(JSON.stringify({
            type: "la:phase_update",
            phase: result.newPhase,
            previousPhase: transition.from,
          }));
        }
      }
    } catch (e) {
      console.error("[LiveAnalyse] Analysis error:", e);
    } finally {
      connection.isAnalyzing = false;
      // Keep last 2 lines of context for continuity
      const lines = connection.transcriptBuffer.split("\n").filter(Boolean);
      connection.transcriptBuffer = lines.slice(-2).join("\n");
    }
  }, DEBOUNCE_MS);
}

// ── Session completion ───────────────────────────────────────────────────────

async function completeSession(connection: LiveAnalyseConnection) {
  if (connection.debounceTimer) {
    clearTimeout(connection.debounceTimer);
  }

  const durationSeconds = Math.round((Date.now() - connection.startTime) / 1000);

  try {
    await pool.query(
      `UPDATE live_analyse_sessions
       SET status = 'completed',
           transcript = $1,
           tips = $2,
           phase_history = $3,
           final_phase = $4,
           duration_seconds = $5,
           completed_at = now(),
           updated_at = now()
       WHERE id = $6`,
      [
        JSON.stringify(connection.transcript),
        JSON.stringify(connection.tips),
        JSON.stringify(connection.phaseHistory),
        connection.currentPhase,
        durationSeconds,
        connection.sessionId,
      ]
    );
    console.log(`[LiveAnalyse] Session ${connection.sessionId} saved (${durationSeconds}s, ${connection.tips.length} tips)`);
  } catch (e: any) {
    console.error("[LiveAnalyse] Failed to save session:", e.message);
  }
}
