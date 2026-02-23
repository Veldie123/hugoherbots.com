import {
  Search,
  Download,
  Eye,
  Clock,
  User,
  Calendar,
  Video,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  Upload,
  FileVideo,
  Play,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { roleplayUploadsApi, RoleplayUpload, UploadStats } from "../../services/roleplayUploadsApi";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

interface AdminUploadsProps {
  navigate?: (page: string) => void;
}

interface DisplayUpload {
  id: string;
  user: string;
  userEmail: string;
  title: string;
  techniek: string;
  fase: string;
  duration: string;
  score: number | null;
  quality: string | null;
  status: string;
  date: string;
  fileSize: string;
  feedback: { strengths: string[]; improvements: string[] } | null;
  storagePath?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
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

function mapStatus(status: string): string {
  if (status === "completed") return "analyzed";
  if (["processing", "transcribing", "analyzing"].includes(status)) return "processing";
  if (status === "pending") return "pending";
  if (status === "failed") return "failed";
  return status;
}

function mapUploadToDisplay(upload: RoleplayUpload): DisplayUpload {
  return {
    id: upload.id,
    user: upload.user_name || "Onbekend",
    userEmail: upload.user_email || upload.user_id,
    title: upload.title || upload.file_name,
    techniek: upload.techniek_id || "-",
    fase: upload.fase || "-",
    duration: formatDuration(upload.duration_seconds),
    score: upload.ai_score ?? null,
    quality: upload.ai_quality ?? null,
    status: mapStatus(upload.status),
    date: formatDate(upload.created_at),
    fileSize: formatFileSize(upload.file_size),
    feedback: upload.ai_feedback || null,
    storagePath: upload.storage_path,
  };
}

export function AdminUploads({ navigate }: AdminUploadsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterQuality, setFilterQuality] = useState("all");
  const [selectedUpload, setSelectedUpload] = useState<DisplayUpload | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const [uploads, setUploads] = useState<DisplayUpload[]>([]);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [uploadsResult, statsResult] = await Promise.all([
        roleplayUploadsApi.getAllUploads({
          status: filterStatus,
          quality: filterQuality,
          search: searchQuery,
        }),
        roleplayUploadsApi.getUploadStats(),
      ]);

      if (uploadsResult.error) {
        setError(uploadsResult.error);
      } else {
        setUploads(uploadsResult.data.map(mapUploadToDisplay));
      }

      if (statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (err: any) {
      setError(err.message || "Kon uploads niet laden");
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterQuality, searchQuery]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "analyzed":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Geanalyseerd
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px]">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Verwerken
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[11px]">
            <Clock className="w-3 h-3 mr-1" />
            In Wachtrij
          </Badge>
        );
      default:
        return null;
    }
  };

  const getQualityBadge = (quality: string | null) => {
    if (!quality) return null;
    switch (quality) {
      case "excellent":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px]">
            <ThumbsUp className="w-3 h-3 mr-1" />
            Excellent
          </Badge>
        );
      case "good":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px]">
            <ThumbsUp className="w-3 h-3 mr-1" />
            Goed
          </Badge>
        );
      case "needs-improvement":
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[11px]">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Verbeteren
          </Badge>
        );
      default:
        return null;
    }
  };

  const viewDetails = (upload: any) => {
    setSelectedUpload(upload);
    setShowDetails(true);
  };

  return (
    <AdminLayout currentPage="admin-uploads" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Rollenspel Uploads
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Bekijk en analyseer geüploade rollenspel opnames van gebruikers
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              className="gap-2 text-white"
              style={{ backgroundColor: '#7e22ce' }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#6b21a8')}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#7e22ce')}
              onClick={() => navigate?.("admin-upload-analysis")}
            >
              <Upload className="w-4 h-4" />
              Analyseer gesprek
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                <FileVideo className="w-5 h-5" style={{ color: '#9333ea' }} />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Totaal Uploads
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {isLoading ? "-" : (stats?.total ?? uploads.length)}
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
                  {isLoading ? "-" : (stats?.completed ?? uploads.filter((u) => u.status === "analyzed").length)}
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
                  {isLoading ? "-" : (stats?.processing ?? uploads.filter((u) => u.status === "processing").length)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-hh-warn" />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  In Wachtrij
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {isLoading ? "-" : (stats?.pending ?? uploads.filter((u) => u.status === "pending").length)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Card className="p-4 rounded-[16px] border-red-500/30 bg-red-500/10">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-[14px]">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchUploads} className="ml-auto">
                Opnieuw proberen
              </Button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek uploads, gebruikers, technieken..."
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
                <SelectItem value="analyzed">Geanalyseerd</SelectItem>
                <SelectItem value="processing">Verwerken</SelectItem>
                <SelectItem value="pending">In Wachtrij</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterQuality} onValueChange={setFilterQuality}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Kwaliteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kwaliteit</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Goed</SelectItem>
                <SelectItem value="needs-improvement">Verbeteren</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Uploads Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50">
                <tr>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Gebruiker
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Video
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Techniek
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Duur
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Score
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
                {uploads.map((upload) => (
                  <tr
                    key={upload.id}
                    className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                    onClick={() => viewDetails(upload)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-[11px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }}>
                            {upload.user
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                            {upload.user}
                          </p>
                          <p className="text-[12px] leading-[16px] text-hh-muted">
                            {upload.userEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-hh-muted" />
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {upload.title}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        {upload.techniek}
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        {upload.fase}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                      {upload.duration}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(upload.status)}</td>
                    <td className="py-3 px-4 text-right">
                      {upload.score !== null ? (
                        <span
                          className={`text-[14px] leading-[20px] font-medium ${
                            upload.score >= 80
                              ? "text-emerald-500"
                              : upload.score >= 70
                              ? "text-blue-600"
                              : "text-hh-warn"
                          }`}
                        >
                          {upload.score}%
                        </span>
                      ) : (
                        <span className="text-[14px] leading-[20px] text-hh-muted">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[13px] leading-[18px] text-hh-muted">
                      {upload.date}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewDetails(upload)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Bekijk Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Play className="w-4 h-4 mr-2" />
                            Bekijk Video
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{selectedUpload?.title || "Upload Details"}</span>
              {selectedUpload && (
                <>
                  {getStatusBadge(selectedUpload.status)}
                  {getQualityBadge(selectedUpload.quality)}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedUpload
                ? `${selectedUpload.user} • ${selectedUpload.date} • ${selectedUpload.duration}`
                : "Upload details en AI feedback"}
            </DialogDescription>
          </DialogHeader>

          {selectedUpload && (
            <div className="space-y-6">
              {/* Video Info */}
              <Card className="p-4 rounded-[16px] border-hh-border">
                <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-3">
                  Video Informatie
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[13px] leading-[18px] text-hh-muted">Techniek</p>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      {selectedUpload.techniek}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] leading-[18px] text-hh-muted">Fase</p>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      {selectedUpload.fase}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] leading-[18px] text-hh-muted">Duur</p>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      {selectedUpload.duration}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] leading-[18px] text-hh-muted">Bestandsgrootte</p>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      {selectedUpload.fileSize}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Score */}
              {selectedUpload.score !== null && (
                <Card className="p-4 rounded-[16px] border-hh-border">
                  <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-3">
                    AI Score
                  </h3>
                  <div className="flex items-center gap-4">
                    <div
                      className={`text-[48px] leading-[56px] font-bold ${
                        selectedUpload.score >= 80
                          ? "text-emerald-500"
                          : selectedUpload.score >= 70
                          ? "text-blue-600"
                          : "text-hh-warn"
                      }`}
                    >
                      {selectedUpload.score}%
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-hh-ui-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            selectedUpload.score >= 80
                              ? "bg-emerald-500"
                              : selectedUpload.score >= 70
                              ? "bg-blue-600"
                              : "bg-hh-warn"
                          }`}
                          style={{ width: `${selectedUpload.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* AI Feedback */}
              {selectedUpload.feedback && (
                <Card className="p-4 rounded-[16px] border-hh-border">
                  <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-3">
                    AI Feedback
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[13px] leading-[18px] text-emerald-500 font-medium mb-2 flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4" />
                        Sterke punten:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedUpload.feedback.strengths.map((item: string, i: number) => (
                          <li key={i} className="text-[14px] leading-[20px] text-hh-text">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[13px] leading-[18px] text-hh-warn font-medium mb-2 flex items-center gap-2">
                        <ThumbsDown className="w-4 h-4" />
                        Verbeterpunten:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedUpload.feedback.improvements.map((item: string, i: number) => (
                          <li key={i} className="text-[14px] leading-[20px] text-hh-text">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}

              {/* Pending/Processing State */}
              {selectedUpload.status !== "analyzed" && (
                <Card className="p-6 rounded-[16px] border-hh-border text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                    {selectedUpload.status === "processing" ? (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : (
                      <Clock className="w-6 h-6 text-hh-warn" />
                    )}
                  </div>
                  <h4 className="text-[16px] leading-[22px] text-hh-text font-medium mb-1">
                    {selectedUpload.status === "processing"
                      ? "Video wordt geanalyseerd..."
                      : "In wachtrij voor analyse"}
                  </h4>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    {selectedUpload.status === "processing"
                      ? "De AI analyseert momenteel deze opname. Dit kan enkele minuten duren."
                      : "Deze video staat in de wachtrij en wordt binnenkort geanalyseerd."}
                  </p>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
