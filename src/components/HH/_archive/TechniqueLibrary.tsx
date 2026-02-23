import { useState } from "react";
import { AppLayout } from "./AppLayout";
import { ChevronDown, ChevronRight, Play, Clock, BookOpen, Target, Lightbulb } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { EPIC_TECHNIQUES, getFlowStepsForPhase } from "../../data/epicTechniques";

interface TechniqueLibraryProps {
  navigate: (page: string) => void;
}

const phaseInfo = [
  { id: 1, name: "Openingsfase", color: "bg-blue-500", description: "Bouw rapport en creëer een professionele eerste indruk" },
  { id: 2, name: "Ontdekkingsfase", color: "bg-green-500", description: "Ontdek de behoeften van je klant met SPIN vragen" },
  { id: 3, name: "Aanbevelingsfase", color: "bg-purple-500", description: "Presenteer je oplossing op maat" },
  { id: 4, name: "Beslissingsfase", color: "bg-orange-500", description: "Sluit de deal af en handel bezwaren af" },
  { id: 5, name: "Nazorgfase", color: "bg-red-500", description: "Zorg voor klanttevredenheid en referenties" },
];

export function TechniqueLibrary({ navigate }: TechniqueLibraryProps) {
  const [expandedPhases, setExpandedPhases] = useState<number[]>([1]);
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null);

  const togglePhase = (phaseId: number) => {
    setExpandedPhases(prev => 
      prev.includes(phaseId) 
        ? prev.filter(id => id !== phaseId)
        : [...prev, phaseId]
    );
  };

  const selectedTechniqueData = selectedTechnique 
    ? EPIC_TECHNIQUES.find(t => t.nummer === selectedTechnique)
    : null;

  return (
    <AppLayout currentPage="technieken" navigate={navigate}>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-hh-ink mb-2">E.P.I.C Technieken</h1>
            <p className="text-hh-muted">
              Ontdek alle sales technieken uit Hugo's EPIC methodologie. Klik op een techniek om meer te leren.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {phaseInfo.map(phase => {
                const techniques = getFlowStepsForPhase(String(phase.id));
                const isExpanded = expandedPhases.includes(phase.id);

                return (
                  <div key={phase.id} className="bg-white rounded-xl border border-hh-border overflow-hidden">
                    <button
                      onClick={() => togglePhase(phase.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-hh-ui-50 transition-colors"
                    >
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold", phase.color)}>
                        {phase.id}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-hh-ink">{phase.name}</h3>
                        <p className="text-sm text-hh-muted">{phase.description}</p>
                      </div>
                      <Badge variant="secondary">{techniques.length} technieken</Badge>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-hh-muted" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-hh-muted" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-hh-border">
                        {techniques.map(tech => (
                          <button
                            key={tech.nummer}
                            onClick={() => setSelectedTechnique(tech.nummer)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 pl-6 text-left hover:bg-hh-ui-50 transition-colors border-b border-hh-border last:border-b-0",
                              selectedTechnique === tech.nummer && "bg-hh-primary/5 border-l-2 border-l-hh-primary"
                            )}
                          >
                            <div className="w-8 h-8 rounded-full bg-hh-ui-100 flex items-center justify-center text-sm font-medium text-hh-text">
                              {tech.nummer}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-hh-ink">{tech.naam}</p>
                              {tech.wat && (
                                <p className="text-sm text-hh-muted line-clamp-1">{tech.wat}</p>
                              )}
                            </div>
                            {tech.isVerplicht && (
                              <Badge variant="outline" className="text-xs">Verplicht</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-hh-border p-6 sticky top-6">
                {selectedTechniqueData ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className="bg-hh-primary text-white">{selectedTechniqueData.nummer}</Badge>
                      <h2 className="font-bold text-lg text-hh-ink">{selectedTechniqueData.naam}</h2>
                    </div>

                    {selectedTechniqueData.wat && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-hh-muted mb-1">
                          <BookOpen className="w-4 h-4" />
                          <span>Wat is het?</span>
                        </div>
                        <p className="text-hh-text">{selectedTechniqueData.wat}</p>
                      </div>
                    )}

                    {selectedTechniqueData.waarom && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-hh-muted mb-1">
                          <Target className="w-4 h-4" />
                          <span>Waarom?</span>
                        </div>
                        <p className="text-hh-text">{selectedTechniqueData.waarom}</p>
                      </div>
                    )}

                    {selectedTechniqueData.wanneer && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-hh-muted mb-1">
                          <Clock className="w-4 h-4" />
                          <span>Wanneer?</span>
                        </div>
                        <p className="text-hh-text">{selectedTechniqueData.wanneer}</p>
                      </div>
                    )}

                    {selectedTechniqueData.hoe && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-hh-muted mb-1">
                          <Lightbulb className="w-4 h-4" />
                          <span>Hoe?</span>
                        </div>
                        <p className="text-hh-text">{selectedTechniqueData.hoe}</p>
                      </div>
                    )}

                    {selectedTechniqueData.tags && selectedTechniqueData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-hh-border">
                        {selectedTechniqueData.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}

                    <button 
                      onClick={() => navigate("coaching")}
                      className="w-full mt-4 flex items-center justify-center gap-2 bg-hh-primary text-white rounded-lg py-2 px-4 hover:bg-hh-primary/90 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>Bekijk video's</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8 text-hh-muted">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Selecteer een techniek om details te bekijken</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
