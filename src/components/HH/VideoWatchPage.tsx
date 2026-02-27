import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MuxVideoPlayer } from "./MuxVideoPlayer";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import {
  getTechniekByNummer,
  getTechniekenByFase,
  getFaseNaam,
  Techniek,
} from "@/data/technieken-service";
import { DetailsSheet, TechniqueContent } from "./DetailsSheet";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Play,
  CheckCircle2,
  Clock,
  Tag,
  BookOpen,
  Info,
} from "lucide-react";
import { PHASE_COLORS } from "../../utils/phaseColors";
import type { VideoTechniek } from "@/types/video";

interface TimelineSegment {
  start_seconds: number;
  end_seconds: number;
  techniek_id: string;
  label: string;
}

interface VideoWatchPageProps {
  video: {
    id: string;
    title: string;
    displayTitle: string | null;
    muxPlaybackId: string;
    techniqueNumber: string;
    duration: string;
    thumbnail: string;
    aiSummary: string | null;
    technieken?: VideoTechniek[];
  };
  allVideos: Array<{
    id: string;
    title: string;
    displayTitle: string | null;
    muxPlaybackId: string;
    techniqueNumber: string;
    duration: string;
    thumbnail: string;
    playbackOrder: number | null;
    aiSummary: string | null;
    technieken?: VideoTechniek[];
  }>;
  onClose: () => void;
  onVideoChange: (videoId: string) => void;
  onFullscreen: () => void;
  onVideoComplete: (videoId: string) => void;
  completedVideoIds: Set<string>;
  navigate?: (page: string) => void;
}


const PHASE_ORDER = ["0", "1", "2", "3", "4"];

