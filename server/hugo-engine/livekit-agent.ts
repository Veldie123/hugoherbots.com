/**
 * LiveKit Voice Agent for Hugo Sales Coaching Platform
 * 
 * This file provides the agent entry point for LiveKit voice sessions.
 * Uses V2 Roleplay Engine exclusively for conversation logic.
 * 
 * To run the agent: npx tsx server/livekit-agent.ts
 */

import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import * as elevenlabsPlugin from '@livekit/agents-plugin-elevenlabs';
import { fileURLToPath } from 'node:url';
// Speech humanizer disabled — ElevenLabs turbo v2.5 handles natural pacing natively
// import { getHumanizerForModel } from './v2/speech-humanizer';

function cleanTextForTTS(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/—/g, ',');
  cleaned = cleaned.replace(/–/g, ',');
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/#/g, '');
  cleaned = cleaned.replace(/\n{2,}/g, '. ');
  cleaned = cleaned.replace(/\n/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned.trim();
}

interface HugoSessionState {
  sessionId: string | null;
  techniqueId: string;
  isProcessing: boolean;
  lastProcessedTime: number;
}

const DEBOUNCE_MS = 800; // Wait 800ms after last speech before processing — reduces false triggers
const MIN_TRANSCRIPT_LENGTH = 3; // Minimum characters to process

async function getBaseUrl(): Promise<string> {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
}

async function startV2Session(techniqueId: string): Promise<{ sessionId: string; greeting: string }> {
  const baseUrl = await getBaseUrl();
  
  const response = await fetch(`${baseUrl}/api/v2/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ techniqueId, userId: 'livekit-user' })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start session: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('[LiveKit Agent] V2 session response:', JSON.stringify(data).substring(0, 200));
  return {
    sessionId: data.sessionId,
    greeting: data.initialMessage || data.openingMessage || data.message || 'Hallo, welkom bij de training sessie.'
  };
}

async function sendMessageToV2(sessionId: string, message: string): Promise<string> {
  const baseUrl = await getBaseUrl();
  
  const voicePrefix = '[VOICE_MODE] Antwoord KORT en CONVERSATIONEEL — max 2-3 zinnen. Geen opsommingen, geen markdown, geen bullet points. Spreek alsof je aan de telefoon bent. Vraag altijd iets terug.\n\nGebruiker zegt: ';
  
  const response = await fetch(`${baseUrl}/api/v2/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, content: voicePrefix + message })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('[LiveKit Agent] V2 message response:', JSON.stringify(data).substring(0, 200));
  return data.response || data.message || 'Ik begrijp het.';
}

