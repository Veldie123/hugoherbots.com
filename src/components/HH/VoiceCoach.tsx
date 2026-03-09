/**
 * VoiceCoach — Real-time voice coaching with Hugo's cloned voice
 *
 * iOS-call-style interface using ElevenLabs Conversational AI.
 * Auto-starts the call on mount — one click on the phone toggle = call begins.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { Phone, Volume2, Mic, MicOff, AlertCircle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../../services/apiFetch";

interface VoiceCoachProps {
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceCoach({ onClose }: VoiceCoachProps) {
  const [micMuted, setMicMuted] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [waveformHeights, setWaveformHeights] = useState<number[]>(new Array(15).fill(15));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const conversation = useConversation({
    micMuted,
    onConnect: () => {
      toast.success("Verbonden met Hugo");
    },
    onDisconnect: () => {
      toast.info("Voice sessie beëindigd");
    },
    onError: (err: any) => {
      console.error("[VoiceCoach] Error:", err);
      setError(err?.message || "Verbinding mislukt");
    },
  });

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";
  const isSpeaking = conversation.isSpeaking;

  // Auto-start session on mount
  const startSession = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Auth gate: get agentId from our backend
      const response = await apiFetch("/api/v3/voice/signed-url", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Kon voice sessie niet starten");
      }

      const { agentId, voiceId } = await response.json();

      // Connect via WebRTC with Hugo's cloned voice override
      await conversation.startSession({
        agentId,
        overrides: {
          tts: { voiceId },
        },
      });
    } catch (err: any) {
      console.error("[VoiceCoach] Start failed:", err);
      if (err.name === "NotAllowedError") {
        setError("Microfoon toegang geweigerd. Sta microfoon toe in je browser.");
      } else {
        setError(err.message || "Kon voice niet starten");
      }
    }
  }, [conversation]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startSession();
    }
  }, [startSession]);

  // Session timer
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

  // Waveform animation using ElevenLabs frequency data
  useEffect(() => {
    if (!isConnected) {
      if (waveformRef.current) cancelAnimationFrame(waveformRef.current);
      return;
    }

    function animate() {
      const outputData = conversation.getOutputByteFrequencyData();
      const inputData = conversation.getInputByteFrequencyData();
      const data = isSpeaking ? outputData : inputData;

      if (data && data.length > 0) {
        const barCount = 15;
        const step = Math.floor(data.length / barCount);
        const heights = [];
        for (let i = 0; i < barCount; i++) {
          const value = data[i * step] || 0;
          heights.push(Math.max(8, (value / 255) * 56));
        }
        setWaveformHeights(heights);
      } else {
        // Idle animation
        setWaveformHeights(prev =>
          prev.map((_, i) => 10 + (i % 3) * 8)
        );
      }

      waveformRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => {
      if (waveformRef.current) cancelAnimationFrame(waveformRef.current);
    };
  }, [isConnected, isSpeaking, conversation]);

  const endSession = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // Session may already be ended
    }
    onClose();
  }, [conversation, onClose]);

  const retrySession = useCallback(() => {
    setError(null);
    startedRef.current = false;
    startSession();
  }, [startSession]);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col rounded-[16px] overflow-hidden"
      style={{ background: "linear-gradient(180deg, var(--hh-success) 0%, #0d9488 50%, #0f766e 100%)" }}
    >
      {/* Close button */}
      <button
        onClick={endSession}
        className="absolute top-4 right-4 z-20 flex items-center justify-center rounded-full transition-colors hover:bg-white/20"
        style={{ width: "36px", height: "36px", backgroundColor: "rgba(255,255,255,0.1)" }}
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Error banner */}
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-hh-error/90 text-white p-3 rounded-lg flex items-center gap-2 z-10">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-[14px]">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main content — centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Avatar */}
        <div className="relative mb-6">
          <div
            className="rounded-full flex items-center justify-center"
            style={{ width: "180px", height: "180px", backgroundColor: "rgba(255,255,255,0.25)" }}
          >
            {isConnecting ? (
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            ) : (
              <span className="text-white font-bold" style={{ fontSize: "64px" }}>HH</span>
            )}
          </div>
        </div>

        {/* Name + status */}
        <h3 className="text-white text-[26px] font-bold mb-1">
          Hugo Herbots <sup className="text-[14px] font-semibold" style={{ verticalAlign: "super" }}>AI</sup>
        </h3>
        <p className="text-[16px] mb-2" style={{ color: "rgba(255,255,255,0.8)" }}>
          {isConnecting
            ? "Verbinden..."
            : isConnected
              ? isSpeaking ? "Hugo spreekt..." : "Verbonden"
              : error
                ? "Verbinding mislukt"
                : "Starten..."
          }
        </p>

        {/* Timer */}
        {isConnected && (
          <p className="text-[22px] font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>
            {formatTime(sessionTimer)}
          </p>
        )}

        {/* Waveform visualization */}
        <div className="flex items-end justify-center gap-1.5 h-16 mt-8">
          {waveformHeights.map((h, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-100"
              style={{
                width: "6px",
                backgroundColor: "rgba(255,255,255,0.7)",
                height: `${h}px`,
              }}
            />
          ))}
        </div>

        {/* Status message */}
        <p className="text-white/60 text-[14px] mt-4">
          {isConnected
            ? isSpeaking ? "Je kunt Hugo onderbreken door te praten" : "Spraakcoaching actief"
            : error
              ? "Controleer microfoon en probeer opnieuw"
              : "ElevenLabs voice verbinding"
          }
        </p>
      </div>

      {/* Bottom controls */}
      <div className="pb-8 pt-4">
        <div className="flex items-center justify-center gap-8">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setMicMuted(prev => !prev)}
              className="flex items-center justify-center transition-colors"
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: micMuted ? "white" : "rgba(255,255,255,0.2)",
              }}
            >
              {micMuted
                ? <MicOff className="w-5 h-5 text-teal-700" />
                : <Mic className="w-5 h-5 text-white" />
              }
            </button>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {micMuted ? "Unmute" : "Mute"}
            </span>
          </div>

          {/* Hangup / Retry */}
          <div className="flex flex-col items-center gap-2">
            {error && !isConnected && !isConnecting ? (
              <button
                onClick={retrySession}
                className="flex items-center justify-center shadow-xl"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                }}
              >
                <Phone className="w-6 h-6 text-teal-700" />
              </button>
            ) : (
              <button
                onClick={endSession}
                className="flex items-center justify-center shadow-xl"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                }}
              >
                <Phone className="w-6 h-6 text-white" style={{ transform: "rotate(135deg)" }} />
              </button>
            )}
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {error && !isConnected && !isConnecting ? "Opnieuw" : "Ophangen"}
            </span>
          </div>

          {/* Speaker/Volume */}
          <div className="flex flex-col items-center gap-2">
            <button
              className="flex items-center justify-center"
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Volume2 className="w-5 h-5 text-white" />
            </button>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>Speaker</span>
          </div>
        </div>
      </div>
    </div>
  );
}
