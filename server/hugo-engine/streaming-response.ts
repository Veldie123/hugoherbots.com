/**
 * Streaming Response WebSocket Service
 * 
 * Provides low-latency audio responses by:
 * 1. Streaming LLM text generation
 * 2. Piping text chunks to ElevenLabs TTS WebSocket
 * 3. Streaming audio chunks back to browser in real-time
 * 
 * Target: <1 second time-to-first-audio (vs 7+ seconds with batch approach)
 */

import { WebSocket as WS, WebSocketServer } from "ws";
import type { Server } from "http";
import OpenAI from "openai";
import { storage } from "./storage";
import * as v2Engine from "./v2";

interface StreamConnection {
  clientWs: WS;
  elevenLabsWs: WS | null;
  isConnected: boolean;
  sessionId: string | null;
  fullResponse: string;
}

const connections = new Map<string, StreamConnection>();

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
  return openaiClient;
}

function dbToV2State(dbSession: any): v2Engine.V2SessionState {
  return {
    userId: dbSession.userId,
    sessionId: dbSession.sessionId,
    techniqueId: dbSession.techniqueId,
    mode: dbSession.mode,
    currentMode: dbSession.currentMode,
    phase: dbSession.phase,
    epicPhase: dbSession.epicPhase || 'explore',
    epicMilestones: dbSession.epicMilestones || {
      probeUsed: false,
      impactAsked: false,
      commitReady: false
    },
    context: dbSession.context,
    dialogueState: dbSession.dialogueState || { clarificationCounts: {}, lastSlot: null },
    persona: dbSession.persona,
    currentAttitude: dbSession.currentAttitude,
    turnNumber: dbSession.turnNumber,
    conversationHistory: dbSession.conversationHistory || [],
    customerDynamics: dbSession.customerDynamics || {
      rapport: 0.5,
      valueTension: 0.3,
      commitReadiness: 0.2
    },
    events: dbSession.events || [],
    totalScore: dbSession.totalScore,
    expertMode: dbSession.expertMode || false
  };
}

function v2StateToDb(state: v2Engine.V2SessionState, options?: { isActive?: number }): any {
  return {
    mode: state.mode,
    currentMode: state.currentMode,
    phase: state.phase,
    epicPhase: state.epicPhase,
    epicMilestones: state.epicMilestones,
    context: state.context,
    dialogueState: state.dialogueState,
    persona: state.persona,
    currentAttitude: state.currentAttitude,
    turnNumber: state.turnNumber,
    conversationHistory: state.conversationHistory,
    customerDynamics: state.customerDynamics,
    events: state.events,
    totalScore: state.totalScore,
    expertMode: state.expertMode,
    isActive: options?.isActive ?? 1
  };
}

