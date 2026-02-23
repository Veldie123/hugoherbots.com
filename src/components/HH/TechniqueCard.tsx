// TechniqueCard Component - Display EPIC technique details
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { CheckCircle2, Lock, Info } from "lucide-react";
import { Techniek, getFaseNaam } from "../../data/technieken-service";

interface TechniqueCardProps {
  technique: Techniek & { ai_eval_points?: string[] };
  userScore?: number;
  attempts?: number;
  isLocked?: boolean;
  onClick?: () => void;
}

export function TechniqueCard({
  technique,
  userScore,
  attempts = 0,
  isLocked = false,
  onClick,
}: TechniqueCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-hh-success";
    if (score >= 60) return "text-hh-warn";
    return "text-hh-destructive";
  };

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      "1": "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      "2": "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
      "3": "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
      "4": "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      "*": "bg-hh-ui-50 text-hh-muted border-hh-border",
    };
    return colors[phase] || colors["*"];
  };

  return (
    <Card
      onClick={isLocked ? undefined : onClick}
      className={`p-5 rounded-[16px] border-hh-border transition-all ${
        isLocked
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-hh-primary/40 hover:shadow-lg cursor-pointer"
      }`}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] leading-[16px] font-medium text-hh-muted">
                {technique.nummer}
              </span>
              <Badge
                variant="outline"
                className={`text-[11px] border ${getPhaseColor(technique.fase)}`}
              >
                {getFaseNaam(technique.fase)}
              </Badge>
            </div>
            <h3 className="text-hh-text mb-1">{technique.naam}</h3>
          </div>

          {/* Status Icon */}
          <div className="flex-shrink-0">
            {isLocked ? (
              <Lock className="w-5 h-5 text-hh-muted" />
            ) : userScore !== undefined && userScore >= 80 ? (
              <CheckCircle2 className="w-5 h-5 text-hh-success" />
            ) : (
              <Info className="w-5 h-5 text-hh-muted" />
            )}
          </div>
        </div>

        {/* AI Evaluation Points */}
        {technique.ai_eval_points && technique.ai_eval_points.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[12px] leading-[16px] text-hh-muted font-medium">
              AI beoordeelt:
            </h4>
            <ul className="space-y-1">
              {technique.ai_eval_points.map((point: string, idx: number) => (
                <li
                  key={idx}
                  className="text-[13px] leading-[18px] text-hh-text flex items-start gap-2"
                >
                  <span className="text-hh-primary mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* User Stats (if available) */}
        {!isLocked && userScore !== undefined && (
          <div className="flex items-center gap-4 pt-3 border-t border-hh-border">
            <div>
              <div className="text-[11px] leading-[14px] text-hh-muted mb-1">
                Score
              </div>
              <div
                className={`text-[18px] leading-[24px] font-semibold ${getScoreColor(
                  userScore
                )}`}
              >
                {userScore}%
              </div>
            </div>
            <div className="h-8 w-px bg-hh-border" />
            <div>
              <div className="text-[11px] leading-[14px] text-hh-muted mb-1">
                Pogingen
              </div>
              <div className="text-[18px] leading-[24px] font-semibold text-hh-text">
                {attempts}
              </div>
            </div>
          </div>
        )}

        {/* Locked State */}
        {isLocked && (
          <div className="pt-3 border-t border-hh-border">
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Ontgrendel door vorige technieken te voltooien
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
