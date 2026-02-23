import {
  Search,
  Download,
  Flag,
  Clock,
  Calendar,
  FileAudio,
  Mic,
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  List,
  LayoutGrid,
  MoreVertical,
  Trash2,
  BarChart3,
  Eye,
  Upload as UploadIcon,
  XCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { CustomCheckbox } from "../ui/custom-checkbox";
import { useState, useEffect, useRef } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
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
import { hideItem, getHiddenIds } from "../../utils/hiddenItems";

interface AdminUploadManagementProps {
  navigate?: (page: string, data?: any) => void;
}

interface UploadItem {
  id: string;
  user: string;
  userEmail: string;
  userInitials: string;
  title: string;
  type: "Audio";
  duration: string;
  score: number | null;
  quality: "Excellent" | "Good" | "Needs Work" | "Pending";
  status: string;
  date: string;
  time: string;
  techniquesFound: string[];
}

export function AdminUploadManagement({ navigate }: AdminUploadManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => getHiddenIds('admin', 'analysis'));

  const handleDelete = (id: string) => {
    hideItem('admin', 'analysis', id);
    setHiddenIds(new Set(getHiddenIds('admin', 'analysis')));
  };

  const selectionMode = selectedIds.length > 0;

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/v2/analysis/list');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        const mapped: UploadItem[] = (data.analyses || []).map((a: any) => {
          const score = a.overallScore ?? null;
          const quality = score === null ? 'Pending' :
            score >= 80 ? 'Excellent' :
            score >= 60 ? 'Good' : 'Needs Work';
          const createdAt = a.createdAt ? new Date(a.createdAt) : new Date();
          const userName = a.userName || 'Anoniem';
          const initials = userName !== 'Anoniem' 
            ? userName.split(/\s+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase() || '').join('')
            : (a.userId || 'AN').split(/[_@.-]/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase() || '').join('');

          return {
            id: a.id,
            user: userName,
            userEmail: a.userEmail || a.userId || '',
            userInitials: initials || 'AN',
            title: a.title || 'Untitled',
            type: 'Audio' as const,
            duration: a.durationMs
              ? `${Math.floor(a.durationMs / 60000)}:${String(Math.floor((a.durationMs % 60000) / 1000)).padStart(2, '0')}`
              : '—',
            score,
            quality,
            status: a.status,
            date: createdAt.toLocaleDateString('nl-NL'),
            time: createdAt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
            techniquesFound: a.techniquesFound || [],
          };
        });

        setUploads(mapped);
      } catch (err: any) {
        console.error('Failed to fetch analyses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, []);

  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch('/api/v2/analysis/list');
        if (res.ok) {
          const data = await res.json();
          const mapped: UploadItem[] = (data.analyses || []).map((a: any) => {
            const score = a.overallScore ?? null;
            const quality = score === null ? 'Pending' :
              score >= 80 ? 'Excellent' :
              score >= 60 ? 'Good' : 'Needs Work';
            const createdAt = a.createdAt ? new Date(a.createdAt) : new Date();
            const userName = a.userName || 'Anoniem';
            const initials = userName !== 'Anoniem' 
              ? userName.split(/\s+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase() || '').join('')
              : (a.userId || 'AN').split(/[_@.-]/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase() || '').join('');
            return {
              id: a.id, user: userName, userEmail: a.userEmail || a.userId || '',
              userInitials: initials || 'AN', title: a.title || 'Untitled',
              type: 'Audio' as const,
              duration: a.durationMs ? `${Math.floor(a.durationMs / 60000)}:${String(Math.floor((a.durationMs % 60000) / 1000)).padStart(2, '0')}` : '—',
              score, quality, status: a.status,
              date: createdAt.toLocaleDateString('nl-NL'),
              time: createdAt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
              techniquesFound: a.techniquesFound || [],
            };
          });
          setUploads(mapped);
        }
      } catch {}
      const hasProcessing = uploadsRef.current.some(u => 
        ['transcribing', 'analyzing', 'evaluating', 'generating_report'].includes(u.status)
      );
      timeoutId = setTimeout(poll, hasProcessing ? 10000 : 60000);
    };
    timeoutId = setTimeout(poll, 15000);
    return () => clearTimeout(timeoutId);
  }, []);

  const stats = {
    totalAnalyses: uploads.length,
    excellentQuality: uploads.filter(u => u.quality === 'Excellent').length,
    avgScore: uploads.filter(u => u.score !== null).length > 0
      ? Math.round(uploads.filter(u => u.score !== null).reduce((sum, u) => sum + (u.score || 0), 0) / uploads.filter(u => u.score !== null).length)
      : 0,
    needsWork: uploads.filter(u => u.quality === 'Needs Work').length,
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortField !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  const openTranscript = (upload: UploadItem) => {
    if (upload.status === 'completed') {
      navigate?.('admin-analysis-results', { conversationId: upload.id, fromAdmin: true });
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const filteredUploads = uploads.filter((upload) => !hiddenIds.has(upload.id)).filter((upload) => {
    if (searchQuery && 
        !upload.user.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !upload.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !upload.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    const processingStatuses = ['transcribing', 'analyzing', 'evaluating', 'generating_report'];
    if (filterStatus === "processing" && !processingStatuses.includes(upload.status)) {
      return false;
    }
    if (filterStatus !== "all" && filterStatus !== "processing" && upload.status !== filterStatus) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (!sortField) return 0;
    let comparison = 0;
    switch (sortField) {
      case "techniqueNumber":
        const aT = a.techniquesFound[0] || '';
        const bT = b.techniquesFound[0] || '';
        comparison = aT.localeCompare(bT);
        break;
      case "techniqueName":
        comparison = a.title.localeCompare(b.title);
        break;
      case "user":
        comparison = a.user.localeCompare(b.user);
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
      case "score":
        comparison = (a.score || 0) - (b.score || 0);
        break;
      case "duration":
        const parseDur = (d: string) => {
          const parts = d.split(':');
          if (parts.length !== 2) return 0;
          return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        comparison = parseDur(a.duration) - parseDur(b.duration);
        break;
      case "date":
        comparison = a.date.localeCompare(b.date);
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredUploads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUploads.map(item => item.id));
    }
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
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Work
          </Badge>
        );
      case "Pending":
        return (
          <Badge className="bg-hh-muted/10 text-hh-muted border-hh-muted/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Audio":
        return <Mic className="w-4 h-4 text-purple-600" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "Audio":
        return "AI Audio";
      default:
        return type;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-hh-success";
    if (score >= 70) return "text-blue-600";
    return "text-hh-warn";
  };

  return (
    <AdminLayout currentPage="admin-uploads" navigate={navigate}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-[24px] sm:text-[32px] leading-[30px] sm:leading-[40px] text-hh-text">
              Gespreksanalyse
            </h1>
            <Button variant="outline" className="gap-2 hidden sm:flex">
              <Download className="w-4 h-4" />
              Export Data
            </Button>
            <Button variant="outline" size="icon" className="sm:hidden">
              <Download className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[14px] sm:text-[16px] leading-[20px] sm:leading-[24px] text-hh-muted mt-1">
            Beheer en analyseer alle geüploade sales gesprekken
          </p>
        </div>

        {/* Statistics - Desktop: full cards, Mobile: compact strip */}
        <div className="hidden lg:grid grid-cols-4 gap-4">
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-600/10 flex items-center justify-center">
                <UploadIcon className="w-5 h-5 text-purple-600" />
              </div>
              <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px] px-2">
                +24%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Totaal Analyses</p>
            <p className="text-[28px] leading-[36px] text-hh-ink">{stats.totalAnalyses}</p>
          </Card>
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-hh-success" />
              </div>
              <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px] px-2">
                43%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Excellent Quality</p>
            <p className="text-[28px] leading-[36px] text-hh-ink">{stats.excellentQuality}</p>
          </Card>
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px] px-2">
                +5%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Gem. Score</p>
            <p className="text-[28px] leading-[36px] text-hh-ink">{stats.avgScore}%</p>
          </Card>
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[11px] px-2">
                15%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Needs Improvement</p>
            <p className="text-[28px] leading-[36px] text-hh-ink">{stats.needsWork}</p>
          </Card>
        </div>

        {/* Mobile: compact horizontal stat strip */}
        <div className="flex lg:hidden items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/10 rounded-lg flex-shrink-0">
            <UploadIcon className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-[12px] text-hh-muted">Totaal</span>
            <span className="text-[14px] font-semibold text-hh-ink">{stats.totalAnalyses}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-hh-success/10 rounded-lg flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-hh-success" />
            <span className="text-[12px] text-hh-muted">Excellent</span>
            <span className="text-[14px] font-semibold text-hh-ink">{stats.excellentQuality}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 rounded-lg flex-shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[12px] text-hh-muted">Score</span>
            <span className="text-[14px] font-semibold text-hh-ink">{stats.avgScore}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/10 rounded-lg flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-[12px] text-hh-muted">Needs Work</span>
            <span className="text-[14px] font-semibold text-hh-ink">{stats.needsWork}</span>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="p-3 sm:p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek op gebruiker, titel, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] sm:w-[180px] flex-shrink-0">
                <SelectValue placeholder="Alle Statussen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Statussen</SelectItem>
                <SelectItem value="completed">Voltooid</SelectItem>
                <SelectItem value="processing">Verwerken</SelectItem>
                <SelectItem value="failed">Mislukt</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden md:flex gap-1 flex-shrink-0">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Mobile Card Fallback */}
        <div className="md:hidden space-y-3">
          {!loading && filteredUploads.map((upload) => (
            <Card
              key={upload.id}
              className="p-4 rounded-[12px] shadow-hh-sm border-hh-border cursor-pointer hover:shadow-hh-md transition-shadow"
              onClick={() => openTranscript(upload)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarFallback className="bg-purple-600/10 text-purple-600 text-[10px] font-semibold">
                      {upload.userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-hh-text truncate">{upload.title}</p>
                    <p className="text-[11px] text-hh-muted truncate">{upload.user}</p>
                  </div>
                </div>
                {upload.score !== null ? (
                  <span className={`text-[16px] font-bold flex-shrink-0 ${getScoreColor(upload.score)}`}>
                    {upload.score}%
                  </span>
                ) : (
                  <Badge className="bg-hh-muted/10 text-hh-muted border-hh-muted/20 text-[10px] flex-shrink-0">
                    {upload.status}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-hh-muted">
                <span>{upload.date}</span>
                <span>{upload.duration}</span>
                {upload.techniquesFound.length > 0 && (
                  <Badge className="bg-purple-600/10 text-purple-600 border-purple-600/20 text-[10px] font-mono px-1.5 py-0">
                    {upload.techniquesFound[0]}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
          {loading && (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[14px] text-hh-muted">Analyses laden...</p>
            </div>
          )}
          {!loading && filteredUploads.length === 0 && (
            <div className="p-8 text-center">
              <UploadIcon className="w-10 h-10 text-hh-muted mx-auto mb-3" />
              <p className="text-[14px] text-hh-muted">Geen analyses gevonden</p>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th className="text-left py-3 px-4 w-12">
                    {selectionMode && (
                      <CustomCheckbox
                        checked={selectedIds.length === filteredUploads.length && filteredUploads.length > 0}
                        onChange={toggleSelectAll}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("techniqueNumber")}
                  >
                    <div className="flex items-center gap-2">
                      #
                      <SortIcon column="techniqueNumber" />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("techniqueName")}
                  >
                    <div className="flex items-center gap-2">
                      Titel
                      <SortIcon column="techniqueName" />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("user")}
                  >
                    <div className="flex items-center gap-2">
                      Gebruiker
                      <SortIcon column="user" />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center gap-2">
                      Type
                      <SortIcon column="type" />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("duration")}
                  >
                    <div className="flex items-center gap-2">
                      Duur
                      <SortIcon column="duration" />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("score")}
                  >
                    <div className="flex items-center gap-2">
                      Score
                      <SortIcon column="score" />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text">
                    Kwaliteit
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-2">
                      Datum
                      <SortIcon column="date" />
                    </div>
                  </th>
                  <th className="text-right px-4 py-3 text-[13px] font-semibold text-hh-text">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && filteredUploads.map((upload, index) => (
                  <tr
                    key={upload.id}
                    onMouseEnter={() => setHoveredRow(upload.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => openTranscript(upload)}
                    className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50/50 transition-colors cursor-pointer ${
                      index % 2 === 0 ? "bg-hh-bg" : "bg-hh-ui-50/30"
                    }`}
                  >
                    <td className="px-4 py-3 w-12" onClick={(e) => e.stopPropagation()}>
                      {(selectionMode || hoveredRow === upload.id) ? (
                        <CustomCheckbox
                          checked={selectedIds.includes(upload.id)}
                          onChange={() => toggleSelectId(upload.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : <div className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3">
                      {upload.techniquesFound.length > 0 ? (
                        <Badge className="bg-purple-600/10 text-purple-600 border-purple-600/20 text-[11px] font-mono">
                          {upload.techniquesFound[0]}
                        </Badge>
                      ) : (
                        <span className="text-[13px] text-hh-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[14px] font-medium text-hh-text">
                          {upload.title}
                        </p>
                        <p className="text-[12px] text-hh-muted">
                          {upload.status}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-purple-600/10 text-purple-600 text-[11px] font-semibold">
                            {upload.userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] font-medium text-hh-text">
                              {upload.user}
                            </p>
                          </div>
                          <p className="text-[12px] text-hh-muted">
                            {upload.userEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(upload.type)}
                        <span className="text-[13px] text-hh-text">{getTypeLabel(upload.type)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-hh-text">{upload.duration}</span>
                    </td>
                    <td className="px-4 py-3">
                      {upload.score !== null ? (
                        <span className={`text-[14px] font-semibold ${getScoreColor(upload.score)}`}>
                          {upload.score}%
                        </span>
                      ) : (
                        <span className="text-[13px] text-hh-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getQualityBadge(upload.quality)}
                    </td>
                    <td className="px-4 py-3 text-[13px] leading-[18px] text-hh-muted">
                      {upload.date}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openTranscript(upload)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Bekijk Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(upload.id)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[16px] text-hh-muted">Analyses laden...</p>
            </div>
          )}

          {!loading && filteredUploads.length === 0 && (
            <div className="p-12 text-center">
              <UploadIcon className="w-12 h-12 text-hh-muted mx-auto mb-4" />
              <p className="text-[16px] text-hh-muted">
                Geen analyses gevonden met deze filters
              </p>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
