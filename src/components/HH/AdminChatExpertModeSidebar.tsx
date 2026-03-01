import { ChevronRight, ChevronDown, Info, Check, Lock, Play } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import technieken_index from "../../data/technieken_index.json";

interface EPICSidebarProps {
  fasesAccordionOpen: boolean;
  setFasesAccordionOpen: (open: boolean) => void;
  houdingenAccordionOpen: boolean;
  setHoudingenAccordionOpen: (open: boolean) => void;
  expandedPhases: number[];
  togglePhase: (phase: number) => void;
  setCurrentPhase: (phase: number) => void;
  expandedParents: string[];
  toggleParentTechnique: (id: string) => void;
  expandedHoudingen: string[];
  toggleHouding: (id: string) => void;
  selectedTechnique: string;
  setSelectedTechnique: (technique: string) => void;
  activeHouding: string | null;
  recommendedTechnique: string | null;
  openTechniqueDetails: (techniqueNumber: string) => void;
  startTechniqueChat: (techniqueNumber: string, techniqueName: string) => void;
  techniquesByPhase: Record<number, any[]>;
  phaseNames: Record<number, string>;
  getFaseBadgeColor: (phase: number) => string;
  getTopLevelTechniques: (phase: number) => any[];
  hasChildren: (technique: any, phase: number) => boolean;
  getChildTechniques: (parentNumber: string, phase: number) => any[];
  klantHoudingen: Array<{
    id: string;
    key: string;
    naam: string;
    beschrijving: string;
    technieken: string[];
    recommended_technique_ids?: string[];
  }>;
  difficultyLevel: string;
  isUserView?: boolean;
  isAdminView?: boolean;
  completedTechniques?: string[];
  currentUnlockedPhase?: number;
  hideHeader?: boolean;
  onSelectTechnique?: (nummer: string, naam: string) => void;
}

const PHASE_CIRCLE_COLORS: Record<number, string> = {
  0: '#64748B',
  1: '#475569',
  2: '#3B82F6',
  3: '#D97706',
  4: '#10B981',
};

const STEEL_BLUE = '#4F7396';
const STEEL_BLUE_BG = 'rgba(79, 115, 150, 0.08)';
const STEEL_BLUE_BORDER = 'rgba(79, 115, 150, 0.18)';

