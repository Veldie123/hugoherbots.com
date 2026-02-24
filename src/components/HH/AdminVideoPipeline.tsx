import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  FolderSync,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  HardDrive,
  FileVideo,
  Mic,
  FileText,
  AlertTriangle,
  Trash2,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
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
import { supabase } from "../../utils/supabase/client";
import { toast } from "sonner";

// Note: Google Drive sync runs via backend/local script, not browser
// Audio files are uploaded after local video-to-audio conversion

interface AdminVideoPipelineProps {
  navigate?: (page: string) => void;
}

interface VideoIngestJob {
  id: string;
  drive_file_id: string;
  drive_file_name: string;
  drive_folder_id: string | null;
  drive_file_size: number | null;
  drive_modified_time: string | null;
  status: string;
  processed_video_url: string | null;
  audio_url: string | null;
  transcript: string | null;
  error_message: string | null;
  retry_count: number;
  video_title: string | null;
  techniek_id: string | null;
  fase: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Wachtend", color: "bg-yellow-500/10 text-yellow-600", icon: Clock },
  downloading: { label: "Downloaden", color: "bg-blue-500/10 text-blue-600", icon: HardDrive },
  processing: { label: "Verwerken", color: "bg-hh-ui-100 text-hh-ink", icon: FileVideo },
  extracting_audio: { label: "Audio extractie", color: "bg-indigo-500/10 text-indigo-600", icon: Mic },
  transcribing: { label: "Transcriberen", color: "bg-cyan-500/10 text-cyan-600", icon: FileText },
  embedding: { label: "RAG embeddings", color: "bg-teal-500/10 text-teal-600", icon: FileText },
  completed: { label: "Voltooid", color: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  failed: { label: "Mislukt", color: "bg-red-500/10 text-red-600", icon: XCircle },
  deleted: { label: "Verwijderd", color: "bg-hh-ui-100 text-hh-muted", icon: Trash2 },
};

export function AdminVideoPipeline({ navigate }: AdminVideoPipelineProps) {
  const [jobs, setJobs] = useState<VideoIngestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [transcriptModal, setTranscriptModal] = useState<{ open: boolean; title: string; content: string }>({
    open: false,
    title: "",
    content: "",
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });
  const [sortColumn, setSortColumn] = useState<'name' | 'status' | 'size' | 'created' | 'completed'>('created');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedJobs = [...jobs].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case 'name':
        const nameA = (a.video_title || a.drive_file_name).toLowerCase();
        const nameB = (b.video_title || b.drive_file_name).toLowerCase();
        comparison = nameA.localeCompare(nameB);
        break;
      case 'status':
        const statusOrder = ['pending', 'downloading', 'processing', 'extracting_audio', 'transcribing', 'embedding', 'completed', 'failed'];
        comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        break;
      case 'size':
        comparison = (a.drive_file_size || 0) - (b.drive_file_size || 0);
        break;
      case 'created':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'completed':
        const dateA = a.processed_at ? new Date(a.processed_at).getTime() : 0;
        const dateB = b.processed_at ? new Date(b.processed_at).getTime() : 0;
        comparison = dateA - dateB;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" /> 
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("video_ingest_jobs")
        .select("*")
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setJobs(data || []);

      const statsCalc = {
        total: data?.length || 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      for (const job of data || []) {
        switch (job.status) {
          case "pending":
            statsCalc.pending++;
            break;
          case "downloading":
          case "processing":
          case "extracting_audio":
          case "transcribing":
          case "embedding":
            statsCalc.processing++;
            break;
          case "completed":
            statsCalc.completed++;
            break;
          case "failed":
            statsCalc.failed++;
            break;
        }
      }
      setStats(statsCalc);
    } catch (err: any) {
      toast.error(`Fout bij laden: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    if (!folderId) {
      setShowConfigDialog(true);
      return;
    }

    setSyncing(true);
    try {
      toast.info("Google Drive synchronisatie gestart...");
      
      const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
      const response = await fetch("/api/video-processor/sync", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${processorSecret}`
        },
        body: JSON.stringify({ folderId })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Sync mislukt");
      }
      
      await fetchJobs();
      
      if (result.added && result.added.length > 0) {
        toast.success(`${result.added.length} video('s) toegevoegd!`);
      } else {
        toast.success("Sync voltooid, geen nieuwe video's gevonden");
      }
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} fout(en) tijdens sync`);
      }
    } catch (err: any) {
      toast.error(`Sync fout: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from("video_ingest_jobs")
        .update({ status: "pending", error_message: null })
        .eq("id", jobId);

