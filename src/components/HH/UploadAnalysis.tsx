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
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  Trash2,
  Eye,
  Download,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Mic,
  MicOff,
  Phone,
  MessageSquare,
  Lock,
  Target,
  Lightbulb,
  Bell,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useUser } from "../../contexts/UserContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { getAllTechnieken, getTechniekByNummer, getFaseNaam } from "../../data/technieken-service";

interface UploadedAnalysis {
  id: string;
  title: string;
  type: "audio" | "video";
  uploadDate: string;
  duration: string;
  status: "processing" | "completed" | "failed";
  overallScore?: number;
  scoreDelta?: "up" | "down" | "neutral";
  topTechnique?: string;
  phase?: string;
}

interface UploadAnalysisProps {
  navigate?: (page: string, data?: any) => void;
  isPreview?: boolean;
  isAdmin?: boolean;
}

export function UploadAnalysis({
  navigate,
  isPreview = false,
  isAdmin = false,
}: UploadAnalysisProps) {
  const { user } = useUser();
  const { addPendingAnalysis } = useNotifications();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<{
    conversationId: string;
    status: string;
    step: string;
  } | null>(() => {
    try {
      const stored = localStorage.getItem('hh_active_analysis');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.conversationId && !['completed', 'failed', 'uploading'].includes(parsed.status)) {
          return parsed;
        }
        localStorage.removeItem('hh_active_analysis');
      }
    } catch {}
    return null;
  });

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRestoredAnalysis = useRef(false);

  useEffect(() => {
    if (analysisStatus && analysisStatus.conversationId && !['uploading', 'completed', 'failed'].includes(analysisStatus.status)) {
      localStorage.setItem('hh_active_analysis', JSON.stringify(analysisStatus));
    }
    if (!analysisStatus || analysisStatus?.status === 'completed' || analysisStatus?.status === 'failed') {
      localStorage.removeItem('hh_active_analysis');
    }
  }, [analysisStatus]);

  useEffect(() => {
    if (analysisStatus && analysisStatus.conversationId && !['completed', 'failed', 'uploading'].includes(analysisStatus.status)) {
      isRestoredAnalysis.current = true;
      setIsUploading(true);
      pollAnalysisStatus(analysisStatus.conversationId);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Live Copilot state
  const [copilotActive, setCopilotActive] = useState(false);
  const [copilotListening, setCopilotListening] = useState(false);
  const [copilotTranscript, setCopilotTranscript] = useState<Array<{ speaker: "you" | "client"; text: string; timestamp: string }>>([]);
  const [copilotTips, setCopilotTips] = useState<Array<{ 
    type: "wedervraag" | "lock" | "waarschuwing" | "open" | "positief"; 
    text: string; 
    timestamp: string;
  }>>([]);

  const analyses: UploadedAnalysis[] = [
    {
      id: "1",
      title: "Discovery call - Acme Inc",
      type: "audio",
      uploadDate: "12 jan 2025",
      duration: "24:18",
      status: "completed",
      overallScore: 78,
      scoreDelta: "up",
      topTechnique: getTechniekByNummer("2.1.2")?.naam || "Meningsgerichte vragen",
      phase: "Fase 2 • Ontdekking",
    },
    {
      id: "2",
      title: "Closing meeting - TechCorp",
      type: "video",
      uploadDate: "10 jan 2025",
      duration: "18:45",
      status: "completed",
      overallScore: 85,
      scoreDelta: "up",
      topTechnique: getTechniekByNummer("4.2.3")?.naam || "Poging tot uitstel",
      phase: "Fase 4 • Afsluiting",
    },
    {
      id: "3",
      title: "Cold call - ScaleUp BV",
      type: "audio",
      uploadDate: "8 jan 2025",
      duration: "12:34",
      status: "processing",
    },
    {
      id: "4",
      title: "Proposal presentation - GrowCo",
      type: "video",
      uploadDate: "5 jan 2025",
      duration: "32:12",
      status: "completed",
      overallScore: 72,
      scoreDelta: "down",
      topTechnique: getTechniekByNummer("3.2")?.naam || "Oplossing",
      phase: "Fase 3 • Voorstel",
    },
    {
      id: "5",
      title: "Follow-up call - SalesForce",
      type: "audio",
      uploadDate: "3 jan 2025",
      duration: "15:23",
      status: "failed",
    },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
    console.log('🎯 Drag over detected');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    console.log('🚫 Drag leave');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    console.log('📥 File dropped:', { 
      name: file?.name, 
      type: file?.type, 
      size: file?.size 
    });
    
    if (file) {
      // Check for iCloud placeholder files
      if (file.name.endsWith('.icloud')) {
        setUploadError('Dit is een iCloud placeholder bestand. Download eerst het echte bestand van iCloud naar je Mac (rechtsklik → Download Now).');
        console.log('❌ iCloud placeholder detected');
        return;
      }
      
      const isValidType = isValidFileType(file);
      const isValidSize = isValidFileSize(file);
      console.log('🔍 Validation results:', { isValidType, isValidSize });
      
      if (isValidType && isValidSize) {
        setSelectedFile(file);
        setUploadError(null);
        console.log('✅ File accepted:', file.name);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('📂 File selected from input:', { 
      name: file?.name, 
      type: file?.type, 
      size: file?.size 
    });
    
    if (file) {
      // Check for iCloud placeholder files
      if (file.name.endsWith('.icloud')) {
        setUploadError('Dit is een iCloud placeholder bestand. Download eerst het echte bestand van iCloud naar je Mac (rechtsklik → Download Now).');
        console.log('❌ iCloud placeholder detected');
        return;
      }
      
      const isValidType = isValidFileType(file);
      const isValidSize = isValidFileSize(file);
      console.log('🔍 Validation results:', { isValidType, isValidSize });
      
      if (isValidType && isValidSize) {
        setSelectedFile(file);
        setUploadError(null);
        console.log('✅ File accepted:', file.name);
      }
    }
  };

  const isValidFileType = (file: File) => {
    const validTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/m4a",
      "audio/mp4",      // M4A files often have this MIME type
      "audio/x-m4a",    // Alternative M4A MIME type
      "video/mp4",
      "video/quicktime",
    ];
    
    // Check both MIME type AND file extension (fallback for browsers with incorrect MIME detection)
    const hasValidMimeType = validTypes.includes(file.type);
    const hasValidExtension = file.name.match(/\.(mp3|wav|m4a|mp4|mov)$/i);
    
    const isValid = hasValidMimeType || hasValidExtension;
    
    if (!isValid) {
      setUploadError('Alleen audio (MP3, WAV, M4A) en video (MP4, MOV) bestanden zijn toegestaan');
      console.log('❌ Invalid file:', { type: file.type, name: file.name });
    } else {
      console.log('✅ Valid file type:', { type: file.type, name: file.name, mimeMatch: hasValidMimeType, extMatch: !!hasValidExtension });
    }
    
    return isValid;
  };

  const isValidFileSize = (file: File) => {
    const maxSize = 100 * 1024 * 1024; // 100MB limit
    if (file.size > maxSize) {
      setUploadError(`Bestand is te groot. Maximum: 100MB (jouw bestand: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return false;
    }
    return true;
  };

  const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks (under proxy limit)

  const uploadChunked = async (file: File, userId: string): Promise<any> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    setAnalysisStatus({
      conversationId: '',
      status: 'uploading',
      step: 'Uploaden... (0%)',
    });

    const initRes = await fetch('/api/v2/analysis/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        mimetype: file.type,
      }),
    });
    if (!initRes.ok) {
      const err = await initRes.json();
      throw new Error(err.error || 'Upload initialiseren mislukt');
    }
    const { uploadId } = await initRes.json();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk, `chunk_${i}`);
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(i));

      const chunkRes = await fetch('/api/v2/analysis/upload/chunk', {
        method: 'POST',
        body: formData,
      });
      if (!chunkRes.ok) {
        const err = await chunkRes.json();
        throw new Error(err.error || `Chunk ${i + 1} upload mislukt`);
      }

      const progress = Math.round(((i + 1) / totalChunks) * 100);
      setAnalysisStatus({
        conversationId: '',
        status: 'uploading',
        step: `Uploaden... (${progress}%)`,
      });
    }

    setAnalysisStatus({
      conversationId: '',
      status: 'uploading',
      step: 'Bestand samenvoegen & comprimeren...',
    });

    const completeRes = await fetch('/api/v2/analysis/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        title,
        context,
        userId,
        consentConfirmed: 'true',
      }),
    });

    const result = await completeRes.json();
    if (!completeRes.ok) {
      throw new Error(result.error || 'Upload afronden mislukt');
    }
    return result;
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) return;
    
    if (!consentConfirmed) {
      setUploadError('Je moet toestemming bevestigen voordat je kunt uploaden');
      return;
    }
    
    if (isPreview || !user) {
      setUploadError('Log in om bestanden te uploaden');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setAnalysisStatus({
      conversationId: '',
      status: 'uploading',
      step: 'Uploaden...',
    });

    try {
      let result: any;

      if (selectedFile.size > CHUNK_SIZE) {
        result = await uploadChunked(selectedFile, user.id);
      } else {
        setAnalysisStatus({
          conversationId: '',
          status: 'uploading',
          step: `Uploaden & comprimeren...`,
        });

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title);
        formData.append('context', context);
        formData.append('userId', user.id);
        formData.append('consentConfirmed', 'true');

        const response = await fetch('/api/v2/analysis/upload', {
          method: 'POST',
          body: formData,
        });

        result = await response.json();

        if (!response.ok) {
          setUploadError(result.error || 'Upload mislukt');
          setIsUploading(false);
          setAnalysisStatus(null);
          return;
        }
      }

      setAnalysisStatus({
        conversationId: result.conversationId,
        status: result.status,
        step: 'Transcriberen...',
      });

      addPendingAnalysis(result.conversationId, title);
      pollAnalysisStatus(result.conversationId);
    } catch (err: any) {
      setUploadError(err.message || 'Er ging iets mis bij het uploaden');
      setIsUploading(false);
      setAnalysisStatus(null);
    }
  };

  const pollAnalysisStatus = (conversationId: string) => {
    const statusLabels: Record<string, string> = {
      'transcribing': 'Transcriberen...',
      'analyzing': 'Turns analyseren...',
      'evaluating': 'EPIC technieken evalueren...',
      'generating_report': 'Rapport genereren...',
      'completed': 'Analyse voltooid!',
      'failed': 'Analyse mislukt',
    };

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v2/analysis/status/${conversationId}`);
        if (response.status === 404) {
          clearInterval(interval);
          pollIntervalRef.current = null;
          setIsUploading(false);
          setAnalysisStatus(null);
          localStorage.removeItem('hh_active_analysis');
          return;
        }
        const data = await response.json();

        setAnalysisStatus({
          conversationId,
          status: data.status,
          step: statusLabels[data.status] || data.status,
        });

        if (data.status === 'completed') {
          clearInterval(interval);
          pollIntervalRef.current = null;
          setIsUploading(false);
          setSelectedFile(null);
          setTitle("");
          setContext("");
          setConsentConfirmed(false);
          
          if (isRestoredAnalysis.current) {
            isRestoredAnalysis.current = false;
            setAnalysisStatus(null);
            localStorage.removeItem('hh_active_analysis');
          } else if (navigate) {
            navigate(isAdmin ? "admin-analysis-results" : "analysis-results", { conversationId });
          }
        } else if (data.status === 'failed') {
          clearInterval(interval);
          pollIntervalRef.current = null;
          setIsUploading(false);
          setUploadError(data.error || 'Analyse mislukt');
          setAnalysisStatus(null);
        }
      } catch (err) {
        clearInterval(interval);
        pollIntervalRef.current = null;
        setIsUploading(false);
        setUploadError('Kon de status niet ophalen');
      }
    }, 3000);

    pollIntervalRef.current = interval;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-hh-success" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-hh-primary animate-spin" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-hh-destructive" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Analyse compleet";
      case "processing":
        return "Analyseren...";
      case "failed":
        return "Analyse mislukt";
      default:
        return status;
    }
  };

  return (
    <AppLayout currentPage="upload-analysis" navigate={navigate} isAdmin={isAdmin}>
      <div className="flex">
        
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
            Gesprek Analyse
          </h1>
          <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
            Upload een rollenspel of echt klantgesprek en krijg gedetailleerde
            EPIC analyse van Hugo.
          </p>
        </div>

        {/* 2 Main Action Blocks - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upload Section */}
          <Card className="p-6 rounded-[16px] border-hh-border hover:border-hh-primary/40 hover:shadow-lg hover:bg-hh-ui-50/30 transition-all">
            <div className="mb-5">
              <h2 className="text-[24px] leading-[30px] text-hh-text font-semibold mb-2">
                Upload Rollenspel
              </h2>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Audio/video • EPIC analyse
              </p>
            </div>

            {/* Drag & Drop Zone */}
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-[12px] p-8 text-center transition-colors cursor-pointer block ${
                isDragging
                  ? "border-hh-primary bg-hh-primary/5"
                  : "border-hh-border hover:border-hh-primary/50"
              }`}
            >
              <input
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
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
                    onClick={(e: React.MouseEvent) => { e.preventDefault(); setSelectedFile(null); }}
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
                      <span className="text-hh-primary hover:underline">
                        browse
                      </span>
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Audio: MP3, WAV, M4A • Video: MP4, MOV • Max 100MB
                    </p>
                  </div>
                </div>
              )}
            </label>

            {analysisStatus && (
              <div className="mt-6 p-5 rounded-xl bg-hh-ui-50 border border-hh-border shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  {analysisStatus.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-hh-success" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-hh-primary animate-spin" />
                  )}
                  <span className="text-[16px] leading-[24px] font-semibold text-hh-text">
                    {analysisStatus.step}
                  </span>
                </div>
                <div className="flex gap-1.5 mb-3">
                  {['uploading', 'transcribing', 'analyzing', 'evaluating', 'generating_report', 'completed'].map((step, i) => {
                    const steps = ['uploading', 'transcribing', 'analyzing', 'evaluating', 'generating_report', 'completed'];
                    const currentIndex = steps.indexOf(analysisStatus.status);
                    const isActive = currentIndex >= i;
                    return (
                      <div
                        key={step}
                        className="h-2 flex-1 rounded-full transition-all duration-500"
                        style={{ backgroundColor: isActive ? '#3C9A6E' : 'var(--hh-ui-200)' }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[11px] text-hh-muted">
                  <span>Upload</span>
                  <span>Transcriptie</span>
                  <span>Analyse</span>
                  <span>Evaluatie</span>
                  <span>Rapport</span>
                  <span>Klaar</span>
                </div>
                {analysisStatus.status !== 'completed' && (
                  <p className="text-[12px] leading-[18px] text-hh-muted mt-3 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    Je kan gerust verder werken — je krijgt een melding via het belletje rechtsboven zodra de analyse klaar is.
                  </p>
                )}
              </div>
            )}

            {selectedFile && !analysisStatus && (
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

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(e) => setConsentConfirmed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-hh-border text-hh-primary focus:ring-hh-primary"
                  />
                  <span className={`text-[13px] leading-[18px] ${consentConfirmed ? 'text-hh-text' : 'text-hh-muted'}`}>
                    Ik bevestig dat ik toestemming heb van alle betrokkenen voor het uploaden en verwerken van dit gesprek.
                  </span>
                </label>

                {!analysisStatus && (
                  <Button
                    onClick={handleUpload}
                    disabled={!title.trim() || isUploading || !consentConfirmed}
                    className="w-full sm:w-auto gap-2 text-white"
                    style={{ backgroundColor: '#3C9A6E' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#2D7F57')}
                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#3C9A6E')}
                  >
                    <Upload className="w-4 h-4" />
                    Start analyse
                  </Button>
                )}
                {uploadError && (
                  <p className="text-[14px] leading-[20px] text-hh-destructive mt-2">
                    {uploadError}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Live Copilot - Real-time Coaching */}
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
                  // Start demo mode
                  setCopilotListening(true);
                  // Simulate initial transcript
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
                  // Stop
                  setCopilotListening(false);
                  setCopilotTranscript([]);
                  setCopilotTips([]);
                }
              }}
              variant={copilotActive ? "destructive" : "default"}
              className={`w-full h-11 gap-2 ${!copilotActive ? 'text-white' : ''}`}
              style={!copilotActive ? { backgroundColor: '#3C9A6E' } : {}}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!copilotActive) e.currentTarget.style.backgroundColor = '#2D7F57'; }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!copilotActive) e.currentTarget.style.backgroundColor = '#3C9A6E'; }}
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
                {/* Status Bar */}
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

                {/* Live Tips from Hugo */}
                {copilotTips.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[13px] leading-[18px] text-hh-muted">Hugo's Tips</h4>
                    {copilotTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border-l-4 ${
                          tip.type === "wedervraag"
                            ? "bg-blue-500/10 border-blue-500"
                            : tip.type === "lock"
                            ? "bg-purple-500/10 border-purple-500"
                            : tip.type === "waarschuwing"
                            ? "bg-red-500/10 border-red-500"
                            : tip.type === "open"
                            ? "bg-teal-500/10 border-teal-500"
                            : "bg-green-500/10 border-green-500"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            {tip.type === "wedervraag" && (
                              <MessageSquare className="w-4 h-4 text-blue-600" />
                            )}
                            {tip.type === "lock" && (
                              <Lock className="w-4 h-4 text-purple-600" />
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

                {/* Live Transcript */}
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

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      // Simulate adding more transcript + tip
                      setCopilotTranscript(prev => [...prev, 
                        { speaker: "you", text: "Wat zijn jullie grootste uitdagingen op dit moment?", timestamp: "14:24" }
                      ]);
                      setCopilotTips(prev => [...prev,
                        { type: "positief", text: "Perfecte open vraag! Laat de klant nu praten.", timestamp: "14:24" }
                      ]);
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                    Test Open Vraag
                  </Button>
                  <Button
                    onClick={() => {
                      setCopilotTips(prev => [...prev,
                        { type: "lock", text: "Dus als ik het goed begrijp, zoek je een manier om leads sneller op te volgen?", timestamp: "14:25" }
                      ]);
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    Test Lock
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Privacy Notice - Applies to both Upload and Live Analysis */}
        <div className="p-4 rounded-[12px] bg-hh-warn/10 border border-hh-warn/20">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-hh-warn flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] leading-[20px] text-hh-text mb-1">
                <strong>Privacy & toestemming</strong>
              </p>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Upload alleen gesprekken waarvoor je toestemming hebt van alle
                betrokkenen. Bij echte klantgesprekken: vraag expliciet
                toestemming voor opname en verwerking. Zie ons{" "}
                <button className="text-hh-primary hover:underline">
                  privacy beleid
                </button>
                .
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </AppLayout>
  );
}