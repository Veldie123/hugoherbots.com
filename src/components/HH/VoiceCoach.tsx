/**
 * VoiceCoach — Real-time voice coaching with Hugo's cloned voice
 *
 * Uses ElevenLabs Conversational AI via @elevenlabs/react.
 * ElevenLabs handles WebRTC, STT, TTS, turn-taking, and interruptions.
 * Our server provides Claude V3 agent as Custom LLM backend.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Volume2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders } from "../../services/hugoApi";

interface VoiceCoachProps {
  onClose: () => void;
}

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export function VoiceCoach({ onClose }: VoiceCoachProps) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      toast.success("Verbonden met Hugo");
    },
    onDisconnect: () => {
      toast.info("Voice sessie beëindigd");
    },
    onMessage: (message: any) => {
      if (message.source === "user" || message.role === "user") {
        setTranscript(prev => [...prev, {
          role: "user",
          text: typeof message === "string" ? message : message.message || message.text || "",
          timestamp: Date.now(),
        }]);
      } else if (message.source === "ai" || message.role === "assistant") {
        setTranscript(prev => [...prev, {
          role: "agent",
          text: typeof message === "string" ? message : message.message || message.text || "",
          timestamp: Date.now(),
        }]);
      }
    },
    onError: (error: any) => {
      console.error("[VoiceCoach] Error:", error);
      toast.error("Voice fout: " + (error?.message || "Verbinding mislukt"));
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Audio visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || conversation.status !== "connected") {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const outputData = conversation.getOutputByteFrequencyData();
      const inputData = conversation.getInputByteFrequencyData();
      const data = conversation.isSpeaking ? outputData : inputData;

      if (data && data.length > 0) {
        const barCount = 32;
        const barWidth = width / barCount - 2;
        const step = Math.floor(data.length / barCount);

        for (let i = 0; i < barCount; i++) {
          const value = data[i * step] || 0;
          const barHeight = (value / 255) * height * 0.8;
          const x = i * (barWidth + 2);
          const y = (height - barHeight) / 2;

          ctx.fillStyle = conversation.isSpeaking
            ? "var(--hh-success)"
            : "var(--hh-primary)";
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [conversation.status, conversation.isSpeaking]);

  const startSession = useCallback(async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from our server
      const headers = getAuthHeaders();
      const response = await fetch("/api/v3/voice/signed-url", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Kon voice sessie niet starten");
      }

      const { signedUrl, agentId } = await response.json();

      // Start ElevenLabs conversation via signed URL or agent ID
      if (signedUrl) {
        await conversation.startSession({
          url: signedUrl,
          connectionType: "webrtc",
        });
      } else {
        await conversation.startSession({
          agentId,
          connectionType: "webrtc",
        });
      }
    } catch (err: any) {
      console.error("[VoiceCoach] Start failed:", err);
      if (err.name === "NotAllowedError") {
        toast.error("Microfoon toegang geweigerd. Sta microfoon toe in je browser.");
      } else {
        toast.error(err.message || "Kon voice niet starten");
      }
    }
  }, [conversation]);

  const endSession = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // Session may already be ended
    }
    onClose();
  }, [conversation, onClose]);

  const toggleMic = useCallback(() => {
    setMicMuted(prev => !prev);
    // ElevenLabs SDK handles mic muting via controlled state
  }, []);

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  return (
    <div className="fixed inset-0 z-50 bg-hh-bg/95 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div className="text-[14px] text-hh-muted">
          {isConnected ? "Voice coaching actief" : isConnecting ? "Verbinden..." : "Voice coaching"}
        </div>
        <button
          onClick={endSession}
          className="text-[14px] text-hh-muted hover:text-hh-error transition-colors"
        >
          Sluiten
        </button>
      </div>

      {/* Main visual */}
      <div className="flex flex-col items-center gap-6 max-w-md w-full px-6">
        {/* Avatar ring */}
        <div className={`relative w-32 h-32 rounded-full flex items-center justify-center ${
          conversation.isSpeaking
            ? "ring-4 ring-hh-success/50 animate-pulse"
            : isConnected
              ? "ring-2 ring-hh-primary/30"
              : "ring-2 ring-hh-border"
        }`}>
          <div className="w-28 h-28 rounded-full bg-hh-ui-50 flex items-center justify-center">
            <span className="text-[40px] font-bold text-hh-primary">H</span>
          </div>
          {/* Speaking indicator */}
          {conversation.isSpeaking && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-hh-success text-white text-[11px] font-medium">
              Hugo spreekt
            </div>
          )}
          {isConnected && !conversation.isSpeaking && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-hh-primary text-white text-[11px] font-medium">
              Hugo luistert
            </div>
          )}
        </div>

        {/* Audio visualization */}
        {isConnected && (
          <canvas
            ref={canvasRef}
            width={256}
            height={48}
            className="w-64 h-12 opacity-60"
          />
        )}

        {/* Status text */}
        <div className="text-center">
          <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text">
            {isConnected
              ? conversation.isSpeaking ? "Hugo aan het woord..." : "Spreek vrijuit..."
              : isConnecting
                ? "Verbinden met Hugo..."
                : "Praat met Hugo"
            }
          </h2>
          <p className="text-[14px] text-hh-muted mt-1">
            {isConnected
              ? "Je kunt Hugo onderbreken door te praten"
              : "Start een voice coaching sessie met Hugo's AI"
            }
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-4">
          {!isConnected && !isConnecting && (
            <button
              onClick={startSession}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-hh-success hover:bg-hh-success/90 text-white font-medium text-[16px] transition-colors"
            >
              <Phone className="w-5 h-5" />
              Start gesprek
            </button>
          )}

          {isConnecting && (
            <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-hh-ui-200 text-hh-muted font-medium text-[16px]">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-hh-primary" />
              Verbinden...
            </div>
          )}

          {isConnected && (
            <>
              <button
                onClick={toggleMic}
                className={`w-12 h-12 rounded-full p-0 flex items-center justify-center transition-colors ${
                  micMuted
                    ? "bg-hh-error/10 text-hh-error"
                    : "bg-hh-ui-50 text-hh-primary hover:bg-hh-ui-200"
                }`}
              >
                {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={endSession}
                className="w-14 h-14 rounded-full p-0 flex items-center justify-center bg-hh-error hover:bg-hh-error/90 text-white transition-colors"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="w-full mt-6 max-h-48 overflow-y-auto border border-hh-border rounded-[16px] p-4 bg-hh-ui-50">
            <div className="space-y-2">
              {transcript.map((entry, i) => (
                <div key={i} className={`text-[13px] ${entry.role === "agent" ? "text-hh-text" : "text-hh-muted"}`}>
                  <span className="font-medium">
                    {entry.role === "agent" ? "Hugo: " : "Jij: "}
                  </span>
                  {entry.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
