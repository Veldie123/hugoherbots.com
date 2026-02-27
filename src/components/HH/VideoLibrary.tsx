import { useState, useEffect } from "react";
import type { VideoTechniek } from "@/types/video";
import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { MuxVideoPlayer } from "./MuxVideoPlayer";
import { ImmersiveVideoPlayer } from "./ImmersiveVideoPlayer";
import { VideoWatchPage } from "./VideoWatchPage";
import { DetailsSheet, TechniqueContent } from './DetailsSheet';
import {
  Search,
  List,
  LayoutGrid,
  Video,
  Play,
  Clock,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  VideoIcon,
  Eye,
  MessageSquare,
  Info,
  Target,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Lock,
  CheckCircle2,
  Radio,
  Zap,
  MoreVertical,
  Pencil,
  Check,
  X,
  BookOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { videoApi } from "@/services/videoApi";
import { getTechniekByNummer } from "@/data/technieken-service";
import { videos as fallbackVideos } from "../../data/videos-data";

const getDisplayTitle = (techniqueNumber: string) => {
  if (!techniqueNumber) return null;
  const technique = getTechniekByNummer(techniqueNumber);
  if (!technique) return null;
  return `#${techniqueNumber} ${technique.naam}`;
};

interface LibraryVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  mux_playback_id: string | null;
  status: string;
  duration: number | null;
  course_module: string | null;
  technique_id: string | null;
  ai_suggested_techniek_id: string | null;
  playback_order: number | null;
  ai_summary: string | null;
  ai_attractive_title: string | null;
  created_at: string;
  technieken?: VideoTechniek[];
}

interface VideoLibraryProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

interface ActiveVideo {
  id: string;
  title: string;
  displayTitle?: string | null;
  muxPlaybackId: string;
  techniqueNumber: string;
  technieken?: VideoTechniek[];
}

const COMPLETED_VIDEOS_KEY = 'hh_completed_videos';

const getCompletedVideoIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(COMPLETED_VIDEOS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
};

const markVideoCompleted = (videoId: string) => {
  const completed = getCompletedVideoIds();
  completed.add(videoId);
  localStorage.setItem(COMPLETED_VIDEOS_KEY, JSON.stringify([...completed]));
};

