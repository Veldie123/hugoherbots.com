import { useState } from "react";
import { Badge } from "../ui/badge";
import {
  Trophy,
  Wrench,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CoachMoment {
  id: string;
  timestamp: string;
  turnIndex: number;
  phase: number;
  label: string;
  type: 'big_win' | 'quick_fix' | 'turning_point';
  customerSignal?: string;
  sellerText: string;
  customerText: string;
  whyItMatters: string;
  betterAlternative: string;
  recommendedTechniques: string[];
}

interface CoachDebrief {
  oneliner: string;
  epicMomentum: string;
}

interface AnalysisInsights {
  overallScore: number;
  coachDebrief?: CoachDebrief;
  moments?: CoachMoment[];
  strengths?: Array<{ text: string; quote: string; turnIdx: number }>;
  improvements?: Array<{ text: string; quote: string; turnIdx: number; betterApproach: string }>;
}

interface CoachViewSummaryProps {
  insights: AnalysisInsights;
  title?: string;
  onMomentClick?: (turnIndex: number) => void;
}

const MOMENT_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  'big_win': { icon: Trophy, color: '#047857', bg: '#ECFDF5', label: 'Big Win' },
  'quick_fix': { icon: Wrench, color: '#B45309', bg: '#FFFBEB', label: 'Quick Fix' },
  'turning_point': { icon: RotateCcw, color: '#BE123C', bg: '#FFF1F2', label: 'Scharnierpunt' },
};

export function CoachViewSummary({ insights, title, onMomentClick }: CoachViewSummaryProps) {
  const [expanded, setExpanded] = useState(true);
  const { overallScore, coachDebrief, moments = [], strengths = [], improvements = [] } = insights;

  return (
    <div className="border border-hh-border rounded-[16px] overflow-hidden mb-4">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-hh-ui-50 hover:bg-hh-ui-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {/* Score circle */}
          <div className="relative flex-shrink-0" style={{ width: '44px', height: '44px' }}>
            <svg width="44" height="44" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="#3C9A6E"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - overallScore / 100)}`}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-bold text-hh-text text-[13px]">{overallScore}%</span>
            </div>
          </div>

          <div className="text-left min-w-0">
            <p className="text-[14px] font-medium text-hh-text truncate">
              {coachDebrief?.oneliner || title || 'Analyse resultaat'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {moments.slice(0, 3).map((m) => {
                const config = MOMENT_CONFIG[m.type] || MOMENT_CONFIG['quick_fix'];
                return (
                  <Badge
                    key={m.id}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium border-0"
                    style={{ backgroundColor: config.bg, color: config.color }}
                  >
                    {config.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-hh-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-hh-muted flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Coach debrief */}
          {coachDebrief?.epicMomentum && (
            <p className="text-[13px] text-hh-muted leading-[20px]">
              {coachDebrief.epicMomentum}
            </p>
          )}

          {/* Coaching moments */}
          {moments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {moments.slice(0, 4).map((moment) => {
                const config = MOMENT_CONFIG[moment.type] || MOMENT_CONFIG['quick_fix'];
                const MomentIcon = config.icon;
                return (
                  <button
                    key={moment.id}
                    onClick={() => onMomentClick?.(moment.turnIndex)}
                    className="text-left rounded-xl p-3 transition-all hover:shadow-sm cursor-pointer"
                    style={{ backgroundColor: config.bg, border: '1px solid transparent' }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <MomentIcon className="w-3.5 h-3.5" style={{ color: config.color }} strokeWidth={1.75} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-[12px] leading-[17px] text-hh-text font-medium line-clamp-2">
                      {moment.label}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Strengths & Improvements */}
          {(strengths.length > 0 || improvements.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {strengths.length > 0 && (
                <div className="text-[12px]">
                  <span className="font-semibold text-hh-success">Sterk:</span>{' '}
                  <span className="text-hh-muted">{strengths.slice(0, 2).map(s => s.text).join(', ')}</span>
                </div>
              )}
              {improvements.length > 0 && (
                <div className="text-[12px]">
                  <span className="font-semibold text-hh-warning">Verbeter:</span>{' '}
                  <span className="text-hh-muted">{improvements.slice(0, 2).map(i => i.text).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