      if (error) throw error;
      toast.success("Job opnieuw ingepland");
      await fetchJobs();
    } catch (err: any) {
      toast.error(`Fout: ${err.message}`);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from("video_ingest_jobs")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", jobId);

      if (error) throw error;
      toast.success("Job verwijderd");
      await fetchJobs();
    } catch (err: any) {
      toast.error(`Fout: ${err.message}`);
    }
  };

  const handleProcessVideos = async () => {
    if (stats.pending === 0) {
      toast.info("Geen wachtende video's om te verwerken");
      return;
    }

    setProcessing(true);
    try {
      const processorSecret = import.meta.env.VITE_VIDEO_PROCESSOR_SECRET || "hugo-video-processor-2024";
      const response = await fetch("/api/video-processor/start", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${processorSecret}`
        },
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success("Video verwerking gestart! Dit kan enkele minuten duren.");
        const checkInterval = setInterval(async () => {
          await fetchJobs();
          const statusRes = await fetch("/api/video-processor/status");
          const status = await statusRes.json();
          if (!status.processing) {
            clearInterval(checkInterval);
            setProcessing(false);
            toast.success("Video verwerking voltooid!");
          }
        }, 5000);
      } else {
        toast.error(result.message || "Kon verwerking niet starten");
        setProcessing(false);
      }
    } catch (err: any) {
      toast.error(`Fout: ${err.message}`);
      setProcessing(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout currentPage="admin-pipeline" navigate={navigate}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Video Pipeline
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Automatische video verwerking vanuit Google Drive
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => fetchJobs()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FolderSync className="w-4 h-4 mr-2" />
              )}
              Sync Drive
            </Button>
            <Button 
              onClick={handleProcessVideos} 
              disabled={processing || stats.pending === 0}
              style={{ backgroundColor: '#9333ea' }}
              className=""
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d6080'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9333ea'}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Verwerk video's ({stats.pending})
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
            <div className="text-[14px] text-hh-muted mb-1">Totaal</div>
            <div className="text-[28px] font-semibold text-hh-text">{stats.total}</div>
          </Card>
          <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
            <div className="text-[14px] text-hh-muted mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-yellow-600" />
              Wachtend
            </div>
            <div className="text-[28px] font-semibold text-yellow-600">{stats.pending}</div>
          </Card>
          <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
            <div className="text-[14px] text-hh-muted mb-1 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5" style={{ color: '#9333ea' }} />
              Bezig
            </div>
            <div className="text-[28px] font-semibold" style={{ color: '#9333ea' }}>{stats.processing}</div>
          </Card>
          <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
            <div className="text-[14px] text-hh-muted mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Voltooid
            </div>
            <div className="text-[28px] font-semibold text-emerald-500">{stats.completed}</div>
          </Card>
          <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
            <div className="text-[14px] text-hh-muted mb-1 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              Mislukt
            </div>
            <div className="text-[28px] font-semibold text-red-600">{stats.failed}</div>
          </Card>
        </div>

        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="p-4 border-b border-hh-border bg-hh-ui-50">
            <h3 className="text-[16px] font-medium text-hh-text">
              Video Jobs ({jobs.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: '#9333ea' }} />
              <p className="text-hh-muted">Laden...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center">
              <FolderSync className="w-12 h-12 text-hh-muted mx-auto mb-4" />
              <h3 className="text-[18px] text-hh-text mb-2">Geen video's gevonden</h3>
              <p className="text-hh-muted mb-4">
                Synchroniseer met Google Drive om video's te importeren
              </p>
              <Button onClick={() => setShowConfigDialog(true)}>
                <FolderSync className="w-4 h-4 mr-2" />
                Configureer Google Drive
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th 
                      className="px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:text-hh-text select-none"
                      onClick={() => handleSort('name')}
                    >
                      <span className="flex items-center">Video <SortIcon column="name" /></span>
                    </th>
                    <th 
                      className="px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:text-hh-text select-none"
                      onClick={() => handleSort('status')}
                    >
                      <span className="flex items-center">Status <SortIcon column="status" /></span>
                    </th>
                    <th 
                      className="px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:text-hh-text select-none"
                      onClick={() => handleSort('size')}
                    >
                      <span className="flex items-center">Grootte <SortIcon column="size" /></span>
                    </th>
                    <th 
                      className="px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:text-hh-text select-none"
                      onClick={() => handleSort('created')}
                    >
                      <span className="flex items-center">Aangemaakt <SortIcon column="created" /></span>
                    </th>
                    <th 
                      className="px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:text-hh-text select-none"
                      onClick={() => handleSort('completed')}
                    >
                      <span className="flex items-center">Voltooid <SortIcon column="completed" /></span>
                    </th>
                    <th className="px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hh-border">
                  {sortedJobs.map((job) => {
                    const config = statusConfig[job.status] || statusConfig.pending;
                    const StatusIcon = config.icon;

                    return (
                      <tr key={job.id} className="hover:bg-hh-ui-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.05)' }}>
                              <FileVideo className="w-5 h-5" style={{ color: '#9333ea' }} />
                            </div>
                            <div>
                              <div className="text-[14px] font-medium text-hh-text truncate max-w-[300px]">
                                {job.video_title || job.drive_file_name}
                              </div>
                              {job.error_message && (
                                <div className="text-[12px] text-red-600 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="w-3 h-3" />
                                  {job.error_message.substring(0, 50)}...
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                            {job.retry_count > 0 && (
                              <span className="ml-1 text-[10px]">({job.retry_count}x)</span>
                            )}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-[14px] text-hh-muted">
                          {formatFileSize(job.drive_file_size)}
                        </td>
                        <td className="px-4 py-3 text-[14px] text-hh-muted">
                          {formatDate(job.created_at)}
                        </td>
                        <td className="px-4 py-3 text-[14px] text-hh-muted">
                          {formatDate(job.processed_at)}
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {job.status === "failed" && (
                                <DropdownMenuItem onClick={() => handleRetry(job.id)}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Opnieuw proberen
                                </DropdownMenuItem>
                              )}
                              {job.transcript && (
                                <DropdownMenuItem
                                  onClick={() => setTranscriptModal({
                                    open: true,
                                    title: job.drive_file_name,
                                    content: job.transcript || "",
                                  })}
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  Bekijk transcript
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(job.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Verwijderen
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
          )}
        </Card>
      </div>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Google Drive Configuratie</DialogTitle>
            <DialogDescription>
              Voer de Folder ID in van de Google Drive map met Hugo's video's
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-hh-text">
                Kies een folder of voer handmatig in
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  type="button"
                  variant={folderId === '1Oaww3IMBcFZ1teFvSoqAUART2B6Q6VrT' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFolderId('1Oaww3IMBcFZ1teFvSoqAUART2B6Q6VrT')}
                >
                  Door Hugo geordende videos
                </Button>
              </div>
              <Input
                placeholder="Of voer handmatig een Folder ID in..."
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              />
              <p className="text-[12px] text-hh-muted">
                Tip: "Door Hugo geordende videos" bevat alle gesorteerde video's. 
                De archief folder wordt automatisch overgeslagen.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Annuleren
            </Button>
            <Button
              onClick={() => {
                if (folderId) {
                  setShowConfigDialog(false);
                  handleSync();
                }
              }}
              disabled={!folderId}
            >
              Opslaan & Synchroniseren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transcriptModal.open} onOpenChange={(open: boolean) => setTranscriptModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Transcript: {transcriptModal.title}</DialogTitle>
            <DialogDescription>
              {transcriptModal.content.split(/\s+/).length} woorden
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 border border-hh-border rounded-lg p-4 bg-hh-ui-50" style={{ minHeight: '200px', maxHeight: '50vh' }}>
            <p className="text-[14px] text-hh-text whitespace-pre-wrap leading-relaxed">
              {transcriptModal.content}
            </p>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setTranscriptModal(prev => ({ ...prev, open: false }))}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
