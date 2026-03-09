/**
 * useLiveAnalyse — React hook for real-time in-call coaching
 *
 * Captures browser microphone audio, sends to WebSocket for STT + analysis,
 * and receives coaching tips in real-time.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../utils/supabase/client";
import type { TranscriptEntry, CoachingTip, Speaker } from "../types/liveAnalyse";

interface UseLiveAnalyseReturn {
  start: () => Promise<void>;
  stop: () => void;
  speakerMark: (speaker: Speaker) => void;
  isActive: boolean;
  isListening: boolean;
  currentSpeaker: Speaker;
  transcript: TranscriptEntry[];
  tips: CoachingTip[];
  currentPhase: number;
  duration: number;
  sessionId: string | null;
  error: string | null;
}

export function useLiveAnalyse(): UseLiveAnalyseReturn {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<Speaker>("client");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [duration, setDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const partialRef = useRef<string>("");

  // Duration timer
  useEffect(() => {
    if (isActive) {
      durationIntervalRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [isActive]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setTips([]);
    setCurrentPhase(1);
    setDuration(0);
    setSessionId(null);

    // Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError("Niet ingelogd");
      return;
    }

    // Request microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch {
      setError("Microfoon toestemming geweigerd");
      return;
    }

    // Show active UI immediately (before WebSocket connects)
    setIsActive(true);

    // Connect WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/live-analyse?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Connection timeout — 10s
    timeoutRef.current = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        setError("Verbinding timeout — controleer je internetverbinding");
        ws.close();
        stopAudioCapture();
        setIsActive(false);
        setIsListening(false);
      }
    }, 10000);

    ws.onopen = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsListening(true);
      startAudioCapture(stream, ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "la:session_started":
            setSessionId(data.sessionId);
            break;

          case "partial_transcript":
            partialRef.current = data.text || "";
            break;

          case "committed_transcript":
            partialRef.current = "";
            if (data.text?.trim()) {
              setTranscript((prev) => [
                ...prev,
                {
                  speaker: data.speaker || "client",
                  text: data.text,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
            break;

          case "la:tip":
            if (data.tip) {
              setTips((prev) => [...prev, data.tip]);
            }
            break;

          case "la:phase_update":
            setCurrentPhase(data.phase);
            break;

          case "la:error":
            setError(data.message);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setError("Verbinding mislukt — probeer opnieuw");
    };

    ws.onclose = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsListening(false);
      stopAudioCapture();
    };
  }, []);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Send stop message
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_session" }));
    }

    // Close WebSocket
    wsRef.current?.close();
    wsRef.current = null;

    // Stop audio
    stopAudioCapture();

    setIsActive(false);
    setIsListening(false);
  }, []);

  const speakerMark = useCallback(
    (speaker: Speaker) => {
      setCurrentSpeaker(speaker);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "speaker_mark", speaker }));
      }
    },
    []
  );

  // Audio capture: mic → 16kHz PCM → WebSocket binary frames
  function startAudioCapture(stream: MediaStream, ws: WebSocket) {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);

    // ScriptProcessorNode: deprecated but widely supported
    // bufferSize=4096 gives ~256ms chunks at 16kHz
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const float32 = event.inputBuffer.getChannelData(0);
      // Convert Float32 → Int16 PCM
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      ws.send(int16.buffer);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  function stopAudioCapture() {
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
      stopAudioCapture();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  return {
    start,
    stop,
    speakerMark,
    isActive,
    isListening,
    currentSpeaker,
    transcript,
    tips,
    currentPhase,
    duration,
    sessionId,
    error,
  };
}
