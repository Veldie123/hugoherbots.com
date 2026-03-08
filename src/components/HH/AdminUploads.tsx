import {
  Search,
  Download,
  Eye,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Upload,
  FileAudio,
  Loader2,
  RefreshCw,
  BarChart3,
  XCircle,
  Mic,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  Files,
  X,
  FileVideo,
  Pause,
  Play,
  Bell,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useMobileViewMode } from "@/hooks/useMobileViewMode";
import { useNotifications } from "@/contexts/NotificationContext";
import { apiFetch } from "../../services/apiFetch";
import { toast } from "sonner";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
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

interface AdminUploadsProps {
  navigate?: (page: string, data?: Record<string, any>) => void;
  isSuperAdmin?: boolean;
}

interface AnalysisRecord {
  id: string;
  title: string;
  status: string;
  error?: string;
  overallScore: number | null;
  durationMs: number | null;
  createdAt: string;
  techniquesFound: string[];
  userId: string;
  userName: string;
  userEmail?: string;
  turnCount: number;
}

type SortField = "title" | "score" | "date" | "status" | "userName";
type SortDir = "asc" | "desc";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("nl-NL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-hh-success";
  if (score >= 70) return "text-hh-primary";
  return "text-hh-warn";
}

function getQualityLabel(score: number | null): string {
  if (score == null) return "Pending";
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  return "Needs Work";
}

interface BulkFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "completed" | "failed";
  conversationId?: string;
  error?: string;
  title: string;
}