export function EPICSidebar({
  fasesAccordionOpen,
  setFasesAccordionOpen,
  houdingenAccordionOpen,
  setHoudingenAccordionOpen,
  expandedPhases,
  togglePhase,
  setCurrentPhase,
  expandedParents,
  toggleParentTechnique,
  expandedHoudingen,
  toggleHouding,
  selectedTechnique,
  setSelectedTechnique,
  activeHouding,
  recommendedTechnique,
  openTechniqueDetails,
  startTechniqueChat,
  techniquesByPhase,
  phaseNames,
  getFaseBadgeColor,
  getTopLevelTechniques,
  hasChildren,
  getChildTechniques,
  klantHoudingen,
  difficultyLevel,
  isUserView = false,
  isAdminView = false,
  completedTechniques = ["0.1", "0.2", "0.3", "0.4", "0.5", "1.1", "1.2"],
  currentUnlockedPhase = 2,
  hideHeader = false,
  onSelectTechnique,
}: EPICSidebarProps) {
  const ACCENT = isAdminView ? '#9910FA' : '#10B981';
  const ACCENT_BG = isAdminView ? 'rgba(153, 16, 250, 0.1)' : undefined;
  
  const isTechniqueLocked = (techniqueNumber: string) => {
    if (!isUserView) return false;
    const phase = parseInt(techniqueNumber.split('.')[0]);
    return phase > currentUnlockedPhase;
  };

  const isTechniqueCompleted = (techniqueNumber: string) => {
    return completedTechniques.includes(techniqueNumber);
  };

  const getPhaseProgress = (phase: number) => {
    const techniques = techniquesByPhase[phase] || [];
    const nonFaseTechniques = techniques.filter((t: any) => !t.is_fase);
    const completed = nonFaseTechniques.filter((t: any) => completedTechniques.includes(t.nummer)).length;
    return { completed, total: nonFaseTechniques.length };
  };

  const getGrandchildTechniques = (parentNumber: string) => {
    return Object.values(technieken_index.technieken).filter(
      (t: any) => t.parent === parentNumber
    ).sort((a: any, b: any) => {
      const aNum = a.nummer.split('.').map((n: string) => parseInt(n) || 0);
      const bNum = b.nummer.split('.').map((n: string) => parseInt(n) || 0);
      for (let i = 0; i < Math.max(aNum.length, bNum.length); i++) {
        if ((aNum[i] || 0) !== (bNum[i] || 0)) {
          return (aNum[i] || 0) - (bNum[i] || 0);
        }
      }
      return 0;
    });
  };

  const totalCompleted = completedTechniques.length;
  const totalTechniques = Object.values(technieken_index.technieken).filter((t: any) => !t.is_fase).length;
  const progressPercent = Math.round((totalCompleted / totalTechniques) * 100);

  if (isUserView) {
    return (
      <div className="h-full bg-hh-bg flex flex-col" style={hideHeader ? {} : { borderRight: '1px solid var(--hh-border)' }}>
        {!hideHeader && (
          <div className="flex items-center px-4 py-3 lg:py-4 border-b border-hh-border bg-hh-bg flex-shrink-0">
            <h3 className="text-hh-text" style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }}>
              E.P.I.C. TECHNIQUE
            </h3>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="space-y-1">
            {Object.entries(phaseNames).map(([phaseNum, phaseName]) => {
              const phase = parseInt(phaseNum);
              const isExpanded = expandedPhases.includes(phase);
              const subTechniques = getTopLevelTechniques(phase);
              const phaseProgress = getPhaseProgress(phase);
              const isPhaseLocked = phase > currentUnlockedPhase;
              const baseCircleColor = PHASE_CIRCLE_COLORS[phase] || '#64748B';
              const circleColor = isAdminView ? '#9910FA' : baseCircleColor;

              if (subTechniques.length === 0) return null;

              return (
                <div key={phase}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!isPhaseLocked) {
                        togglePhase(phase);
                        setCurrentPhase(phase);
                      }
                    }}
                    className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors"
                    style={{
                      opacity: isPhaseLocked ? 0.5 : 1,
                      cursor: isPhaseLocked ? 'not-allowed' : 'pointer',
                      backgroundColor: isExpanded && !isPhaseLocked ? 'var(--hh-ui-50)' : 'transparent',
                    }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: isPhaseLocked ? 'var(--hh-ui-200)' : circleColor,
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {isPhaseLocked ? (
                        <Lock className="w-3.5 h-3.5 text-white" style={{ opacity: 0.7 }} />
                      ) : (
                        phase
                      )}
                    </div>
                    <span
                      className="flex-1 text-left"
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isPhaseLocked ? 'var(--hh-muted)' : 'var(--hh-ink)',
                      }}
                    >
                      {phaseName}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: isPhaseLocked ? '#cbd5e1' : '#94a3b8',
                        fontWeight: 500,
                        marginRight: '4px',
                      }}
                    >
                      {phaseProgress.completed}/{phaseProgress.total}
                    </span>
                    {isPhaseLocked ? (
                      <Lock className="w-3.5 h-3.5" style={{ color: '#cbd5e1' }} />
                    ) : isExpanded ? (
                      <ChevronDown className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    )}
                  </button>

                  {isExpanded && !isPhaseLocked && (
                    <div className="ml-3 mt-1 mb-2" style={{ borderLeft: '2px solid var(--hh-ui-100)', paddingLeft: '12px' }}>
                      {getTopLevelTechniques(phase).map((technique: any) => {
                        const isParent = hasChildren(technique, phase);
                        const isExpandedParent = expandedParents.includes(technique.nummer);
                        const isSelected = selectedTechnique === technique.naam;
                        const isLocked = isTechniqueLocked(technique.nummer);

                        return (
                          <div key={technique.nummer}>
                            <UserTechniqueRow
                              technique={technique}
                              isSelected={isSelected}
                              isLocked={isLocked}
                              isParent={isParent}
                              isExpandedParent={isExpandedParent}
                              onSelect={() => {
                                if (isLocked) return;
                                if (isParent) {
                                  toggleParentTechnique(technique.nummer);
                                } else if (onSelectTechnique) {
                                  onSelectTechnique(technique.nummer, technique.naam);
                                } else {
                                  openTechniqueDetails(technique.nummer);
                                }
                              }}
                              onInfo={() => openTechniqueDetails(technique.nummer)}
                            />

                            {isExpandedParent && !isLocked && (
                              <div className="ml-5">
                                {getChildTechniques(technique.nummer, phase).map((child: any) => {
                                  const childHasGrandchildren = getGrandchildTechniques(child.nummer).length > 0;
                                  const isChildExpanded = expandedParents.includes(child.nummer);
                                  const isChildSelected = selectedTechnique === child.naam;
                                  const isChildLocked = isTechniqueLocked(child.nummer);

                                  return (
                                    <div key={child.nummer}>
                                      <UserTechniqueRow
                                        technique={child}
                                        isSelected={isChildSelected}
                                        isLocked={isChildLocked}
                                        isParent={childHasGrandchildren}
                                        isExpandedParent={isChildExpanded}
                                        onSelect={() => {
                                          if (isChildLocked) return;
                                          if (childHasGrandchildren) {
                                            toggleParentTechnique(child.nummer);
                                          } else if (onSelectTechnique) {
                                            onSelectTechnique(child.nummer, child.naam);
                                          } else {
                                            openTechniqueDetails(child.nummer);
                                          }
                                        }}
                                        onInfo={() => openTechniqueDetails(child.nummer)}
                                      />

                                      {isChildExpanded && childHasGrandchildren && !isChildLocked && (
                                        <div className="ml-5">
                                          {getGrandchildTechniques(child.nummer).map((grandchild: any) => {
                                            const isGrandchildSelected = selectedTechnique === grandchild.naam;
                                            const isGrandchildLocked = isTechniqueLocked(grandchild.nummer);

                                            return (
                                              <UserTechniqueRow
                                                key={grandchild.nummer}
                                                technique={grandchild}
                                                isSelected={isGrandchildSelected}
                                                isLocked={isGrandchildLocked}
                                                isParent={false}
                                                isExpandedParent={false}
                                                onSelect={() => {
                                                  if (isGrandchildLocked) return;
                                                  if (onSelectTechnique) {
                                                    onSelectTechnique(grandchild.nummer, grandchild.naam);
                                                  } else {
                                                    openTechniqueDetails(grandchild.nummer);
                                                  }
                                                }}
                                                onInfo={() => openTechniqueDetails(grandchild.nummer)}
                                              />
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--hh-border)', paddingTop: '12px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setHoudingenAccordionOpen(!houdingenAccordionOpen);
              }}
              className="w-full flex items-center gap-2 py-2 px-2 rounded-lg transition-colors"
              style={{ backgroundColor: houdingenAccordionOpen ? 'var(--hh-ui-50)' : 'transparent' }}
            >
              {houdingenAccordionOpen ? (
                <ChevronDown className="w-4 h-4" style={{ color: '#94a3b8' }} />
              ) : (
                <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
              )}
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--hh-ink)', flex: 1, textAlign: 'left' }}>
                Houdingen van de klant
              </h4>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                {klantHoudingen.length}
              </span>
            </button>

            {houdingenAccordionOpen && (
              <div className="ml-3 mt-1" style={{ borderLeft: '2px solid var(--hh-ui-100)', paddingLeft: '12px' }}>
                {klantHoudingen.map((houding) => {
                  const isExpanded = expandedHoudingen.includes(houding.id);
                  const isActive = activeHouding === houding.id;

                  return (
                    <div key={houding.id}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleHouding(houding.id);
                        }}
                        className="w-full flex items-center gap-2 py-2 px-1 rounded transition-colors"
                        style={{
                          backgroundColor: isActive ? 'rgba(249, 115, 22, 0.06)' : 'transparent',
                        }}
                      >
                        <div
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: isActive ? '#f97316' : '#fed7aa',
                            color: isActive ? 'white' : '#c2410c',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          {houding.id}
                        </div>
                        <span
                          className="flex-1 text-left"
                          style={{
                            fontSize: '13px',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? '#9a3412' : 'var(--hh-ink)',
                          }}
                        >
                          {houding.naam}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '4px' }}>
                          {houding.recommended_technique_ids?.length || 0}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="ml-5 mb-1">
                          {houding.recommended_technique_ids && houding.recommended_technique_ids.length > 0 ? (
                            houding.recommended_technique_ids.map((techniqueId: string) => {
                              const technique = Object.values(technieken_index.technieken).find(
                                (t: any) => t.nummer === techniqueId
                              ) as any;
                              if (!technique) return null;
                              const isSelected = selectedTechnique === technique.naam;
                              const isLocked = isTechniqueLocked(techniqueId);

                              return (
                                <UserTechniqueRow
                                  key={techniqueId}
                                  technique={technique}
                                  isSelected={isSelected}
                                  isLocked={isLocked}
                                  isParent={false}
                                  isExpandedParent={false}
                                  onSelect={() => {
                                    if (isLocked) return;
                                    if (onSelectTechnique) {
                                      onSelectTechnique(technique.nummer, technique.naam);
                                    } else {
                                      openTechniqueDetails(technique.nummer);
                                    }
                                  }}
                                  onInfo={() => openTechniqueDetails(technique.nummer)}
                                />
                              );
                            })
                          ) : (
                            <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                              Geen aanbevolen technieken
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ===== ADMIN VIEW (unchanged) =====
  return (
    <div className="h-full bg-hh-ui-50/30 border-r border-hh-border overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="pb-3 border-b border-hh-border">
          <h3 className="text-[18px] leading-[24px] font-semibold text-hh-text mb-1">
            Talk to Hugo AI
          </h3>
          <p className="text-[13px] leading-[18px] text-hh-muted mb-3">
            Training AI Model
          </p>
        </div>

        <div className="pb-4 border-b border-hh-border">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-hh-muted">{totalCompleted}/{totalTechniques} onderwerpen • {progressPercent}%</span>
          </div>
          
          <div className="flex items-center gap-2">
            {[
              { phase: 0, label: "Voorber." },
              { phase: 1, label: "Opening" },
              { phase: 2, label: "Ontdekking" },
              { phase: 3, label: "Voorstel" },
              { phase: 4, label: "Afsluiting" },
            ].map((item, index) => {
              const progress = getPhaseProgress(item.phase);
              const isCompleted = progress.completed === progress.total && progress.total > 0;
              const hasProgress = progress.completed > 0;
              const isCurrent = item.phase === currentUnlockedPhase;
              const isLocked = item.phase > currentUnlockedPhase;
              
              let barBgStyle = { backgroundColor: '#e2e8f0' };
              let barFillStyle = { backgroundColor: '#cbd5e1' };
              let barWidth = "0%";
              let numberStyle = { color: '#94a3b8' };
              let labelStyle = { color: '#94a3b8' };
              
              if (isCompleted || (item.phase < currentUnlockedPhase && !isLocked)) {
                barBgStyle = { backgroundColor: 'rgba(79, 115, 150, 0.2)' };
                barFillStyle = { backgroundColor: '#4F7396' };
                barWidth = "100%";
                numberStyle = { color: '#4F7396' };
                labelStyle = { color: '#475569' };
              } else if (isCurrent) {
                barBgStyle = { backgroundColor: ACCENT };
                barFillStyle = { backgroundColor: ACCENT };
                barWidth = "100%";
                numberStyle = { color: ACCENT };
                labelStyle = { color: '#475569' };
              } else if (hasProgress && !isLocked) {
                barBgStyle = { backgroundColor: '#e2e8f0' };
                barFillStyle = { backgroundColor: '#4F7396' };
                barWidth = progress.total > 0 ? `${(progress.completed / progress.total) * 100}%` : "0%";
                numberStyle = { color: '#64748b' };
                labelStyle = { color: '#64748b' };
              } else if (isLocked) {
                barBgStyle = { backgroundColor: '#f1f5f9' };
                barFillStyle = { backgroundColor: '#e2e8f0' };
                barWidth = "0%";
              }
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-2 rounded-full overflow-hidden" style={barBgStyle}>
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ ...barFillStyle, width: barWidth }}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[12px] leading-[16px] font-semibold" style={numberStyle}>
                      {item.phase === 0 ? "-1" : item.phase}
                    </span>
                    <span className="text-[11px] leading-[14px] text-center" style={labelStyle}>{item.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setFasesAccordionOpen(!fasesAccordionOpen);
            }}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-hh-border bg-card hover:bg-hh-ui-50 transition-all"
          >
            <div className="flex items-center gap-2">
              {fasesAccordionOpen ? (
                <ChevronDown className="w-4 h-4 text-hh-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-hh-muted" />
              )}
              <h4 className="text-[14px] leading-[20px] font-semibold text-hh-text">
                Fases & bijhorende technieken
              </h4>
            </div>
            <Badge className="bg-purple-100 text-purple-700 border-purple-300">
              5 fases
            </Badge>
          </button>

          {fasesAccordionOpen && (
            <div className="ml-4 space-y-2">
              {Object.entries(phaseNames).map(([phaseNum, phaseName]) => {
                const phase = parseInt(phaseNum);
                const isExpanded = expandedPhases.includes(phase);
                const techniques = techniquesByPhase[phase] || [];
                const subTechniques = getTopLevelTechniques(phase);
                const phaseProgress = getPhaseProgress(phase);
                const isPhaseCompleted = phaseProgress.completed === phaseProgress.total && phaseProgress.total > 0;
                
                if (subTechniques.length === 0) return null;

                return (
                  <div key={phase} className="space-y-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        togglePhase(phase);
                        setCurrentPhase(phase);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-hh-border bg-card hover:bg-hh-ui-50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-hh-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-hh-muted" />
                        )}
                        <div
                          className={cn(
                            "flex items-center justify-center text-[11px] font-bold text-white",
                            !isAdminView && (isPhaseCompleted ? "bg-emerald-500" :
                            phase === 0 ? "bg-slate-500" :
                            phase === 1 ? "bg-emerald-500" :
                            phase === 2 ? "bg-blue-500" :
                            phase === 3 ? "bg-amber-500" :
                            "bg-purple-500")
                          )}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            ...(isAdminView ? {
                              backgroundColor: isPhaseCompleted ? '#9910FA' :
                                phase === 0 ? '#64748B' :
                                phase === 1 ? '#9910FA' :
                                phase === 2 ? '#7C3AED' :
                                phase === 3 ? '#A855F7' :
                                '#C084FC'
                            } : {})
                          }}
                        >
                          {isPhaseCompleted ? <Check className="w-3 h-3" /> : phase}
                        </div>
                        <span className="text-[13px] leading-[18px] font-medium text-hh-text">
                          {phaseName}
                        </span>
                      </div>
                      <Badge className={
                        isPhaseCompleted
                          ? (isAdminView ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-emerald-100 text-emerald-700 border-emerald-200")
                          : getFaseBadgeColor(phase)
                      }>
                        {phaseProgress.completed}/{phaseProgress.total}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="ml-4 space-y-1">
                        {getTopLevelTechniques(phase).map((technique: any) => {
                          const isParent = hasChildren(technique, phase);
                          const isExpandedParent = expandedParents.includes(technique.nummer);
                          const isRecommended = recommendedTechnique === technique.nummer;

                          return (
                            <div key={technique.nummer} id={`technique-${technique.id}`}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (isParent) {
                                    toggleParentTechnique(technique.nummer);
                                  } else if (onSelectTechnique) {
                                    onSelectTechnique(technique.nummer, technique.naam);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    if (isParent) {
                                      toggleParentTechnique(technique.nummer);
                                    } else if (onSelectTechnique) {
                                      onSelectTechnique(technique.nummer, technique.naam);
                                    }
                                  }
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-lg text-[12px] leading-[16px] transition-all cursor-pointer",
                                  selectedTechnique === technique.naam
                                    ? "bg-purple-600/10 text-purple-800 border border-purple-600/20"
                                    : isRecommended
                                    ? "bg-purple-600/5 border border-purple-600/20"
                                    : "bg-card text-hh-text hover:bg-hh-ui-50"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="font-mono text-[10px] text-hh-muted">
                                      {technique.nummer}
                                    </span>
                                    <span className="flex-1">{technique.naam}</span>
                                    {isParent && (
                                      isExpandedParent ? 
                                        <ChevronDown className="w-3 h-3 text-hh-muted" /> : 
                                        <ChevronRight className="w-3 h-3 text-hh-muted" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {difficultyLevel !== "gemiddeld" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          openTechniqueDetails(technique.nummer);
                                        }}
                                        className="p-1 hover:bg-hh-ui-100 rounded transition-colors flex-shrink-0"
                                        title="Bekijk techniek details"
                                      >
                                        <Info className="w-3.5 h-3.5 text-hh-muted hover:text-hh-primary" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isExpandedParent && (
                                <div className="ml-4 space-y-1 mt-1">
                                  {getChildTechniques(technique.nummer, phase).map((child: any) => {
                                    const isChildRecommended = recommendedTechnique === child.nummer;
                                    const childHasGrandchildren = getGrandchildTechniques(child.nummer).length > 0;
                                    const isChildExpanded = expandedParents.includes(child.nummer);
                                    
                                    return (
                                      <div key={child.nummer} id={`technique-${child.id}`}>
                                        <div
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            if (childHasGrandchildren) {
                                              toggleParentTechnique(child.nummer);
                                            } else if (onSelectTechnique) {
                                              onSelectTechnique(child.nummer, child.naam);
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if ((e.key === 'Enter' || e.key === ' ')) {
                                              e.preventDefault();
                                              if (childHasGrandchildren) {
                                                toggleParentTechnique(child.nummer);
                                              } else if (onSelectTechnique) {
                                                onSelectTechnique(child.nummer, child.naam);
                                              }
                                            }
                                          }}
                                          className={cn(
                                            "w-full text-left px-3 py-2 rounded-lg text-[12px] leading-[16px] transition-all cursor-pointer",
                                            selectedTechnique === child.naam
                                              ? "bg-purple-600/10 text-purple-800 border border-purple-600/20"
                                              : isChildRecommended
                                              ? "bg-purple-600/5 border border-purple-600/20"
                                              : "bg-card text-hh-text hover:bg-hh-ui-50"
                                          )}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1">
                                              <span className="font-mono text-[10px] text-hh-muted">
                                                {child.nummer}
                                              </span>
                                              <span className="flex-1">{child.naam}</span>
                                              {childHasGrandchildren && (
                                                isChildExpanded ? 
                                                  <ChevronDown className="w-3 h-3 text-hh-muted" /> : 
                                                  <ChevronRight className="w-3 h-3 text-hh-muted" />
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              {difficultyLevel !== "gemiddeld" && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    openTechniqueDetails(child.nummer);
                                                  }}
                                                  className="p-1 hover:bg-hh-ui-100 rounded transition-colors flex-shrink-0"
                                                  title="Bekijk techniek details"
                                                >
                                                  <Info className="w-3.5 h-3.5 text-hh-muted hover:text-hh-primary" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {isChildExpanded && childHasGrandchildren && (
                                          <div className="ml-4 space-y-1 mt-1">
                                            {getGrandchildTechniques(child.nummer).map((grandchild: any) => {
                                              const isGrandchildRecommended = recommendedTechnique === grandchild.nummer;
                                              
                                              return (
                                                <div
                                                  key={grandchild.nummer}
                                                  id={`technique-${grandchild.id}`}
                                                  role="button"
                                                  tabIndex={0}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    if (onSelectTechnique) {
                                                      onSelectTechnique(grandchild.nummer, grandchild.naam);
                                                    }
                                                  }}
                                                  className={cn(
                                                    "w-full text-left px-3 py-1.5 rounded-lg text-[11px] leading-[15px] transition-all cursor-pointer",
                                                    selectedTechnique === grandchild.naam
                                                      ? "bg-purple-600/10 text-purple-800 border border-purple-600/20"
                                                      : isGrandchildRecommended
                                                      ? "bg-purple-600/5 border border-purple-600/20"
                                                      : "bg-hh-ui-50/50 text-hh-text hover:bg-hh-ui-100"
                                                  )}
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[9px] text-hh-muted">
                                                      {grandchild.nummer}
                                                    </span>
                                                    <span className="flex-1">{grandchild.naam}</span>
                                                    <div className="flex items-center gap-0.5">
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          e.preventDefault();
                                                          openTechniqueDetails(grandchild.nummer);
                                                        }}
                                                        className="p-0.5 hover:bg-hh-ui-100 rounded transition-colors"
                                                        title="Info"
                                                      >
                                                        <Info className="w-3 h-3 text-hh-muted hover:text-hh-primary" />
                                                      </button>
                                                    </div>
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
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-hh-border">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setHoudingenAccordionOpen(!houdingenAccordionOpen);
            }}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-hh-border bg-card hover:bg-hh-ui-50 transition-all"
          >
            <div className="flex items-center gap-2">
              {houdingenAccordionOpen ? (
                <ChevronDown className="w-4 h-4 text-hh-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-hh-muted" />
              )}
              <h4 className="text-[14px] leading-[20px] font-semibold text-hh-text">
                Houdingen van de klant & bijhorende technieken
              </h4>
            </div>
            <Badge className="bg-purple-100 text-purple-700 border-purple-300">
              {klantHoudingen.length}
            </Badge>
          </button>

          {houdingenAccordionOpen && (
            <div className="ml-4 space-y-2">
              {klantHoudingen.map((houding) => {
                const isExpanded = expandedHoudingen.includes(houding.id);
                const isActive = activeHouding === houding.id;

                return (
                  <div key={houding.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleHouding(houding.id);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                        isActive
                          ? "border-orange-400 bg-orange-600/10 shadow-sm"
                          : "border-hh-border bg-card hover:bg-hh-ui-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-hh-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-hh-muted" />
                        )}
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                            isActive
                              ? "bg-orange-500 text-white border-2 border-orange-600"
                              : "bg-orange-100 text-orange-700 border border-orange-300"
                          )}
                        >
                          {houding.id}
                        </div>
                        <span className={cn(
                          "text-[13px] leading-[18px] font-medium",
                          isActive ? "text-orange-900 font-semibold" : "text-hh-text"
                        )}>
                          {houding.naam}
                        </span>
                      </div>
                      <Badge className={isActive ? "bg-orange-500 text-white border-orange-600" : "bg-orange-100 text-orange-700 border-orange-300"}>
                        {houding.recommended_technique_ids?.length || 0}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="ml-10 space-y-1">
                        {houding.recommended_technique_ids && houding.recommended_technique_ids.length > 0 ? (
                          <div className="space-y-1">
                            {houding.recommended_technique_ids.map((techniqueId: string) => {
                              const technique = Object.values(technieken_index.technieken).find(
                                (t: any) => t.nummer === techniqueId
                              ) as any;

                              if (!technique) return null;

                              const isRecommended = recommendedTechnique === techniqueId;

                              return (
                                <button
                                  key={techniqueId}
                                  type="button"
                                  onClick={() => {
                                    if (onSelectTechnique) {
                                      onSelectTechnique(technique.nummer, technique.naam);
                                    }
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-lg text-[12px] leading-[16px] transition-all cursor-pointer",
                                    selectedTechnique === technique.naam
                                      ? "bg-purple-600/10 text-purple-800 border border-purple-600/20"
                                      : isRecommended
                                      ? "bg-purple-600/5 border border-purple-600/20 hover:bg-purple-600/10"
                                      : "bg-card text-hh-text hover:bg-hh-ui-50"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="text-hh-muted font-mono text-[10px]">
                                        {technique.nummer}
                                      </span>
                                      <span className="flex-1">{technique.naam}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {difficultyLevel !== "gemiddeld" && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            openTechniqueDetails(technique.nummer);
                                          }}
                                          className="p-1 hover:bg-hh-ui-100 rounded transition-colors flex-shrink-0"
                                          title="Bekijk techniek details"
                                        >
                                          <Info className="w-3.5 h-3.5 text-hh-muted hover:text-hh-primary" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })} 
                          </div>
                        ) : (
                          <p className="text-[11px] leading-[14px] text-hh-muted italic px-2">
                            Geen aanbevolen technieken beschikbaar
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserTechniqueRow({
  technique,
  isSelected,
  isLocked,
  isParent,
  isExpandedParent,
  onSelect,
  onInfo,
}: {
  technique: any;
  isSelected: boolean;
  isLocked: boolean;
  isParent: boolean;
  isExpandedParent: boolean;
  onSelect: () => void;
  onInfo: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        if (isLocked) return;
        onSelect();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          if (isLocked) return;
          onSelect();
        }
      }}
      className="flex items-center gap-2 py-1.5 px-2 rounded transition-colors hover:bg-hh-ui-50"
      style={{
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.45 : 1,
        backgroundColor: isSelected ? STEEL_BLUE_BG : undefined,
        borderLeft: isSelected ? `3px solid ${STEEL_BLUE}` : '3px solid transparent',
      }}
    >
      {isSelected ? (
        <div className="flex-shrink-0 relative">
          <span className="absolute -left-0.5 -top-0.5 w-4 h-4 rounded-full animate-ping" style={{ backgroundColor: STEEL_BLUE, opacity: 0.2 }} />
          <Play className="w-3 h-3 relative" style={{ color: STEEL_BLUE, fill: STEEL_BLUE }} />
        </div>
      ) : (
        <span
          className="flex-shrink-0"
          style={{
            fontSize: '12px',
            fontFamily: 'monospace',
            color: isLocked ? '#cbd5e1' : '#94a3b8',
            minWidth: '24px',
          }}
        >
          {technique.nummer}
        </span>
      )}
      <span
        className="flex-1"
        style={{
          fontSize: '13px',
          fontWeight: isSelected ? 500 : 400,
          color: isSelected ? STEEL_BLUE : isLocked ? '#cbd5e1' : 'var(--hh-ink)',
        }}
      >
        {technique.naam}
      </span>
      {isParent && (
        isExpandedParent ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: '#94a3b8' }} />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: '#94a3b8' }} />
        )
      )}
      {!isLocked && !isParent && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onInfo();
          }}
          className="p-0.5 rounded transition-colors flex-shrink-0"
          style={{ opacity: 0.5 }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.5'; }}
          title="Bekijk details"
        >
          <Info className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
        </button>
      )}
    </div>
  );
}
