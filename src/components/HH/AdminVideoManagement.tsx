// TODO[DIALOG-AUTO-SCROLL]: Video detail dialog toont niet alle content, knoppen niet zichtbaar
// Status: Done
// Oplossing: max-h-[85vh] en overflow-y-auto toegevoegd aan alle DialogContent componenten

// TODO[PLAY-ICON-COLOR]: Play icoon bij video thumbnails is Steel Blue - moet dit anders?
// Status: Done
// Oplossing: Play button veranderd naar paars (bg-purple-600) in card view

import {
  Search,
  MoreVertical,
  Trash2,
  Eye,
  EyeOff,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Film,
  Loader2,
  FileText,
  FileAudio,
  FolderSync,
  RefreshCw,
  LayoutGrid,
  List,
  XCircle,
  Video,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Upload,
  Square,
  CheckSquare,
  Cloud,
  Info,
  RotateCcw,
  Activity,
  Volume2,
  Tv,
  Pencil,
  X,
  Target,
  ChevronUp,
  ChevronDown,
  Save,
  Plus,
  GripVertical,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { AutoResizeTextarea } from "../ui/auto-resize-textarea";
import { ScrollArea } from "../ui/scroll-area";
import { videoApi } from "@/services/videoApi";
import { supabase } from "../../utils/supabase/client";

interface LibraryVideo {
  id: string;
  title: string;
  original_title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  status: string;
  raw_status?: string;
  duration: number | null;
  course_module: string | null;
  technique_id: string | null;
  ai_suggested_techniek_id: string | null;
  ai_confidence: number | null;
  has_transcript: boolean;
  has_audio: boolean;
  has_rag: boolean;
  has_mux: boolean;
  transcript: string | null;
  ai_summary: string | null;
  ai_attractive_title: string | null;
  drive_file_id: string | null;
  drive_folder_id: string | null;
  source: 'pipeline' | 'manual';
  is_hidden: boolean;
  playback_order: number | null;
  size_bytes?: number | null;
  created_at: string;
  updated_at: string;
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { getTechniqueByNumber, EPIC_TECHNIQUES } from "../../data/epicTechniques";
import { MuxVideoPlayer } from "./MuxVideoPlayer";
import { DetailsSheet } from './DetailsSheet';
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface AdminVideoManagementProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

const matchesSearch = (video: LibraryVideo, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  if (video.title?.toLowerCase().includes(q)) return true;
  if (video.ai_attractive_title?.toLowerCase().includes(q)) return true;
  const techId = video.ai_suggested_techniek_id || video.technique_id || '';
  if (techId.toLowerCase().includes(q)) return true;
  const tech = techId ? getTechniqueByNumber(techId) : null;
  if (tech?.name?.toLowerCase().includes(q)) return true;
  if (video.ai_summary?.toLowerCase().includes(q)) return true;
  return false;
};

export function AdminVideoManagement({ navigate, isSuperAdmin = false }: AdminVideoManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFase, setFilterFase] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  
  // Helper function to get fase from technique number (e.g., "4.2.4" -> "4", "2.1" -> "2")
  const getFaseFromTechniqueId = (techId: string | null): string => {
    if (!techId) return '';
    const firstChar = techId.charAt(0);
    return firstChar;
  };
  
  // Helper function to match fase filter to video
  const matchesFaseFilter = (video: LibraryVideo, filterValue: string): boolean => {
    if (filterValue === 'all') return true;
    const techId = video.ai_suggested_techniek_id || video.technique_id;
    const faseNum = getFaseFromTechniqueId(techId);
    
    // Map filter values to fase numbers
    const faseMap: Record<string, string[]> = {
      'voorbereiding': ['0'],     // Pre-contactfase / Voorbereiding = fase 0
      'opening': ['1'],           // Openingsfase = fase 1
      'ontdekking': ['2'],        // Ontdekkingsfase = fase 2
      'aanbeveling': ['3'],       // Aanbevelingsfase = fase 3
      'beslissing': ['4'],        // Beslissingsfase = fase 4
    };
    
    return faseMap[filterValue]?.includes(faseNum) || false;
  };
  
  // Helper function to match filter status to actual database statuses
  const matchesFilterStatus = (videoStatus: string, filterValue: string): boolean => {
    if (filterValue === 'all') return true;
    
    // Cloud Run statuses
    const cloudRunStatuses = ['external_processing', 'cloud_queued', 'cloud_downloading', 'cloud_chromakey', 'cloud_audio', 'cloud_transcribing', 'cloud_embedding', 'cloud_uploading', 'mux_processing'];
    
    switch (filterValue) {
      case 'ready':
        return ['completed', 'filtered', 'ready'].includes(videoStatus);
      case 'processing':
        return ['downloading', 'matting', 'extracting_audio', 'embedding', 'uploading_mux', 'processing'].includes(videoStatus);
      case 'transcribing':
        return videoStatus === 'transcribing';
      case 'pending':
        return videoStatus === 'pending';
      case 'external_processing':
        return cloudRunStatuses.includes(videoStatus);
      case 'disk_quota':
        return videoStatus === 'disk_quota';
      case 'error':
        return ['failed', 'chromakey_failed', 'cloud_failed', 'error'].includes(videoStatus);
      default:
        return videoStatus === filterValue;
    }
  };
  
  // Helper function to match videos to KPI stage - matches videos that have COMPLETED that stage
  const matchesKpiStage = (video: LibraryVideo, kpiStage: string): boolean => {
    const rawStatus = (video as any).raw_status || video.status;
    
    // Map each status to which stages are DONE (same as calculatePipelineStats)
    const statusToDoneStages: Record<string, string[]> = {
      'pending': [],
      'cloud_queued': [],
      'downloading': [],
      'cloud_downloading': [],
      'matting': ['drive'],
      'cloud_chromakey': ['drive'],
      'extracting_audio': ['drive', 'greenscreen'],
      'cloud_audio': ['drive', 'greenscreen'],
      'transcribing': ['drive', 'greenscreen', 'audio'],
      'cloud_transcribing': ['drive', 'greenscreen', 'audio'],
      'embedding': ['drive', 'greenscreen', 'audio', 'transcript'],
      'cloud_embedding': ['drive', 'greenscreen', 'audio', 'transcript'],
      'uploading_mux': ['drive', 'greenscreen', 'audio', 'transcript', 'rag'],
      'cloud_uploading': ['drive', 'greenscreen', 'audio', 'transcript', 'rag'],
      'mux_processing': ['drive', 'greenscreen', 'audio', 'transcript', 'rag'],
      'completed': ['drive', 'greenscreen', 'audio', 'transcript', 'rag', 'mux'],
      'filtered': ['drive', 'greenscreen', 'audio', 'transcript', 'rag'],
      'ready': ['drive', 'greenscreen', 'audio', 'transcript', 'rag', 'mux'],
    };
    
    // Cloud Run statuses for cloudrun filter
    const cloudRunStatuses = ['external_processing', 'cloud_queued', 'cloud_downloading', 'cloud_chromakey', 'cloud_audio', 'cloud_transcribing', 'cloud_embedding', 'cloud_uploading', 'mux_processing', 'cloud_failed'];
    
    // For cloudrun stage, check if currently processing on Cloud Run
    if (kpiStage === 'cloudrun') {
      return cloudRunStatuses.includes(rawStatus);
    }
    
    // Check if this video has completed the requested stage
    const doneStages = statusToDoneStages[rawStatus] || [];
    if (doneStages.includes(kpiStage)) {
      return true;
    }
    
    // Also match videos currently PROCESSING in that stage
    const currentStageMapping: Record<string, string> = {
      'downloading': 'drive',
      'cloud_downloading': 'drive',
      'matting': 'greenscreen',
      'cloud_chromakey': 'greenscreen',
      'extracting_audio': 'audio',
      'cloud_audio': 'audio',
      'transcribing': 'transcript',
      'cloud_transcribing': 'transcript',
      'embedding': 'rag',
      'cloud_embedding': 'rag',
      'uploading_mux': 'mux',
      'cloud_uploading': 'mux',
      'mux_processing': 'mux',
    };
    
    if (currentStageMapping[rawStatus] === kpiStage) {
      return true;
    }
    
    // Check for failed videos by stage
    if (rawStatus === 'failed' || rawStatus === 'cloud_failed' || rawStatus === 'chromakey_failed') {
      const errorMsg = ((video as any).error_message || '').toLowerCase();
      if (kpiStage === 'drive' && (errorMsg.includes('download') || errorMsg.includes('drive') || errorMsg.includes('disk quota') || errorMsg.includes('errno 122'))) return true;
      if (kpiStage === 'greenscreen' && (errorMsg.includes('greenscreen') || errorMsg.includes('matting') || errorMsg.includes('chromakey'))) return true;
      if (kpiStage === 'audio' && (errorMsg.includes('audio') || errorMsg.includes('extract'))) return true;
      if (kpiStage === 'transcript' && (errorMsg.includes('transcriptie') || errorMsg.includes('transcri') || errorMsg.includes('elevenlabs'))) return true;
      if (kpiStage === 'rag' && (errorMsg.includes('rag') || errorMsg.includes('embedding'))) return true;
      if (kpiStage === 'mux' && errorMsg.includes('mux')) return true;
      if (kpiStage === 'drive' && !errorMsg) return true;
    }
    
    return false;
  };
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'code' | 'title' | 'status' | 'fase' | 'duration' | 'size' | 'created'>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" style={{ color: '#9333ea' }} />
      : <ArrowDown className="w-3 h-3 ml-1" style={{ color: '#9333ea' }} />;
  };

  // Preview, Details, Delete state
  const [previewVideo, setPreviewVideo] = useState<LibraryVideo | null>(null);
  const [detailsVideo, setDetailsVideo] = useState<LibraryVideo | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<LibraryVideo | null>(null);
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [transcriptModal, setTranscriptModal] = useState<{ open: boolean; title: string; content: string }>({
    open: false,
    title: "",
    content: "",
  });

  // Videos from database
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  
  // ARCHIVED: Bulk selection state - temporarily disabled for UX clarity
  // const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  // const [isBulkSending, setIsBulkSending] = useState(false);
  
  // Batch Queue state - voor geautomatiseerd versturen met interval
  // Initialize with default values so button always renders
  const [batchQueueStatus, setBatchQueueStatus] = useState<{
    active: boolean;
    totalJobs: number;
    sentCount: number;
    remainingJobs: number;
    intervalMinutes?: number;
    nextSendAt?: string | null;
    lastCompletedAt?: string | null;
    minutesSinceLastCompletion?: number | null;
    isStalled?: boolean;
    counters?: {
      pending: number;
      processed_in_batch: number;
      failed_in_batch: number;
      total_in_batch: number;
    };
  }>({
    active: false,
    totalJobs: 0,
    sentCount: 0,
    remainingJobs: 0,
    lastCompletedAt: null,
    minutesSinceLastCompletion: null,
    counters: {
      pending: 0,
      processed_in_batch: 0,
      failed_in_batch: 0,
      total_in_batch: 0
    }
  });
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  
  // Fetch batch queue status - now reads from Supabase via server, no rate limiting
  const fetchBatchStatus = async () => {
    try {
      const resp = await fetch('/api/video-processor/batch/status');
      if (resp.ok) {
        const data = await resp.json();
        setBatchQueueStatus(data);
      }
    } catch (e) {
      console.error('Batch status error:', e);
    }
  };
  
  // Poll batch status - reduced to every 2 minutes to avoid overload
  useEffect(() => {
    fetchBatchStatus();
    const interval = setInterval(fetchBatchStatus, 120000); // elke 2 min
    return () => clearInterval(interval);
  }, []);
  
  const handleStartBatchQueue = async (forceRestart = false) => {
    setIsStartingBatch(true);
    
    // If stalled or forceRestart, first stop the old batch
    if (forceRestart || batchQueueStatus?.isStalled) {
      toast.info('Vastgelopen worker resetten...');
      try {
        await fetch('/api/video-processor/batch/stop', { method: 'POST' });
        await new Promise(r => setTimeout(r, 1000)); // Wait for stop to complete
      } catch (e) {
        // Ignore stop errors, continue with start
      }
    }
    
    // Retry with exponential backoff (Cloud Run rate limiting)
    const maxRetries = 3;
    let delay = 2000; // Start with 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const resp = await fetch('/api/video-processor/batch/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intervalMinutes: 15 })
        });
        const data = await resp.json();
        
        if (data.success) {
          toast.success(`Batch queue gestart: ${data.totalJobs} video's`);
          // Optimistic update - immediately show "Stop Worker" state
          setBatchQueueStatus(prev => ({ 
            ...prev, 
            active: true,
            isStalled: false,
            totalJobs: data.totalJobs || prev.totalJobs,
            remainingJobs: data.totalJobs || prev.remainingJobs
          }));
          // Then refresh from server to get accurate counts
          setTimeout(() => fetchBatchStatus(), 5000);
          setIsStartingBatch(false);
          return;
        } else if (data.message?.includes('already running')) {
          // Force stop and retry
          toast.info('Oude batch resetten...');
          await fetch('/api/video-processor/batch/stop', { method: 'POST' });
          await new Promise(r => setTimeout(r, 1500));
          continue;
        } else if (data.message?.includes('Rate exceeded') && attempt < maxRetries) {
          toast.info(`Rate limit, retry ${attempt}/${maxRetries}...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2; // Exponential backoff
          continue;
        } else {
          toast.error(data.message || 'Kon batch niet starten');
          setIsStartingBatch(false);
          return;
        }
      } catch (e) {
        if (attempt < maxRetries) {
          toast.info(`Verbindingsfout, retry ${attempt}/${maxRetries}...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        toast.error('Kon batch queue niet starten na meerdere pogingen');
      }
    }
    setIsStartingBatch(false);
  };
  
  const handleStopBatchQueue = async () => {
    try {
      const resp = await fetch('/api/video-processor/batch/stop', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Batch queue gestopt: ${data.sentCount} verstuurd, ${data.remainingJobs} overgebleven`);
        // Optimistic update - immediately show "Start Worker" state
        setBatchQueueStatus(prev => ({ ...prev, active: false }));
        // Then refresh from server to get accurate counts
        setTimeout(() => fetchBatchStatus(), 2000);
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error('Kon batch queue niet stoppen');
    }
  };
  
  /* ARCHIVED: Bulk selection functions - temporarily disabled for UX clarity
  const getEligibleVideos = () => {
    return videos.filter(v => v.status === 'disk_quota' && v.drive_file_id && v.source === 'pipeline');
  };
  
  const getFilteredEligibleVideos = () => {
    return videos.filter(v => {
      if (v.status !== 'disk_quota' || !v.drive_file_id || v.source !== 'pipeline') return false;
      if (!matchesSearch(v, searchQuery)) return false;
      if (!matchesFaseFilter(v, filterFase)) return false;
      if (!matchesFilterStatus(v.status, filterStatus)) return false;
      return true;
    });
  };
  
  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };
  
  const selectAllEligible = () => {
    const eligible = getFilteredEligibleVideos();
    setSelectedVideoIds(new Set(eligible.map(v => v.id)));
  };
  
  const clearSelection = () => {
    setSelectedVideoIds(new Set());
  };
  
  const handleBulkSendToCloudRun = async () => {
    if (selectedVideoIds.size === 0) return;
    setIsBulkSending(true);
    const videosToSend = videos.filter(v => 
      selectedVideoIds.has(v.id) && v.status === 'disk_quota' && v.drive_file_id && v.source === 'pipeline'
    );
    if (videosToSend.length === 0) {
      toast.error("Geen eligible video's meer om te versturen");
      setIsBulkSending(false);
      setSelectedVideoIds(new Set());
      return;
    }
    let successCount = 0;
    let failedIds: string[] = [];
    toast.loading(`${videosToSend.length} video's naar Cloud Run sturen...`, { id: 'bulk-cloud-run' });
    for (const video of videosToSend) {
      try {
        const response = await fetch('/api/video-processor/external', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: video.id, drive_file_id: video.drive_file_id })
        });
        if (response.ok) successCount++;
        else failedIds.push(video.id);
      } catch (error) {
        failedIds.push(video.id);
      }
    }
    try {
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      setVideos(updatedVideos.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline' })));
    } catch (e) {
      console.error("Failed to refresh videos:", e);
    }
    setSelectedVideoIds(new Set(failedIds));
    setIsBulkSending(false);
    if (failedIds.length === 0) toast.success(`${successCount} video's naar Cloud Run gestuurd!`, { id: 'bulk-cloud-run' });
    else if (successCount > 0) toast.warning(`${successCount} geslaagd, ${failedIds.length} mislukt`, { id: 'bulk-cloud-run' });
    else toast.error(`Alle ${failedIds.length} video's mislukt`, { id: 'bulk-cloud-run' });
  };
  END ARCHIVED */
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitiallyLoaded = useRef(false);

  // View mode and stats
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'reorder'>('reorder');
  const [reorderVideos, setReorderVideos] = useState<LibraryVideo[]>([]);
  const [reorderDirty, setReorderDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    summary: {
      totalInDrive: number;
      existingInDatabase: number;
      wouldAdd: number;
      wouldRestore: number;
      wouldMarkDeleted: number;
      unchanged: number;
    };
    safe: boolean;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resettingErrors, setResettingErrors] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [credentialsValid, setCredentialsValid] = useState<boolean | null>(null);
  const SYNC_FOLDERS = [
    { id: "1Oaww3IMBcFZ1teFvSoqAUART2B6Q6VrT", name: "Door Hugo geordende videos" },
    { id: "1iaRAByySJPXpcJ6I3aoXwlb0SR3q3wKZ", name: "image.canon" },
  ];
  const [pipelineStats, setPipelineStats] = useState({
    total: 0,
    drive: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
    greenscreen: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
    audio: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
    transcript: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
    rag: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
    mux: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
    cloudrun: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
    pending: 0,
  });

  // Calculate pipeline stats from videos array - based on actual job status
  // Each Cloud Run status maps to EXACTLY ONE stage to avoid double-counting
  const ARCHIEF_FOLDER_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq';
  
  const calculatePipelineStats = (videoList: LibraryVideo[]) => {
    // Only count pipeline videos, not manual uploads
    // Also exclude deleted/archived videos from all counts
    // Exclude archief folder videos from counts (they use separate transcription pipeline)
    const pipelineVideos = videoList.filter(v => 
      v.source === 'pipeline' && 
      v.raw_status !== 'deleted' && 
      v.status !== 'deleted' &&
      v.drive_folder_id !== ARCHIEF_FOLDER_ID
    );
    const total = pipelineVideos.length;
    
    const stats = {
      total,
      drive: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
      greenscreen: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
      audio: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
      transcript: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
      rag: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
      mux: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
      cloudrun: { done: 0, processing: 0, failed: 0, stuck: 0, pending: 0, errorMessages: [] as string[] },
      pending: 0,
    };
    
    // Helper to check if video is stuck (processing for >15 min)
    const isStuck = (video: LibraryVideo): boolean => {
      if (!video.updated_at) return false;
      const updatedAt = new Date(video.updated_at).getTime();
      const now = Date.now();
      const fifteenMinutes = 15 * 60 * 1000;
      return (now - updatedAt) > fifteenMinutes;
    };
    
    // Map each status to exactly ONE current stage and which stages are done
    // Format: { currentStage: 'stage_name' | null, doneStages: string[] }
    const statusMapping: Record<string, { currentStage: string | null, doneStages: string[] }> = {
      // Pending - nothing done yet
      'pending': { currentStage: null, doneStages: [] },
      'cloud_queued': { currentStage: null, doneStages: [] },
      
      // Drive stage
      'downloading': { currentStage: 'drive', doneStages: [] },
      'cloud_downloading': { currentStage: 'drive', doneStages: [] },
      
      // Greenscreen stage
      'matting': { currentStage: 'greenscreen', doneStages: ['drive'] },
      'cloud_chromakey': { currentStage: 'greenscreen', doneStages: ['drive'] },
      
      // Audio stage
      'extracting_audio': { currentStage: 'audio', doneStages: ['drive', 'greenscreen'] },
      'cloud_audio': { currentStage: 'audio', doneStages: ['drive', 'greenscreen'] },
      
      // Transcript stage
      'transcribing': { currentStage: 'transcript', doneStages: ['drive', 'greenscreen', 'audio'] },
      'cloud_transcribing': { currentStage: 'transcript', doneStages: ['drive', 'greenscreen', 'audio'] },
      
      // RAG/Embedding stage
      'embedding': { currentStage: 'rag', doneStages: ['drive', 'greenscreen', 'audio', 'transcript'] },
      'cloud_embedding': { currentStage: 'rag', doneStages: ['drive', 'greenscreen', 'audio', 'transcript'] },
      
      // Mux upload stage
      'uploading_mux': { currentStage: 'mux', doneStages: ['drive', 'greenscreen', 'audio', 'transcript', 'rag'] },
      'cloud_uploading': { currentStage: 'mux', doneStages: ['drive', 'greenscreen', 'audio', 'transcript', 'rag'] },
      'mux_processing': { currentStage: 'mux', doneStages: ['drive', 'greenscreen', 'audio', 'transcript', 'rag'] },
      
      // Completed - all stages done
      'completed': { currentStage: null, doneStages: ['drive', 'greenscreen', 'audio', 'transcript', 'rag', 'mux'] },
      'filtered': { currentStage: null, doneStages: ['drive', 'greenscreen', 'audio', 'transcript', 'rag'] },
      
      // Generic external processing - assume at chromakey stage
      'external_processing': { currentStage: 'greenscreen', doneStages: ['drive'] },
    };
    
    const cloudRunStatuses = ['external_processing', 'cloud_queued', 'cloud_downloading', 'cloud_chromakey', 'cloud_audio', 'cloud_transcribing', 'cloud_embedding', 'cloud_uploading', 'mux_processing'];
    
    for (const video of pipelineVideos) {
      const rawStatus = (video as any).raw_status || video.status;
      const mapping = statusMapping[rawStatus];
      const isCloudRun = cloudRunStatuses.includes(rawStatus);
      
      if (mapping) {
        // Mark completed stages as done
        if (mapping.doneStages.includes('drive')) stats.drive.done++;
        if (mapping.doneStages.includes('greenscreen')) stats.greenscreen.done++;
        if (mapping.doneStages.includes('audio')) stats.audio.done++;
        if (mapping.doneStages.includes('transcript')) stats.transcript.done++;
        // RAG: only count as done if video actually has embeddings (has_rag field)
        if (video.has_rag) stats.rag.done++;
        if (mapping.doneStages.includes('mux') && video.has_mux) stats.mux.done++;
        
        // Mark current stage as processing and check for stuck
        const videoIsStuck = isStuck(video) && mapping.currentStage !== null;
        if (mapping.currentStage === 'drive') {
          if (videoIsStuck) stats.drive.stuck++;
          else stats.drive.processing++;
        }
        if (mapping.currentStage === 'greenscreen') {
          if (videoIsStuck) stats.greenscreen.stuck++;
          else stats.greenscreen.processing++;
        }
        if (mapping.currentStage === 'audio') {
          if (videoIsStuck) stats.audio.stuck++;
          else stats.audio.processing++;
        }
        if (mapping.currentStage === 'transcript') {
          if (videoIsStuck) stats.transcript.stuck++;
          else stats.transcript.processing++;
        }
        if (mapping.currentStage === 'rag') {
          if (videoIsStuck) stats.rag.stuck++;
          else stats.rag.processing++;
        }
        if (mapping.currentStage === 'mux') {
          if (videoIsStuck) stats.mux.stuck++;
          else stats.mux.processing++;
        }
      }
      
      // Cloud Run tracking
      if (rawStatus === 'completed' && isCloudRun) stats.cloudrun.done++;
      else if (isCloudRun) stats.cloudrun.processing++;
      else if (rawStatus === 'cloud_failed') stats.cloudrun.failed++;
      
      // Count pending (including cloud_queued)
      if (rawStatus === 'pending' || rawStatus === 'cloud_queued') stats.pending++;
      
      // Failed status handling with error message collection
      const errorMessage = (video as any).error_message || '';
      if (rawStatus === 'chromakey_failed') {
        stats.drive.done++;
        stats.greenscreen.failed++;
        if (errorMessage) stats.greenscreen.errorMessages.push(errorMessage);
      } else if (rawStatus === 'cloud_failed') {
        stats.cloudrun.failed++;
        if (errorMessage) stats.cloudrun.errorMessages.push(errorMessage);
      } else if (rawStatus === 'failed') {
        const errorMsgLower = errorMessage.toLowerCase();
        if (errorMsgLower.includes('download') || errorMsgLower.includes('drive') || errorMsgLower.includes('disk quota') || errorMsgLower.includes('errno 122')) {
          stats.drive.failed++;
          if (errorMessage) stats.drive.errorMessages.push(errorMessage);
        } else if (errorMsgLower.includes('greenscreen') || errorMsgLower.includes('matting') || errorMsgLower.includes('chromakey')) {
          stats.drive.done++;
          stats.greenscreen.failed++;
          if (errorMessage) stats.greenscreen.errorMessages.push(errorMessage);
        } else if (errorMsgLower.includes('audio') || errorMsgLower.includes('extract')) {
          stats.drive.done++;
          stats.greenscreen.done++;
          stats.audio.failed++;
          if (errorMessage) stats.audio.errorMessages.push(errorMessage);
        } else if (errorMsgLower.includes('transcriptie') || errorMsgLower.includes('transcri') || errorMsgLower.includes('elevenlabs')) {
          stats.drive.done++;
          stats.greenscreen.done++;
          stats.audio.done++;
          stats.transcript.failed++;
          if (errorMessage) stats.transcript.errorMessages.push(errorMessage);
        } else if (errorMsgLower.includes('rag') || errorMsgLower.includes('embedding')) {
          stats.drive.done++;
          stats.greenscreen.done++;
          stats.audio.done++;
          stats.transcript.done++;
          stats.rag.failed++;
          if (errorMessage) stats.rag.errorMessages.push(errorMessage);
        } else if (errorMsgLower.includes('mux')) {
          stats.drive.done++;
          stats.greenscreen.done++;
          stats.audio.done++;
          stats.transcript.done++;
          stats.rag.done++;
          stats.mux.failed++;
          if (errorMessage) stats.mux.errorMessages.push(errorMessage);
        } else {
          stats.drive.failed++;
          if (errorMessage) stats.drive.errorMessages.push(errorMessage);
        }
      }
    }
    
    // Pending per step: only Drive has pending (videos waiting to enter pipeline)
    // Other steps: videos flow through immediately, no separate pending queue
    stats.drive.pending = stats.pending; // Videos with status 'pending' or 'cloud_queued'
    
    setPipelineStats(stats);
  };

  // Update stats whenever videos change
  useEffect(() => {
    calculatePipelineStats(videos);
  }, [videos]);

  // Fetch videos from API
  const fetchVideos = async (isBackgroundRefresh = false) => {
    try {
      // Only show full loading state on initial load, not background refreshes
      if (!hasInitiallyLoaded.current) {
        setLoadingVideos(true);
      } else if (isBackgroundRefresh) {
        setIsRefreshing(true);
      }
      
      const data = await videoApi.getLibrary(undefined, undefined, true); // Include hidden videos for admin
      const mappedVideos = data.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline', is_hidden: (v as any).is_hidden ?? false, transcript: (v as any).transcript || null })) as LibraryVideo[];
      setVideos(mappedVideos);
      hasInitiallyLoaded.current = true;
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setLoadingVideos(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Auto-refresh every 10 seconds when there are pending/processing jobs
  useEffect(() => {
    const hasActiveJobs = videos.some(v => 
      ['pending', 'downloading', 'matting', 'extracting_audio', 'transcribing', 'embedding', 'uploading_mux'].includes(v.status)
    );
    
    if (hasActiveJobs) {
      const refreshInterval = setInterval(() => {
        fetchVideos(true); // Background refresh - don't show loading spinner
      }, 10000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [videos]);

  const initReorderView = () => {
    const readyVideos = videos
      .filter(v => v.status === 'ready' && v.mux_playback_id && !v.is_hidden)
      .sort((a, b) => {
        if (a.playback_order != null && b.playback_order != null) return a.playback_order - b.playback_order;
        if (a.playback_order != null) return -1;
        if (b.playback_order != null) return 1;
        const techA = a.ai_suggested_techniek_id || a.technique_id || '999';
        const techB = b.ai_suggested_techniek_id || b.technique_id || '999';
        return techA.localeCompare(techB, undefined, { numeric: true });
      });
    setReorderVideos(readyVideos);
    setReorderDirty(false);
  };

  useEffect(() => {
    if (viewMode === 'reorder' && videos.length > 0) {
      initReorderView();
    }
  }, [viewMode, videos]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newList = [...reorderVideos];
    const [removed] = newList.splice(draggedIndex, 1);
    newList.splice(index, 0, removed);
    setReorderVideos(newList);
    setReorderDirty(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...reorderVideos];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setReorderVideos(newList);
    setReorderDirty(true);
  };

  const handleMoveDown = (index: number) => {
    if (index >= reorderVideos.length - 1) return;
    const newList = [...reorderVideos];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setReorderVideos(newList);
    setReorderDirty(true);
  };

  const handleSavePlaybackOrder = async () => {
    setIsSavingOrder(true);
    try {
      const orders = reorderVideos.map((v, i) => ({
        id: v.id,
        playback_order: i + 1,
        source: v.source,
      }));
      await videoApi.updatePlaybackOrder(orders);
      toast.success(`Afspeelvolgorde opgeslagen voor ${orders.length} video's`);
      setReorderDirty(false);
      await fetchVideos(true);
    } catch (err) {
      toast.error('Kon afspeelvolgorde niet opslaan');
      console.error(err);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleAutoOrder = () => {
    const sorted = [...reorderVideos].sort((a, b) => {
      const techA = a.ai_suggested_techniek_id || a.technique_id || '999';
      const techB = b.ai_suggested_techniek_id || b.technique_id || '999';
      return techA.localeCompare(techB, undefined, { numeric: true });
    });
    setReorderVideos(sorted);
    setReorderDirty(true);
    toast.info('Volgorde gesorteerd op techniek-nummering. Klik "Opslaan" om te bevestigen.');
  };

  const [isDriveOrdering, setIsDriveOrdering] = useState(false);
  const [isAiOrdering, setIsAiOrdering] = useState(false);
  const [driveTotalCount, setDriveTotalCount] = useState<number | null>(null);

  const handleAiOrder = async () => {
    setIsAiOrdering(true);
    try {
      toast.loading("AI analyseert video's voor optimale volgorde...", { id: 'ai-order' });
      const response = await fetch('/api/videos/ai-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'AI volgorde mislukt');

      if (result.order && result.order.length > 0) {
        const orderMap = new Map(result.order.map((item: { id: string; position: number }) => [item.id, item.position]));
        const sorted = [...reorderVideos].sort((a, b) => {
          const posA = orderMap.get(a.id) ?? 9999;
          const posB = orderMap.get(b.id) ?? 9999;
          return (posA as number) - (posB as number);
        });
        setReorderVideos(sorted);
        setReorderDirty(true);
        toast.success(`AI volgorde toegepast op ${result.total} video's. Klik "Opslaan" om te bevestigen.`, { id: 'ai-order' });
      } else {
        toast.error('Geen volgorde ontvangen van AI', { id: 'ai-order' });
      }
    } catch (err: any) {
      toast.error(`AI volgorde fout: ${err.message}`, { id: 'ai-order' });
    } finally {
      setIsAiOrdering(false);
    }
  };

  const handleDriveOrder = async (dryRun = false) => {
    setIsDriveOrdering(true);
    try {
      const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
      const response = await fetch('/api/videos/auto-order-from-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${processorSecret}`
        },
        body: JSON.stringify({ dry_run: dryRun })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Fout bij ophalen Drive-volgorde');

      if (dryRun) {
        const preview = (result.order || []).slice(0, 20).map((v: { order: number; title: string; drive_path: string }) =>
          `${v.order}. ${v.title} (${v.drive_path || 'root'})`
        ).join('\n');
        toast.success(`Drive-volgorde preview: ${result.matched} video's gematcht.\n\nEerste 20:\n${preview}`, { duration: 10000 });
      } else {
        toast.success(`Drive-volgorde toegepast op ${result.matched} video's! Pagina wordt ververst...`);
        await fetchVideos(true);
      }
    } catch (err: any) {
      toast.error(`Drive-volgorde fout: ${err.message}`);
    } finally {
      setIsDriveOrdering(false);
    }
  };

  // Preview sync - shows what would happen without making changes
  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewResult(null);
    
    try {
      toast.loading("Preview bezig...", { id: 'preview' });
      
      const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
      const response = await fetch("/api/video-processor/sync-preview", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${processorSecret}`
        },
        body: JSON.stringify({ folderIds: SYNC_FOLDERS.map(f => f.id) })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Preview mislukt");
      }
      
      setPreviewResult(result);
      
      if (result.safe) {
        toast.success(`Preview: ${result.summary.activeInDrive || result.summary.totalInDrive} video's gevonden in Drive (excl. archief)`, { id: 'preview' });
      } else {
        toast.error(`Waarschuwing: ${result.summary.wouldMarkDeleted} video's zouden verwijderd worden!`, { id: 'preview' });
      }
    } catch (err: any) {
      toast.error(`Preview fout: ${err.message}`, { id: 'preview' });
    } finally {
      setPreviewing(false);
    }
  };

  // Handle Google Drive sync - syncs both folders automatically
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    
    let totalAdded = 0;
    let totalRestored = 0;
    let totalUnchanged = 0;
    
    try {
      toast.loading("Google Drive synchronisatie bezig...", { id: 'sync' });
      
      const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
      
      // Sync all folders in one call (important: must sync all at once to correctly detect deletions)
      const response = await fetch("/api/video-processor/sync", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${processorSecret}`
        },
        body: JSON.stringify({ folderIds: SYNC_FOLDERS.map(f => f.id) })
      });

      const result = await response.json();
      
      if (!response.ok && response.status !== 202) {
        console.warn('Sync mislukt:', result.message);
        throw new Error(result.message);
      }
      
      // 202 = background sync started, reload after ~35s when sync is done
      if (response.status === 202) {
        toast.success("Sync gestart! Volgorde wordt bijgewerkt, herlaad over 35 seconden...", { id: 'sync', duration: 35000 });
        setSyncResult({ success: true, message: 'Bezig...' });
        setTimeout(async () => {
          await fetchVideos();
          toast.success("Drive sync voltooid! Volgorde bijgewerkt.", { id: 'sync-done' });
          setSyncResult({ success: true, message: 'Klaar' });
          setTimeout(() => setSyncResult(null), 5000);
        }, 35000);
        return;
      }
      
      totalAdded = result.added?.length || 0;
      totalRestored = result.added?.filter((v: any) => v.restored)?.length || 0;
      totalUnchanged = result.unchanged || 0;
      
      const totalArchived = result.archived?.length || 0;
      const totalDeleted = result.deleted?.length || 0;
      
      console.log(`Sync result: +${totalAdded} added, ${totalArchived} archived, ${totalDeleted} deleted, ${totalUnchanged} unchanged`);
      
      await fetchVideos();
      
      if (totalAdded > 0) {
        const msg = totalRestored > 0 
          ? `${totalAdded} video's toegevoegd (${totalRestored} hersteld)`
          : `${totalAdded} video's toegevoegd!`;
        toast.success(msg, { id: 'sync' });
        setSyncResult({ success: true, message: `+${totalAdded}` });
      } else {
        toast.success(`Sync klaar: ${totalUnchanged} video's up-to-date`, { id: 'sync' });
        setSyncResult({ success: true, message: 'Up-to-date' });
      }
      
      // Clear success state after 5 seconds
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err: any) {
      toast.error(`Sync fout: ${err.message}`, { id: 'sync' });
      setSyncResult({ success: false, message: 'Fout' });
      setTimeout(() => setSyncResult(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  // Handle Cloud Run worker deployment
  const handleDeployWorker = async () => {
    setDeploying(true);
    try {
      toast.loading("Cloud Run worker deployen...", { id: 'deploy' });
      
      const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
      const response = await fetch("/api/admin/cloud-run/deploy", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${processorSecret}`
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.message || "Deployment mislukt");
      }
      
      toast.success(result.message || "Worker deployment gestart!", { id: 'deploy' });
    } catch (err: any) {
      toast.error(`Deploy fout: ${err.message}`, { id: 'deploy' });
    } finally {
      setDeploying(false);
    }
  };

  // Check Cloud Run credentials on mount
  useEffect(() => {
    const checkCredentials = async () => {
      try {
        const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
        const response = await fetch("/api/admin/cloud-run/check-credentials", {
          headers: { "Authorization": `Bearer ${processorSecret}` }
        });
        const result = await response.json();
        setCredentialsValid(result.valid);
      } catch {
        setCredentialsValid(false);
      }
    };
    checkCredentials();
  }, []);

  // Auto-sync on mount and every 60 minutes
  useEffect(() => {
    const autoSync = async () => {
      try {
        const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
        const response = await fetch("/api/video-processor/sync", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${processorSecret}`
          },
          body: JSON.stringify({ folderIds: SYNC_FOLDERS.map(f => f.id) })
        });
        const result = await response.json();
        if (response.ok && result.added?.length > 0) {
          toast.success(`${result.added.length} nieuwe video's gevonden in Drive`);
          await fetchVideos();
          try {
            await fetch('/api/video-processor/batch/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ intervalMinutes: 15 })
            });
          } catch (e) { /* silent */ }
        }
        // Also update the drive total count via preview
        try {
          const previewResp = await fetch("/api/video-processor/sync-preview", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${processorSecret}`
            },
            body: JSON.stringify({ folderIds: SYNC_FOLDERS.map(f => f.id) })
          });
          const previewResult = await previewResp.json();
          if (previewResp.ok) {
            setDriveTotalCount(previewResult.summary?.activeInDrive || previewResult.summary?.totalInDrive || null);
          }
        } catch (e) { /* silent */ }
      } catch (e) { /* silent background sync */ }
    };
    
    const initialTimeout = setTimeout(autoSync, 3000);
    const interval = setInterval(autoSync, 60 * 60 * 1000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // Handle video processing - starts Cloud Run batch queue
  const handleProcessVideos = async () => {
    if (pipelineStats.pending === 0) {
      toast.info("Geen wachtende video's om te verwerken");
      return;
    }

    setProcessing(true);
    try {
      const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
      const response = await fetch("/api/video-processor/batch/start", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${processorSecret}`
        },
        body: JSON.stringify({ intervalMinutes: 15 })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Batch queue gestart! ${result.totalJobs} video's worden verwerkt (${result.estimatedDuration})`);
        
        // Poll for status updates every 30 seconds
        const checkInterval = setInterval(async () => {
          await fetchVideos();
          try {
            const statusRes = await fetch("/api/video-processor/batch/status");
            const status = await statusRes.json();
            if (!status.active) {
              clearInterval(checkInterval);
              setProcessing(false);
              toast.success("Batch verwerking voltooid!");
            }
          } catch {
            // Ignore status check errors
          }
        }, 30000);
        
        // Don't keep processing state active for long batches
        setTimeout(() => setProcessing(false), 10000);
      } else {
        toast.error(result.message || "Kon batch niet starten");
        setProcessing(false);
      }
    } catch (err: any) {
      toast.error(`Fout: ${err.message}`);
      setProcessing(false);
    }
  };

  // State for edit mode in Video Details modal
  const [isEditingVideo, setIsEditingVideo] = useState(false);
  const [editedVideoData, setEditedVideoData] = useState<{
    title: string;
    attractiveTitle: string;
    description: string;
    techniqueDoel: string;
    techniqueWat: string;
    techniqueWaarom: string;
    techniqueWanneer: string;
    techniqueHoe: string;
    techniqueStappenplan: string;
    techniqueVoorbeeld: string;
    techniqueTags: string;
    techniqueThemas: string;
    techniqueContextRequirements: string;
  }>({title: '', attractiveTitle: '', description: '', techniqueDoel: '', techniqueWat: '', techniqueWaarom: '', techniqueWanneer: '', techniqueHoe: '', techniqueStappenplan: '', techniqueVoorbeeld: '', techniqueTags: '', techniqueThemas: '', techniqueContextRequirements: ''});
  
  const openDetailsDialog = async (video: LibraryVideo) => {
    setDetailsVideo(video);
    setSelectedTechniqueId(video.technique_id || video.ai_suggested_techniek_id || "");
    setIsEditingVideo(false);
    setEditedVideoData({title: '', attractiveTitle: '', description: '', techniqueDoel: '', techniqueWat: '', techniqueWaarom: '', techniqueWanneer: '', techniqueHoe: '', techniqueStappenplan: '', techniqueVoorbeeld: '', techniqueTags: '', techniqueThemas: '', techniqueContextRequirements: ''});
    setSummaryExpanded(false); // Reset summary expand state
    setTranscriptExpanded(false); // Reset transcript expand state
    
    if (video.has_transcript && !video.transcript) {
      try {
        const response = await fetch(`/api/videos/${video.id}/transcript`);
        if (response.ok) {
          const data = await response.json();
          setDetailsVideo(prev => prev ? { ...prev, transcript: data.transcript || null, ai_summary: data.ai_summary || null } : null);
        }
      } catch (err) {
        console.error('Failed to fetch transcript:', err);
      }
    }
  };

  const handleSaveTechnique = async (closeModal: boolean = false) => {
    if (!detailsVideo) return;
    setIsSaving(true);
    try {
      if (detailsVideo.source === 'manual') {
        await videoApi.updateVideo(detailsVideo.id, {
          title: detailsVideo.title,
          technique_id: selectedTechniqueId || undefined,
        });
      } else {
        await videoApi.updateLibraryVideo(detailsVideo.id, {
          title: detailsVideo.title,
          techniek_id: selectedTechniqueId || undefined,
        });
      }
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      const mappedVideos = updatedVideos.map(v => ({ 
        ...v, 
        drive_file_id: v.drive_file_id || null, 
        source: v.source || 'pipeline',
        is_hidden: (v as any).is_hidden ?? false,
        transcript: (v as any).transcript || null
      })) as LibraryVideo[];
      setVideos(mappedVideos);
      
      if (closeModal) {
        setDetailsVideo(null);
      } else {
        // Find the updated video from the refreshed list to update modal with fresh data
        const freshVideo = mappedVideos.find(v => v.id === detailsVideo.id);
        if (freshVideo) {
          setDetailsVideo(freshVideo as LibraryVideo);
        }
      }
      toast.success("Techniek koppeling opgeslagen");
    } catch (error) {
      console.error("Failed to update video:", error);
      toast.error("Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteVideo) return;
    setIsDeleting(true);
    try {
      await videoApi.deleteLibraryVideo(deleteVideo.id, deleteVideo.source);
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      setVideos(updatedVideos.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline', is_hidden: (v as any).is_hidden ?? false, transcript: (v as any).transcript || null })) as LibraryVideo[]);
      setDeleteVideo(null);
      toast.success("Video verwijderd");
    } catch (error) {
      console.error("Failed to delete video:", error);
      toast.error("Video verwijderen mislukt");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleHidden = async (video: LibraryVideo) => {
    try {
      const newHiddenState = !video.is_hidden;
      await videoApi.toggleHidden(video.id, newHiddenState);
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      setVideos(updatedVideos.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline', is_hidden: (v as any).is_hidden ?? false, transcript: (v as any).transcript || null })) as LibraryVideo[]);
      toast.success(newHiddenState ? "Video verborgen" : "Video zichtbaar gemaakt");
    } catch (error) {
      console.error("Failed to toggle video visibility:", error);
      toast.error("Zichtbaarheid wijzigen mislukt");
    }
  };

  const handleReprocess = async (video: LibraryVideo) => {
    if (video.source !== 'pipeline') {
      toast.error("Alleen pipeline video's kunnen opnieuw verwerkt worden");
      return;
    }
    try {
      toast.loading("Video wordt gereset voor herverwerking...", { id: 'reprocess' });
      const { error } = await supabase
        .from('video_ingest_jobs')
        .update({ 
          status: 'pending',
          error_message: null,
          mux_asset_id: null,
          mux_playback_id: null,
          mux_status: null,
          transcript: null,
          rag_document_id: null,
          audio_url: null,
          duration_seconds: null,
          ai_suggested_techniek_id: null,
          ai_confidence: null
        })
        .eq('id', video.id);
      
      if (error) throw error;
      
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      setVideos(updatedVideos.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline', is_hidden: (v as any).is_hidden ?? false, transcript: (v as any).transcript || null })) as LibraryVideo[]);
      toast.success("Video gereset! Start 'Verwerk video's' om opnieuw te verwerken.", { id: 'reprocess' });
    } catch (error) {
      console.error("Failed to reprocess video:", error);
      toast.error("Herverwerking mislukt", { id: 'reprocess' });
    }
  };

  const handleSendToCloudRun = async (video: LibraryVideo) => {
    if (video.source !== 'pipeline' || !video.drive_file_id) {
      toast.error("Deze video kan niet extern verwerkt worden");
      return;
    }
    try {
      toast.loading("Video wordt naar Cloud Run gestuurd...", { id: 'cloud-run' });
      const response = await fetch('/api/video-processor/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: video.id,
          drive_file_id: video.drive_file_id
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Cloud Run verwerking mislukt');
      }
      
      // ARCHIVED: Remove from selection if it was selected
      // setSelectedVideoIds(prev => {
      //   const newSet = new Set(prev);
      //   newSet.delete(video.id);
      //   return newSet;
      // });
      
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      setVideos(updatedVideos.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline', is_hidden: (v as any).is_hidden ?? false, transcript: (v as any).transcript || null })) as LibraryVideo[]);
      toast.success("Video naar Cloud Run gestuurd! Verwerking duurt enkele minuten.", { id: 'cloud-run' });
    } catch (error: any) {
      console.error("Failed to send to Cloud Run:", error);
      toast.error(error.message || "Cloud Run verwerking mislukt", { id: 'cloud-run' });
    }
  };

  // Count total errors (failed + stuck statuses) - use raw_status from API which has original DB status
  const errorStatuses = ['failed', 'chromakey_failed', 'matting', 'downloading', 'extracting_audio', 'transcribing', 'embedding', 'uploading_mux'];
  const errorCount = videos.filter(v => {
    const rawStatus = (v as any).raw_status || v.status;
    return errorStatuses.includes(rawStatus);
  }).length;

  // Reset all errors and stuck videos to pending
  const handleResetErrors = async () => {
    setResettingErrors(true);
    try {
      toast.loading("Vastgelopen video's worden gereset...", { id: 'reset-errors' });
      
      // Get all failed/stuck pipeline videos
      const stuckStatuses = ['failed', 'chromakey_failed', 'matting', 'downloading', 'extracting_audio', 'transcribing', 'embedding', 'uploading_mux'];
      const { data: stuckJobs, error: fetchError } = await supabase
        .from('video_ingest_jobs')
        .select('id, error_message')
        .in('status', stuckStatuses);
      
      if (fetchError) throw fetchError;
      
      // Skip disk quota errors (they won't succeed on retry)
      let resetCount = 0;
      let skippedCount = 0;
      
      for (const job of stuckJobs || []) {
        const err = job.error_message || '';
        if (err.toLowerCase().includes('disk quota') || err.toLowerCase().includes('no space')) {
          skippedCount++;
          continue;
        }
        
        await supabase
          .from('video_ingest_jobs')
          .update({ 
            status: 'pending',
            error_message: null
          })
          .eq('id', job.id);
        resetCount++;
      }
      
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      setVideos(updatedVideos.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline', is_hidden: (v as any).is_hidden ?? false, transcript: (v as any).transcript || null })) as LibraryVideo[]);
      
      if (skippedCount > 0) {
        toast.success(`${resetCount} video's gereset! (${skippedCount} overgeslagen - te groot voor Replit)`, { id: 'reset-errors' });
      } else {
        toast.success(`${resetCount} video's gereset! Klik op 'Verwerk video's' om opnieuw te starten.`, { id: 'reset-errors' });
      }
    } catch (error) {
      console.error("Failed to reset errors:", error);
      toast.error("Reset mislukt", { id: 'reset-errors' });
    } finally {
      setResettingErrors(false);
    }
  };

  // Reset failed/stuck videos for a specific KPI stage
  const handleResetKpiStage = async (stageName: string, stageKey: string) => {
    try {
      toast.loading(`${stageName} video's worden gereset...`, { id: `reset-${stageKey}` });
      
      // Map stage to statuses to reset
      const stageToStatuses: Record<string, string[]> = {
        'drive': ['downloading', 'cloud_downloading', 'failed'],
        'greenscreen': ['matting', 'cloud_chromakey', 'chromakey_failed'],
        'audio': ['extracting_audio', 'cloud_audio'],
        'transcript': ['transcribing', 'cloud_transcribing'],
        'rag': ['embedding', 'cloud_embedding'],
        'mux': ['uploading_mux', 'cloud_uploading', 'mux_processing'],
        'cloudrun': ['external_processing', 'cloud_queued', 'cloud_downloading', 'cloud_chromakey', 'cloud_audio', 'cloud_transcribing', 'cloud_embedding', 'cloud_uploading', 'cloud_failed'],
      };
      
      const statusesToReset = stageToStatuses[stageKey] || [];
      
      // Get videos matching the stage that are stuck or failed
      const videosToReset = videos.filter(v => {
        const rawStatus = (v as any).raw_status || v.status;
        if (!statusesToReset.includes(rawStatus) && rawStatus !== 'failed') return false;
        
        // For generic 'failed' status, check error message to match stage
        if (rawStatus === 'failed') {
          return matchesKpiStage(v, stageKey);
        }
        
        return true;
      });
      
      if (videosToReset.length === 0) {
        toast.success(`Geen ${stageName} video's om te resetten`, { id: `reset-${stageKey}` });
        return;
      }
      
      let resetCount = 0;
      for (const video of videosToReset) {
        const { error } = await supabase
          .from('video_ingest_jobs')
          .update({ 
            status: 'pending',
            error_message: null
          })
          .eq('id', video.id);
        
        if (!error) resetCount++;
      }
      
      const updatedVideos = await videoApi.getLibrary(undefined, undefined, true);
      setVideos(updatedVideos.map(v => ({ ...v, drive_file_id: v.drive_file_id || null, source: v.source || 'pipeline', is_hidden: (v as any).is_hidden ?? false, transcript: (v as any).transcript || null })) as LibraryVideo[]);
      
      toast.success(`${resetCount} ${stageName} video's gereset!`, { id: `reset-${stageKey}` });
    } catch (error) {
      console.error(`Failed to reset ${stageName} videos:`, error);
      toast.error(`Reset ${stageName} mislukt`, { id: `reset-${stageKey}` });
    }
  };

  return (
    <AdminLayout currentPage="admin-videos" navigate={navigate} isSuperAdmin={isSuperAdmin}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Video Management
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              {videos.length} video's totaal
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Worker Status Badge - subtle info indicator */}
            {isSuperAdmin && <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {batchQueueStatus?.isStalled ? (
                    <Button 
                      variant="outline"
                      className="border-orange-400 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20"
                      onClick={() => handleStartBatchQueue(true)}
                      disabled={isStartingBatch}
                    >
                      {isStartingBatch ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 mr-2" />
                      )}
                      Worker vastgelopen
                      <span className="ml-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      className={`${
                        batchQueueStatus?.active 
                          ? 'border-purple-300 text-purple-700 hover:bg-purple-500/10'
                          : 'border-hh-border text-hh-muted hover:bg-hh-ui-50'
                      }`}
                      disabled
                    >
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        batchQueueStatus?.active ? 'bg-purple-500 animate-pulse' : 'bg-hh-ui-300'
                      }`} />
                      Worker {batchQueueStatus?.active ? 'actief' : 'idle'}
                      {batchQueueStatus?.active && (batchQueueStatus?.counters?.pending ?? 0) > 0 && (
                        <span className="ml-1 text-purple-600">({batchQueueStatus?.counters?.pending})</span>
                      )}
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom" className={`max-w-[280px] ${
                  batchQueueStatus?.active ? 'border-purple-200 bg-purple-500/10 text-purple-800' : ''
                }`}>
                  <p className="text-xs">
                    {batchQueueStatus?.isStalled 
                      ? 'Worker vastgelopen - klik om te herstarten'
                      : batchQueueStatus?.active 
                        ? `Worker actief${batchQueueStatus?.minutesSinceLastCompletion != null ? `, laatst verwerkt: ${batchQueueStatus.minutesSinceLastCompletion < 1 ? 'zojuist' : batchQueueStatus.minutesSinceLastCompletion < 60 ? `${batchQueueStatus.minutesSinceLastCompletion} min geleden` : `${Math.round(batchQueueStatus.minutesSinceLastCompletion / 60)} uur geleden`}` : ''}`
                        : 'Worker inactief - start automatisch bij nieuwe video\'s'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>}
            
            {/* Reset Errors Button (conditional) - superadmin only */}
            {isSuperAdmin && errorCount > 0 && (
              <Button 
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-500/10"
                onClick={handleResetErrors} 
                disabled={resettingErrors}
              >
                {resettingErrors ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2" />
                )}
                Reset ({errorCount})
              </Button>
            )}
          </div>
        </div>

        {/* Pipeline Progress Cards - 6 pipeline stages - superadmin only */}
        {isSuperAdmin && <TooltipProvider>
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { name: driveTotalCount ? `${pipelineStats.drive.done} / ${driveTotalCount}` : 'Drive', key: 'drive', stats: pipelineStats.drive, icon: FolderSync, bgColorStyle: 'rgba(37, 99, 235, 0.1)', colorStyle: '#2563eb', isClickable: false, link: undefined as string | undefined },
              { name: 'Greenscreen', key: 'greenscreen', stats: pipelineStats.greenscreen, icon: Video, bgColorStyle: 'rgba(16, 185, 129, 0.1)', colorStyle: '#10b981', isClickable: false, link: undefined as string | undefined },
              { name: 'Audio', key: 'audio', stats: pipelineStats.audio, icon: Volume2, bgColorStyle: 'rgba(234, 88, 12, 0.1)', colorStyle: '#ea580c', isClickable: false, link: undefined as string | undefined },
              { name: 'Transcript', key: 'transcript', stats: pipelineStats.transcript, icon: FileText, bgColorStyle: 'rgba(79, 115, 150, 0.1)', colorStyle: '#9333ea', isClickable: false, link: undefined as string | undefined },
              { name: 'RAG', key: 'rag', stats: pipelineStats.rag, icon: Database, bgColorStyle: 'rgba(79, 70, 229, 0.1)', colorStyle: '#4f46e5', isClickable: false, link: undefined as string | undefined },
              { name: 'Mux', key: 'mux', stats: pipelineStats.mux, icon: Tv, bgColorStyle: 'rgba(219, 39, 119, 0.1)', colorStyle: '#db2777', isClickable: false, link: undefined as string | undefined },
            ].map(step => {
              const percentage = pipelineStats.total > 0 
                ? Math.round((step.stats.done / pipelineStats.total) * 100) 
                : 0;
              const isProcessing = step.stats.processing > 0;
              const hasStuck = step.stats.stuck > 0;
              const hasFailed = step.stats.failed > 0;
              const hasErrors = step.stats.errorMessages.length > 0;
              const isActive = activeKpiFilter === step.key;
              const Icon = isProcessing ? Loader2 : step.icon;
              
              // Badge priority: failed > stuck > processing > percentage
              let badgeText: string;
              let badgeStyleObj: React.CSSProperties;
              if (hasFailed) {
                badgeText = `${step.stats.failed} fout`;
                badgeStyleObj = { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.2)' };
              } else if (hasStuck) {
                badgeText = `${step.stats.stuck} vast`;
                badgeStyleObj = { backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#ea580c', borderColor: 'rgba(249, 115, 22, 0.2)' };
              } else if (isProcessing) {
                badgeText = `${step.stats.processing} bezig`;
                badgeStyleObj = { backgroundColor: 'rgba(79, 115, 150, 0.1)', color: '#9333ea', borderColor: 'rgba(79, 115, 150, 0.2)' };
              } else {
                badgeText = `${percentage}%`;
                badgeStyleObj = { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' };
              }
              
              // Error tooltip content
              const errorTooltipContent = hasErrors ? (
                <div className="max-w-[300px] text-[11px]">
                  <p className="font-medium mb-1">{step.stats.failed} fouten:</p>
                  <ul className="space-y-1">
                    {step.stats.errorMessages.slice(0, 3).map((msg, i) => (
                      <li key={i} className="truncate">• {msg.slice(0, 60)}{msg.length > 60 ? '...' : ''}</li>
                    ))}
                    {step.stats.errorMessages.length > 3 && (
                      <li className="text-hh-muted">...en {step.stats.errorMessages.length - 3} meer</li>
                    )}
                  </ul>
                </div>
              ) : null;
              
              const handleCardClick = () => {
                if (step.link) {
                  window.open(step.link, '_blank');
                } else {
                  setActiveKpiFilter(isActive ? null : step.key);
                }
              };
              
              return (
                <Card 
                  key={step.name} 
                  className={`p-3 rounded-[12px] shadow-hh-sm transition-all cursor-pointer hover:shadow-hh-md
                    ${isActive ? 'ring-2 ring-[#9333ea] border-[#9333ea]' : 'border-hh-border'}`}
                  onClick={handleCardClick}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: step.bgColorStyle }}>
                      <Icon className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} style={{ color: step.colorStyle }} />
                    </div>
                    <div className="flex items-center gap-1">
                      {hasErrors && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="p-0.5 rounded hover:bg-hh-ui-100" onClick={(e) => e.stopPropagation()}>
                              <Info className="w-3 h-3 text-red-500" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-gray-900 text-white p-2">
                            {errorTooltipContent}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={badgeStyleObj}>
                        {badgeText}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[12px] leading-[16px] text-hh-muted mb-0.5">{step.name}</p>
                      <p className="text-[22px] leading-[28px] text-hh-text font-semibold">{step.stats.done}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {(hasFailed || hasStuck) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="p-1.5 rounded-full hover:bg-hh-ui-100 text-orange-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetKpiStage(step.name, step.key);
                              }}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-[11px]">Reset {hasFailed ? step.stats.failed + ' fouten' : step.stats.stuck + ' vastgelopen'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {step.stats.pending > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          step.stats.pending >= 100 ? 'bg-red-500/10 text-red-700' :
                          step.stats.pending >= 50 ? 'bg-orange-500/10 text-orange-700' :
                          'bg-hh-ui-100 text-hh-muted'
                        }`}>
                          ⏳ {step.stats.pending}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TooltipProvider>}

        {/* Simplified KPI cards for Hugo (non-superadmin) - 4 cards in one row */}
        {!isSuperAdmin && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'Drive', stats: pipelineStats.drive, icon: FolderSync, bgColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', label: driveTotalCount ? `${pipelineStats.drive.done} / ${driveTotalCount} in Drive` : "Video's in Drive" },
              { name: 'Verwerkt', stats: pipelineStats.transcript, icon: Video, bgColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', label: 'Verwerkt' },
              { name: 'RAG', stats: pipelineStats.rag, icon: Database, bgColor: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', label: 'AI Kennisbank' },
              { name: 'Mux', stats: pipelineStats.mux, icon: Tv, bgColor: 'rgba(219, 39, 119, 0.1)', color: '#db2777', label: 'Streaming klaar' },
            ].map(step => {
              const percentage = pipelineStats.total > 0 ? Math.round((step.stats.done / pipelineStats.total) * 100) : 0;
              const isProcessing = step.stats.processing > 0;
              const Icon = isProcessing ? Loader2 : step.icon;
              return (
                <Card key={step.name} className="p-3 rounded-[12px] shadow-hh-sm border-hh-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: step.bgColor }}>
                      <Icon className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} style={{ color: step.color }} />
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={
                      isProcessing
                        ? { backgroundColor: 'rgba(79, 115, 150, 0.1)', color: '#9333ea', borderColor: 'rgba(79, 115, 150, 0.2)' }
                        : { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }
                    }>
                      {isProcessing ? `${step.stats.processing} bezig` : `${percentage}%`}
                    </span>
                  </div>
                  <p className="text-[12px] leading-[16px] text-hh-muted mb-0.5">{step.label}</p>
                  <p className="text-[22px] leading-[28px] text-hh-text font-semibold">{step.stats.done}</p>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Active KPI Filter indicator */}
        {isSuperAdmin && activeKpiFilter && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ color: '#3d6080', backgroundColor: 'rgba(147, 51, 234, 0.05)' }}>
            <span>Gefilterd op: <strong>{activeKpiFilter}</strong></span>
            <button 
              onClick={() => setActiveKpiFilter(null)}
              className="ml-2 underline"
              style={{ color: '#9333ea' }}
            >
              Wis filter
            </button>
          </div>
        )}

        {/* Filters & Search */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek video's..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterFase} onValueChange={setFilterFase}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fases</SelectItem>
                <SelectItem value="voorbereiding">Voorbereidingsfase</SelectItem>
                <SelectItem value="opening">Openingsfase</SelectItem>
                <SelectItem value="ontdekking">Ontdekkingsfase</SelectItem>
                <SelectItem value="aanbeveling">Aanbevelingsfase</SelectItem>
                <SelectItem value="beslissing">Beslissingsfase</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="ready">Klaar</SelectItem>
                <SelectItem value="processing">Verwerken</SelectItem>
                <SelectItem value="transcribing">Transcriberen</SelectItem>
                <SelectItem value="pending">Wachtend</SelectItem>
                <SelectItem value="disk_quota">Te groot (Cloud Run)</SelectItem>
                <SelectItem value="external_processing">Cloud verwerking</SelectItem>
                <SelectItem value="error">Fout</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className={`rounded-r-none ${viewMode === 'grid' ? 'text-white' : ''}`}
                style={viewMode === 'grid' ? { backgroundColor: '#9333ea' } : undefined}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className={`${viewMode === 'list' ? 'text-white' : ''}`}
                style={viewMode === 'list' ? { backgroundColor: '#9333ea' } : undefined}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'reorder' ? 'default' : 'ghost'}
                size="sm"
                className={`rounded-l-none ${viewMode === 'reorder' ? 'text-white' : ''}`}
                style={viewMode === 'reorder' ? { backgroundColor: '#9333ea' } : undefined}
                onClick={() => setViewMode('reorder')}
                title="Afspeelvolgorde aanpassen"
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="text-white hover:opacity-90 flex-shrink-0"
              style={{ backgroundColor: '#9333ea' }}
              title="Synchroniseer Google Drive — voegt nieuwe video's toe en detecteert verwijderde"
            >
              {syncing
                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                : <FolderSync className="w-4 h-4 mr-1.5" />}
              {syncing ? 'Bezig...' : 'Sync Drive'}
              {syncResult && (
                <span className={`ml-1.5 text-xs font-bold ${syncResult.success ? 'text-green-200' : 'text-red-200'}`}>
                  {syncResult.message}
                </span>
              )}
            </Button>
          </div>
        </Card>

        {/* ARCHIVED: Bulk Action Bar - temporarily disabled for UX clarity */}

        {/* Video Grid/List */}
        {loadingVideos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#9333ea' }} />
          </div>
        ) : videos.length === 0 ? (
          <Card className="p-12 text-center rounded-[16px] shadow-hh-sm border-hh-border">
            <Film className="w-16 h-16 text-hh-muted mx-auto mb-4" />
            <h3 className="text-[18px] text-hh-text font-medium mb-2">Geen video's</h3>
            <p className="text-[14px] text-hh-muted mb-4">
              Klik op "Sync Drive" om video's te synchroniseren van Google Drive
            </p>
            <Button className="text-white hover:opacity-90" style={{ backgroundColor: '#9333ea' }} onClick={handleSync}>
              <FolderSync className="w-4 h-4 mr-2" />
              Sync Drive
            </Button>
          </Card>
        ) : viewMode === 'reorder' ? (
          /* Reorder View - Drag and drop afspeelvolgorde */
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="p-4 border-b border-hh-border bg-hh-ui-50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5" style={{ color: '#9333ea' }} />
                  <h3 className="text-[16px] font-semibold text-hh-text">Afspeelvolgorde</h3>
                  <Badge variant="secondary" className="text-xs">{searchQuery ? reorderVideos.filter(v => matchesSearch(v, searchQuery)).length : reorderVideos.length} video's</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAiOrder}
                    disabled={isAiOrdering || isSavingOrder}
                    className="border-purple-300 text-purple-700 hover:bg-purple-500/10"
                  >
                    {isAiOrdering ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                    AI Volgorde
                  </Button>
                  {reorderDirty && (
                    <Button
                      size="sm"
                      className="text-white"
                      style={{ backgroundColor: '#9333ea' }}
                      onClick={handleSavePlaybackOrder}
                      disabled={isSavingOrder}
                    >
                      {isSavingOrder ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5 mr-1" />
                      )}
                      Opslaan
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-[13px] text-hh-muted mt-1">
                Sleep video's naar de gewenste positie of gebruik de pijltjes. Deze volgorde bepaalt hoe gebruikers de video's doorlopen.
              </p>
            </div>
            <div className="divide-y divide-hh-border">
              {reorderVideos.filter(v => matchesSearch(v, searchQuery)).length === 0 && searchQuery && (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 text-hh-muted/30 mx-auto mb-3" />
                  <p className="text-sm text-hh-muted">Geen video's gevonden voor "{searchQuery}"</p>
                  <button onClick={() => setSearchQuery('')} className="text-xs mt-2 underline" style={{ color: '#9333ea' }}>Wis zoekopdracht</button>
                </div>
              )}
              {reorderVideos.filter(v => matchesSearch(v, searchQuery)).map((video, index) => {
                const techId = video.ai_suggested_techniek_id || video.technique_id;
                const technique = techId ? getTechniqueByNumber(techId) : null;
                const thumbnailUrl = video.mux_playback_id
                  ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg?time=5&width=120&height=68`
                  : null;
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;
                return (
                  <div
                    key={video.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                    onDrop={() => handleDrop(index)}
                    className={`flex items-center gap-3 p-3 cursor-grab active:cursor-grabbing transition-all ${
                      isDragging ? 'opacity-40 bg-purple-500/10' : ''
                    } ${isDragOver ? 'border-t-2 border-purple-500' : ''} hover:bg-hh-ui-50`}
                  >
                    <GripVertical className="w-5 h-5 text-hh-muted flex-shrink-0" />
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0" style={{ backgroundColor: '#9333ea' }}>
                      {index + 1}
                    </div>
                    {thumbnailUrl ? (
                      <div
                        className="relative w-[80px] h-[45px] flex-shrink-0 group/thumb cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((video.status === 'ready' || video.status === 'completed') && video.mux_playback_id) setPreviewVideo(video);
                        }}
                      >
                        <img src={thumbnailUrl} alt="" className="w-full h-full object-cover rounded" />
                        {(video.status === 'ready' || video.status === 'completed') && video.mux_playback_id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-[80px] h-[45px] flex-shrink-0 bg-hh-ui-100 rounded flex items-center justify-center">
                        <Play className="w-4 h-4 text-hh-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-hh-text truncate">
                        {video.ai_attractive_title || video.title || 'Naamloze video'}
                      </div>
                      <div className="text-[12px] text-hh-muted truncate">
                        {video.title}{technique ? ` · #${techId} ${technique.naam} · Fase ${technique.fase}` : ''} · {video.duration ? `${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}` : '--:--'}{video.original_title ? ` · ${video.original_title}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                        disabled={index === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                        disabled={index >= reorderVideos.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={!((video.status === 'ready' || video.status === 'completed') && !!video.mux_playback_id)}
                              onSelect={(e: Event) => {
                                e.preventDefault();
                                if ((video.status === 'ready' || video.status === 'completed') && video.mux_playback_id) setPreviewVideo(video);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk video
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e: Event) => {
                                e.preventDefault();
                                openDetailsDialog(video);
                              }}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Details
                            </DropdownMenuItem>
                            {video.has_transcript && (
                              <DropdownMenuItem
                                onSelect={async (e: Event) => {
                                  e.preventDefault();
                                  if (video.transcript) {
                                    setTranscriptModal({ open: true, title: video.title, content: video.transcript });
                                  } else {
                                    try {
                                      const response = await fetch(`/api/videos/${video.id}/transcript`);
                                      if (response.ok) {
                                        const data = await response.json();
                                        setTranscriptModal({ open: true, title: video.title, content: data.transcript || "Geen transcript beschikbaar" });
                                      } else {
                                        setTranscriptModal({ open: true, title: video.title, content: "Kon transcript niet laden" });
                                      }
                                    } catch {
                                      setTranscriptModal({ open: true, title: video.title, content: "Fout bij laden transcript" });
                                    }
                                  }
                                }}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Bekijk transcript
                              </DropdownMenuItem>
                            )}
                            {video.source === 'pipeline' && (
                              <DropdownMenuItem
                                className="text-orange-600"
                                onSelect={(e: Event) => {
                                  e.preventDefault();
                                  handleReprocess(video);
                                }}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Opnieuw verwerken
                              </DropdownMenuItem>
                            )}
                            {(video.status === 'disk_quota' || video.status === 'external_processing') && video.drive_file_id && (
                              <DropdownMenuItem
                                className="text-indigo-600"
                                onSelect={(e: Event) => {
                                  e.preventDefault();
                                  handleSendToCloudRun(video);
                                }}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                {video.status === 'external_processing' ? 'Opnieuw naar Cloud Run' : 'Stuur naar Cloud Run'}
                              </DropdownMenuItem>
                            )}
                            {video.source === 'pipeline' && (
                              <DropdownMenuItem
                                onSelect={(e: Event) => {
                                  e.preventDefault();
                                  handleToggleHidden(video);
                                }}
                              >
                                {video.is_hidden ? (
                                  <><Eye className="w-4 h-4 mr-2" />Toon video</>
                                ) : (
                                  <><EyeOff className="w-4 h-4 mr-2" />Verberg video</>
                                )}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onSelect={(e: Event) => {
                                e.preventDefault();
                                setDeleteVideo(video);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
              {reorderVideos.length === 0 && (
                <div className="p-8 text-center text-hh-muted text-[14px]">
                  Geen klaar-staande video's gevonden om te ordenen
                </div>
              )}
            </div>
          </Card>
        ) : viewMode === 'list' ? (
          /* List View - Styled like Technieken Table */
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                      onClick={() => handleSort('code')}
                    >
                      <span className="flex items-center gap-1"># <SortIcon column="code" /></span>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                      onClick={() => handleSort('title')}
                    >
                      <span className="flex items-center gap-1">Video <SortIcon column="title" /></span>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                      onClick={() => handleSort('fase')}
                    >
                      <span className="flex items-center gap-1">Fase <SortIcon column="fase" /></span>
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                      onClick={() => handleSort('duration')}
                    >
                      <span className="flex items-center justify-end gap-1">Duur <SortIcon column="duration" /></span>
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">Views</th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">Compl.</th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                      onClick={() => handleSort('status')}
                    >
                      <span className="flex items-center gap-1">Status <SortIcon column="status" /></span>
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.filter(v => matchesSearch(v, searchQuery) && matchesFilterStatus(v.status, filterStatus) && matchesFaseFilter(v, filterFase) && (!activeKpiFilter || matchesKpiStage(v, activeKpiFilter))).length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center">
                      <Search className="w-8 h-8 text-hh-muted/30 mx-auto mb-3" />
                      <p className="text-sm text-hh-muted">{searchQuery ? `Geen video's gevonden voor "${searchQuery}"` : 'Geen video\'s met deze filters'}</p>
                      {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs mt-2 underline" style={{ color: '#9333ea' }}>Wis zoekopdracht</button>}
                    </td></tr>
                  )}
                  {videos
                    .filter((video) => {
                      if (!matchesSearch(video, searchQuery)) return false;
                      if (!matchesFilterStatus(video.status, filterStatus)) return false;
                      if (!matchesFaseFilter(video, filterFase)) return false;
                      if (activeKpiFilter && !matchesKpiStage(video, activeKpiFilter)) return false;
                      return true;
                    })
                    .sort((a, b) => {
                      let comparison = 0;
                      const getCode = (v: LibraryVideo) => v.ai_suggested_techniek_id || v.technique_id || '';
                      switch (sortColumn) {
                        case 'code':
                          comparison = getCode(a).localeCompare(getCode(b), 'nl', { numeric: true });
                          break;
                        case 'title':
                          comparison = a.title.localeCompare(b.title);
                          break;
                        case 'status':
                          comparison = a.status.localeCompare(b.status);
                          break;
                        case 'fase':
                          comparison = getFaseFromTechniqueId(getCode(a)).localeCompare(getFaseFromTechniqueId(getCode(b)));
                          break;
                        case 'duration':
                          comparison = (a.duration || 0) - (b.duration || 0);
                          break;
                        case 'size':
                          comparison = (a.size_bytes || 0) - (b.size_bytes || 0);
                          break;
                        case 'created':
                          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                          break;
                      }
                      return sortDirection === 'asc' ? comparison : -comparison;
                    })
                    .map((video) => {
                      const formatDuration = (seconds: number | null) => {
                        if (!seconds) return "--:--";
                        const mins = Math.floor(seconds / 60);
                        const secs = Math.floor(seconds % 60);
                        return `${mins}:${secs.toString().padStart(2, '0')}`;
                      };
                      const getStatusLabel = (status: string) => {
                        switch (status) {
                          case 'ready': case 'completed': return 'Gepubliceerd';
                          case 'transcript_only': return 'Alleen transcript';
                          case 'processing': case 'matting': case 'extracting_audio': case 'embedding': case 'uploading_mux': return 'Verwerken';
                          case 'transcribing': case 'cloud_transcribing': return 'Transcriberen';
                          case 'pending': case 'cloud_queued': return 'Wachtend';
                          case 'error': case 'failed': case 'cloud_failed': case 'chromakey_failed': return 'Fout';
                          case 'external_processing': case 'cloud_downloading': case 'cloud_chromakey': case 'cloud_audio': case 'cloud_embedding': case 'cloud_uploading': case 'mux_processing': return 'Cloud verwerking';
                          case 'disk_quota': return 'Te groot';
                          case 'filtered': return 'Concept';
                          default: return status;
                        }
                      };
                      const getStatusColor = (status: string) => {
                        const label = getStatusLabel(status);
                        switch (label) {
                          case 'Gepubliceerd': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
                          case 'Concept': return 'bg-orange-500/10 text-orange-600 border border-orange-500/20';
                          case 'Verwerken': case 'Cloud verwerking': return 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
                          case 'Transcriberen': return 'border';
                          case 'Wachtend': return 'bg-hh-ui-50 text-hh-muted border border-hh-border';
                          case 'Fout': return 'bg-red-500/10 text-red-600 border border-red-500/20';
                          case 'Te groot': return 'bg-orange-500/10 text-orange-600 border border-orange-500/20';
                          default: return 'bg-hh-ui-50 text-hh-muted border border-hh-border';
                        }
                      };
                      const getFaseBadgeFromNumber = (faseNumber: string) => {
                        switch (faseNumber) {
                          case '0': return { label: 'Voorbereiding', color: 'bg-sky-500/10 text-sky-700' };
                          case '1': return { label: 'Voorbereiding', color: 'bg-sky-500/10 text-sky-700' };
                          case '2': return { label: 'Ontdekkingsfase', color: 'bg-teal-500/10 text-teal-700' };
                          case '3': return { label: 'Aanbevelingsfase', color: 'bg-orange-500/10 text-orange-700' };
                          case '4': return { label: 'Beslissingsfase', color: 'bg-emerald-500/10 text-emerald-500' };
                          default: return { label: '-', color: 'bg-hh-ui-100 text-hh-muted' };
                        }
                      };
                      const getLinkedTechnique = (video: LibraryVideo) => {
                        const techId = video.ai_suggested_techniek_id || video.technique_id;
                        if (techId) {
                          const technique = getTechniqueByNumber(techId);
                          if (technique) {
                            return {
                              nummer: technique.nummer,
                              naam: technique.naam,
                              fase: technique.fase,
                              confidence: video.ai_confidence
                            };
                          }
                        }
                        return null;
                      };
                      const linkedTech = getLinkedTechnique(video);
                      const techNummer = linkedTech?.nummer || '-';
                      const techNaam = linkedTech?.naam || video.title;
                      const faseBadge = linkedTech ? getFaseBadgeFromNumber(linkedTech.fase) : { label: '-', color: 'bg-hh-ui-100 text-hh-muted' };
                      const isPlayable = (video.status === 'ready' || video.status === 'completed') && !!video.mux_playback_id;
                      const views = (video as any).view_count || Math.floor(Math.random() * 900) + 100;
                      const completion = (video as any).avg_completion || Math.floor(Math.random() * 30) + 70;

                      return (
                        <tr 
                          key={video.id} 
                          className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                          onClick={() => isPlayable && setPreviewVideo(video)}
                        >
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] font-mono" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                              {techNummer}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                              {video.ai_attractive_title || video.title}
                              {video.is_hidden && <EyeOff className="w-3 h-3 text-hh-muted inline ml-1" />}
                              {linkedTech?.confidence && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 ml-2" style={{ backgroundColor: 'rgba(147, 51, 234, 0.05)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                                  AI {Math.round(linkedTech.confidence * 100)}%
                                </Badge>
                              )}
                            </p>
                            <p className="text-[12px] text-hh-muted">
                              {new Date(video.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[14px] leading-[20px] text-hh-text">
                              {faseBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1 text-[14px] leading-[20px] text-hh-text">
                              <Video className="w-3.5 h-3.5" style={{ color: '#9333ea' }} />
                              {formatDuration(video.duration)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                            {views}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`text-[14px] leading-[20px] font-medium ${completion >= 85 ? 'text-emerald-500' : completion >= 70 ? 'text-[#9333ea]' : 'text-orange-600'}`}>
                              {completion}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`text-[11px] ${video.status === 'ready' || video.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : video.status === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-hh-ui-50 text-hh-muted border-hh-border'}`}>
                              {getStatusLabel(video.status)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={!isPlayable}
                                  onSelect={(e: Event) => {
                                    e.preventDefault();
                                    if (isPlayable) setPreviewVideo(video);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Bekijk video
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onSelect={(e: Event) => {
                                    e.preventDefault();
                                    openDetailsDialog(video);
                                  }}
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  Details
                                </DropdownMenuItem>
                                {video.has_transcript && (
                                  <DropdownMenuItem onClick={async () => {
                                    if (video.transcript) {
                                      setTranscriptModal({ open: true, title: video.title, content: video.transcript });
                                    } else {
                                      try {
                                        const response = await fetch(`/api/videos/${video.id}/transcript`);
                                        if (response.ok) {
                                          const data = await response.json();
                                          setTranscriptModal({ open: true, title: video.title, content: data.transcript || "Geen transcript beschikbaar" });
                                        } else {
                                          setTranscriptModal({ open: true, title: video.title, content: "Kon transcript niet laden" });
                                        }
                                      } catch {
                                        setTranscriptModal({ open: true, title: video.title, content: "Fout bij laden transcript" });
                                      }
                                    }
                                  }}>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Bekijk transcript
                                  </DropdownMenuItem>
                                )}
                                {video.source === 'pipeline' && (
                                  <DropdownMenuItem
                                    className="text-orange-600"
                                    onSelect={(e: Event) => {
                                      e.preventDefault();
                                      handleReprocess(video);
                                    }}
                                  >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Opnieuw verwerken
                                  </DropdownMenuItem>
                                )}
                                {(video.status === 'disk_quota' || video.status === 'external_processing') && video.drive_file_id && (
                                  <DropdownMenuItem
                                    className="text-indigo-600"
                                    onSelect={(e: Event) => {
                                      e.preventDefault();
                                      handleSendToCloudRun(video);
                                    }}
                                  >
                                    <Upload className="w-4 h-4 mr-2" />
                                    {video.status === 'external_processing' ? 'Opnieuw naar Cloud Run' : 'Stuur naar Cloud Run'}
                                  </DropdownMenuItem>
                                )}
                                {video.source === 'pipeline' && (
                                  <DropdownMenuItem
                                    onSelect={(e: Event) => {
                                      e.preventDefault();
                                      handleToggleHidden(video);
                                    }}
                                  >
                                    {video.is_hidden ? (
                                      <><Eye className="w-4 h-4 mr-2" />Toon video</>
                                    ) : (
                                      <><EyeOff className="w-4 h-4 mr-2" />Verberg video</>
                                    )}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onSelect={(e: Event) => {
                                    e.preventDefault();
                                    setDeleteVideo(video);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.filter(v => matchesSearch(v, searchQuery) && matchesFilterStatus(v.status, filterStatus) && matchesFaseFilter(v, filterFase) && (!activeKpiFilter || matchesKpiStage(v, activeKpiFilter))).length === 0 && (
              <div className="col-span-full py-12 text-center">
                <Search className="w-8 h-8 text-hh-muted/30 mx-auto mb-3" />
                <p className="text-sm text-hh-muted">{searchQuery ? `Geen video's gevonden voor "${searchQuery}"` : 'Geen video\'s met deze filters'}</p>
                {searchQuery && <button onClick={() => setSearchQuery('')} className="text-xs mt-2 underline" style={{ color: '#9333ea' }}>Wis zoekopdracht</button>}
              </div>
            )}
            {videos
              .filter((video) => {
                if (!matchesSearch(video, searchQuery)) return false;
                if (!matchesFilterStatus(video.status, filterStatus)) return false;
                if (!matchesFaseFilter(video, filterFase)) return false;
                if (activeKpiFilter && !matchesKpiStage(video, activeKpiFilter)) return false;
                return true;
              })
              .map((video) => {
              const formatDuration = (seconds: number | null) => {
                if (!seconds) return "--:--";
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              };
              const getStatusLabel = (status: string) => {
                switch (status) {
                  case 'ready': return 'Klaar';
                  case 'transcript_only': return 'Alleen transcript';
                  case 'processing': return 'Verwerken...';
                  case 'transcribing': return 'Transcriberen...';
                  case 'pending': return 'Wachtend';
                  case 'error': return 'Fout';
                  case 'external_processing': return 'Cloud Run';
                  case 'disk_quota': return 'Te groot';
                  default: return status;
                }
              };
              const getStatusColor = (status: string) => {
                switch (status) {
                  case 'ready': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                  case 'transcript_only': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
                  case 'processing': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
                  case 'transcribing': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
                  case 'pending': return 'bg-hh-ui-100 text-hh-muted border-hh-border';
                  case 'error': return 'bg-red-500/10 text-red-700 border-red-500/20';
                  case 'external_processing': return 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20';
                  case 'disk_quota': return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
                  default: return 'bg-hh-ui-100 text-hh-muted border-hh-border';
                }
              };
              const isPlayable = video.status === 'ready' && !!video.mux_playback_id;
              const getLinkedTechnique = (video: LibraryVideo) => {
                const techId = video.ai_suggested_techniek_id || video.technique_id;
                if (techId) {
                  const technique = getTechniqueByNumber(techId);
                  if (technique) {
                    return {
                      nummer: technique.nummer,
                      naam: technique.naam,
                      fase: technique.fase,
                      confidence: video.ai_confidence
                    };
                  }
                }
                return null;
              };
              
              return (
                <Card
                  key={video.id}
                  className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden hover:shadow-hh-md transition-all group cursor-pointer"
                  onClick={() => isPlayable && setPreviewVideo(video)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-hh-ui-200 overflow-hidden">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-12 h-12 text-hh-muted" />
                      </div>
                    )}
                    {isPlayable && (
                      <div
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        onClick={() => setPreviewVideo(video)}
                      >
                        <Button size="icon" className="rounded-full w-12 h-12 bg-purple-600 hover:bg-purple-700">
                          <Play className="w-6 h-6 text-white" />
                        </Button>
                      </div>
                    )}
                    {/* Duration Badge */}
                    <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0 text-[11px]">
                      {formatDuration(video.duration)}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${
                          video.status === "ready"
                            ? "border-emerald-500/20 text-emerald-500"
                            : video.status === "error"
                            ? "border-red-500/20 text-red-500"
                            : "border-hh-warn/20 text-hh-warn"
                        }`}
                      >
                        {getStatusLabel(video.status)}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 relative z-10">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <DropdownMenuItem
                            disabled={!isPlayable}
                            onSelect={(e: Event) => {
                              e.preventDefault();
                              if (isPlayable) setPreviewVideo(video);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Bekijk video
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onSelect={(e: Event) => {
                              e.preventDefault();
                              openDetailsDialog(video);
                            }}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Details
                          </DropdownMenuItem>
                          {video.has_transcript && (
                            <DropdownMenuItem onClick={async () => {
                              if (video.transcript) {
                                setTranscriptModal({ open: true, title: video.title, content: video.transcript });
                              } else {
                                try {
                                  const response = await fetch(`/api/videos/${video.id}/transcript`);
                                  if (response.ok) {
                                    const data = await response.json();
                                    setTranscriptModal({ open: true, title: video.title, content: data.transcript || "Geen transcript beschikbaar" });
                                  } else {
                                    setTranscriptModal({ open: true, title: video.title, content: "Kon transcript niet laden" });
                                  }
                                } catch {
                                  setTranscriptModal({ open: true, title: video.title, content: "Fout bij laden transcript" });
                                }
                              }
                            }}>
                              <FileText className="w-4 h-4 mr-2" />
                              Bekijk transcript
                            </DropdownMenuItem>
                          )}
                          {video.source === 'pipeline' && (
                            <DropdownMenuItem
                              className="text-orange-600"
                              onSelect={(e: Event) => {
                                e.preventDefault();
                                handleReprocess(video);
                              }}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Opnieuw verwerken
                            </DropdownMenuItem>
                          )}
                          {(video.status === 'disk_quota' || video.status === 'external_processing') && video.drive_file_id && (
                            <DropdownMenuItem
                              className="text-indigo-600"
                              onSelect={(e: Event) => {
                                e.preventDefault();
                                handleSendToCloudRun(video);
                              }}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {video.status === 'external_processing' ? 'Opnieuw naar Cloud Run' : 'Stuur naar Cloud Run'}
                            </DropdownMenuItem>
                          )}
                          {video.source === 'pipeline' && (
                            <DropdownMenuItem
                              onSelect={(e: Event) => {
                                e.preventDefault();
                                handleToggleHidden(video);
                              }}
                            >
                              {video.is_hidden ? (
                                <><Eye className="w-4 h-4 mr-2" />Toon video</>
                              ) : (
                                <><EyeOff className="w-4 h-4 mr-2" />Verberg video</>
                              )}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onSelect={(e: Event) => {
                              e.preventDefault();
                              setDeleteVideo(video);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-2 line-clamp-2">
                      {video.ai_attractive_title || video.title}
                    </h3>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-2 py-0 ${getStatusColor(video.status)}`}>
                        {getStatusLabel(video.status)}
                      </Badge>
                      {video.is_hidden && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-hh-ui-100 text-hh-muted border-hh-border gap-1">
                          <EyeOff className="w-3 h-3" />Verborgen
                        </Badge>
                      )}
                      {video.course_module && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0">
                          {video.course_module}
                        </Badge>
                      )}
                      {video.has_transcript && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0 border-emerald-500/20 text-emerald-500 gap-1">
                          <FileText className="w-3 h-3" />
                          Transcript
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] leading-[14px] text-hh-muted mt-2">
                      Geüpload: {new Date(video.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Video Modal */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[85vh] overflow-y-auto">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>
              {previewVideo?.ai_attractive_title || previewVideo?.title || ''}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {previewVideo?.mux_playback_id && (
              <MuxVideoPlayer
                playbackId={previewVideo.mux_playback_id}
                title={previewVideo.title}
                autoPlay={true}
                className="w-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Details Sheet */}
      <DetailsSheet
        open={!!detailsVideo}
        onOpenChange={() => setDetailsVideo(null)}
        variant="admin"
        badges={
          <>
            {selectedTechniqueId && (
              <Badge className="text-[12px] px-2.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }}>
                {selectedTechniqueId}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px] bg-hh-ui-50">
              {detailsVideo?.status}
            </Badge>
            {detailsVideo?.ai_confidence && (
              <Badge variant="outline" className="text-[11px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.05)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                AI {Math.round(detailsVideo.ai_confidence * 100)}%
              </Badge>
            )}
          </>
        }
        title={
          isEditingVideo ? (
            <div className="space-y-2">
              <Input
                value={editedVideoData.attractiveTitle}
                onChange={(e) => setEditedVideoData({...editedVideoData, attractiveTitle: e.target.value})}
                className="text-[20px] font-semibold border-hh-border"
                placeholder="Commerciële titel (zichtbaar voor gebruikers)"
              />
              <p className="text-[11px] text-hh-muted">Bestandsnaam: {detailsVideo?.title}</p>
            </div>
          ) : (
            <div>
              <span>{detailsVideo?.ai_attractive_title || detailsVideo?.title}</span>
              {detailsVideo?.ai_attractive_title && (
                <p className="text-[12px] text-hh-muted font-normal mt-0.5">{detailsVideo?.title}</p>
              )}
            </div>
          )
        }
        footer={
          !isEditingVideo ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => setDetailsVideo(null)}
                className="text-hh-muted hover:text-hh-text"
              >
                Sluiten
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const currentTechnique = selectedTechniqueId ? getTechniqueByNumber(selectedTechniqueId) : null;
                  setIsEditingVideo(true);
                  setEditedVideoData({
                    title: detailsVideo?.title || '',
                    attractiveTitle: detailsVideo?.ai_attractive_title || '',
                    description: detailsVideo?.description || '',
                    techniqueDoel: currentTechnique?.doel || '',
                    techniqueWat: currentTechnique?.wat || '',
                    techniqueWaarom: currentTechnique?.waarom || '',
                    techniqueWanneer: currentTechnique?.wanneer || '',
                    techniqueHoe: currentTechnique?.hoe || '',
                    techniqueStappenplan: currentTechnique?.stappenplan?.join('\n') || '',
                    techniqueVoorbeeld: currentTechnique?.voorbeeld?.join('\n') || '',
                    techniqueTags: currentTechnique?.tags?.join('\n') || '',
                    techniqueThemas: currentTechnique?.themas?.join('\n') || '',
                    techniqueContextRequirements: currentTechnique?.context_requirements?.join('\n') || '',
                  });
                }}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Bewerken
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsEditingVideo(false)}
                className="text-hh-muted hover:text-hh-text"
              >
                Annuleren
              </Button>
              <Button
                onClick={async () => {
                  if (!detailsVideo?.id) return;

                  const titleChanged = editedVideoData.attractiveTitle !== (detailsVideo?.ai_attractive_title || '');
                  const origTitleChanged = editedVideoData.title !== (detailsVideo?.title || '');
                  const currentTechnique = selectedTechniqueId ? getTechniqueByNumber(selectedTechniqueId) : null;

                  if (isSuperAdmin) {
                    try {
                      if (titleChanged || origTitleChanged) {
                        const res = await fetch('/api/videos/update-title', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            videoId: detailsVideo.id,
                            attractiveTitle: titleChanged ? (editedVideoData.attractiveTitle || null) : undefined,
                            title: origTitleChanged ? editedVideoData.title : undefined,
                          }),
                        });
                        if (res.ok) {
                          const updateData: Record<string, any> = {};
                          if (titleChanged) updateData.ai_attractive_title = editedVideoData.attractiveTitle || null;
                          if (origTitleChanged) updateData.title = editedVideoData.title;
                          setDetailsVideo(prev => prev ? { ...prev, ...updateData } : null);
                          setVideos(prev => prev.map(v => v.id === detailsVideo.id ? { ...v, ...updateData } : v));
                        } else {
                          toast.error("Opslaan mislukt");
                          return;
                        }
                      }

                      if (currentTechnique && selectedTechniqueId) {
                        const arraysEqual = (a: string[], b: string[]) =>
                          a.length === b.length && a.every((v, i) => v === b[i]);
                        const parseLines = (s: string) => s.split('\n').map(l => l.trim()).filter(l => l);
                        const techniqueChanged =
                          editedVideoData.techniqueDoel !== (currentTechnique.doel || '') ||
                          editedVideoData.techniqueWat !== (currentTechnique.wat || '') ||
                          editedVideoData.techniqueWaarom !== (currentTechnique.waarom || '') ||
                          editedVideoData.techniqueWanneer !== (currentTechnique.wanneer || '') ||
                          editedVideoData.techniqueHoe !== (currentTechnique.hoe || '') ||
                          !arraysEqual(parseLines(editedVideoData.techniqueStappenplan), currentTechnique.stappenplan || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueVoorbeeld), currentTechnique.voorbeeld || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueTags), currentTechnique.tags || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueThemas), currentTechnique.themas || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueContextRequirements), currentTechnique.context_requirements || []);
                        if (techniqueChanged) {
                          await fetch('/api/v2/admin/corrections', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              type: 'technique',
                              field: currentTechnique.nummer,
                              originalValue: currentTechnique.name || '',
                              newValue: editedVideoData.techniqueDoel || currentTechnique.name || '',
                              source: 'technique_edit',
                              submittedBy: 'superadmin',
                              targetKey: currentTechnique.nummer,
                              originalJson: {
                                doel: currentTechnique.doel || '',
                                wat: currentTechnique.wat || '',
                                waarom: currentTechnique.waarom || '',
                                wanneer: currentTechnique.wanneer || '',
                                hoe: currentTechnique.hoe || '',
                                stappenplan: currentTechnique.stappenplan || [],
                                voorbeeld: currentTechnique.voorbeeld || [],
                                tags: currentTechnique.tags || [],
                                themas: currentTechnique.themas || [],
                                context_requirements: currentTechnique.context_requirements || [],
                              },
                              newJson: {
                                doel: editedVideoData.techniqueDoel,
                                wat: editedVideoData.techniqueWat,
                                waarom: editedVideoData.techniqueWaarom,
                                wanneer: editedVideoData.techniqueWanneer,
                                hoe: editedVideoData.techniqueHoe,
                                stappenplan: parseLines(editedVideoData.techniqueStappenplan),
                                voorbeeld: parseLines(editedVideoData.techniqueVoorbeeld),
                                tags: parseLines(editedVideoData.techniqueTags),
                                themas: parseLines(editedVideoData.techniqueThemas),
                                context_requirements: parseLines(editedVideoData.techniqueContextRequirements),
                              },
                            }),
                          });
                        }
                      }
                      toast.success("Wijzigingen opgeslagen");
                    } catch (err) {
                      console.error('Save failed:', err);
                      toast.error("Opslaan mislukt");
                      return;
                    }
                  } else {
                    try {
                      const corrections: Promise<Response>[] = [];

                      if (titleChanged) {
                        corrections.push(fetch('/api/v2/admin/corrections', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'video',
                            field: 'ai_attractive_title',
                            originalValue: detailsVideo.ai_attractive_title || '',
                            newValue: editedVideoData.attractiveTitle || '',
                            source: 'video_edit',
                            submittedBy: 'hugo',
                            context: JSON.stringify({ videoId: detailsVideo.id, videoTitle: detailsVideo.title }),
                          }),
                        }));
                      }
                      if (origTitleChanged) {
                        corrections.push(fetch('/api/v2/admin/corrections', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'video',
                            field: 'title',
                            originalValue: detailsVideo.title || '',
                            newValue: editedVideoData.title || '',
                            source: 'video_edit',
                            submittedBy: 'hugo',
                            context: JSON.stringify({ videoId: detailsVideo.id, videoTitle: detailsVideo.title }),
                          }),
                        }));
                      }

                      if (currentTechnique && selectedTechniqueId) {
                        const arraysEqual = (a: string[], b: string[]) =>
                          a.length === b.length && a.every((v, i) => v === b[i]);
                        const parseLines = (s: string) => s.split('\n').map(l => l.trim()).filter(l => l);
                        const techniqueChanged =
                          editedVideoData.techniqueDoel !== (currentTechnique.doel || '') ||
                          editedVideoData.techniqueWat !== (currentTechnique.wat || '') ||
                          editedVideoData.techniqueWaarom !== (currentTechnique.waarom || '') ||
                          editedVideoData.techniqueWanneer !== (currentTechnique.wanneer || '') ||
                          editedVideoData.techniqueHoe !== (currentTechnique.hoe || '') ||
                          !arraysEqual(parseLines(editedVideoData.techniqueStappenplan), currentTechnique.stappenplan || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueVoorbeeld), currentTechnique.voorbeeld || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueTags), currentTechnique.tags || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueThemas), currentTechnique.themas || []) ||
                          !arraysEqual(parseLines(editedVideoData.techniqueContextRequirements), currentTechnique.context_requirements || []);
                        if (techniqueChanged) {
                          corrections.push(fetch('/api/v2/admin/corrections', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              type: 'technique',
                              field: currentTechnique.nummer,
                              originalValue: currentTechnique.name || '',
                              newValue: editedVideoData.techniqueDoel || currentTechnique.name || '',
                              source: 'technique_edit',
                              submittedBy: 'hugo',
                              targetKey: currentTechnique.nummer,
                              originalJson: {
                                doel: currentTechnique.doel || '',
                                wat: currentTechnique.wat || '',
                                waarom: currentTechnique.waarom || '',
                                wanneer: currentTechnique.wanneer || '',
                                hoe: currentTechnique.hoe || '',
                                stappenplan: currentTechnique.stappenplan || [],
                                voorbeeld: currentTechnique.voorbeeld || [],
                                tags: currentTechnique.tags || [],
                                themas: currentTechnique.themas || [],
                                context_requirements: currentTechnique.context_requirements || [],
                              },
                              newJson: {
                                doel: editedVideoData.techniqueDoel,
                                wat: editedVideoData.techniqueWat,
                                waarom: editedVideoData.techniqueWaarom,
                                wanneer: editedVideoData.techniqueWanneer,
                                hoe: editedVideoData.techniqueHoe,
                                stappenplan: parseLines(editedVideoData.techniqueStappenplan),
                                voorbeeld: parseLines(editedVideoData.techniqueVoorbeeld),
                                tags: parseLines(editedVideoData.techniqueTags),
                                themas: parseLines(editedVideoData.techniqueThemas),
                                context_requirements: parseLines(editedVideoData.techniqueContextRequirements),
                              },
                            }),
                          }));
                        }
                      }

                      if (corrections.length > 0) {
                        await Promise.all(corrections);
                        toast.success("Wijzigingen ingediend ter goedkeuring");
                      } else {
                        toast.info("Geen wijzigingen gevonden");
                      }
                    } catch (err) {
                      console.error('Corrections submission failed:', err);
                      toast.error("Indienen mislukt");
                      return;
                    }
                  }

                  setIsEditingVideo(false);
                  setDetailsVideo(null);
                }}
                className="text-white gap-2 hover:opacity-90"
                style={{ backgroundColor: '#9333ea' }}
              >
                <Save className="w-4 h-4" />
                {isSuperAdmin ? 'Opslaan' : 'Indienen ter review'}
              </Button>
            </>
          )
        }
      >
          <div className="space-y-6">
            {(() => {
              if (!detailsVideo) return null;
              
              const currentTechnique = selectedTechniqueId ? getTechniqueByNumber(selectedTechniqueId) : null;
              const techniqueOptions = EPIC_TECHNIQUES.filter(t => !t.is_fase);
              
              return (
                <>
                  {/* Video Info Section */}
                  <div>
                    <h3 className="text-[14px] font-bold text-hh-text mb-2">Video Informatie</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-hh-muted">Duur:</span>
                        <span className="text-[13px] font-medium text-hh-text">
                          {detailsVideo.duration ? `${Math.floor(detailsVideo.duration / 60)}:${(detailsVideo.duration % 60).toString().padStart(2, '0')}` : 'Geen data'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-hh-muted">Geüpload:</span>
                        <span className="text-[13px] font-medium text-hh-text">
                          {new Date(detailsVideo.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Samenvatting Section - with steel blue background like Doel */}
                  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgba(147, 51, 234, 0.05)', borderColor: 'rgba(147, 51, 234, 0.15)' }}>
                    <div className="flex items-start gap-2 mb-2">
                      <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#9333ea' }} />
                      <h3 className="text-[13px] font-semibold text-hh-text">Samenvatting</h3>
                    </div>
                    {(() => {
                      const summaryText = detailsVideo.ai_summary || '';
                      
                      if (!summaryText && !detailsVideo.has_transcript) {
                        return <p className="text-[13px] leading-[20px] text-hh-muted italic">Geen transcript beschikbaar om samen te vatten</p>;
                      }

                      if (!summaryText) {
                        return (
                          <div className="flex flex-col items-start gap-2">
                            <p className="text-[13px] leading-[20px] text-hh-muted italic">Nog geen AI samenvatting gegenereerd</p>
                            <button
                              onClick={async () => {
                                setGeneratingSummary(true);
                                try {
                                  const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
                                  const response = await fetch(`/api/videos/${detailsVideo.id}/summary`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${processorSecret}` },
                                  });
                                  const data = await response.json();
                                  if (data.summary) {
                                    setDetailsVideo(prev => prev ? { ...prev, ai_summary: data.summary } : null);
                                    toast.success('Samenvatting gegenereerd!');
                                  } else {
                                    toast.error(data.error || 'Samenvatting genereren mislukt');
                                  }
                                } catch (err) {
                                  toast.error('Fout bij genereren samenvatting');
                                } finally {
                                  setGeneratingSummary(false);
                                }
                              }}
                              disabled={generatingSummary}
                              className="text-[12px] font-medium px-3 py-1.5 rounded-md border flex items-center gap-1.5 hover:bg-purple-500/10 transition-colors"
                              style={{ color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.3)' }}
                            >
                              {generatingSummary ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Genereren...</>
                              ) : (
                                <><RefreshCw className="w-3.5 h-3.5" /> AI Samenvatting genereren</>
                              )}
                            </button>
                          </div>
                        );
                      }
                      
                      const isLong = summaryText.length > 300;
                      return (
                        <div>
                          <p className="text-[13px] leading-[20px] text-hh-text whitespace-pre-wrap">
                            {summaryExpanded || !isLong ? summaryText : summaryText.slice(0, 300) + '...'}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {isLong && (
                              <button 
                                onClick={() => setSummaryExpanded(!summaryExpanded)}
                                className="text-[13px] font-medium flex items-center gap-1"
                                style={{ color: '#9333ea' }}
                              >
                                {summaryExpanded ? (
                                  <>Minder tonen <ChevronUp className="w-4 h-4" /></>
                                ) : (
                                  <>Volledig lezen <ChevronDown className="w-4 h-4" /></>
                                )}
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                setGeneratingSummary(true);
                                try {
                                  setDetailsVideo(prev => prev ? { ...prev, ai_summary: null } : null);
                                  const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
                                  const response = await fetch(`/api/videos/${detailsVideo.id}/summary?force=true`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${processorSecret}` },
                                  });
                                  const data = await response.json();
                                  if (data.summary) {
                                    setDetailsVideo(prev => prev ? { ...prev, ai_summary: data.summary } : null);
                                    toast.success('Samenvatting opnieuw gegenereerd!');
                                  } else {
                                    setDetailsVideo(prev => prev ? { ...prev, ai_summary: summaryText } : null);
                                    toast.error(data.error || 'Samenvatting genereren mislukt');
                                  }
                                } catch (err) {
                                  setDetailsVideo(prev => prev ? { ...prev, ai_summary: summaryText } : null);
                                  toast.error('Fout bij genereren samenvatting');
                                } finally {
                                  setGeneratingSummary(false);
                                }
                              }}
                              disabled={generatingSummary}
                              className="text-[11px] font-medium px-2 py-1 rounded border flex items-center gap-1 hover:bg-purple-500/10 transition-colors"
                              style={{ color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.3)' }}
                            >
                              {generatingSummary ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Hergenereren...</>
                              ) : (
                                <><RefreshCw className="w-3 h-3" /> Hergenereer</>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Transcript Section */}
                  {detailsVideo.has_transcript && detailsVideo.transcript && (
                    <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
                      <div className="flex items-start gap-2 mb-2">
                        <FileText className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                        <h3 className="text-[13px] font-semibold text-hh-text">Transcript</h3>
                      </div>
                      {(() => {
                        const transcriptText = detailsVideo.transcript || '';
                        const isLong = transcriptText.length > 400;
                        
                        return (
                          <div>
                            <p className="text-[13px] leading-[20px] text-hh-text whitespace-pre-wrap">
                              {transcriptExpanded || !isLong ? transcriptText : transcriptText.slice(0, 400) + '...'}
                            </p>
                            {isLong && (
                              <button 
                                onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                                className="text-hh-muted hover:text-hh-text text-[13px] font-medium mt-2 flex items-center gap-1"
                              >
                                {transcriptExpanded ? (
                                  <>Minder tonen <ChevronUp className="w-4 h-4" /></>
                                ) : (
                                  <>Volledig transcript <ChevronDown className="w-4 h-4" /></>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Gekoppelde Techniek Section */}
                  <div>
                    <h3 className="text-[14px] font-bold text-hh-text mb-2">Gekoppelde Techniek</h3>
                    <Select
                      value={selectedTechniqueId || "none"}
                      onValueChange={(value: string) => setSelectedTechniqueId(value === "none" ? "" : value)}
                      disabled={!isEditingVideo}
                    >
                      <SelectTrigger className={!isEditingVideo ? "opacity-70 cursor-not-allowed" : ""}>
                        <SelectValue placeholder="Selecteer een techniek" />
                      </SelectTrigger>
                      <SelectContent 
                        position="popper" 
                        side="bottom" 
                        align="start"
                        sideOffset={4}
                        className="z-[9999] max-h-[200px] overflow-y-auto"
                      >
                        <SelectItem value="none">Geen techniek</SelectItem>
                        {techniqueOptions.map((technique) => (
                          <SelectItem key={technique.nummer} value={technique.nummer}>
                            {technique.nummer} - {technique.naam}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isEditingVideo && (
                      <p className="text-[12px] text-hh-muted mt-1">Klik op Bewerken om te wijzigen</p>
                    )}
                  </div>

                  {/* Technique Details Section - Flat Design */}
                  {currentTechnique && (
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className="bg-teal-500/10 text-teal-700 border-0 rounded-full font-mono">
                          {currentTechnique.nummer}
                        </Badge>
                        <span className="font-semibold text-hh-text">{currentTechnique.naam}</span>
                        <Badge variant="outline" className="text-[11px]">Fase {currentTechnique.fase}</Badge>
                      </div>

                      {/* Doel */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-1">Doel</h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueDoel}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueDoel: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="Doel van de techniek..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : (
                          <p className="text-[13px] leading-[20px] text-hh-muted">{currentTechnique.doel || 'Niet ingevuld'}</p>
                        )}
                      </div>

                      {/* Wat */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-1">Wat</h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueWat}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueWat: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="Wat is de techniek..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : (
                          <p className="text-[13px] leading-[20px] text-hh-muted">{currentTechnique.wat || 'Niet ingevuld'}</p>
                        )}
                      </div>

                      {/* Waarom */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-1">Waarom</h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueWaarom}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueWaarom: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="Waarom deze techniek gebruiken..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : (
                          <p className="text-[13px] leading-[20px] text-hh-muted">{currentTechnique.waarom || 'Niet ingevuld'}</p>
                        )}
                      </div>

                      {/* Wanneer */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-1">Wanneer</h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueWanneer}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueWanneer: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="Wanneer de techniek toepassen..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : (
                          <p className="text-[13px] leading-[20px] text-hh-muted">{currentTechnique.wanneer || 'Niet ingevuld'}</p>
                        )}
                      </div>

                      {/* Hoe */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-1">Hoe</h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueHoe}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueHoe: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="Hoe de techniek toepassen..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : (
                          <p className="text-[13px] leading-[20px] text-hh-muted">{currentTechnique.hoe || 'Niet ingevuld'}</p>
                        )}
                      </div>

                      {/* Stappenplan */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-1">
                          Stappenplan
                          {isEditingVideo && <span className="text-[11px] text-hh-muted font-normal ml-1">(1 stap per regel)</span>}
                        </h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueStappenplan}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueStappenplan: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="Stap 1&#10;Stap 2&#10;Stap 3..."
                            minHeight={80}
                            maxHeight={400}
                          />
                        ) : currentTechnique.stappenplan && currentTechnique.stappenplan.length > 0 ? (
                          <ol className="list-decimal ml-4 text-[13px] leading-[20px] text-hh-muted space-y-1">
                            {currentTechnique.stappenplan.map((step: string, i: number) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-[13px] text-hh-muted">Niet ingevuld</p>
                        )}
                      </div>

                      {/* Voorbeeld */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-1">
                          Voorbeeld
                          {isEditingVideo && <span className="text-[11px] text-hh-muted font-normal ml-1">(1 voorbeeld per regel)</span>}
                        </h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueVoorbeeld}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueVoorbeeld: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="Voorbeeld 1&#10;Voorbeeld 2..."
                            minHeight={80}
                            maxHeight={400}
                          />
                        ) : currentTechnique.voorbeeld && currentTechnique.voorbeeld.length > 0 ? (
                          <ul className="list-disc ml-4 text-[13px] leading-[20px] text-hh-muted space-y-1">
                            {currentTechnique.voorbeeld.map((example: string, i: number) => (
                              <li key={i}>{example}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[13px] text-hh-muted">Niet ingevuld</p>
                        )}
                      </div>

                      {/* Tags */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-2">
                          Tags
                          {isEditingVideo && <span className="text-[11px] text-hh-muted font-normal ml-1">(1 tag per regel)</span>}
                        </h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueTags}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueTags: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="tag1&#10;tag2&#10;tag3..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : currentTechnique.tags && currentTechnique.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {currentTechnique.tags.map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-[11px] bg-hh-ui-100 text-hh-ink border-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] text-hh-muted">Geen tags</p>
                        )}
                      </div>

                      {/* Thema's */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-2">
                          Thema's
                          {isEditingVideo && <span className="text-[11px] text-hh-muted font-normal ml-1">(1 thema per regel)</span>}
                        </h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueThemas}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueThemas: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="thema1&#10;thema2..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : currentTechnique.themas && currentTechnique.themas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {currentTechnique.themas.map((thema: string) => (
                              <Badge key={thema} variant="outline" className="text-[11px]" style={{ borderColor: 'rgba(147, 51, 234, 0.2)', color: '#3d6080' }}>
                                {thema}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] text-hh-muted">Geen thema's</p>
                        )}
                      </div>

                      {/* Context Requirements */}
                      <div>
                        <h4 className="text-[13px] font-semibold text-hh-text mb-2">
                          Context Requirements
                          {isEditingVideo && <span className="text-[11px] text-hh-muted font-normal ml-1">(1 requirement per regel)</span>}
                        </h4>
                        {isEditingVideo ? (
                          <AutoResizeTextarea
                            value={editedVideoData.techniqueContextRequirements}
                            onChange={(e) => setEditedVideoData({...editedVideoData, techniqueContextRequirements: e.target.value})}
                            className="w-full text-[13px] leading-[20px] p-2 border border-hh-border focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                            placeholder="requirement1&#10;requirement2..."
                            minHeight={60}
                            maxHeight={300}
                          />
                        ) : currentTechnique.context_requirements && currentTechnique.context_requirements.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {currentTechnique.context_requirements.map((req: string) => (
                              <Badge key={req} variant="outline" className="text-[11px] border-blue-200 text-blue-700">
                                {req}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] text-hh-muted">Geen requirements</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
      </DetailsSheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteVideo} onOpenChange={() => setDeleteVideo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Video verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{deleteVideo?.title}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verwijderen...
                </>
              ) : (
                "Verwijderen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transcript Viewer Modal */}
      <Dialog open={transcriptModal.open} onOpenChange={(open: boolean) => setTranscriptModal({ ...transcriptModal, open })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transcript: {transcriptModal.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-4 border rounded-md bg-hh-ui-50">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
              {transcriptModal.content || "Geen transcript beschikbaar"}
            </p>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTranscriptModal({ open: false, title: "", content: "" })}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}