export function VideoWatchPage({
  video,
  allVideos,
  onClose,
  onVideoChange,
  onFullscreen,
  onVideoComplete,
  completedVideoIds,
  navigate,
}: VideoWatchPageProps) {
  const technique = video.techniqueNumber
    ? getTechniekByNummer(video.techniqueNumber)
    : null;
  const activeFase = technique?.fase ?? null;

  const videoTechniqueIds = useMemo(() => {
    const ids = new Set<string>();
    if (video.technieken && video.technieken.length > 0) {
      video.technieken.forEach(t => ids.add(t.techniek_id));
    }
    if (video.techniqueNumber && !ids.has(video.techniqueNumber)) {
      ids.add(video.techniqueNumber);
    }
    return ids;
  }, [video.technieken, video.techniqueNumber]);

  const videoTechniqueList = useMemo(() => {
    if (video.technieken && video.technieken.length > 0) {
      return video.technieken
        .filter(t => getTechniekByNummer(t.techniek_id))
        .sort((a, b) => b.confidence - a.confidence);
    }
    if (video.techniqueNumber) {
      const t = getTechniekByNummer(video.techniqueNumber);
      if (t) return [{ techniek_id: video.techniqueNumber, confidence: 1, source: 'primary', is_primary: true }];
    }
    return [];
  }, [video.technieken, video.techniqueNumber]);

  const [expandedPhase, setExpandedPhase] = useState<string | null>(() => {
    return activeFase !== null ? String(activeFase) : null;
  });

  const getActiveParentGroup = useCallback((techniqueNumber: string | undefined): string | null => {
    if (!techniqueNumber) return null;
    const tech = getTechniekByNummer(techniqueNumber);
    if (!tech) return null;
    const hasChildTechniques = getTechniekenByFase(tech.fase).some((t) => t.parent === tech.nummer);
    if (hasChildTechniques && tech.parent === tech.fase) {
      return tech.nummer;
    }
    if (tech.parent && tech.parent !== tech.fase) {
      const parentTech = getTechniekByNummer(tech.parent);
      if (parentTech && parentTech.parent === parentTech.fase) {
        return tech.parent;
      }
      if (parentTech && parentTech.parent && parentTech.parent !== parentTech.fase) {
        return parentTech.parent;
      }
      return tech.parent;
    }
    return null;
  }, []);

  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    return getActiveParentGroup(video.techniqueNumber);
  });

  const [autoExpandedPhases, setAutoExpandedPhases] = useState<Set<string>>(new Set());

  useEffect(() => {
    const phases = new Set<string>();
    videoTechniqueIds.forEach(id => {
      const t = getTechniekByNummer(id);
      if (t) phases.add(String(t.fase));
    });
    setAutoExpandedPhases(phases);
  }, [video.id, videoTechniqueIds]);

  const techItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const getActiveSubgroup = useCallback((techniqueNumber: string | undefined): string | null => {
    if (!techniqueNumber) return null;
    const tech = getTechniekByNummer(techniqueNumber);
    if (!tech || !tech.parent) return null;
    const parent = getTechniekByNummer(tech.parent);
    if (!parent) return null;
    const parentGroup = getActiveParentGroup(techniqueNumber);
    if (parentGroup && tech.parent !== parentGroup && tech.parent !== String(tech.fase)) {
      return tech.parent;
    }
    return null;
  }, [getActiveParentGroup]);

  const scrollToTechnique = useCallback((nummer: string) => {
    const tech = getTechniekByNummer(nummer);
    if (!tech) return;
    setExpandedPhase(String(tech.fase));
    setExpandedGroup(getActiveParentGroup(nummer));
    setExpandedSubgroup(getActiveSubgroup(nummer));
    setTimeout(() => {
      const el = techItemRefs.current[nummer];
      if (el && navigatorRef.current) {
        const container = navigatorRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = el.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top - containerRect.height / 2 + elementRect.height / 2;
        container.scrollBy({ top: offset, behavior: "smooth" });
      }
    }, 150);
  }, [getActiveParentGroup]);

  const [detailTechnique, setDetailTechnique] = useState<Techniek | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const navigatorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const [timeline, setTimeline] = useState<TimelineSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const lastAutoScrollTech = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTimeline([]);
    lastAutoScrollTech.current = null;
    fetch(`/api/videos/timeline?video_id=${video.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.timeline?.length > 0) {
          setTimeline(data.timeline);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [video.id]);

  const activeTimelineTechnique = useMemo(() => {
    if (timeline.length === 0 || currentTime <= 0) return null;
    const t = Math.floor(currentTime);
    for (const seg of timeline) {
      if (t >= seg.start_seconds && t < seg.end_seconds) {
        if (seg.techniek_id === 'intro' || seg.techniek_id === 'outro') return null;
        return seg.techniek_id;
      }
    }
    return null;
  }, [timeline, currentTime]);

  useEffect(() => {
    if (activeTimelineTechnique && activeTimelineTechnique !== lastAutoScrollTech.current) {
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
            const offset = elementRect.top - containerRect.top - containerRect.height / 2 + elementRect.height / 2;
            container.scrollBy({ top: offset, behavior: "smooth" });
          }
        }, 100);
      }
    }
  }, [activeTimelineTechnique, getActiveParentGroup]);

  const lastTimeUpdateRef = useRef(0);
  const handleTimeUpdate = useCallback((time: number, _duration: number) => {
    const now = Date.now();
    if (now - lastTimeUpdateRef.current < 500) return;
    lastTimeUpdateRef.current = now;
    setCurrentTime(time);
  }, []);

  useEffect(() => {
    if (activeFase !== null) {
      setExpandedPhase(String(activeFase));
    }
    setExpandedGroup(getActiveParentGroup(video.techniqueNumber));
    setExpandedSubgroup(getActiveSubgroup(video.techniqueNumber));
  }, [activeFase, video.techniqueNumber, getActiveParentGroup, getActiveSubgroup]);

  const prevCollapsedRef = useRef<boolean | null>(null);
  useEffect(() => {
    const sidebar = document.querySelector('[data-sidebar-collapsed]');
    prevCollapsedRef.current = sidebar?.getAttribute('data-sidebar-collapsed') === 'true' || false;
    window.dispatchEvent(new CustomEvent('sidebar-collapse-request', { detail: { collapsed: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent('sidebar-collapse-request', { detail: { collapsed: prevCollapsedRef.current ?? false } }));
    };
  }, []);

  useEffect(() => {
    if (pageRef.current) {
      let scrollParent: HTMLElement | null = pageRef.current.parentElement;
      while (scrollParent) {
        const style = window.getComputedStyle(scrollParent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          scrollParent.scrollTop = 0;
          break;
        }
        scrollParent = scrollParent.parentElement;
      }
    }
    const timer = setTimeout(() => {
      if (activeRef.current && navigatorRef.current) {
        const container = navigatorRef.current;
        const element = activeRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top - containerRect.height / 2 + elementRect.height / 2;
        container.scrollBy({ top: offset, behavior: "smooth" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [video.id]);

  const sortedVideos = useMemo(() => {
    return [...allVideos].sort((a, b) => {
      if (a.playbackOrder != null && b.playbackOrder != null)
        return a.playbackOrder - b.playbackOrder;
      if (a.playbackOrder != null) return -1;
      if (b.playbackOrder != null) return 1;
      return (a.techniqueNumber || "999").localeCompare(
        b.techniqueNumber || "999",
        undefined,
        { numeric: true }
      );
    });
  }, [allVideos]);

  const currentIndex = sortedVideos.findIndex((v) => v.id === video.id);
  const upNextVideos = sortedVideos.slice(currentIndex + 1, currentIndex + 4);

  const togglePhase = (fase: string) => {
    setAutoExpandedPhases(new Set());
    setExpandedPhase((prev) => (prev === fase ? null : fase));
    setExpandedGroup(null);
  };

  const handleVideoEnded = useCallback(() => {
    onVideoComplete(video.id);
    const nextVideo = sortedVideos[currentIndex + 1];
    if (nextVideo) {
      setTimeout(() => {
        onVideoChange(nextVideo.id);
      }, 1500);
    }
  }, [video.id, sortedVideos, currentIndex, onVideoComplete, onVideoChange]);

  const [expandedSubgroup, setExpandedSubgroup] = useState<string | null>(null);

  const toggleGroup = (groupNummer: string) => {
    setExpandedGroup((prev) => {
      if (prev === groupNummer) return null;
      setExpandedSubgroup(null);
      return groupNummer;
    });
  };

  const toggleSubgroup = (subgroupNummer: string) => {
    setExpandedSubgroup((prev) => (prev === subgroupNummer ? null : subgroupNummer));
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
        color: PHASE_COLORS[fase],
      };
    });
  }, []);

  return (
    <div ref={pageRef} className="p-3 lg:p-4 min-h-0">
      <div className="mb-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-hh-muted hover:text-hh-text transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Terug naar Video Bibliotheek
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        <div className="hidden lg:block lg:w-[300px] lg:min-w-[300px] lg:max-w-[300px] flex-shrink-0 order-2 lg:order-1 lg:sticky lg:top-4 lg:self-start overflow-hidden" style={{ contain: 'layout', width: '300px', minWidth: '300px', maxWidth: '300px' }}>
          <div className="bg-hh-card border border-hh-border rounded-xl overflow-hidden w-full">
            <div className="px-3 py-2.5 border-b border-hh-border">
              <h2 className="text-xs font-bold text-hh-text flex items-center gap-1.5 uppercase tracking-wide">
                <BookOpen className="w-3.5 h-3.5" />
                E.P.I.C. Technique
              </h2>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[10px] text-hh-muted">
                  {currentIndex + 1} / {sortedVideos.length} video's
                </p>
                {timeline.length > 0 && activeTimelineTechnique && (
                  <span className="flex items-center gap-1 text-[9px] text-[#2563eb] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-pulse" />
                    Actief
                  </span>
                )}
              </div>
            </div>

            <div ref={navigatorRef} className="max-h-[calc(100vh-180px)] overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {phaseData.map(({ fase, name, techniques, topLevel, color }) => {
                const isExpanded = expandedPhase === fase || autoExpandedPhases.has(fase);
                const techCount = techniques.length;
                const completedInPhase = techniques.filter((t) =>
                  sortedVideos.some(
                    (v) => v.techniqueNumber === t.nummer && completedVideoIds.has(v.id)
                  )
                ).length;

                const renderTechItem = (tech: Techniek, indent: number = 0) => {
                  const isPrimary = tech.nummer === video.techniqueNumber;
                  const isHighlighted = videoTechniqueIds.has(tech.nummer);
                  const isLiveActive = activeTimelineTechnique === tech.nummer;
                  const isActive = isPrimary || isHighlighted || isLiveActive;
                  const hasVideo = sortedVideos.some(
                    (v) => v.techniqueNumber === tech.nummer
                  );
                  const videoForTech = sortedVideos.find(
                    (v) => v.techniqueNumber === tech.nummer
                  );
                  const isCompleted = videoForTech
                    ? completedVideoIds.has(videoForTech.id)
                    : false;
                  const techConfidence = video.technieken?.find(t => t.techniek_id === tech.nummer);

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
                        ...(isLiveActive ? {
                          backgroundColor: "rgba(37,99,235,0.08)",
                          borderLeft: "3px solid #2563eb",
                          boxShadow: "0 0 8px rgba(37,99,235,0.15)",
                        } : isPrimary ? {
                          backgroundColor: "rgba(30,58,95,0.06)",
                          borderLeft: "3px solid #1e3a5f",
                        } : isHighlighted ? {
                          backgroundColor: "rgba(30,58,95,0.03)",
                          borderLeft: "2px solid rgba(30,58,95,0.4)",
                        } : {}),
                      }}
                      onClick={() => {
                        setDetailTechnique(tech);
                      }}
                    >
                      <div className="flex-shrink-0 w-4">
                        {isLiveActive ? (
                          <div className="w-3.5 h-3.5 rounded-full animate-pulse" style={{ backgroundColor: "#2563eb" }} />
                        ) : isPrimary ? (
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: "#1e3a5f" }} />
                        ) : isHighlighted ? (
                          <Tag className="w-3 h-3" style={{ color: "#1e3a5f" }} />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#3d9a6e" }} />
                        ) : null}
                      </div>
                      <span className={`text-[10px] font-mono flex-shrink-0 ${isLiveActive ? "text-[#2563eb] font-bold" : isActive ? "text-[#1e3a5f] font-semibold" : "text-hh-muted"}`} style={{ minWidth: "28px" }}>
                        {tech.nummer}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[11px] leading-tight truncate ${
                            isLiveActive
                              ? "font-bold text-[#2563eb]"
                              : isActive
                              ? "font-semibold text-[#1e3a5f]"
                              : hasVideo
                              ? "text-hh-text"
                              : "text-hh-muted"
                          }`}
                          title={tech.naam}
                        >
                          {tech.naam}
                        </p>
                        {isLiveActive && (
                          <p className="text-[9px] text-[#2563eb]/70 mt-0.5 truncate" title={timeline.find(s => s.techniek_id === tech.nummer && Math.floor(currentTime) >= s.start_seconds && Math.floor(currentTime) < s.end_seconds)?.label || 'Nu besproken'}>
                            {timeline.find(s => s.techniek_id === tech.nummer && Math.floor(currentTime) >= s.start_seconds && Math.floor(currentTime) < s.end_seconds)?.label || 'Nu besproken'}
                          </p>
                        )}
                      </div>
                      {isHighlighted && techConfidence && !isPrimary && !isLiveActive && (
                        <span className="text-[8px] text-[#1e3a5f]/60 font-mono flex-shrink-0">
                          {Math.round(techConfidence.confidence * 100)}%
                        </span>
                      )}
                      <button
                        className="text-hh-muted/30 flex-shrink-0 hover:text-hh-muted/70 transition-colors p-1.5 rounded-md hover:bg-hh-ui-50 ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailTechnique(tech);
                        }}
                        title="Info over deze techniek"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>
                  );
                };

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
                        <p className="text-xs font-semibold text-hh-text truncate">{name}</p>
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
                            const grandchildren = techniques.filter((t) => t.parent === child.nummer);
                            allDescendants.push(...grandchildren);
                          });
                          const allGroupTechs = [group, ...allDescendants];
                          const groupHasActive = allGroupTechs.some(
                            (t) => t.nummer === video.techniqueNumber || videoTechniqueIds.has(t.nummer)
                          );
                          const isGroupSelfActive = group.nummer === video.techniqueNumber || videoTechniqueIds.has(group.nummer);
                          const groupVideo = sortedVideos.find(
                            (v) => v.techniqueNumber === group.nummer
                          );
                          const groupHasVideo = !!groupVideo;
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
                                  marginLeft: isGroupSelfActive ? undefined : "8px",
                                  ...(isGroupSelfActive ? {
                                    backgroundColor: "rgba(30,58,95,0.06)",
                                    borderLeft: "3px solid #1e3a5f",
                                  } : {}),
                                }}
                                onClick={() => {
                                  toggleGroup(group.nummer);
                                }}
                              >
                                <div className="flex-shrink-0 w-4">
                                  {isGroupSelfActive ? (
                                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: "#1e3a5f" }} />
                                  ) : isGroupCompleted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#3d9a6e" }} />
                                  ) : isGroupExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-hh-muted" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-hh-muted" />
                                  )}
                                </div>
                                <span className={`text-[10px] font-mono flex-shrink-0 ${groupHasActive || isGroupSelfActive ? "text-[#1e3a5f] font-semibold" : "text-hh-muted"}`} style={{ minWidth: "28px" }}>
                                  {group.nummer}
                                </span>
                                <p className={`text-[11px] leading-tight truncate flex-1 ${groupHasActive || isGroupSelfActive ? "font-semibold text-[#1e3a5f]" : "text-hh-text"}`} title={group.naam}>
                                  {group.naam}
                                </p>
                                <span className="text-[9px] text-hh-muted flex-shrink-0 mr-1">
                                  {group.children.length}
                                </span>
                                <button
                                  className="text-hh-muted/30 flex-shrink-0 hover:text-hh-muted/70 transition-colors p-1.5 rounded-md hover:bg-hh-ui-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailTechnique(group);
                                  }}
                                  title="Info over deze techniek"
                                >
                                  <Info className="w-3 h-3" />
                                </button>
                              </div>
                              {isGroupExpanded && (
                                <div>
                                  {group.children.map((child) => {
                                    const grandchildren = techniques.filter((t) => t.parent === child.nummer);
                                    if (grandchildren.length > 0) {
                                      const isSubExpanded = expandedSubgroup === child.nummer;
                                      const subHasActive = grandchildren.some(gc => gc.nummer === video.techniqueNumber || videoTechniqueIds.has(gc.nummer));
                                      const childIsActive = child.nummer === video.techniqueNumber || videoTechniqueIds.has(child.nummer);
                                      const childVideo = sortedVideos.find(v => v.techniqueNumber === child.nummer);
                                      const childCompleted = childVideo ? completedVideoIds.has(childVideo.id) : false;
                                      return (
                                        <div key={child.nummer}>
                                          <div
                                            ref={(el) => { techItemRefs.current[child.nummer] = el; }}
                                            className={`flex items-center gap-1.5 pr-2 cursor-pointer transition-colors ${
                                              childIsActive ? "rounded-lg mx-2 my-0.5 px-3 py-2" : "px-3 py-1.5 hover:bg-hh-ui-50/30"
                                            }`}
                                            style={{
                                              marginLeft: childIsActive ? undefined : "16px",
                                              ...(childIsActive ? { backgroundColor: "rgba(30,58,95,0.06)", borderLeft: "3px solid #1e3a5f" } : {}),
                                            }}
                                            onClick={() => toggleSubgroup(child.nummer)}
                                          >
                                            <div className="flex-shrink-0 w-4">
                                              {childIsActive ? (
                                                <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: "#1e3a5f" }} />
                                              ) : childCompleted ? (
                                                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#3d9a6e" }} />
                                              ) : isSubExpanded ? (
                                                <ChevronDown className="w-3 h-3 text-hh-muted" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3 text-hh-muted" />
                                              )}
                                            </div>
                                            <span className={`text-[10px] font-mono flex-shrink-0 ${subHasActive || childIsActive ? "text-[#1e3a5f] font-semibold" : "text-hh-muted"}`} style={{ minWidth: "28px" }}>
                                              {child.nummer}
                                            </span>
                                            <p className={`text-[11px] leading-tight truncate flex-1 ${subHasActive || childIsActive ? "font-semibold text-[#1e3a5f]" : "text-hh-text"}`} title={child.naam}>
                                              {child.naam}
                                            </p>
                                            <button
                                              className="text-hh-muted/30 flex-shrink-0 hover:text-hh-muted/70 transition-colors p-1.5 rounded-md hover:bg-hh-ui-50"
                                              onClick={(e) => { e.stopPropagation(); setDetailTechnique(child); }}
                                              title="Info over deze techniek"
                                            >
                                              <Info className="w-3 h-3" />
                                            </button>
                                          </div>
                                          {isSubExpanded && grandchildren.map((gc) => renderTechItem(gc, 2))}
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

        <div className="flex-1 min-w-0 space-y-4 order-1 lg:order-2">
          <div className="relative rounded-xl overflow-hidden bg-black shadow-lg">
            <MuxVideoPlayer
              key={video.id}
              playbackId={video.muxPlaybackId}
              videoId={video.id}
              title={video.displayTitle || video.title}
              techniekId={video.techniqueNumber}
              autoPlay={true}
              onEnded={handleVideoEnded}
              onProgress={handleTimeUpdate}
              className="w-full aspect-video"
            />
          </div>

          <div className="space-y-3">
            <div>
              <h1 className="text-sm lg:text-base font-bold text-hh-text leading-tight">
                {video.displayTitle || video.title}
              </h1>
              <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] text-hh-muted">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </span>
                {technique && (
                  <Badge variant="outline" className="text-[10px] text-hh-muted border-hh-border px-1.5 py-0">
                    {getFaseNaam(technique.fase)}
                  </Badge>
                )}
                {completedVideoIds.has(video.id) && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "#3d9a6e" }}>
                    <CheckCircle2 className="w-3 h-3" />
                    Bekeken
                  </span>
                )}
              </div>

              {videoTechniqueList.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Tag className="w-3 h-3 text-hh-muted" />
                  {videoTechniqueList.map((vt) => {
                    const t = getTechniekByNummer(vt.techniek_id);
                    if (!t) return null;
                    const phaseColor = PHASE_COLORS[String(t.fase)] || "#475569";
                    const isPrimary = vt.is_primary;
                    return (
                      <button
                        key={t.nummer}
                        onClick={() => scrollToTechnique(t.nummer)}
                        onDoubleClick={() => setDetailTechnique(t)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors hover:opacity-90 cursor-pointer"
                        style={{
                          backgroundColor: `${phaseColor}${isPrimary ? '20' : '10'}`,
                          color: phaseColor,
                          border: `1px solid ${phaseColor}${isPrimary ? '50' : '25'}`,
                          fontWeight: isPrimary ? 600 : 400,
                        }}
                        title={`${isPrimary ? 'Hoofdtechniek' : 'Ook besproken'} — dubbelklik voor details`}
                      >
                        #{t.nummer} {t.naam}
                        {!isPrimary && vt.confidence < 1 && (
                          <span className="opacity-50 ml-0.5">{Math.round(vt.confidence * 100)}%</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {video.aiSummary && (
              <Card className="bg-hh-card border-hh-border p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-hh-muted" />
                  <h3 className="text-xs font-semibold text-hh-text">Samenvatting</h3>
                </div>
                <p className="text-xs text-hh-muted leading-relaxed">{video.aiSummary}</p>
              </Card>
            )}

            <div className="lg:hidden">
              <div className="bg-hh-card border border-hh-border rounded-xl overflow-hidden">
                <div className="px-3 py-2.5 border-b border-hh-border">
                  <h2 className="text-xs font-bold text-hh-text flex items-center gap-1.5 uppercase tracking-wide">
                    <BookOpen className="w-3.5 h-3.5" />
                    E.P.I.C. Technique
                  </h2>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-hh-muted">
                      {currentIndex + 1} / {sortedVideos.length} video's
                    </p>
                    {timeline.length > 0 && activeTimelineTechnique && (
                      <span className="flex items-center gap-1 text-[9px] text-[#2563eb] font-semibold">
                        <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-pulse" />
                        Actief
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {phaseData.map(({ fase, name, techniques, topLevel, color }) => {
                    const isExpanded = expandedPhase === fase || autoExpandedPhases.has(fase);
                    const techCount = techniques.length;
                    const completedInPhase = techniques.filter((t) =>
                      sortedVideos.some(
                        (v) => v.techniqueNumber === t.nummer && completedVideoIds.has(v.id)
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
                            <p className="text-xs font-semibold text-hh-text truncate">{name}</p>
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
                            {techniques.map((tech) => {
                              const isPrimary = tech.nummer === video.techniqueNumber;
                              const isHighlighted = videoTechniqueIds.has(tech.nummer);
                              const isLiveActive = activeTimelineTechnique === tech.nummer;
                              const isActive = isPrimary || isHighlighted || isLiveActive;
                              const hasVideo = sortedVideos.some((v) => v.techniqueNumber === tech.nummer);

                              return (
                                <div
                                  key={tech.nummer}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-all text-left ${
                                    isActive ? "rounded-lg mx-2 my-0.5 px-3 py-2" : "hover:bg-hh-ui-50/30"
                                  }`}
                                  style={{
                                    marginLeft: isActive ? undefined : "8px",
                                    ...(isLiveActive ? {
                                      backgroundColor: "rgba(37,99,235,0.08)",
                                      borderLeft: "3px solid #2563eb",
                                    } : isPrimary ? {
                                      backgroundColor: "rgba(30,58,95,0.06)",
                                      borderLeft: "3px solid #1e3a5f",
                                    } : isHighlighted ? {
                                      backgroundColor: "rgba(30,58,95,0.03)",
                                      borderLeft: "2px solid rgba(30,58,95,0.4)",
                                    } : {}),
                                  }}
                                  onClick={() => setDetailTechnique(tech)}
                                >
                                  <div className="flex-shrink-0 w-4">
                                    {isLiveActive ? (
                                      <div className="w-3.5 h-3.5 rounded-full animate-pulse" style={{ backgroundColor: "#2563eb" }} />
                                    ) : isPrimary ? (
                                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: "#1e3a5f" }} />
                                    ) : null}
                                  </div>
                                  <span className={`text-[10px] font-mono flex-shrink-0 ${isLiveActive ? "text-[#2563eb] font-bold" : isActive ? "text-[#1e3a5f] font-semibold" : "text-hh-muted"}`} style={{ minWidth: "28px" }}>
                                    {tech.nummer}
                                  </span>
                                  <p className={`text-[11px] leading-tight truncate flex-1 ${
                                    isLiveActive ? "font-bold text-[#2563eb]" : isActive ? "font-semibold text-[#1e3a5f]" : hasVideo ? "text-hh-text" : "text-hh-muted"
                                  }`} title={tech.naam}>
                                    {tech.naam}
                                  </p>
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

            {upNextVideos.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-hh-text mb-2 flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-hh-muted" />
                  Hierna
                </h3>
                <div className="space-y-1.5">
                  {upNextVideos.map((v) => {
                    const vTech = v.techniqueNumber
                      ? getTechniekByNummer(v.techniqueNumber)
                      : null;
                    const isCompleted = completedVideoIds.has(v.id);
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-hh-card border border-hh-border hover:border-hh-text/20 cursor-pointer transition-all group"
                        onClick={() => onVideoChange(v.id)}
                      >
                        <div className="w-20 h-12 rounded-md overflow-hidden flex-shrink-0 bg-hh-ui-100 relative">
                          <img
                            src={v.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                            <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-hh-text line-clamp-1">
                            {v.displayTitle || v.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-hh-muted">{v.duration}</span>
                            {vTech && (
                              <span className="text-[10px] text-hh-muted">
                                · {getFaseNaam(vTech.fase)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#3d9a6e" }} />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-hh-muted" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DetailsSheet
        open={!!detailTechnique}
        onOpenChange={(open) => {
          if (!open) setDetailTechnique(null);
        }}
        title={detailTechnique ? `#${detailTechnique.nummer} ${detailTechnique.naam}` : ""}
        subtitle={detailTechnique ? getFaseNaam(detailTechnique.fase) : ""}
        badges={
          detailTechnique ? (
            <Badge
              className="text-white border-0 text-xs"
              style={{
                backgroundColor: PHASE_COLORS[detailTechnique.fase] || "#6b7280",
              }}
            >
              Fase {detailTechnique.fase}
            </Badge>
          ) : undefined
        }
      >
        <TechniqueContent technique={detailTechnique} />
      </DetailsSheet>
    </div>
  );
}

export default VideoWatchPage;
