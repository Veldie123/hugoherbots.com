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
  turnCount: number;
}

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

export function AdminUploads({ navigate }: AdminUploadsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v2/analysis/list");
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

  const stats = {
    total: analyses.length,
    completed: analyses.filter((a) => a.status === "completed").length,
    processing: analyses.filter((a) =>
      ["processing", "transcribing", "analyzing"].includes(a.status)
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
              variant="outline"
              size="sm"
              onClick={fetchAnalyses}
              className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Vernieuwen</span>
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(147, 51, 234, 0.1)" }}
              >
                <FileAudio className="w-5 h-5" style={{ color: "#9333ea" }} />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Totaal Analyses
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {isLoading ? "-" : stats.total}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Geanalyseerd
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {isLoading ? "-" : stats.completed}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Verwerken
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {isLoading ? "-" : stats.processing}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(147, 51, 234, 0.1)" }}
              >
                <BarChart3 className="w-5 h-5" style={{ color: "#9333ea" }} />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Gem. Score
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {isLoading ? "-" : `${stats.avgScore}%`}
                </p>
              </div>
            </div>
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

        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek analyses, gebruikers, technieken..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
          </div>
        </Card>

        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-hh-muted">Analyses laden...</p>
              </div>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="p-12 text-center">
              <FileAudio className="w-12 h-12 text-hh-muted mx-auto mb-4 opacity-40" />
              <p className="text-hh-muted text-[14px]">
                {searchQuery || filterStatus !== "all"
                  ? "Geen analyses gevonden met deze filters"
                  : "Nog geen analyses beschikbaar"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Titel
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Technieken
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Score
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Duur
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Datum
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyses.map((analysis) => (
                    <tr
                      key={analysis.id}
                      className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate?.("admin-analysis-results", {
                          conversationId: analysis.id,
                          fromAdmin: true,
                        })
                      }
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                            {analysis.title || "Zonder titel"}
                          </p>
                          <p className="text-[12px] leading-[16px] text-hh-muted">
                            {analysis.userName || analysis.userId}
                          </p>
                        </div>
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
                            className={`text-[14px] leading-[20px] font-medium ${
                              analysis.overallScore >= 80
                                ? "text-emerald-500"
                                : analysis.overallScore >= 60
                                ? "text-blue-600"
                                : "text-hh-warn"
                            }`}
                          >
                            {analysis.overallScore}%
                          </span>
                        ) : (
                          <span className="text-[14px] leading-[20px] text-hh-muted">
                            -
                          </span>
                        )}
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
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