export function setupStreamingResponseWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws/stream-response"
  });

  wss.on("connection", (clientWs, req) => {
    const connectionId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[StreamResponse] Client connected: ${connectionId}`);

    const connection: StreamConnection = {
      clientWs,
      elevenLabsWs: null,
      isConnected: true,
      sessionId: null,
      fullResponse: ""
    };
    connections.set(connectionId, connection);

    clientWs.send(JSON.stringify({ type: "connected" }));

    clientWs.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === "message") {
          await handleStreamingMessage(connectionId, connection, message);
        }
      } catch (e) {
        console.error(`[StreamResponse] Parse error:`, e);
        clientWs.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    clientWs.on("close", () => {
      console.log(`[StreamResponse] Client disconnected: ${connectionId}`);
      if (connection.elevenLabsWs) {
        connection.elevenLabsWs.close();
      }
      connections.delete(connectionId);
    });

    clientWs.on("error", (error) => {
      console.error(`[StreamResponse] Client WebSocket error:`, error);
    });
  });

  console.log("[StreamResponse] WebSocket server setup on /ws/stream-response");
  return wss;
}

async function handleStreamingMessage(
  connectionId: string,
  connection: StreamConnection,
  message: { sessionId: string; message: string }
) {
  const { sessionId, message: userMessage } = message;
  const startTime = Date.now();

  try {
    const dbSession = await storage.getV2Session(sessionId);
    if (!dbSession) {
      connection.clientWs.send(JSON.stringify({ 
        type: "error", 
        message: "Session not found" 
      }));
      return;
    }

    if (dbSession.isActive === 0) {
      connection.clientWs.send(JSON.stringify({ 
        type: "error", 
        message: "Session has ended" 
      }));
      return;
    }

    const state = dbToV2State(dbSession);
    connection.sessionId = sessionId;
    connection.fullResponse = "";

    connection.clientWs.send(JSON.stringify({ type: "processing_start" }));

    if (state.currentMode === 'ROLEPLAY') {
      await handleRoleplayStreaming(connectionId, connection, state, userMessage, dbSession);
    } else {
      const response = await v2Engine.processInput(state, userMessage, false);
      
      await storage.updateV2Session(sessionId, v2StateToDb(response.sessionState, { isActive: dbSession.isActive }));
      
      await streamTextToAudio(connection, response.message);
      
      connection.clientWs.send(JSON.stringify({
        type: "response_complete",
        message: response.message,
        responseType: response.type,
        signal: response.signal,
        duration: Date.now() - startTime
      }));
    }

  } catch (error: any) {
    console.error(`[StreamResponse] Error:`, error);
    connection.clientWs.send(JSON.stringify({ 
      type: "error", 
      message: error.message 
    }));
  }
}

async function handleRoleplayStreaming(
  connectionId: string,
  connection: StreamConnection,
  state: v2Engine.V2SessionState,
  userMessage: string,
  dbSession: any
) {
  const startTime = Date.now();
  
  const wasContextGathering = state.currentMode === 'CONTEXT_GATHERING';
  
  const previousAttitude = state.currentAttitude;
  const isFirstTurn = state.turnNumber === 0;
  
  const lastCustomerMessage = state.conversationHistory
    .filter((h: any) => h.role === 'customer')
    .pop()?.content || '';

  let evaluation: any;
  if (isFirstTurn || !previousAttitude) {
    evaluation = v2Engine.evaluateFirstTurn(userMessage, state.techniqueId, state.phase);
  } else {
    evaluation = await v2Engine.evaluateConceptually(
      userMessage,
      lastCustomerMessage,
      previousAttitude,
      state.techniqueId,
      state.phase,
      state.epicPhase
    );
  }

  const evaluationQuality = evaluation.quality || 'bijna';
  const attitude = v2Engine.sampleAttitude(state.phase, state.techniqueId, state.persona, evaluationQuality);

  const prompt = buildCustomerPrompt(state, attitude, userMessage);

  console.log(`[StreamResponse] Starting streaming LLM call...`);
  const llmStartTime = Date.now();

  const apiKey = process.env.Elevenlabs_api_key;
  const voiceId = process.env.Elevenlabs_Hugo_voice_clone || process.env.ELEVENLABS_VOICE_ID || "sOsTzBXVBqNYMd5L4sCU";
  
  if (!apiKey) {
    console.error("[StreamResponse] ELEVENLABS_API_KEY not configured");
    connection.clientWs.send(JSON.stringify({ type: "error", message: "TTS not configured" }));
    return;
  }

  const elevenLabsWs = await connectToElevenLabsTTS(voiceId, apiKey, connection, connectionId);
  if (!elevenLabsWs) {
    return;
  }
  connection.elevenLabsWs = elevenLabsWs;

  try {
    const stream = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 150,
      temperature: 0.7,
      stream: true
    });

    let fullText = "";
    let chunkBuffer = "";
    let firstChunkReceived = false;
    const CHUNK_SIZE = 50;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          console.log(`[StreamResponse] Time to first LLM token: ${Date.now() - llmStartTime}ms`);
        }
        
        fullText += delta;
        chunkBuffer += delta;

        connection.clientWs.send(JSON.stringify({
          type: "text_chunk",
          text: delta
        }));

        if (chunkBuffer.length >= CHUNK_SIZE || /[.!?,:;]/.test(delta)) {
          sendTextToElevenLabs(elevenLabsWs, chunkBuffer, false);
          chunkBuffer = "";
        }
      }
    }

    if (chunkBuffer.length > 0) {
      sendTextToElevenLabs(elevenLabsWs, chunkBuffer, true);
    } else {
      sendTextToElevenLabs(elevenLabsWs, "", true);
    }

    console.log(`[StreamResponse] LLM complete in ${Date.now() - llmStartTime}ms, text length: ${fullText.length}`);

    connection.fullResponse = fullText;

    const newHistory = [
      ...state.conversationHistory,
      { role: 'seller' as const, content: userMessage },
      { role: 'customer' as const, content: fullText }
    ];

    const updatedState: v2Engine.V2SessionState = {
      ...state,
      currentAttitude: attitude,
      turnNumber: state.turnNumber + 1,
      conversationHistory: newHistory,
      totalScore: state.totalScore + (evaluation.score || 0)
    };

    await storage.updateV2Session(state.sessionId, v2StateToDb(updatedState, { isActive: dbSession.isActive }));

    if (wasContextGathering && updatedState.context.isComplete) {
      const gathered = updatedState.context.gathered;
      await storage.createOrUpdateUserContext(updatedState.userId, {
        sector: gathered.sector || null,
        product: gathered.product || null,
        klantType: gathered.klant_type || null,
        setting: gathered.verkoopkanaal || null,
        additionalContext: {
          gespreksduur: gathered.gespreksduur,
          gespreksdoel: gathered.gespreksdoel
        }
      });
    }

  } catch (error: any) {
    console.error("[StreamResponse] Streaming error:", error);
    connection.clientWs.send(JSON.stringify({ type: "error", message: error.message }));
    
    if (elevenLabsWs.readyState === WS.OPEN) {
      elevenLabsWs.close();
    }
  }
}

function buildCustomerPrompt(
  state: v2Engine.V2SessionState,
  attitude: string,
  sellerMessage: string
): string {
  const context = state.context.gathered;
  const sector = context.sector || 'jouw sector';
  const product = context.product || 'jouw product';
  
  const recentHistory = state.conversationHistory.slice(-4);
  const historyStr = recentHistory
    .map((h: any) => `${h.role === 'seller' ? 'Verkoper' : 'Klant'}: ${h.content}`)
    .join('\n');

  return `Je bent een klant in een sales rollenspel. Antwoord als een echte klant zou antwoorden.

CONTEXT:
- Sector: ${sector}
- Product/dienst: ${product}
- Je houding: ${attitude}

${historyStr ? `GESPREK TOT NU TOE:\n${historyStr}\n` : ''}

De verkoper zegt: "${sellerMessage}"

Geef een kort, natuurlijk antwoord (max 2-3 zinnen) vanuit je ${attitude} houding. Praat als een echte klant, niet als een AI.`;
}

async function connectToElevenLabsTTS(
  voiceId: string,
  apiKey: string,
  connection: StreamConnection,
  connectionId: string
): Promise<WS | null> {
  return new Promise((resolve) => {
    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
    
    console.log(`[StreamResponse] Connecting to ElevenLabs TTS: ${url.split('?')[0]}...`);
    
    const ws = new WS(url);
    let resolved = false;
    let firstAudioReceived = false;
    const connectStartTime = Date.now();

    ws.on("open", () => {
      console.log(`[StreamResponse] Connected to ElevenLabs TTS in ${Date.now() - connectStartTime}ms`);
      
      ws.send(JSON.stringify({
        text: " ",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          speed: 1.0
        },
        xi_api_key: apiKey,
        generation_config: {
          chunk_length_schedule: [50, 90, 120, 150, 200]
        }
      }));
      
      resolved = true;
      resolve(ws);
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.audio) {
          if (!firstAudioReceived) {
            firstAudioReceived = true;
            console.log(`[StreamResponse] Time to first audio chunk: ${Date.now() - connectStartTime}ms`);
          }
          
          connection.clientWs.send(JSON.stringify({
            type: "audio_chunk",
            audio: message.audio
          }));
        }
        
        if (message.isFinal) {
          console.log(`[StreamResponse] ElevenLabs streaming complete`);
          connection.clientWs.send(JSON.stringify({
            type: "audio_complete",
            message: connection.fullResponse
          }));
        }
      } catch (e) {
        console.error(`[StreamResponse] Error parsing ElevenLabs message:`, e);
      }
    });

    ws.on("error", (error) => {
      console.error(`[StreamResponse] ElevenLabs WebSocket error:`, error);
      if (!resolved) {
        resolved = true;
        connection.clientWs.send(JSON.stringify({ type: "error", message: "TTS connection failed" }));
        resolve(null);
      }
    });

    ws.on("close", () => {
      console.log(`[StreamResponse] ElevenLabs connection closed`);
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error(`[StreamResponse] ElevenLabs connection timeout`);
        connection.clientWs.send(JSON.stringify({ type: "error", message: "TTS connection timeout" }));
        resolve(null);
      }
    }, 5000);
  });
}

function sendTextToElevenLabs(ws: WS, text: string, flush: boolean) {
  if (ws.readyState !== WS.OPEN) {
    console.warn(`[StreamResponse] ElevenLabs WS not open, can't send text`);
    return;
  }
  
  const message: any = { text };
  if (flush) {
    message.flush = true;
  }
  
  ws.send(JSON.stringify(message));
}

async function streamTextToAudio(connection: StreamConnection, text: string) {
  const apiKey = process.env.Elevenlabs_api_key;
  const voiceId = process.env.Elevenlabs_Hugo_voice_clone || process.env.ELEVENLABS_VOICE_ID || "sOsTzBXVBqNYMd5L4sCU";
  
  if (!apiKey) {
    console.error("[StreamResponse] ELEVENLABS_API_KEY not configured");
    return;
  }

  const elevenLabsWs = await connectToElevenLabsTTS(voiceId, apiKey, connection, "fallback");
  if (!elevenLabsWs) {
    return;
  }

  const words = text.split(' ');
  let chunk = '';
  
  for (let i = 0; i < words.length; i++) {
    chunk += (chunk ? ' ' : '') + words[i];
    
    if (chunk.length >= 50 || i === words.length - 1) {
      sendTextToElevenLabs(elevenLabsWs, chunk, i === words.length - 1);
      chunk = '';
    }
  }
}
