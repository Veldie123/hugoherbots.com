import { Check, Circle, Lock, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "./ui/badge";

interface Step {
  id: string;
  name: string;
  status: "completed" | "current" | "upcoming" | "locked";
  duration: string;
  nummer: string;
  isVerplicht?: boolean;
}

interface Phase {
  id: number;
  name: string;
  color: string;
  themas: string[];
  uitleg: string;
  steps: Step[];
}

interface EPICSalesFlowProps {
  phases?: Phase[];
  currentPhaseId?: number;
  currentStepId?: string;
}

const defaultPhases: Phase[] = [
  {
    id: 1,
    name: "Openingsfase",
    color: "#6B7A92",
    themas: [],
    uitleg: "Volg deze volgorde, tenzij klant spontaan een stap aanbrengt.",
    steps: [
      { id: "1.1", name: "Koopklimaat creëren", status: "completed", duration: "2 min", nummer: "1.1", isVerplicht: true },
      { id: "1.2", name: "Gentleman's agreement", status: "completed", duration: "1 min", nummer: "1.2", isVerplicht: true },
      { id: "1.3", name: "Firmavoorstelling + reference story", status: "completed", duration: "2 min", nummer: "1.3", isVerplicht: true },
      { id: "1.4", name: "Instapvraag", status: "completed", duration: "1 min", nummer: "1.4", isVerplicht: true },
    ],
  },
  {
    id: 2,
    name: "Ontdekkingsfase",
    color: "#6B7A92",
    themas: ["Bron", "Motivatie", "Ervaring", "Verwachtingen", "Alternatieven", "Budget", "Timing", "Beslissingscriteria"],
    uitleg: "Systematisch alle klantnoden, wensen en bezwaren in kaart brengen.",
    steps: [
      { id: "2.1.1", name: "Feitgerichte vragen", status: "completed", duration: "3 min", nummer: "2.1.1" },
      { id: "2.1.2", name: "Meningsgerichte vragen (open vragen)", status: "completed", duration: "3 min", nummer: "2.1.2" },
      { id: "2.1.3", name: "Feitgerichte vragen onder alternatieve vorm", status: "current", duration: "2 min", nummer: "2.1.3" },
      { id: "2.1.4", name: "Ter zijde schuiven", status: "upcoming", duration: "2 min", nummer: "2.1.4" },
      { id: "2.1.5", name: "Pingpong techniek", status: "upcoming", duration: "2 min", nummer: "2.1.5" },
      { id: "2.1.6", name: "Actief en empathisch luisteren", status: "upcoming", duration: "3 min", nummer: "2.1.6" },
      { id: "2.1.7", name: "LEAD questioning (storytelling)", status: "upcoming", duration: "4 min", nummer: "2.1.7" },
      { id: "2.1.8", name: "Lock questioning", status: "upcoming", duration: "2 min", nummer: "2.1.8" },
    ],
  },
  {
    id: 3,
    name: "Aanbevelingsfase",
    color: "#6B7A92",
    themas: ["USP's"],
    uitleg: "Verbind wat je geleerd hebt aan jouw oplossing en USP's.",
    steps: [
      { id: "3.1", name: "Empathie tonen", status: "upcoming", duration: "2 min", nummer: "3.1" },
      { id: "3.2", name: "Oplossing", status: "upcoming", duration: "3 min", nummer: "3.2" },
      { id: "3.3", name: "Voordeel", status: "upcoming", duration: "2 min", nummer: "3.3" },
      { id: "3.4", name: "Baat", status: "upcoming", duration: "2 min", nummer: "3.4" },
      { id: "3.5", name: "Mening vragen / standpunt onder alternatieve vorm", status: "upcoming", duration: "2 min", nummer: "3.5" },
    ],
  },
  {
    id: 4,
    name: "Beslissingsfase",
    color: "#6B7A92",
    themas: ["beslissing"],
    uitleg: "Stuur richting een definitieve beslissing.",
    steps: [
      { id: "4.1", name: "Proefafsluiting", status: "locked", duration: "2 min", nummer: "4.1" },
      { id: "4.2.1", name: "Klant stelt vragen", status: "locked", duration: "3 min", nummer: "4.2.1" },
      { id: "4.2.2", name: "Twijfels", status: "locked", duration: "3 min", nummer: "4.2.2" },
      { id: "4.2.3", name: "Poging tot uitstel", status: "locked", duration: "2 min", nummer: "4.2.3" },
      { id: "4.2.4", name: "Bezwaren", status: "locked", duration: "4 min", nummer: "4.2.4" },
      { id: "4.2.5", name: "Angst / Bezorgdheden", status: "locked", duration: "3 min", nummer: "4.2.5" },
    ],
  },
];

export function EPICSalesFlow({ phases = defaultPhases, currentPhaseId = 2, currentStepId = "2.1.3" }: EPICSalesFlowProps) {
  const [expandedPhases, setExpandedPhases] = useState<number[]>([currentPhaseId]);

  const togglePhase = (phaseId: number) => {
    setExpandedPhases((prev) =>
      prev.includes(phaseId)
        ? prev.filter((id) => id !== phaseId)
        : [...prev, phaseId]
    );
  };

  const calculateProgress = () => {
    const allSteps = phases.flatMap((p) => p.steps);
    const completedSteps = allSteps.filter((s) => s.status === "completed");
    return Math.round((completedSteps.length / allSteps.length) * 100);
  };

  const getStepIcon = (step: Step) => {
    switch (step.status) {
      case "completed":
        return <Check className="w-4 h-4 text-hh-success" />;
      case "current":
        return <Circle className="w-4 h-4 text-hh-primary fill-current" />;
      case "upcoming":
        return <Circle className="w-4 h-4 text-hh-border" />;
      case "locked":
        return <Lock className="w-4 h-4 text-hh-muted/50" />;
      default:
        return null;
    }
  };

  const getStepClassName = (step: Step) => {
    const baseClasses = "flex items-start gap-3 p-3 rounded-lg transition-all";
    
    switch (step.status) {
      case "completed":
        return `${baseClasses} hover:bg-hh-ui-50`;
      case "current":
        return `${baseClasses} bg-hh-primary/10 border-l-2 border-hh-primary animate-pulse`;
      case "upcoming":
        return `${baseClasses} hover:bg-hh-ui-50`;
      case "locked":
        return `${baseClasses} bg-hh-ui-50 opacity-60 cursor-not-allowed`;
      default:
        return baseClasses;
    }
  };

  const progress = calculateProgress();

  return (
    <div className="h-full flex flex-col bg-white border-l border-hh-border">
      {/* Header */}
      <div className="p-4 border-b border-hh-border flex-shrink-0">
        <h3 className="text-[18px] leading-[24px] text-hh-text mb-2">
          Scenario Flow
        </h3>
        <div className="flex items-center justify-between text-[12px] leading-[16px]">
          <span className="text-hh-muted">Voortgang</span>
          <span className="text-hh-primary font-medium">{progress}% voltooid</span>
        </div>
      </div>

      {/* Phases & Steps */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {phases.map((phase) => {
          const isExpanded = expandedPhases.includes(phase.id);
          const isCurrentPhase = phase.id === currentPhaseId;

          return (
            <div key={phase.id} className="space-y-2">
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-hh-primary/10 hover:bg-hh-primary/20 transition-all"
              >
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] leading-[20px] text-hh-text font-medium">
                      {phase.name}
                    </span>
                    {isCurrentPhase && (
                      <Badge className="bg-hh-primary text-white border-0 text-[10px] px-2 py-0">
                        ACTIEF
                      </Badge>
                    )}
                  </div>
                  {phase.themas.length > 0 && (
                    <p className="text-[11px] leading-[14px] text-hh-muted">
                      {phase.themas.slice(0, 3).join(" • ")}
                      {phase.themas.length > 3 && ` +${phase.themas.length - 3}`}
                    </p>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-hh-muted flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-hh-muted flex-shrink-0" />
                )}
              </button>

              {/* Steps */}
              {isExpanded && (
                <div className="space-y-1 pl-2">
                  {phase.steps.map((step) => {
                    const isCurrent = step.id === currentStepId;

                    return (
                      <div key={step.id} className={getStepClassName(step)}>
                        <div className="flex-shrink-0 mt-0.5">
                          {getStepIcon(step)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-[13px] leading-[18px] ${
                              step.status === "locked" 
                                ? "text-hh-muted/50 italic" 
                                : isCurrent
                                ? "text-hh-text font-medium"
                                : step.status === "completed"
                                ? "text-hh-text"
                                : "text-hh-muted"
                            }`}>
                              {step.nummer}. {step.name}
                            </p>
                            {step.isVerplicht && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 flex-shrink-0">
                                Verplicht
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] leading-[14px] text-hh-muted">
                            {step.duration}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="p-4 border-t border-hh-border flex-shrink-0">
        <div className="w-full h-2 bg-hh-ui-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-hh-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] leading-[14px] text-hh-muted mt-2 text-center">
          {progress}% van het scenario voltooid
        </p>
      </div>
    </div>
  );
}