async function endV2Session(sessionId: string): Promise<void> {
  const baseUrl = await getBaseUrl();
  
  await fetch(`${baseUrl}/api/v2/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  }).catch(err => {
    console.error('[LiveKit Agent] Failed to end session:', err);
  });
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
    console.log('[LiveKit Agent] VAD prewarmed');
  },
  
  entry: async (ctx: JobContext) => {
    console.log('[LiveKit Agent] Entry called - job received');
    const roomName = ctx.room.name || '';
    const techniqueId = roomName.split('-')[1] || '2.1';
    console.log(`[LiveKit Agent] Room: ${roomName}, Technique: ${techniqueId}`);
    
    let sessionState: HugoSessionState = {
      sessionId: null,
      techniqueId,
      isProcessing: false,
      lastProcessedTime: 0
    };
    
    // Transcript buffer for debouncing
    let transcriptBuffer = '';
    let debounceTimer: NodeJS.Timeout | null = null;
    
    // Use ElevenLabs plugin with Hugo Herbots' cloned voice
    // eleven_multilingual_v2: highest quality for Dutch — best intonation, question marks, natural pacing
    // voiceSettings tuned for consistent volume, natural speed, and voice clone fidelity
    const TTS_MODEL = 'eleven_multilingual_v2';
    const hugoTTS = new elevenlabsPlugin.TTS({
      voiceId: 'sOsTzBXVBqNYMd5L4sCU',
      model: TTS_MODEL,
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceSettings: {
        stability: 0.75,
        similarity_boost: 0.80,
        style: 0.15,
        speed: 0.92,
        use_speaker_boost: true,
      },
    });
    console.log(`[LiveKit Agent] Using Hugo voice (${TTS_MODEL}) - voiceId: sOsTzBXVBqNYMd5L4sCU`);
    
    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: 'deepgram/nova-3',
        language: 'nl',
      }),
      tts: hugoTTS,
      vad: ctx.proc.userData.vad as silero.VAD,
      turnDetection: 'vad',
      voiceOptions: {
        allowInterruptions: true,
        minInterruptionDuration: 0.8,
        minInterruptionWords: 2,
        minEndpointingDelay: 0.8,
        maxEndpointingDelay: 5.0,
        preemptiveGeneration: false,
        maxToolSteps: 1,
      },
    });
    
    // Process buffered transcript
    async function processTranscript() {
      const transcript = transcriptBuffer.trim();
      transcriptBuffer = '';
      
      if (!transcript || transcript.length < MIN_TRANSCRIPT_LENGTH) {
        console.log('[LiveKit Agent] Skipping empty/short transcript');
        return;
      }
      
      if (!sessionState.sessionId) {
        console.log('[LiveKit Agent] No session ID, skipping');
        return;
      }
      
      if (sessionState.isProcessing) {
        console.log('[LiveKit Agent] Already processing, skipping');
        return;
      }
      
      // Prevent rapid-fire processing
      const now = Date.now();
      if (now - sessionState.lastProcessedTime < DEBOUNCE_MS) {
        console.log('[LiveKit Agent] Too soon since last process, skipping');
        return;
      }
      
      sessionState.isProcessing = true;
      sessionState.lastProcessedTime = now;
      
      console.log(`[LiveKit Agent] Processing: "${transcript}"`);
      
      try {
        const response = await sendMessageToV2(sessionState.sessionId, transcript);
        const cleaned = cleanTextForTTS(response);
        console.log('[LiveKit Agent] V2 response:', cleaned.substring(0, 100));
        
        const sentenceMatches = cleaned.match(/[^.!?]+[.!?]+/g) || [];
        const lastMatch = sentenceMatches.join('');
        const trailing = cleaned.slice(lastMatch.length).trim();
        const sentences = trailing ? [...sentenceMatches, trailing] : sentenceMatches.length > 0 ? sentenceMatches : [cleaned];
        const maxSentences = Math.min(sentences.length, 4);
        const voiceResponse = sentences.slice(0, maxSentences).join(' ').trim();
        
        await session.say(voiceResponse);
        console.log('[LiveKit Agent] TTS response sent');
      } catch (error) {
        console.error('[LiveKit Agent] Error processing message:', error);
      } finally {
        sessionState.isProcessing = false;
      }
    }
    
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      console.log(`[LiveKit Agent] EVENT: Agent state changed: ${ev.oldState} -> ${ev.newState}`);
    });
    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      console.log(`[LiveKit Agent] EVENT: User state changed: ${ev.oldState} -> ${ev.newState}`);
    });
    
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, async (ev) => {
      console.log(`[LiveKit Agent] EVENT: UserInputTranscribed - isFinal: ${ev.isFinal}, text: "${ev.transcript}"`);
      
      // Only process final transcripts
      if (!ev.isFinal) return;
      
      const text = ev.transcript?.trim() || '';
      
      // Skip empty transcripts completely
      if (!text) {
        return;
      }
      
      console.log(`[LiveKit Agent] User said: "${text}"`);
      
      // Add to buffer
      transcriptBuffer += (transcriptBuffer ? ' ' : '') + text;
      
      // Reset debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Wait for silence before processing
      debounceTimer = setTimeout(() => {
        processTranscript();
      }, DEBOUNCE_MS);
    });
    
    session.on(voice.AgentSessionEventTypes.Close, async () => {
      console.log('[LiveKit Agent] Session closed');
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (sessionState.sessionId) {
        await endV2Session(sessionState.sessionId);
      }
    });
    
    // CRITICAL: Must connect to room BEFORE starting session
    await ctx.connect();
    console.log('[LiveKit Agent] Connected to room');
    
    // Minimal agent - no auto-responses, V2 engine handles all logic
    const minimalAgent = new voice.Agent({
      instructions: '',
    });
    
    // Start V2 session and voice session in parallel for faster startup
    const v2SessionPromise = startV2Session(techniqueId);
    
    await session.start({
      agent: minimalAgent,
      room: ctx.room,
      outputOptions: {
        transcriptionEnabled: true,
      },
    });
    console.log('[LiveKit Agent] Voice session started');
    
    try {
      const { sessionId, greeting } = await v2SessionPromise;
      sessionState.sessionId = sessionId;
      console.log(`[LiveKit Agent] V2 Session: ${sessionId}`);
      
      try {
        await session.say(cleanTextForTTS(greeting));
        console.log('[LiveKit Agent] Greeting sent');
      } catch (ttsErr) {
        console.error('[LiveKit Agent] Greeting TTS error:', ttsErr);
      }
    } catch (error) {
      console.error('[LiveKit Agent] Failed to start V2 session:', error);
      try {
        await session.say('Sorry, er ging iets mis.');
      } catch (_) {}
    }
    
    console.log('[LiveKit Agent] Ready');
  },
});

cli.runApp(new ServerOptions({ 
  agent: fileURLToPath(import.meta.url),
}));
