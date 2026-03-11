import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiFetch } from "../../services/apiFetch";
import { videoApi } from "@/services/videoApi";
import { MuxVideoPlayer } from "./MuxVideoPlayer";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import {
  getTechniekByNummer,
  getFaseNaam,
  Techniek,
} from "@/data/technieken-service";
import { DetailsSheet, TechniqueContent } from "./DetailsSheet";
import { EpicSidebar } from "./EpicSidebar";
import {
  ChevronLeft,
  Clock,
  Tag,
  BookOpen,
  Pencil,
  X,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ADMIN_PHASE_COLORS } from "../../utils/phaseColors";
import type { VideoTechniek } from "@/types/video";
import { toast } from "sonner";
import { AdminLayout } from "./AdminLayout";
import { Button } from "../ui/button";
import { AutoResizeTextarea } from "../ui/auto-resize-textarea";
import { Input } from "../ui/input";
import { Save, Target, HelpCircle, Lightbulb, Wrench, ListOrdered, MessageSquare } from "lucide-react";

interface LibraryVideo {
  id: string;
  title: string;
  original_title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  status: string;
  duration: number | null;
  course_module: string | null;
  technique_id: string | null;
  has_transcript: boolean;
  has_rag: boolean;
  has_mux: boolean;
  has_audio: boolean;
  ai_suggested_techniek_id: string | null;
  ai_confidence: number | null;
  drive_file_id: string | null;
  drive_folder_id: string | null;
  source: "pipeline" | "manual";
  playback_order: number | null;
  ai_summary: string | null;
  ai_attractive_title: string | null;
  created_at: string;
  updated_at: string;
  technieken?: VideoTechniek[];
  transcript?: string | null;
  is_hidden?: boolean;
}

interface TimelineSegment {
  start_seconds: number;
  end_seconds: number;
  techniek_id: string;
  label: string;
}

interface AdminVideoWatchPageProps {
  navigate?: (page: string, data?: Record<string, any>) => void;
  isSuperAdmin?: boolean;
  navigationData?: Record<string, any>;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AdminVideoWatchPage({
  navigate,
  isSuperAdmin = false,
  navigationData,
}: AdminVideoWatchPageProps) {
  const videoId = navigationData?.videoId as string | undefined;
  const [video, setVideo] = useState<LibraryVideo | null>(null);
  const [allVideos, setAllVideos] = useState<LibraryVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailTechnique, setDetailTechnique] = useState<Techniek | null>(null);

  // Timeline state (for live active tracking in sidebar)
  const [timeline, setTimeline] = useState<TimelineSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const lastTimeUpdateRef = useRef(0);

