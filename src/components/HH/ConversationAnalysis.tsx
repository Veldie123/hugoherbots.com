import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Upload,
  FileAudio,
  FileVideo,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Mic,
  MicOff,
  MessageSquare,
  Lock,
  Target,
  Lightbulb,
  Search,
  ChevronLeft,
  FileText,
  Timer,
  ListTodo,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "../../contexts/UserContext";
import { roleplayUploadsApi, RoleplayUpload, UploadStats } from "../../services/roleplayUploadsApi";

interface ConversationAnalysisProps {
  navigate?: (page: string, data?: any) => void;
  isPreview?: boolean;
  isAdmin?: boolean;
}

export function ConversationAnalysis({
  navigate,
  isPreview = false,
  isAdmin,
}: ConversationAnalysisProps) {
  const { user } = useUser();
  const [showUploadView, setShowUploadView] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [uploads, setUploads] = useState<RoleplayUpload[]>([]);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [copilotActive, setCopilotActive] = useState(false);
  const [copilotListening, setCopilotListening] = useState(false);
  const [copilotTranscript, setCopilotTranscript] = useState<Array<{ speaker: "you" | "client"; text: string; timestamp: string }>>([]);
  const [copilotTips, setCopilotTips] = useState<Array<{ 
    type: "wedervraag" | "lock" | "waarschuwing" | "open" | "positief"; 
    text: string; 
    timestamp: string;
  }>>([]);

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uploadsResult, statsResult] = await Promise.all([
        isAdmin ? roleplayUploadsApi.getAllUploads() : roleplayUploadsApi.getUserUploads(),
        roleplayUploadsApi.getUploadStats()
      ]);
      
      if (uploadsResult.data) {
        setUploads(uploadsResult.data);
      }
      if (statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setIsLoading(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.name.endsWith('.icloud')) {
        setUploadError('Dit is een iCloud placeholder bestand. Download eerst het echte bestand van iCloud naar je Mac (rechtsklik → Download Now).');
        return;
      }
      
      const isValidType = isValidFileType(file);
      const isValidSize = isValidFileSize(file);
      
      if (isValidType && isValidSize) {
        setSelectedFile(file);
        setUploadError(null);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.icloud')) {
        setUploadError('Dit is een iCloud placeholder bestand. Download eerst het echte bestand van iCloud naar je Mac (rechtsklik → Download Now).');
        return;
      }
      
      const isValidType = isValidFileType(file);
      const isValidSize = isValidFileSize(file);
      
      if (isValidType && isValidSize) {
        setSelectedFile(file);
        setUploadError(null);
      }
    }
  };

  const isValidFileType = (file: File) => {
    const validTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/m4a",
      "audio/mp4",
      "audio/x-m4a",
      "video/mp4",
      "video/quicktime",
    ];
    
    const hasValidMimeType = validTypes.includes(file.type);
    const hasValidExtension = file.name.match(/\.(mp3|wav|m4a|mp4|mov)$/i);
    
    const isValid = hasValidMimeType || hasValidExtension;
    
    if (!isValid) {
      setUploadError('Alleen audio (MP3, WAV, M4A) en video (MP4, MOV) bestanden zijn toegestaan');
    }
    
    return isValid;
  };

  const isValidFileSize = (file: File) => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`Bestand is te groot. Maximum: 50MB (jouw bestand: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return false;
    }
    return true;
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) return;
    
    if (isPreview || !user) {
      setUploadError('Log in om bestanden te uploaden');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const { data, error } = await roleplayUploadsApi.uploadRoleplay(selectedFile, {
        title: title.trim(),
        description: context.trim() || undefined,
      });

      if (error) {
        setUploadError(error);
        setIsUploading(false);
        return;
      }
      
      setSelectedFile(null);
      setTitle("");
      setContext("");
      setIsUploading(false);
      
      loadData();
      setShowUploadView(false);
      
      if (navigate && data) {
        navigate(isAdmin ? "admin-analysis-results" : "analysis-results", { id: data.id, status: "processing" });
      }
    } catch (err) {
      setUploadError('Er ging iets mis bij het uploaden');
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-0 font-medium gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Geanalyseerd
          </Badge>
        );
      case "processing":
      case "transcribing":
      case "analyzing":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-0 font-medium gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verwerken
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-0 font-medium gap-1.5">
            <Clock className="w-3 h-3" />
            Wachtrij
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 border-0 font-medium gap-1.5">
            <AlertCircle className="w-3 h-3" />
            Mislukt
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-700 border-0 font-medium">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredUploads = uploads.filter(upload => {
    const searchLower = searchQuery.toLowerCase();
    return (
      upload.file_name?.toLowerCase().includes(searchLower) ||
      upload.title?.toLowerCase().includes(searchLower)
    );
  });

  const kpiStats = {
    totaal: stats?.total || 0,
    geanalyseerd: stats?.completed || 0,
    verwerken: stats?.processing || 0,
    wachtrij: stats?.pending || 0,
  };

  if (!showUploadView) {
    return (
      <AppLayout currentPage="analysis" navigate={navigate} isAdmin={isAdmin}>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="mb-1 text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px] font-semibold text-hh-text">
                Rollenspel Uploads
              </h1>
              <p className="text-[14px] leading-[22px] text-hh-muted">
                {isAdmin ? 'Beheer alle geüploade rollenspellen' : 'Jouw geüploade rollenspellen en analyses'}
              </p>
            </div>
            <Button
              onClick={() => setShowUploadView(true)}
              className="gap-2 bg-hh-primary hover:bg-hh-primary/90"
            >
              <Upload className="w-4 h-4" />
              Upload nieuw
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 rounded-[16px] border-hh-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-600" />
                </div>
              </div>
              <div className="text-[28px] leading-[34px] font-semibold text-hh-text">
                {isLoading ? '-' : kpiStats.totaal}
              </div>
              <div className="text-[13px] leading-[18px] text-hh-muted">Totaal</div>
            </Card>

            <Card className="p-4 rounded-[16px] border-hh-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <div className="text-[28px] leading-[34px] font-semibold text-hh-text">
                {isLoading ? '-' : kpiStats.geanalyseerd}
              </div>
              <div className="text-[13px] leading-[18px] text-hh-muted">Geanalyseerd</div>
            </Card>

            <Card className="p-4 rounded-[16px] border-hh-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="text-[28px] leading-[34px] font-semibold text-hh-text">
                {isLoading ? '-' : kpiStats.verwerken}
              </div>
              <div className="text-[13px] leading-[18px] text-hh-muted">Verwerken</div>
            </Card>

            <Card className="p-4 rounded-[16px] border-hh-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div className="text-[28px] leading-[34px] font-semibold text-hh-text">
                {isLoading ? '-' : kpiStats.wachtrij}
              </div>
              <div className="text-[13px] leading-[18px] text-hh-muted">Wachtrij</div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek op bestandsnaam..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card className="rounded-[16px] border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-hh-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-hh-muted">Bestandsnaam</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-hh-muted">Status</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-hh-muted">Datum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hh-border bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-hh-muted mb-2" />
                        <p className="text-hh-muted text-[14px]">Laden...</p>
                      </td>
                    </tr>
                  ) : filteredUploads.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center">
                        <p className="text-hh-muted text-[14px]">
                          {searchQuery ? 'Geen uploads gevonden' : 'Nog geen uploads'}
                        </p>
                        {!searchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowUploadView(true)}
                            className="mt-3 gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            Upload je eerste rollenspel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredUploads.map((upload) => (
                      <tr 
                        key={upload.id} 
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => {
                          if (upload.status === 'completed') {
                            navigate?.(isAdmin ? "admin-analysis-results" : "analysis-results", { id: upload.id });
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {upload.file_type?.startsWith("audio") ? (
                              <FileAudio className="w-5 h-5 text-hh-muted flex-shrink-0" />
                            ) : (
                              <FileVideo className="w-5 h-5 text-hh-muted flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-[14px] text-hh-text font-medium truncate">
                                {upload.title || upload.file_name}
                              </div>
                              {upload.title && (
                                <div className="text-[12px] text-hh-muted truncate">
                                  {upload.file_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(upload.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="text-[14px] text-hh-text">{formatDate(upload.created_at)}</div>
                            <div className="text-[12px] text-hh-muted">{formatTime(upload.created_at)}</div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="analysis" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <div>
          <button
            onClick={() => setShowUploadView(false)}
            className="flex items-center gap-1.5 text-hh-muted hover:text-hh-text mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-[14px]">Terug naar overzicht</span>
          </button>
          <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
            Gesprek Analyse
          </h1>
          <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
            Upload een rollenspel of echt klantgesprek en krijg gedetailleerde
            EPIC analyse van Hugo.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6 rounded-[16px] border-hh-border hover:border-hh-primary/40 hover:shadow-lg hover:bg-hh-ui-50/30 transition-all">
            <div className="mb-5">
              <h2 className="text-[24px] leading-[30px] text-hh-text font-semibold mb-2">
                Upload Rollenspel
              </h2>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Audio/video • EPIC analyse
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-[12px] p-8 text-center transition-colors ${
                isDragging
                  ? "border-hh-primary bg-hh-primary/5"
                  : "border-hh-border hover:border-hh-primary/50"
              }`}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    {selectedFile.type.startsWith("audio") ? (
                      <FileAudio className="w-12 h-12 text-hh-primary" />
                    ) : (
                      <FileVideo className="w-12 h-12 text-hh-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-hh-text mb-1">{selectedFile.name}</p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Verwijder
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-hh-muted mx-auto" />
                  <div>
                    <p className="text-hh-text mb-2">
                      Sleep een bestand hier of{" "}
                      <label className="text-hh-primary hover:underline cursor-pointer">
                        browse
                        <input
                          type="file"
                          accept="audio/*,video/*"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Audio: MP3, WAV, M4A • Video: MP4, MOV • Max 50MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="title">Titel gesprek *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Bijv. Discovery call - Acme Inc"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="context">
                    Context (optioneel maar aanbevolen)
                  </Label>
                  <Textarea
                    id="context"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Beschrijf de situatie: Wat was het doel? In welke fase? Met wie sprak je? Dit helpt Hugo's analyse scherper te maken."
                    className="mt-1.5 min-h-[100px]"
                  />
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!title.trim() || isUploading}
                  className="w-full sm:w-auto gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploaden & analyseren...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Start analyse
                    </>
                  )}
                </Button>
                {uploadError && (
                  <p className="text-[14px] leading-[20px] text-hh-destructive mt-2">
                    {uploadError}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 rounded-[16px] border-hh-border hover:border-hh-primary/40 hover:shadow-lg hover:bg-hh-ui-50/30 transition-all">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-hh-primary" />
                <h2 className="text-[24px] leading-[30px] text-hh-text font-semibold">
                  Live Analyse
                </h2>
              </div>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Real-time coaching tijdens gesprekken
              </p>
            </div>

            <div className="mb-6">
              <div className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Status
              </div>
              <div className="text-[18px] leading-[24px] text-hh-text font-semibold mb-1">
                {copilotActive ? "Live aan het luisteren" : "Klaar om te starten"}
              </div>
              <div className="text-[13px] leading-[18px] text-hh-muted">
                Hugo luistert mee en geeft real-time tips
              </div>
            </div>

            <Button
              onClick={() => {
                setCopilotActive(!copilotActive);
                if (!copilotActive) {
                  setCopilotListening(true);
                  setTimeout(() => {
                    setCopilotTranscript([
                      { speaker: "you", text: "Hoi, bedankt voor je tijd. Ik wilde even sparren over jullie CRM uitdagingen.", timestamp: "14:23" },
                      { speaker: "client", text: "Ja natuurlijk, we zitten inderdaad met wat problemen.", timestamp: "14:23" }
                    ]);
                    setCopilotTips([
                      { type: "open", text: "Probeer nu een open vraag te stellen om het probleem te verkennen (Techniek 2.1.2)", timestamp: "14:23" }
                    ]);
                  }, 1500);
                } else {
                  setCopilotListening(false);
                  setCopilotTranscript([]);
                  setCopilotTips([]);
                }
              }}
              variant={copilotActive ? "destructive" : "default"}
              className="w-full h-11 gap-2"
            >
              {copilotActive ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Stop coaching
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Start live coaching
                </>
              )}
            </Button>

            {copilotActive && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-hh-ui-50">
                  <div className="flex items-center gap-2">
                    {copilotListening ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-hh-success animate-pulse" />
                        <span className="text-[12px] leading-[16px] text-hh-text">Listening...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-hh-muted" />
                        <span className="text-[12px] leading-[16px] text-hh-muted">Paused</span>
                      </>
                    )}
                  </div>
                  <div className="h-4 w-px bg-hh-ui-200" />
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-hh-muted" />
                    <span className="text-[12px] leading-[16px] text-hh-muted">2:34</span>
                  </div>
                </div>

                {copilotTips.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[13px] leading-[18px] text-hh-muted">Hugo's Tips</h4>
                    {copilotTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border-l-4 ${
                          tip.type === "wedervraag"
                            ? "bg-blue-50 border-blue-500"
                            : tip.type === "lock"
                            ? "bg-slate-50 border-hh-primary"
                            : tip.type === "waarschuwing"
                            ? "bg-red-50 border-red-500"
                            : tip.type === "open"
                            ? "bg-teal-50 border-teal-500"
                            : "bg-green-50 border-green-500"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            {tip.type === "wedervraag" && (
                              <MessageSquare className="w-4 h-4 text-blue-600" />
                            )}
                            {tip.type === "lock" && (
                              <Lock className="w-4 h-4 text-hh-primary" />
                            )}
                            {tip.type === "waarschuwing" && (
                              <Target className="w-4 h-4 text-red-600" />
                            )}
                            {tip.type === "open" && (
                              <Lightbulb className="w-4 h-4 text-teal-600" />
                            )}
                            {tip.type === "positief" && (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] leading-[17px] text-hh-text">
                              <strong>
                                {tip.type === "wedervraag"
                                  ? "Wedervraag:"
                                  : tip.type === "lock"
                                  ? "Lock!:"
                                  : tip.type === "waarschuwing"
                                  ? "Let op:"
                                  : tip.type === "open"
                                  ? "Verdiep:"
                                  : "Goed bezig:"}
                              </strong>{" "}
                              {tip.text}
                            </p>
                            <span className="text-[10px] leading-[14px] text-hh-muted">{tip.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {copilotTranscript.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[13px] leading-[18px] text-hh-muted">Live Transcript</h4>
                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 rounded-lg bg-hh-ui-50">
                      {copilotTranscript.map((line, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-[11px] leading-[16px] text-hh-muted flex-shrink-0">
                            {line.timestamp}
                          </span>
                          <p className="text-[12px] leading-[17px] text-hh-text flex-1">
                            <strong className={line.speaker === "you" ? "text-hh-primary" : "text-hh-text"}>
                              {line.speaker === "you" ? "Jij:" : "Klant:"}
                            </strong>{" "}
                            {line.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-5 rounded-[16px] border-hh-border bg-white">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-[15px] leading-[22px] font-semibold text-hh-text mb-1">
                Privacy & toestemming
              </h3>
              <p className="text-[14px] leading-[22px] text-hh-muted">
                Upload alleen gesprekken waarvoor je toestemming hebt van alle betrokkenen. 
                Bij echte klantgesprekken: vraag expliciet toestemming voor opname en verwerking. 
                Zie ons{" "}
                <button
                  onClick={() => navigate?.("privacy-policy")}
                  className="text-hh-primary hover:underline font-medium"
                >
                  privacy beleid
                </button>.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
