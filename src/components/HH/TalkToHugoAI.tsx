/**
 * TODO: HEYGEN-VIDEO-FIX
 * ----------------------
 * Issue: MediaStream van HeyGen avatar wordt niet correct aan video element gekoppeld.
 * Status: Skipped (user fixing in original replit first)
 * 
 * Bron: NIET IN ZIP - HeyGen integratie is frontend-specifiek
 * Gebruiker fixt dit eerst in originele replit, daarna code overnemen.
 * 
 * Symptomen:
 * - STREAM_READY event fires maar event.detail is leeg
 * - avatar.mediaStream property bestaat maar video toont niet
 * - "Spreekt" badge verschijnt maar geen audio/video output
 * 
 * Aanpak (wanneer opgepakt):
 * 1. Neem werkende code over van originele replit
 * 2. Check of avatar.mediaStream een valid MediaStream is na createStartAvatar()
 * 3. Explicit play() call na metadata loaded
 * 
 * Frontend koppeling: Dit IS de frontend component
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "../../contexts/UserContext";
import { renderSimpleMarkdown } from "../../utils/renderMarkdown";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { StopRoleplayDialog } from "./StopRoleplayDialog";
import { TechniqueDetailsDialog } from "./TechniqueDetailsDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import {
  Send,
  MessageSquare,
  Phone,
  Video,
  Mic,
  MicOff,
  Volume2,
  X,
  Clock,
  Sparkles,
  Loader2,
  MessageCircle,
  Award,
  RotateCcw,
  AlertCircle,
  Lightbulb,
  Menu,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Plus,
  FileText,
  Image,
  FileAudio,
  Paperclip,
  File,
} from "lucide-react";
import technieken_index from "../../data/technieken_index";
import { KLANT_HOUDINGEN } from "../../data/klant_houdingen";
import { EPICSidebar } from "./AdminChatExpertModeSidebar";
import { EpicSlideCard } from "./EpicSlideCard";
import { InlineVideoPlayer } from "./InlineVideoPlayer";
import { InlineWebinarCard } from "./InlineWebinarCard";
import { InlineAnalysisCard } from "./InlineAnalysisCard";
import type { EpicSlideContent, VideoEmbed, WebinarLink, AnalysisResultEmbed, RichContent } from "@/types/crossPlatform";
import { hugoApi, type AssistanceConfig } from "../../services/hugoApi";
import { lastActivityService } from "../../services/lastActivityService";
import StreamingAvatar, { AvatarQuality, StreamingEvents, TaskType } from "@heygen/streaming-avatar";
import { Room, RoomEvent, Track, ConnectionState } from "livekit-client";

interface MessageDebugInfo {
  houding?: string;
  expectedTechnique?: string;
  expectedTechniqueId?: string;
  detectedSignals?: string[];
}

interface FileAttachment {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  preview?: string;
}

interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
}

interface Message {
  id: string;
  sender: "hugo" | "ai";
  text: string;
  timestamp: Date;
  technique?: string;
  debugInfo?: MessageDebugInfo;
  feedback?: "up" | "down" | null;
  attachments?: MessageAttachment[];
  isTranscriptReplay?: boolean;
  transcriptRole?: string;
  richContent?: import("@/types/crossPlatform").RichContent[];
}

type ChatMode = "chat" | "audio" | "video";

interface TalkToHugoAIProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  navigationData?: Record<string, any>;
  onboardingMode?: boolean;
  adminViewMode?: boolean;
}

export function TalkToHugoAI({
  navigate,
  isAdmin,
  navigationData,
  onboardingMode,
  adminViewMode = false,
}: TalkToHugoAIProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedTechnique, setSelectedTechnique] = useState<string>("");
  const [selectedTechniqueName, setSelectedTechniqueName] = useState<string>("");
  const [currentPhase, setCurrentPhase] = useState(1);
  const [expandedPhases, setExpandedPhases] = useState<number[]>([1]);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  const [expandedHoudingen, setExpandedHoudingen] = useState<string[]>([]);
  const [techniqueDetailsPanelOpen, setTechniqueDetailsPanelOpen] = useState(false);
  const [selectedTechniqueDetails, setSelectedTechniqueDetails] = useState<any | null>(null);
  const [fasesAccordionOpen, setFasesAccordionOpen] = useState(true);
  const [houdingenAccordionOpen, setHoudingenAccordionOpen] = useState(false);
  const [activeHouding, setActiveHouding] = useState<string | null>(null);
  const [recommendedTechnique, setRecommendedTechnique] = useState<string | null>(null);
  const [difficultyLevel, setDifficultyLevel] = useState<string>("onbewuste_onkunde");
  const [assistanceConfig, setAssistanceConfig] = useState<AssistanceConfig>({
    showHouding: true,
    showExpectedTechnique: true,
    showStepIndicators: true,
    showTipButton: true,
    showExamples: true,
    blindPlay: false,
  });
  const [levelTransitionMessage, setLevelTransitionMessage] = useState<string | null>(null);
  const [stopRoleplayDialogOpen, setStopRoleplayDialogOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpenRaw] = useState(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('epic') === '1'
  );
  const setDesktopSidebarOpen = (open: boolean) => {
    setDesktopSidebarOpenRaw(open);
    window.dispatchEvent(new CustomEvent('sidebar-collapse-request', { detail: { collapsed: open } }));
  };
  useEffect(() => {
    if (desktopSidebarOpen) {
      window.dispatchEvent(new CustomEvent('sidebar-collapse-request', { detail: { collapsed: true } }));
    }
  }, []);
  const [activeHelpMessageId, setActiveHelpMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("chat");
  const [sessionTimer, setSessionTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [useStreaming, setUseStreaming] = useState(true);
  const streamingTextRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [onboardingStatus, setOnboardingStatus] = useState<{
    technieken: { total: number; reviewed: number; pending: number };
    houdingen: { total: number; reviewed: number; pending: number };
    isComplete: boolean;
    nextItem: { module: string; key: string; name: string } | null;
  } | null>(null);
  const [onboardingFeedbackInput, setOnboardingFeedbackInput] = useState<string | null>(null);
  const [onboardingCurrentItem, setOnboardingCurrentItem] = useState<{ module: string; key: string; name: string } | null>(null);

  // HeyGen Streaming Avatar state
  const [heygenToken, setHeygenToken] = useState<string | null>(null);
  const [avatarSession, setAvatarSession] = useState<StreamingAvatar | null>(null);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  // LiveKit Audio state
  const [liveKitRoom, setLiveKitRoom] = useState<Room | null>(null);
  const [isAudioConnecting, setIsAudioConnecting] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [audioConnectionState, setAudioConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

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
      }
    };
    loadUserLevel();
  }, []);

  // Hugo starts conversation proactively based on cross-platform activity
  useEffect(() => {
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
            turns.forEach((turn, i) => {
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

          const fullTranscriptText = turns.map(t =>
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
                isExpert: false,
                modality: "chat",
                viewMode: 'user',
              });
              const response = await hugoApi.sendMessage(userMessage, false, systemContext);
              setMessages(prev => [...prev, {
                id: `practice-ai-${Date.now()}`,
                sender: "ai",
                text: response.response || "Ik ben klaar om verder te spelen als de klant. Geef jouw reactie!",
                timestamp: new Date(),
              }]);
            } catch (err) {
              setMessages(prev => [...prev, {
                id: `practice-ai-${Date.now()}`,
                sender: "ai",
                text: `Ik speel de klant uit "${ctx.analysisTitle || ctx.practiceLabel}". Geef maar een betere reactie — ik reageer als de klant.`,
                timestamp: new Date(),
              }]);
            } finally {
              setIsLoading(false);
            }
          })();
          console.log("[Hugo] Practice context loaded from analysis:", ctx.practiceLabel, "turns:", turns.length);
          return;
        }
      } catch (e) {
        console.error("[Hugo] Failed to parse practice context:", e);
      }
    }

    if (navigationData?.analysisDiscussion) {
      const ctx = navigationData;
      const title = ctx.title || 'je analyse';
      const score = ctx.overallScore;
      
      let welcomeText = `Ik heb de analyse van **"${title}"** bekeken.`;
      if (score !== undefined) {
        welcomeText += ` De overall score is **${score}/100**.`;
      }
      welcomeText += `\n\n`;
      
      if (ctx.strengths?.length > 0) {
        welcomeText += `**Sterke punten:**\n`;
        ctx.strengths.forEach((s: any) => {
          welcomeText += `- ${s.text}\n`;
        });
        welcomeText += `\n`;
      }
      if (ctx.improvements?.length > 0) {
        welcomeText += `**Verbeterpunten:**\n`;
        ctx.improvements.forEach((imp: any) => {
          welcomeText += `- ${imp.text}\n`;
        });
        welcomeText += `\n`;
      }
      
      welcomeText += `Wat wil je bespreken? Ik kan dieper ingaan op een specifiek punt, een oefening voorstellen, of tips geven voor verbetering.`;
      
      setMessages([{
        id: `analysis-discuss-${Date.now()}`,
        sender: "ai",
        text: welcomeText,
        timestamp: new Date(),
      }]);
      console.log("[Hugo] Analysis discussion loaded for:", title);
      return;
    }

    const loadPersonalizedWelcome = async () => {
      if (isAdmin && adminViewMode) {
        try {
          setIsLoading(true);

          const welcomeMsg: Message = {
            id: `admin-welcome-${Date.now()}`,
            sender: "ai",
            text: "",
            timestamp: new Date(),
          };
          setMessages([welcomeMsg]);

          await hugoApi.startSessionStream(
            {
              techniqueId: 'general',
              mode: 'COACH_CHAT',
              isExpert: false,
              modality: 'chat',
              viewMode: 'admin',
            },
            (token) => {
              setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.id === welcomeMsg.id) {
                  updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + token };
                }
                return updated;
              });
            },
            (meta) => {
              if (meta?.onboardingStatus) {
                setOnboardingStatus(meta.onboardingStatus);
                if (meta.onboardingStatus.nextItem) {
                  setOnboardingCurrentItem(meta.onboardingStatus.nextItem);
                }
              }
            }
          );
          setHasActiveSession(true);
          console.log("[Hugo] Admin streaming session started");
        } catch (e) {
          console.warn("[Hugo] Failed to start admin session:", e);
          setMessages([{
            id: `welcome-${Date.now()}`,
            sender: "ai",
            text: "Dag Hugo! Welkom op je platform. Waarmee kan ik je helpen?",
            timestamp: new Date(),
          }]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      try {
        const endpoint = `/api/v2/user/welcome${user?.id ? `?userId=${user.id}` : ''}`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setMessages([{
            id: `welcome-${Date.now()}`,
            sender: "ai",
            text: data.welcomeMessage,
            timestamp: new Date(),
          }]);
          console.log("[Hugo] User welcome loaded, userId:", user?.id);
          return;
        }
      } catch (e) {
        console.warn("[Hugo] Failed to load user welcome, falling back:", e);
      }
      const { message, summary } = await lastActivityService.getPersonalizedWelcome(user?.id || null);
      setMessages([{
        id: `welcome-${Date.now()}`,
        sender: "ai",
        text: message,
        timestamp: new Date(),
      }]);
    };
    loadPersonalizedWelcome();
  }, [user?.id, navigationData, isAdmin, adminViewMode]);

  useEffect(() => {
    if (selectedTechnique || audioConnectionState === ConnectionState.Connected) {
      timerRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedTechnique, audioConnectionState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize HeyGen avatar session
  const initHeygenAvatar = useCallback(async () => {
    if (avatarSession) return;
    
    setIsAvatarLoading(true);
    setAvatarError(null);
    
    try {
      // Fetch token and avatarId from backend
      const tokenResponse = await fetch("/api/heygen/token", { method: "POST" });
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errorData.details || "Kon HeyGen token niet ophalen");
      }
      const { token, avatarId } = await tokenResponse.json();
      setHeygenToken(token);
      
      console.log("[HeyGen] Token received, avatarId:", avatarId || "not configured");
      
      // Create avatar instance
      const avatar = new StreamingAvatar({ token });
      
      // Setup event listeners
      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setIsAvatarSpeaking(true);
      });
      
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setIsAvatarSpeaking(false);
      });
      
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("[HeyGen] Stream disconnected");
        setAvatarSession(null);
      });
      
      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
        console.log("[HeyGen] Stream ready, event:", event);
        // Try multiple ways to get the stream
        const stream = event.detail?.stream || event.detail || (avatar as any).mediaStream;
        console.log("[HeyGen] Stream object:", stream, "typeof:", typeof stream);
        console.log("[HeyGen] Avatar properties:", Object.keys(avatar));
        
        if (videoRef.current && stream instanceof MediaStream) {
          console.log("[HeyGen] Attaching MediaStream to video element");
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("[HeyGen] Play error:", e));
          };
        } else {
          console.warn("[HeyGen] MediaStream not found in event, will try from avatar instance after start");
        }
      });
      
      // Start avatar session - use custom avatar from backend or fallback to public avatar
      const avatarName = avatarId || "Shawn_Therapist_public";
      console.log("[HeyGen] Starting avatar session with:", avatarName);
      
      const sessionData = await avatar.createStartAvatar({
        quality: AvatarQuality.Medium,
        avatarName: avatarName,
        language: "nl",
      });
      
      console.log("[HeyGen] Session data:", sessionData);
      console.log("[HeyGen] Avatar after start:", Object.keys(avatar));
      
      // Get mediaStream from avatar instance - this is how HeyGen SDK exposes the stream
      const avatarStream = (avatar as any).mediaStream;
      console.log("[HeyGen] Avatar mediaStream:", avatarStream);
      console.log("[HeyGen] Is MediaStream?", avatarStream instanceof MediaStream);
      
      if (videoRef.current && avatarStream) {
        console.log("[HeyGen] Attaching mediaStream to video element");
        videoRef.current.srcObject = avatarStream;
        videoRef.current.onloadedmetadata = () => {
          console.log("[HeyGen] Video metadata loaded, calling play()");
          videoRef.current?.play().catch(e => console.error("[HeyGen] Play error:", e));
        };
      } else {
        console.error("[HeyGen] Failed to get mediaStream from avatar:", { 
          hasVideoRef: !!videoRef.current, 
          hasStream: !!avatarStream,
          avatarKeys: Object.keys(avatar)
        });
      }
      
      setAvatarSession(avatar);
      console.log("[HeyGen] Avatar session started successfully");
    } catch (error: any) {
      console.error("[HeyGen] Error:", error);
      setAvatarError(error.message || "Kon video avatar niet starten");
    } finally {
      setIsAvatarLoading(false);
    }
  }, [avatarSession]);
  
  // Stop HeyGen avatar session
  const stopHeygenAvatar = useCallback(async () => {
    // Clean up video stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (avatarSession) {
      try {
        await avatarSession.stopAvatar();
      } catch (error) {
        console.error("[HeyGen] Stop error:", error);
      }
      setAvatarSession(null);
    }
  }, [avatarSession]);
  
  // Make avatar speak
  const avatarSpeak = useCallback(async (text: string) => {
    if (!avatarSession) return;
    
    try {
      await avatarSession.speak({
        text,
        taskType: TaskType.REPEAT,
      });
    } catch (error) {
      console.error("[HeyGen] Speak error:", error);
    }
  }, [avatarSession]);

  // Initialize LiveKit audio session
  const initLiveKitAudio = useCallback(async () => {
    if (liveKitRoom?.state === ConnectionState.Connected) return;
    
    setIsAudioConnecting(true);
    setAudioError(null);
    
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get token from backend
      const response = await fetch("/api/livekit/token", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techniqueId: selectedTechnique || "general" })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Kon LiveKit niet initialiseren");
      }
      
      const data = await response.json();
      const token = data.token;
      const url = data.livekitUrl || data.url;
      
      if (!url) {
        throw new Error("Geen LiveKit URL ontvangen van server");
      }
      
      // Create and connect room
      const room = new Room();
      
      // Setup event listeners
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log("[LiveKit] Connection state:", state);
        setAudioConnectionState(state);
        if (state === ConnectionState.Connected) {
          setIsAudioConnecting(false);
        }
      });
      
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log("[LiveKit] Track subscribed:", track.kind);
        if (track.kind === Track.Kind.Audio) {
          // Attach audio track
          const audioElement = track.attach();
          audioElement.id = "livekit-agent-audio";
          document.body.appendChild(audioElement);
          audioElementRef.current = audioElement;
        }
      });
      
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach();
        }
      });
      
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // Check if agent is speaking (any remote participant)
        const agentSpeaking = speakers.some(s => !s.isLocal);
        setIsAgentSpeaking(agentSpeaking);
      });
      
      room.on(RoomEvent.Disconnected, () => {
        console.log("[LiveKit] Disconnected");
        setAudioConnectionState(ConnectionState.Disconnected);
      });
      
      // Connect to room
      await room.connect(url, token);
      console.log("[LiveKit] Connected to room");
      
      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log("[LiveKit] Microphone enabled");
      
      setLiveKitRoom(room);
      
    } catch (error: any) {
      console.error("[LiveKit] Error:", error);
      setAudioError(error.message || "Kon audio niet starten. Controleer microfoontoegang.");
      setIsAudioConnecting(false);
    }
  }, [liveKitRoom, selectedTechnique]);
  
  // Stop LiveKit audio session
  const stopLiveKitAudio = useCallback(async () => {
    // Clean up audio element
    if (audioElementRef.current) {
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }
    
    if (liveKitRoom) {
      await liveKitRoom.disconnect();
      setLiveKitRoom(null);
      setAudioConnectionState(ConnectionState.Disconnected);
    }
  }, [liveKitRoom]);

  // Handle chat mode change
  useEffect(() => {
    if (chatMode === "video" && !avatarSession && !isAvatarLoading) {
      initHeygenAvatar();
    } else if (chatMode === "audio" && audioConnectionState === ConnectionState.Disconnected && !isAudioConnecting) {
      initLiveKitAudio();
    }
  }, [chatMode, avatarSession, isAvatarLoading, audioConnectionState, isAudioConnecting, initHeygenAvatar, initLiveKitAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeygenAvatar();
      stopLiveKitAudio();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [stopHeygenAvatar, stopLiveKitAudio]);
  
  // Handle mute toggle for LiveKit
  useEffect(() => {
    if (liveKitRoom && liveKitRoom.state === ConnectionState.Connected) {
      liveKitRoom.localParticipant.setMicrophoneEnabled(!isMuted);
    }
  }, [isMuted, liveKitRoom]);

  // Wire avatar speaking to new AI messages in video mode
  useEffect(() => {
    if (chatMode !== "video" || !avatarSession || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    // Only speak if this is a new AI message we haven't spoken yet
    if (lastMessage.sender === "ai" && lastMessage.id !== lastSpokenMessageIdRef.current) {
      lastSpokenMessageIdRef.current = lastMessage.id;
      // Limit text length for avatar speech (HeyGen has limits)
      const textToSpeak = lastMessage.text.slice(0, 500);
      avatarSpeak(textToSpeak);
    }
  }, [messages, chatMode, avatarSession, avatarSpeak]);

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

  const klantHoudingenArray = Object.entries(KLANT_HOUDINGEN.houdingen).map(([key, houding]) => ({
    id: houding.id,
    key: key,
    naam: houding.naam,
    beschrijving: houding.houding_beschrijving,
    technieken: [...(houding.recommended_technique_ids || [])],
    recommended_technique_ids: [...(houding.recommended_technique_ids || [])],
  }));

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
    ) as any;
    if (technique) {
      setSelectedTechniqueDetails(technique);
      setTechniqueDetailsPanelOpen(true);
    }
  };

  const startTechniqueChat = async (techniqueNumber: string, techniqueName: string) => {
    setSelectedTechnique(techniqueNumber);
    setSelectedTechniqueName(techniqueName);
    setSessionTimer(0);
    setIsLoading(true);
    
    const phase = parseInt(techniqueNumber.split('.')[0]) || 1;
    lastActivityService.save({
      type: 'technique',
      id: techniqueNumber,
      name: techniqueName,
      phase,
    });
    
    try {
      const session = await hugoApi.startSession({
        techniqueId: techniqueNumber,
        mode: "COACH_CHAT",
        isExpert: difficultyLevel === "onbewuste_kunde",
        modality: chatMode,
        viewMode: 'user',
      });
      
      const aiMessage: Message = {
        id: Date.now().toString(),
        sender: "ai",
        text: session.message || session.initialMessage || "",
        timestamp: new Date(),
      };
      setMessages([aiMessage]);
      setHasActiveSession(true);
    } catch (error) {
      console.error("Failed to start session:", error);
      const fallbackMessage: Message = {
        id: Date.now().toString(),
        sender: "ai",
        text: `Hey! Klaar om ${techniqueName} te oefenen? Ik speel de klant, jij bent de verkoper. Start maar!`,
        timestamp: new Date(),
      };
      setMessages([fallbackMessage]);
      setHasActiveSession(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getFaseBadgeColor = (fase: number) => {
    const colors: Record<number, string> = {
      0: "bg-slate-100 text-slate-600 border-slate-200",
      1: "bg-emerald-100 text-emerald-700 border-emerald-200",
      2: "bg-blue-100 text-blue-700 border-blue-200",
      3: "bg-amber-100 text-amber-700 border-amber-200",
      4: "bg-purple-100 text-purple-700 border-purple-200",
    };
    return colors[fase] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getTopLevelTechniques = (phase: number) => {
    const techniques = techniquesByPhase[phase] || [];
    return techniques.filter((t: any) => {
      const parts = t.nummer.split('.');
      return parts.length === 2;
    });
  };

  const hasChildren = (technique: any, phase: number) => {
    const techniques = techniquesByPhase[phase] || [];
    return techniques.some((t: any) => {
      const parts = t.nummer.split('.');
      return parts.length === 3 && t.nummer.startsWith(technique.nummer + '.');
    });
  };

  const getChildTechniques = (parentNumber: string, phase: number) => {
    const techniques = techniquesByPhase[phase] || [];
    return techniques.filter((t: any) => {
      const parts = t.nummer.split('.');
      return parts.length === 3 && t.nummer.startsWith(parentNumber + '.');
    });
  };

  const handleInlineAnalysis = async (audioFiles: FileAttachment[]) => {
    const file = audioFiles[0];
    const title = file.name.replace(/\.[^/.]+$/, '');
    const analysisMessageId = `analysis-${Date.now()}`;

    setMessages(prev => [...prev, {
      id: analysisMessageId,
      sender: "ai",
      text: `Top, ik ga **${file.name}** voor je analyseren. Even geduld — ik transcribeer, analyseer en maak een rapport. Dit duurt meestal 1-2 minuten.`,
      timestamp: new Date(),
      richContent: [{
        type: 'analysis_progress' as const,
        data: { conversationId: 'pending', title, overallScore: 0, status: 'transcribing' as const } as AnalysisResultEmbed,
      }],
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file.file);
      formData.append('title', title);
      formData.append('userId', user?.id || 'anonymous');

      const response = await fetch('/api/v2/analysis/inline', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload mislukt');
      }

      const { conversationId } = await response.json();
      console.log('[Hugo] Inline analysis started:', conversationId);

      setMessages(prev => prev.map(m => {
        if (m.id !== analysisMessageId) return m;
        return {
          ...m,
          richContent: m.richContent?.map(rc => ({
            ...rc,
            data: { ...(rc.data as AnalysisResultEmbed), conversationId },
          })),
        };
      }));

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/v2/analysis/status/${conversationId}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            const resultsRes = await fetch(`/api/v2/analysis/results/${conversationId}`);
            const results = await resultsRes.json();

            const analysisEmbed: AnalysisResultEmbed = {
              conversationId,
              title,
              overallScore: results.insights?.overallScore || 0,
              status: 'completed',
              phaseCoverage: results.insights?.phaseCoverage ? {
                phase1: { score: results.insights.phaseCoverage.phase1?.score || 0 },
                phase2: { overall: { score: results.insights.phaseCoverage.phase2?.overall?.score || 0 } },
                phase3: { score: results.insights.phaseCoverage.phase3?.score || 0 },
                phase4: { score: results.insights.phaseCoverage.phase4?.score || 0 },
              } : undefined,
              moments: results.insights?.moments?.slice(0, 3).map((mo: any) => ({
                type: mo.type,
                label: mo.label,
                whyItMatters: mo.whyItMatters,
                betterAlternative: mo.betterAlternative,
              })),
              strengths: results.insights?.strengths?.slice(0, 2),
              improvements: results.insights?.improvements?.slice(0, 2),
              coachOneliner: results.insights?.coachDebrief?.oneliner,
            };

            setMessages(prev => prev.map(m => {
              if (m.id !== analysisMessageId) return m;
              return {
                ...m,
                text: `Klaar! Hier is de analyse van **${title}**. Je scoorde **${analysisEmbed.overallScore}%** overall.${analysisEmbed.coachOneliner ? ` ${analysisEmbed.coachOneliner}` : ''}`,
                richContent: [{ type: 'analysis_result' as const, data: analysisEmbed }],
              };
            }));
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setMessages(prev => prev.map(m => {
              if (m.id !== analysisMessageId) return m;
              return {
                ...m,
                text: `Helaas, de analyse van **${title}** is mislukt. Probeer het opnieuw of upload een ander bestand.`,
                richContent: [{
                  type: 'analysis_progress' as const,
                  data: { conversationId, title, overallScore: 0, status: 'failed' as const } as AnalysisResultEmbed,
                }],
              };
            }));
          } else {
            setMessages(prev => prev.map(m => {
              if (m.id !== analysisMessageId) return m;
              return {
                ...m,
                richContent: m.richContent?.map(rc => ({
                  ...rc,
                  data: { ...(rc.data as AnalysisResultEmbed), status: statusData.status },
                })),
              };
            }));
          }
        } catch (pollErr) {
          console.error('[Hugo] Poll error:', pollErr);
        }
      }, 3000);

      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    } catch (error: any) {
      console.error('[Hugo] Inline analysis error:', error);
      setMessages(prev => prev.map(m => {
        if (m.id !== analysisMessageId) return m;
        return {
          ...m,
          text: `Sorry, er ging iets mis bij het analyseren van **${file.name}**. Probeer het opnieuw.`,
          richContent: [],
        };
      }));
    }
  };

  const handleSendMessage = async () => {
    const hasFiles = attachedFiles.length > 0;
    if ((!inputText.trim() && !hasFiles) || isLoading || isStreaming) return;

    const messageAttachments: MessageAttachment[] = attachedFiles.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      preview: f.preview,
    }));

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "hugo",
      text: inputText || (hasFiles ? `${attachedFiles.length} bestand${attachedFiles.length > 1 ? "en" : ""} geüpload` : ""),
      timestamp: new Date(),
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
    };

    const audioFiles = attachedFiles.filter((f) => f.type.startsWith("audio/") || /\.(m4a|mp3|wav|ogg|webm|flac|aac)$/i.test(f.name));
    const lowerText = inputText.toLowerCase();
    const isAnalyseIntent = audioFiles.length > 0 && (
      /analy|ontleed|beoordeel/.test(lowerText) ||
      (!inputText.trim())
    );

    const attachmentContext = hasFiles && !isAnalyseIntent
      ? `[Gebruiker heeft ${attachedFiles.length} bestand${attachedFiles.length > 1 ? "en" : ""} geüpload: ${attachedFiles.map((f) => `${f.name} (${f.type}, ${formatFileSize(f.size)})`).join(", ")}]`
      : "";
    const messageText = inputText
      ? (hasFiles && !isAnalyseIntent ? `${inputText}\n\n${attachmentContext}` : inputText)
      : attachmentContext;

    const filesToAnalyze = isAnalyseIntent ? [...audioFiles] : [];
    attachedFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setAttachedFiles([]);

    if (isAnalyseIntent && filesToAnalyze.length > 0) {
      await handleInlineAnalysis(filesToAnalyze);
      return;
    }

    if (!hasActiveSession) {
      try {
        await hugoApi.startSession({
          techniqueId: selectedTechnique || "general",
          mode: "COACH_CHAT",
          isExpert: difficultyLevel === "onbewuste_kunde",
          modality: chatMode,
          viewMode: 'user',
        });
        setHasActiveSession(true);
        console.log("[Hugo] Auto-started coach session");
      } catch (error) {
        console.error("[Hugo] Failed to start session:", error);
      }
    }

    if (useStreaming) {
      setIsStreaming(true);
      setStreamingText("");
      streamingTextRef.current = "";
      
      try {
        await hugoApi.sendMessageStream(
          messageText,
          difficultyLevel === "onbewuste_kunde",
          (token) => {
            streamingTextRef.current += token;
            setStreamingText(streamingTextRef.current);
          },
          () => {
            const finalText = streamingTextRef.current;
            setIsStreaming(false);
            if (finalText) {
              setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                sender: "ai",
                text: finalText,
                timestamp: new Date(),
              }]);
            }
            setStreamingText("");
            streamingTextRef.current = "";
          }
        );
      } catch (error) {
        console.error("Streaming failed, falling back:", error);
        setIsStreaming(false);
        setStreamingText("");
        setIsLoading(true);
        try {
          const response = await hugoApi.sendMessage(messageText, difficultyLevel === "onbewuste_kunde");
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: response.response,
            timestamp: new Date(),
          }]);
        } catch (fallbackError) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: "Sorry, er ging iets mis. Probeer het opnieuw.",
            timestamp: new Date(),
          }]);
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      setIsLoading(true);
      try {
        const response = await hugoApi.sendMessage(messageText, difficultyLevel === "onbewuste_kunde");
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: response.response,
          timestamp: new Date(),
          richContent: response.richContent,
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // Handle level transition (invisible auto-adaptive system)
        if (response.levelTransition) {
          const { previousLevel, newLevel, shouldCongratulate } = response.levelTransition;
          // Update local level state
          const levelNames = ["onbewuste_onkunde", "bewuste_onkunde", "bewuste_kunde", "onbewuste_kunde"];
          setDifficultyLevel(levelNames[newLevel - 1] || "onbewuste_onkunde");
          // Reload assistance config
          try {
            const levelData = await hugoApi.getUserLevel();
            setAssistanceConfig(levelData.assistance);
          } catch (e) {
            console.error("[Performance] Failed to reload assistance config:", e);
          }
          // Show transition message
          if (shouldCongratulate) {
            setLevelTransitionMessage(`🎉 Geweldig! Je bent nu op niveau ${newLevel}. Je past de technieken steeds beter toe!`);
          } else {
            setLevelTransitionMessage(`💪 We hebben het niveau aangepast zodat je beter kunt oefenen. Blijf doorgaan!`);
          }
          // Auto-hide after 5 seconds
          setTimeout(() => setLevelTransitionMessage(null), 5000);
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "Sorry, er ging iets mis. Probeer het opnieuw.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRequestFeedback = async () => {
    if (isLoading || isStreaming) return;
    setIsLoading(true);
    
    try {
      const result = await hugoApi.requestFeedback();
      const feedbackMessage: Message = {
        id: Date.now().toString(),
        sender: "ai",
        text: result.feedback,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, feedbackMessage]);
    } catch (error) {
      console.error("Failed to get feedback:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (isLoading || isStreaming) return;
    setIsLoading(true);
    
    try {
      const evaluation = await hugoApi.evaluate();
      const evalText = `**Evaluatie - Score: ${evaluation.overallScore}/100**

**Scores:**
- Engagement: ${evaluation.scores.engagement}%
- Technisch: ${evaluation.scores.technical}%
- Context: ${evaluation.scores.contextGathering}%

**Aanbeveling:**
${evaluation.recommendation}

**Volgende stappen:**
${evaluation.nextSteps.map(s => `- ${s}`).join('\n')}`;

      const evalMessage: Message = {
        id: Date.now().toString(),
        sender: "ai",
        text: evalText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, evalMessage]);
    } catch (error) {
      console.error("Failed to evaluate:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopRoleplay = () => {
    setStopRoleplayDialogOpen(true);
  };

  const confirmStopRoleplay = () => {
    setMessages([]);
    setInputText("");
    setSelectedTechnique("");
    setSelectedTechniqueName("");
    setSessionTimer(0);
    setChatMode("chat");
    hugoApi.clearSession();
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

  const handleFileSelect = (acceptTypes: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptTypes;
      fileInputRef.current.click();
    }
  };

  const processFiles = (files: FileList | File[]) => {
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

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
    if (type.startsWith("audio/")) return <FileAudio className="w-4 h-4" />;
    if (type.includes("pdf") || type.includes("document") || type.includes("text")) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const getModeIcon = () => {
    switch (chatMode) {
      case "audio": return <Mic className="w-3.5 h-3.5" />;
      case "video": return <Video className="w-3.5 h-3.5" />;
      default: return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  const getModeLabel = () => {
    switch (chatMode) {
      case "audio": return "Audio";
      case "video": return "Video";
      default: return "Chat";
    }
  };

  const handleHelpClick = (message: Message) => {
    if (activeHelpMessageId === message.id) {
      setActiveHelpMessageId(null);
      return;
    }
    
    setActiveHelpMessageId(message.id);
    
    // Als er een verwachte techniek is, scroll ernaar in de sidebar
    if (message.debugInfo?.expectedTechniqueId) {
      const techniqueId = message.debugInfo.expectedTechniqueId;
      
      // Bepaal de fase van de techniek en expand die
      const technique = Object.values(technieken_index.technieken).find((t: any) => t.id === techniqueId) as any;
      if (technique) {
        const fase = technique.fase;
        if (!expandedPhases.includes(fase)) {
          setExpandedPhases(prev => [...prev, fase]);
        }
        
        // Als het een sub-techniek is, expand ook de parent
        if (technique.nummer.includes('.')) {
          const parentNumber = technique.nummer.split('.').slice(0, -1).join('.');
          const parent = Object.values(technieken_index.technieken).find((t: any) => t.nummer === parentNumber) as any;
          if (parent && !expandedParents.includes(parent.id)) {
            setExpandedParents(prev => [...prev, parent.id]);
          }
        }
        
        // Open mobile sidebar en scroll naar techniek
        setMobileSidebarOpen(true);
        
        // Scroll naar de techniek na een korte delay (voor sidebar open animatie)
        setTimeout(() => {
          const element = document.getElementById(`technique-${techniqueId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-hh-primary', 'ring-offset-2');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-hh-primary', 'ring-offset-2');
            }, 2000);
          }
        }, 300);
      }
    }
  };

  const handleCopyMessage = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {}
  };

  const refreshOnboardingStatus = async () => {
    try {
      const res = await fetch(`/api/v2/admin/onboarding/status?userId=${user?.id || 'hugo'}`);
      if (res.ok) {
        const status = await res.json();
        setOnboardingStatus(status);
        if (status.nextItem) {
          setOnboardingCurrentItem(status.nextItem);
        }
      }
    } catch {}
  };

  const fetchNextOnboardingCard = async (): Promise<{ module: string; key: string; name: string; data: any } | null> => {
    try {
      const statusRes = await fetch(`/api/v2/admin/onboarding/status?userId=${user?.id || 'hugo'}`);
      if (!statusRes.ok) return null;
      const status = await statusRes.json();
      setOnboardingStatus(status);
      if (status.isComplete || !status.nextItem) {
        setOnboardingCurrentItem(null);
        return null;
      }
      setOnboardingCurrentItem(status.nextItem);
      const itemRes = await fetch(`/api/v2/admin/onboarding/item/${status.nextItem.module}/${status.nextItem.key}`);
      if (!itemRes.ok) return null;
      const itemJson = await itemRes.json();
      return { ...status.nextItem, data: itemJson.data || itemJson };
    } catch { return null; }
  };

  const handleOnboardingApprove = async () => {
    if (!onboardingCurrentItem) return;
    try {
      await fetch('/api/v2/admin/onboarding/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemKey: onboardingCurrentItem.key,
          module: onboardingCurrentItem.module,
          userId: user?.id || 'hugo',
        }),
      });
      setOnboardingFeedbackInput(null);
      setIsLoading(true);

      const next = await fetchNextOnboardingCard();
      if (next) {
        const introText = next.module === 'technieken'
          ? `Top! **${onboardingCurrentItem.name}** is goedgekeurd. Op naar de volgende!\n\nHier is techniek ${next.data.nummer || next.key}: **${next.data.naam || next.name}**`
          : `Top! **${onboardingCurrentItem.name}** is goedgekeurd. Op naar de volgende!\n\nHier is klanthouding ${next.data.id || next.key}: **${next.data.naam || next.name}**`;
        const aiMsg: Message = {
          id: `onb-approve-${Date.now()}`,
          sender: "ai",
          text: introText,
          timestamp: new Date(),
          richContent: [{ type: 'onboarding_review', data: { ...next.data, module: next.module } }],
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        setMessages(prev => [...prev, {
          id: `onb-complete-${Date.now()}`,
          sender: "ai",
          text: "Hugo, we zijn klaar! Alle technieken en houdingen zijn gereviewd. Het platform is klaar om live te gaan. Je kunt nu gewoon met me chatten over alles wat je wilt.",
          timestamp: new Date(),
        }]);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("[Onboarding] Approve failed:", err);
      setIsLoading(false);
    }
  };

  const handleOnboardingFeedback = async (feedbackText: string) => {
    if (!onboardingCurrentItem || !feedbackText.trim()) return;
    const currentName = onboardingCurrentItem.name;
    try {
      await fetch('/api/v2/admin/onboarding/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemKey: onboardingCurrentItem.key,
          module: onboardingCurrentItem.module,
          feedbackText: feedbackText.trim(),
          userId: user?.id || 'hugo',
        }),
      });
      setOnboardingFeedbackInput(null);
      setIsLoading(true);

      const next = await fetchNextOnboardingCard();
      const confirmMsg: Message = {
        id: `onb-fb-confirm-${Date.now()}`,
        sender: "ai",
        text: `Bedankt Hugo! Ik heb je feedback over **${currentName}** genoteerd. Dit wordt bekeken en verwerkt.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, confirmMsg]);

      if (next) {
        const introText = next.module === 'technieken'
          ? `Op naar de volgende! Hier is techniek ${next.data.nummer || next.key}: **${next.data.naam || next.name}**`
          : `Op naar de volgende! Hier is klanthouding ${next.data.id || next.key}: **${next.data.naam || next.name}**`;
        setMessages(prev => [...prev, {
          id: `onb-next-${Date.now()}`,
          sender: "ai",
          text: introText,
          timestamp: new Date(),
          richContent: [{ type: 'onboarding_review', data: { ...next.data, module: next.module } }],
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `onb-complete-${Date.now()}`,
          sender: "ai",
          text: "Hugo, we zijn klaar! Alle technieken en houdingen zijn gereviewd. Het platform is klaar om live te gaan!",
          timestamp: new Date(),
        }]);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("[Onboarding] Feedback failed:", err);
      setIsLoading(false);
    }
  };

  const handleOnboardingSkip = async () => {
    if (!onboardingCurrentItem) return;
    try {
      await fetch('/api/v2/admin/onboarding/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemKey: onboardingCurrentItem.key,
          module: onboardingCurrentItem.module,
          userId: user?.id || 'hugo',
        }),
      });
      setOnboardingFeedbackInput(null);
      setIsLoading(true);

      const next = await fetchNextOnboardingCard();
      if (next) {
        const introText = next.module === 'technieken'
          ? `Geen probleem, overgeslagen. Hier is techniek ${next.data.nummer || next.key}: **${next.data.naam || next.name}**`
          : `Geen probleem, overgeslagen. Hier is klanthouding ${next.data.id || next.key}: **${next.data.naam || next.name}**`;
        setMessages(prev => [...prev, {
          id: `onb-skip-${Date.now()}`,
          sender: "ai",
          text: introText,
          timestamp: new Date(),
          richContent: [{ type: 'onboarding_review', data: { ...next.data, module: next.module } }],
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `onb-complete-${Date.now()}`,
          sender: "ai",
          text: "Hugo, we zijn klaar! Alle technieken en houdingen zijn gereviewd.",
          timestamp: new Date(),
        }]);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("[Onboarding] Skip failed:", err);
      setIsLoading(false);
    }
  };

  const handleMessageFeedback = async (messageId: string, feedback: "up" | "down") => {
    if (isAdmin && adminViewMode && onboardingStatus && !onboardingStatus.isComplete && onboardingCurrentItem) {
      if (feedback === "up") {
        handleOnboardingApprove();
        return;
      } else if (feedback === "down") {
        setOnboardingFeedbackInput("");
        return;
      }
    }

    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
    ));

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const newFeedback = message.feedback === feedback ? null : feedback;

    try {
      await fetch('/api/v2/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          sessionId: null,
          userId: user?.id,
          feedback: newFeedback,
          messageText: message.text,
          debugInfo: message.debugInfo,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const renderChatInterface = () => (
    <div
      className={`flex-1 min-h-0 flex flex-col bg-hh-bg relative ${isDraggingOver ? "ring-2 ring-[#4F7396] ring-inset" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 bg-[#4F7396]/5 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-hh-bg border-2 border-dashed border-[#4F7396] rounded-2xl px-8 py-6 shadow-lg">
            <div className="flex flex-col items-center gap-2">
              <Paperclip className="w-8 h-8 text-[#4F7396]" />
              <p className="text-[15px] font-medium text-hh-text">Sleep bestanden hier</p>
              <p className="text-[12px] text-hh-muted">Audio, documenten, afbeeldingen</p>
            </div>
          </div>
        </div>
      )}
      {isAdmin && adminViewMode && onboardingStatus && !onboardingStatus.isComplete && (
        <div className="flex items-center justify-center gap-3 py-2 px-4 border-b border-hh-border bg-hh-ui-50/50">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: '#7c3aed' }}>
              Technieken {onboardingStatus.technieken.reviewed}/{onboardingStatus.technieken.total}
            </span>
            <div className="w-16 h-1.5 rounded-full bg-hh-ui-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${onboardingStatus.technieken.total > 0 ? (onboardingStatus.technieken.reviewed / onboardingStatus.technieken.total) * 100 : 0}%`,
                  backgroundColor: '#7c3aed'
                }}
              />
            </div>
          </div>
          <span className="text-hh-muted text-[11px]">·</span>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: '#0284c7' }}>
              Houdingen {onboardingStatus.houdingen.reviewed}/{onboardingStatus.houdingen.total}
            </span>
            <div className="w-12 h-1.5 rounded-full bg-hh-ui-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${onboardingStatus.houdingen.total > 0 ? (onboardingStatus.houdingen.reviewed / onboardingStatus.houdingen.total) * 100 : 0}%`,
                  backgroundColor: '#0284c7'
                }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div key={message.id} className={`group flex ${message.sender === "hugo" ? "justify-end" : "justify-start"}`}>
            <div className={`flex flex-col ${message.sender === "hugo" ? "items-end" : "items-start"}`} style={{ maxWidth: '75%' }}>
              {message.isTranscriptReplay && message.transcriptRole && (
                <span className="text-[11px] font-medium mb-0.5 px-1" style={{ color: message.transcriptRole === 'Klant' ? '#4F7396' : '#3C9A6E' }}>
                  {message.transcriptRole}
                </span>
              )}
              <div className={`p-3 rounded-2xl ${
                message.isTranscriptReplay
                  ? message.sender === "hugo"
                    ? "text-white rounded-br-md"
                    : "text-hh-text rounded-bl-md"
                  : message.sender === "hugo"
                    ? "text-white rounded-br-md"
                    : "bg-hh-ui-50 text-hh-text rounded-bl-md"
              }`} style={message.isTranscriptReplay
                ? {
                    opacity: 0.85,
                    backgroundColor: message.sender === 'hugo' ? '#4F7396' : 'var(--hh-ui-100)',
                  }
                : message.sender === 'hugo'
                  ? { backgroundColor: '#4F7396' }
                  : undefined
              }>
                {message.attachments && message.attachments.length > 0 && (
                  <div className={`flex flex-wrap gap-2 ${message.text ? "mb-2" : ""}`}>
                    {message.attachments.map((att) => (
                      <div
                        key={att.id}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                          message.sender === "hugo"
                            ? "bg-white/15"
                            : "bg-hh-bg border border-hh-border"
                        }`}
                      >
                        {att.preview ? (
                          <img src={att.preview} alt={att.name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${
                            message.sender === "hugo" ? "text-white/80" : "text-[#4F7396]"
                          }`}>
                            {att.type.startsWith("audio/") ? <FileAudio className="w-4 h-4" /> :
                             att.type.startsWith("image/") ? <Image className="w-4 h-4" /> :
                             att.type.includes("pdf") || att.type.includes("document") ? <FileText className="w-4 h-4" /> :
                             <File className="w-4 h-4" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={`text-[12px] font-medium truncate max-w-[140px] ${
                            message.sender === "hugo" ? "text-white" : "text-hh-text"
                          }`}>{att.name}</p>
                          <p className={`text-[10px] ${
                            message.sender === "hugo" ? "text-white/60" : "text-hh-muted"
                          }`}>{formatFileSize(att.size)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {message.text && <div className="text-[14px] leading-[22px]">{renderSimpleMarkdown(message.text)}</div>}
              </div>

              {message.richContent && message.richContent.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.richContent.map((rc, idx) => {
                    switch (rc.type) {
                      case 'epic_slide':
                        return <EpicSlideCard key={idx} slide={rc.data as unknown as EpicSlideContent} />;
                      case 'video':
                        return <InlineVideoPlayer key={idx} video={rc.data as VideoEmbed} />;
                      case 'webinar':
                        return <InlineWebinarCard key={idx} webinar={rc.data as WebinarLink} />;
                      case 'analysis_result':
                      case 'analysis_progress':
                        return (
                          <InlineAnalysisCard
                            key={idx}
                            analysis={rc.data as AnalysisResultEmbed}
                            onViewFull={rc.type === 'analysis_result' ? (convId) => {
                              if (navigate) {
                                navigate('analysis-results');
                                setTimeout(() => {
                                  window.dispatchEvent(new CustomEvent('navigate-analysis', { detail: { conversationId: convId } }));
                                }, 100);
                              }
                            } : undefined}
                          />
                        );
                      case 'onboarding_review': {
                        const d = rc.data as Record<string, any>;
                        const isTech = d.module === 'technieken';
                        const faseColors: Record<string, string> = {
                          '0': '#64748b', '1': '#059669', '2': '#2563eb', '3': '#d97706', '4': '#7c3aed'
                        };
                        const faseColor = faseColors[String(d.fase || '0').charAt(0)] || '#64748b';
                        return (
                          <div key={idx} className="rounded-xl border border-hh-border bg-hh-bg shadow-sm overflow-hidden" style={{ maxWidth: '100%' }}>
                            <div className="px-4 py-3 border-b border-hh-border" style={{ backgroundColor: `${faseColor}08` }}>
                              <div className="flex items-center gap-2 mb-1">
                                {isTech && d.nummer && (
                                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: faseColor }}>
                                    {d.nummer}
                                  </span>
                                )}
                                {!isTech && d.id && (
                                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: '#0284c7' }}>
                                    {d.id}
                                  </span>
                                )}
                                <h3 className="text-[15px] font-semibold text-hh-text">{d.naam}</h3>
                              </div>
                              {isTech && d.fase && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${faseColor}15`, color: faseColor }}>
                                  Fase {d.fase}
                                </span>
                              )}
                            </div>
                            <div className="px-4 py-3 space-y-3 text-[13px] leading-[20px] text-hh-text">
                              {d.doel && (
                                <div>
                                  <p className="font-semibold text-[12px] text-hh-muted uppercase tracking-wide mb-1">Doel</p>
                                  <p>{d.doel}</p>
                                </div>
                              )}
                              {d.houding_beschrijving && (
                                <div>
                                  <p className="font-semibold text-[12px] text-hh-muted uppercase tracking-wide mb-1">Beschrijving</p>
                                  <p>{d.houding_beschrijving}</p>
                                </div>
                              )}
                              {d.hoe && (
                                <div>
                                  <p className="font-semibold text-[12px] text-hh-muted uppercase tracking-wide mb-1">Hoe</p>
                                  <p>{d.hoe}</p>
                                </div>
                              )}
                              {d.stappenplan && d.stappenplan.length > 0 && (
                                <div>
                                  <p className="font-semibold text-[12px] text-hh-muted uppercase tracking-wide mb-1">Stappenplan</p>
                                  <ol className="list-decimal list-inside space-y-0.5">
                                    {d.stappenplan.map((s: string, si: number) => <li key={si}>{s}</li>)}
                                  </ol>
                                </div>
                              )}
                              {d.voorbeeld && d.voorbeeld.length > 0 && (
                                <div>
                                  <p className="font-semibold text-[12px] text-hh-muted uppercase tracking-wide mb-1">Voorbeelden</p>
                                  <div className="space-y-1">
                                    {d.voorbeeld.map((v: string, vi: number) => (
                                      <div key={vi} className="pl-3 border-l-2 text-[13px] italic text-hh-muted" style={{ borderColor: faseColor }}>
                                        {v}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {d.generation_examples && d.generation_examples.length > 0 && (
                                <div>
                                  <p className="font-semibold text-[12px] text-hh-muted uppercase tracking-wide mb-1">Voorbeelden</p>
                                  <div className="space-y-1">
                                    {d.generation_examples.slice(0, 3).map((v: string, vi: number) => (
                                      <div key={vi} className="pl-3 border-l-2 text-[13px] italic text-hh-muted" style={{ borderColor: '#0284c7' }}>
                                        {v}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {d.tags && d.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {d.tags.map((t: string, ti: number) => (
                                    <span key={ti} className="text-[10px] px-2 py-0.5 rounded-full border border-hh-border text-hh-muted bg-hh-ui-50">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {d.semantic_markers && d.semantic_markers.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {d.semantic_markers.slice(0, 8).map((t: string, ti: number) => (
                                    <span key={ti} className="text-[10px] px-2 py-0.5 rounded-full border border-hh-border text-hh-muted bg-hh-ui-50">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="px-4 py-3 border-t border-hh-border flex items-center gap-2">
                              <button
                                onClick={handleOnboardingApprove}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
                                style={{ backgroundColor: '#059669' }}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                Goedkeuren
                              </button>
                              <button
                                onClick={() => setOnboardingFeedbackInput("")}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
                                style={{ backgroundColor: '#d97706' }}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                Feedback geven
                              </button>
                              <button
                                onClick={handleOnboardingSkip}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-hh-muted hover:bg-hh-ui-100 transition-colors"
                              >
                                Sla over
                              </button>
                            </div>
                            {onboardingFeedbackInput !== null && (
                              <div className="px-4 py-3 border-t border-hh-border bg-hh-ui-50/50">
                                <p className="text-[12px] text-hh-muted mb-2">Wat zou je aanpassen, Hugo?</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={onboardingFeedbackInput}
                                    onChange={(e) => setOnboardingFeedbackInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && onboardingFeedbackInput?.trim()) {
                                        handleOnboardingFeedback(onboardingFeedbackInput);
                                      }
                                    }}
                                    placeholder="Bijv. 'Het doel moet korter' of 'Voeg een voorbeeld toe over...'"
                                    className="flex-1 px-3 py-2 text-[13px] rounded-lg border border-hh-border bg-hh-bg text-hh-text placeholder:text-hh-muted focus:outline-none focus:ring-1"
                                    style={{ focusRingColor: '#7c3aed' }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => onboardingFeedbackInput?.trim() && handleOnboardingFeedback(onboardingFeedbackInput)}
                                    disabled={!onboardingFeedbackInput?.trim()}
                                    className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 transition-colors"
                                    style={{ backgroundColor: '#7c3aed' }}
                                  >
                                    Verstuur
                                  </button>
                                  <button
                                    onClick={() => setOnboardingFeedbackInput(null)}
                                    className="px-3 py-2 rounded-lg text-[13px] text-hh-muted hover:bg-hh-ui-100 transition-colors"
                                  >
                                    Annuleer
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      default:
                        return null;
                    }
                  })}
                </div>
              )}
              
              {message.sender === "ai" && !message.isTranscriptReplay && (
                <div className="flex items-center gap-0.5 mt-1.5">
                  <button
                    onClick={() => handleCopyMessage(message.id, message.text)}
                    className="p-1.5 rounded-md text-hh-muted hover:text-hh-text hover:bg-hh-ui-100 transition-colors"
                    title="Kopieer"
                  >
                    {copiedMessageId === message.id ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleMessageFeedback(message.id, "up")}
                    className={`p-1.5 rounded-md transition-colors ${
                      message.feedback === "up"
                        ? "text-green-600 bg-green-600/15"
                        : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-100"
                    }`}
                    title="Goed antwoord"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMessageFeedback(message.id, "down")}
                    className={`p-1.5 rounded-md transition-colors ${
                      message.feedback === "down"
                        ? "text-red-500 bg-red-500/15"
                        : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-100"
                    }`}
                    title="Slecht antwoord"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const lastUserMsg = [...messages].reverse().find(m => m.sender === "hugo");
                      if (lastUserMsg) {
                        setInputText(lastUserMsg.text);
                      }
                    }}
                    className="p-1.5 rounded-md text-hh-muted hover:text-hh-text hover:bg-hh-ui-100 transition-colors"
                    title="Opnieuw proberen"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  {!assistanceConfig.blindPlay && (message.debugInfo?.expectedTechniqueId || message.debugInfo?.epicFase || message.debugInfo?.evaluatie) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
                            if (isDesktop) {
                              setDesktopSidebarOpen(!desktopSidebarOpen);
                            } else {
                              setMobileSidebarOpen(!mobileSidebarOpen);
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            (desktopSidebarOpen || mobileSidebarOpen)
                              ? "bg-[#3C9A6E]/10"
                              : "hover:bg-[#3C9A6E]/10"
                          }`}
                          style={{ color: '#3C9A6E' }}
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={4}>
                        E.P.I.C. TECHNIQUE bekijken
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isStreaming && streamingText && (
          <div className="flex justify-start">
            <div className="p-3 rounded-2xl bg-hh-ui-50 text-hh-text rounded-bl-md" style={{ maxWidth: '75%' }}>
              <p className="text-[14px] leading-[22px] whitespace-pre-wrap">{streamingText}<span className="animate-pulse">▌</span></p>
            </div>
          </div>
        )}
        {isLoading && !isStreaming && (
          <div className="flex justify-start">
            <div className="bg-hh-ui-100 text-hh-text rounded-2xl rounded-bl-md p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-hh-muted" />
              <span className="text-[14px] text-hh-muted">Hugo denkt na...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      

      <div className="border-t border-hh-border bg-hh-bg">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        {attachedFiles.length > 0 && (
          <div className="px-4 pt-3 pb-1 flex gap-2 flex-wrap">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="group relative flex items-center gap-2 bg-hh-ui-50 border border-hh-border rounded-lg px-3 py-2 max-w-[220px]"
              >
                {file.preview ? (
                  <img src={file.preview} alt={file.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-[#4F7396]/10 flex items-center justify-center flex-shrink-0 text-[#4F7396]">
                    {getFileIcon(file.type)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-hh-text truncate">{file.name}</p>
                  <p className="text-[11px] text-hh-muted">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => removeAttachedFile(file.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-hh-ink text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-hh-border flex gap-2 items-end">
          <Button
            variant="outline"
            size="icon"
            disabled={isStreaming}
            className="flex-shrink-0 rounded-full w-9 h-9 border-hh-border hover:bg-hh-ui-50 text-[#4F7396]"
            title="Bestand toevoegen"
            onClick={() => handleFileSelect("*")}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={isRecording ? "Luistert... spreek nu" : "Typ je bericht..."}
            className={`flex-1 ${isRecording ? "border-red-300 bg-red-50/30" : ""}`}
            disabled={isStreaming}
          />
          {messages.length > 2 && (
            <button
              onClick={handleRequestFeedback}
              disabled={isLoading || isStreaming}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-full border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors disabled:opacity-40"
              title="Vraag Hugo om feedback"
            >
              <Award className="w-3.5 h-3.5 text-[#4F7396]" />
              <span className="text-[11px] font-medium text-hh-muted hidden sm:inline">Feedback</span>
            </button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleDictation}
            disabled={isStreaming}
            className={`flex-shrink-0 transition-all ${isRecording ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-200 animate-pulse" : "hover:bg-hh-ui-50"}`}
          >
            {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-[#4F7396]" />}
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={(!inputText.trim() && attachedFiles.length === 0) || isLoading || isStreaming}
            variant="ghost"
            className="gap-2 px-3 sm:px-4 text-white rounded-md hover:text-white"
            style={{ backgroundColor: '#3C9A6E' }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#2D7F57')}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#3C9A6E')}
          >
            {isLoading || isStreaming ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
            <span className="text-white hidden sm:inline">{isLoading || isStreaming ? "Bezig..." : "Verzend"}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  const renderAudioInterface = () => (
    <div className="h-full w-full flex flex-col" style={{ background: 'linear-gradient(180deg, #059669 0%, #0d9488 50%, #0f766e 100%)' }}>
      {/* Error message */}
      {audioError && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg flex items-center gap-2 z-10">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-[14px]">{audioError}</span>
          <button onClick={() => setAudioError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Top section - caller info with large avatar */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Large HH avatar */}
        <div className="relative mb-6">
          <div 
            className="rounded-full flex items-center justify-center"
            style={{ width: '180px', height: '180px', backgroundColor: 'rgba(255,255,255,0.25)' }}
          >
            {isAudioConnecting ? (
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            ) : (
              <span className="text-white font-bold" style={{ fontSize: '64px' }}>HH</span>
            )}
          </div>
          {/* Speaking indicator removed — waveform animation shows agent state */}
        </div>
        
        <h3 className="text-white text-[26px] font-bold mb-1">Hugo Herbots <sup className="text-[14px] font-semibold" style={{ verticalAlign: 'super' }}>AI</sup></h3>
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
      </div>

      {/* Bottom controls - circular buttons with labels below */}
      <div className="pb-8 pt-4">
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="flex items-center justify-center transition-colors"
              style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%',
                backgroundColor: isMuted ? 'white' : 'rgba(255,255,255,0.2)' 
              }}
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
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%',
                backgroundColor: '#ef4444' 
              }}
            >
              <Phone className="w-6 h-6 text-white" style={{ transform: 'rotate(135deg)' }} />
            </button>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>Ophangen</span>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <button 
              className="flex items-center justify-center"
              style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)' 
              }}
            >
              <Volume2 className="w-5 h-5 text-white" />
            </button>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>Speaker</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVideoInterface = () => (
    <div className="h-full w-full relative" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)' }}>
      {/* Error message */}
      {avatarError && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg flex items-center gap-2 z-20">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-[14px]">{avatarError}</span>
          <button onClick={() => setAvatarError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Main video area - HeyGen avatar stream or fallback */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Video element always rendered so ref is available for stream attachment */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${avatarSession ? '' : 'hidden'}`}
        />
        {/* Fallback avatar when no session */}
        {!avatarSession && (
          <div 
            className="rounded-full flex items-center justify-center absolute"
            style={{ width: '220px', height: '220px', backgroundColor: '#6B7A92' }}
          >
            {isAvatarLoading ? (
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            ) : (
              <span className="text-white font-bold" style={{ fontSize: '80px' }}>HH</span>
            )}
          </div>
        )}
      </div>

      {/* Top overlay with name and status */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
        <div className="flex items-center gap-2">
          <h3 className="text-white text-[18px] font-semibold">Hugo Herbots</h3>
          {isAvatarSpeaking && (
            <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">Spreekt</span>
          )}
        </div>
        <p className="text-white/70 text-[14px]">{formatTime(sessionTimer)}</p>
        {isAvatarLoading && (
          <p className="text-white/60 text-[12px] mt-1">Avatar laden...</p>
        )}
      </div>

      {/* PiP preview - user camera - circular */}
      <div 
        className="absolute top-4 right-4 flex items-center justify-center border-2 border-white/30 shadow-xl z-10"
        style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#475569' }}
      >
        <div 
          className="flex items-center justify-center"
          style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--hh-ui-100)' }}
        >
          <span className="text-slate-700 text-[12px] font-medium">JIJ</span>
        </div>
      </div>

      {/* Bottom controls - circular buttons */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="flex items-center justify-center transition-colors"
              style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%',
                backgroundColor: isMuted ? 'white' : 'rgba(255,255,255,0.2)' 
              }}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-slate-800" /> : <Mic className="w-5 h-5 text-white" />}
            </button>
            <span className="text-white/70 text-[11px]">{isMuted ? "Unmute" : "Mute"}</span>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <button 
              className="flex items-center justify-center"
              style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)' 
              }}
            >
              <Video className="w-5 h-5 text-white" />
            </button>
            <span className="text-white/70 text-[11px]">Camera</span>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={() => {
                stopHeygenAvatar();
                setChatMode("chat");
              }}
              className="flex items-center justify-center shadow-xl"
              style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%',
                backgroundColor: '#ef4444' 
              }}
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <span className="text-white/70 text-[11px]">Ophangen</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (chatMode) {
      case "audio": return renderAudioInterface();
      case "video": return renderVideoInterface();
      default: return renderChatInterface();
    }
  };

  return (
    <AppLayout currentPage="talk-to-hugo" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} contentClassName="flex-1 overflow-hidden min-h-0 flex flex-col">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Unified header row — one continuous border-bottom */}
        <div className="flex items-stretch border-b border-hh-border flex-shrink-0">
          {!assistanceConfig.blindPlay && desktopSidebarOpen && (
            <div className="hidden lg:flex items-center justify-between px-4 w-1/3 flex-shrink-0 bg-hh-bg border-r border-hh-border">
              <h3 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }} className="text-hh-ink">
                E.P.I.C. TECHNIQUE
              </h3>
              <button
                onClick={() => setDesktopSidebarOpen(false)}
                className="p-1.5 rounded-md text-hh-muted hover:text-hh-ink hover:bg-hh-ui-50 transition-colors"
                title="Sluiten"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className={`${assistanceConfig.blindPlay || !desktopSidebarOpen ? 'w-full' : 'flex-1'} flex items-center justify-between px-3 lg:px-6 py-3 lg:py-4 bg-hh-bg`}>
            {/* Left: Help sidebar toggle + Title */}
            <div className="flex items-center gap-2 lg:gap-3 min-w-0">
              {/* E.P.I.C. sidebar toggle removed from header — accessible via lightbulb action button under messages */}
              <span className="text-[13px] text-hh-muted font-medium whitespace-nowrap flex items-center gap-1">
                HugoGPT <span className="text-[11px] text-hh-muted/60 font-normal">v1.0</span>
              </span>
            </div>
            
            {/* Right: Mode toggle + Stop (Niveau is now auto-adaptive, hidden) */}
            <div className="flex items-center gap-3">

              {/* Mode toggle - refined icon buttons matching input bar style */}
              <div className="flex items-center bg-hh-ui-50 rounded-full p-0.5">
                <button
                  onClick={() => setChatMode("chat")}
                  className={`p-2 rounded-full transition-all ${chatMode === "chat" ? "bg-card shadow-sm text-hh-ink" : "text-[#4F7396]/60 hover:text-[#4F7396]"}`}
                  title="Chat"
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setChatMode("audio")}
                  className={`p-2 rounded-full transition-all ${chatMode === "audio" ? "bg-card shadow-sm text-hh-ink" : "text-[#4F7396]/60 hover:text-[#4F7396]"}`}
                  title="Bellen"
                >
                  <Phone className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setChatMode("video")}
                  className={`p-2 rounded-full transition-all ${chatMode === "video" ? "bg-card shadow-sm text-hh-ink" : "text-[#4F7396]/60 hover:text-[#4F7396]"}`}
                  title="Video"
                >
                  <Video className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              
              {/* Stop button when technique active - hide in audio/video mode (red phone handles it) */}
              {selectedTechnique && chatMode === "chat" && (
                <button
                  onClick={handleStopRoleplay}
                  className="h-8 px-3 rounded-md border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors flex items-center gap-1.5"
                  title="Stop rollenspel"
                >
                  <X className="w-3.5 h-3.5 text-hh-muted" />
                  <span className="text-[12px] text-hh-text">Stop</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body: EPIC sidebar content + Chat content side by side */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {!assistanceConfig.blindPlay && desktopSidebarOpen && (
            <div className="hidden lg:block w-1/3 flex-shrink-0 h-full overflow-y-auto bg-hh-bg border-r border-hh-border">
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
                selectedTechnique={selectedTechniqueName}
                setSelectedTechnique={setSelectedTechniqueName}
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
                hideHeader={true}
              />
            </div>
          )}

          <div className={`${assistanceConfig.blindPlay || !desktopSidebarOpen ? 'w-full' : 'flex-1'} flex flex-col bg-hh-bg overflow-hidden min-h-0`}>
            {/* Level transition notification banner */}
            {levelTransitionMessage && (
              <div className="px-6 py-3 bg-gradient-to-r from-[#4F7396]/10 to-[#4F7396]/5 border-b border-[#4F7396]/20">
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

            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              {renderMainContent()}
            </div>
          </div>
        </div>
      </div>

      <StopRoleplayDialog
        open={stopRoleplayDialogOpen}
        onOpenChange={setStopRoleplayDialogOpen}
        onConfirm={confirmStopRoleplay}
      />

      <TechniqueDetailsDialog
        open={techniqueDetailsPanelOpen}
        onOpenChange={setTechniqueDetailsPanelOpen}
        technique={selectedTechniqueDetails}
        isEditable={false}
        isAdmin={false}
        onStartPractice={startTechniqueChat}
      />

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[85%] sm:w-80 p-0 overflow-y-auto">
          <SheetHeader className="px-4 py-3 border-b border-hh-border">
            <SheetTitle className="text-left text-[16px]">E.P.I.C. TECHNIQUE</SheetTitle>
          </SheetHeader>
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
            selectedTechnique={selectedTechniqueName}
            setSelectedTechnique={(tech) => {
              setSelectedTechniqueName(tech);
              setMobileSidebarOpen(false);
            }}
            activeHouding={activeHouding}
            recommendedTechnique={recommendedTechnique}
            openTechniqueDetails={openTechniqueDetails}
            startTechniqueChat={(id, name) => {
              startTechniqueChat(id, name);
              setMobileSidebarOpen(false);
            }}
            techniquesByPhase={techniquesByPhase}
            phaseNames={phaseNames}
            getFaseBadgeColor={getFaseBadgeColor}
            getTopLevelTechniques={getTopLevelTechniques}
            hasChildren={hasChildren}
            getChildTechniques={getChildTechniques}
            klantHoudingen={klantHoudingenArray}
            difficultyLevel={difficultyLevel}
            isUserView={true}
          />
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
