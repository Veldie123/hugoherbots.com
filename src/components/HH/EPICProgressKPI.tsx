import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

interface PhaseProgress {
  phaseNumber: number;
  phaseName: string;
  completion: number; // 0-100%
  videosWatched: number; // How many videos watched
  totalVideos: number; // Total videos in this phase
  liveSessions: number; // Number of live sessions attended for this phase
  analyses: number; // Number of chat/upload/live analyses for this phase
  aiChats: number; // Number of AI chat conversations for this phase
  trend: "up" | "down" | "neutral";
}

interface EPICProgressKPIProps {
  phases: PhaseProgress[];
  className?: string;
}

export function EPICProgressKPI({ phases, className = "" }: EPICProgressKPIProps) {
  // Calculate overall progress
  const overallProgress = Math.round(
    phases.reduce((sum, phase) => sum + phase.completion, 0) / phases.length
  );
  
  // Calculate total stats
  const totalVideos = phases.reduce((sum, p) => sum + p.videosWatched, 0);
  const totalLive = phases.reduce((sum, p) => sum + p.liveSessions, 0);
  const totalAnalyses = phases.reduce((sum, p) => sum + p.analyses, 0);
  const totalChats = phases.reduce((sum, p) => sum + p.aiChats, 0);

  return (
    <Card className={`p-4 rounded-[16px] shadow-hh-sm border-hh-border ${className}`}>
      <div className="flex items-center gap-6">
        {/* Left: Title */}
        <div className="flex-shrink-0">
          <h3 className="text-[14px] leading-[20px] text-hh-text font-medium whitespace-nowrap">
            E.P.I.C. Sales Flow
          </h3>
          <div className="text-[11px] text-hh-muted mt-0.5">
            {overallProgress}% voltooid
          </div>
        </div>

        {/* Center: Segmented Progress Bar */}
        <div className="flex-1">
          <div className="flex items-center gap-1">
            {phases.map((phase) => {
              const isCompleted = phase.completion === 100;
              const isCurrent = phase.completion > 0 && phase.completion < 100;
              const isUpcoming = phase.completion === 0;
              
              return (
                <div key={phase.phaseNumber} className="flex-1 group relative">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isCompleted ? "bg-green-500" : ""
                    } ${isCurrent ? "bg-[#9333ea]" : ""} ${
                      isUpcoming ? "bg-hh-slate-200" : ""
                    }`}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-hh-text text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                      {phase.phaseName}: {phase.completion}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Phase labels */}
          <div className="flex items-center gap-1 mt-1.5">
            {phases.map((phase) => (
              <div key={phase.phaseNumber} className="flex-1 text-center">
                <span className="text-[9px] text-hh-muted">
                  {phase.phaseNumber === -1 ? "Voorb" : phase.phaseNumber === 1 ? "Open" : phase.phaseNumber === 2 ? "Ontd" : phase.phaseNumber === 3 ? "Voor" : "Afsl"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Compact Stats */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center">
            <div className="text-[16px] leading-[20px] font-bold text-hh-text">{totalVideos}</div>
            <div className="text-[9px] text-hh-muted">video's</div>
          </div>
          <div className="w-px h-8 bg-hh-border" />
          <div className="text-center">
            <div className="text-[16px] leading-[20px] font-bold text-hh-text">{totalLive}</div>
            <div className="text-[9px] text-hh-muted">live</div>
          </div>
          <div className="w-px h-8 bg-hh-border" />
          <div className="text-center">
            <div className="text-[16px] leading-[20px] font-bold text-hh-text">{totalAnalyses}</div>
            <div className="text-[9px] text-hh-muted">analyses</div>
          </div>
          <div className="w-px h-8 bg-hh-border" />
          <div className="text-center">
            <div className="text-[16px] leading-[20px] font-bold text-hh-text">{totalChats}</div>
            <div className="text-[9px] text-hh-muted">chats</div>
          </div>
        </div>
      </div>
    </Card>
  );
}