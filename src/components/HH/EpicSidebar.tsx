import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  getTechniekByNummer,
  getTechniekenByFase,
  getFaseNaam,
  Techniek,
} from "@/data/technieken-service";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Tag,
  BookOpen,
  Info,
} from "lucide-react";
import { PHASE_COLORS, ADMIN_PHASE_COLORS } from "../../utils/phaseColors";

interface TimelineSegment {
  start_seconds: number;
  end_seconds: number;
  techniek_id: string;
  label: string;
}

interface VideoInfo {
  id: string;
  techniqueNumber: string;
  playbackOrder?: number | null;
}

export interface EpicSidebarProps {
  videoTechniqueIds: Set<string>;
  primaryTechniqueNumber?: string;
  allVideos: VideoInfo[];
  completedVideoIds?: Set<string>;
  currentIndex?: number;
  totalVideos?: number;
  timeline?: TimelineSegment[];
  currentTime?: number;
  onTechniqueClick: (tech: Techniek) => void;
  variant?: "user" | "admin";
  className?: string;
  maxHeight?: string;
}

const PHASE_ORDER = ["0", "1", "2", "3", "4"];

export function EpicSidebar({
  videoTechniqueIds,
  primaryTechniqueNumber,
  allVideos,
  completedVideoIds = new Set(),
  currentIndex = 0,
  totalVideos,
  timeline = [],
  currentTime = 0,
  onTechniqueClick,
  variant = "user",
  className,
  maxHeight = "calc(100vh-180px)",
}: EpicSidebarProps) {
  const isAdmin = variant === "admin";
  const phaseColorMap = isAdmin ? ADMIN_PHASE_COLORS : PHASE_COLORS;
  const completedColor = isAdmin ? "var(--hh-primary)" : "var(--hh-success)";
  const total = totalVideos ?? allVideos.length;

  // Expand/collapse state
  const technique = primaryTechniqueNumber
    ? getTechniekByNummer(primaryTechniqueNumber)
    : null;
  const activeFase = technique?.fase ?? null;

  const getActiveParentGroup = useCallback(
    (techniqueNumber: string | undefined): string | null => {
      if (!techniqueNumber) return null;
      const tech = getTechniekByNummer(techniqueNumber);
      if (!tech) return null;
      const hasChildTechniques = getTechniekenByFase(tech.fase).some(
        (t) => t.parent === tech.nummer
      );
      if (hasChildTechniques && tech.parent === tech.fase) {
        return tech.nummer;
      }
      if (tech.parent && tech.parent !== tech.fase) {
        const parentTech = getTechniekByNummer(tech.parent);
        if (parentTech && parentTech.parent === parentTech.fase) {
          return tech.parent;
        }
        if (
          parentTech &&
          parentTech.parent &&
          parentTech.parent !== parentTech.fase
        ) {
          return parentTech.parent;
        }
        return tech.parent;
      }
      return null;
    },
    []
  );

  const getActiveSubgroup = useCallback(
    (techniqueNumber: string | undefined): string | null => {
      if (!techniqueNumber) return null;
      const tech = getTechniekByNummer(techniqueNumber);
      if (!tech || !tech.parent) return null;
      const parent = getTechniekByNummer(tech.parent);
      if (!parent) return null;
      const parentGroup = getActiveParentGroup(techniqueNumber);
      if (
        parentGroup &&
        tech.parent !== parentGroup &&
        tech.parent !== String(tech.fase)
      ) {
        return tech.parent;
      }
      return null;
    },
    [getActiveParentGroup]
  );

  const [expandedPhase, setExpandedPhase] = useState<string | null>(() => {
    return activeFase !== null ? String(activeFase) : null;
  });

  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    return getActiveParentGroup(primaryTechniqueNumber);
  });

  const [expandedSubgroup, setExpandedSubgroup] = useState<string | null>(null);
  const [autoExpandedPhases, setAutoExpandedPhases] = useState<Set<string>>(
    new Set()
  );

  const techItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeRef = useRef<HTMLDivElement>(null);
  const navigatorRef = useRef<HTMLDivElement>(null);

  // Auto-expand phases containing video techniques
  useEffect(() => {
    const phases = new Set<string>();
    videoTechniqueIds.forEach((id) => {
      const t = getTechniekByNummer(id);
      if (t) phases.add(String(t.fase));
    });
    setAutoExpandedPhases(phases);
  }, [videoTechniqueIds]);

  // Update expand state when primary technique changes
  useEffect(() => {
    if (activeFase !== null) {
      setExpandedPhase(String(activeFase));
    }
    setExpandedGroup(getActiveParentGroup(primaryTechniqueNumber));
    setExpandedSubgroup(getActiveSubgroup(primaryTechniqueNumber));
  }, [
    activeFase,
    primaryTechniqueNumber,
    getActiveParentGroup,
    getActiveSubgroup,
  ]);

  // Auto-scroll to active technique on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeRef.current && navigatorRef.current) {
        const container = navigatorRef.current;
        const element = activeRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const offset =
          elementRect.top -
          containerRect.top -
          containerRect.height / 2 +
          elementRect.height / 2;
        container.scrollBy({ top: offset, behavior: "smooth" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [primaryTechniqueNumber]);

  // Timeline auto-scroll
  const lastAutoScrollTech = useRef<string | null>(null);
  const activeTimelineTechnique = useMemo(() => {
    if (timeline.length === 0 || currentTime <= 0) return null;
    const t = Math.floor(currentTime);
    for (const seg of timeline) {
      if (t >= seg.start_seconds && t < seg.end_seconds) {
        if (seg.techniek_id === "intro" || seg.techniek_id === "outro")
          return null;
        return seg.techniek_id;
      }
    }
    return null;
  }, [timeline, currentTime]);

  useEffect(() => {
    if (
      activeTimelineTechnique &&
      activeTimelineTechnique !== lastAutoScrollTech.current
    ) {
      lastAutoScrollTech.current = activeTimelineTechnique;
      const tech = getTechniekByNummer(activeTimelineTechnique);
      if (tech) {
        setAutoExpandedPhases(new Set());
        setExpandedPhase(String(tech.fase));
        setExpandedGroup(getActiveParentGroup(activeTimelineTechnique));
        setExpandedSubgroup(getActiveSubgroup(activeTimelineTechnique));
        setTimeout(() => {
          const el = techItemRefs.current[activeTimelineTechnique];
          if (el && navigatorRef.current) {
            const container = navigatorRef.current;
            const containerRect = container.getBoundingClientRect();
            const elementRect = el.getBoundingClientRect();
            const offset =
              elementRect.top -
              containerRect.top -
              containerRect.height / 2 +
              elementRect.height / 2;
            container.scrollBy({ top: offset, behavior: "smooth" });
          }
        }, 100);
      }
    }
  }, [activeTimelineTechnique, getActiveParentGroup, getActiveSubgroup]);

  const togglePhase = (fase: string) => {
    setAutoExpandedPhases(new Set());
    setExpandedPhase((prev) => (prev === fase ? null : fase));
    setExpandedGroup(null);
  };

  const toggleGroup = (groupNummer: string) => {
    setExpandedGroup((prev) => {
      if (prev === groupNummer) return null;
      setExpandedSubgroup(null);
      return groupNummer;
    });
  };

  const toggleSubgroup = (subgroupNummer: string) => {
    setExpandedSubgroup((prev) =>
      prev === subgroupNummer ? null : subgroupNummer
    );
  };

  const phaseData = useMemo(() => {
    return PHASE_ORDER.map((fase) => {
      const allTechniques = getTechniekenByFase(fase);
      const topLevel = allTechniques.filter((t) => t.parent === fase);
      const grouped = topLevel.map((t) => ({
        ...t,
        children: allTechniques.filter((c) => c.parent === t.nummer),
      }));
      return {
        fase,
        name: getFaseNaam(fase),
        techniques: allTechniques,
        topLevel: grouped,
        color: phaseColorMap[fase],
      };
    });
  }, []);

  const renderTechItem = (tech: Techniek, indent: number = 0) => {
    const isPrimary = tech.nummer === primaryTechniqueNumber;
    const isHighlighted = videoTechniqueIds.has(tech.nummer);
    const isLiveActive = activeTimelineTechnique === tech.nummer;
    const isActive = isPrimary || isHighlighted || isLiveActive;
    const hasVideo = allVideos.some((v) => v.techniqueNumber === tech.nummer);
    const videoForTech = allVideos.find(
      (v) => v.techniqueNumber === tech.nummer
    );
    const isCompleted = videoForTech
      ? completedVideoIds.has(videoForTech.id)
      : false;

    return (
      <div
        key={tech.nummer}
        ref={(el) => {
          if (isPrimary) (activeRef as any).current = el;
          techItemRefs.current[tech.nummer] = el;
        }}
        className={`flex items-center gap-1.5 pr-2 cursor-pointer transition-all text-left ${
          isActive
            ? "rounded-lg mx-2 my-0.5 px-3 py-2"
            : "px-3 py-1.5 hover:bg-hh-ui-50/30"
        }`}
        style={{
          marginLeft: isActive ? undefined : `${8 + indent * 8}px`,
          ...(isLiveActive
            ? {
                backgroundColor: "rgba(var(--hh-primary-rgb),0.08)",
                borderLeft: "3px solid var(--hh-primary)",
                boxShadow: "0 0 8px rgba(var(--hh-primary-rgb),0.15)",
              }
            : isPrimary
            ? {
                backgroundColor: "rgba(var(--hh-primary-rgb),0.06)",
                borderLeft: "3px solid var(--hh-primary)",
              }
            : isHighlighted
            ? {
                backgroundColor: "rgba(var(--hh-primary-rgb),0.08)",
                borderLeft: "3px solid rgba(var(--hh-primary-rgb),0.6)",
              }
            : {}),
        }}
        onClick={() => onTechniqueClick(tech)}
      >
        <div className="flex-shrink-0 w-4">
          {isLiveActive ? (
            <div
              className="w-3.5 h-3.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--hh-primary)" }}
            />
          ) : isPrimary ? (
            <div
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: "var(--hh-primary)" }}
            />
          ) : isHighlighted ? (
            <Tag
              className="w-3 h-3"
              style={{ color: "var(--hh-primary)", opacity: 0.85 }}
            />
          ) : isCompleted ? (
            <CheckCircle2
              className="w-3.5 h-3.5"
              style={{ color: completedColor }}
            />
          ) : null}
        </div>
        <span
          className={`text-[10px] font-mono flex-shrink-0 ${
            isLiveActive
              ? "text-hh-primary font-bold"
              : isActive
              ? "text-hh-primary font-semibold"
              : "text-hh-muted"
          }`}
          style={{ minWidth: "28px" }}
        >
          {tech.nummer}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] leading-tight truncate ${
              isLiveActive
                ? "font-bold text-hh-primary"
                : isActive
                ? "font-semibold text-hh-primary"
                : hasVideo
                ? "text-hh-text"
                : "text-hh-muted"
            }`}
            title={tech.naam}
          >
            {tech.naam}
          </p>
          {isLiveActive && (
            <p
              className="text-[9px] text-hh-primary/70 mt-0.5 truncate"
              title={
                timeline.find(
                  (s) =>
                    s.techniek_id === tech.nummer &&
                    Math.floor(currentTime) >= s.start_seconds &&
                    Math.floor(currentTime) < s.end_seconds
                )?.label || "Nu besproken"
              }
            >
              {timeline.find(
                (s) =>
                  s.techniek_id === tech.nummer &&
                  Math.floor(currentTime) >= s.start_seconds &&
                  Math.floor(currentTime) < s.end_seconds
              )?.label || "Nu besproken"}
            </p>
          )}
        </div>
        <button
          className="text-hh-muted/30 flex-shrink-0 hover:text-hh-muted/70 transition-colors p-1.5 rounded-md hover:bg-hh-ui-50 ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            onTechniqueClick(tech);
          }}
          title="Info over deze techniek"
        >
          <Info className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="bg-hh-card border border-hh-border rounded-xl overflow-hidden w-full">
        <div className="px-3 py-2.5 border-b border-hh-border">
          <h2 className="text-xs font-semibold text-hh-text flex items-center gap-1.5 uppercase tracking-wide">
            <BookOpen className="w-3.5 h-3.5" />
            E.P.I.C. TECHNIQUE
          </h2>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-[10px] text-hh-muted">
              {currentIndex + 1} / {total} video's
            </p>
            {timeline.length > 0 && activeTimelineTechnique && (
              <span className="flex items-center gap-1 text-[9px] text-hh-primary font-semibold">
                <span className="w-2 h-2 rounded-full bg-hh-primary animate-pulse" />
                Actief
              </span>
            )}
          </div>
        </div>

        <div
          ref={navigatorRef}
          className="overflow-y-auto"
          style={{
            maxHeight,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {phaseData.map(({ fase, name, techniques, topLevel, color }) => {
            const isExpanded =
              expandedPhase === fase || autoExpandedPhases.has(fase);
            const techCount = techniques.length;
            const completedInPhase = techniques.filter((t) =>
              allVideos.some(
                (v) =>
                  v.techniqueNumber === t.nummer &&
                  completedVideoIds.has(v.id)
              )
            ).length;

            return (
              <div key={fase}>
                <button
                  onClick={() => togglePhase(fase)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-hh-ui-50/30 transition-colors"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {fase}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-hh-text truncate">
                      {name}
                    </p>
                    <p className="text-[10px] text-hh-muted">
                      {completedInPhase}/{techCount}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-hh-muted flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-hh-muted flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="pb-1">
                    {topLevel.map((group) => {
                      const hasChildren = group.children.length > 0;
                      const isGroupExpanded = expandedGroup === group.nummer;

                      if (!hasChildren) {
                        return renderTechItem(group, 0);
                      }

                      const allDescendants = [...group.children];
                      group.children.forEach((child) => {
                        const grandchildren = techniques.filter(
                          (t) => t.parent === child.nummer
                        );
                        allDescendants.push(...grandchildren);
                      });
                      const allGroupTechs = [group, ...allDescendants];
                      const groupHasActive = allGroupTechs.some(
                        (t) =>
                          t.nummer === primaryTechniqueNumber ||
                          videoTechniqueIds.has(t.nummer)
                      );
                      const isGroupSelfActive =
                        group.nummer === primaryTechniqueNumber ||
                        videoTechniqueIds.has(group.nummer);
                      const groupVideo = allVideos.find(
                        (v) => v.techniqueNumber === group.nummer
                      );
                      const isGroupCompleted = groupVideo
                        ? completedVideoIds.has(groupVideo.id)
                        : false;

                      return (
                        <div key={group.nummer}>
                          <div
                            ref={isGroupSelfActive ? activeRef : undefined}
                            className={`flex items-center gap-1.5 pr-2 cursor-pointer transition-colors ${
                              isGroupSelfActive
                                ? "rounded-lg mx-2 my-0.5 px-3 py-2"
                                : "px-3 py-1.5 hover:bg-hh-ui-50/30"
                            }`}
                            style={{
                              marginLeft: isGroupSelfActive
                                ? undefined
                                : "8px",
                              ...(isGroupSelfActive
                                ? {
                                    backgroundColor: "rgba(var(--hh-primary-rgb),0.06)",
                                    borderLeft: "3px solid var(--hh-primary)",
                                  }
                                : {}),
                            }}
                            onClick={() => toggleGroup(group.nummer)}
                          >
                            <div className="flex-shrink-0 w-4">
                              {isGroupSelfActive ? (
                                <div
                                  className="w-3.5 h-3.5 rounded-full"
                                  style={{ backgroundColor: "var(--hh-primary)" }}
                                />
                              ) : isGroupCompleted ? (
                                <CheckCircle2
                                  className="w-3.5 h-3.5"
                                  style={{ color: completedColor }}
                                />
                              ) : isGroupExpanded ? (
                                <ChevronDown className="w-3 h-3 text-hh-muted" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-hh-muted" />
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-mono flex-shrink-0 ${
                                groupHasActive || isGroupSelfActive
                                  ? "text-hh-primary font-semibold"
                                  : "text-hh-muted"
                              }`}
                              style={{ minWidth: "28px" }}
                            >
                              {group.nummer}
                            </span>
                            <p
                              className={`text-[11px] leading-tight truncate flex-1 ${
                                groupHasActive || isGroupSelfActive
                                  ? "font-semibold text-hh-primary"
                                  : "text-hh-text"
                              }`}
                              title={group.naam}
                            >
                              {group.naam}
                            </p>
                            <span className="text-[9px] text-hh-muted flex-shrink-0 mr-1">
                              {group.children.length}
                            </span>
                            <button
                              className="text-hh-muted/30 flex-shrink-0 hover:text-hh-muted/70 transition-colors p-1.5 rounded-md hover:bg-hh-ui-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTechniqueClick(group);
                              }}
                              title="Info over deze techniek"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                          </div>
                          {isGroupExpanded && (
                            <div>
                              {group.children.map((child) => {
                                const grandchildren = techniques.filter(
                                  (t) => t.parent === child.nummer
                                );
                                if (grandchildren.length > 0) {
                                  const isSubExpanded =
                                    expandedSubgroup === child.nummer;
                                  const subHasActive = grandchildren.some(
                                    (gc) =>
                                      gc.nummer === primaryTechniqueNumber ||
                                      videoTechniqueIds.has(gc.nummer)
                                  );
                                  const childIsActive =
                                    child.nummer === primaryTechniqueNumber ||
                                    videoTechniqueIds.has(child.nummer);
                                  const childVideo = allVideos.find(
                                    (v) => v.techniqueNumber === child.nummer
                                  );
                                  const childCompleted = childVideo
                                    ? completedVideoIds.has(childVideo.id)
                                    : false;
                                  return (
                                    <div key={child.nummer}>
                                      <div
                                        ref={(el) => {
                                          techItemRefs.current[child.nummer] =
                                            el;
                                        }}
                                        className={`flex items-center gap-1.5 pr-2 cursor-pointer transition-colors ${
                                          childIsActive
                                            ? "rounded-lg mx-2 my-0.5 px-3 py-2"
                                            : "px-3 py-1.5 hover:bg-hh-ui-50/30"
                                        }`}
                                        style={{
                                          marginLeft: childIsActive
                                            ? undefined
                                            : "16px",
                                          ...(childIsActive
                                            ? {
                                                backgroundColor:
                                                  "rgba(var(--hh-primary-rgb),0.06)",
                                                borderLeft:
                                                  "3px solid var(--hh-primary)",
                                              }
                                            : {}),
                                        }}
                                        onClick={() =>
                                          toggleSubgroup(child.nummer)
                                        }
                                      >
                                        <div className="flex-shrink-0 w-4">
                                          {childIsActive ? (
                                            <div
                                              className="w-3.5 h-3.5 rounded-full"
                                              style={{
                                                backgroundColor: "var(--hh-primary)",
                                              }}
                                            />
                                          ) : childCompleted ? (
                                            <CheckCircle2
                                              className="w-3.5 h-3.5"
                                              style={{ color: completedColor }}
                                            />
                                          ) : isSubExpanded ? (
                                            <ChevronDown className="w-3 h-3 text-hh-muted" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3 text-hh-muted" />
                                          )}
                                        </div>
                                        <span
                                          className={`text-[10px] font-mono flex-shrink-0 ${
                                            subHasActive || childIsActive
                                              ? "text-hh-primary font-semibold"
                                              : "text-hh-muted"
                                          }`}
                                          style={{ minWidth: "28px" }}
                                        >
                                          {child.nummer}
                                        </span>
                                        <p
                                          className={`text-[11px] leading-tight truncate flex-1 ${
                                            subHasActive || childIsActive
                                              ? "font-semibold text-hh-primary"
                                              : "text-hh-text"
                                          }`}
                                          title={child.naam}
                                        >
                                          {child.naam}
                                        </p>
                                        <button
                                          className="text-hh-muted/30 flex-shrink-0 hover:text-hh-muted/70 transition-colors p-1.5 rounded-md hover:bg-hh-ui-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onTechniqueClick(child);
                                          }}
                                          title="Info over deze techniek"
                                        >
                                          <Info className="w-3 h-3" />
                                        </button>
                                      </div>
                                      {isSubExpanded &&
                                        grandchildren.map((gc) =>
                                          renderTechItem(gc, 2)
                                        )}
                                    </div>
                                  );
                                }
                                return renderTechItem(child, 1);
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
      </div>
    </div>
  );
}
