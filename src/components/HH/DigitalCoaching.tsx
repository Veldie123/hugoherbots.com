import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Play,
  CheckCircle2,
  Lock,
  Clock,
  TrendingUp,
  MessageSquare,
  Video as VideoIcon,
  Search,
  Calendar,
  Filter,
  X,
  BarChart,
  Target,
  Lightbulb,
  Phone,
  Mic,
  MicOff,
  Send,
  Volume2,
  Sparkles,
  Menu,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { EPIC_TECHNIQUES, getTechniquesByPhase, getPhaseLabel } from "../../data/epicTechniques";

interface SessionHistory {
  id: string;
  datum: string;
  tijd: string;
  type: "video" | "chat" | "roleplay";
  duration: string;
  score?: number;
}

interface TechniqueDetail {
  id: string;
  name: string;
  nummer: string;
  fase: string;
  faseNaam: string;
  status: "completed" | "current" | "upcoming" | "locked";
  duration: string;
  description: string;
  doList: string[];
  dontList: string[];
  sessieHistory: SessionHistory[];
  totalAttempts: number;
  avgScore: number;
  lastPlayed?: string;
  unlockRequirement?: string;
}

interface DigitalCoachingProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

type TrainingMode = "roleplay" | "videocursus" | null;
type RoleplayMode = "chat" | "audio" | "video";
type VideoOverlay = "chat" | "voice" | "video" | null;

