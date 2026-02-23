import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Check,
  X,
  RefreshCw,
  Zap,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { getCodeBadgeColors } from "../../utils/phaseColors";
import { toast } from "sonner";

interface AdminRAGReviewProps {
  navigate?: (page: string) => void;
  currentPage?: string;
}

interface ChunkForReview {
  id: string;
  source_id: string;
  title: string;
  content_preview: string;
  content: string;
  techniek_id: string | null;
  suggested_techniek_id: string | null;
  review_status: string;
}

interface ReviewStats {
  needsReview: number;
  approved: number;
  rejected: number;
  corrected: number;
  byTechnique: { technique: string; count: number }[];
}

interface TagStats {
  total: number;
  tagged: number;
  untagged: number;
}

export function AdminRAGReview({ navigate, currentPage = "admin-rag-review" }: AdminRAGReviewProps) {
  const [chunks, setChunks] = useState<ChunkForReview[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [tagStats, setTagStats] = useState<TagStats | null>(null);
  const [techniqueNames, setTechniqueNames] = useState<Record<string, string>>({});
  const [selectedTechnique, setSelectedTechnique] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectChunkId, setRejectChunkId] = useState<string | null>(null);
  const [correctTechniqueId, setCorrectTechniqueId] = useState<string>("");

  const getTechniqueName = (id: string | null) => {
    if (!id) return "";
    const name = techniqueNames[id];
    return name ? `${id} - ${name}` : id;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [chunksRes, reviewStatsRes, tagStatsRes, namesRes] = await Promise.all([
        fetch("/api/v2/rag/review?limit=100"),
        fetch("/api/v2/rag/review-stats"),
        fetch("/api/v2/rag/tag-stats"),
        fetch("/api/v2/technieken/names"),
      ]);

      if (!chunksRes.ok || !reviewStatsRes.ok || !tagStatsRes.ok) {
        throw new Error("API error: een of meer endpoints faalden");
      }

      const chunksData = await chunksRes.json();
      const reviewStatsData = await reviewStatsRes.json();
      const tagStatsData = await tagStatsRes.json();
      const namesData = namesRes.ok ? await namesRes.json() : {};

      setChunks(chunksData.chunks || []);
      setReviewStats(reviewStatsData);
      setTechniqueNames(namesData);
      setTagStats(tagStatsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Kon data niet laden");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const runHeuristics = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/v2/rag/suggest-bulk", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Server error");
      }
      const data = await res.json();
      toast.success(`${data.suggested} nieuwe suggesties gegenereerd`);
      loadData();
    } catch (error) {
      toast.error(`Heuristics gefaald: ${error instanceof Error ? error.message : "Onbekende fout"}`);
    }
    setBulkLoading(false);
  };

  const runVideoTagging = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/v2/rag/tag-bulk", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Server error");
      }
      const data = await res.json();
      toast.success(`${data.tagged} chunks getagd van video mapping`);
      loadData();
    } catch (error) {
      toast.error(`Video tagging gefaald: ${error instanceof Error ? error.message : "Onbekende fout"}`);
    }
    setBulkLoading(false);
  };

  const approveChunk = async (id: string) => {
    try {
      const res = await fetch(`/api/v2/rag/approve/${id}`, { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Server error");
      }
      setChunks((prev) => prev.filter((c) => c.id !== id));
      toast.success("Goedgekeurd");
    } catch (error) {
      toast.error(`Goedkeuring gefaald: ${error instanceof Error ? error.message : "Onbekende fout"}`);
    }
  };

  const openRejectDialog = (id: string) => {
    setRejectChunkId(id);
    setCorrectTechniqueId("");
    setRejectDialogOpen(true);
  };

  const rejectChunk = async (withCorrection: boolean) => {
    if (!rejectChunkId) return;
    
    try {
      const body = withCorrection && correctTechniqueId 
        ? JSON.stringify({ newTechniqueId: correctTechniqueId })
        : undefined;
      
      const res = await fetch(`/api/v2/rag/reject/${rejectChunkId}`, { 
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Server error");
      }
      setChunks((prev) => prev.filter((c) => c.id !== rejectChunkId));
      toast.success(withCorrection ? `Gecorrigeerd naar ${correctTechniqueId}` : "Afgekeurd");
      setRejectDialogOpen(false);
      setRejectChunkId(null);
    } catch (error) {
      toast.error(`Afkeuring gefaald: ${error instanceof Error ? error.message : "Onbekende fout"}`);
    }
  };

  const bulkApprove = async (techniqueId: string) => {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/v2/rag/approve-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techniqueId }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Server error");
      }
      const data = await res.json();
      toast.success(`${data.approved} chunks goedgekeurd voor ${techniqueId}`);
      loadData();
    } catch (error) {
      toast.error(`Bulk approve gefaald: ${error instanceof Error ? error.message : "Onbekende fout"}`);
    }
    setBulkLoading(false);
  };

  const filteredChunks =
    selectedTechnique === "all"
      ? chunks
      : chunks.filter((c) => c.suggested_techniek_id === selectedTechnique);

  const uniqueTechniques = [
    ...new Set(chunks.map((c) => c.suggested_techniek_id).filter(Boolean)),
  ] as string[];

  return (
    <AdminLayout navigate={navigate} currentPage={currentPage}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-hh-ink">
              RAG Techniek Review
            </h1>
            <p className="text-sm text-hh-muted mt-1">
              Review en keur gesuggereerde technieken goed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runVideoTagging}
              disabled={bulkLoading}
              className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
            >
              <FileText className="w-4 h-4 mr-2" />
              Video Tagging
            </Button>
            <Button
              size="sm"
              onClick={runHeuristics}
              disabled={bulkLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Zap className="w-4 h-4 mr-2" />
              Run Heuristics
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Ververs
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('/api/v2/rag/export?format=csv', '_blank')}
              className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-hh-muted">Totaal Chunks</span>
              <FileText className="w-4 h-4 text-hh-muted" />
            </div>
            <p className="text-2xl font-semibold mt-2">{tagStats?.total || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-hh-muted">Getagd</span>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-semibold mt-2 text-green-600">
              {tagStats?.tagged || 0}
              <span className="text-sm font-normal text-hh-muted ml-2">
                ({tagStats ? Math.round((tagStats.tagged / tagStats.total) * 100) : 0}%)
              </span>
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-hh-muted">Te Reviewen</span>
              <AlertCircle className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-semibold mt-2 text-orange-600">
              {reviewStats?.needsReview || 0}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-hh-muted">Goedgekeurd</span>
              <Check className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-semibold mt-2 text-purple-600">
              {reviewStats?.approved || 0}
            </p>
          </Card>
        </div>

        {reviewStats && reviewStats.byTechnique.length > 0 && (
          <Card className="p-4">
            <h3 className="font-medium mb-3">Bulk Approve per Techniek</h3>
            <div className="flex flex-wrap gap-2">
              {reviewStats.byTechnique.map((t) => (
                <Button
                  key={t.technique}
                  variant="outline"
                  size="sm"
                  onClick={() => bulkApprove(t.technique)}
                  disabled={bulkLoading}
                  className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10 hover:border-purple-500/40"
                  title={getTechniqueName(t.technique)}
                >
                  <Check className="w-3 h-3 mr-1 text-purple-600" />
                  {getTechniqueName(t.technique)} ({t.count})
                </Button>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Chunks voor Review ({filteredChunks.length})</h3>
            <Select value={selectedTechnique} onValueChange={setSelectedTechnique}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter op techniek" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle technieken</SelectItem>
                {uniqueTechniques.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getTechniqueName(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-hh-muted">Laden...</div>
          ) : filteredChunks.length === 0 ? (
            <div className="text-center py-8 text-hh-muted">
              Geen chunks te reviewen
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredChunks.map((chunk) => {
                const isExpanded = expandedChunkId === chunk.id;
                return (
                  <div
                    key={chunk.id}
                    className="p-3 bg-hh-ui-50 rounded-lg border border-hh-border"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-hh-muted">{chunk.source_id}</span>
                          {chunk.suggested_techniek_id && (
                            <Badge
                              className={`text-xs ${getCodeBadgeColors(
                                chunk.suggested_techniek_id.split(".")[0]
                              )}`}
                              title={getTechniqueName(chunk.suggested_techniek_id)}
                            >
                              {getTechniqueName(chunk.suggested_techniek_id)}
                            </Badge>
                          )}
                        </div>
                        <p 
                          className={`text-sm text-hh-ink ${isExpanded ? '' : 'line-clamp-2'} cursor-pointer`}
                          onClick={() => setExpandedChunkId(isExpanded ? null : chunk.id)}
                        >
                          {isExpanded ? chunk.content : chunk.content_preview}
                        </p>
                        {chunk.content && chunk.content.length > 200 && (
                          <button
                            className="text-xs text-purple-600 hover:text-purple-800 mt-1 flex items-center gap-1"
                            onClick={() => setExpandedChunkId(isExpanded ? null : chunk.id)}
                          >
                            {isExpanded ? (
                              <>Inklappen <ChevronUp className="w-3 h-3" /></>
                            ) : (
                              <>Meer lezen <ChevronDown className="w-3 h-3" /></>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-purple-600 hover:bg-purple-500/10"
                          onClick={() => approveChunk(chunk.id)}
                          title="Goedkeuren"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-500/10"
                          onClick={() => openRejectDialog(chunk.id)}
                          title="Afwijzen of corrigeren"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Suggestie afwijzen</DialogTitle>
              <DialogDescription>
                Wil je alleen afwijzen of de juiste techniek aangeven?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium text-hh-ink mb-2 block">
                Juiste techniek (optioneel)
              </label>
              <Select value={correctTechniqueId} onValueChange={setCorrectTechniqueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer juiste techniek..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {Object.entries(techniqueNames).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {id} - {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => rejectChunk(false)}
                className="border-hh-border"
              >
                Alleen afwijzen
              </Button>
              <Button
                onClick={() => rejectChunk(true)}
                disabled={!correctTechniqueId}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Corrigeren naar {correctTechniqueId || "..."}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
