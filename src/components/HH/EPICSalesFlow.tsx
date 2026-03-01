import { Check, Lock, ChevronDown, ChevronRight, Clock, Circle, CheckCircle2, Play } from "lucide-react";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { cn } from "../ui/utils";
import { useState, useEffect } from "react";
import { getTechniqueByNumber } from "../../data/epicTechniques";
import { videoApi } from "../../services/videoApi";

type TechniqueVideo = {
  id: string;
  title: string;
  mux_playback_id: string | null;
  duration: number | null;
  source: 'pipeline' | 'manual';
};

interface FlowStep {
  id: string;
  name: string;
  status: "completed" | "current" | "upcoming" | "locked";
  duration?: string;
  nummer?: string;
  isVerplicht?: boolean;
}

interface FlowPhase {
  id: number;
  name: string;
  color: string;
  steps: FlowStep[];
  themas?: string[];
  uitleg?: string;
}

interface EPICSalesFlowProps {
  phases?: FlowPhase[];
  currentPhaseId?: number;
  currentStepId?: string;
  compact?: boolean;
  currentPhase?: string;
  currentStep?: string;
  onClose?: () => void;
}

const getTechniqueDetails = (nummer: string): { wat: string; wanneer?: string; doel?: string } | undefined => {
  const technique = getTechniqueByNumber(nummer);
  if (!technique) return undefined;
  return {
    wat: technique.wat || '',
    wanneer: technique.wanneer,
    doel: technique.doel || technique.waarom
  };
};

