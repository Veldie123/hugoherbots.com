import { BarChart3, Trophy, Zap, RotateCcw, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import type { AnalysisResultEmbed } from "@/types/crossPlatform";

interface InlineAnalysisCardProps {
  analysis: AnalysisResultEmbed;
  onViewFull?: (conversationId: string) => void;
}

function ScoreDonut({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? "var(--hh-success)" : score >= 50 ? "var(--hh-warning)" : "var(--hh-error)";

  return (
    <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
      <svg viewBox="0 0 72 72" className="w-full h-full">
        <circle cx="36" cy="36" r={radius} fill="none" className="stroke-hh-ui-200" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>{Math.round(score)}</span>
      </div>
    </div>
  );
}

function PhaseBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-hh-muted flex-shrink-0" style={{ width: 20 }}>{label}</span>
      <div className="flex-1 h-1.5 bg-hh-ui-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(score, 3)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium text-hh-text" style={{ width: 28, textAlign: "right" }}>{Math.round(score)}%</span>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  transcribing: { label: "Transcriberen...", icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "var(--hh-primary)" },
  analyzing: { label: "Analyseren...", icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "var(--hh-primary)" },
  evaluating: { label: "Evalueren...", icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "var(--hh-warning)" },
  generating_report: { label: "Rapport genereren...", icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "var(--hh-success)" },
  failed: { label: "Analyse mislukt", icon: <AlertCircle className="w-4 h-4" />, color: "var(--hh-error)" },
};

export function InlineAnalysisCard({ analysis, onViewFull }: InlineAnalysisCardProps) {
  if (analysis.status !== "completed") {
    const statusInfo = STATUS_MAP[analysis.status] || STATUS_MAP.analyzing;
    return (
      <div
        className="rounded-xl border-2 bg-card p-4"
        style={{ maxWidth: 520, borderColor: `color-mix(in srgb, ${statusInfo.color} 25%, transparent)` }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg flex items-center justify-center" style={{ width: 40, height: 40, backgroundColor: `color-mix(in srgb, ${statusInfo.color} 8%, transparent)`, color: statusInfo.color }}>
            {statusInfo.icon}
          </div>
          <div>
            <p className="font-medium text-sm text-hh-text">{analysis.title}</p>
            <p className="text-xs mt-0.5" style={{ color: statusInfo.color }}>{statusInfo.label}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-hh-ui-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full animate-pulse" style={{ width: "60%", backgroundColor: statusInfo.color }} />
        </div>
      </div>
    );
  }

  const momentIcons: Record<string, React.ReactNode> = {
    big_win: <Trophy className="w-3.5 h-3.5 text-hh-warning" />,
    quick_fix: <Zap className="w-3.5 h-3.5 text-hh-warning" />,
    turning_point: <RotateCcw className="w-3.5 h-3.5 text-hh-primary" />,
  };

  return (
    <div className="rounded-xl border border-hh-border bg-card overflow-hidden" style={{ maxWidth: 520 }}>
      <div className="px-4 py-3 flex items-center gap-3 border-b border-hh-border">
        <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, backgroundColor: "var(--hh-success-100)" }}>
          <BarChart3 className="w-4 h-4" style={{ color: "var(--hh-success)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-hh-text truncate">{analysis.title}</p>
          {analysis.coachOneliner && (
            <p className="text-xs text-hh-muted mt-0.5 line-clamp-1">{analysis.coachOneliner}</p>
          )}
        </div>
      </div>

      <div className="px-4 py-3 flex gap-4">
        <ScoreDonut score={analysis.overallScore} />
        <div className="flex-1 space-y-1.5 min-w-0">
          {analysis.phaseCoverage && (
            <>
              <PhaseBar label="F1" score={analysis.phaseCoverage.phase1.score} color="var(--hh-primary)" />
              <PhaseBar label="F2" score={analysis.phaseCoverage.phase2.overall.score} color="var(--hh-primary)" />
              <PhaseBar label="F3" score={analysis.phaseCoverage.phase3.score} color="var(--hh-warning)" />
              <PhaseBar label="F4" score={analysis.phaseCoverage.phase4.score} color="var(--hh-success)" />
            </>
          )}
        </div>
      </div>

      {analysis.moments && analysis.moments.length > 0 && (
        <div className="px-4 pb-2">
          <div className="space-y-1.5">
            {analysis.moments.slice(0, 3).map((moment, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded-lg bg-hh-ui-50 p-2">
                <div className="mt-0.5">{momentIcons[moment.type]}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-hh-text line-clamp-1">{moment.label}</p>
                  <p className="text-xs text-hh-muted line-clamp-1">{moment.whyItMatters}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onViewFull && (
        <button
          onClick={() => onViewFull(analysis.conversationId)}
          className="w-full px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium transition-colors hover:bg-hh-ui-50 border-t border-hh-border text-hh-success"
        >
          Bekijk volledige analyse
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
