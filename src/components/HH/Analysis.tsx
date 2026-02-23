import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Search,
  List,
  LayoutGrid,
  Upload,
  FileAudio,
  Video,
  Clock,
  TrendingUp,
  MoreVertical,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mic,
  BarChart2,
  Trash2,
  RotateCcw,
} from "lucide-react";

import { getCodeBadgeColors } from "../../utils/phaseColors";
import { hideItem, getHiddenIds } from "../../utils/hiddenItems";

interface AnalysisProps {
  navigate?: (page: string, data?: any) => void;
  isAdmin?: boolean;
}

interface ConversationRecord {
  id: string;
  title: string;
  date: string;
  duration: string;
  type: "audio";
  techniquesUsed: string[];
  score: number | null;
  status: "completed" | "transcribing" | "analyzing" | "evaluating" | "generating_report" | "failed";
  phaseCoverage: {
    phase1: number;
    phase2: number;
    phase3: number;
    phase4: number;
    overall: number;
  } | null;
}

export function Analysis({ navigate, isAdmin }: AnalysisProps) {
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<string | null>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => getHiddenIds('user', 'analysis'));

  const handleDelete = (id: string) => {
    hideItem('user', 'analysis', id);
    setHiddenIds(new Set(getHiddenIds('user', 'analysis')));
  };

  const retryAnalysis = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/v2/analysis/retry/${conversationId}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Opnieuw proberen mislukt');
        return;
      }
      const listRes = await fetch('/api/v2/analysis/list?source=upload');
      if (listRes.ok) {
        const data = await listRes.json();
        const mapped: ConversationRecord[] = (data.analyses || []).map((a: any) => ({
          id: a.id,
          title: a.title || 'Untitled',
          date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('nl-NL') : '',
          duration: a.durationMs 
            ? `${Math.floor(a.durationMs / 60000)}:${String(Math.floor((a.durationMs % 60000) / 1000)).padStart(2, '0')}`
            : '—',
          type: 'audio' as const,
          techniquesUsed: a.techniquesFound || [],
          score: a.overallScore ?? null,
          status: a.status === 'completed' ? 'completed' : 
                 a.status === 'failed' ? 'failed' : 
                 a.status as any,
          phaseCoverage: a.phaseCoverage || null,
        }));
        setConversations(mapped);
      }
    } catch (err) {
      alert('Opnieuw proberen mislukt');
    }
  };

  const openTranscript = (conv: ConversationRecord) => {
    if (conv.status === 'completed') {
      navigate?.(isAdmin ? 'admin-analysis-results' : 'analysis-results', { conversationId: conv.id });
    }
  };

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        const res = await fetch('/api/v2/analysis/list?source=upload');
        if (!res.ok) throw new Error('Analyses ophalen mislukt');
        const data = await res.json();
        
        const mapped: ConversationRecord[] = (data.analyses || []).map((a: any) => ({
          id: a.id,
          title: a.title || 'Untitled',
          date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('nl-NL') : '',
          duration: a.durationMs 
            ? `${Math.floor(a.durationMs / 60000)}:${String(Math.floor((a.durationMs % 60000) / 1000)).padStart(2, '0')}`
            : '—',
          type: 'audio' as const,
          techniquesUsed: a.techniquesFound || [],
          score: a.overallScore ?? null,
          status: a.status === 'completed' ? 'completed' : 
                 a.status === 'failed' ? 'failed' : 
                 a.status as any,
          phaseCoverage: a.phaseCoverage || null,
        }));
        
        setConversations(mapped);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch analyses:', err);
        setConversations(prev => {
          if (prev.length === 0) {
            setError(err.message);
          }
          return prev;
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalyses();
  }, []);

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch('/api/v2/analysis/list?source=upload');
        if (res.ok) {
          const data = await res.json();
          const mapped: ConversationRecord[] = (data.analyses || []).map((a: any) => ({
            id: a.id,
            title: a.title || 'Untitled',
            date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('nl-NL') : '',
            duration: a.durationMs 
              ? `${Math.floor(a.durationMs / 60000)}:${String(Math.floor((a.durationMs % 60000) / 1000)).padStart(2, '0')}`
              : '—',
            type: 'audio' as const,
            techniquesUsed: a.techniquesFound || [],
            score: a.overallScore ?? null,
            status: a.status === 'completed' ? 'completed' : 
                   a.status === 'failed' ? 'failed' : 
                   a.status as any,
            phaseCoverage: a.phaseCoverage || null,
          }));
          setConversations(mapped);
        }
      } catch {}
      const hasProcessing = conversationsRef.current.some(c => 
        ['transcribing', 'analyzing', 'evaluating', 'generating_report'].includes(c.status)
      );
      timeoutId = setTimeout(poll, hasProcessing ? 10000 : 60000);
    };
    timeoutId = setTimeout(poll, 15000);
    return () => clearTimeout(timeoutId);
  }, []);

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
      return <ArrowUpDown className="w-3.5 h-3.5 text-hh-muted/40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-hh-ink" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-hh-ink" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px]">
            Geanalyseerd
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[11px]">
            Mislukt
          </Badge>
        );
      case "transcribing":
      case "analyzing":
      case "evaluating":
      case "generating_report":
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[11px]">
            Verwerken...
          </Badge>
        );
      default:
        return (
          <Badge className="bg-hh-muted/10 text-hh-muted border-hh-muted/20 text-[11px]">
            Wachtend
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    return <Mic className="w-4 h-4 text-[#4F7396]" />;
  };

  const getTypeLabel = (type: string) => {
    return "Audio";
  };

  const filteredConversations = conversations.filter((conv) => {
    if (hiddenIds.has(conv.id)) return false;
    const matchesSearch = searchQuery === "" ||
      conv.title.toLowerCase().includes(searchQuery.toLowerCase());
    const processingStatuses = ['transcribing', 'analyzing', 'evaluating', 'generating_report'];
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "processing" ? processingStatuses.includes(conv.status) : conv.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (!sortField) return 0;
    let comparison = 0;
    switch (sortField) {
      case "date":
        comparison = a.date.localeCompare(b.date);
        break;
      case "score":
        comparison = (a.score ?? 0) - (b.score ?? 0);
        break;
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "duration":
        const durationA = parseInt(a.duration.split(':')[0]) * 60 + parseInt(a.duration.split(':')[1]);
        const durationB = parseInt(b.duration.split(':')[0]) * 60 + parseInt(b.duration.split(':')[1]);
        comparison = (isNaN(durationA) ? 0 : durationA) - (isNaN(durationB) ? 0 : durationB);
        break;
      case "technieken":
        comparison = (a.techniquesUsed[0] || "").localeCompare(b.techniquesUsed[0] || "");
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const analyzedCount = conversations.filter(c => c.status === "completed").length;
  const scoredConversations = conversations.filter(c => c.score !== null);
  const avgScore = scoredConversations.length > 0
    ? Math.round(scoredConversations.reduce((sum, c) => sum + (c.score ?? 0), 0) / scoredConversations.length)
    : 0;
  const totalDuration = conversations.reduce((sum, c) => {
    const parts = c.duration.split(':').map(Number);
    const mins = isNaN(parts[0]) ? 0 : parts[0];
    return sum + mins;
  }, 0);

  const Layout = AppLayout;
  const layoutProps = { currentPage: "analysis", navigate, isAdmin };

  return (
    <Layout {...layoutProps}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] sm:text-[32px] leading-[32px] sm:leading-[40px] text-hh-text mb-1">
                Gespreksanalyse
              </h1>
              <p className="text-[14px] sm:text-[16px] leading-[20px] sm:leading-[24px] text-hh-muted">
                Upload gesprekken voor AI-analyse en feedback
              </p>
            </div>
            <Button 
              className="gap-2 text-white shrink-0 hidden sm:flex"
              style={{ backgroundColor: isAdmin ? '#7e22ce' : '#059669' }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = isAdmin ? '#6b21a8' : '#047857')}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = isAdmin ? '#7e22ce' : '#059669')}
              onClick={() => navigate?.("upload-analysis")}
            >
              <Upload className="w-4 h-4 text-white" />
              Analyseer gesprek
            </Button>
          </div>
          <Button 
            className="gap-2 text-white w-full sm:hidden"
            style={{ backgroundColor: isAdmin ? '#7e22ce' : '#059669' }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = isAdmin ? '#6b21a8' : '#047857')}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = isAdmin ? '#7e22ce' : '#059669')}
            onClick={() => navigate?.("upload-analysis")}
          >
            <Upload className="w-4 h-4 text-white" />
            Analyseer gesprek
          </Button>
        </div>

        {/* KPI Stats - compact inline strip on mobile, cards on desktop */}
        <div className="hidden lg:grid grid-cols-4 gap-4">
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-[#4F7396]/10 flex items-center justify-center">
                <FileAudio className="w-5 h-5 text-[#4F7396]" />
              </div>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted mb-2">Totaal Analyses</p>
            <p className="text-[28px] leading-[36px] text-emerald-600">{conversations.length}</p>
          </Card>
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted mb-2">Geanalyseerd</p>
            <p className="text-[28px] leading-[36px] text-emerald-600">{analyzedCount}</p>
          </Card>
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted mb-2">Totale Duur</p>
            <p className="text-[28px] leading-[36px] text-orange-600">{Math.floor(totalDuration / 60)}u {totalDuration % 60}m</p>
          </Card>
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-sky-500" />
              </div>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted mb-2">Gem. Score</p>
            <p className="text-[28px] leading-[36px] text-emerald-600">{avgScore}%</p>
          </Card>
        </div>
        {/* Mobile: compact horizontal stat strip */}
        <div className="flex lg:hidden items-center gap-1 rounded-xl border border-hh-border bg-white p-2.5 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#4F7396]/5 shrink-0">
            <FileAudio className="w-3.5 h-3.5 text-[#4F7396]" />
            <span className="text-[12px] text-hh-muted">Analyses</span>
            <span className="text-[14px] font-semibold text-hh-text">{conversations.length}</span>
          </div>
          <div className="w-px h-5 bg-hh-border shrink-0" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/5 shrink-0">
            <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[12px] text-hh-muted">Klaar</span>
            <span className="text-[14px] font-semibold text-hh-text">{analyzedCount}</span>
          </div>
          <div className="w-px h-5 bg-hh-border shrink-0" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[14px] font-semibold text-hh-text">{Math.floor(totalDuration / 60)}u {totalDuration % 60}m</span>
          </div>
          <div className="w-px h-5 bg-hh-border shrink-0" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/5 shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-[12px] text-hh-muted">Score</span>
            <span className="text-[14px] font-semibold text-emerald-600">{avgScore}%</span>
          </div>
        </div>

        {/* Filters & Search */}
        <Card className="p-3 sm:p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek analyses..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("list")}
                  style={viewMode === "list" ? { backgroundColor: isAdmin ? '#7e22ce' : '#059669', color: 'white' } : {}}
                  className={`hidden md:flex ${viewMode !== "list" ? "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50" : "hover:opacity-90"}`}
                >
                  <List className="w-4 h-4 text-current" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  style={viewMode === "grid" ? { backgroundColor: isAdmin ? '#7e22ce' : '#059669', color: 'white' } : {}}
                  className={`hidden md:flex ${viewMode !== "grid" ? "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50" : "hover:opacity-90"}`}
                >
                  <LayoutGrid className="w-4 h-4 text-current" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-hh-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[16px] text-hh-muted">Analyses laden...</p>
            </div>
          </Card>
        )}

        {/* Error State */}
        {!loading && error && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="p-12 text-center">
              <p className="text-[16px] text-red-500 mb-2">Er is een fout opgetreden</p>
              <p className="text-[14px] text-hh-muted">{error}</p>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!loading && conversations.length === 0 && !error && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="p-12 text-center">
              <FileAudio className="w-12 h-12 text-hh-muted mx-auto mb-4" />
              <p className="text-[16px] leading-[24px] text-hh-text mb-2">Nog geen analyses</p>
              <p className="text-[14px] text-hh-muted mb-4">Upload een gesprek om je eerste analyse te starten</p>
              <Button 
                className="gap-2 text-white"
                style={{ backgroundColor: isAdmin ? '#7e22ce' : '#059669' }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = isAdmin ? '#6b21a8' : '#047857')}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = isAdmin ? '#7e22ce' : '#059669')}
                onClick={() => navigate?.("upload-analysis")}
              >
                <Upload className="w-4 h-4 text-white" />
                Analyseer gesprek
              </Button>
            </div>
          </Card>
        )}

        {/* List View */}
        {!loading && !error && conversations.length > 0 && viewMode === "list" && (
          <Card className="hidden md:block rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th 
                      className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text w-[80px] cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("technieken")}
                    >
                      <div className="flex items-center gap-2">
                        #
                        <SortIcon column="technieken" />
                      </div>
                    </th>
                    <th 
                      className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-2">
                        Titel
                        <SortIcon column="title" />
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text">
                      Technieken
                    </th>
                    <th className="text-left px-4 py-3 text-[13px] font-semibold text-hh-text">
                      Status
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
                  {sortedConversations.map((conv, index) => (
                    <tr
                      key={conv.id}
                      onClick={() => openTranscript(conv)}
                      className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50 transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-white" : "bg-hh-ui-50/30"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span 
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[12px] font-semibold">
                          {conv.techniquesUsed[0] || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {conv.title}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {conv.techniquesUsed.length > 0 ? (
                            <>
                              {conv.techniquesUsed.slice(0, 4).map((tech, idx) => (
                                <span
                                  key={idx}
                                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}
                                  className="inline-flex items-center justify-center min-w-[32px] h-7 px-1.5 rounded-full text-[10px] font-mono font-semibold"
                                >
                                  {tech}
                                </span>
                              ))}
                              {conv.techniquesUsed.length > 4 && (
                                <span className="inline-flex items-center justify-center h-7 px-2 rounded-full text-[10px] font-medium text-hh-muted bg-hh-ui-100">
                                  +{conv.techniquesUsed.length - 4}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-hh-muted text-[12px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(conv.status)}
                      </td>
                      <td className="py-3 px-4">
                        {conv.score !== null ? (
                          <span className={`text-[14px] leading-[20px] font-medium ${
                            conv.score >= 70 ? "text-hh-success" : conv.score >= 50 ? "text-blue-600" : "text-hh-warn"
                          }`}>
                            {Math.round(conv.score)}%
                          </span>
                        ) : (
                          <span className="text-hh-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[14px] leading-[20px] text-hh-text">
                        {conv.duration}
                      </td>
                      <td className="py-3 px-4 text-[13px] leading-[18px] text-hh-muted">
                        {conv.date}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4 text-hh-muted" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openTranscript(conv)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk Details
                            </DropdownMenuItem>
                            {conv.status === 'failed' && (
                              <DropdownMenuItem onClick={() => retryAnalysis(conv.id)}>
                                <RotateCcw className="w-4 h-4 mr-2" style={{ color: isAdmin ? '#7e22ce' : '#059669' }} />
                                Opnieuw proberen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDelete(conv.id)} className="text-red-600 focus:text-red-600">
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

            {sortedConversations.length === 0 && (
              <div className="p-12 text-center">
                <FileAudio className="w-12 h-12 text-hh-muted mx-auto mb-4" />
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  Geen analyses gevonden met deze filters
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Mobile fallback: show cards when list view is selected but screen is small */}
        {!loading && !error && conversations.length > 0 && viewMode === "list" && (
          <div className="md:hidden grid grid-cols-1 gap-3">
            {sortedConversations.map((conv) => (
              <Card
                key={conv.id}
                className="p-4 rounded-xl border-hh-border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openTranscript(conv)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-[15px] font-medium text-hh-text">{conv.title}</h3>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {getStatusBadge(conv.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <MoreVertical className="w-3.5 h-3.5 text-hh-muted" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openTranscript(conv)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Bekijk details
                        </DropdownMenuItem>
                        {conv.status === 'failed' && (
                          <DropdownMenuItem onClick={() => retryAnalysis(conv.id)}>
                            <RotateCcw className="w-4 h-4 mr-2" style={{ color: isAdmin ? '#7e22ce' : '#059669' }} />
                            Opnieuw proberen
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDelete(conv.id)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-hh-muted">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {conv.duration}
                  </div>
                  {conv.score !== null ? (
                    <span className={`font-semibold ${conv.score >= 70 ? "text-hh-success" : conv.score >= 50 ? "text-blue-600" : "text-hh-warn"}`}>
                      {Math.round(conv.score)}%
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                  <span>{conv.date}</span>
                  {conv.techniquesUsed.length > 0 && (
                    <span className="text-emerald-600 font-mono text-[11px]">{conv.techniquesUsed.length} technieken</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Grid View */}
        {!loading && !error && conversations.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedConversations.map((conv) => (
              <Card
                key={conv.id}
                className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openTranscript(conv)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(conv.type)}
                    <span className="text-[12px] text-hh-muted">{getTypeLabel(conv.type)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(conv.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <MoreVertical className="w-3.5 h-3.5 text-hh-muted" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openTranscript(conv)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Bekijk details
                        </DropdownMenuItem>
                        {conv.status === 'failed' && (
                          <DropdownMenuItem onClick={() => retryAnalysis(conv.id)}>
                            <RotateCcw className="w-4 h-4 mr-2" style={{ color: isAdmin ? '#7e22ce' : '#059669' }} />
                            Opnieuw proberen
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDelete(conv.id)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <h3 className="text-[15px] sm:text-[16px] font-medium text-hh-text mb-2">
                  {conv.title}
                </h3>

                {conv.techniquesUsed.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[12px] text-hh-muted">{conv.techniquesUsed.length} technieken</span>
                    <div className="flex gap-1">
                      {conv.techniquesUsed.slice(0, 3).map((tech, idx) => (
                        <span
                          key={idx}
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}
                          className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                        >
                          {tech}
                        </span>
                      ))}
                      {conv.techniquesUsed.length > 3 && (
                        <span className="text-[10px] text-hh-muted font-mono">+{conv.techniquesUsed.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[13px] text-hh-muted pt-3 border-t border-hh-border">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#4F7396]" />
                    {conv.duration}
                  </div>
                  {conv.score !== null ? (
                    <span
                      className={`font-semibold text-[14px] ${
                        conv.score >= 70
                          ? "text-hh-success"
                          : conv.score >= 50
                          ? "text-blue-600"
                          : "text-hh-warn"
                      }`}
                    >
                      {Math.round(conv.score)}%
                    </span>
                  ) : (
                    <span className="text-hh-muted">—</span>
                  )}
                  <span>{conv.date}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
