import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Flame, TrendingUp, Calendar } from "lucide-react";

interface StreakCardProps {
  currentStreak: number; // Days in a row
  longestStreak: number;
  improvementRate: number; // Daily improvement percentage (e.g., 1.14 for 1.14%)
}

export function StreakCard({ 
  currentStreak, 
  longestStreak,
  improvementRate 
}: StreakCardProps) {
  // Calculate projected improvement after 1 year
  const yearlyMultiplier = Math.pow(1 + (improvementRate / 100), 365);
  const baselineMultiplier = Math.pow(1.01, 365); // 1% baseline = 37.78x
  
  // Last 14 days activity (mock - would come from real data)
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const dayIndex = 13 - i;
    return dayIndex < currentStreak; // True if within current streak
  }).reverse();

  return (
    <Card className="p-6 rounded-[16px] shadow-hh-md border-hh-border bg-gradient-to-br from-hh-success/5 via-hh-primary/5 to-transparent overflow-hidden relative">
      {/* Decorative flame icon background */}
      <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none">
        <Flame className="w-64 h-64 text-hh-success" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-hh-success" />
              <h3 className="text-hh-text">Jouw streak</h3>
            </div>
            <p className="text-hh-muted text-[14px] leading-[20px]">
              Elke dag telt — groei is exponentieel
            </p>
          </div>
          <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 gap-1">
            <TrendingUp className="w-3 h-3" />
            {improvementRate.toFixed(1)}% per dag
          </Badge>
        </div>

        {/* Main Content - Two Columns */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Streak Counter & Calendar */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[48px] leading-[56px] text-hh-success">
                  {currentStreak}
                </span>
                <span className="text-hh-muted text-[16px] leading-[24px]">
                  dagen op rij
                </span>
              </div>
              <p className="text-hh-muted text-[14px] leading-[20px]">
                Langste: <strong className="text-hh-text">{longestStreak} dagen</strong>
              </p>
            </div>

            {/* Mini Calendar - Last 14 days */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-hh-muted text-[12px] leading-[16px]">
                <Calendar className="w-3 h-3" />
                <span>Laatste 14 dagen</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {last14Days.map((isActive, index) => (
                  <div
                    key={index}
                    className={`aspect-square rounded-md transition-colors ${
                      isActive
                        ? "bg-hh-success border border-hh-success/20"
                        : "bg-hh-ui-100 border border-hh-ui-200"
                    }`}
                    title={isActive ? "Getraind" : "Geen sessie"}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Projection */}
          <div className="space-y-4 md:border-l md:border-hh-border md:pl-6">
            <div className="space-y-1">
              <p className="text-hh-muted text-[14px] leading-[20px]">
                Projectie over 1 jaar
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] leading-[48px] text-hh-primary">
                  {yearlyMultiplier.toFixed(0)}x
                </span>
                <span className="text-hh-muted text-[16px] leading-[24px]">
                  beter
                </span>
              </div>
            </div>

            {/* Comparison to baseline */}
            <div className="p-3 rounded-lg bg-hh-ui-50 border border-hh-ui-200 space-y-2">
              <div className="flex items-center justify-between text-[14px] leading-[20px]">
                <span className="text-hh-muted">Jouw tempo:</span>
                <strong className="text-hh-success">
                  {improvementRate.toFixed(1)}% / dag
                </strong>
              </div>
              <div className="flex items-center justify-between text-[14px] leading-[20px]">
                <span className="text-hh-muted">Baseline (1%):</span>
                <span className="text-hh-text">
                  {baselineMultiplier.toFixed(0)}x beter
                </span>
              </div>
              <div className="h-px bg-hh-border my-2" />
              <div className="flex items-center justify-between text-[14px] leading-[20px]">
                <span className="text-hh-text">Jouw projectie:</span>
                <strong className="text-hh-primary">
                  {yearlyMultiplier.toFixed(0)}x beter
                </strong>
              </div>
            </div>

            {/* Hugo's quote */}
            <div className="pt-2">
              <p className="text-hh-muted text-[14px] leading-[20px] italic">
                "1% beter elke dag is geen gimmick. Het is wiskunde. En wiskunde liegt niet."
              </p>
              <p className="text-hh-text text-[12px] leading-[16px] mt-1">
                — Hugo
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
