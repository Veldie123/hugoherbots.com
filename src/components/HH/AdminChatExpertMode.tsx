/**
 * AdminChatExpertMode - Expert training interface for Talk to Hugo AI
 * 
 * Features:
 * - AI roleplay with customer simulation
 * - Multi-modal: chat, audio (LiveKit), video (HeyGen)
 * - Debug panel with prompt visibility
 * - Golden Standard save functionality
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { renderSimpleMarkdown } from "../../utils/renderMarkdown";
import { AdminLayout } from "./AdminLayout";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { StopRoleplayDialog } from "./StopRoleplayDialog";
import { TechniqueDetailsDialog } from "./TechniqueDetailsDialog";
import { Room, RoomEvent, ConnectionState, Track, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from "livekit-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Send,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Menu,
  ChevronLeft,
  Info,
  Lightbulb,
  Pencil,
  Target,
  MessageSquare,
  AlertCircle,
  Phone,
  Video,
  Mic,
  MicOff,
  Volume2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Paperclip,
  FileAudio,
  FileText,
  File,
  Image,
} from "lucide-react";
import { toast } from "sonner";
import { getAllTechnieken } from "../../data/technieken-service";
import technieken_index from "../../data/technieken_index.json";
import { KLANT_HOUDINGEN } from "../../data/klant_houdingen";
import { cn } from "../ui/utils";
import { 
  buyingClockToDisplay, 
  behaviorStyleToDisplay, 
  difficultyToDisplay,
  difficultyLevels,
  translate,
  buildDebugInfoFromResponse 
} from "../../utils/displayMappings";
import { EPICSidebar } from "./AdminChatExpertModeSidebar";
import { hugoApi, type AssistanceConfig } from "../../services/hugoApi";
import { Loader2 } from "lucide-react";
import { LiveAvatarComponent } from "./LiveAvatarComponent";

interface AnalysisCard {
  id: string;
  title: string;
  userName: string;
  status: string;
  score?: number;
  createdAt: string;
}

interface Message {
  id: string;
  sender: "hugo" | "ai";
  text: string;
  timestamp: Date;
  technique?: string;
  debugInfo?: DebugInfo;
  feedback?: "up" | "down" | null;
  isTranscriptReplay?: boolean;
  transcriptRole?: string;
  attachments?: MessageAttachment[];
  correctionData?: CorrectionData;
  analysisCards?: AnalysisCard[];
}

interface MessageAttachment {
  name: string;
  type: string;
  size: number;
  url?: string;
}

interface FileAttachment {
  id: string;
  file: globalThis.File;
  name: string;
  type: string;
  size: number;
  preview?: string;
}

interface CorrectionData {
  selectedTechnique?: string;
  selectedTechniqueName?: string;
  correctionText?: string;
  timestamp: Date;
}

interface DebugInfo {
  // For AI Coach messages (Customer)
  chosenTechnique?: string;
  klantSignaal?: "positief" | "neutraal" | "negatief";
  expectedTechnique?: string;
  persona: {
    gedragsstijl: string;
    koopklok: string;
    moeilijkheid: string;
  };
  context: {
    fase: number;
    gathered?: {
      sector?: string | null;
      product?: string | null;
      klantType?: string | null;
      verkoopkanaal?: string | null;
      ervaring?: string | null;
    };
  };
  customerDynamics: {
    rapport: number;
    valueTension: number;
    commitReadiness: number;
  };
  aiDecision: {
    epicFase: string;
    evaluatie: "positief" | "gemist" | "neutraal";
  };
  promptsUsed?: {
    systemPrompt?: string;
    userPrompt?: string;
  };
  ragDocuments?: Array<{
    title?: string;
    content?: string;
    score?: number;
  }>;
  
  // For Hugo (Seller) messages
  sellerSignaal?: "positief" | "neutraal" | "negatief";
  expectedTechniqueForSeller?: string;
  detectedTechnique?: string;
  score?: number;
  chosenTechniqueForSeller?: string; // NEW: Technique Hugo chose to use
}

interface AdminChatExpertModeProps {
  sessionId: string;
  sessionTitle: string;
  navigate: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AdminChatExpertMode({
  sessionId,
  sessionTitle,
  navigate,
  isSuperAdmin,
}: AdminChatExpertModeProps) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedTechnique, setSelectedTechnique] = useState<string>(""); // Display name
  const [selectedTechniqueNumber, setSelectedTechniqueNumber] = useState<string>(""); // Actual technique ID
  const [hasActiveSession, setHasActiveSession] = useState(false); // Track if session is active
  const [expandedDebug, setExpandedDebug] = useState<string | null>(null); // Track which message debug is expanded
  const [expandedDebugSections, setExpandedDebugSections] = useState<Record<string, string[]>>({}); // Track expanded sections per message
  const [currentPhase, setCurrentPhase] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpenRaw] = useState(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('epic') === '1'
  );
  const setDesktopSidebarOpen = (open: boolean) => {
    setDesktopSidebarOpenRaw(open);
    window.dispatchEvent(new CustomEvent('sidebar-collapse-request', { detail: { collapsed: open } }));
  };
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<number[]>([1]); // Phase 1 open by default
  const [expandedParents, setExpandedParents] = useState<string[]>([]); // Track expanded parent techniques
  const [expandedHoudingen, setExpandedHoudingen] = useState<string[]>([]); // Track expanded klant houdingen
  const [techniqueValidation, setTechniqueValidation] = useState<Record<string, boolean | null>>({});
  const [showFeedbackInput, setShowFeedbackInput] = useState<Record<string, boolean>>({});
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [techniqueDetailsPanelOpen, setTechniqueDetailsPanelOpen] = useState(false);
  const [selectedTechniqueDetails, setSelectedTechniqueDetails] = useState<any | null>(null);
  const [isEditingTechnique, setIsEditingTechnique] = useState(false); // NEW: Edit mode state
  const [editedTechniqueData, setEditedTechniqueData] = useState<any>(null); // NEW: Editable technique data
  const [fasesAccordionOpen, setFasesAccordionOpen] = useState(true); // NEW: Accordion state for Fases section
  const [houdingenAccordionOpen, setHoudingenAccordionOpen] = useState(false); // NEW: Accordion state for Houdingen section
  const [activeHouding, setActiveHouding] = useState<string | null>(null); // NEW: Currently active houding from AI
  const [recommendedTechnique, setRecommendedTechnique] = useState<string | null>(null); // NEW: Recommended technique to highlight
  const [difficultyLevel, setDifficultyLevel] = useState<string>("onbewuste_onkunde"); // Competentie niveau (4 levels)
  const [assistanceConfig, setAssistanceConfig] = useState<AssistanceConfig>({
    showHouding: true,
    showExpectedTechnique: true,
    showStepIndicators: true,
    showTipButton: true,
    showExamples: true,
    blindPlay: false,
  });
  const [levelTransitionMessage, setLevelTransitionMessage] = useState<string | null>(null);
  const [stopRoleplayDialogOpen, setStopRoleplayDialogOpen] = useState(false); // NEW: Stop roleplay confirmation dialog
  const [chatMode, setChatMode] = useState<"chat" | "audio" | "video">("chat"); // Multi-modal chat mode
  const [isMuted, setIsMuted] = useState(false); // Audio/video mute state
  const [sessionTimer, setSessionTimer] = useState(0); // Session timer
  const [isLoading, setIsLoading] = useState(false); // Loading state for API calls
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [correctionMessageId, setCorrectionMessageId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionTechnique, setCorrectionTechnique] = useState<string>("");
  const [correctionTechniqueName, setCorrectionTechniqueName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // LiveKit Audio State
  const [liveKitRoom, setLiveKitRoom] = useState<Room | null>(null);
  const [audioConnectionState, setAudioConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [isAudioConnecting, setIsAudioConnecting] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load user's current competence level on mount (auto-adaptive system)
  useEffect(() => {
    const loadUserLevel = async () => {
      try {
        const levelData = await hugoApi.getUserLevel();
        setDifficultyLevel(levelData.levelName);
        setAssistanceConfig(levelData.assistance);
        console.log("[Performance] Loaded user level:", levelData.level, levelData.levelName);
      } catch (error) {
        console.error("[Performance] Failed to load user level:", error);
        // Keep defaults on error
      }
    };
    loadUserLevel();
  }, []);

  // Practice context from analysis (when "Oefen met Hugo" is clicked in admin view)
  useEffect(() => {
    let cancelled = false;
    const practiceRaw = sessionStorage.getItem('hugoPracticeContext');
    if (practiceRaw) {
      sessionStorage.removeItem('hugoPracticeContext');
      try {
        const ctx = JSON.parse(practiceRaw);
        if (ctx.fromAnalysis) {
          const techniqueLabel = ctx.techniqueNames || ctx.techniqueIds?.join(', ') || ctx.practiceLabel;
          const turns: Array<{ speaker: 'seller' | 'customer'; text: string }> = ctx.transcriptTurns || [];

          const historyMessages: Message[] = [];
          if (turns.length > 0) {
            historyMessages.push({
              id: `practice-header-${Date.now()}`,
              sender: "ai",
              text: `Hier is het gesprek${ctx.analysisTitle ? ` "${ctx.analysisTitle}"` : ''} tot het oefenmoment. Ik speel de klant verder — geef jij een betere reactie.`,
              timestamp: new Date(),
            });
            turns.forEach((turn: { speaker: string; text: string }, i: number) => {
              historyMessages.push({
                id: `transcript-${Date.now()}-${i}`,
                sender: turn.speaker === 'customer' ? 'ai' : 'hugo',
                text: turn.text,
                timestamp: new Date(),
                isTranscriptReplay: true,
                transcriptRole: turn.speaker === 'customer' ? 'Klant' : 'Jij',
              });
            });
          }

          const fullTranscriptText = turns.map((t: { speaker: string; text: string }) =>
            `${t.speaker === 'customer' ? 'Klant' : 'Verkoper'}: ${t.text}`
          ).join('\n');

          const systemContext = `BELANGRIJK: Je bent nu in ROLEPLAY MODUS. Je speelt de KLANT in dit verkoopgesprek. Je mag GEEN context-gathering vragen stellen over de verkoper (zoals "wat verkoop jij?", "aan welk type klanten?", etc.). Je bent de klant en je BLIJFT in karakter als de klant.\n\nDit is een verkoopgesprek${ctx.analysisTitle ? ` genaamd "${ctx.analysisTitle}"` : ''}. De gebruiker wil oefenen met: ${techniqueLabel}.\n\nHieronder staat het volledige transcript. Jij bent de klant (Klant). Speel de klant realistisch verder — in dezelfde toon, stijl, bezwaren en context als in het transcript. Sla GEEN coachingmodus in. Stel GEEN vragen over de verkoper. Reageer ALLEEN als de klant.\n\n${fullTranscriptText}`;

          const lastSpeaker = turns.length > 0 ? turns[turns.length - 1].speaker : 'seller';
          const userMessage = lastSpeaker === 'seller'
            ? 'Dit was mijn laatste reactie in het gesprek. Speel de klant en reageer hierop.'
            : 'De klant zei dit als laatste. Ik wil nu een betere reactie geven. Wacht op mijn reactie en speel dan de klant verder.';

          setMessages(historyMessages);
          setHasActiveSession(true);
          setIsLoading(true);

          (async () => {
            try {
              const techniqueId = ctx.techniqueIds?.[0] || 'general';
              await hugoApi.startSession({
                techniqueId,
                mode: "COACH_CHAT",
                isExpert: true,
                modality: "chat",
                viewMode: 'admin',
              });
              if (cancelled) return;
              const response = await hugoApi.sendMessage(userMessage, true, systemContext);
              if (cancelled) return;
              setMessages(prev => [...prev, {
                id: `practice-ai-${Date.now()}`,
                sender: "ai",
                text: response.response || "Ik ben klaar om verder te spelen als de klant. Geef jouw reactie!",
                timestamp: new Date(),
              }]);
            } catch (err) {
              if (cancelled) return;
              setMessages(prev => [...prev, {
                id: `practice-ai-${Date.now()}`,
                sender: "ai",
                text: `Ik speel de klant uit "${ctx.analysisTitle || ctx.practiceLabel}". Geef maar een betere reactie — ik reageer als de klant.`,
                timestamp: new Date(),
              }]);
            } finally {
              if (!cancelled) setIsLoading(false);
            }
          })();
          console.log("[Admin] Practice context loaded from analysis:", ctx.practiceLabel, "turns:", turns.length);
        }
      } catch (err) {
        console.error("[Admin] Failed to parse practice context:", err);
      }
    }

    if (!practiceRaw) {
      (async () => {
        try {
          const res = await fetch('/api/v2/admin/welcome');
          if (res.ok) {
            const data = await res.json();
            setMessages([{
              id: `welcome-${Date.now()}`,
              sender: "ai",
              text: data.welcomeMessage,
              timestamp: new Date(),
            }]);
            return;
          }
        } catch (e) {
          console.warn("[Admin] Failed to load agent-first welcome:", e);
        }
        setMessages([{
          id: `welcome-${Date.now()}`,
          sender: "ai",
          text: "Dag Hugo! Waar kan ik je vandaag mee helpen? Je kunt direct beginnen met chatten, of selecteer een techniek via het E.P.I.C. menu.",
          timestamp: new Date(),
        }]);
      })();
    }

    return () => { cancelled = true; };
  }, []);

  // Session timer effect
  useEffect(() => {
    if (hasActiveSession) {
      timerRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasActiveSession]);

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Golden Standard API Functions
  const saveAsGoldenStandard = async (message: Message, isForSeller: boolean = true): Promise<boolean> => {
    try {
      const expectedTechnique = isForSeller 
        ? message.debugInfo?.expectedTechniqueForSeller || selectedTechniqueNumber
        : message.debugInfo?.expectedTechnique || selectedTechniqueNumber;
      
      const detectedTechnique = message.debugInfo?.detectedTechnique;
      const isCorrection = detectedTechnique && detectedTechnique !== expectedTechnique;
      
      const prevCustomerMessage = messages
        .slice(0, messages.findIndex(m => m.id === message.id))
        .reverse()
        .find(m => m.sender === 'ai');
      
      const response = await fetch('/api/v2/session/save-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          techniqueId: expectedTechnique,
          message: message.text,
          context: message.debugInfo?.context?.gathered || {},
          matchStatus: isCorrection ? 'mismatch' : 'match',
          signal: prevCustomerMessage?.debugInfo?.klantSignaal || 'neutraal',
          detectedTechnique: isCorrection ? detectedTechnique : undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save reference');
      }
      
      const result = await response.json();
      console.log('[Golden Standard] Saved:', result.message, isCorrection ? '(CORRECTION)' : '');
      toast.success(isCorrection ? 'Correctie opgeslagen als Golden Standard' : 'Opgeslagen als Golden Standard');
      return true;
    } catch (error) {
      console.error('[Golden Standard] Error saving reference:', error);
      toast.error('Opslaan mislukt');
      return false;
    }
  };

  const flagAsIncorrect = async (message: Message, expertComment: string, isForSeller: boolean = true): Promise<boolean> => {
    try {
      const techniqueId = isForSeller 
        ? message.debugInfo?.expectedTechniqueForSeller || selectedTechniqueNumber
        : message.debugInfo?.expectedTechnique || selectedTechniqueNumber;
      
      const prevCustomerMessage = messages
        .slice(0, messages.findIndex(m => m.id === message.id))
        .reverse()
        .find(m => m.sender === 'ai');
      
      const response = await fetch('/api/v2/session/flag-customer-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          turnNumber: messages.findIndex(m => m.id === message.id),
          customerMessage: isForSeller ? (prevCustomerMessage?.text || '') : message.text,
          customerSignal: isForSeller 
            ? (prevCustomerMessage?.debugInfo?.klantSignaal || 'neutraal')
            : (message.debugInfo?.klantSignaal || 'neutraal'),
          currentPhase: message.debugInfo?.context?.fase || currentPhase,
          techniqueId,
          expertComment,
          context: message.debugInfo?.context?.gathered || {},
          conversationHistory: messages.map(m => ({
            role: m.sender === 'hugo' ? 'seller' : 'customer',
            content: m.text
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to flag response');
      }
      
      const result = await response.json();
      console.log('[Golden Standard] Flagged:', result.message);
      toast.success(`Feedback opgeslagen (${result.conflictsFound || 0} conflicts)`);
      return true;
    } catch (error) {
      console.error('[Golden Standard] Error flagging response:', error);
      toast.error('Feedback opslaan mislukt');
      return false;
    }
  };

  // LiveKit Audio Functions
  const initLiveKitAudio = useCallback(async () => {
    if (isAudioConnecting || audioConnectionState === ConnectionState.Connected) return;
    
    setIsAudioConnecting(true);
    setAudioError(null);
    
    try {
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: `hugo-admin-${Date.now()}` })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }
      
      const { token, url } = await response.json();
      
      const room = new Room();
      
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        console.log('[LiveKit] Connection state:', state);
        setAudioConnectionState(state);
        if (state === ConnectionState.Connected) {
          console.log('[LiveKit] Connected to room');
        } else if (state === ConnectionState.Disconnected) {
          console.log('[LiveKit] Disconnected');
        }
      });
      
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log('[LiveKit] Track subscribed:', track.kind);
          const audioElement = track.attach();
          audioElementRef.current = audioElement;
          document.body.appendChild(audioElement);
        }
      });
      
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach(el => el.remove());
        }
      });
      
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentSpeaking = speakers.some(s => s.identity.startsWith('agent'));
        setIsAgentSpeaking(agentSpeaking);
      });
      
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log('[LiveKit] Microphone enabled');
      
      setLiveKitRoom(room);
    } catch (error) {
      console.error('[LiveKit] Error:', error);
      setAudioError(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsAudioConnecting(false);
    }
  }, [isAudioConnecting, audioConnectionState]);
  
  const stopLiveKitAudio = useCallback(() => {
    if (liveKitRoom) {
      liveKitRoom.disconnect();
      setLiveKitRoom(null);
      setAudioConnectionState(ConnectionState.Disconnected);
    }
  }, [liveKitRoom]);
  
  // Handle chat mode change for audio
  useEffect(() => {
    if (chatMode === "audio" && audioConnectionState === ConnectionState.Disconnected && !isAudioConnecting) {
      initLiveKitAudio();
    }
  }, [chatMode, audioConnectionState, isAudioConnecting, initLiveKitAudio]);
  
  // Cleanup LiveKit on unmount
  useEffect(() => {
    return () => {
      stopLiveKitAudio();
    };
  }, [stopLiveKitAudio]);
  
  // Handle mute toggle for LiveKit
  useEffect(() => {
    if (liveKitRoom && liveKitRoom.state === ConnectionState.Connected) {
      liveKitRoom.localParticipant.setMicrophoneEnabled(!isMuted);
    }
  }, [isMuted, liveKitRoom]);

  // Build debugInfo using centralized SSOT mapper with component-specific defaults
  const buildDebugInfo = (phase: number, apiResponse?: any): DebugInfo => {
    const ssotResult = buildDebugInfoFromResponse(apiResponse, difficultyLevel);
    const evalValue = ssotResult.aiDecision?.evaluatie;
    const typedEval: "positief" | "gemist" | "neutraal" = 
      evalValue === "positief" || evalValue === "gemist" ? evalValue : "neutraal";
    
    return {
      ...ssotResult,
      context: {
        fase: ssotResult.context?.fase || phase,
        gathered: ssotResult.context?.gathered || {}
      },
      customerDynamics: ssotResult.customerDynamics || { 
        rapport: 50, 
        valueTension: 50, 
        commitReadiness: 50 
      },
      aiDecision: {
        epicFase: ssotResult.aiDecision?.epicFase || `Fase ${phase}`,
        evaluatie: typedEval
      },
      promptsUsed: apiResponse?.debug?.promptsUsed || apiResponse?.promptsUsed,
      ragDocuments: apiResponse?.ragDocuments || apiResponse?.debug?.ragDocuments
    };
  };

  // Parse techniques by phase from technieken_index
  const techniquesByPhase: Record<number, any[]> = {};
  Object.values(technieken_index.technieken).forEach((technique: any) => {
    const phase = parseInt(technique.fase);
    if (!techniquesByPhase[phase]) {
      techniquesByPhase[phase] = [];
    }
    techniquesByPhase[phase].push(technique);
  });

  const phaseNames: Record<number, string> = {
    0: "Pre-contactfase",
    1: "Openingsfase",
    2: "Ontdekkingsfase",
    3: "Aanbevelingsfase",
    4: "Beslissingsfase"
  };

  // Convert KLANT_HOUDINGEN object to array for rendering
  const klantHoudingenArray = Object.entries(KLANT_HOUDINGEN.houdingen).map(([key, houding]) => ({
    id: houding.id,
    key: key,
    naam: houding.naam,
    beschrijving: houding.houding_beschrijving,
    technieken: [...(houding.recommended_technique_ids || [])],
    recommended_technique_ids: [...(houding.recommended_technique_ids || [])],
  }));

  // Helper function to get technique name from number
  const getTechniqueNameByNumber = (techniqueNumber: string): string => {
    const technique = Object.values(technieken_index.technieken).find(
      (t: any) => t.nummer === techniqueNumber
    ) as any;
    return technique ? technique.naam : techniqueNumber;
  };

  const togglePhase = (phase: number) => {
    setExpandedPhases(prev =>
      prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]
    );
  };

  const toggleParentTechnique = (id: string) => {
    setExpandedParents(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleHouding = (id: string) => {
    setExpandedHoudingen(prev =>
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    );
  };

  const openTechniqueDetails = (techniqueNumber: string) => {
    const technique = Object.values(technieken_index.technieken).find(
      (t: any) => t.nummer === techniqueNumber
    );
    if (technique) {
      setSelectedTechniqueDetails(technique);
      setTechniqueDetailsPanelOpen(true);
    }
  };

  const startTechniqueChat = async (techniqueNumber: string, techniqueName: string) => {
    const technique = Object.values(technieken_index.technieken).find(
      (t: any) => t.nummer === techniqueNumber
    ) as any;

    if (!technique) return;

    setSelectedTechnique(techniqueName);
    setSelectedTechniqueNumber(techniqueNumber);
    setSessionTimer(0);
    setIsLoading(true);

    try {
      const session = await hugoApi.startSession({
        techniqueId: techniqueNumber,
        mode: "COACH_CHAT",
        isExpert: true,
        modality: chatMode,
        viewMode: 'admin',
      });
      
      setHasActiveSession(true);

      const aiMessage: Message = {
        id: Date.now().toString(),
        sender: "ai",
        text: session.message || session.initialMessage || "",
        timestamp: new Date(),
        debugInfo: buildDebugInfo(parseInt(technique.fase) || currentPhase, session)
      };
      setMessages([aiMessage]);
    } catch (error) {
      console.error("Failed to start session:", error);
      setSelectedTechnique("");
      setSelectedTechniqueNumber("");
      setHasActiveSession(false);
      const errorMessage: Message = {
        id: Date.now().toString(),
        sender: "ai",
        text: `Er ging iets mis bij het starten van de sessie voor "${techniqueName}". Probeer het opnieuw.`,
        timestamp: new Date(),
        debugInfo: buildDebugInfo(parseInt(technique.fase) || currentPhase)
      };
      setMessages([errorMessage]);
    } finally {
      setIsLoading(false);
    }

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const getFaseBadgeColor = (phase: number) => {
    // Admin view uses purple palette for all phases
    return "bg-purple-100 text-purple-700 border-purple-300";
  };

  // Get top-level techniques (those without parent or whose parent is the phase itself)
  // EXCLUDE the phase itself (e.g., "1", "2") - only show numbered sub-techniques (e.g., "1.1", "2.1")
  const getTopLevelTechniques = (phase: number) => {
    return (techniquesByPhase[phase] || []).filter((t: any) => {
      // Exclude phase headers (is_fase === true)
      if (t.is_fase) return false;
      // Include only techniques that are direct children of the phase
      return !t.parent || t.parent === phase.toString() || t.parent === `${phase}`;
    });
  };

  // Check if a technique has children
  const hasChildren = (technique: any, phase: number) => {
    return (techniquesByPhase[phase] || []).some((t: any) => t.parent === technique.nummer);
  };

  // Get child techniques
  const getChildTechniques = (parentNumber: string, phase: number) => {
    return (techniquesByPhase[phase] || []).filter((t: any) => t.parent === parentNumber);
  };

  const detectAdminNavigationIntent = (text: string): string | null => {
    const lower = text.toLowerCase().trim();
    const analysisPatterns = [
      /gespreksanalys/i, /analyse.*bekijk/i, /bekijk.*analyse/i,
      /feedback.*gesprek/i, /gesprek.*feedback/i, /recente.*analys/i,
      /analys.*recent/i, /feedback.*geven/i, /analyseer/i,
    ];
    for (const p of analysisPatterns) {
      if (p.test(lower)) return "analysis";
    }
    const sessionPatterns = [
      /chat.*sessie/i, /sessie.*bekijk/i, /ai.*chat.*bekijk/i,
      /gebruiker.*chat/i, /rollenspel.*bekijk/i,
    ];
    for (const p of sessionPatterns) {
      if (p.test(lower)) return "sessions";
    }
    return null;
  };

  const handleNavigationIntent = async (intent: string, userText: string): Promise<boolean> => {
    if (intent === "analysis") {
      try {
        const res = await fetch('/api/v2/analysis/list');
        if (!res.ok) return false;
        const analyses = await res.json();
        const recent = analyses.slice(0, 5);
        if (recent.length === 0) {
          const aiMsg: Message = {
            id: `nav-${Date.now()}`,
            sender: "ai",
            text: "Er zijn nog geen gespreksanalyses beschikbaar. Upload eerst een gesprek via **Gespreksanalyse** in het menu.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, aiMsg]);
          return true;
        }

        const cards: AnalysisCard[] = recent.map((a: any) => ({
          id: a.id,
          title: a.title || 'Onbekend gesprek',
          userName: a.userName || 'Onbekend',
          status: a.status,
          score: a.result?.overallScore || a.result?.overall_score || undefined,
          createdAt: a.created_at,
        }));

        const mostInteresting = recent.find((a: any) => a.status === 'completed' && a.result) || recent[0];
        const introText = mostInteresting?.status === 'completed'
          ? `Hier zijn je recente gespreksanalyses. De meest interessante is **"${mostInteresting.title}"**${mostInteresting.result?.overallScore ? ` met een score van ${mostInteresting.result.overallScore}%` : ''}. Klik op een analyse om de details te bekijken.`
          : `Hier zijn je recente gespreksanalyses. Klik op een analyse om de details te bekijken.`;

        const aiMsg: Message = {
          id: `nav-${Date.now()}`,
          sender: "ai",
          text: introText,
          timestamp: new Date(),
          analysisCards: cards,
        };
        setMessages(prev => [...prev, aiMsg]);
        return true;
      } catch (e) {
        console.error("[Admin] Navigation intent failed:", e);
        return false;
      }
    }
    return false;
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "hugo",
      text: inputText,
      timestamp: new Date(),
      debugInfo: {
        chosenTechniqueForSeller: selectedTechnique || "Geen",
        sellerSignaal: "neutraal",
        expectedTechniqueForSeller: selectedTechniqueNumber || "N/A",
        detectedTechnique: selectedTechniqueNumber ? getTechniqueNameByNumber(selectedTechniqueNumber) : "Onbekend",
        score: 0,
        ...buildDebugInfo(currentPhase)
      }
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText;
    setInputText("");
    setIsLoading(true);

    const navIntent = detectAdminNavigationIntent(messageText);
    if (navIntent && !hasActiveSession) {
      const handled = await handleNavigationIntent(navIntent, messageText);
      if (handled) {
        setIsLoading(false);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return;
      }
    }

    if (!hasActiveSession) {
      try {
        await hugoApi.startSession({
          techniqueId: selectedTechniqueNumber || "general",
          mode: "COACH_CHAT",
          isExpert: true,
          modality: chatMode,
          viewMode: 'admin',
        });
        setHasActiveSession(true);
        console.log("[Admin] Auto-started expert session");
      } catch (error) {
        console.error("[Admin] Failed to auto-start session:", error);
        setIsLoading(false);
        toast.error("Kon geen sessie starten. Probeer opnieuw.");
        return;
      }
    }

    try {
      const response = await hugoApi.sendMessage(messageText, true);
      
      const signalMap: Record<string, "positief" | "neutraal" | "negatief"> = {
        positief: "positief",
        neutral: "neutraal",
        neutraal: "neutraal",
        negatief: "negatief"
      };
      
      const evalMap: Record<string, "positief" | "gemist" | "neutraal"> = {
        goed: "positief",
        positief: "positief",
        gemist: "gemist",
        neutraal: "neutraal"
      };
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: response.response,
        timestamp: new Date(),
        debugInfo: {
          klantSignaal: signalMap[response.debug?.signal || "neutraal"] || "neutraal",
          expectedTechnique: response.debug?.detectedTechniques?.[0] || "N/A",
          ...buildDebugInfo(currentPhase, response)
        }
      };
      setMessages(prev => [...prev, aiMessage]);
      
      // Handle level transition (invisible auto-adaptive system)
      if (response.levelTransition) {
        const { previousLevel, newLevel, shouldCongratulate } = response.levelTransition;
        const levelNames = ["onbewuste_onkunde", "bewuste_onkunde", "bewuste_kunde", "onbewuste_kunde"];
        setDifficultyLevel(levelNames[newLevel - 1] || "onbewuste_onkunde");
        try {
          const levelData = await hugoApi.getUserLevel();
          setAssistanceConfig(levelData.assistance);
        } catch (e) {
          console.error("[Performance] Failed to reload assistance config:", e);
        }
        if (shouldCongratulate) {
          setLevelTransitionMessage(`🎉 Niveau ${previousLevel} → ${newLevel}. Gefeliciteerd!`);
        } else {
          setLevelTransitionMessage(`💪 Niveau ${previousLevel} → ${newLevel}. Aangepast voor betere oefening.`);
        }
        setTimeout(() => setLevelTransitionMessage(null), 5000);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "Sorry, er ging iets mis met de verbinding. Probeer het opnieuw.",
        timestamp: new Date(),
        debugInfo: {
          klantSignaal: "neutraal",
          ...buildDebugInfo(currentPhase)
        }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleMessageFeedback = (messageId: string, type: "up" | "down") => {
    if (type === "down") {
      const currentMsg = messages.find(m => m.id === messageId);
      if (currentMsg?.feedback === "down") {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: null } : m));
        setCorrectionMessageId(null);
        setCorrectionText("");
        setCorrectionTechnique("");
        setCorrectionTechniqueName("");
      } else {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: "down" } : m));
        setCorrectionMessageId(messageId);
        setCorrectionText("");
        setCorrectionTechnique("");
        setCorrectionTechniqueName("");
      }
    } else {
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, feedback: m.feedback === type ? null : type }
          : m
      ));
      if (correctionMessageId === messageId) {
        setCorrectionMessageId(null);
      }
    }
  };

  const handleSubmitCorrection = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const correctionData: CorrectionData = {
      selectedTechnique: correctionTechnique || undefined,
      selectedTechniqueName: correctionTechniqueName || undefined,
      correctionText: correctionText || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, correctionData } : m
    ));

    try {
      const response = await fetch('/api/v2/admin/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat_feedback',
          field: correctionTechnique ? 'technique_correction' : 'general_feedback',
          originalValue: message.text.slice(0, 200),
          newValue: correctionTechnique 
            ? `${correctionTechnique}: ${correctionTechniqueName}${correctionText ? ` — ${correctionText}` : ''}`
            : correctionText || 'Incorrect response',
          context: JSON.stringify({ messageId, sessionId: null }),
          submittedBy: 'admin',
        }),
      });
      if (response.ok) {
        toast.success("Correctie opgeslagen voor review");
      } else {
        toast.error("Fout bij opslaan correctie");
      }
    } catch (err) {
      console.error("[Admin] Failed to save correction:", err);
      toast.error("Fout bij opslaan correctie");
    }

    setCorrectionMessageId(null);
    setCorrectionText("");
    setCorrectionTechnique("");
    setCorrectionTechniqueName("");
  };

  const handleCancelCorrection = () => {
    setCorrectionMessageId(null);
    setCorrectionText("");
    setCorrectionTechnique("");
    setCorrectionTechniqueName("");
  };

  const handleFileSelect = (acceptTypes: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptTypes;
      fileInputRef.current.click();
    }
  };

  const processFiles = (files: FileList | globalThis.File[]) => {
    const newAttachments: FileAttachment[] = Array.from(files).map((file) => {
      const attachment: FileAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        type: file.type,
        size: file.size,
      };
      if (file.type.startsWith("image/")) {
        attachment.preview = URL.createObjectURL(file);
      }
      return attachment;
    });
    setAttachedFiles((prev) => [...prev, ...newAttachments]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Je browser ondersteunt spraakherkenning niet. Gebruik Chrome of Edge.");
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'nl-NL';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const existingText = inputText;
    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      const prefix = existingText ? existingText.trimEnd() + ' ' : '';
      const spoken = (finalTranscript + interim).trim();
      setInputText(prefix + spoken);
    };

    recognition.onerror = (event: any) => {
      console.error("[Dictation] Error:", event.error);
      if (event.error !== 'no-speech') {
        setIsRecording(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const handleStopRoleplay = () => {
    // Admin/Expert mode: skip the feedback dialog, just reset directly
    confirmStopRoleplay();
  };

  const confirmStopRoleplay = () => {
    setMessages([]);
    setInputText("");
    setSelectedTechnique("");
    setSelectedTechniqueNumber("");
    setSessionTimer(0);
    setHasActiveSession(false);
    hugoApi.clearSession();
  };
  
  // Toggle section visibility in debug info
  const toggleDebugSection = (messageId: string, section: string) => {
    setExpandedDebugSections((prev) => {
      const messageSections = prev[messageId] || [];
      const isExpanded = messageSections.includes(section);
      
      return {
        ...prev,
        [messageId]: isExpanded
          ? messageSections.filter((s) => s !== section)
          : [...messageSections, section],
      };
    });
  };
  
  const isDebugSectionExpanded = (messageId: string, section: string) => {
    return (expandedDebugSections[messageId] || []).includes(section);
  };

  return (
    <AdminLayout currentPage={sessionId === "hugo-agent" ? "admin-hugo-agent" : "admin-chat-expert"} navigate={navigate} isSuperAdmin={isSuperAdmin}>
      <div className="flex flex-col h-full">
        {/* Unified header row — matching user view */}
        <div className="flex items-stretch border-b border-hh-border flex-shrink-0">
          {desktopSidebarOpen && (
            <div className="hidden lg:flex items-center justify-between px-4 w-1/3 flex-shrink-0 bg-hh-bg" style={{ borderRight: '1px solid var(--hh-border)' }}>
              <h3 className="text-hh-text" style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }}>
                E.P.I.C. TECHNIQUE
              </h3>
              <button
                onClick={() => setDesktopSidebarOpen(false)}
                className="p-1.5 rounded-md text-hh-muted hover:text-hh-ink hover:bg-hh-ui-100 transition-colors"
                title="Sluiten"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className={`${!desktopSidebarOpen ? 'w-full' : 'flex-1'} flex items-center justify-between px-3 lg:px-6 py-3 lg:py-4 bg-hh-bg`}>
            <div className="flex items-center gap-2 lg:gap-3 min-w-0">
              <span className="text-[13px] text-hh-muted font-medium whitespace-nowrap flex items-center gap-1">
                {sessionTitle}
                <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded-full ml-1">
                  Lvl {difficultyLevel === "onbewuste_onkunde" ? "1" : 
                       difficultyLevel === "bewuste_onkunde" ? "2" : 
                       difficultyLevel === "bewuste_kunde" ? "3" : "4"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-hh-ui-50 rounded-full p-0.5">
                <button
                  onClick={() => setChatMode("chat")}
                  className={`p-2 rounded-full transition-all ${chatMode === "chat" ? "bg-hh-bg shadow-sm text-hh-ink" : "text-hh-muted hover:text-hh-primary"}`}
                  title="Chat"
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setChatMode("audio")}
                  className={`p-2 rounded-full transition-all ${chatMode === "audio" ? "bg-hh-bg shadow-sm text-hh-ink" : "text-hh-muted hover:text-hh-primary"}`}
                  title="Bellen"
                >
                  <Phone className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setChatMode("video")}
                  className={`p-2 rounded-full transition-all ${chatMode === "video" ? "bg-hh-bg shadow-sm text-hh-ink" : "text-hh-muted hover:text-hh-primary"}`}
                  title="Video"
                >
                  <Video className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={confirmStopRoleplay}
                  className="h-8 px-3 rounded-md border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors flex items-center gap-1.5"
                  title="Opnieuw starten"
                >
                  <X className="w-3.5 h-3.5 text-hh-muted" />
                  <span className="text-[12px] text-hh-text">Stop</span>
              </button>
            )}
            </div>
          </div>
        </div>

        {/* Body: EPIC sidebar + Chat */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {desktopSidebarOpen && (
            <div className="hidden lg:block w-1/3 flex-shrink-0 h-full overflow-y-auto bg-hh-bg" style={{ borderRight: '1px solid var(--hh-border)' }}>
              <EPICSidebar
                fasesAccordionOpen={fasesAccordionOpen}
                setFasesAccordionOpen={setFasesAccordionOpen}
                houdingenAccordionOpen={houdingenAccordionOpen}
                setHoudingenAccordionOpen={setHoudingenAccordionOpen}
                expandedPhases={expandedPhases}
                togglePhase={togglePhase}
                setCurrentPhase={setCurrentPhase}
                expandedParents={expandedParents}
                toggleParentTechnique={toggleParentTechnique}
                expandedHoudingen={expandedHoudingen}
                toggleHouding={toggleHouding}
                selectedTechnique={selectedTechnique}
                setSelectedTechnique={setSelectedTechnique}
                activeHouding={activeHouding}
                recommendedTechnique={recommendedTechnique}
                openTechniqueDetails={openTechniqueDetails}
                startTechniqueChat={startTechniqueChat}
                techniquesByPhase={techniquesByPhase}
                phaseNames={phaseNames}
                getFaseBadgeColor={getFaseBadgeColor}
                getTopLevelTechniques={getTopLevelTechniques}
                hasChildren={hasChildren}
                getChildTechniques={getChildTechniques}
                klantHoudingen={klantHoudingenArray}
                difficultyLevel={difficultyLevel}
                isUserView={true}
                isAdminView={true}
                hideHeader={true}
                onSelectTechnique={(nummer, naam) => {
                  setCorrectionTechnique(nummer);
                  setCorrectionTechniqueName(naam);
                  setSelectedTechnique(naam);
                }}
              />
            </div>
          )}

        <div className={`${desktopSidebarOpen ? 'flex-1' : 'w-full'} flex flex-col bg-hh-bg overflow-hidden min-h-0`}>

          {/* Level transition notification banner */}
          {levelTransitionMessage && (
            <div className="px-6 py-3 bg-gradient-to-r from-purple-500/10 to-purple-500/5 border-b border-purple-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-hh-ink font-medium">{levelTransitionMessage}</span>
                <button 
                  onClick={() => setLevelTransitionMessage(null)}
                  className="text-hh-muted hover:text-hh-ink transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Audio Mode Interface */}
          {chatMode === "audio" && (
            <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #0d9488 100%)' }}>
              <div className="relative">
                <div 
                  className="rounded-full flex items-center justify-center shadow-2xl mb-6"
                  style={{ width: '180px', height: '180px', backgroundColor: 'var(--hh-primary)' }}
                >
                  <span className="text-white font-bold" style={{ fontSize: '64px' }}>HH</span>
                </div>
                {isAgentSpeaking && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full">
                    <span className="text-teal-700 text-[12px] font-medium">Spreekt...</span>
                  </div>
                )}
              </div>
              <h3 className="text-white text-[20px] font-semibold mb-1">Hugo Herbots</h3>
              <p className="text-[16px] mb-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {isAudioConnecting ? "Verbinden..." : audioConnectionState === ConnectionState.Connected ? "Verbonden" : "Audio modus"}
              </p>
              <p className="text-[22px] font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatTime(sessionTimer)}</p>
              
              {/* Waveform visualization - animate when speaking */}
              <div className="flex items-end justify-center gap-1.5 h-16 mt-8">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-150 ${isAgentSpeaking ? 'animate-pulse' : ''}`}
                    style={{
                      width: '6px',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      height: isAgentSpeaking ? `${Math.sin(Date.now() / 200 + i) * 20 + 35}px` : `${15 + (i % 3) * 10}px`,
                    }}
                  />
                ))}
              </div>
              
              {/* Status message */}
              <p className="text-white/60 text-[14px] mt-4">
                {audioError ? "Configuratie vereist" : audioConnectionState === ConnectionState.Connected ? "Spraakcoaching actief" : "LiveKit audio verbinding"}
              </p>
              
              {/* Audio controls */}
              <div className="mt-auto pb-8 pt-4">
                <div className="flex items-center justify-center gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => setIsMuted(!isMuted)}
                      className="flex items-center justify-center transition-colors"
                      style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: isMuted ? 'white' : 'rgba(255,255,255,0.2)' }}
                    >
                      {isMuted ? <MicOff className="w-5 h-5 text-teal-700" /> : <Mic className="w-5 h-5 text-white" />}
                    </button>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{isMuted ? "Unmute" : "Mute"}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => {
                        stopLiveKitAudio();
                        setChatMode("chat");
                      }}
                      className="flex items-center justify-center shadow-xl"
                      style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ef4444' }}
                    >
                      <Phone className="w-6 h-6 text-white" style={{ transform: 'rotate(135deg)' }} />
                    </button>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>Ophangen</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      className="flex items-center justify-center"
                      style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }}
                    >
                      <Volume2 className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>Speaker</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Video Mode Interface - HeyGen LiveAvatar */}
          {chatMode === "video" && (
            <div className="flex-1 relative flex flex-col" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)' }}>
              {/* Top overlay with name and timer */}
              <div className="absolute top-0 left-0 right-0 p-4 z-10" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
                <h3 className="text-white text-[18px] font-semibold">Hugo Herbots</h3>
                <p className="text-white/70 text-[14px]">{formatTime(sessionTimer)}</p>
              </div>

              {/* LiveAvatar Component - fills the main area */}
              <div className="flex-1 flex items-center justify-center p-4 pt-16">
                <LiveAvatarComponent
                  v2SessionId={sessionId}
                  onAvatarSpeech={(text) => {
                    setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      sender: "ai",
                      text,
                      timestamp: new Date()
                    }]);
                  }}
                  onUserSpeech={(text) => {
                    setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      sender: "hugo",
                      text,
                      timestamp: new Date()
                    }]);
                  }}
                  language="nl"
                />
              </div>

              {/* Bottom controls - back to chat button */}
              <div className="absolute bottom-0 left-0 right-0 p-6 z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                <div className="flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => setChatMode("chat")}
                      className="flex items-center justify-center shadow-xl"
                      style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--hh-primary)' }}
                    >
                      <MessageSquare className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-white/70 text-[11px]">Terug naar chat</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Mode - Messages */}
          {chatMode === "chat" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                {/* Message Bubble - Modern rounded design */}
                <div className={`flex ${message.sender === "hugo" ? "justify-end" : "justify-start"}`}>
                  <div className="flex flex-col gap-1 max-w-[80%]">
                    {message.isTranscriptReplay && message.transcriptRole && (
                      <span className="text-[11px] font-medium mb-0.5 px-1" style={{ color: message.transcriptRole === 'Klant' ? '#9910FA' : '#7e22ce' }}>
                        {message.transcriptRole}
                      </span>
                    )}
                    {/* Main bubble */}
                    <div
                      className={`p-3 rounded-2xl ${
                        message.isTranscriptReplay
                          ? message.sender === "hugo"
                            ? "rounded-br-md"
                            : "rounded-bl-md"
                          : message.sender === "hugo"
                            ? "rounded-br-md"
                            : "bg-purple-600/10 text-hh-ink rounded-bl-md border border-purple-600/20"
                      }`}
                      style={
                        message.isTranscriptReplay
                          ? {
                              opacity: 0.85,
                              backgroundColor: message.sender === 'hugo' ? '#7e22ce' : 'var(--hh-ui-100)',
                              color: message.sender === 'hugo' ? '#ffffff' : 'var(--hh-ink)',
                            }
                          : message.sender === "hugo"
                            ? {
                                backgroundColor: '#7e22ce',
                                color: '#ffffff',
                              }
                            : undefined
                      }
                    >
                      <div className="text-[14px] leading-[20px]">{renderSimpleMarkdown(message.text)}</div>
                      {message.analysisCards && message.analysisCards.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.analysisCards.map((card) => (
                            <button
                              key={card.id}
                              onClick={() => {
                                sessionStorage.setItem('analysisFromHugo', 'true');
                                navigate?.('admin-analysis-results', { conversationId: card.id, fromAdmin: true });
                              }}
                              className="w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm"
                              style={{
                                borderColor: 'rgba(153,16,250,0.2)',
                                backgroundColor: 'rgba(153,16,250,0.03)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(153,16,250,0.4)';
                                e.currentTarget.style.backgroundColor = 'rgba(153,16,250,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(153,16,250,0.2)';
                                e.currentTarget.style.backgroundColor = 'rgba(153,16,250,0.03)';
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-[13px] text-hh-ink">{card.title}</span>
                                {card.score !== undefined && (
                                  <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{
                                    backgroundColor: card.score >= 60 ? 'rgba(60,154,110,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: card.score >= 60 ? '#3C9A6E' : '#ef4444',
                                  }}>
                                    {card.score}%
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] text-hh-muted">{card.userName}</span>
                                <span className="text-[11px] text-hh-muted/50">|</span>
                                <span className="text-[11px] text-hh-muted">
                                  {new Date(card.createdAt).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="text-[11px] text-hh-muted/50">|</span>
                                <span className="text-[11px]" style={{
                                  color: card.status === 'completed' ? '#3C9A6E' : card.status === 'failed' ? '#ef4444' : '#f59e0b',
                                }}>
                                  {card.status === 'completed' ? 'Klaar' : card.status === 'failed' ? 'Mislukt' : 'Bezig...'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons below AI bubble — admin purple colors */}
                    {message.sender === "ai" && !message.isTranscriptReplay && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-0.5 mt-1.5">
                          <button
                            onClick={() => handleCopyMessage(message.id, message.text)}
                            className="p-1.5 rounded-md text-hh-muted hover:text-hh-ink hover:bg-hh-ui-100 transition-colors"
                            title="Kopieer"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="w-3.5 h-3.5" style={{ color: '#9910FA' }} />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleMessageFeedback(message.id, "up")}
                            className="p-1.5 rounded-md transition-colors"
                            style={message.feedback === "up" ? { color: '#9910FA', backgroundColor: 'rgba(153,16,250,0.08)' } : undefined}
                            title="Goed antwoord"
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 ${message.feedback !== "up" ? "text-hh-muted hover:text-hh-muted" : ""}`} />
                          </button>
                          <button
                            onClick={() => handleMessageFeedback(message.id, "down")}
                            className="p-1.5 rounded-md transition-colors"
                            style={message.feedback === "down" ? { color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' } : undefined}
                            title="Correctie toevoegen"
                          >
                            <ThumbsDown className={`w-3.5 h-3.5 ${message.feedback !== "down" ? "text-hh-muted hover:text-hh-muted" : ""}`} />
                          </button>
                          <button
                            onClick={() => {
                              const lastUserMsg = [...messages].reverse().find(m => m.sender === "hugo");
                              if (lastUserMsg) {
                                setInputText(lastUserMsg.text);
                              }
                            }}
                            className="p-1.5 rounded-md text-hh-muted hover:text-hh-ink hover:bg-hh-ui-100 transition-colors"
                            title="Opnieuw proberen"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                            className="p-1.5 rounded-md transition-colors"
                            style={{
                              color: '#9910FA',
                              backgroundColor: desktopSidebarOpen ? 'rgba(153,16,250,0.1)' : undefined,
                            }}
                            title="E.P.I.C. technieken bekijken"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                          </button>
                          {message.debugInfo && (
                            <button
                              onClick={() =>
                                setExpandedDebug(expandedDebug === message.id ? null : message.id)
                              }
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ml-1 ${
                                expandedDebug === message.id
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-hh-ui-100 text-hh-muted hover:bg-purple-600/10 hover:text-purple-600"
                              }`}
                              title="Toggle debug info"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span>Debug</span>
                              {expandedDebug === message.id ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Correction panel — shown when admin clicks thumbs down */}
                        {correctionMessageId === message.id && (
                          <div className="mt-2 p-3 rounded-lg border transition-all" style={{ borderColor: 'rgba(153,16,250,0.3)', backgroundColor: 'rgba(153,16,250,0.04)' }}>
                            <p className="text-[12px] font-medium text-hh-muted mb-2">Correctie toevoegen</p>
                            {correctionTechnique && (
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-[11px] text-hh-muted">Techniek:</span>
                                <span className="text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(153,16,250,0.1)', color: '#9910FA' }}>
                                  {correctionTechnique} {correctionTechniqueName}
                                </span>
                                <button onClick={() => { setCorrectionTechnique(""); setCorrectionTechniqueName(""); }} className="text-hh-muted hover:text-hh-muted">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {!correctionTechnique && (
                              <p className="text-[11px] text-hh-muted mb-2 italic">
                                Selecteer optioneel de juiste techniek via het lampje (E.P.I.C. sidebar)
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={correctionText}
                                onChange={(e) => setCorrectionText(e.target.value)}
                                placeholder="Wat klopt er niet? (optioneel)"
                                className="flex-1 text-[13px] px-3 py-1.5 rounded-md border border-hh-border focus:outline-none focus:border-purple-300 bg-hh-bg text-hh-ink"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSubmitCorrection(message.id);
                                  if (e.key === 'Escape') handleCancelCorrection();
                                }}
                              />
                              <button
                                onClick={() => handleSubmitCorrection(message.id)}
                                className="p-1.5 rounded-md transition-colors hover:bg-purple-100"
                                style={{ color: '#9910FA' }}
                                title="Correctie bevestigen"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelCorrection}
                                className="p-1.5 rounded-md text-hh-muted hover:text-hh-ink hover:bg-hh-ui-100 transition-colors"
                                title="Annuleren"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Show saved correction badge */}
                        {message.correctionData && !correctionMessageId && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-purple-600">
                            <Check className="w-3 h-3" />
                            <span>Correctie opgeslagen{message.correctionData.selectedTechniqueName ? `: ${message.correctionData.selectedTechniqueName}` : ''}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Debug Info (collapsible) - Purple admin styling */}
                {message.debugInfo && expandedDebug === message.id && (
                  <div className={`${message.sender === "hugo" ? "flex justify-end" : ""}`}>
                    <div className="bg-purple-600/10 border border-purple-600/20 rounded-lg p-3 max-w-[300px] text-hh-ink">
                        <div className="space-y-3 text-[13px] leading-[18px]">
                          {/* For Hugo/Seller messages */}
                          {message.sender === "hugo" && (
                            <div className="space-y-3">
                              {/* Gekozen techniek (MOVED HERE from AI) */}
                              {message.debugInfo.chosenTechniqueForSeller && (
                                <div className="pb-3 border-b border-hh-border">
                                  <p className="text-[12px] text-hh-muted mb-1">Gekozen techniek:</p>
                                  <Badge 
                                    variant="outline" 
                                    className="text-[11px] cursor-pointer hover:bg-hh-ui-50"
                                    onClick={() => openTechniqueDetails(message.debugInfo?.chosenTechniqueForSeller || "")}
                                  >
                                    {message.debugInfo.chosenTechniqueForSeller}
                                  </Badge>
                                </div>
                              )}

                              {/* Verwachte techniek (ABOVE Gedetecteerde) */}
                              <div>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="text-[12px] text-hh-muted mb-1">Verwachte techniek:</p>
                                    <p className="text-hh-text font-medium">
                                      {message.debugInfo.expectedTechniqueForSeller || "N/A"}
                                    </p>
                                  </div>
                                  {/* Validation buttons ✓/✗ */}
                                  {!showFeedbackInput[message.id] && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`h-7 w-7 transition-all ${
                                          techniqueValidation[message.id] === true
                                            ? "bg-green-500 text-white hover:bg-green-600"
                                            : "hover:bg-green-100 hover:text-green-700 border border-green-300"
                                        }`}
                                        onClick={async () => {
                                          const success = await saveAsGoldenStandard(message, true);
                                          if (success) {
                                            setTechniqueValidation((prev) => ({ ...prev, [message.id]: true }));
                                            setShowFeedbackInput((prev) => ({ ...prev, [message.id]: false }));
                                          }
                                        }}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`h-7 w-7 transition-all ${
                                          techniqueValidation[message.id] === false
                                            ? "bg-red-500 text-white hover:bg-red-600"
                                            : "hover:bg-red-100 hover:text-red-700 border border-red-300"
                                        }`}
                                        onClick={() => {
                                          setTechniqueValidation((prev) => ({ ...prev, [message.id]: false }));
                                          setShowFeedbackInput((prev) => ({ ...prev, [message.id]: true }));
                                        }}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {showFeedbackInput[message.id] && (
                                  <div className="space-y-2 mt-3">
                                    <Input
                                      placeholder="Waarom is de verwachte techniek incorrect?"
                                      value={feedbackText[message.id] || ""}
                                      onChange={(e) =>
                                        setFeedbackText((prev) => ({ ...prev, [message.id]: e.target.value }))
                                      }
                                      className="text-[13px] border-hh-border"
                                    />
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-hh-muted hover:text-hh-text"
                                        onClick={() => {
                                          setShowFeedbackInput((prev) => ({ ...prev, [message.id]: false }));
                                          setTechniqueValidation((prev) => ({ ...prev, [message.id]: null }));
                                          setFeedbackText((prev) => ({ ...prev, [message.id]: "" }));
                                        }}
                                      >
                                        Annuleer
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 border-hh-border text-hh-ink hover:bg-hh-ui-50"
                                        onClick={async () => {
                                          const success = await flagAsIncorrect(message, feedbackText[message.id], true);
                                          if (success) {
                                            setShowFeedbackInput((prev) => ({ ...prev, [message.id]: false }));
                                            setFeedbackText((prev) => ({ ...prev, [message.id]: "" }));
                                          }
                                        }}
                                        disabled={!feedbackText[message.id]?.trim()}
                                      >
                                        Verzend
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Gedetecteerde techniek - WITH VALIDATION BUTTONS */}
                              <div>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="text-[12px] text-hh-muted font-medium mb-1">Gedetecteerde techniek:</p>
                                    <p className="text-hh-ink text-[12px]">
                                      {message.debugInfo.detectedTechnique || "N/A"}
                                      {message.debugInfo.score && (
                                        <span className="ml-2 text-green-600 font-semibold">
                                          (+{message.debugInfo.score})
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  {/* Validation buttons ✓/✗ for detected technique */}
                                  {!showFeedbackInput[message.id + "_detected"] && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`h-7 w-7 transition-all ${
                                          techniqueValidation[message.id + "_detected"] === true
                                            ? "bg-green-500 text-white hover:bg-green-600"
                                            : "hover:bg-green-100 hover:text-green-700 border border-green-300"
                                        }`}
                                        onClick={async () => {
                                          const success = await saveAsGoldenStandard(message, true);
                                          if (success) {
                                            setTechniqueValidation((prev) => ({ ...prev, [message.id + "_detected"]: true }));
                                            setShowFeedbackInput((prev) => ({ ...prev, [message.id + "_detected"]: false }));
                                          }
                                        }}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`h-7 w-7 transition-all ${
                                          techniqueValidation[message.id + "_detected"] === false
                                            ? "bg-red-500 text-white hover:bg-red-600"
                                            : "hover:bg-red-100 hover:text-red-700 border border-red-300"
                                        }`}
                                        onClick={() => {
                                          setTechniqueValidation((prev) => ({ ...prev, [message.id + "_detected"]: false }));
                                          setShowFeedbackInput((prev) => ({ ...prev, [message.id + "_detected"]: true }));
                                        }}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {showFeedbackInput[message.id + "_detected"] && (
                                  <div className="space-y-2 mt-3">
                                    <Input
                                      placeholder="Waarom is de gedetecteerde techniek incorrect?"
                                      value={feedbackText[message.id + "_detected"] || ""}
                                      onChange={(e) =>
                                        setFeedbackText((prev) => ({ ...prev, [message.id + "_detected"]: e.target.value }))
                                      }
                                      className="text-[13px] border-hh-border"
                                    />
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-hh-muted hover:text-hh-text"
                                        onClick={() => {
                                          setShowFeedbackInput((prev) => ({ ...prev, [message.id + "_detected"]: false }));
                                          setTechniqueValidation((prev) => ({ ...prev, [message.id + "_detected"]: null }));
                                          setFeedbackText((prev) => ({ ...prev, [message.id + "_detected"]: "" }));
                                        }}
                                      >
                                        Annuleer
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 border-hh-border text-hh-ink hover:bg-hh-ui-50"
                                        onClick={async () => {
                                          const success = await flagAsIncorrect(message, feedbackText[message.id + "_detected"], true);
                                          if (success) {
                                            setShowFeedbackInput((prev) => ({ ...prev, [message.id + "_detected"]: false }));
                                            setFeedbackText((prev) => ({ ...prev, [message.id + "_detected"]: "" }));
                                          }
                                        }}
                                        disabled={!feedbackText[message.id + "_detected"]?.trim()}
                                      >
                                        Verzend
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Collapsible sections for Hugo */}
                              {/* Persona */}
                              <div className="pt-4 border-t border-hh-border/50">
                                <button
                                  onClick={() => toggleDebugSection(message.id, "persona")}
                                  className="flex items-center gap-2 text-[13px] font-bold text-hh-ink hover:text-purple-600 w-full"
                                >
                                  {isDebugSectionExpanded(message.id, "persona") ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  Persona
                                </button>
                                {isDebugSectionExpanded(message.id, "persona") && (
                                  <div className="mt-3 ml-6 grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[12px]">
                                    <span className="text-hh-muted font-medium">Gedragsstijl:</span>
                                    <span className="text-hh-ink">{message.debugInfo.persona.gedragsstijl}</span>
                                    <span className="text-hh-muted font-medium">Buying Clock:</span>
                                    <span className="text-hh-ink">{message.debugInfo.persona.koopklok}</span>
                                    <span className="text-hh-muted font-medium">Difficulty:</span>
                                    <span className="text-hh-ink">{message.debugInfo.persona.moeilijkheid}</span>
                                  </div>
                                )}
                              </div>

                              {/* Verzamelde Context */}
                              <div>
                                <button
                                  onClick={() => toggleDebugSection(message.id, "context")}
                                  className="flex items-center gap-2 text-[13px] font-bold text-hh-ink hover:text-purple-600 w-full"
                                >
                                  {isDebugSectionExpanded(message.id, "context") ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  Verzamelde Context
                                </button>
                                {isDebugSectionExpanded(message.id, "context") && message.debugInfo.context && (
                                  <div className="mt-3 ml-6 grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[12px]">
                                    {message.debugInfo.context.gathered?.sector && (
                                      <>
                                        <span className="text-hh-muted font-medium">Sector:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.sector}</span>
                                      </>
                                    )}
                                    {message.debugInfo.context.gathered?.product && (
                                      <>
                                        <span className="text-hh-muted font-medium">Product:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.product}</span>
                                      </>
                                    )}
                                    {message.debugInfo.context.gathered?.klantType && (
                                      <>
                                        <span className="text-hh-muted font-medium">Klant Type:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.klantType}</span>
                                      </>
                                    )}
                                    {message.debugInfo.context.gathered?.verkoopkanaal && (
                                      <>
                                        <span className="text-hh-muted font-medium">Verkoopkanaal:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.verkoopkanaal}</span>
                                      </>
                                    )}
                                    {!message.debugInfo.context.gathered?.sector && 
                                     !message.debugInfo.context.gathered?.product && 
                                     !message.debugInfo.context.gathered?.klantType && (
                                      <span className="col-span-2 text-hh-muted italic">Nog geen context verzameld</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Customer Dynamics */}
                              <div>
                                <button
                                  onClick={() => toggleDebugSection(message.id, "dynamics")}
                                  className="flex items-center gap-2 text-[13px] font-bold text-hh-ink hover:text-purple-600 w-full"
                                >
                                  {isDebugSectionExpanded(message.id, "dynamics") ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  Customer Dynamics
                                </button>
                                {isDebugSectionExpanded(message.id, "dynamics") && (
                                  <div className="mt-3 ml-6 grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[12px]">
                                    <span className="text-hh-muted font-medium">Rapport:</span>
                                    <span className="text-hh-ink">
                                      {message.debugInfo.customerDynamics.rapport}%
                                      <span className="text-hh-muted ml-1">
                                        ({message.debugInfo.customerDynamics.rapport >= 60 ? "hoog" : message.debugInfo.customerDynamics.rapport >= 40 ? "midden" : "laag"})
                                      </span>
                                    </span>
                                    <span className="text-hh-muted font-medium">Value Tension:</span>
                                    <span className="text-hh-ink">
                                      {message.debugInfo.customerDynamics.valueTension}%
                                      <span className="text-hh-muted ml-1">
                                        ({message.debugInfo.customerDynamics.valueTension >= 60 ? "hoog" : message.debugInfo.customerDynamics.valueTension >= 40 ? "midden" : "laag"})
                                      </span>
                                    </span>
                                    <span className="text-hh-muted font-medium">Commit Readiness:</span>
                                    <span className="text-hh-ink">
                                      {message.debugInfo.customerDynamics.commitReadiness}%
                                      <span className="text-hh-muted ml-1">
                                        ({message.debugInfo.customerDynamics.commitReadiness >= 60 ? "hoog" : message.debugInfo.customerDynamics.commitReadiness >= 40 ? "midden" : "laag"})
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* For AI/Customer messages */}
                          {message.sender === "ai" && (
                            <div className="space-y-4">
                              {/* Klant Signaal + EPIC Fase + Evaluatie */}
                              <div className="space-y-2 text-[12px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-hh-muted font-medium">Klant Signaal:</span>
                                  <Badge className={`text-[11px] ${
                                    message.debugInfo.klantSignaal === "positief" 
                                      ? "bg-green-100 text-green-700 border-green-300"
                                      : message.debugInfo.klantSignaal === "negatief"
                                      ? "bg-red-100 text-red-700 border-red-300"
                                      : "bg-hh-ui-100 text-hh-ink border-hh-border"
                                  }`}>
                                    {message.debugInfo.klantSignaal || "neutraal"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-hh-muted font-medium">EPIC Fase:</span>
                                  <Badge variant="outline" className="text-[11px] bg-hh-ui-100 text-hh-ink border-hh-border">
                                    {message.debugInfo.aiDecision?.epicFase || "onbekend"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-hh-muted font-medium">Evaluatie:</span>
                                  <Badge variant="outline" className={`text-[11px] ${
                                    (message.debugInfo.aiDecision?.evaluatie as string) === "positief" || (message.debugInfo.aiDecision?.evaluatie as string) === "perfect"
                                      ? "bg-green-100 text-green-700 border-green-300"
                                      : message.debugInfo.aiDecision?.evaluatie === "gemist"
                                      ? "bg-red-100 text-red-700 border-red-300"
                                      : "bg-hh-ui-100 text-hh-ink border-hh-border"
                                  }`}>
                                    {message.debugInfo.aiDecision?.evaluatie || "neutraal"}
                                  </Badge>
                                </div>
                              </div>

                              {/* Verwachte techniek (for AI messages) */}
                              {message.debugInfo.expectedTechnique && (
                                <div>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 pb-3 border-b border-purple-200">
                                      <p className="text-[12px] text-hh-muted font-medium mb-1">Verwachte techniek:</p>
                                      <p className="text-hh-ink text-[12px]">
                                        {message.debugInfo.expectedTechnique}
                                      </p>
                                    </div>
                                    {/* Validation buttons ✓/✗ for AI messages too */}
                                    {!showFeedbackInput[message.id] && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className={`h-7 w-7 transition-all ${
                                            techniqueValidation[message.id] === true
                                              ? "bg-green-500 text-white hover:bg-green-600"
                                              : "hover:bg-green-100 hover:text-green-700 border border-green-300"
                                          }`}
                                          onClick={async () => {
                                            const success = await saveAsGoldenStandard(message, false);
                                            if (success) {
                                              setTechniqueValidation((prev) => ({ ...prev, [message.id]: true }));
                                              setShowFeedbackInput((prev) => ({ ...prev, [message.id]: false }));
                                            }
                                          }}
                                        >
                                          <Check className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className={`h-7 w-7 transition-all ${
                                            techniqueValidation[message.id] === false
                                              ? "bg-red-500 text-white hover:bg-red-600"
                                              : "hover:bg-red-100 hover:text-red-700 border border-red-300"
                                          }`}
                                          onClick={() => {
                                            setTechniqueValidation((prev) => ({ ...prev, [message.id]: false }));
                                            setShowFeedbackInput((prev) => ({ ...prev, [message.id]: true }));
                                          }}
                                        >
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  {showFeedbackInput[message.id] && (
                                    <div className="space-y-2 mt-3">
                                      <Input
                                        placeholder="Waarom is de verwachte techniek incorrect?"
                                        value={feedbackText[message.id] || ""}
                                        onChange={(e) =>
                                          setFeedbackText((prev) => ({ ...prev, [message.id]: e.target.value }))
                                        }
                                        className="text-[13px] border-hh-border"
                                      />
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 text-hh-muted hover:text-hh-text"
                                          onClick={() => {
                                            setShowFeedbackInput((prev) => ({ ...prev, [message.id]: false }));
                                            setTechniqueValidation((prev) => ({ ...prev, [message.id]: null }));
                                            setFeedbackText((prev) => ({ ...prev, [message.id]: "" }));
                                          }}
                                        >
                                          Annuleer
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 border-hh-border text-hh-ink hover:bg-hh-ui-50"
                                          onClick={async () => {
                                            const success = await flagAsIncorrect(message, feedbackText[message.id], false);
                                            if (success) {
                                              setShowFeedbackInput((prev) => ({ ...prev, [message.id]: false }));
                                              setFeedbackText((prev) => ({ ...prev, [message.id]: "" }));
                                            }
                                          }}
                                          disabled={!feedbackText[message.id]?.trim()}
                                        >
                                          Verzend
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Gedetecteerde techniek (for AI messages) */}
                              {message.debugInfo.expectedTechnique && (
                                <div className="grid grid-cols-[120px_1fr] gap-x-3 text-[12px] pb-3 border-b border-hh-border">
                                  <span className="text-hh-muted font-medium">Gedetecteerde techniek:</span>
                                  <span className="text-hh-ink">
                                    {message.debugInfo.expectedTechnique}
                                    <span className="ml-2 text-green-600 font-semibold">
                                      (+10)
                                    </span>
                                  </span>
                                </div>
                              )}

                              {/* Collapsible sections for AI */}
                              {/* Persona */}
                              <div>
                                <button
                                  onClick={() => toggleDebugSection(message.id, "persona")}
                                  className="flex items-center gap-2 text-[13px] font-bold text-hh-ink hover:text-purple-600 w-full"
                                >
                                  {isDebugSectionExpanded(message.id, "persona") ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  Persona
                                </button>
                                {isDebugSectionExpanded(message.id, "persona") && (
                                  <div className="mt-3 ml-6 grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[12px]">
                                    <span className="text-hh-muted font-medium">Gedragsstijl:</span>
                                    <span className="text-hh-ink">{message.debugInfo.persona.gedragsstijl}</span>
                                    <span className="text-hh-muted font-medium">Buying Clock:</span>
                                    <span className="text-hh-ink">{message.debugInfo.persona.koopklok}</span>
                                    <span className="text-hh-muted font-medium">Difficulty:</span>
                                    <span className="text-hh-ink">{message.debugInfo.persona.moeilijkheid}</span>
                                  </div>
                                )}
                              </div>

                              {/* Verzamelde Context */}
                              <div>
                                <button
                                  onClick={() => toggleDebugSection(message.id, "context")}
                                  className="flex items-center gap-2 text-[13px] font-bold text-hh-ink hover:text-purple-600 w-full"
                                >
                                  {isDebugSectionExpanded(message.id, "context") ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  Verzamelde Context
                                </button>
                                {isDebugSectionExpanded(message.id, "context") && message.debugInfo.context && (
                                  <div className="mt-3 ml-6 grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[12px]">
                                    {message.debugInfo.context.gathered?.sector && (
                                      <>
                                        <span className="text-hh-muted font-medium">Sector:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.sector}</span>
                                      </>
                                    )}
                                    {message.debugInfo.context.gathered?.product && (
                                      <>
                                        <span className="text-hh-muted font-medium">Product:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.product}</span>
                                      </>
                                    )}
                                    {message.debugInfo.context.gathered?.klantType && (
                                      <>
                                        <span className="text-hh-muted font-medium">Klant Type:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.klantType}</span>
                                      </>
                                    )}
                                    {message.debugInfo.context.gathered?.verkoopkanaal && (
                                      <>
                                        <span className="text-hh-muted font-medium">Verkoopkanaal:</span>
                                        <span className="text-hh-ink">{message.debugInfo.context.gathered.verkoopkanaal}</span>
                                      </>
                                    )}
                                    {!message.debugInfo.context.gathered?.sector && 
                                     !message.debugInfo.context.gathered?.product && 
                                     !message.debugInfo.context.gathered?.klantType && (
                                      <span className="col-span-2 text-hh-muted italic">Nog geen context verzameld</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Customer Dynamics */}
                              <div>
                                <button
                                  onClick={() => toggleDebugSection(message.id, "dynamics")}
                                  className="flex items-center gap-2 text-[13px] font-bold text-hh-ink hover:text-purple-600 w-full"
                                >
                                  {isDebugSectionExpanded(message.id, "dynamics") ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  Customer Dynamics
                                </button>
                                {isDebugSectionExpanded(message.id, "dynamics") && (
                                  <div className="mt-3 ml-6 grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-[12px]">
                                    <span className="text-hh-muted font-medium">Rapport:</span>
                                    <span className="text-hh-ink">
                                      {message.debugInfo.customerDynamics.rapport}%
                                      <span className="text-hh-muted ml-1">
                                        ({message.debugInfo.customerDynamics.rapport >= 60 ? "hoog" : message.debugInfo.customerDynamics.rapport >= 40 ? "midden" : "laag"})
                                      </span>
                                    </span>
                                    <span className="text-hh-muted font-medium">Value Tension:</span>
                                    <span className="text-hh-ink">
                                      {message.debugInfo.customerDynamics.valueTension}%
                                      <span className="text-hh-muted ml-1">
                                        ({message.debugInfo.customerDynamics.valueTension >= 60 ? "hoog" : message.debugInfo.customerDynamics.valueTension >= 40 ? "midden" : "laag"})
                                      </span>
                                    </span>
                                    <span className="text-hh-muted font-medium">Commit Readiness:</span>
                                    <span className="text-hh-ink">
                                      {message.debugInfo.customerDynamics.commitReadiness}%
                                      <span className="text-hh-muted ml-1">
                                        ({message.debugInfo.customerDynamics.commitReadiness >= 60 ? "hoog" : message.debugInfo.customerDynamics.commitReadiness >= 40 ? "midden" : "laag"})
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* AI Prompt & Grounding */}
                              <div>
                                <button
                                  onClick={() => toggleDebugSection(message.id, "aiPrompt")}
                                  className="flex items-center gap-2 text-[13px] font-bold text-hh-ink hover:text-purple-600 w-full"
                                >
                                  {isDebugSectionExpanded(message.id, "aiPrompt") ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  AI Prompt & Grounding
                                </button>
                                {isDebugSectionExpanded(message.id, "aiPrompt") && (
                                  <div className="mt-3 ml-6 space-y-3 text-[12px]">
                                    {message.debugInfo.promptsUsed?.systemPrompt ? (
                                      <>
                                        <div>
                                          <p className="text-hh-muted font-medium mb-1">System Prompt:</p>
                                          <pre className="bg-hh-ui-100 p-2 rounded text-[11px] max-h-[200px] overflow-auto whitespace-pre-wrap break-words text-hh-ink">
                                            {message.debugInfo.promptsUsed.systemPrompt.slice(0, 2000)}
                                            {message.debugInfo.promptsUsed.systemPrompt.length > 2000 && "... [truncated]"}
                                          </pre>
                                        </div>
                                        {message.debugInfo.promptsUsed.userPrompt && (
                                          <div>
                                            <p className="text-hh-muted font-medium mb-1">User Prompt:</p>
                                            <pre className="bg-hh-ui-100 p-2 rounded text-[11px] max-h-[100px] overflow-auto whitespace-pre-wrap break-words text-hh-ink">
                                              {message.debugInfo.promptsUsed.userPrompt}
                                            </pre>
                                          </div>
                                        )}
                                        {message.debugInfo.ragDocuments && message.debugInfo.ragDocuments.length > 0 && (
                                          <div>
                                            <p className="text-hh-muted font-medium mb-1">RAG Documents ({message.debugInfo.ragDocuments.length}):</p>
                                            <div className="space-y-1">
                                              {message.debugInfo.ragDocuments.map((doc, idx) => (
                                                <div key={idx} className="bg-blue-600/10 p-2 rounded border border-blue-600/20">
                                                  <p className="font-medium text-blue-800 text-[11px]">{doc.title || `Document ${idx + 1}`}</p>
                                                  <p className="text-blue-600 text-[10px]">{doc.content?.slice(0, 200)}...</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-[11px] text-hh-muted italic">Geen prompt data beschikbaar</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>
          )}

          {/* Input - only show in chat mode */}
          {chatMode === "chat" && (
          <div className="p-4 border-t border-hh-border">
            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-hh-border bg-hh-ui-50 text-[12px]">
                    {file.preview ? (
                      <img src={file.preview} alt={file.name} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <File className="w-3.5 h-3.5 text-hh-muted" />
                    )}
                    <span className="text-hh-muted max-w-[120px] truncate">{file.name}</span>
                    <span className="text-hh-muted">{formatFileSize(file.size)}</span>
                    <button onClick={() => removeAttachedFile(file.id)} className="text-hh-muted hover:text-red-500 ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-center">
              {/* Paperclip - file upload */}
              <button
                onClick={() => handleFileSelect("*/*")}
                className="p-2 rounded-md text-hh-muted hover:text-purple-600 hover:bg-purple-600/10 transition-colors flex-shrink-0"
                title="Bestand bijvoegen"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileInputChange}
              />
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendMessage()}
                placeholder={isLoading ? "Hugo denkt na..." : "Typ je bericht..."}
                className="flex-1 min-w-0 text-hh-ink bg-hh-bg"
                disabled={isLoading}
              />
              {/* Microphone - dictation */}
              <button
                onClick={handleDictation}
                className="p-2 rounded-md transition-colors flex-shrink-0"
                style={{
                  color: isRecording ? '#ef4444' : '#94a3b8',
                  backgroundColor: isRecording ? 'rgba(239,68,68,0.1)' : undefined,
                }}
                title={isRecording ? "Opname stoppen" : "Dicteren"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              {/* Send button with "Verzend" text */}
              <Button 
                onClick={handleSendMessage} 
                className="flex-shrink-0 text-white gap-1.5 px-4"
                style={{ backgroundColor: '#9910FA' }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#7B0DD4')}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#9910FA')}
                disabled={!inputText.trim() || isLoading}
                title="Verzend"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="text-[13px]">Verzend</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          )}
        </div>
        </div>
      </div>

      {/* Stop Roleplay Confirmation Dialog */}
      <StopRoleplayDialog
        open={stopRoleplayDialogOpen}
        onOpenChange={setStopRoleplayDialogOpen}
        onConfirm={confirmStopRoleplay}
      />

      {/* Technique Details Dialog */}
      <TechniqueDetailsDialog
        open={techniqueDetailsPanelOpen}
        onOpenChange={setTechniqueDetailsPanelOpen}
        technique={selectedTechniqueDetails}
        isEditable={true}
        isAdmin={true}
        onSave={(updatedTechnique) => {
          console.log("Technique updated:", updatedTechnique);
          // TODO: Save to backend
        }}
      />
    </AdminLayout>
  );
}
