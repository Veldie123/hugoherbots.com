/**
 * ElevenLabs Scribe v2 Realtime STT Service
 * 
 * Server-side WebSocket proxy for secure speech-to-text.
 * Client sends audio to our server, server forwards to ElevenLabs.
 * API key never exposed to client.
 * 
 * API Reference: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
 */

import { WebSocket as WS, WebSocketServer } from "ws";
import type { Server } from "http";

interface ScribeConnection {
  clientWs: WS;
  elevenLabsWs: WS | null;
  isConnected: boolean;
}

const connections = new Map<string, ScribeConnection>();

export function setupScribeWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server, 
    path: "/ws/scribe" 
  });

  wss.on("connection", (clientWs, req) => {
    const connectionId = `scribe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[Scribe] Client connected: ${connectionId}`);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("[Scribe] ELEVENLABS_API_KEY not configured");
      clientWs.send(JSON.stringify({ message_type: "error", error: "ElevenLabs API key not configured" }));
      clientWs.close();
      return;
    }

    // Connect to ElevenLabs Scribe WebSocket with config via query parameters
    const elevenLabsUrl = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
    elevenLabsUrl.searchParams.set("model_id", "scribe_v2_realtime");
    elevenLabsUrl.searchParams.set("sample_rate", "16000");
    elevenLabsUrl.searchParams.set("language_code", "nl");
    elevenLabsUrl.searchParams.set("vad_commit_strategy", "true");
    elevenLabsUrl.searchParams.set("vad_silence_threshold_secs", "0.5");
    elevenLabsUrl.searchParams.set("vad_threshold", "0.5");
    
    console.log(`[Scribe] Connecting to ElevenLabs: ${elevenLabsUrl.toString()}`);
    
    const elevenLabsWs = new WS(elevenLabsUrl.toString(), {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    const connection: ScribeConnection = {
      clientWs,
      elevenLabsWs,
      isConnected: false,
    };
    connections.set(connectionId, connection);

    elevenLabsWs.on("open", () => {
      console.log(`[Scribe] Connected to ElevenLabs for ${connectionId}`);
      connection.isConnected = true;
      // No session_config message needed - config is in URL params
      clientWs.send(JSON.stringify({ type: "connected" }));
    });

    elevenLabsWs.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`[Scribe] ElevenLabs message:`, message.message_type || message.type);
        
        // Forward transcription events to client
        // ElevenLabs uses message_type, we normalize to type for client
        if (message.message_type === "session_started") {
          console.log(`[Scribe] Session started: ${message.session_id}`);
          clientWs.send(JSON.stringify({ type: "session_started", sessionId: message.session_id }));
        } else if (message.message_type === "partial_transcript") {
          console.log(`[Scribe] Partial: "${message.text}"`);
          clientWs.send(JSON.stringify({ type: "partial_transcript", text: message.text }));
        } else if (message.message_type === "committed_transcript" || message.message_type === "committed_transcript_with_timestamps") {
          console.log(`[Scribe] Committed: "${message.text}"`);
          clientWs.send(JSON.stringify({ type: "committed_transcript", text: message.text }));
        } else if (message.message_type === "error") {
          console.error(`[Scribe] ElevenLabs error:`, message.error);
          clientWs.send(JSON.stringify({ type: "error", message: message.error }));
        }
      } catch (e) {
        console.error(`[Scribe] Parse error:`, e);
      }
    });

    elevenLabsWs.on("error", (error) => {
      console.error(`[Scribe] ElevenLabs WebSocket error:`, error.message);
      clientWs.send(JSON.stringify({ type: "error", message: "ElevenLabs connection error" }));
    });

    elevenLabsWs.on("close", (code, reason) => {
      console.log(`[Scribe] ElevenLabs connection closed for ${connectionId}, code: ${code}, reason: ${reason.toString()}`);
      connection.isConnected = false;
      clientWs.send(JSON.stringify({ type: "disconnected" }));
    });

    // Handle audio data from client
    clientWs.on("message", (data, isBinary) => {
      if (!connection.isConnected || !elevenLabsWs) {
        return;
      }
      
      try {
        // Binary audio data - forward as base64
        if (isBinary || Buffer.isBuffer(data)) {
          const base64Audio = Buffer.from(data as Buffer).toString("base64");
          elevenLabsWs.send(JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: base64Audio,
          }));
        } else {
          // Text message - try to parse as JSON control message
          const strData = data.toString();
          try {
            const message = JSON.parse(strData);
            if (message.type === "commit") {
              elevenLabsWs.send(JSON.stringify({ 
                message_type: "input_audio_chunk",
                audio_base_64: "",
                commit: true
              }));
            }
          } catch {
            // Not valid JSON, treat as binary
            const base64Audio = Buffer.from(data as unknown as Buffer).toString("base64");
            elevenLabsWs.send(JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: base64Audio,
            }));
          }
        }
      } catch (e) {
        console.error(`[Scribe] Error forwarding audio:`, e);
      }
    });

    clientWs.on("close", () => {
      console.log(`[Scribe] Client disconnected: ${connectionId}`);
      if (elevenLabsWs) {
        elevenLabsWs.close();
      }
      connections.delete(connectionId);
    });

    clientWs.on("error", (error) => {
      console.error(`[Scribe] Client WebSocket error:`, error);
    });
  });

  console.log("[Scribe] WebSocket server setup on /ws/scribe");
  return wss;
}
