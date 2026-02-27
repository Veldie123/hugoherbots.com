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
  List,
  LayoutGrid,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  Files,
  X,
  FileVideo,
  Pause,
  Play,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
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
  if (score >= 70) return "text-blue-600";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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

  const fetchAnalyses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v2/analysis/list?source=upload");
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
          <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Excellent
          </Badge>
        );
      case "Good":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
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
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Geanalyseerd
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[11px]">
            <XCircle className="w-3 h-3 mr-1" />
            Mislukt
          </Badge>
        );
      case "processing":
      case "transcribing":
      case "analyzing":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px]">
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

    const CHUNK_SIZE = 20 * 1024 * 1024;

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
          const initRes = await fetch('/api/v2/analysis/upload/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: bf.file.name,
              fileSize: bf.file.size,
              totalChunks,
              mimetype: bf.file.type,
            }),
          });
          if (!initRes.ok) throw new Error('Upload init mislukt');
          const { uploadId } = await initRes.json();

          for (let c = 0; c < totalChunks; c++) {
            const start = c * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, bf.file.size);
            const chunk = bf.file.slice(start, end);
            const fd = new FormData();
            fd.append('chunk', chunk, `chunk_${c}`);
            fd.append('uploadId', uploadId);
            fd.append('chunkIndex', String(c));
            const chunkRes = await fetch('/api/v2/analysis/upload/chunk', { method: 'POST', body: fd });
            if (!chunkRes.ok) throw new Error(`Chunk ${c + 1} mislukt`);
          }

          const completeRes = await fetch('/api/v2/analysis/upload/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

          const response = await fetch('/api/v2/analysis/upload', {
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
      className={`text-${align} py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-purple-700 select-none transition-colors`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-purple-600" : "text-hh-muted/50"}`} />
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
              variant="outline"
              className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => { setBulkDialogOpen(true); setBulkFiles([]); setBulkRunning(false); setBulkPaused(false); setBulkSkippedErrors([]); bulkAbortRef.current = false; }}
            >
              <Files className="w-4 h-4" />
              Bulk Upload
            </Button>
            <Button
              className="gap-2 text-white"
              style={{ backgroundColor: "#7e22ce" }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.backgroundColor = "#6b21a8")
              }
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) =>
                (e.currentTarget.style.backgroundColor = "#7e22ce")
              }
              onClick={() => navigate?.("admin-upload-analysis")}
            >
              <Upload className="w-4 h-4" />
              Analyseer gesprek
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { name: 'Totaal Analyses', value: isLoading ? "-" : stats.total, icon: Upload, bgColorStyle: 'rgba(147, 51, 234, 0.1)', colorStyle: '#9333ea', badge: '+24%', badgeTrend: 'up' as const },
            { name: 'Uitstekend', value: isLoading ? "-" : stats.excellent, icon: CheckCircle2, bgColorStyle: 'rgba(16, 185, 129, 0.1)', colorStyle: '#10b981', badge: '+43%', badgeTrend: 'up' as const },
            { name: 'Gem. Score', value: isLoading ? "-" : `${stats.avgScore}%`, icon: BarChart3, bgColorStyle: 'rgba(147, 51, 234, 0.1)', colorStyle: '#9333ea', badge: '+5%', badgeTrend: 'up' as const },
            { name: 'Verbetering Nodig', value: isLoading ? "-" : stats.needsImprovement, icon: AlertTriangle, bgColorStyle: 'rgba(239, 68, 68, 0.1)', colorStyle: '#ef4444', badge: '15%', badgeTrend: 'down' as const },
          ].map(stat => {
            const badgeStyles = stat.badgeTrend === 'up'
              ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }
              : stat.badgeTrend === 'neutral'
              ? { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)' }
              : { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' };
            return (
            <Card key={stat.name} className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: stat.bgColorStyle }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.colorStyle }} />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full border" style={badgeStyles}>
                  {stat.badge}
                </span>
              </div>
              <p className="text-[13px] leading-[18px] text-hh-muted">{stat.name}</p>
              <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px]" style={{ color: '#7c3aed' }}>{stat.value}</p>
            </Card>
          );})}
        </div>

        {error && (
          <Card className="p-4 rounded-[16px] border-red-500/30 bg-red-500/10">
            <div className="flex items-center gap-3 text-red-500">
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
              <div className="hidden sm:flex border border-hh-border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-none ${viewMode === "list" ? "bg-purple-100 text-purple-700" : "text-hh-muted hover:text-purple-600"}`}
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-none ${viewMode === "grid" ? "bg-purple-100 text-purple-700" : "text-hh-muted hover:text-purple-600"}`}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-[16px] shadow-sm border-hh-border overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
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
                          <Badge className="bg-purple-600/10 text-purple-600 border-purple-600/20 text-[11px] font-mono">
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
                            {analysis.status}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-600/10 flex items-center justify-center text-[11px] font-semibold text-purple-600 shrink-0">
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
                          <Mic className="w-4 h-4 text-purple-600" />
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
                        {getQualityBadge(getQualityLabel(analysis.overallScore))}
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
                  className="p-4 rounded-xl border-hh-border hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() =>
                    navigate?.("admin-analysis-results", {
                      conversationId: analysis.id,
                      fromAdmin: true,
                    })
                  }
                >
                  <div className="flex items-start justify-between mb-3">
                    {(analysis.techniquesFound || []).length > 0 ? (
                      <Badge className="bg-purple-600/10 text-purple-600 border-purple-600/20 text-[10px] font-mono px-1.5 py-0">
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <p className="text-[14px] font-medium text-hh-text mb-1 line-clamp-1">
                    {analysis.title || "Zonder titel"}
                  </p>
                  <p className="text-[11px] text-hh-muted mb-3">{analysis.status}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-purple-600/10 flex items-center justify-center text-[10px] font-semibold text-purple-600">
                      {getInitials(analysis.userName || analysis.userId)}
                    </div>
                    <span className="text-[12px] text-hh-muted truncate">
                      {analysis.userName || analysis.userId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="w-3 h-3 text-purple-600" />
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
                          className="text-[9px] px-1 py-0 border-purple-200 text-purple-600 bg-purple-50"
                        >
                          {tech}
                        </Badge>
                      ))}
                      {(analysis.techniquesFound || []).length > 2 && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-purple-200 text-purple-600 bg-purple-50"
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[20px] text-hh-text flex items-center gap-2">
              <Files className="w-5 h-5 text-purple-600" />
              Bulk Gespreksanalyse
            </DialogTitle>
            <p className="text-[13px] text-hh-muted mt-1">
              Selecteer meerdere audio/video bestanden om tegelijk te analyseren. De bestanden worden sequentieel verwerkt.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-2">
            {!bulkRunning && (
              <div
                className="border-2 border-dashed border-purple-300 rounded-xl p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50/50 transition-all"
                onClick={() => bulkFileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
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
              <div className="rounded-lg border border-orange-300 bg-orange-50/50 px-3 py-2">
                <p className="text-[12px] font-medium text-orange-700 mb-1">Overgeslagen bestanden:</p>
                {bulkSkippedErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-orange-600">{err}</p>
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
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${bulkStats.total > 0 ? ((bulkStats.completed + bulkStats.failed) / bulkStats.total * 100) : 0}%`,
                              backgroundColor: '#7e22ce',
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
                      <Button variant="outline" size="sm" onClick={toggleBulkPause} className="h-7 text-[12px] border-purple-300 text-purple-700">
                        {bulkPaused ? <><Play className="w-3 h-3 mr-1" /> Hervat</> : <><Pause className="w-3 h-3 mr-1" /> Pauzeer</>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={cancelBulkUpload} className="h-7 text-[12px] border-red-300 text-red-600 hover:bg-red-50" title="Stopt na het huidige bestand">
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
                        bf.status === "completed" ? "bg-emerald-50/50 border-emerald-200" :
                        bf.status === "failed" ? "bg-red-50/50 border-red-200" :
                        bf.status === "uploading" ? "bg-purple-50/50 border-purple-300" :
                        "bg-hh-bg border-hh-border"
                      }`}
                    >
                      <span className="text-[11px] text-hh-muted font-mono w-6 text-right">{idx + 1}</span>
                      {bf.file.type.startsWith('video/') ? (
                        <FileVideo className="w-4 h-4 text-purple-500 shrink-0" />
                      ) : (
                        <FileAudio className="w-4 h-4 text-purple-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-hh-text font-medium">{bf.title}</p>
                        <p className="text-[11px] text-hh-muted">
                          {(bf.file.size / 1024 / 1024).toFixed(1)}MB
                          {bf.error && <span className="text-red-500 ml-2">{bf.error}</span>}
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
                        {bf.status === "uploading" && <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />}
                        {bf.status === "completed" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {bf.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
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
                <span className="text-emerald-600">{bulkStats.completed} analyses gestart{bulkStats.failed > 0 ? `, ${bulkStats.failed} mislukt` : ''}</span>
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
                      className="text-[13px] text-white gap-2"
                      style={{ backgroundColor: "#7e22ce" }}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = "#6b21a8")}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = "#7e22ce")}
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