const VALID_EXTENSIONS = /\.(mp3|wav|m4a|mp4|mov)$/i;
const VALID_MIME_TYPES = [
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/m4a",
  "audio/mp4", "audio/x-m4a", "video/mp4", "video/quicktime",
];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function AdminUploads({ navigate, isSuperAdmin }: AdminUploadsProps) {
  const { addPendingAnalysis } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode] = useMobileViewMode("grid", "list");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bulkDialogOpen, setBulkDialogOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('bulk') === '1';
    }
    return false;
  });
  const [bulkFiles, setBulkFiles] = useState<BulkFile[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkPaused, setBulkPaused] = useState(false);
  const [bulkSkippedErrors, setBulkSkippedErrors] = useState<string[]>([]);
  const bulkPausedRef = useRef(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const bulkAbortRef = useRef(false);
  const [processingAnalyses, setProcessingAnalyses] = useState<{id: string, title: string, status: string}[]>([]);

  const fetchAnalyses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/v2/analysis/list?source=upload");
      if (!res.ok) throw new Error("Analyses ophalen mislukt");
      const data = await res.json();
      setAnalyses(data.analyses || []);
    } catch (err: any) {
      setError(err.message || "Kon analyses niet laden");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const handleRetryAnalysis = async (analysisId: string) => {
    try {
      const res = await apiFetch(`/api/v2/analysis/retry/${analysisId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Opnieuw starten mislukt");
      setAnalyses(prev => prev.map(a =>
        a.id === analysisId ? { ...a, status: 'transcribing', error: undefined } : a
      ));
      const analysis = analyses.find(a => a.id === analysisId);
      if (analysis) {
        setProcessingAnalyses(prev => [...prev, { id: analysisId, title: analysis.title, status: 'transcribing' }]);
      }
      toast.success("Analyse wordt opnieuw gestart...");
    } catch (err: any) {
      toast.error(err.message || "Opnieuw starten mislukt");
    }
  };

  // Poll processing analyses for live status updates
  useEffect(() => {
    if (processingAnalyses.length === 0) return;
    const hasActive = processingAnalyses.some(a => !['completed', 'failed'].includes(a.status));
    if (!hasActive) return;

    const interval = setInterval(async () => {
      let anyChanged = false;
      const updated = await Promise.all(
        processingAnalyses.map(async (pa) => {
          if (['completed', 'failed'].includes(pa.status)) return pa;
          try {
            const res = await apiFetch(`/api/v2/analysis/status/${pa.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status !== pa.status) anyChanged = true;
              return { ...pa, status: data.status };
            }
          } catch { /* ignore */ }
          return pa;
        })
      );
      setProcessingAnalyses(updated);
      if (anyChanged) fetchAnalyses();

      // Auto-clear completed/failed after all done
      if (updated.every(a => ['completed', 'failed'].includes(a.status))) {
        setTimeout(() => setProcessingAnalyses([]), 5000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [processingAnalyses, fetchAnalyses]);

  const filteredAnalyses = analyses.filter((a) => {
    const matchesSearch =
      (a.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.userName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.techniquesFound || []).some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "completed" && a.status === "completed") ||
      (filterStatus === "failed" && a.status === "failed") ||
      (filterStatus === "processing" &&
        ["processing", "transcribing", "analyzing"].includes(a.status));
    return matchesSearch && matchesStatus;
  });

  const sortedAnalyses = [...filteredAnalyses].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "title":
        return dir * (a.title || "").localeCompare(b.title || "");
      case "score":
        return dir * ((a.overallScore || 0) - (b.overallScore || 0));
      case "date":
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "status":
        return dir * a.status.localeCompare(b.status);
      case "userName":
        return dir * (a.userName || "").localeCompare(b.userName || "");
      default:
        return 0;
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const stats = {
    total: analyses.length,
    excellent: analyses.filter(
      (a) => a.status === "completed" && a.overallScore != null && a.overallScore >= 80
    ).length,
    needsImprovement: analyses.filter(
      (a) => a.status === "completed" && a.overallScore != null && a.overallScore < 60
    ).length,
    avgScore: (() => {
      const scored = analyses.filter(
        (a) => a.status === "completed" && a.overallScore != null
      );
      if (scored.length === 0) return 0;
      return Math.round(
        scored.reduce((acc, a) => acc + (a.overallScore || 0), 0) / scored.length
      );
    })(),
  };

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case "Excellent":
        return (
          <Badge className="bg-hh-success-100 text-hh-success-700 border-hh-success-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Excellent
          </Badge>
        );
      case "Good":
        return (
          <Badge className="bg-hh-primary-100 text-hh-primary border-hh-primary-200">
            <ThumbsUp className="w-3 h-3 mr-1" />
            Good
          </Badge>
        );
      case "Needs Work":
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Work
          </Badge>
        );
      default:
        return (
          <Badge className="bg-hh-muted/10 text-hh-muted border-hh-muted/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-hh-success-100 text-hh-success-700 border-hh-success-200 text-[11px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Geanalyseerd
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-hh-error-100 text-hh-error-700 border-hh-error-200 text-[11px]">
            <XCircle className="w-3 h-3 mr-1" />
            Mislukt
          </Badge>
        );
      case "processing":
      case "transcribing":
      case "analyzing":
        return (
          <Badge className="bg-hh-primary-100 text-hh-primary border-hh-primary-200 text-[11px]">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Verwerken
          </Badge>
        );
      default:
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[11px]">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: BulkFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const hasValidMime = VALID_MIME_TYPES.includes(file.type);
      const hasValidExt = VALID_EXTENSIONS.test(file.name);
      if (!hasValidMime && !hasValidExt) {
        errors.push(`${file.name}: ongeldig bestandstype`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: te groot (max 100MB)`);
        continue;
      }
      const title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      validFiles.push({
        file,
        id: crypto.randomUUID(),
        status: "pending",
        title,
      });
    }

    if (errors.length > 0) {
      setBulkSkippedErrors(prev => [...prev, ...errors]);
    }

    setBulkFiles(prev => [...prev, ...validFiles]);
    if (e.target) e.target.value = '';
  };

  const removeBulkFile = (id: string) => {
    setBulkFiles(prev => prev.filter(f => f.id !== id));
  };

  const startBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    setBulkRunning(true);
    setBulkPaused(false);
    bulkPausedRef.current = false;
    bulkAbortRef.current = false;

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (safe under Railway 25MB proxy limit)

    for (let i = 0; i < bulkFiles.length; i++) {
      const bf = bulkFiles[i];
      if (bf.status === "completed" || bf.status === "failed") continue;
      if (bulkAbortRef.current) break;

      while (bulkPausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (bulkAbortRef.current) break;
      }
      if (bulkAbortRef.current) break;

      setBulkFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: "uploading" } : f));

      try {
        let result: any;

        if (bf.file.size > CHUNK_SIZE) {
          const totalChunks = Math.ceil(bf.file.size / CHUNK_SIZE);
          const initRes = await apiFetch('/api/v2/analysis/upload/init', {
            method: 'POST',
            body: JSON.stringify({
              fileName: bf.file.name,
              fileSize: bf.file.size,
              totalChunks,
              mimetype: bf.file.type,
            }),
          });
          if (!initRes.ok) {
            const errBody = await initRes.json().catch(() => ({}));
            throw new Error(errBody.error || `Upload init mislukt (${initRes.status})`);
          }
          const { uploadId } = await initRes.json();

          for (let c = 0; c < totalChunks; c++) {
            const start = c * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, bf.file.size);
            const chunk = bf.file.slice(start, end);
            const fd = new FormData();
            fd.append('chunk', chunk, `chunk_${c}`);
            fd.append('uploadId', uploadId);
            fd.append('chunkIndex', String(c));
            // apiFetch auto-detects FormData, skips Content-Type
            const chunkRes = await apiFetch('/api/v2/analysis/upload/chunk', { method: 'POST', body: fd });
            if (!chunkRes.ok) throw new Error(`Chunk ${c + 1} mislukt`);
          }

          const completeRes = await apiFetch('/api/v2/analysis/upload/complete', {
            method: 'POST',
            body: JSON.stringify({
              uploadId,
              title: bf.title,
              context: '',
              userId: 'admin-bulk',
              consentConfirmed: 'true',
            }),
          });
          result = await completeRes.json();
          if (!completeRes.ok) throw new Error(result.error || 'Upload afronden mislukt');
        } else {
          const formData = new FormData();
          formData.append('file', bf.file);
          formData.append('title', bf.title);
          formData.append('context', '');
          formData.append('userId', 'admin-bulk');
          formData.append('consentConfirmed', 'true');

          // apiFetch auto-detects FormData, skips Content-Type
          const response = await apiFetch('/api/v2/analysis/upload', {
            method: 'POST',
            body: formData,
          });
          result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Upload mislukt');
        }

        setBulkFiles(prev => prev.map(f => f.id === bf.id ? {
          ...f,
          status: "completed",
          conversationId: result.conversationId,
        } : f));

        addPendingAnalysis(result.conversationId, bf.title);

      } catch (err: any) {
        setBulkFiles(prev => prev.map(f => f.id === bf.id ? {
          ...f,
          status: "failed",
          error: err.message || 'Upload mislukt',
        } : f));
      }
    }

    setBulkRunning(false);
    fetchAnalyses();

    // Collect uploaded analyses for progress tracking
    const uploaded = bulkFiles.filter(f => f.conversationId);
    if (uploaded.length > 0) {
      setProcessingAnalyses(uploaded.map(f => ({ id: f.conversationId!, title: f.title, status: 'transcribing' })));
      setTimeout(() => setBulkDialogOpen(false), 1500);
    }
  };

  const toggleBulkPause = () => {
    const newPaused = !bulkPaused;
    setBulkPaused(newPaused);
    bulkPausedRef.current = newPaused;
  };

  const cancelBulkUpload = () => {
    bulkAbortRef.current = true;
    bulkPausedRef.current = false;
    setBulkPaused(false);
    setBulkRunning(false);
  };

  const bulkStats = {
    total: bulkFiles.length,
    completed: bulkFiles.filter(f => f.status === "completed").length,
    failed: bulkFiles.filter(f => f.status === "failed").length,
    pending: bulkFiles.filter(f => f.status === "pending").length,
    uploading: bulkFiles.filter(f => f.status === "uploading").length,
  };

  const SortHeader = ({ label, field, align = "left" }: { label: string; field: SortField; align?: string }) => (
    <th
      className={`text-${align} py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-primary select-none transition-colors`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-hh-primary" : "text-hh-muted/50"}`} />
      </span>
    </th>
  );

  return (
    <AdminLayout currentPage="admin-uploads" navigate={navigate} isSuperAdmin={isSuperAdmin}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] sm:text-[32px] leading-[30px] sm:leading-[40px] text-hh-text mb-2">
              Gespreksanalyse
            </h1>
            <p className="text-[13px] sm:text-[16px] leading-[18px] sm:leading-[24px] text-hh-muted">
              Beheer en analyseer alle geüploade sales gesprekken
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="gap-2 text-white bg-hh-primary hover:bg-hh-primary/90"
              onClick={() => { setBulkDialogOpen(true); setBulkFiles([]); setBulkRunning(false); setBulkPaused(false); setBulkSkippedErrors([]); bulkAbortRef.current = false; }}
            >
              <Files className="w-4 h-4" />
              Bulk Upload
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { name: 'Totaal Analyses', value: isLoading ? "-" : stats.total, icon: Upload, bgClass: 'bg-hh-primary-100', textClass: 'text-hh-primary', badge: '+24%', badgeTrend: 'up' as const },
            { name: 'Uitstekend', value: isLoading ? "-" : stats.excellent, icon: CheckCircle2, bgClass: 'bg-hh-success-100', textClass: 'text-hh-success', badge: '+43%', badgeTrend: 'up' as const },
            { name: 'Gem. Score', value: isLoading ? "-" : `${stats.avgScore}%`, icon: BarChart3, bgClass: 'bg-hh-primary-100', textClass: 'text-hh-primary', badge: '+5%', badgeTrend: 'up' as const },
            { name: 'Verbetering Nodig', value: isLoading ? "-" : stats.needsImprovement, icon: AlertTriangle, bgClass: 'bg-hh-error-100', textClass: 'text-hh-error', badge: '15%', badgeTrend: 'down' as const },
          ].map(stat => {
            const badgeClass = stat.badgeTrend === 'up'
              ? 'bg-hh-success-100 text-hh-success border-hh-success-200'
              : stat.badgeTrend === 'neutral'
              ? 'bg-hh-warning-100 text-hh-warning border-hh-warning-200'
              : 'bg-hh-error-100 text-hh-error border-hh-error-200';
            return (
            <Card key={stat.name} className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bgClass}`}>
                  <stat.icon className={`w-5 h-5 ${stat.textClass}`} />
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badgeClass}`}>
                  {stat.badge}
                </span>
              </div>
              <p className="text-[13px] leading-[18px] text-hh-muted">{stat.name}</p>
              <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-hh-primary">{stat.value}</p>
            </Card>
          );})}
        </div>

        {error && (
          <Card className="p-4 rounded-[16px] border-hh-error-200 bg-hh-error-100">
            <div className="flex items-center gap-3 text-hh-error">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-[14px]">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalyses}
                className="ml-auto"
              >
                Opnieuw proberen
              </Button>
            </div>
          </Card>
        )}

        {processingAnalyses.length > 0 && (
          <div className="space-y-3">
            {processingAnalyses.map((pa) => {
              const steps = ['transcribing', 'analyzing', 'evaluating', 'generating_report', 'completed'];
              const stepLabels = ['Transcriptie', 'Analyse', 'Evaluatie', 'Rapport', 'Klaar'];
              const currentIndex = steps.indexOf(pa.status);
              const isFailed = pa.status === 'failed';
              const isDone = pa.status === 'completed';
              const statusText = isFailed ? 'Analyse mislukt' : isDone ? 'Analyse voltooid!' : ({
                transcribing: 'Transcriberen...', analyzing: 'Turns analyseren...',
                evaluating: 'E.P.I.C. evalueren...', generating_report: 'Rapport genereren...',
              } as Record<string, string>)[pa.status] || pa.status;

              return (
                <Card key={pa.id} className="p-4 rounded-xl border-hh-border shadow-sm bg-hh-ui-50">
                  <div className="flex items-center gap-3 mb-3">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-hh-success" />
                    ) : isFailed ? (
                      <XCircle className="w-5 h-5 text-hh-error" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-hh-primary animate-spin" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-semibold text-hh-text">{statusText}</span>
                      <span className="text-[12px] text-hh-muted ml-2">{pa.title}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mb-2">
                    {steps.map((step, i) => (
                      <div
                        key={step}
                        className="h-2 flex-1 rounded-full transition-all duration-500"
                        style={{ backgroundColor: isFailed ? 'var(--hh-error)' : currentIndex >= i ? 'var(--hh-primary)' : 'var(--hh-ui-200, #e5e7eb)' }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] text-hh-muted">
                    {stepLabels.map(label => <span key={label}>{label}</span>)}
                  </div>
                  {!isDone && !isFailed && (
                    <p className="text-[12px] text-hh-muted mt-3 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5" />
                      Analyses worden verwerkt — je krijgt een melding via het belletje rechtsboven.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <Card className="p-4 rounded-[16px] shadow-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek op gebruiker, titel, email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 items-center">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Alle Statussen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Statussen</SelectItem>
                  <SelectItem value="completed">Geanalyseerd</SelectItem>
                  <SelectItem value="processing">Verwerken</SelectItem>
                  <SelectItem value="failed">Mislukt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="rounded-[16px] shadow-sm border-hh-border overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hh-primary mx-auto mb-4"></div>
                <p className="text-hh-muted">Analyses laden...</p>
              </div>
            </div>
          ) : sortedAnalyses.length === 0 ? (
            <div className="p-12 text-center">
              <FileAudio className="w-12 h-12 text-hh-muted mx-auto mb-4 opacity-40" />
              <p className="text-hh-muted text-[14px]">
                {searchQuery || filterStatus !== "all"
                  ? "Geen analyses gevonden met deze filters"
                  : "Nog geen analyses beschikbaar"}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <SortHeader label="#" field="score" />
                    <SortHeader label="Titel" field="title" />
                    <SortHeader label="Gebruiker" field="userName" />
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Duur
                    </th>
                    <SortHeader label="Score" field="score" align="right" />
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Kwaliteit
                    </th>
                    <SortHeader label="Datum" field="date" />
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAnalyses.map((analysis, index) => (
                    <tr
                      key={analysis.id}
                      className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50/50 transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-hh-bg" : "bg-hh-ui-50/30"
                      }`}
                      onClick={() =>
                        navigate?.("admin-analysis-results", {
                          conversationId: analysis.id,
                          fromAdmin: true,
                        })
                      }
                    >
                      <td className="px-4 py-3">
                        {(analysis.techniquesFound || []).length > 0 ? (
                          <Badge className="bg-hh-primary-100 text-hh-primary border-hh-primary-200 text-[11px] font-mono">
                            {analysis.techniquesFound[0]}
                          </Badge>
                        ) : (
                          <span className="text-[13px] text-hh-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-[14px] font-medium text-hh-text">
                            {analysis.title || "Zonder titel"}
                          </p>
                          <p className="text-[12px] text-hh-muted">
                            {analysis.status === 'failed' && analysis.error ? (
                              <span className="text-hh-error">{analysis.error}</span>
                            ) : analysis.status === 'completed' ? '' : (
                              ({ transcribing: 'Transcriberen...', analyzing: 'Analyseren...', evaluating: 'Evalueren...', generating_report: 'Rapport genereren...' } as Record<string, string>)[analysis.status] || analysis.status
                            )}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-hh-primary-100 flex items-center justify-center text-[11px] font-semibold text-hh-primary shrink-0">
                            {getInitials(analysis.userName || analysis.userId)}
                          </div>
                          <div>
                            <p className="text-[14px] font-medium text-hh-text">
                              {analysis.userName || analysis.userId}
                            </p>
                            {analysis.userEmail && (
                              <p className="text-[12px] text-hh-muted">
                                {analysis.userEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-hh-primary" />
                          <span className="text-[13px] text-hh-text">AI Audio</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-hh-text">
                          {analysis.durationMs ? `${Math.floor(analysis.durationMs / 60000)}:${String(Math.floor((analysis.durationMs % 60000) / 1000)).padStart(2, '0')}` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {analysis.overallScore != null ? (
                          <span className={`text-[14px] font-semibold ${getScoreColor(analysis.overallScore)}`}>
                            {analysis.overallScore}%
                          </span>
                        ) : (
                          <span className="text-[13px] text-hh-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {analysis.status === 'completed'
                          ? getQualityBadge(getQualityLabel(analysis.overallScore))
                          : getStatusBadge(analysis.status)}
                      </td>
                      <td className="px-4 py-3 text-[13px] leading-[18px] text-hh-muted">
                        {formatDate(analysis.createdAt)}
                      </td>
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate?.("admin-analysis-results", {
                                  conversationId: analysis.id,
                                  fromAdmin: true,
                                })
                              }
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk Analyse
                            </DropdownMenuItem>
                            {analysis.status === 'failed' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRetryAnalysis(analysis.id); }}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Opnieuw proberen
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAnalyses.map((analysis) => (
                <Card
                  key={analysis.id}
                  className="p-4 rounded-xl border-hh-border hover:border-hh-primary/30 hover:shadow-md transition-all cursor-pointer"
                  onClick={() =>
                    navigate?.("admin-analysis-results", {
                      conversationId: analysis.id,
                      fromAdmin: true,
                    })
                  }
                >
                  <div className="flex items-start justify-between mb-3">
                    {(analysis.techniquesFound || []).length > 0 ? (
                      <Badge className="bg-hh-primary-100 text-hh-primary border-hh-primary-200 text-[10px] font-mono px-1.5 py-0">
                        {analysis.techniquesFound[0]}
                      </Badge>
                    ) : (
                      <span className="text-[12px] text-hh-muted">—</span>
                    )}
                    <div className="flex items-center gap-2">
                      {getStatusBadge(analysis.status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate?.("admin-analysis-results", {
                                conversationId: analysis.id,
                                fromAdmin: true,
                              });
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Bekijk Analyse
                          </DropdownMenuItem>
                          {analysis.status === 'failed' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRetryAnalysis(analysis.id); }}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Opnieuw proberen
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <p className="text-[14px] font-medium text-hh-text mb-1 line-clamp-1">
                    {analysis.title || "Zonder titel"}
                  </p>
                  <p className="text-[11px] text-hh-muted mb-3">{analysis.status === 'failed' && analysis.error ? (
                    <span className="text-hh-error">{analysis.error}</span>
                  ) : analysis.status === 'completed' ? '' : (
                    ({ transcribing: 'Transcriberen...', analyzing: 'Analyseren...', evaluating: 'Evalueren...', generating_report: 'Rapport genereren...' } as Record<string, string>)[analysis.status] || analysis.status
                  )}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-hh-primary-100 flex items-center justify-center text-[10px] font-semibold text-hh-primary">
                      {getInitials(analysis.userName || analysis.userId)}
                    </div>
                    <span className="text-[12px] text-hh-muted truncate">
                      {analysis.userName || analysis.userId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="w-3 h-3 text-hh-primary" />
                      <span className="text-[11px] text-hh-text">AI Audio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis.overallScore != null ? (
                        <span className={`text-[14px] font-semibold ${getScoreColor(analysis.overallScore)}`}>
                          {analysis.overallScore}%
                        </span>
                      ) : (
                        <span className="text-[12px] text-hh-muted">—</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-hh-border/50">
                    <div className="flex flex-wrap gap-1">
                      {(analysis.techniquesFound || []).slice(0, 2).map((tech, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-hh-primary-200 text-hh-primary bg-hh-primary-50"
                        >
                          {tech}
                        </Badge>
                      ))}
                      {(analysis.techniquesFound || []).length > 2 && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-hh-primary-200 text-hh-primary bg-hh-primary-50"
                        >
                          +{analysis.techniquesFound.length - 2}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-hh-muted">
                      {formatDate(analysis.createdAt)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { if (!bulkRunning) setBulkDialogOpen(open); }}>
        <DialogContent className="admin-session max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[20px] text-hh-text flex items-center gap-2">
              <Files className="w-5 h-5 text-hh-primary" />
              Bulk Gespreksanalyse
            </DialogTitle>
            <p className="text-[13px] text-hh-muted mt-1">
              Selecteer meerdere audio/video bestanden om tegelijk te analyseren. De bestanden worden sequentieel verwerkt.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-2">
            {!bulkRunning && (
              <div
                className="border-2 border-dashed border-hh-primary-200 rounded-xl p-6 text-center cursor-pointer hover:border-hh-primary hover:bg-hh-primary/5 transition-all"
                onClick={() => bulkFileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-hh-primary/60 mx-auto mb-2" />
                <p className="text-[14px] font-medium text-hh-text">Klik om bestanden te selecteren</p>
                <p className="text-[12px] text-hh-muted mt-1">MP3, WAV, M4A, MP4, MOV — max 100MB per bestand</p>
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  multiple
                  accept=".mp3,.wav,.m4a,.mp4,.mov,audio/*,video/*"
                  className="hidden"
                  onChange={handleBulkFileSelect}
                />
              </div>
            )}

            {bulkSkippedErrors.length > 0 && (
              <div className="rounded-lg border border-hh-warning-200 bg-hh-warning-50 px-3 py-2">
                <p className="text-[12px] font-medium text-hh-warning mb-1">Overgeslagen bestanden:</p>
                {bulkSkippedErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-hh-warning">{err}</p>
                ))}
              </div>
            )}

            {bulkFiles.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-hh-text">{bulkFiles.length} bestanden</span>
                    {bulkRunning && (
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-hh-ui-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-hh-primary"
                            style={{
                              width: `${bulkStats.total > 0 ? ((bulkStats.completed + bulkStats.failed) / bulkStats.total * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[12px] text-hh-muted">
                          {bulkStats.completed + bulkStats.failed}/{bulkStats.total}
                        </span>
                      </div>
                    )}
                  </div>
                  {bulkRunning && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={toggleBulkPause} className="h-7 text-[12px] border-hh-primary-200 text-hh-primary">
                        {bulkPaused ? <><Play className="w-3 h-3 mr-1" /> Hervat</> : <><Pause className="w-3 h-3 mr-1" /> Pauzeer</>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={cancelBulkUpload} className="h-7 text-[12px] border-hh-error-200 text-hh-error hover:bg-hh-error/5" title="Stopt na het huidige bestand">
                        <X className="w-3 h-3 mr-1" /> Stop na huidig
                      </Button>
                    </div>
                  )}
                </div>

                <div className="overflow-y-auto flex-1 max-h-[350px] space-y-1.5 pr-1">
                  {bulkFiles.map((bf, idx) => (
                    <div
                      key={bf.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-[13px] ${
                        bf.status === "completed" ? "bg-hh-success-50 border-hh-success-200" :
                        bf.status === "failed" ? "bg-hh-error-50 border-hh-error-200" :
                        bf.status === "uploading" ? "bg-hh-primary-50 border-hh-primary-200" :
                        "bg-hh-bg border-hh-border"
                      }`}
                    >
                      <span className="text-[11px] text-hh-muted font-mono w-6 text-right">{idx + 1}</span>
                      {bf.file.type.startsWith('video/') ? (
                        <FileVideo className="w-4 h-4 text-hh-primary shrink-0" />
                      ) : (
                        <FileAudio className="w-4 h-4 text-hh-primary shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-hh-text font-medium">{bf.title}</p>
                        <p className="text-[11px] text-hh-muted">
                          {(bf.file.size / 1024 / 1024).toFixed(1)}MB
                          {bf.error && <span className="text-hh-error ml-2">{bf.error}</span>}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {bf.status === "pending" && (
                          !bulkRunning ? (
                            <button onClick={() => removeBulkFile(bf.id)} className="p-1 hover:bg-hh-ui-100 rounded">
                              <X className="w-3.5 h-3.5 text-hh-muted" />
                            </button>
                          ) : (
                            <Clock className="w-4 h-4 text-hh-muted" />
                          )
                        )}
                        {bf.status === "uploading" && <Loader2 className="w-4 h-4 text-hh-primary animate-spin" />}
                        {bf.status === "completed" && <CheckCircle2 className="w-4 h-4 text-hh-success" />}
                        {bf.status === "failed" && <XCircle className="w-4 h-4 text-hh-error" />}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-hh-border mt-2">
            <div className="text-[12px] text-hh-muted">
              {bulkRunning && bulkStats.completed > 0 && (
                <span>{bulkStats.completed} geüpload, {bulkStats.failed > 0 ? `${bulkStats.failed} mislukt, ` : ''}{bulkStats.pending} wachtend</span>
              )}
              {!bulkRunning && bulkStats.completed > 0 && (
                <span className="text-hh-success">{bulkStats.completed} analyses gestart{bulkStats.failed > 0 ? `, ${bulkStats.failed} mislukt` : ''}</span>
              )}
            </div>
            <div className="flex gap-2">
              {!bulkRunning && (
                <>
                  <Button variant="outline" onClick={() => setBulkDialogOpen(false)} className="text-[13px]">
                    {bulkStats.completed > 0 ? 'Sluiten' : 'Annuleren'}
                  </Button>
                  {bulkFiles.some(f => f.status === "pending") && (
                    <Button
                      onClick={startBulkUpload}
                      className="text-[13px] text-white gap-2 bg-hh-primary hover:bg-hh-primary/90"
                    >
                      <Upload className="w-4 h-4" />
                      Start {bulkFiles.filter(f => f.status === "pending").length} Analyses
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
