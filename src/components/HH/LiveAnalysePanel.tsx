/**
 * LiveAnalysePanel — Real-time in-call coaching UI
 *
 * Replaces the dummy copilot UI in ConversationAnalysis.tsx.
 * Uses useLiveAnalyse hook for audio capture + WebSocket.
 * All styling via hh-* design tokens.
 */

import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Sparkles,
  Mic,
  MicOff,
  Clock,
  MessageSquare,
  Lock,
  Target,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  User,
  Users,
} from "lucide-react";
import { useRef, useEffect } from "react";
import { useLiveAnalyse } from "../../hooks/useLiveAnalyse";
import type { CoachingTip, TipType } from "../../types/liveAnalyse";

// ── EPIC fase labels ─────────────────────────────────────────────────────────

const PHASE_LABELS: Record<number, string> = {
  0: "Voorbereiding",
  1: "Opening",
  2: "Ontdekking (EPIC)",
  3: "Aanbeveling",
  4: "Beslissing",
};

// ── Tip styling (hh-* tokens only) ──────────────────────────────────────────

const TIP_STYLES: Record<TipType, { bg: string; border: string; icon: typeof MessageSquare; iconColor: string }> = {
  wedervraag: { bg: "bg-hh-primary/5", border: "border-hh-primary", icon: MessageSquare, iconColor: "text-hh-primary" },
  lock: { bg: "bg-hh-ui-50", border: "border-hh-primary", icon: Lock, iconColor: "text-hh-primary" },
  waarschuwing: { bg: "bg-hh-error/5", border: "border-hh-error", icon: Target, iconColor: "text-hh-error" },
  open: { bg: "bg-hh-success/5", border: "border-hh-success", icon: Lightbulb, iconColor: "text-hh-success" },
  positief: { bg: "bg-hh-success/5", border: "border-hh-success", icon: CheckCircle2, iconColor: "text-hh-success" },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LiveAnalysePanel() {
  const {
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
    error,
  } = useLiveAnalyse();

  const tipsEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll tips and transcript
  useEffect(() => {
    tipsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tips]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <Card className="p-6 rounded-[16px] border-hh-border hover:border-hh-primary/40 hover:shadow-lg hover:bg-hh-ui-50/30 transition-all">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-hh-primary" />
          <h2 className="text-[24px] leading-[30px] text-hh-text font-semibold">
            Live Analyse
          </h2>
        </div>
        <p className="text-[14px] leading-[20px] text-hh-muted">
          Real-time coaching tijdens gesprekken
        </p>
      </div>

      {/* Status */}
      <div className="mb-6">
        <div className="text-[13px] leading-[18px] text-hh-muted mb-2">
          Status
        </div>
        <div className="text-[18px] leading-[24px] text-hh-text font-semibold mb-1">
          {isActive ? "Live aan het luisteren" : "Klaar om te starten"}
        </div>
        <div className="text-[13px] leading-[18px] text-hh-muted">
          Hugo luistert mee en geeft real-time tips
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-hh-error/5 border border-hh-error/20 mb-4">
          <AlertCircle className="w-4 h-4 text-hh-error flex-shrink-0" />
          <p className="text-[12px] leading-[17px] text-hh-error">{error}</p>
        </div>
      )}

      {/* Start/Stop button */}
      <Button
        onClick={isActive ? stop : start}
        variant={isActive ? "destructive" : "default"}
        className={`w-full h-11 gap-2 ${!isActive ? "bg-hh-success hover:bg-hh-success/90 text-white" : ""}`}
      >
        {isActive ? (
          <>
            <MicOff className="w-4 h-4" />
            Stop coaching
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            Start live coaching
          </>
        )}
      </Button>

      {/* Active session content */}
      {isActive && (
        <div className="space-y-4 mt-6">
          {/* Status bar: listening indicator + speaker toggle + duration */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-hh-ui-50">
            <div className="flex items-center gap-3">
              {/* Listening indicator */}
              <div className="flex items-center gap-2">
                {isListening ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-hh-success animate-pulse" />
                    <span className="text-[12px] leading-[16px] text-hh-text">Listening...</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-hh-muted" />
                    <span className="text-[12px] leading-[16px] text-hh-muted">Paused</span>
                  </>
                )}
              </div>

              <div className="h-4 w-px bg-hh-ui-200" />

              {/* Duration */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-hh-muted" />
                <span className="text-[12px] leading-[16px] text-hh-muted">
                  {formatDuration(duration)}
                </span>
              </div>
            </div>

            {/* Speaker toggle */}
            <div className="flex items-center gap-1 bg-hh-bg rounded-full p-0.5 border border-hh-border">
              <button
                onClick={() => speakerMark("client")}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  currentSpeaker === "client"
                    ? "bg-hh-primary text-white"
                    : "text-hh-muted hover:text-hh-text"
                }`}
              >
                <Users className="w-3 h-3" />
                Klant
              </button>
              <button
                onClick={() => speakerMark("you")}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  currentSpeaker === "you"
                    ? "bg-hh-primary text-white"
                    : "text-hh-muted hover:text-hh-text"
                }`}
              >
                <User className="w-3 h-3" />
                Ik spreek
              </button>
            </div>
          </div>

          {/* EPIC Phase Progress Bar */}
          <div className="space-y-2">
            <h4 className="text-[13px] leading-[18px] text-hh-muted">Gespreksfase</h4>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((phase) => (
                <div
                  key={phase}
                  className={`flex-1 h-2 rounded-full transition-colors ${
                    phase <= currentPhase
                      ? "bg-hh-primary"
                      : "bg-hh-ui-200"
                  }`}
                />
              ))}
            </div>
            <div className="text-[11px] leading-[14px] text-hh-muted">
              Fase {currentPhase}: {PHASE_LABELS[currentPhase] || "Onbekend"}
            </div>
          </div>

          {/* Tips panel */}
          {tips.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[13px] leading-[18px] text-hh-muted">Hugo's Tips</h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {tips.map((tip) => (
                  <TipCard key={tip.id} tip={tip} />
                ))}
                <div ref={tipsEndRef} />
              </div>
            </div>
          )}

          {/* Transcript panel */}
          {transcript.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[13px] leading-[18px] text-hh-muted">Live Transcript</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 p-3 rounded-lg bg-hh-ui-50">
                {transcript.map((line, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-[11px] leading-[16px] text-hh-muted flex-shrink-0">
                      {new Date(line.timestamp).toLocaleTimeString("nl-BE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <p className="text-[12px] leading-[17px] text-hh-text flex-1">
                      <strong
                        className={
                          line.speaker === "you" ? "text-hh-primary" : "text-hh-text"
                        }
                      >
                        {line.speaker === "you" ? "Jij:" : "Klant:"}
                      </strong>{" "}
                      {line.text}
                    </p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Tip Card subcomponent ────────────────────────────────────────────────────

function TipCard({ tip }: { tip: CoachingTip }) {
  const style = TIP_STYLES[tip.type] || TIP_STYLES.open;
  const Icon = style.icon;

  return (
    <div className={`p-3 rounded-lg border-l-4 ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-4 h-4 ${style.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] leading-[17px] text-hh-text">
            {tip.text}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] leading-[14px] text-hh-muted">
              {tip.houding}
            </span>
            <span className="text-[10px] leading-[14px] text-hh-muted">
              {new Date(tip.timestamp).toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
