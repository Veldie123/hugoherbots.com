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
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
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
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-orange-500";
  return "text-red-500";
}

function getQualityBadge(score: number | null) {
  if (score == null) return <span className="text-[12px] text-hh-muted">-</span>;
  if (score >= 80) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] font-medium">
        Excellent
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px] font-medium">
        Good
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[11px] font-medium">
      Needs Work
    </Badge>
  );
}

export function AdminUploads({ navigate }: AdminUploadsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const SortHeader = ({ label, field, align = "left" }: { label: string; field: SortField; align?: string }) => (
    <th
      className={`text-${align} py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-purple-600 select-none transition-colors`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-purple-600" : "text-hh-muted/50"}`} />
      </span>
    </th>
  );

  return (
    <AdminLayout currentPage="admin-uploads" navigate={navigate}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] sm:text-[32px] leading-[30px] sm:leading-[40px] text-hh-text mb-2">
              Gespreksanalyse
            </h1>
            <p className="text-[13px] sm:text-[16px] leading-[18px] sm:leading-[24px] text-hh-muted">
              Beheer en review alle gespreksanalyses van gebruikers
            </p>
          </div>
          <div className="flex gap-2">
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-purple-300/30 min-h-[120px]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-purple-100">
                <FileAudio className="w-5 h-5 text-purple-600" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                +24%
              </span>
            </div>
            <p className="text-[11px] leading-[14px] text-hh-muted font-medium uppercase tracking-wider mb-1">
              Totaal Analyses
            </p>
            <p className="text-[28px] leading-[34px] text-hh-text font-bold">
              {isLoading ? "-" : stats.total}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-purple-300/30 min-h-[120px]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                +43%
              </span>
            </div>
            <p className="text-[11px] leading-[14px] text-hh-muted font-medium uppercase tracking-wider mb-1">
              Excellent Quality
            </p>
            <p className="text-[28px] leading-[34px] text-hh-text font-bold">
              {isLoading ? "-" : stats.excellent}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-purple-300/30 min-h-[120px]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-purple-100">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                +5%
              </span>
            </div>
            <p className="text-[11px] leading-[14px] text-hh-muted font-medium uppercase tracking-wider mb-1">
              Gem. Score
            </p>
            <p className="text-[28px] leading-[34px] text-hh-text font-bold">
              {isLoading ? "-" : `${stats.avgScore}%`}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-purple-300/30 min-h-[120px]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-100">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                <TrendingDown className="w-3 h-3" />
                -5%
              </span>
            </div>
            <p className="text-[11px] leading-[14px] text-hh-muted font-medium uppercase tracking-wider mb-1">
              Needs Improvement
            </p>
            <p className="text-[28px] leading-[34px] text-hh-text font-bold">
              {isLoading ? "-" : stats.needsImprovement}
            </p>
          </Card>
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

        <Card className="p-4 rounded-[16px] shadow-hh-sm border-purple-300/30">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek analyses, gebruikers, technieken..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 items-center">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="completed">Geanalyseerd</SelectItem>
                  <SelectItem value="processing">Verwerken</SelectItem>
                  <SelectItem value="failed">Mislukt</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border border-purple-200 rounded-lg overflow-hidden">
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

        <Card className="rounded-[16px] shadow-hh-sm border-purple-300/30 overflow-hidden">
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
                <thead className="bg-purple-50/60">
                  <tr>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[50px]">
                      #
                    </th>
                    <SortHeader label="Titel" field="title" />
                    <SortHeader label="Gebruiker" field="userName" />
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Technieken
                    </th>
                    <SortHeader label="Status" field="status" />
                    <SortHeader label="Score" field="score" align="right" />
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Kwaliteit
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Duur
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
                      className="border-t border-purple-100 hover:bg-purple-50/40 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate?.("admin-analysis-results", {
                          conversationId: analysis.id,
                          fromAdmin: true,
                        })
                      }
                    >
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold text-white bg-gradient-to-br from-purple-500 to-emerald-500">
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {analysis.title || "Zonder titel"}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-[12px] font-semibold text-purple-700 shrink-0">
                            {getInitials(analysis.userName || analysis.userId)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] leading-[18px] text-hh-text font-medium truncate">
                              {analysis.userName || analysis.userId}
                            </p>
                            {analysis.userEmail && (
                              <p className="text-[11px] leading-[14px] text-hh-muted truncate">
                                {analysis.userEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[12px] text-purple-600 bg-purple-50 px-2 py-1 rounded-md font-medium">
                          <Mic className="w-3 h-3" />
                          AI Audio
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(analysis.techniquesFound || []).length > 0 ? (
                            analysis.techniquesFound.slice(0, 3).map((tech, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 border-purple-200 text-purple-700 bg-purple-50"
                              >
                                {tech}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[12px] text-hh-muted">-</span>
                          )}
                          {(analysis.techniquesFound || []).length > 3 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-purple-200 text-purple-700 bg-purple-50"
                            >
                              +{analysis.techniquesFound.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(analysis.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {analysis.overallScore != null ? (
                          <span
                            className={`text-[14px] leading-[20px] font-semibold ${getScoreColor(analysis.overallScore)}`}
                          >
                            {analysis.overallScore}%
                          </span>
                        ) : (
                          <span className="text-[14px] leading-[20px] text-hh-muted">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {getQualityBadge(analysis.overallScore)}
                      </td>
                      <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                        {analysis.durationMs ? `${Math.floor(analysis.durationMs / 60000)}:${String(Math.floor((analysis.durationMs % 60000) / 1000)).padStart(2, '0')}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-[13px] leading-[18px] text-hh-muted">
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
              {sortedAnalyses.map((analysis, index) => (
                <Card
                  key={analysis.id}
                  className="p-4 rounded-xl border-purple-200/50 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() =>
                    navigate?.("admin-analysis-results", {
                      conversationId: analysis.id,
                      fromAdmin: true,
                    })
                  }
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold text-white bg-gradient-to-br from-purple-500 to-emerald-500">
                      {index + 1}
                    </span>
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
                  <p className="text-[14px] font-medium text-hh-text mb-2 line-clamp-1">
                    {analysis.title || "Zonder titel"}
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-semibold text-purple-700">
                      {getInitials(analysis.userName || analysis.userId)}
                    </div>
                    <span className="text-[12px] text-hh-muted truncate">
                      {analysis.userName || analysis.userId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium">
                      <Mic className="w-3 h-3" />
                      AI Audio
                    </span>
                    <div className="flex items-center gap-2">
                      {getQualityBadge(analysis.overallScore)}
                      {analysis.overallScore != null && (
                        <span className={`text-[15px] font-bold ${getScoreColor(analysis.overallScore)}`}>
                          {analysis.overallScore}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-100">
                    <div className="flex flex-wrap gap-1">
                      {(analysis.techniquesFound || []).slice(0, 2).map((tech, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-purple-200 text-purple-700 bg-purple-50"
                        >
                          {tech}
                        </Badge>
                      ))}
                      {(analysis.techniquesFound || []).length > 2 && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 border-purple-200 text-purple-700 bg-purple-50"
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
    </AdminLayout>
  );
}