  // Edit states per section
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [editSummaryValue, setEditSummaryValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  // Technique edit state (same pattern as AdminTechniqueManagement)
  const [editingTechniqueCode, setEditingTechniqueCode] = useState<string | null>(null);
  const [editedTechniqueData, setEditedTechniqueData] = useState<Record<string, any> | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  // Load video data
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const library = await videoApi.getLibrary(undefined, undefined, true);
        if (cancelled) return;

        const found = library.find((v) => v.id === videoId);
        if (found) {
          setVideo(found as LibraryVideo);

          // Fetch transcript if available
          if (found.has_transcript) {
            try {
              const res = await apiFetch(
                `/api/admin-video/videos/${found.id}/transcript`
              );
              if (res.ok) {
                const data = await res.json();
                if (!cancelled) {
                  setVideo((prev) =>
                    prev
                      ? {
                          ...prev,
                          transcript: data.transcript || null,
                          ai_summary: data.ai_summary || prev.ai_summary,
                        }
                      : null
                  );
                }
              }
            } catch {}
          }
        }

        setAllVideos(
          library
            .filter((v) => v.mux_playback_id && v.status === "completed")
            .sort((a, b) => {
              if (a.playback_order != null && b.playback_order != null)
                return a.playback_order - b.playback_order;
              if (a.playback_order != null) return -1;
              if (b.playback_order != null) return 1;
              const techA =
                a.technique_id || a.ai_suggested_techniek_id || "999";
              const techB =
                b.technique_id || b.ai_suggested_techniek_id || "999";
              return techA.localeCompare(techB, undefined, { numeric: true });
            }) as LibraryVideo[]
        );
      } catch (err) {
        console.error("Failed to load video:", err);
        toast.error("Video laden mislukt");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Load timeline
  useEffect(() => {
    if (!video?.id) return;
    let cancelled = false;
    setTimeline([]);

    apiFetch(`/api/videos/timeline?video_id=${video.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.timeline?.length > 0) {
          setTimeline(data.timeline);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [video?.id]);

  const handleTimeUpdate = useCallback((time: number, _duration: number) => {
    const now = Date.now();
    if (now - lastTimeUpdateRef.current < 500) return;
    lastTimeUpdateRef.current = now;
    setCurrentTime(time);
  }, []);

  // Derived data
  const techniqueNumber = video
    ? video.technique_id || video.ai_suggested_techniek_id || null
    : null;
  const technique = techniqueNumber
    ? getTechniekByNummer(techniqueNumber)
    : null;
  const displayTitle = video
    ? video.title
    : "";
  const duration = formatDuration(video?.duration ?? null);

  const videoTechniqueIds = useMemo(() => {
    const ids = new Set<string>();
    if (video?.technieken && video.technieken.length > 0) {
      video.technieken.forEach((t) => ids.add(t.techniek_id));
    }
    if (techniqueNumber && !ids.has(techniqueNumber)) {
      ids.add(techniqueNumber);
    }
    return ids;
  }, [video?.technieken, techniqueNumber]);

  const videoTechniqueList = useMemo(() => {
    if (video?.technieken && video.technieken.length > 0) {
      return video.technieken
        .filter((t) => getTechniekByNummer(t.techniek_id))
        .sort((a, b) => b.confidence - a.confidence);
    }
    if (techniqueNumber) {
      const t = getTechniekByNummer(techniqueNumber);
      if (t)
        return [
          {
            techniek_id: techniqueNumber,
            confidence: 1,
            source: "primary",
            is_primary: true,
          },
        ];
    }
    return [];
  }, [video?.technieken, techniqueNumber]);

  const currentIndex = allVideos.findIndex((v) => v.id === video?.id);

  const sidebarVideos = useMemo(
    () =>
      allVideos.map((v) => ({
        id: v.id,
        techniqueNumber:
          v.technique_id || v.ai_suggested_techniek_id || "",
        playbackOrder: v.playback_order,
      })),
    [allVideos]
  );

  // Save handlers
  const handleSaveTitle = async () => {
    if (!video) return;
    setIsSaving(true);
    try {
      if (isSuperAdmin) {
        await apiFetch("/api/admin-video/videos/update-title", {
          method: "POST",
          body: JSON.stringify({
            videoId: video.id,
            field: "ai_attractive_title",
            value: editTitleValue,
          }),
        });
        setVideo((prev) =>
          prev ? { ...prev, ai_attractive_title: editTitleValue } : null
        );
        toast.success("Titel opgeslagen");
      } else {
        await apiFetch("/api/v2/admin/corrections", {
          method: "POST",
          body: JSON.stringify({
            type: "video",
            field: "ai_attractive_title",
            originalValue: video.ai_attractive_title || "",
            newValue: editTitleValue,
            source: "video_edit",
            submittedBy: "hugo",
            context: JSON.stringify({
              videoId: video.id,
              videoTitle: video.title,
            }),
          }),
        });
        toast.success("Wijziging ingediend ter goedkeuring");
      }
      setEditingTitle(false);
    } catch (err) {
      toast.error("Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!video) return;
    setIsSaving(true);
    try {
      if (isSuperAdmin) {
        await apiFetch(`/api/admin-video/videos/${video.id}/summary`, {
          method: "POST",
          body: JSON.stringify({ summary: editSummaryValue }),
        });
        setVideo((prev) =>
          prev ? { ...prev, ai_summary: editSummaryValue } : null
        );
        toast.success("Samenvatting opgeslagen");
      } else {
        await apiFetch("/api/v2/admin/corrections", {
          method: "POST",
          body: JSON.stringify({
            type: "video",
            field: "ai_summary",
            originalValue: video.ai_summary || "",
            newValue: editSummaryValue,
            source: "video_edit",
            submittedBy: "hugo",
            context: JSON.stringify({
              videoId: video.id,
              videoTitle: video.title,
            }),
          }),
        });
        toast.success("Wijziging ingediend ter goedkeuring");
      }
      setEditingSummary(false);
    } catch (err) {
      toast.error("Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  // Technique edit handlers (same pattern as AdminTechniqueManagement)
  const startEditingTechnique = (techniqueCode: string) => {
    const tech = getTechniekByNummer(techniqueCode);
    if (tech) {
      setEditedTechniqueData({
        naam: tech.naam || "",
        doel: tech.doel || "",
        wat: tech.wat || "",
        waarom: tech.waarom || "",
        wanneer: tech.wanneer || "",
        hoe: tech.hoe || "",
        stappenplan: tech.stappenplan || [],
        voorbeeld: tech.voorbeeld || [],
        tags: tech.tags || [],
      });
      setEditingTechniqueCode(techniqueCode);
      setDetailTechnique(null);
    }
  };

  const handleSaveTechnique = async () => {
    if (!editingTechniqueCode || !editedTechniqueData) return;
    const originalTech = getTechniekByNummer(editingTechniqueCode);
    const mergedTechnique = { ...originalTech, ...editedTechniqueData, nummer: originalTech?.nummer, fase: originalTech?.fase };

    const changedFields: string[] = [];
    for (const key of Object.keys(editedTechniqueData)) {
      const origVal = JSON.stringify((originalTech as any)?.[key]);
      const newVal = JSON.stringify((editedTechniqueData as any)[key]);
      if (origVal !== newVal) changedFields.push(key);
    }

    if (changedFields.length === 0) {
      toast.info("Geen wijzigingen gedetecteerd");
      setEditingTechniqueCode(null);
      setEditedTechniqueData(null);
      return;
    }

    try {
      const response = await apiFetch("/api/v2/admin/corrections", {
        method: "POST",
        body: JSON.stringify({
          type: "technique",
          field: `${editingTechniqueCode} - ${originalTech?.naam || ""}`,
          originalValue: changedFields.map((f) => `${f}: ${JSON.stringify((originalTech as any)?.[f])}`).join("\n"),
          newValue: changedFields.map((f) => `${f}: ${JSON.stringify((editedTechniqueData as any)[f])}`).join("\n"),
          context: `Techniek ${editingTechniqueCode} bewerkt. Gewijzigde velden: ${changedFields.join(", ")}`,
          submittedBy: "Hugo",
          source: "technique_edit",
          targetFile: "technieken_index.json",
          targetKey: editingTechniqueCode,
          originalJson: JSON.stringify(originalTech),
          newJson: JSON.stringify(mergedTechnique),
        }),
      });

      if (response.ok) {
        toast.success("Wijziging ingediend voor review door superadmin");
      } else {
        const err = await response.json();
        toast.error(`Fout: ${err.error || "Opslaan mislukt"}`);
      }
    } catch {
      toast.error("Netwerk fout bij opslaan");
    }

    setEditingTechniqueCode(null);
    setEditedTechniqueData(null);
  };

  // Loading state
  if (isLoading || !video) {
    return (
      <AdminLayout currentPage="admin-video-detail" navigate={navigate} isSuperAdmin={isSuperAdmin}>
        <div className="p-3 lg:p-4">
          <button
            onClick={() => navigate?.("admin-videos")}
            className="flex items-center gap-1.5 text-sm text-hh-muted hover:text-hh-text transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Terug naar Video Beheer
          </button>
          <div className="flex items-center justify-center h-64">
            <div className="text-hh-muted text-sm">
              {isLoading ? "Video laden..." : "Video niet gevonden"}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="admin-video-detail" navigate={navigate} isSuperAdmin={isSuperAdmin}>
    <div ref={pageRef} className="p-3 lg:p-4 min-h-0">
      {/* Back button — identical styling to VideoWatchPage */}
      <div className="mb-3">
        <button
          onClick={() => navigate?.("admin-videos")}
          className="flex items-center gap-1.5 text-sm text-hh-muted hover:text-hh-text transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Terug naar Video Beheer
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        {/* E.P.I.C. Sidebar — identical to user view */}
        <div
          className="hidden lg:block lg:w-[300px] lg:min-w-[300px] lg:max-w-[300px] flex-shrink-0 order-2 lg:order-1 lg:sticky lg:top-4 lg:self-start overflow-hidden"
          style={{
            contain: "layout",
            width: "300px",
            minWidth: "300px",
            maxWidth: "300px",
          }}
        >
          <EpicSidebar
            videoTechniqueIds={videoTechniqueIds}
            primaryTechniqueNumber={techniqueNumber || undefined}
            allVideos={sidebarVideos}
            currentIndex={currentIndex >= 0 ? currentIndex : 0}
            totalVideos={allVideos.length}
            timeline={timeline}
            currentTime={currentTime}
            onTechniqueClick={(tech) => setDetailTechnique(tech)}
            variant="admin"
            maxHeight="calc(100vh - 180px)"
          />
        </div>

        {/* Main content — identical layout to VideoWatchPage */}
        <div className="flex-1 min-w-0 space-y-4 order-1 lg:order-2">
          {/* Video player — identical to VideoWatchPage */}
          {video.mux_playback_id && (
            <div className="relative rounded-xl overflow-hidden bg-black shadow-lg">
              <MuxVideoPlayer
                key={video.id}
                playbackId={video.mux_playback_id}
                videoId={video.id}
                title={displayTitle}
                techniekId={techniqueNumber || undefined}
                autoPlay={false}
                onProgress={handleTimeUpdate}
                className="w-full aspect-video"
              />
            </div>
          )}

          <div className="space-y-3">
            {/* Title + metadata row — identical to VideoWatchPage + edit button */}
            <div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    className="flex-1 text-sm lg:text-base font-bold text-hh-text bg-hh-bg border border-hh-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-hh-primary"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={isSaving}
                    className="p-1.5 rounded-md bg-hh-primary text-white hover:bg-hh-primary/90 transition-colors"
                    aria-label="Opslaan"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingTitle(false)}
                    className="p-1.5 rounded-md text-hh-muted hover:text-hh-text hover:bg-hh-ui-50 transition-colors"
                    aria-label="Annuleren"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-sm lg:text-base font-bold text-hh-text leading-tight">
                    {displayTitle}
                  </h1>
                  <button
                    onClick={() => {
                      setEditTitleValue(displayTitle);
                      setEditingTitle(true);
                    }}
                    className="text-hh-muted/30 group-hover:text-hh-muted hover:text-hh-primary transition-colors p-1 rounded-md hover:bg-hh-ui-50"
                    title="Titel bewerken"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] text-hh-muted">
                  <Clock className="w-3 h-3" />
                  {duration}
                </span>
                {technique && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-hh-muted border-hh-border px-3 py-1"
                  >
                    {getFaseNaam(technique.fase)}
                  </Badge>
                )}
                {video.ai_confidence != null && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-hh-primary border-hh-primary/20 px-3 py-1"
                  >
                    AI {Math.round(video.ai_confidence * 100)}%
                  </Badge>
                )}
              </div>

              {/* Tags — identical to VideoWatchPage */}
              {videoTechniqueList.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Tag className="w-3 h-3 text-hh-muted" />
                  {videoTechniqueList.map((vt) => {
                    const t = getTechniekByNummer(vt.techniek_id);
                    if (!t) return null;
                    const phaseColor =
                      ADMIN_PHASE_COLORS[String(t.fase)] || "var(--hh-muted)";
                    const isPrimary = vt.is_primary;
                    return (
                      <button
                        key={t.nummer}
                        onClick={() => setDetailTechnique(t)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-3 py-1 rounded-full transition-colors hover:opacity-90 cursor-pointer"
                        style={{
                          backgroundColor: `${phaseColor}${isPrimary ? "20" : "10"}`,
                          color: phaseColor,
                          border: `1px solid ${phaseColor}${isPrimary ? "50" : "25"}`,
                          fontWeight: isPrimary ? 600 : 400,
                        }}
                        title={`${isPrimary ? "Hoofdtechniek" : "Ook besproken"} — klik voor details`}
                      >
                        #{t.nummer} {t.naam}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary — identical to VideoWatchPage + edit button */}
            {(video.ai_summary || editingSummary) && (
              <Card className="bg-hh-card border-hh-border p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-hh-muted" />
                  <h3 className="text-xs font-semibold text-hh-text">
                    Samenvatting
                  </h3>
                  {!editingSummary && (
                    <button
                      onClick={() => {
                        setEditSummaryValue(video.ai_summary || "");
                        setEditingSummary(true);
                      }}
                      className="text-hh-muted/30 hover:text-hh-primary transition-colors p-1 rounded-md hover:bg-hh-ui-50 ml-auto"
                      title="Samenvatting bewerken"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {editingSummary ? (
                  <div className="space-y-2">
                    <textarea
                      value={editSummaryValue}
                      onChange={(e) => setEditSummaryValue(e.target.value)}
                      className="w-full text-xs text-hh-text bg-hh-bg border border-hh-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-hh-primary min-h-[100px] resize-y leading-relaxed"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingSummary(false)}
                        className="text-xs text-hh-muted hover:text-hh-text px-3 py-1 rounded-md hover:bg-hh-ui-50 transition-colors"
                      >
                        Annuleer
                      </button>
                      <button
                        onClick={handleSaveSummary}
                        disabled={isSaving}
                        className="text-xs text-white bg-hh-primary hover:bg-hh-primary/90 px-3 py-1 rounded-md transition-colors"
                      >
                        {isSaving ? "Opslaan..." : "Opslaan"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-hh-muted leading-relaxed">
                    {video.ai_summary}
                  </p>
                )}
              </Card>
            )}

            {/* Transcript — admin-specific section replacing "Up Next" */}
            {video.transcript && (
              <Card className="bg-hh-card border-hh-border p-3">
                <button
                  onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-hh-muted" />
                  <h3 className="text-xs font-semibold text-hh-text flex-1">
                    Transcript
                  </h3>
                  {transcriptExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-hh-muted" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-hh-muted" />
                  )}
                </button>
                {transcriptExpanded && (
                  <p className="text-xs text-hh-muted leading-relaxed mt-2 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
                    {video.transcript}
                  </p>
                )}
              </Card>
            )}

            {/* Mobile E.P.I.C. Sidebar */}
            <div className="lg:hidden">
              <EpicSidebar
                videoTechniqueIds={videoTechniqueIds}
                primaryTechniqueNumber={techniqueNumber || undefined}
                allVideos={sidebarVideos}
                currentIndex={currentIndex >= 0 ? currentIndex : 0}
                totalVideos={allVideos.length}
                timeline={timeline}
                currentTime={currentTime}
                onTechniqueClick={(tech) => setDetailTechnique(tech)}
                variant="admin"
                maxHeight="50vh"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DetailsSheet — identical to VideoWatchPage, admin variant */}
      {/* View DetailsSheet — with "Bewerken" footer (same as AdminTechniqueManagement) */}
      <DetailsSheet
        open={!!detailTechnique}
        onOpenChange={(open) => {
          if (!open) setDetailTechnique(null);
        }}
        title={
          detailTechnique
            ? `#${detailTechnique.nummer} ${detailTechnique.naam}`
            : ""
        }
        subtitle={detailTechnique ? getFaseNaam(detailTechnique.fase) : ""}
        variant="admin"
        badges={
          detailTechnique ? (
            <Badge
              className="text-white border-0 text-xs"
              style={{
                backgroundColor:
                  ADMIN_PHASE_COLORS[detailTechnique.fase] || "var(--hh-muted)",
              }}
            >
              Fase {detailTechnique.fase}
            </Badge>
          ) : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailTechnique(null)}>
              Sluiten
            </Button>
            <Button
              className="text-white hover:opacity-90 bg-hh-primary"
              onClick={() => {
                if (detailTechnique) {
                  startEditingTechnique(detailTechnique.nummer);
                }
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Bewerken
            </Button>
          </>
        }
      >
        <TechniqueContent technique={detailTechnique} variant="admin" />
      </DetailsSheet>

      {/* Edit Technique Sheet — same pattern as AdminTechniqueManagement */}
      <DetailsSheet
        open={!!editingTechniqueCode}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTechniqueCode(null);
            setEditedTechniqueData(null);
          }
        }}
        variant="admin"
        badges={
          editingTechniqueCode ? (
            <Badge className="font-mono text-sm px-3 py-1 bg-hh-primary/15 text-hh-primary border-hh-primary/30">
              {editingTechniqueCode}
            </Badge>
          ) : undefined
        }
        title={
          editedTechniqueData ? (
            <Input
              value={editedTechniqueData.naam}
              onChange={(e) => setEditedTechniqueData({ ...editedTechniqueData, naam: e.target.value })}
              className="text-xl font-semibold border-2 focus-visible:ring-hh-primary focus-visible:border-hh-primary"
              placeholder="Techniek naam"
            />
          ) : "Techniek Bewerken"
        }
        subtitle={
          <span className="flex items-center gap-3 text-[13px]">
            <span>Fase: <strong>{getTechniekByNummer(editingTechniqueCode || "")?.fase}</strong></span>
            <span className="text-xs text-hh-muted">(Nummer en Fase zijn niet bewerkbaar)</span>
          </span>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => { setEditingTechniqueCode(null); setEditedTechniqueData(null); }}>
              Annuleren
            </Button>
            <Button className="text-white hover:opacity-90 gap-2 bg-hh-primary" onClick={handleSaveTechnique}>
              <Save className="w-4 h-4" />
              Opslaan naar Review
            </Button>
          </>
        }
      >
        {editedTechniqueData && (
          <div className="space-y-6">
            <div className="p-4 rounded-lg border bg-hh-primary/5 border-hh-primary/15">
              <div className="flex items-start gap-2 mb-2">
                <Target className="w-4 h-4 mt-0.5 flex-shrink-0 text-hh-primary" />
                <h3 className="text-[13px] font-semibold text-hh-text">Doel</h3>
              </div>
              <AutoResizeTextarea value={editedTechniqueData.doel} onChange={(e) => setEditedTechniqueData({ ...editedTechniqueData, doel: e.target.value })} className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-hh-primary focus:border-hh-primary" placeholder="Doel van de techniek..." minHeight={60} maxHeight={200} />
            </div>
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Wat</h3>
              </div>
              <AutoResizeTextarea value={editedTechniqueData.wat} onChange={(e) => setEditedTechniqueData({ ...editedTechniqueData, wat: e.target.value })} className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-hh-primary focus:border-hh-primary" placeholder="Wat is de techniek..." minHeight={60} maxHeight={200} />
            </div>
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Waarom</h3>
              </div>
              <AutoResizeTextarea value={editedTechniqueData.waarom} onChange={(e) => setEditedTechniqueData({ ...editedTechniqueData, waarom: e.target.value })} className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-hh-primary focus:border-hh-primary" placeholder="Waarom deze techniek gebruiken..." minHeight={60} maxHeight={200} />
            </div>
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <Wrench className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Hoe</h3>
              </div>
              <AutoResizeTextarea value={editedTechniqueData.hoe} onChange={(e) => setEditedTechniqueData({ ...editedTechniqueData, hoe: e.target.value })} className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-hh-primary focus:border-hh-primary" placeholder="Hoe de techniek toepassen..." minHeight={80} maxHeight={300} />
            </div>
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <ListOrdered className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Stappenplan</h3>
                <span className="text-[11px] text-hh-muted">(1 stap per regel)</span>
              </div>
              <AutoResizeTextarea value={(editedTechniqueData.stappenplan || []).join("\n")} onChange={(e) => setEditedTechniqueData({ ...editedTechniqueData, stappenplan: e.target.value.split("\n").filter((s: string) => s.trim()) })} className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-hh-primary focus:border-hh-primary" placeholder={"Stap 1\nStap 2\nStap 3..."} minHeight={80} maxHeight={300} />
            </div>
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Voorbeelden</h3>
                <span className="text-[11px] text-hh-muted">(1 voorbeeld per regel)</span>
              </div>
              <AutoResizeTextarea value={(editedTechniqueData.voorbeeld || []).join("\n")} onChange={(e) => setEditedTechniqueData({ ...editedTechniqueData, voorbeeld: e.target.value.split("\n").filter((s: string) => s.trim()) })} className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-hh-primary focus:border-hh-primary" placeholder={"Voorbeeld 1\nVoorbeeld 2..."} minHeight={80} maxHeight={300} />
            </div>
          </div>
        )}
      </DetailsSheet>
    </div>
    </AdminLayout>
  );
}

export default AdminVideoWatchPage;