export function EPICSalesFlow(props: EPICSalesFlowProps) {
  // Provide default mock data for backward compatibility
  const defaultPhases: FlowPhase[] = [
    {
      id: 1,
      name: "Openingsfase",
      color: "blue",
      steps: [
        { id: "1.1", name: "Rapport bouwen", status: "completed", nummer: "1.1", duration: "2-3 min" },
        { id: "1.2", name: "Agenda delen", status: "completed", nummer: "1.2" },
        { id: "1.3", name: "Bedrijfsintro", status: "current", nummer: "1.3" },
        { id: "1.4", name: "Open vraag stellen", status: "upcoming", nummer: "1.4" },
      ],
    },
    {
      id: 2,
      name: "Ontdekkingsfase",
      color: "green",
      steps: [
        { id: "2.1.1", name: "SPIN - Situation", status: "upcoming", nummer: "2.1.1" },
        { id: "2.1.2", name: "SPIN - Problem", status: "upcoming", nummer: "2.1.2" },
        { id: "2.1.3", name: "SPIN - Implication", status: "upcoming", nummer: "2.1.3" },
        { id: "2.1.4", name: "SPIN - Need-payoff", status: "locked", nummer: "2.1.4" },
      ],
    },
    {
      id: 3,
      name: "Aanbevelingsfase",
      color: "purple",
      steps: [
        { id: "3.1", name: "Erkennen behoefte", status: "locked", nummer: "3.1" },
        { id: "3.2", name: "USP presenteren", status: "locked", nummer: "3.2" },
        { id: "3.3", name: "Voordelen uitleggen", status: "locked", nummer: "3.3" },
      ],
    },
    {
      id: 4,
      name: "Beslissingsfase",
      color: "red",
      steps: [
        { id: "4.1", name: "Trial close", status: "locked", nummer: "4.1" },
        { id: "4.2.1", name: "Bezwaarhandeling", status: "locked", nummer: "4.2.1" },
        { id: "4.2.2", name: "Closing", status: "locked", nummer: "4.2.2" },
      ],
    },
  ];

  const {
    phases = defaultPhases,
    currentPhaseId = 1,
    currentStepId = "1.3",
    compact = false,
  } = props;

  const [expandedPhases, setExpandedPhases] = useState<number[]>([currentPhaseId]);
  const [expandedTechniques, setExpandedTechniques] = useState<string[]>([]);
  const [techniqueVideos, setTechniqueVideos] = useState<Record<string, TechniqueVideo[]>>({});

  useEffect(() => {
    async function loadVideosByTechnique() {
      try {
        const library = await videoApi.getLibrary('completed');
        const videosByTechnique: Record<string, TechniqueVideo[]> = {};
        
        library.forEach(video => {
          if (video.technique_id && video.mux_playback_id) {
            if (!videosByTechnique[video.technique_id]) {
              videosByTechnique[video.technique_id] = [];
            }
            videosByTechnique[video.technique_id].push({
              id: video.id,
              title: video.title,
              mux_playback_id: video.mux_playback_id,
              duration: video.duration,
              source: video.source
            });
          }
        });
        
        setTechniqueVideos(videosByTechnique);
      } catch (err) {
        console.error('Failed to load technique videos:', err);
      }
    }
    loadVideosByTechnique();
  }, []);

  const togglePhase = (phaseId: number) => {
    setExpandedPhases(prev =>
      prev.includes(phaseId) ? prev.filter(id => id !== phaseId) : [...prev, phaseId]
    );
  };

  const toggleTechnique = (stepId: string) => {
    setExpandedTechniques(prev =>
      prev.includes(stepId) ? prev.filter(id => id !== stepId) : [...prev, stepId]
    );
  };

  const calculateProgress = (phase: FlowPhase) => {
    const completed = phase.steps.filter((s) => s.status === "completed").length;
    return Math.round((completed / phase.steps.length) * 100);
  };

  // Calculate completion stats
  const totalSteps = phases.flatMap(p => p.steps).length;
  const completedSteps = phases.flatMap(p => p.steps).filter(s => s.status === "completed").length;
  const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="h-full flex flex-col bg-hh-ui-50 border-l border-hh-border">
      {/* Header - Exact copy from RolePlayChat */}
      <div className="p-4 border-b border-hh-border bg-hh-bg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
            <Circle className="w-5 h-5 text-hh-primary" />
          </div>
          <div>
            <h2 className="text-[18px] leading-[26px] text-hh-text">E.P.I.C. TECHNIQUE</h2>
            <p className="text-[12px] leading-[16px] text-hh-muted">
              {completedSteps} / {totalSteps} voltooid
            </p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[12px] leading-[16px] mb-1">
            <span className="text-hh-muted">Totale voortgang</span>
            <span className="text-hh-text">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>
      </div>

      {/* Flow Phases - Exact copy from RolePlayChat */}
      <div className="flex-1 overflow-y-auto">
        {phases.map((phase) => {
          const isCurrentPhase = phase.id === currentPhaseId;
          const progress = calculateProgress(phase);
          const isCompletedPhase = progress === 100;
          const isUpcomingPhase = phase.id > currentPhaseId;
          const isExpanded = expandedPhases.includes(phase.id);
          const completedInPhase = phase.steps.filter(s => s.status === "completed").length;

          return (
            <div key={phase.id} className="border-b border-hh-border">
              {/* Phase Header - Exact styling from RolePlayChat */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full p-4 hover:bg-hh-bg transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      progress === 100 && "bg-green-500/10",
                      progress < 100 && phase.id === currentPhaseId && "bg-cyan-600/10",
                      progress < 100 && phase.id !== currentPhaseId && "bg-gray-300/30"
                    )}
                  >
                    {progress === 100 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : phase.id === currentPhaseId ? (
                      <span className="text-[14px] text-cyan-600 font-medium">
                        {phase.id}
                      </span>
                    ) : (
                      <span className="text-[14px] text-gray-400">
                        {phase.id}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[14px] leading-[20px] text-hh-text truncate">
                        {phase.name}
                      </p>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] leading-[16px] text-hh-muted">
                      <span>
                        {completedInPhase}/{phase.steps.length}
                      </span>
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full",
                            progress === 100 && "bg-green-500",
                            progress > 0 && progress < 100 && phase.id === currentPhaseId && "bg-cyan-600",
                            progress > 0 && progress < 100 && phase.id !== currentPhaseId && "bg-gray-300"
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {/* Phase Content - Expandable */}
              {isExpanded && (
                <div className="bg-hh-bg">
                  {/* Phase explanation */}
                  {phase.uitleg && (
                    <div className="px-4 py-2 bg-hh-ui-50/30 border-y border-hh-border">
                      <p className="text-[11px] leading-[16px] text-hh-muted italic">
                        {phase.uitleg}
                      </p>
                    </div>
                  )}

                  {/* Thema's om te bespreken - Now formatted as clickable row like techniques */}
                  {phase.themas && phase.themas.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleTechnique(`themas-${phase.id}`)}
                        className="w-full p-3 pl-4 text-left transition-colors hover:bg-hh-ui-50"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-[13px] leading-[18px] text-hh-text">
                                  Thema's om te bespreken
                                </p>
                              </div>
                              {expandedTechniques.includes(`themas-${phase.id}`) ? (
                                <ChevronDown className="w-3 h-3 text-hh-muted flex-shrink-0 mt-0.5" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-hh-muted flex-shrink-0 mt-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded themas - as sub-items like technique details */}
                      {expandedTechniques.includes(`themas-${phase.id}`) && (
                        <div className="px-4 py-3 pl-10 bg-hh-ui-50/30 border-l border-hh-border ml-2">
                          <div className="space-y-2 text-[12px] leading-[17px]">
                            {phase.themas.map((thema) => (
                              <div key={thema}>
                                <span className="text-hh-text font-medium">{thema}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Techniques list - Exact styling from RolePlayChat */}
                  <div>
                    {phase.steps.map((step) => {
                      const isCurrent = step.id === currentStepId;
                      const isCompleted = step.status === "completed";
                      const isLocked = step.status === "locked";
                      const isExpanded = expandedTechniques.includes(step.id);
                      const details = step.nummer ? getTechniqueDetails(step.nummer) : null;
                      const hasDetails = details && (details.wat || details.wanneer || details.doel);

                      return (
                        <div key={step.id}>
                          {/* Technique row - Reduced padding from pl-16 to pl-4 */}
                          <button
                            onClick={() => hasDetails && !isLocked && toggleTechnique(step.id)}
                            disabled={isLocked}
                            className={cn(
                              "w-full p-3 pl-4 text-left transition-colors",
                              step.id === currentStepId && "bg-cyan-600/5 border-l-2 border-cyan-600 pl-[14px]",
                              step.id !== currentStepId && step.status === "locked" && "opacity-60 cursor-not-allowed",
                              step.id !== currentStepId && step.status !== "locked" && hasDetails && "hover:bg-hh-ui-50"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-shrink-0 mt-0.5">
                                {step.status === "completed" ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : step.status === "current" ? (
                                  <Circle className="w-4 h-4 text-cyan-600 fill-cyan-600" />
                                ) : step.status === "locked" ? (
                                  <Lock className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-400" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className={`text-[13px] leading-[18px] truncate ${
                                      step.id === currentStepId ? "text-hh-text font-medium" : "text-hh-text"
                                    }`}>
                                      {step.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {step.nummer && (
                                        <span className="inline-flex items-center justify-center bg-teal-100 text-teal-600 text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                                          {step.nummer}
                                        </span>
                                      )}
                                      {step.duration && (
                                        <>
                                          <span className="text-[11px] leading-[14px] text-hh-muted">•</span>
                                          <div className="flex items-center gap-1 text-[11px] leading-[14px] text-hh-muted">
                                            <Clock className="w-3 h-3" />
                                            {step.duration}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Expand chevron if details available */}
                                  {hasDetails && !isLocked && (
                                    <div className="flex-shrink-0">
                                      {isExpanded ? (
                                        <ChevronDown className="w-3 h-3 text-hh-muted" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-hh-muted" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Technique Details - Third Level - Reduced indentation */}
                          {isExpanded && details && (
                            <div className="px-4 py-3 pl-10 bg-hh-ui-50/30 border-l border-hh-border ml-2">
                              <div className="space-y-2 text-[12px] leading-[17px]">
                                {details.wat && (
                                  <div>
                                    <span className="text-hh-text font-medium">Wat: </span>
                                    <span className="text-hh-muted">{details.wat}</span>
                                  </div>
                                )}
                                {details.wanneer && (
                                  <div>
                                    <span className="text-hh-text font-medium">Wanneer: </span>
                                    <span className="text-hh-muted">{details.wanneer}</span>
                                  </div>
                                )}
                                {details.doel && (
                                  <div>
                                    <span className="text-hh-text font-medium">Doel: </span>
                                    <span className="text-hh-muted">{details.doel}</span>
                                  </div>
                                )}

                                {/* Video's gekoppeld aan deze techniek */}
                                {step.nummer && techniqueVideos[step.nummer] && techniqueVideos[step.nummer].length > 0 && (
                                  <div className="pt-2 mt-2 border-t border-hh-border">
                                    <span className="text-hh-text font-medium flex items-center gap-1">
                                      <Play className="w-3 h-3" /> Video's:
                                    </span>
                                    <div className="mt-1 space-y-1">
                                      {techniqueVideos[step.nummer].map(video => (
                                        <a
                                          key={video.id}
                                          href={`/video/${video.id}`}
                                          className="flex items-center gap-2 p-1.5 rounded hover:bg-hh-primary/10 transition-colors group"
                                        >
                                          <div className="w-5 h-5 rounded bg-hh-primary/20 flex items-center justify-center flex-shrink-0">
                                            <Play className="w-2.5 h-2.5 text-hh-primary" />
                                          </div>
                                          <span className="text-hh-text group-hover:text-hh-primary truncate flex-1">
                                            Bekijk video
                                          </span>
                                          {video.duration && (
                                            <span className="text-[10px] text-hh-muted flex-shrink-0">
                                              {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
                                            </span>
                                          )}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}