export function DigitalCoaching({ navigate, isAdmin = false }: DigitalCoachingProps) {
  const [selectedFase, setSelectedFase] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueDetail | null>(null);
  
  // Training mode state
  const [activeTrainingMode, setActiveTrainingMode] = useState<TrainingMode>(null);
  const [roleplayMode, setRoleplayMode] = useState<RoleplayMode>("chat"); // WhatsApp-style mode switching
  const [activeTechnique, setActiveTechnique] = useState<TechniqueDetail | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "coach"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  
  // Video overlay state (chat/voice/video while video keeps playing)
  const [videoOverlay, setVideoOverlay] = useState<VideoOverlay>(null);
  
  // E.P.I.C. Sales Flow drawer state (mobile only)
  const [flowDrawerOpen, setFlowDrawerOpen] = useState(false);
  
  // Refs for scrolling to techniques
  const techniqueRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Generate all techniques from EPIC data
  const allTechniques: TechniqueDetail[] = EPIC_TECHNIQUES.map((tech, index) => {
    // Determine status based on technique number
    let status: "completed" | "current" | "upcoming" | "locked" = "upcoming";
    
    // Fase 1 techniques are completed
    if (tech.fase === "1") {
      status = "completed";
    }
    // First 2 techniques of Fase 2 are completed
    else if (tech.fase === "2") {
      const fase2Techniques = getTechniquesByPhase("2");
      const indexInPhase = fase2Techniques.findIndex(t => t.nummer === tech.nummer);
      if (indexInPhase === 0 || indexInPhase === 1) {
        status = "completed";
      } else if (indexInPhase === 2) {
        status = "current";
      } else {
        status = "upcoming";
      }
    }
    // Fase 3 and 4 are locked
    else if (tech.fase === "3" || tech.fase === "4") {
      status = "locked";
    }

    // Generate mock session history for completed techniques
    const sessieHistory: SessionHistory[] = status === "completed" 
      ? [
          { 
            id: `s${index}`, 
            datum: "14 nov 2024", 
            tijd: "14:32", 
            type: "video" as const, 
            duration: "12:45", 
            score: 85 + Math.floor(Math.random() * 10) 
          },
        ]
      : [];

    const totalAttempts = status === "completed" ? 3 + Math.floor(Math.random() * 10) : (status === "current" ? 2 : 0);
    const avgScore = status === "completed" ? 80 + Math.floor(Math.random() * 15) : (status === "current" ? 76 : 0);

    return {
      id: tech.detector_id,
      name: tech.naam,
      nummer: tech.nummer,
      fase: tech.fase,
      faseNaam: getPhaseLabel(tech.fase),
      status,
      duration: `${8 + Math.floor(Math.random() * 8)} min`,
      description: tech.ai_eval_points?.[0] || "Leer deze belangrijke salestechniek van Hugo.",
      doList: [
        "Oefen met echte scenario's",
        "Let op de timing van je vragen",
        "Luister actief naar de klant"
      ],
      dontList: [
        "Praat te veel",
        "Vergeet de context",
        "Negeer signalen van de klant"
      ],
      sessieHistory,
      totalAttempts,
      avgScore,
      lastPlayed: status === "completed" ? "14 nov 2024" : undefined,
      unlockRequirement: status === "locked" 
        ? `Voltooi ${tech.fase === "3" ? "fase 2" : tech.fase === "4" ? "fase 3" : "vorige technieken"} volledig`
        : status === "upcoming" 
        ? `Voltooi ${tech.nummer.split('.')[0]}.${Number(tech.nummer.split('.')[tech.nummer.split('.').length - 1]) - 1} met minimaal 80%`
        : undefined,
    };
  });

  // Calculate overall stats
  const totalTechniques = allTechniques.length;
  const completedTechniques = allTechniques.filter((t) => t.status === "completed").length;
  const overallProgress = Math.round((completedTechniques / totalTechniques) * 100);

  const totalSessions = allTechniques.reduce((acc, t) => acc + t.totalAttempts, 0);

  const techniquesWithScore = allTechniques.filter((t) => t.totalAttempts > 0);
  const avgOverallScore = techniquesWithScore.length
    ? Math.round(
        techniquesWithScore.reduce((acc, t) => acc + t.avgScore, 0) / techniquesWithScore.length
      )
    : 0;

  // Filter techniques
  const filteredTechniques = allTechniques.filter((technique) => {
    const matchesFase = selectedFase === "all" || technique.fase === selectedFase;
    const matchesStatus = selectedStatus === "all" || technique.status === selectedStatus;
    const matchesSearch =
      searchQuery === "" ||
      technique.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      technique.nummer.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFase && matchesStatus && matchesSearch;
  });

  const openDetails = (technique: TechniqueDetail) => {
    setSelectedTechnique(technique);
    setDetailsOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-hh-success" />;
      case "current":
        return (
          <div className="w-5 h-5 rounded-full bg-hh-primary flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
        );
      case "upcoming":
        return <div className="w-5 h-5 rounded-full border-2 border-hh-ui-200" />;
      case "locked":
        return <Lock className="w-5 h-5 text-hh-muted" />;
      default:
        return null;
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-hh-success/10 text-hh-success border-hh-success/20";
    if (score >= 60) return "bg-hh-warn/10 text-hh-warn border-hh-warn/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  // Scroll to first technique of a phase
  const scrollToPhase = (phaseId: string) => {
    setSelectedFase("all");
    setSelectedStatus("all");
    setSearchQuery("");
    
    setTimeout(() => {
      const firstTechniqueOfPhase = allTechniques.find((t) => t.fase === phaseId);
      if (firstTechniqueOfPhase && techniqueRefs.current[firstTechniqueOfPhase.id]) {
        techniqueRefs.current[firstTechniqueOfPhase.id]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 100);
  };

  // Start training session
  const startTraining = (mode: TrainingMode, technique: TechniqueDetail) => {
    setActiveTrainingMode(mode);
    setActiveTechnique(technique);
    setDetailsOpen(false);
    setSessionTimer(0);
    
    if (mode === "roleplay") {
      setRoleplayMode("chat"); // Always start in chat mode
      setChatMessages([
        { role: "coach", text: `Hey! Klaar om ${technique.name} te oefenen? Ik speel de klant, jij bent de verkoper. Start maar!` }
      ]);
      setChatInput("");
    }
  };

  // Close training session
  const closeTraining = () => {
    setActiveTrainingMode(null);
    setActiveTechnique(null);
    setChatMessages([]);
    setIsRecording(false);
    setIsVideoPlaying(false);
  };

  // Send chat message
  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: "user" as const, text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    
    // Simulate coach response
    setTimeout(() => {
      const responses = [
        "Interessant, maar waarom zou ik daar tijd in investeren?",
        "Dat klinkt mooi, maar kan je dat ook bewijzen?",
        "Ik begrijp het, maar we hebben al een leverancier.",
        "Wat maakt jullie dan anders dan de concurrent?",
        "Hmm, ik zie het nog niet helemaal zitten...",
      ];
      const coachResponse = {
        role: "coach" as const,
        text: responses[Math.floor(Math.random() * responses.length)]
      };
      setChatMessages(prev => [...prev, coachResponse]);
    }, 1500);
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Session timer
  useEffect(() => {
    if (activeTrainingMode) {
      const interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTrainingMode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Render training interface
  const renderTrainingInterface = () => {
    if (!activeTrainingMode || !activeTechnique) return null;

    return (
      <div className="h-full flex flex-col bg-hh-bg">
        {/* Training Header */}
        <div className="p-3 sm:p-4 border-b border-hh-border bg-white">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <Badge className="bg-teal-100 text-teal-600 border-0 text-[9px] sm:text-[10px] flex-shrink-0 rounded-full px-2">{activeTechnique.nummer}</Badge>
              <h3 className="text-[14px] sm:text-[16px] leading-[20px] sm:leading-[24px] text-hh-text truncate">{activeTechnique.name}</h3>
            </div>
            
            {/* WhatsApp-style mode switcher for roleplay */}
            {activeTrainingMode === "roleplay" && (
              <div className="flex items-center gap-1 mr-2">
                {roleplayMode !== "chat" && (
                  <button
                    onClick={() => setRoleplayMode("chat")}
                    className="p-2 rounded-lg transition-colors text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                    title="Chat mode"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                )}
                {roleplayMode !== "video" && (
                  <button
                    onClick={() => setRoleplayMode("video")}
                    className="p-2 rounded-lg transition-colors text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                    title="Video call"
                  >
                    <VideoIcon className="w-5 h-5" />
                  </button>
                )}
                {roleplayMode !== "audio" && (
                  <button
                    onClick={() => setRoleplayMode("audio")}
                    className="p-2 rounded-lg transition-colors text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                    title="Audio call"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Video overlay mode switcher */}
            {activeTrainingMode === "videocursus" && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={() => setVideoOverlay(videoOverlay === "chat" ? null : "chat")}
                  className={`p-2 rounded-lg transition-colors ${videoOverlay === "chat" ? "bg-hh-ocean-blue text-white" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}`}
                  title="Chat met Hugo"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setVideoOverlay(videoOverlay === "video" ? null : "video")}
                  className={`p-2 rounded-lg transition-colors ${videoOverlay === "video" ? "bg-hh-primary text-white" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}`}
                  title="Video call"
                >
                  <VideoIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setVideoOverlay(videoOverlay === "voice" ? null : "voice")}
                  className={`p-2 rounded-lg transition-colors ${videoOverlay === "voice" ? "bg-green-600 text-white" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}`}
                  title="Voice call"
                >
                  <Phone className="w-5 h-5" />
                </button>
              </div>
            )}
            
            <button
              onClick={closeTraining}
              className="text-hh-muted hover:text-hh-text p-1.5 sm:p-2 rounded-lg hover:bg-hh-ui-50 transition-colors flex-shrink-0"
              aria-label="Sluit training"
            >
              <X className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-[13px]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-hh-muted" />
              <span className="text-hh-text">{formatTime(sessionTimer)}</span>
            </div>
            <div className="flex items-center gap-2">
              {activeTrainingMode === "roleplay" && roleplayMode === "chat" && <MessageSquare className="w-4 h-4 text-hh-primary" />}
              {activeTrainingMode === "roleplay" && roleplayMode === "audio" && <Mic className="w-4 h-4 text-hh-success" />}
              {activeTrainingMode === "roleplay" && roleplayMode === "video" && <VideoIcon className="w-4 h-4 text-hh-warn" />}
              {activeTrainingMode === "videocursus" && <Play className="w-4 h-4 text-hh-primary" />}
              <span className="text-hh-muted capitalize">
                {activeTrainingMode === "roleplay" ? roleplayMode : activeTrainingMode}
              </span>
            </div>
          </div>
        </div>

        {/* Training Content */}
        <div className="flex-1 overflow-hidden">
          {activeTrainingMode === "roleplay" && roleplayMode === "chat" && (
            <div className="h-full flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-hh-primary text-white"
                          : "bg-hh-ui-100 text-hh-text"
                      }`}
                    >
                      <p className="text-[14px] leading-[20px]">{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input - WhatsApp style */}
              <div className="p-4 border-t border-hh-border bg-white">
                <div className="flex gap-2 items-end">
                  <Input
                    placeholder="Type je antwoord..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                    className="flex-1"
                  />
                  {/* Show mic button when empty, send button when typing */}
                  {chatInput.trim() ? (
                    <Button onClick={sendChatMessage} className="flex-shrink-0">
                      <Send className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        // Toggle voice recording
                        setIsRecording(!isRecording);
                      }}
                      className={`flex-shrink-0 ${isRecording ? 'bg-red-50 border-red-500 text-red-600' : ''}`}
                    >
                      {isRecording ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
                {/* Recording indicator */}
                {isRecording && (
                  <div className="mt-2 flex items-center gap-2 text-red-600 text-[13px]">
                    <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    <span>Aan het opnemen... Spreek je antwoord in</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTrainingMode === "roleplay" && roleplayMode === "audio" && (
            <div className="h-full relative bg-gradient-to-br from-teal-900 via-teal-800 to-teal-900">
              {/* Top section - Name & Status */}
              <div className="absolute top-12 left-0 right-0 text-center">
                <div className="mb-8">
                  {/* Hugo's Avatar */}
                  <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-4 flex items-center justify-center">
                    <div className="w-28 h-28 rounded-full bg-hh-primary flex items-center justify-center">
                      <span className="text-white text-[40px] leading-[48px]">HH</span>
                    </div>
                  </div>

                  <h3 className="text-white text-[24px] leading-[32px] mb-2">Hugo Herbots</h3>
                  <p className="text-white/70 text-[16px] leading-[24px]">{formatTime(sessionTimer)}</p>
                </div>

                {/* Waveform visualization - simulated */}
                <div className="flex items-center justify-center gap-1 h-16 px-8 mt-12">
                  {[...Array(30)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full bg-white/60 transition-all"
                      style={{
                        height: isRecording
                          ? `${Math.random() * 60 + 20}%`
                          : "20%",
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Real-time tip */}
                {isRecording && chatMessages.length > 0 && (
                  <div className="px-6 mt-8">
                    <div className="p-4 rounded-xl bg-black/40 backdrop-blur-md border border-white/10">
                      <div className="flex gap-2">
                        <Sparkles className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
                        <p className="text-[13px] leading-[18px] text-white">
                          <strong>Tip:</strong> {selectedTechnique ? `Focus op ${selectedTechnique.name}` : 'Kies een techniek om te oefenen'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom controls - Phone call style */}
              <div className="absolute bottom-12 left-0 right-0">
                <div className="flex items-center justify-center gap-6 mb-6">
                  {/* Mute toggle */}
                  <div className="text-center">
                    <button
                      onClick={() => setIsRecording(!isRecording)}
                      className={`w-16 h-16 rounded-full ${
                        isRecording
                          ? "bg-white/20 backdrop-blur-sm"
                          : "bg-white/40 backdrop-blur-sm"
                      } hover:bg-white/30 transition-colors flex items-center justify-center mb-2`}
                    >
                      {isRecording ? (
                        <Mic className="w-6 h-6 text-white" />
                      ) : (
                        <MicOff className="w-6 h-6 text-white" />
                      )}
                    </button>
                    <span className="text-white/80 text-[12px]">
                      {isRecording ? "Mute" : "Unmute"}
                    </span>
                  </div>

                  {/* Speaker toggle */}
                  <div className="text-center">
                    <button
                      className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors flex items-center justify-center mb-2"
                    >
                      <Volume2 className="w-6 h-6 text-white" />
                    </button>
                    <span className="text-white/80 text-[12px]">Speaker</span>
                  </div>

                  {/* End call */}
                  <div className="text-center">
                    <button
                      onClick={closeTraining}
                      className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center mb-2 shadow-xl"
                    >
                      <Phone className="w-6 h-6 text-white rotate-[135deg]" />
                    </button>
                    <span className="text-white/80 text-[12px]">End</span>
                  </div>
                </div>

                {/* Recent transcript (last message) */}
                {chatMessages.length > 0 && (
                  <div className="px-8">
                    <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                      <p className="text-white/90 text-[13px] leading-[18px] text-center">
                        <strong>
                          {chatMessages[chatMessages.length - 1].role === "coach" ? "Hugo: " : "Jij: "}
                        </strong>
                        {chatMessages[chatMessages.length - 1].text.substring(0, 100)}
                        {chatMessages[chatMessages.length - 1].text.length > 100 && "..."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTrainingMode === "roleplay" && roleplayMode === "video" && (
            <div className="h-full relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
              {/* Hugo's video - Full screen background */}
              <div className="absolute inset-0">
                <div className="size-full bg-gradient-to-br from-hh-primary/20 to-slate-900 flex items-center justify-center">
                  {/* Placeholder for HeyGen video */}
                  <div className="w-48 h-48 rounded-full bg-hh-primary flex items-center justify-center">
                    <span className="text-white text-[64px] leading-[72px]">HH</span>
                  </div>
                </div>
              </div>

              {/* Top overlay - Name & Timer */}
              <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent">
                <h3 className="text-white text-[20px] leading-[28px] mb-1">Hugo Herbots</h3>
                <p className="text-white/70 text-[14px] leading-[20px]">{formatTime(sessionTimer)}</p>
              </div>

              {/* Your video - Small PiP (Picture in Picture) */}
              <div className="absolute top-6 right-6 w-32 h-40 rounded-2xl bg-slate-700 border-2 border-white/20 overflow-hidden shadow-2xl">
                <div className="size-full flex items-center justify-center bg-slate-800">
                  <div className="w-16 h-16 rounded-full bg-hh-ui-100 flex items-center justify-center">
                    <span className="text-hh-text text-[14px] leading-[20px]">JIJ</span>
                  </div>
                </div>
              </div>

              {/* Real-time tip overlay */}
              {chatMessages.length > 0 && selectedTechnique && (
                <div className="absolute top-1/3 left-6 right-6">
                  <div className="p-4 rounded-xl bg-black/80 backdrop-blur-md border border-white/10">
                    <div className="flex gap-2">
                      <Sparkles className="w-4 h-4 text-hh-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] leading-[17px] text-white">
                          <strong>Tip:</strong> Focus op {selectedTechnique.name} ({selectedTechnique.nummer})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom controls - WhatsApp style */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                <div className="flex items-center justify-center gap-4">
                  {/* Mute/Unmute */}
                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors flex items-center justify-center"
                  >
                    {isRecording ? (
                      <Mic className="w-6 h-6 text-white" />
                    ) : (
                      <MicOff className="w-6 h-6 text-white" />
                    )}
                  </button>

                  {/* Switch camera (placeholder) */}
                  <button
                    className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors flex items-center justify-center"
                  >
                    <VideoIcon className="w-6 h-6 text-white" />
                  </button>

                  {/* End call */}
                  <button
                    onClick={closeTraining}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center shadow-xl"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>

                <div className="flex items-center justify-center gap-8 mt-4 text-white/80 text-[12px]">
                  <span>Mute</span>
                  <span>Flip</span>
                  <span>End</span>
                </div>
              </div>
            </div>
          )}

          {activeTrainingMode === "videocursus" && (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900">
              {/* Video Player - Simple instructional video */}
              <div className="w-full max-w-4xl aspect-video bg-slate-800 rounded-2xl overflow-hidden relative shadow-2xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-[16px] opacity-70">Video cursus laadt...</p>
                    <p className="text-[13px] opacity-50 mt-2">HeyGen video player wordt hier geïntegreerd</p>
                  </div>
                </div>
              </div>

              {/* Video info below */}
              <div className="mt-6 text-center max-w-2xl">
                <h3 className="text-white text-[20px] leading-[28px] mb-2">
                  {selectedTechnique ? `${selectedTechnique.name} Masterclass` : 'Techniek Masterclass'}
                </h3>
                <p className="text-white/70 text-[14px] leading-[20px]">
                  {selectedTechnique ? `Leer hoe je ${selectedTechnique.name} (${selectedTechnique.nummer}) toepast in je sales gesprekken` : 'Bekijk de video om deze techniek te leren'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout 
      currentPage="coaching" 
      navigate={navigate}
      isAdmin={isAdmin}
      onOpenFlowDrawer={activeTrainingMode ? () => setFlowDrawerOpen(true) : undefined}
    >
      {/* Split Screen Layout - Responsive */}
      <div className="flex h-full">
        {/* Left Panel - Techniques List (Hidden on mobile when training) */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-y-auto ${
            activeTrainingMode 
              ? "hidden lg:block lg:w-[40%]" // Hide on mobile, 40% on desktop
              : "w-full" // Full width when no training
          }`}
        >
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header with Stats */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              {/* Header */}
              <div>
                <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
                  Digital Coaching
                </h1>
                <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                  Train elke techniek met video of Talk to Hugo<sup>AI</sup>
                </p>
              </div>

              {/* Compact Stats - Hide during training & on mobile */}
              {!activeTrainingMode && (
                <div className="hidden lg:grid grid-cols-3 gap-3 w-full lg:w-auto lg:flex-shrink-0">
                  <Card 
                    className="p-3 rounded-[12px] shadow-hh-sm border-hh-border cursor-pointer hover:border-hh-primary/40 hover:shadow-md transition-all active:scale-[0.98]"
                    onClick={() => navigate?.("analytics")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-hh-success flex-shrink-0" />
                      <p className="text-[11px] text-hh-muted truncate">Voortg.</p>
                    </div>
                    <p className="text-[20px] leading-[28px] text-hh-text">{overallProgress}%</p>
                  </Card>

                  <Card 
                    className="p-3 rounded-[12px] shadow-hh-sm border-hh-border cursor-pointer hover:border-hh-primary/40 hover:shadow-md transition-all active:scale-[0.98]"
                    onClick={() => navigate?.("analytics")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Play className="w-3.5 h-3.5 text-hh-primary flex-shrink-0" />
                      <p className="text-[11px] text-hh-muted truncate">Sessies</p>
                    </div>
                    <p className="text-[20px] leading-[28px] text-hh-text">{totalSessions}</p>
                  </Card>

                  <Card 
                    className="p-3 rounded-[12px] shadow-hh-sm border-hh-border cursor-pointer hover:border-hh-primary/40 hover:shadow-md transition-all active:scale-[0.98]"
                    onClick={() => navigate?.("analytics")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-hh-warn flex-shrink-0" />
                      <p className="text-[11px] text-hh-muted truncate">Score</p>
                    </div>
                    <p className="text-[20px] leading-[28px] text-hh-text">{avgOverallScore}%</p>
                  </Card>
                </div>
              )}
            </div>

            {/* E.P.I.C. Sales Flow - Full Width */}
            <Card className="p-4 rounded-[16px] border-hh-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] leading-[20px] text-hh-text font-semibold">
                  E.P.I.C. Sales Flow
                </h3>
                <div className="text-[12px] leading-[16px] text-hh-muted">
                  4/12 onderwerpen • 33%
                </div>
              </div>

              {/* Horizontal Phase Bar */}
              <div className="flex items-center gap-1">
                {/* Fase -1: Voorbereiding - Completed */}
                <button
                  onClick={() => scrollToPhase("-1")}
                  className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-full h-1.5 bg-hh-success rounded-full" />
                  <div className="flex flex-col items-center">
                    <div className="text-[11px] leading-[14px] text-hh-success font-semibold">
                      -1
                    </div>
                    <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                      Voorber.
                    </div>
                  </div>
                </button>

                {/* Fase 1: Openingsfase - Completed */}
                <button
                  onClick={() => scrollToPhase("1")}
                  className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-full h-1.5 bg-hh-success rounded-full" />
                  <div className="flex flex-col items-center">
                    <div className="text-[11px] leading-[14px] text-hh-success font-semibold">
                      1
                    </div>
                    <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                      Opening
                    </div>
                  </div>
                </button>

                {/* Fase 2: Ontdekkingsfase - Current */}
                <button
                  onClick={() => scrollToPhase("2")}
                  className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-full h-1.5 bg-hh-primary rounded-full" />
                  <div className="flex flex-col items-center">
                    <div className="text-[11px] leading-[14px] text-hh-primary font-semibold">
                      2
                    </div>
                    <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                      Ontdekking
                    </div>
                  </div>
                </button>

                {/* Fase 3: Aanbevelingsfase - Upcoming */}
                <button
                  onClick={() => scrollToPhase("3")}
                  className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-full h-1.5 bg-hh-ui-200 rounded-full" />
                  <div className="flex flex-col items-center">
                    <div className="text-[11px] leading-[14px] text-hh-muted font-semibold">
                      3
                    </div>
                    <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                      Voorstel
                    </div>
                  </div>
                </button>

                {/* Fase 4: Beslissingsfase - Locked */}
                <button
                  onClick={() => scrollToPhase("4")}
                  className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-full h-1.5 bg-hh-ui-100 rounded-full" />
                  <div className="flex flex-col items-center">
                    <div className="text-[11px] leading-[14px] text-hh-muted font-semibold">
                      4
                    </div>
                    <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                      Afsluiting
                    </div>
                  </div>
                </button>
              </div>
            </Card>

            {/* Filters - Fully Responsive */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
                <Input
                  placeholder="Zoek technieken..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-hh-muted hover:text-hh-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filters Row */}
              <div className="flex items-center gap-2 lg:flex-shrink-0">
                {/* Results count */}
                <div className="flex items-center gap-1.5 text-[12px] text-hh-muted whitespace-nowrap">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{filteredTechniques.length} {filteredTechniques.length === 1 ? "techniek" : "technieken"}</span>
                  <span className="sm:hidden">{filteredTechniques.length}</span>
                </div>

                <Select value={selectedFase} onValueChange={setSelectedFase}>
                  <SelectTrigger className="flex-1 min-w-0 text-[12px] sm:text-[13px] lg:w-[160px]">
                    <SelectValue placeholder="Fasen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle fasen</SelectItem>
                    <SelectItem value="-1">Voorbereiding</SelectItem>
                    <SelectItem value="1">Openingsfase</SelectItem>
                    <SelectItem value="2">Ontdekkingsfase</SelectItem>
                    <SelectItem value="3">Aanbevelingsfase</SelectItem>
                    <SelectItem value="4">Beslissingsfase</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="flex-1 min-w-0 text-[12px] sm:text-[13px] lg:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
                    <SelectItem value="completed">Voltooid</SelectItem>
                    <SelectItem value="current">Bezig</SelectItem>
                    <SelectItem value="upcoming">Nog te doen</SelectItem>
                    <SelectItem value="locked">Vergrendeld</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Techniques List */}
            <div className="space-y-3">
              {filteredTechniques.map((technique, index) => {
                // Check if we need to render a phase header
                const previousTechnique = index > 0 ? filteredTechniques[index - 1] : null;
                const showPhaseHeader = !previousTechnique || previousTechnique.fase !== technique.fase;

                return (
                  <div key={technique.id}>
                    {/* Phase Header */}
                    {showPhaseHeader && (
                      <div className="pt-12 pb-8 first:pt-4">
                        <h2 className="text-[24px] leading-[32px] text-hh-text">
                          Fase {technique.fase} — {technique.faseNaam}
                        </h2>
                      </div>
                    )}

                    {/* Technique Card */}
                    <div ref={(el) => (techniqueRefs.current[technique.id] = el)}>
                      <Card
                        className={`p-4 rounded-[16px] shadow-hh-sm border transition-all cursor-pointer hover:shadow-hh-md ${
                          technique.status === "current"
                            ? "border-hh-primary bg-hh-primary/5"
                            : "border-hh-border hover:border-hh-primary/30"
                        } ${technique.status === "locked" ? "opacity-60 cursor-not-allowed" : ""}`}
                        onClick={() => technique.status !== "locked" && openDetails(technique)}
                      >
                        <div className="flex flex-col md:flex-row md:items-start gap-3">
                          {/* Status Icon - hidden on mobile, shown on desktop */}
                          <div className="hidden md:block flex-shrink-0 mt-1">{getStatusIcon(technique.status)}</div>

                          {/* Main Content */}
                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            <div className="mb-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-teal-100 text-teal-600 border-0 text-[10px] flex-shrink-0 rounded-full px-2">
                                  {technique.nummer}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-hh-ui-100 flex-shrink-0"
                                >
                                  {technique.faseNaam}
                                </Badge>
                                {technique.status === "current" && (
                                  <Badge className="text-[10px] bg-hh-primary/10 text-hh-primary border-hh-primary/20">
                                    Nu bezig
                                  </Badge>
                                )}
                              </div>
                              <h3 className="text-[16px] leading-[24px] text-hh-text mt-3 mb-3">{technique.name}</h3>
                            </div>

                            {/* Stats */}
                            {technique.status !== "locked" && (
                              <div className="hidden md:flex flex-wrap items-center gap-3 text-[13px] text-hh-muted mb-3">
                                {technique.totalAttempts > 0 ? (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <Play className="w-3 h-3" />
                                      {technique.totalAttempts} sessies
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" />
                                      {technique.avgScore}% gemiddeld
                                    </div>
                                    {technique.lastPlayed && (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Laatste: {technique.lastPlayed}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-hh-muted italic">Nog niet geoefend</div>
                                )}
                              </div>
                            )}

                            {/* Unlock requirement for locked/upcoming */}
                            {(technique.status === "locked" || technique.status === "upcoming") &&
                              technique.unlockRequirement && (
                                <div className="mb-3 p-2 bg-hh-ui-50 rounded-lg text-[12px] text-hh-muted flex items-center gap-2">
                                  <Lock className="w-3 h-3 flex-shrink-0" />
                                  {technique.unlockRequirement}
                                </div>
                              )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                size="sm"
                                className="gap-1.5 text-[13px] h-8 justify-start"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startTraining("roleplay", technique);
                                }}
                                disabled={technique.status === "locked"}
                              >
                                <Sparkles className="w-3.5 h-3.5" /> Talk to Hugo<sup className="text-[9px]">AI</sup>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-[13px] h-8 justify-start"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startTraining("videocursus", technique);
                                }}
                                disabled={technique.status === "locked"}
                              >
                                <Play className="w-3.5 h-3.5" /> Video
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                );
              })}

              {filteredTechniques.length === 0 && (
                <Card className="p-12 rounded-[16px] shadow-hh-sm border-hh-border text-center">
                  <Search className="w-12 h-12 text-hh-muted mx-auto mb-4" />
                  <h3 className="text-[18px] leading-[26px] text-hh-text mb-2">
                    Geen technieken gevonden
                  </h3>
                  <p className="text-[14px] text-hh-muted mb-4">
                    Pas je filters aan of probeer een andere zoekopdracht
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFase("all");
                      setSelectedStatus("all");
                      setSearchQuery("");
                    }}
                  >
                    Reset filters
                  </Button>
                </Card>
              )}
            </div>

            {/* Hugo's Tip */}
            {!activeTrainingMode && (
              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border bg-hh-ui-50">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-5 h-5 text-hh-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[18px] leading-[26px] text-hh-text">
                      Tip van Hugo
                    </h3>
                    <p className="text-[16px] leading-[24px] text-hh-muted">
                      "Je bent nu bezig met techniek 2.1.3. Focus op de alternatieve vraagvormen — mensen geven makkelijker info als je indirect vraagt. Oefen 3x deze week om het te automatiseren."
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Right Panel - Training Interface (Fullscreen on mobile, 60% on desktop) */}
        {activeTrainingMode && (
          <div className="w-full lg:w-[60%] border-l border-hh-border bg-white">
            {renderTrainingInterface()}
          </div>
        )}
      </div>

      {/* Details Slide-out Panel */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0 [&>button]:hidden">
          {selectedTechnique && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{selectedTechnique.name}</SheetTitle>
                <SheetDescription>
                  Details en trainingsopties voor {selectedTechnique.name}
                </SheetDescription>
              </SheetHeader>
              <div className="h-full flex flex-col">
                {/* Header Section - Fixed */}
                <div className="p-6 border-b border-hh-border bg-hh-bg">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-teal-100 text-teal-600 border-0 text-[10px] rounded-full px-2">
                          {selectedTechnique.nummer}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] bg-hh-ui-100">
                          {selectedTechnique.faseNaam}
                        </Badge>
                      </div>
                      <h2 className="text-[24px] leading-[32px] text-hh-text">
                        {selectedTechnique.name}
                      </h2>
                    </div>
                    <button
                      onClick={() => setDetailsOpen(false)}
                      className="text-hh-muted hover:text-hh-text p-2 rounded-lg hover:bg-hh-ui-50 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[14px] leading-[22px] text-hh-muted">
                    {selectedTechnique.description}
                  </p>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6 space-y-6">
                    {/* Samenvatting Section */}
                    <Card className="p-6 bg-gradient-to-br from-hh-primary/5 to-hh-primary/10 border-hh-primary/20">
                      <h3 className="text-[18px] leading-[26px] text-hh-text mb-3 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-hh-primary" />
                        Wat leer je?
                      </h3>
                      <p className="text-[15px] leading-[22px] text-hh-text mb-4">
                        {selectedTechnique.description}
                      </p>
                      <div className="flex items-center gap-2 text-[13px] text-hh-muted">
                        <Clock className="w-4 h-4" />
                        <span>Gemiddelde leertijd: {selectedTechnique.duration}</span>
                      </div>
                    </Card>

                    {/* Call to Action - Train deze techniek */}
                    <Card className="p-6 bg-hh-ui-50 border-hh-border">
                      <h3 className="text-[16px] leading-[24px] text-hh-text mb-3">
                        Train deze techniek
                      </h3>
                      <p className="text-[14px] text-hh-muted mb-4">
                        Kies hoe je wilt oefenen met deze techniek
                      </p>
                      <div className="space-y-2">
                        {/* Alle 4 de opties evenwaardig */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <Button
                            size="sm"
                            className="gap-1.5 text-[14px] h-10 font-semibold"
                            onClick={() => {
                              startTraining("roleplay", selectedTechnique);
                            }}
                            disabled={selectedTechnique.status === "locked"}
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Talk to Hugo<sup className="text-[9px]">AI</sup>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-[14px] h-10 font-semibold border-2 hover:border-hh-warn hover:bg-hh-warn/5"
                            onClick={() => {
                              startTraining("videocursus", selectedTechnique);
                            }}
                            disabled={selectedTechnique.status === "locked"}
                          >
                            <Play className="w-3.5 h-3.5" /> Video
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* Stats Cards */}
                    {selectedTechnique.totalAttempts > 0 && (
                      <div>
                        <h3 className="text-[16px] leading-[24px] text-hh-text mb-3 flex items-center gap-2">
                          <BarChart className="w-4 h-4 text-hh-primary" />
                          Jouw prestaties
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          <Card className="p-4 text-center bg-hh-ui-50 border-hh-border">
                            <Play className="w-5 h-5 text-hh-primary mx-auto mb-2" />
                            <p className="text-[24px] leading-[32px] text-hh-text">
                              {selectedTechnique.totalAttempts}
                            </p>
                            <p className="text-[12px] text-hh-muted">Sessies</p>
                          </Card>
                          <Card className="p-4 text-center bg-hh-ui-50 border-hh-border">
                            <Target className="w-5 h-5 text-hh-success mx-auto mb-2" />
                            <p className="text-[24px] leading-[32px] text-hh-text">
                              {selectedTechnique.avgScore}%
                            </p>
                            <p className="text-[12px] text-hh-muted">Gemiddelde</p>
                          </Card>
                          <Card className="p-4 text-center bg-hh-ui-50 border-hh-border">
                            <Calendar className="w-5 h-5 text-hh-warn mx-auto mb-2" />
                            <p className="text-[12px] leading-[16px] text-hh-text mt-2">
                              {selectedTechnique.lastPlayed || "-"}
                            </p>
                            <p className="text-[12px] text-hh-muted">Laatst</p>
                          </Card>
                        </div>
                      </div>
                    )}

                    {/* Do's and Don'ts */}
                    {selectedTechnique.doList.length > 0 && selectedTechnique.dontList.length > 0 && (
                      <div>
                        <h3 className="text-[16px] leading-[24px] text-hh-text mb-3">
                          Do's & Don'ts
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Do's */}
                          <Card className="p-4 bg-hh-success/5 border-hh-success/20">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-4 h-4 text-hh-success" />
                              <h4 className="text-[14px] text-hh-success font-semibold">Do's</h4>
                            </div>
                            <ul className="space-y-2">
                              {selectedTechnique.doList.map((item, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2 text-[13px] text-hh-text"
                                >
                                  <span className="text-hh-success mt-1">✓</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </Card>

                          {/* Don'ts */}
                          <Card className="p-4 bg-destructive/5 border-destructive/20">
                            <div className="flex items-center gap-2 mb-3">
                              <X className="w-4 h-4 text-destructive" />
                              <h4 className="text-[14px] text-destructive font-semibold">
                                Don'ts
                              </h4>
                            </div>
                            <ul className="space-y-2">
                              {selectedTechnique.dontList.map((item, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2 text-[13px] text-hh-text"
                                >
                                  <span className="text-destructive mt-1">✕</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </Card>
                        </div>
                      </div>
                    )}

                    {/* Session History */}
                    {selectedTechnique.sessieHistory.length > 0 && (
                      <div>
                        <h3 className="text-[16px] leading-[24px] text-hh-text mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-hh-primary" />
                          Sessie geschiedenis ({selectedTechnique.sessieHistory.length})
                        </h3>
                        <div className="space-y-2">
                          {selectedTechnique.sessieHistory.map((session) => (
                            <Card
                              key={session.id}
                              className="p-4 border-hh-border hover:border-hh-primary/30 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <div
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                      session.type === "video"
                                        ? "bg-hh-warn/10"
                                        : session.type === "chat"
                                        ? "bg-hh-primary/10"
                                        : "bg-hh-success/10"
                                    }`}
                                  >
                                    {session.type === "video" ? (
                                      <VideoIcon className="w-5 h-5 text-hh-warn" />
                                    ) : session.type === "chat" ? (
                                      <MessageSquare className="w-5 h-5 text-hh-primary" />
                                    ) : (
                                      <Mic className="w-5 h-5 text-hh-success" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-[14px] text-hh-text">
                                      {session.datum} • {session.tijd}
                                    </p>
                                    <p className="text-[12px] text-hh-muted">
                                      {session.duration}
                                    </p>
                                  </div>
                                </div>
                                {session.score && (
                                  <Badge className={getScoreBadgeColor(session.score)}>
                                    {session.score}%
                                  </Badge>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {selectedTechnique.sessieHistory.length === 0 && selectedTechnique.status !== "locked" && (
                      <Card className="p-8 text-center border-dashed border-2 border-hh-border bg-hh-ui-50">
                        <Clock className="w-12 h-12 text-hh-muted mx-auto mb-3" />
                        <h4 className="text-[16px] text-hh-text mb-2">Nog geen sessies</h4>
                        <p className="text-[14px] text-hh-muted">
                          Start nu je eerste oefensessie met deze techniek
                        </p>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* E.P.I.C. Sales Flow Drawer - Mobile Only */}
      <Sheet open={flowDrawerOpen} onOpenChange={setFlowDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>E.P.I.C. Sales Flow</SheetTitle>
            <SheetDescription>
              Overzicht van alle salestechnieken per fase
            </SheetDescription>
          </SheetHeader>
          
          <div className="h-full overflow-y-auto p-4">
            {/* Header */}
            <div className="mb-4">
              <h2 className="text-[24px] leading-[32px] text-hh-text mb-1">E.P.I.C. Sales Flow</h2>
              <p className="text-[14px] text-hh-muted">4/12 technieken • 33%</p>
            </div>

            {/* Phase Progress Bar */}
            <Card className="p-4 rounded-[16px] border-hh-border mb-4">
              <div className="flex items-center gap-1">
                {/* Fase -1 */}
                <button
                  onClick={() => {
                    scrollToPhase("-1");
                    setFlowDrawerOpen(false);
                  }}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="w-full h-1.5 bg-hh-success rounded-full" />
                  <div className="text-[11px] text-hh-success font-semibold">-1</div>
                  <div className="text-[10px] text-hh-muted text-center">Voorber.</div>
                </button>

                {/* Fase 1 */}
                <button
                  onClick={() => {
                    scrollToPhase("1");
                    setFlowDrawerOpen(false);
                  }}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="w-full h-1.5 bg-hh-success rounded-full" />
                  <div className="text-[11px] text-hh-success font-semibold">1</div>
                  <div className="text-[10px] text-hh-muted text-center">Opening</div>
                </button>

                {/* Fase 2 */}
                <button
                  onClick={() => {
                    scrollToPhase("2");
                    setFlowDrawerOpen(false);
                  }}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="w-full h-1.5 bg-hh-primary rounded-full" />
                  <div className="text-[11px] text-hh-primary font-semibold">2</div>
                  <div className="text-[10px] text-hh-muted text-center">Ontdekking</div>
                </button>

                {/* Fase 3 */}
                <button
                  onClick={() => {
                    scrollToPhase("3");
                    setFlowDrawerOpen(false);
                  }}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="w-full h-1.5 bg-hh-ui-200 rounded-full" />
                  <div className="text-[11px] text-hh-muted font-semibold">3</div>
                  <div className="text-[10px] text-hh-muted text-center">Voorstel</div>
                </button>

                {/* Fase 4 */}
                <button
                  onClick={() => {
                    scrollToPhase("4");
                    setFlowDrawerOpen(false);
                  }}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="w-full h-1.5 bg-hh-ui-200 rounded-full" />
                  <div className="text-[11px] text-hh-muted font-semibold">4</div>
                  <div className="text-[10px] text-hh-muted text-center">Beslissing</div>
                </button>
              </div>
            </Card>

            {/* Techniques List */}
            <div className="space-y-2">
              {allTechniques.map((technique) => (
                <button
                  key={technique.id}
                  onClick={() => {
                    openDetails(technique);
                    setFlowDrawerOpen(false);
                  }}
                  className="w-full p-3 bg-white border border-hh-border rounded-lg hover:border-hh-primary/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(technique.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-teal-100 text-teal-600 border-0 text-[9px] rounded-full px-2">
                          {technique.nummer}
                        </Badge>
                        <h4 className="text-[14px] text-hh-text truncate">
                          {technique.name}
                        </h4>
                      </div>
                      <p className="text-[12px] text-hh-muted truncate">
                        {technique.description}
                      </p>
                    </div>
                    <div className="text-[11px] text-hh-muted">{technique.duration}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
