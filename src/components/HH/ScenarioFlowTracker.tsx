import { Check, Circle, Lock, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { useState } from "react";

interface Techniek {
  naam: string;
  verplicht_volgnummer?: number;
}

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

interface ScenarioFlowTrackerProps {
  phases: FlowPhase[];
  currentPhaseId: number;
  currentStepId: string;
  compact?: boolean;
}

// Technique details from JSON
const TECHNIQUE_DETAILS: Record<string, {
  wat: string;
  wanneer?: string;
  doel?: string;
}> = {
  "1.1": {
    wat: "Gedrag/onderwerp afstemmen op klant om vertrouwen te winnen (gunfactor).",
    wanneer: "start gesprek"
  },
  "1.2": {
    wat: "Agenda en akkoord vragen om gespreksleiding te nemen.",
    wanneer: "na 1.1"
  },
  "1.3": {
    wat: "Kort bedrijf + herkenbare referentie.",
    wanneer: "na 1.2"
  },
  "1.4": {
    wat: "Open vraag om klant aan het praten te krijgen.",
    wanneer: "na 1.3"
  },
  "2.1.1": {
    wat: "Vraag naar feiten/cijfers/details.",
    doel: "voordeel en onderliggende baat detecteren (stap 1: feit)"
  },
  "2.1.2": {
    wat: "Open vragen naar mening/motivatie.",
    doel: "reden/waarde kaderen (stap 2: mening)"
  },
  "2.1.3": {
    wat: "Kiesvraag om standpunt te forceren.",
    doel: "twijfel scherpstellen"
  },
  "2.1.4": {
    wat: "Premature nadelen parkeren, vriendelijk erkennen.",
    doel: "regie houden"
  },
  "2.1.5": {
    wat: "Korte verduidelijkende doorvraag.",
    doel: "diepte"
  },
  "2.1.6": {
    wat: "Samenvatten/empathie tonen.",
    doel: "vertrouwen"
  },
  "2.1.7": {
    wat: "Korte hypothetische spiegel via verhaal.",
    doel: "inzicht zonder discussie"
  },
  "2.1.8": {
    wat: "Bevestigen wat klant belangrijk vindt.",
    doel: "groen licht voor fase 3"
  },
  "3.1": {
    wat: "Erken belang klant kort."
  },
  "3.2": {
    wat: "USP noemen die past bij gelockte wens."
  },
  "3.3": {
    wat: "Algemeen voordeel uitleggen."
  },
  "3.4": {
    wat: "Persoonlijke impact voor klant concreet maken."
  },
  "3.5": {
    wat: "Peilen naar draagvlak."
  },
  "4.1": {
    wat: "Zachte test op bereidheid."
  },
  "4.2.1": {
    wat: "Antwoord → Mening/Lock → Proefafsluiting."
  },
  "4.2.2": {
    wat: "Ask → Lock → Bewijs → Afsluiten."
  },
  "4.2.3": {
    wat: "Empathie → Ask → Lock → Actieplan."
  },
  "4.2.4": {
    wat: "Analyseren → Isoleren → Neutraliseren → Keuze → Afsluiten."
  },
  "4.2.5": {
    wat: "Empathie → Oplossen → Helpen beslissen → Proefafsluiting."
  }
};

export function ScenarioFlowTracker({
  phases,
  currentPhaseId,
  currentStepId,
  compact = false,
}: ScenarioFlowTrackerProps) {
  const [expandedPhases, setExpandedPhases] = useState<number[]>([currentPhaseId]);
  const [expandedTechniques, setExpandedTechniques] = useState<string[]>([]);

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

  // Calculate completion stats
  const totalSteps = phases.flatMap(p => p.steps).length;
  const completedSteps = phases.flatMap(p => p.steps).filter(s => s.status === "completed").length;
  const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="h-full flex flex-col bg-hh-bg border-l border-hh-border">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-hh-border bg-hh-ui-50/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-hh-primary/10 flex items-center justify-center">
            <Circle className="w-5 h-5 text-hh-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-[16px] leading-[24px] text-hh-text">
              E.P.I.C sales flow
            </h3>
            <p className="text-[12px] leading-[18px] text-hh-muted">
              {completedSteps} / {totalSteps} voltooid
            </p>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] leading-[16px]">
            <span className="text-hh-muted">Totale voortgang</span>
            <span className="text-hh-text">{completionPercentage}%</span>
          </div>
          <div className="h-2 bg-hh-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-hh-primary to-hh-success transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Flow Phases */}
      <div className="flex-1 overflow-auto">
        {phases.map((phase, phaseIdx) => {
          const isCurrentPhase = phase.id === currentPhaseId;
          const isCompletedPhase = phase.steps.every((s) => s.status === "completed");
          const isUpcomingPhase = phase.id > currentPhaseId;
          const isExpanded = expandedPhases.includes(phase.id);
          const completedInPhase = phase.steps.filter(s => s.status === "completed").length;

          return (
            <div key={phase.id} className="border-b border-hh-border">
              {/* Phase Header - Clickable */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full px-4 py-3 text-left hover:bg-hh-ui-50/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Phase Number/Status Icon */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all",
                      isCurrentPhase &&
                        "bg-hh-primary border-hh-primary",
                      isCompletedPhase &&
                        !isCurrentPhase &&
                        "bg-hh-success border-hh-success",
                      isUpcomingPhase &&
                        "bg-transparent border-hh-border"
                    )}
                  >
                    {isCompletedPhase && !isCurrentPhase ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : isUpcomingPhase ? (
                      <Lock className="w-3 h-3 text-hh-muted" />
                    ) : (
                      <span
                        className={cn(
                          "text-[14px] leading-[20px]",
                          isCurrentPhase ? "text-white" : "text-hh-muted"
                        )}
                      >
                        {phase.id}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4
                        className={cn(
                          "text-[14px] leading-[20px]",
                          isCurrentPhase
                            ? "text-hh-text"
                            : isCompletedPhase
                            ? "text-hh-success"
                            : "text-hh-muted"
                        )}
                      >
                        {phase.name}
                      </h4>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      )}
                    </div>

                    {/* Progress indicator for this phase */}
                    <div className="flex items-center gap-2 text-[12px] leading-[16px] text-hh-muted">
                      <span>{completedInPhase}/{phase.steps.length}</span>
                      <div className="flex-1 h-1 bg-hh-ui-100 rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className={cn(
                            "h-full transition-all",
                            isCompletedPhase ? "bg-hh-success" : "bg-hh-primary"
                          )}
                          style={{ width: `${(completedInPhase / phase.steps.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {/* Phase Content - Expandable */}
              {isExpanded && (
                <div className="bg-white">
                  {/* Phase explanation */}
                  {phase.uitleg && (
                    <div className="px-4 py-2 bg-hh-ui-50/30 border-y border-hh-border">
                      <p className="text-[11px] leading-[16px] text-hh-muted italic">
                        {phase.uitleg}
                      </p>
                    </div>
                  )}

                  {/* Techniques list */}
                  <div>
                    {phase.steps.map((step, stepIdx) => {
                      const isCurrent = step.id === currentStepId;
                      const isCompleted = step.status === "completed";
                      const isLocked = step.status === "locked";
                      const isExpanded = expandedTechniques.includes(step.id);
                      const details = step.nummer ? TECHNIQUE_DETAILS[step.nummer] : null;
                      const hasDetails = details && (details.wat || details.wanneer || details.doel);

                      return (
                        <div key={step.id}>
                          {/* Technique row */}
                          <button
                            onClick={() => hasDetails && toggleTechnique(step.id)}
                            disabled={isLocked}
                            className={cn(
                              "w-full px-4 py-3 pl-16 text-left transition-colors",
                              isCurrent && "bg-hh-primary/5 border-l-2 border-hh-primary pl-[62px]",
                              !isCurrent && !isLocked && hasDetails && "hover:bg-hh-ui-50",
                              isLocked && "opacity-60 cursor-not-allowed",
                              !isCurrent && "border-l-2 border-transparent"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {/* Status icon */}
                              <div className="flex-shrink-0 mt-0.5">
                                {isCompleted ? (
                                  <Check className="w-4 h-4 text-hh-success" />
                                ) : isLocked ? (
                                  <Lock className="w-4 h-4 text-hh-muted" />
                                ) : (
                                  <Circle className="w-4 h-4 text-hh-primary" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p
                                      className={cn(
                                        "text-[13px] leading-[18px]",
                                        isCurrent
                                          ? "text-hh-text"
                                          : isCompleted
                                          ? "text-hh-muted"
                                          : isLocked
                                          ? "text-hh-muted/50"
                                          : "text-hh-text"
                                      )}
                                    >
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
                                          <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-hh-muted" />
                                            <span className="text-[11px] leading-[14px] text-hh-muted">
                                              {step.duration}
                                            </span>
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

                          {/* Technique Details - Third Level */}
                          {isExpanded && details && (
                            <div className="px-4 py-3 pl-16 ml-6 bg-hh-ui-50/30 border-l border-hh-border">
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
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Thema's section - Only for phase 2 */}
                  {phase.id === 2 && phase.themas && phase.themas.length > 0 && (
                    <div className="px-4 py-3 bg-hh-ui-50/50 border-t border-hh-border">
                      <p className="text-[11px] leading-[16px] text-hh-muted mb-2">
                        Thema's om te bespreken:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.themas.map((thema, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-[11px] px-2 py-0.5 h-6 bg-white border-hh-border text-hh-text"
                          >
                            {thema}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