export function VideoLibrary({ navigate, isAdmin, onboardingMode }: VideoLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterTechniek, setFilterTechniek] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [showAllVideos, setShowAllVideos] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expanded') === 'true') return true;
    const stored = localStorage.getItem('videoLibraryExpanded');
    if (stored === 'true') {
      localStorage.removeItem('videoLibraryExpanded');
      return true;
    }
    return false;
  });
  const [sortField, setSortField] = useState<"title" | "views" | "date" | "nummer" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [completedVideoIds, setCompletedVideoIds] = useState<Set<string>>(getCompletedVideoIds());

  const [autoPlayTechniek, setAutoPlayTechniek] = useState<string | null>(null);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [detailsVideo, setDetailsVideo] = useState<any | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  
  useEffect(() => {
    const storedTechniek = localStorage.getItem('filterTechniek');
    const shouldAutoPlay = localStorage.getItem('autoPlayFirstVideo');
    if (storedTechniek) {
      setFilterTechniek(storedTechniek);
      localStorage.removeItem('filterTechniek');
      if (shouldAutoPlay === 'true') {
        setAutoPlayTechniek(storedTechniek);
        localStorage.removeItem('autoPlayFirstVideo');
      }
    }
  }, []);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        setIsLoading(true);
        const data = await videoApi.getLibrary('completed');
        if (data && data.length > 0) {
          setLibraryVideos(data);
          setUseFallback(false);
          
          const urlParams = new URLSearchParams(window.location.search);
          const watchParam = urlParams.get('watch');
          const devWatchFirst = localStorage.getItem('dev_watch_first');
          if (devWatchFirst) localStorage.removeItem('dev_watch_first');
          
          const storedVideoId = localStorage.getItem('currentVideoId');
          if (storedVideoId) {
            localStorage.removeItem('currentVideoId');
            const videoToOpen = data.find((v: LibraryVideo) => v.id === storedVideoId);
            if (videoToOpen) {
              const techId = videoToOpen.ai_suggested_techniek_id || videoToOpen.technique_id || "";
              setActiveVideo({
                id: videoToOpen.id,
                title: videoToOpen.title,
                displayTitle: videoToOpen.ai_attractive_title || videoToOpen.title,
                muxPlaybackId: videoToOpen.mux_playback_id || "",
                techniqueNumber: techId,
                technieken: videoToOpen.technieken || [],
              });
            }
          } else if (watchParam === 'first' || devWatchFirst) {
            const firstPlayable = data.find((v: LibraryVideo) => v.mux_playback_id);
            if (firstPlayable) {
              const techId = firstPlayable.ai_suggested_techniek_id || firstPlayable.technique_id || "";
              setActiveVideo({
                id: firstPlayable.id,
                title: firstPlayable.title,
                displayTitle: firstPlayable.ai_attractive_title || firstPlayable.title,
                muxPlaybackId: firstPlayable.mux_playback_id || "",
                techniqueNumber: techId,
                technieken: firstPlayable.technieken || [],
              });
            }
          }
        } else {
          const devWatchFirst2 = localStorage.getItem('dev_watch_first');
          if (devWatchFirst2) localStorage.removeItem('dev_watch_first');
          setUseFallback(true);
        }
      } catch (error) {
        console.error('Failed to load videos from API, using fallback:', error);
        const devWatchFirst3 = localStorage.getItem('dev_watch_first');
        if (devWatchFirst3) localStorage.removeItem('dev_watch_first');
        setUseFallback(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadVideos();
  }, []);

  // Auto-play first video when navigating from TechniqueLibrary
  useEffect(() => {
    if (autoPlayTechniek && !isLoading && libraryVideos.length > 0) {
      const matchingVideos = libraryVideos.filter((v: LibraryVideo) => {
        const techId = v.ai_suggested_techniek_id || v.technique_id || "";
        return techId === autoPlayTechniek;
      });
      if (matchingVideos.length > 0) {
        const firstVideo = matchingVideos[0];
        const techId = firstVideo.ai_suggested_techniek_id || firstVideo.technique_id || "";
        setActiveVideo({
          id: firstVideo.id,
          title: firstVideo.title,
          displayTitle: firstVideo.ai_attractive_title || firstVideo.title,
          muxPlaybackId: firstVideo.mux_playback_id || "",
          techniqueNumber: techId,
          technieken: firstVideo.technieken || [],
        });
      }
      setAutoPlayTechniek(null);
    }
  }, [autoPlayTechniek, isLoading, libraryVideos]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseFromTechnique = (techniqueId: string | null) => {
    if (!techniqueId) return "Onbekend";
    const technique = getTechniekByNummer(techniqueId);
    if (!technique) return "Onbekend";
    const phase = parseInt(technique.fase);
    const phaseNames: Record<number, string> = {
      0: "Pre-contactfase",
      1: "Openingsfase",
      2: "Ontdekkingsfase",
      3: "Aanbevelingsfase",
      4: "Beslissingsfase"
    };
    return phaseNames[phase] || "Onbekend";
  };

  const allCompleted = completedVideoIds.size > 0 && libraryVideos.filter(v => v.mux_playback_id).every(v => completedVideoIds.has(v.id));

  const getVideosByPlaybackOrder = () => {
    return [...libraryVideos]
      .filter(v => v.mux_playback_id && (v.technique_id || v.ai_suggested_techniek_id))
      .sort((a, b) => {
        if (a.playback_order != null && b.playback_order != null) return a.playback_order - b.playback_order;
        if (a.playback_order != null) return -1;
        if (b.playback_order != null) return 1;
        const techA = a.ai_suggested_techniek_id || a.technique_id || '999';
        const techB = b.ai_suggested_techniek_id || b.technique_id || '999';
        return techA.localeCompare(techB, undefined, { numeric: true });
      });
  };

  const isVideoUnlocked = (videoId: string): boolean => {
    if (allCompleted || isAdmin) return true;
    if (completedVideoIds.has(videoId)) return true;
    const ordered = getVideosByPlaybackOrder();
    if (ordered.length === 0) return true;
    if (ordered[0].id === videoId) return true;
    const idx = ordered.findIndex(v => v.id === videoId);
    if (idx <= 0) return true;
    return completedVideoIds.has(ordered[idx - 1].id);
  };

  const getLockedMessage = (videoId: string): string | null => {
    if (isVideoUnlocked(videoId)) return null;
    const ordered = getVideosByPlaybackOrder();
    const idx = ordered.findIndex(v => v.id === videoId);
    if (idx <= 0) return null;
    const prevVideo = ordered[idx - 1];
    const prevTechId = prevVideo.ai_suggested_techniek_id || prevVideo.technique_id || '';
    const prevTechnique = prevTechId ? getTechniekByNummer(prevTechId) : null;
    const prevName = prevVideo.ai_attractive_title || prevVideo.title;
    return `Bekijk eerst: ${prevName}`;
  };

  const videos = useFallback ? fallbackVideos.map(v => ({
    id: String(v.id),
    title: v.title,
    techniqueNumber: v.techniqueNumber,
    displayTitle: v.title,
    fase: v.fase,
    duration: v.duration,
    views: v.views,
    completion: v.completion,
    status: v.status,
    thumbnail: v.thumbnail,
    uploadDate: v.uploadDate,
    muxPlaybackId: "",
    aiMatchScore: null as number | null,
    playbackOrder: null as number | null,
    aiSummary: null as string | null,
  })) : libraryVideos.filter(v => v.mux_playback_id && (v.technique_id || v.ai_suggested_techniek_id)).map(v => {
    const techId = v.ai_suggested_techniek_id || v.technique_id || "";
    return {
      id: v.id,
      title: v.title,
      techniqueNumber: techId,
      displayTitle: v.ai_attractive_title || v.title,
      fase: getPhaseFromTechnique(techId),
      duration: formatDuration(v.duration),
      views: 0,
      completion: 0,
      status: v.status === 'completed' ? "Gepubliceerd" : "Concept",
      thumbnail: v.thumbnail_url || `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?time=5`,
      uploadDate: new Date(v.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
      muxPlaybackId: v.mux_playback_id || "",
      aiMatchScore: 63 as number | null,
      playbackOrder: v.playback_order,
      aiSummary: v.ai_summary || null,
      technieken: v.technieken || [],
    };
  });

  const handlePlayVideo = (video: typeof videos[0]) => {
    if (!isVideoUnlocked(video.id)) return;
    
    localStorage.setItem('lastWatchedVideoId', video.id);
    localStorage.setItem('lastWatchedVideoProgress', '0');
    
    setActiveVideo({
      id: video.id,
      title: video.title,
      displayTitle: video.displayTitle,
      muxPlaybackId: video.muxPlaybackId,
      techniqueNumber: video.techniqueNumber,
      technieken: video.technieken,
    });
  };

  const handleVideoComplete = (videoId: string) => {
    markVideoCompleted(videoId);
    setCompletedVideoIds(getCompletedVideoIds());
    localStorage.setItem('lastWatchedVideoProgress', '100');
  };

  const handleViewTechnique = (techniqueNumber: string) => {
    if (techniqueNumber) {
      localStorage.setItem('selectedTechniqueNumber', techniqueNumber);
      navigate?.("techniques");
    }
  };

  const handleStartEditTitle = (videoId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(videoId);
    setEditingTitleValue(currentTitle);
  };

  const handleSaveTitle = async (videoId: string) => {
    if (!editingTitleValue.trim() || savingTitle) return;
    setSavingTitle(true);
    try {
      await videoApi.updateTitle(videoId, editingTitleValue.trim());
      setLibraryVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, ai_attractive_title: editingTitleValue.trim() } : v
      ));
      setEditingTitleId(null);
    } catch (err) {
      console.error('Failed to save title:', err);
    } finally {
      setSavingTitle(false);
    }
  };

  const handleCancelEditTitle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTitleId(null);
    setEditingTitleValue("");
  };

  const handleSort = (field: "title" | "views" | "date" | "nummer") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredVideos = videos.filter((video) => {
    const matchesSearch = searchQuery === "" ||
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.techniqueNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (video.displayTitle && video.displayTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPhase = (() => {
      if (filterPhase === "all") return true;
      const faseMap: Record<string, string[]> = {
        'voorbereiding': ['Pre-contactfase', 'Voorbereidingsfase'],
        'opening': ['Openingsfase'],
        'ontdekking': ['Ontdekkingsfase'],
        'aanbeveling': ['Aanbevelingsfase'],
        'beslissing': ['Beslissingsfase'],
      };
      return faseMap[filterPhase]?.includes(video.fase) || false;
    })();
    const matchesTechniek = !filterTechniek || video.techniqueNumber === filterTechniek;
    return matchesSearch && matchesPhase && matchesTechniek;
  });

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (!sortField) {
      const aOrder = a.playbackOrder != null ? a.playbackOrder : Infinity;
      const bOrder = b.playbackOrder != null ? b.playbackOrder : Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const parseNum = (n: string) => n.split('.').map(p => parseInt(p) || 0);
      const [a1, a2, a3] = parseNum(a.techniqueNumber || '999');
      const [b1, b2, b3] = parseNum(b.techniqueNumber || '999');
      return a1 !== b1 ? a1 - b1 : a2 !== b2 ? a2 - b2 : a3 - b3;
    }
    if (sortField === "nummer") {
      const parseNumber = (num: string) => {
        if (!num) return [999, 999, 999];
        const parts = num.split('.').map(p => parseInt(p) || 0);
        return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
      };
      const [a1, a2, a3] = parseNumber(a.techniqueNumber);
      const [b1, b2, b3] = parseNumber(b.techniqueNumber);
      const compare = a1 !== b1 ? a1 - b1 : a2 !== b2 ? a2 - b2 : a3 - b3;
      return sortDirection === "asc" ? compare : -compare;
    }
    if (sortField === "title") {
      return sortDirection === "asc"
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    }
    if (sortField === "views") {
      return sortDirection === "asc" ? a.views - b.views : b.views - a.views;
    }
    if (sortField === "date") {
      return sortDirection === "asc"
        ? new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
        : new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    }
    return 0;
  });

  const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
  const totalDuration = videos.reduce((sum, v) => {
    const [mins] = v.duration.split(':').map(Number);
    return sum + mins;
  }, 0);
  const avgCompletion = videos.length > 0 
    ? Math.round(videos.reduce((sum, v) => sum + v.completion, 0) / videos.length) 
    : 0;

  // "Continue watching" logic - uses playback_order for sequencing
  const getContinueWatchingVideo = () => {
    if (typeof window === 'undefined') return null;
    
    const lastWatchedId = localStorage.getItem('lastWatchedVideoId');
    const lastWatchedProgress = localStorage.getItem('lastWatchedVideoProgress');
    
    // Sort by playback_order for sequencing
    const orderedVideos = [...videos].sort((a, b) => {
      if (a.playbackOrder != null && b.playbackOrder != null) return a.playbackOrder - b.playbackOrder;
      if (a.playbackOrder != null) return -1;
      if (b.playbackOrder != null) return 1;
      const parseNum = (n: string) => n.split('.').map(p => parseInt(p) || 0);
      const [a1, a2, a3] = parseNum(a.techniqueNumber || '999');
      const [b1, b2, b3] = parseNum(b.techniqueNumber || '999');
      return a1 !== b1 ? a1 - b1 : a2 !== b2 ? a2 - b2 : a3 - b3;
    });
    
    if (lastWatchedId) {
      const lastWatched = videos.find(v => v.id === lastWatchedId);
      if (lastWatched) {
        const progress = parseFloat(lastWatchedProgress || '0');
        if (progress < 90) {
          return { video: lastWatched, reason: 'continue' as const };
        }
        const currentIdx = orderedVideos.findIndex(v => v.id === lastWatchedId);
        if (currentIdx >= 0 && currentIdx < orderedVideos.length - 1) {
          return { video: orderedVideos[currentIdx + 1], reason: 'next' as const };
        }
      }
    }
    
    // Find first unwatched video in playback order
    const firstUnwatched = orderedVideos.find(v => !completedVideoIds.has(v.id) && isVideoUnlocked(v.id));
    if (firstUnwatched) {
      return { video: firstUnwatched, reason: 'next' as const };
    }
    
    // Default: first video in sorted (filtered) list for display
    return sortedVideos.length > 0 
      ? { video: sortedVideos[0], reason: 'first' as const }
      : null;
  };
  
  const continueWatching = getContinueWatchingVideo();
  const featuredVideo = continueWatching?.video || null;

  const isRecentlyAdded = (videoId: string): boolean => {
    const video = libraryVideos.find(v => v.id === videoId);
    if (!video?.created_at) return false;
    const created = new Date(video.created_at);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    return created > fourteenDaysAgo;
  };

  if (activeVideo && !fullscreenMode) {
    const activeVideoData = videos.find(v => v.id === activeVideo.id);
    if (activeVideoData) {
      return (
        <AppLayout currentPage="video-watch" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
          <VideoWatchPage
            video={{
              id: activeVideoData.id,
              title: activeVideoData.title,
              displayTitle: activeVideoData.displayTitle,
              muxPlaybackId: activeVideoData.muxPlaybackId,
              techniqueNumber: activeVideoData.techniqueNumber,
              duration: activeVideoData.duration,
              thumbnail: activeVideoData.thumbnail,
              aiSummary: activeVideoData.aiSummary,
              technieken: activeVideoData.technieken || [],
            }}
            allVideos={sortedVideos.filter(v => v.muxPlaybackId).map(v => ({
              id: v.id,
              title: v.title,
              displayTitle: v.displayTitle,
              muxPlaybackId: v.muxPlaybackId,
              techniqueNumber: v.techniqueNumber,
              duration: v.duration,
              thumbnail: v.thumbnail,
              playbackOrder: v.playbackOrder,
              aiSummary: v.aiSummary,
              technieken: v.technieken || [],
            }))}
            onClose={() => setActiveVideo(null)}
            onVideoChange={(videoId) => {
              const v = videos.find(vid => vid.id === videoId);
              if (v) {
                setActiveVideo({
                  id: v.id,
                  title: v.title,
                  displayTitle: v.displayTitle,
                  muxPlaybackId: v.muxPlaybackId,
                  techniqueNumber: v.techniqueNumber,
                  technieken: v.technieken,
                });
              }
            }}
            onFullscreen={() => setFullscreenMode(true)}
            onVideoComplete={handleVideoComplete}
            completedVideoIds={completedVideoIds}
            navigate={navigate}
          />
          {fullscreenMode && (
            <ImmersiveVideoPlayer
              videos={sortedVideos.filter(v => v.muxPlaybackId).map(v => ({
                id: v.id,
                title: v.title,
                displayTitle: v.displayTitle,
                muxPlaybackId: v.muxPlaybackId,
                techniqueNumber: v.techniqueNumber,
                duration: v.duration,
                thumbnail: v.thumbnail,
                playbackOrder: v.playbackOrder,
                aiSummary: v.aiSummary,
              }))}
              currentVideoId={activeVideo.id}
              onClose={() => setFullscreenMode(false)}
              onVideoComplete={handleVideoComplete}
              completedVideoIds={completedVideoIds}
            />
          )}
        </AppLayout>
      );
    }
  }

  return (
    <AppLayout currentPage="videos" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
      <div className="p-3 sm:p-4 lg:p-6 space-y-6">
        {/* Header with compact KPI cards on the right */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-[24px] sm:text-[28px] lg:text-[32px] leading-[40px] text-hh-text mb-2">
              Video Bibliotheek
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              {isLoading 
                ? <span className="inline-block h-5 w-64 bg-hh-ui-100 rounded animate-pulse align-middle" />
                : filterTechniek 
                  ? `Videos voor techniek #${filterTechniek}`
                  : `${videos.length} video's — leer alle technieken van Hugo`
              }
            </p>
          </div>
          
          {/* Compact KPI Cards - right aligned */}
          <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap lg:flex-nowrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-hh-border shadow-sm">
              <div className="w-6 h-6 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <Video className="w-3 h-3 text-hh-ink" />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Video's</p>
                {isLoading ? <div className="h-4 w-8 bg-hh-ui-100 rounded animate-pulse mt-0.5" /> : <p className="text-[14px] font-semibold text-hh-ink leading-tight">{videos.length}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-hh-border shadow-sm">
              <div className="w-6 h-6 rounded-full bg-[#3d9a6e]/10 flex items-center justify-center">
                <Eye className="w-3 h-3" style={{ color: '#3d9a6e' }} />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Views</p>
                {isLoading ? <div className="h-4 w-8 bg-hh-ui-100 rounded animate-pulse mt-0.5" /> : <p className="text-[14px] font-semibold text-hh-ink leading-tight">{totalViews.toLocaleString()}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-hh-border shadow-sm">
              <div className="w-6 h-6 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Clock className="w-3 h-3 text-hh-primary" />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Duur</p>
                {isLoading ? <div className="h-4 w-12 bg-hh-ui-100 rounded animate-pulse mt-0.5" /> : <p className="text-[14px] font-semibold text-hh-ink leading-tight">{Math.floor(totalDuration / 60)}u {totalDuration % 60}m</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-hh-border shadow-sm">
              <div className="w-6 h-6 rounded-full bg-[#3d9a6e]/10 flex items-center justify-center">
                <TrendingUp className="w-3 h-3" style={{ color: '#3d9a6e' }} />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Compl.</p>
                {isLoading ? <div className="h-4 w-8 bg-hh-ui-100 rounded animate-pulse mt-0.5" /> : <p className="text-[14px] font-semibold text-hh-ink leading-tight">{avgCompletion}%</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Hero Banner - matching Dashboard style */}
        <div className="relative overflow-hidden rounded-2xl h-[200px] sm:h-[240px]">
          {featuredVideo?.thumbnail ? (
            <img 
              src={featuredVideo.thumbnail.replace('width=320&height=180', 'width=800&height=450')} 
              alt="Hugo Herbots training video"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: '50% 35%' }}
              loading="eager"
            />
          ) : (
            <img 
              src="/images/Hugo-Herbots-WEB-0350.JPG"
              alt="Hugo Herbots Video Bibliotheek"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: '50% 30%' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-hh-ink via-hh-ink/80 to-transparent" />
          
          <div className="relative h-full flex items-center p-6 sm:p-8">
            <div className="text-white space-y-3 max-w-lg">
              {isLoading ? (
                <>
                  <div className="h-6 w-40 bg-white/20 rounded-full animate-pulse" />
                  <div className="h-7 w-64 bg-white/20 rounded animate-pulse" />
                  <div className="h-4 w-80 bg-white/10 rounded animate-pulse" />
                </>
              ) : (
                <>
                  <Badge className="text-white border-0 text-[12px] bg-hh-primary">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {(featuredVideo?.fase && featuredVideo.fase !== 'Onbekend') ? featuredVideo.fase : (continueWatching?.reason === 'continue' ? 'Ga verder' : 'EPIC Training')}
                  </Badge>
                  
                  <h2 className="text-[20px] sm:text-[24px] font-bold leading-tight">
                    {featuredVideo?.displayTitle || 'Leer de E.P.I.C. Technieken'}
                  </h2>
                  
                  <p className="text-white/70 text-[13px] sm:text-[14px] leading-relaxed line-clamp-2">
                    {featuredVideo?.aiSummary || 'Bekijk Hugo\'s training video\'s en leer alle sales technieken stap voor stap.'}
                  </p>
                </>
              )}
              
              <div className="flex flex-wrap gap-3 pt-1">
                <Button 
                  className="gap-2 text-white border-0"
                  style={{ backgroundColor: '#3d9a6e' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = '#4daa7e'; }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = '#3d9a6e'; }}
                  disabled={isLoading}
                  onClick={() => {
                    if (featuredVideo) handlePlayVideo(featuredVideo);
                  }}
                >
                  <Play className="w-4 h-4" />
                  Verder kijken
                </Button>
                <Button 
                  className="gap-2 border border-white/30 text-white hover:bg-white/10"
                  style={{ backgroundColor: 'rgba(15, 24, 38, 0.8)' }}
                  onClick={() => navigate?.("talk-to-hugo")}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat met Hugo
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Vervolg video training - Horizontal scroll row or expanded view */}
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 text-hh-muted flex-shrink-0" />
              <h2 className="text-[16px] sm:text-[18px] font-semibold text-hh-text whitespace-nowrap">Vervolg video training</h2>
            </div>
            <button 
              onClick={() => { setShowAllVideos(!showAllVideos); if (showAllVideos) { setSearchQuery(''); setFilterPhase('all'); } }}
              className="flex items-center gap-1 text-[12px] sm:text-[13px] text-hh-primary hover:text-hh-ink transition-colors flex-shrink-0 whitespace-nowrap"
            >
              <span className="hidden sm:inline">{showAllVideos ? 'Minder tonen' : 'Alles bekijken'}</span>
              <span className="sm:hidden">{showAllVideos ? 'Minder' : 'Alle'}</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showAllVideos ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {/* Search/Filter toolbar - shown when expanded */}
          {showAllVideos && (
            <div className="bg-card rounded-xl p-3 border border-hh-border shadow-hh-sm">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
                  <Input
                    placeholder="Zoek video's..."
                    className="pl-10 bg-hh-bg"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterPhase} onValueChange={setFilterPhase}>
                  <SelectTrigger className="w-[160px] bg-hh-bg flex-shrink-0">
                    <SelectValue placeholder="Alle Fases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Fases</SelectItem>
                    <SelectItem value="voorbereiding">Fase 0 - Pre-contactfase</SelectItem>
                    <SelectItem value="opening">Fase 1 - Openingsfase</SelectItem>
                    <SelectItem value="ontdekking">Fase 2 - Ontdekkingsfase</SelectItem>
                    <SelectItem value="aanbeveling">Fase 3 - Aanbevelingsfase</SelectItem>
                    <SelectItem value="beslissing">Fase 4 - Beslissingsfase</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-9 w-9 p-0 ${viewMode === "list" ? "bg-hh-primary text-white hover:bg-hh-primary/90" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}`}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-9 w-9 p-0 ${viewMode === "grid" ? "bg-hh-primary text-white hover:bg-hh-primary/90" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}`}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!showAllVideos && isLoading && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex-shrink-0 w-[200px]">
                  <div className="rounded-lg overflow-hidden bg-hh-ui-100 aspect-video mb-2 animate-pulse" />
                  <div className="h-4 w-3/4 bg-hh-ui-100 rounded animate-pulse mb-1.5" />
                  <div className="h-3 w-1/2 bg-hh-ui-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!showAllVideos && !isLoading && (<div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {sortedVideos.slice(0, 8).map((video, index) => {
              const locked = !isVideoUnlocked(video.id);
              const completed = completedVideoIds.has(video.id);
              const recentlyAdded = isRecentlyAdded(video.id);
              return (
                <div 
                  key={video.id}
                  className={`flex-shrink-0 w-[200px] group cursor-pointer ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !locked && handlePlayVideo(video)}
                >
                  <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-hh-ink to-hh-primary/80 aspect-video mb-2">
                    <img
                      src={video.thumbnail}
                      alt={video.displayTitle || "Video"}
                      className={`w-full h-full object-cover ${locked ? 'grayscale' : ''}`}
                      loading="lazy"
                    />
                    {locked ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-white/80" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-6 h-6 text-hh-ink ml-0.5" />
                        </div>
                      </div>
                    )}
                    {completed && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#3d9a6e] flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {video.techniqueNumber && (
                      <Badge className="absolute top-2 left-2 bg-emerald-100 text-emerald-600 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium">
                        {video.techniqueNumber}
                      </Badge>
                    )}
                    {recentlyAdded && !completed && (
                      <Badge className="absolute bottom-2 left-2 text-white border-0 text-[9px] px-1.5 py-0.5 font-medium" style={{ backgroundColor: '#3C9A6E' }}>
                        Nieuw
                      </Badge>
                    )}
                    {/* Green progress bar at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div 
                        className="h-full bg-[#3d9a6e]" 
                        style={{ width: completed ? '100%' : '0%' }}
                      />
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    {editingTitleId === video.id ? (
                      <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(video.id);
                            if (e.key === 'Escape') handleCancelEditTitle();
                          }}
                          className="w-full text-[13px] font-medium text-hh-text bg-hh-bg border border-hh-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                          autoFocus
                          disabled={savingTitle}
                        />
                        <button onClick={() => handleSaveTitle(video.id)} className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[#3d9a6e] hover:text-[#2d7a5e]" disabled={savingTitle}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleCancelEditTitle} className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-hh-muted hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors flex-1">
                        {video.displayTitle || <span className="italic text-hh-muted">Algemeen</span>}
                      </h3>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-hh-muted hover:text-hh-text hover:bg-hh-ui-100 transition-colors opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isAdmin && (
                          <DropdownMenuItem onClick={(e) => handleStartEditTitle(video.id, video.displayTitle || video.title, e)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Titel bewerken
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => { setDetailsVideo(video); }}>
                          <Info className="w-4 h-4 mr-2" />
                          Details bekijken
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { if (!locked) handlePlayVideo(video); }}>
                          <Play className="w-4 h-4 mr-2" />
                          Video afspelen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-hh-muted">{video.fase}</span>
                    <span className="text-[11px] text-hh-muted">•</span>
                    <span className="text-[11px] text-hh-muted">{video.duration}</span>
                    <span className="text-[11px] text-hh-muted">•</span>
                    <span className="text-[11px] text-hh-muted font-mono">{index + 1}/{sortedVideos.length}</span>
                  </div>
                </div>
              );
            })}
          </div>)}

          {/* Expanded view with list/grid when "Alles bekijken" is clicked */}
          {showAllVideos && viewMode === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedVideos.map((video, index) => {
              const locked = !isVideoUnlocked(video.id);
              const completed = completedVideoIds.has(video.id);
              const recentlyAdded = isRecentlyAdded(video.id);
              return (
                <div 
                  key={video.id}
                  className={`group cursor-pointer ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !locked && handlePlayVideo(video)}
                >
                  <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-hh-ink to-hh-primary/80 aspect-video mb-2">
                    <img
                      src={video.thumbnail}
                      alt={video.displayTitle || "Video"}
                      className={`w-full h-full object-cover ${locked ? 'grayscale' : ''}`}
                      loading="lazy"
                    />
                    {locked ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-white/80" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-6 h-6 text-hh-ink ml-0.5" />
                        </div>
                      </div>
                    )}
                    {completed && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#3d9a6e] flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {video.techniqueNumber && (
                      <Badge className="absolute top-2 left-2 bg-emerald-100 text-emerald-600 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium">
                        {video.techniqueNumber}
                      </Badge>
                    )}
                    {recentlyAdded && !completed && (
                      <Badge className="absolute bottom-2 left-2 text-white border-0 text-[9px] px-1.5 py-0.5 font-medium" style={{ backgroundColor: '#3C9A6E' }}>
                        Nieuw
                      </Badge>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div 
                        className="h-full bg-[#3d9a6e]" 
                        style={{ width: completed ? '100%' : '0%' }}
                      />
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    {editingTitleId === video.id ? (
                      <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(video.id);
                            if (e.key === 'Escape') handleCancelEditTitle();
                          }}
                          className="w-full text-[13px] font-medium text-hh-text bg-hh-bg border border-hh-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                          autoFocus
                          disabled={savingTitle}
                        />
                        <button onClick={() => handleSaveTitle(video.id)} className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[#3d9a6e] hover:text-[#2d7a5e]" disabled={savingTitle}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleCancelEditTitle} className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-hh-muted hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors flex-1">
                          {video.displayTitle || <span className="italic text-hh-muted">Algemeen</span>}
                        </h3>
                        {isAdmin && (
                          <button
                            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-hh-muted hover:text-[#1e3a5f] opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleStartEditTitle(video.id, video.displayTitle || video.title, e)}
                            title="Titel bewerken"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-hh-muted">{video.fase}</span>
                    <span className="text-[11px] text-hh-muted">•</span>
                    <span className="text-[11px] text-hh-muted">{video.duration}</span>
                    <span className="text-[11px] text-hh-muted">•</span>
                    <span className="text-[11px] text-hh-muted font-mono">{index + 1}/{sortedVideos.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Expanded list view */}
          {showAllVideos && viewMode === "list" && (
            <Card className="rounded-[12px] shadow-hh-sm border-hh-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-hh-ui-50 border-b border-hh-border">
                    <tr>
                      <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[80px]"></th>
                      <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text" onClick={() => handleSort("title")}>
                        <span className="flex items-center gap-1">Video {sortField === "title" ? (sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
                      </th>
                      <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">Fase</th>
                      <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">Duur</th>
                      <th className="text-center py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVideos.map((video) => {
                      const locked = !isVideoUnlocked(video.id);
                      const completed = completedVideoIds.has(video.id);
                      const getFaseBadge = (fase: string) => {
                        const lowerFase = fase.toLowerCase();
                        if (lowerFase.includes('pre') || lowerFase.includes('voorbereiding')) return { label: fase, color: 'bg-hh-ui-100 text-hh-muted' };
                        if (lowerFase.includes('opening')) return { label: fase, color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' };
                        if (lowerFase.includes('ontdekking')) return { label: fase, color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' };
                        if (lowerFase.includes('aanbeveling')) return { label: fase, color: 'bg-hh-ui-100 text-hh-ink' };
                        if (lowerFase.includes('beslissing')) return { label: fase, color: 'bg-hh-ui-200 text-hh-ink' };
                        return { label: fase, color: 'bg-hh-ui-100 text-hh-muted' };
                      };
                      const faseBadge = getFaseBadge(video.fase);
                      return (
                        <tr key={video.id} className={`group border-b border-hh-border last:border-0 transition-colors ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-hh-ui-50/50 cursor-pointer'}`} onClick={() => !locked && handlePlayVideo(video)}>
                          <td className="py-2 px-4">
                            <div className="relative w-16 h-10 rounded-md overflow-hidden bg-hh-ui-100">
                              <img src={video.thumbnail} alt={video.displayTitle || "Video"} className={`w-full h-full object-cover ${locked ? 'grayscale' : ''}`} />
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium text-hh-text truncate">{video.displayTitle || video.title}</span>
                              {completed && <CheckCircle2 className="w-4 h-4 text-[#3d9a6e] flex-shrink-0" />}
                            </div>
                          </td>
                          <td className="py-3 px-4"><Badge className={`${faseBadge.color} border-0 text-[11px] font-medium px-2 py-0.5 rounded-full`}>{faseBadge.label}</Badge></td>
                          <td className="py-3 px-4 text-right"><span className="text-[12px] text-hh-muted flex items-center justify-end gap-1"><Clock className="w-3 h-3" />{video.duration}</span></td>
                          <td className="py-3 px-4 text-center">
                            <Button size="sm" variant="ghost" className="rounded-full w-8 h-8 p-0" style={{ color: '#1e3a5f' }}>
                              <Play className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Shorts - Placeholder row */}
        {!showAllVideos && (
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-hh-muted flex-shrink-0" />
              <h2 className="text-[16px] sm:text-[18px] font-semibold text-hh-text truncate">Shorts</h2>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { title: "Quick Tip: Elevator Pitch", duration: "0:45" },
              { title: "FAQ: Hoe ga je om met bezwaren?", duration: "1:12" },
              { title: "Sales Mindset in 60 seconden", duration: "0:58" },
              { title: "Klant zegt 'te duur' - wat nu?", duration: "1:30" },
              { title: "Eerste indruk optimaliseren", duration: "0:52" },
            ].map((short, idx) => (
              <div key={idx} className="flex-shrink-0 w-[200px] opacity-60">
                <div className="relative rounded-lg overflow-hidden bg-hh-ui-100 aspect-video mb-2 flex items-center justify-center">
                  <div className="text-center space-y-1">
                    <Zap className="w-6 h-6 text-hh-muted/40 mx-auto" />
                    <p className="text-[10px] text-hh-muted/60">Binnenkort</p>
                  </div>
                  <Badge className="absolute bottom-2 right-2 bg-black/50 text-white/70 border-0 text-[10px]">
                    {short.duration}
                  </Badge>
                </div>
                <h3 className="text-[12px] font-medium text-hh-muted leading-tight line-clamp-2">{short.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-hh-muted">Short</span>
                  <span className="text-[11px] text-hh-muted">•</span>
                  <span className="text-[11px] text-hh-muted">{short.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Webinars herbekijken - Placeholder row */}
        {!showAllVideos && (
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-hh-muted flex-shrink-0" />
              <h2 className="text-[16px] sm:text-[18px] font-semibold text-hh-text truncate">Webinars herbekijken</h2>
            </div>
            <button 
              onClick={() => navigate?.("live")}
              className="flex items-center gap-1 text-[12px] sm:text-[13px] text-hh-primary hover:text-hh-ink transition-colors flex-shrink-0 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Alles bekijken</span>
              <span className="sm:hidden">Alle</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { title: "Meningsgerichte vragen masterclass", techniek: "2.1.2", date: "12 jan 2026" },
              { title: "Feitgerichte vragen deep-dive", techniek: "2.1.1", date: "5 jan 2026" },
              { title: "Proefafsluiting workshop", techniek: "4.1", date: "19 dec 2025" },
              { title: "Actief Luisteren training", techniek: "2.3.1", date: "12 dec 2025" },
            ].map((webinar, idx) => (
              <div 
                key={idx} 
                className="flex-shrink-0 w-[200px] cursor-pointer group"
                onClick={() => navigate?.("live")}
              >
                <div className="relative aspect-video rounded-lg overflow-hidden bg-hh-ui-100 mb-2">
                  <img
                    src={`https://image.mux.com/${sortedVideos[idx]?.muxPlaybackId || 'placeholder'}/thumbnail.jpg?time=5&width=400`}
                    alt={webinar.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/Hugo-Herbots-WEB-0350.JPG'; }}
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-hh-ink ml-0.5" />
                    </div>
                  </div>
                  <Badge className="absolute top-2 left-2 bg-teal-100/90 text-teal-600 border-0 text-[10px] font-mono font-semibold rounded-full px-1.5">
                    {webinar.techniek}
                  </Badge>
                  <Badge className="absolute top-2 right-2 border-0 text-[10px] text-white" style={{ backgroundColor: '#3d9a6e' }}>
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                  </Badge>
                </div>
                <h3 className="text-[12px] font-medium text-hh-text truncate">{webinar.title}</h3>
                <p className="text-[12px] text-hh-muted">{webinar.date}</p>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Alle video's - Netflix-style row */}
        {!showAllVideos && (
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5 text-hh-muted flex-shrink-0" />
              <h2 className="text-[16px] sm:text-[18px] font-semibold text-hh-text whitespace-nowrap">Alle video's</h2>
            </div>
            <button 
              onClick={() => { setShowAllVideos(true); }}
              className="flex items-center gap-1 text-[12px] sm:text-[13px] text-hh-primary hover:text-hh-ink transition-colors flex-shrink-0 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Alles bekijken</span>
              <span className="sm:hidden">Alle</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {sortedVideos.filter(v => {
              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return v.title.toLowerCase().includes(q) || 
                  (v.displayTitle && v.displayTitle.toLowerCase().includes(q));
              }
              return true;
            }).slice(0, 8).map((video) => {
              const locked = !isVideoUnlocked(video.id);
              const completed = completedVideoIds.has(video.id);
              return (
                <div 
                  key={video.id}
                  className={`flex-shrink-0 w-[200px] group cursor-pointer ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !locked && handlePlayVideo(video)}
                >
                  <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-hh-ink to-hh-primary/80 aspect-video mb-2">
                    <img
                      src={video.thumbnail}
                      alt={video.displayTitle || "Video"}
                      className={`w-full h-full object-cover ${locked ? 'grayscale' : ''}`}
                      loading="lazy"
                    />
                    {locked ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-white/80" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-6 h-6 text-hh-ink ml-0.5" />
                        </div>
                      </div>
                    )}
                    {completed && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#3d9a6e] flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {video.techniqueNumber && (
                      <Badge className="absolute top-2 left-2 bg-emerald-100 text-emerald-600 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium">
                        {video.techniqueNumber}
                      </Badge>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div className="h-full bg-[#3d9a6e]" style={{ width: completed ? '100%' : '0%' }} />
                    </div>
                  </div>
                  <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors">
                    {video.displayTitle || <span className="italic text-hh-muted">Algemeen</span>}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-hh-muted">{video.fase}</span>
                    <span className="text-[11px] text-hh-muted">•</span>
                    <span className="text-[11px] text-hh-muted">{video.duration}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}


        

        {/* Fullscreen Immersive Video Player - only when user explicitly chooses fullscreen */}
        {activeVideo && fullscreenMode && (
          <ImmersiveVideoPlayer
            videos={sortedVideos.filter(v => v.muxPlaybackId).map(v => ({
              id: v.id,
              title: v.title,
              displayTitle: v.displayTitle,
              muxPlaybackId: v.muxPlaybackId,
              techniqueNumber: v.techniqueNumber,
              duration: v.duration,
              thumbnail: v.thumbnail,
              playbackOrder: v.playbackOrder,
              aiSummary: v.aiSummary,
            }))}
            currentVideoId={activeVideo.id}
            onClose={() => setFullscreenMode(false)}
            onVideoComplete={handleVideoComplete}
            completedVideoIds={completedVideoIds}
          />
        )}

        {/* Video Details Sheet (Read-only for user view) */}
        <DetailsSheet
          open={!!detailsVideo}
          onOpenChange={(open) => {
            if (!open) {
              setDetailsVideo(null);
              setSummaryExpanded(false);
              setTranscriptExpanded(false);
            }
          }}
          variant="user"
          title={detailsVideo?.displayTitle || detailsVideo?.title}
          badges={
            (() => {
              const technique = detailsVideo?.techniqueNumber ? getTechniekByNummer(detailsVideo.techniqueNumber) : null;
              return (
                <>
                  {detailsVideo?.techniqueNumber && (
                    <Badge 
                      className="text-[12px] px-2 py-0.5 border-0"
                      style={{ backgroundColor: '#3d9a6e', color: 'white' }}
                    >
                      {detailsVideo.techniqueNumber}
                    </Badge>
                  )}
                  {technique?.fase && (
                    <Badge 
                      variant="outline" 
                      className="text-[12px] px-2 py-0.5"
                      style={{ borderColor: 'rgba(61, 154, 110, 0.3)', color: '#3d9a6e' }}
                    >
                      Fase {technique.fase}
                    </Badge>
                  )}
                  {technique?.tags?.slice(0, 3).map((tag: string, idx: number) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="text-[10px] px-2 py-0.5"
                      style={{ borderColor: 'rgba(61, 154, 110, 0.3)', color: '#3d9a6e' }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </>
              );
            })()
          }
          footer={
            <>
              <Button
                onClick={() => {
                  if (detailsVideo?.muxPlaybackId) {
                    setActiveVideo({
                      id: detailsVideo.id,
                      title: detailsVideo.title,
                      displayTitle: detailsVideo.displayTitle,
                      muxPlaybackId: detailsVideo.muxPlaybackId,
                      techniqueNumber: detailsVideo.techniqueNumber,
                      technieken: detailsVideo.technieken,
                    });
                  }
                  setDetailsVideo(null);
                }}
                className="gap-2"
                style={{ backgroundColor: '#1e3a5f', color: 'white', borderColor: '#1e3a5f' }}
                onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#2d4a6f'}
                onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#1e3a5f'}
              >
                <Play className="w-4 h-4" />
                Bekijken
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setDetailsVideo(null)}
                className="text-hh-muted hover:text-hh-text"
              >
                Sluiten
              </Button>
            </>
          }
          subtitle={(() => {
            const technique = detailsVideo?.techniqueNumber ? getTechniekByNummer(detailsVideo.techniqueNumber) : null;
            if (!technique) return undefined;
            const tags = technique.tags?.join(', ') || '';
            return `Fase: ${technique.fase}${tags ? ` • ${tags}` : ''}`;
          })()}
        >
          {(() => {
            if (!detailsVideo) return null;
            const technique = detailsVideo.techniqueNumber ? getTechniekByNummer(detailsVideo.techniqueNumber) : null;
            
            return (
              <div className="space-y-6">
                {detailsVideo.aiSummary && (
                  <div className="rounded-lg border border-hh-border p-4" style={{ backgroundColor: 'rgba(61, 154, 110, 0.04)' }}>
                    <h4 className="text-[15px] font-semibold text-hh-text mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" style={{ color: '#3d9a6e' }} />
                      Samenvatting
                    </h4>
                    <p className="text-[14px] text-hh-text leading-relaxed">{detailsVideo.aiSummary}</p>
                  </div>
                )}
                {technique ? (
                  <TechniqueContent technique={technique} variant="user" />
                ) : (
                  <p className="text-hh-muted py-4">Geen techniek gekoppeld aan deze video</p>
                )}
              </div>
            );
          })()}
        </DetailsSheet>
      </div>
    </AppLayout>
  );
}
