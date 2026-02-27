import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Sheet, SheetContent } from "../ui/sheet";
import { EPICSalesFlow } from "./EPICSalesFlow";
import { CustomDailyCall } from "./CustomDailyCall";
import { PreJoinCheck } from "./PreJoinCheck";
import {
  Radio,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Send,
  ThumbsUp,
  MessageCircle,
  TrendingUp,
  Bell,
  Video,
  Eye,
  Hand,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  BellOff,
  Play,
  Share2,
  ExternalLink,
  Star,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Search,
  X,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useState, useEffect, useRef } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { useCountdown } from "@/hooks/useCountdown";
const hugoLivePhoto = "/images/Hugo-Herbots-WEB-0663.JPG";

const SESSION_IMAGES = [
  "/images/Hugo-Herbots-WEB-0081.JPG",
  "/images/Hugo-Herbots-WEB-0116.JPG",
  "/images/Hugo-Herbots-WEB-0251.JPG",
  "/images/Hugo-Herbots-WEB-0309.JPG",
  "/images/Hugo-Herbots-WEB-0368.JPG",
  "/images/Hugo-Herbots-WEB-0444.JPG",
  "/images/Hugo-Herbots-WEB-0555.JPG",
  "/images/Hugo-Herbots-WEB-0649.JPG",
  "/images/Hugo-Herbots-WEB-0732.JPG",
  "/images/Hugo-Herbots-WEB-0839.JPG",
];
import { liveCoachingApi, downloadIcsFile } from "@/services/liveCoachingApi";
import type { LiveSession, LiveChatMessage, LivePoll } from "@/types/liveCoaching";
import { toast } from "sonner";

interface LiveCoachingProps {
  navigate?: (page: string) => void;
  isPreview?: boolean;
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

interface LiveCoachingHeroProps {
  nextSession: LiveSession | null;
  hasPastSessions: boolean;
  onScrollToRecordings: () => void;
  onToggleReminder?: () => void;
  hasReminder?: boolean;
  onRegister?: () => void;
  isRegistered?: boolean;
}

function formatNextSessionDate(date: Date): string {
  const dayNames = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const day = dayNames[date.getDay()];
  const dayNum = date.getDate();
  const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const month = monthNames[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `Volgende sessie: ${day} ${dayNum} ${month} om ${hours}:${minutes}`;
}

function generateGoogleCalendarLink(session: LiveSession): string {
  const startDate = new Date(session.scheduledDate);
  const endDate = new Date(startDate.getTime() + (session.durationMinutes || 60) * 60000);
  
  const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d{3}/g, '');
  
  // Generate platform link to the live session
  const platformUrl = `${window.location.origin}/live?session=${session.id}`;
  
  const description = `${session.description || 'Webinar sessie met Hugo Herbots'}

📍 Klik hier om deel te nemen:
${platformUrl}`;
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: session.title,
    dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
    details: description,
    location: 'Online - Hugo Herbots AI',
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-w-[60px] sm:min-w-[70px]">
        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tabular-nums">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-white/80 text-xs sm:text-sm mt-1">{label}</span>
    </div>
  );
}

interface UserProgressStats {
  sessionsAttended: number;
  recordingsWatched: number;
  questionsAsked: number;
}

function UserProgressCard({ stats, loading }: { stats: UserProgressStats; loading: boolean }) {
  const totalStats = stats.sessionsAttended + stats.recordingsWatched + stats.questionsAsked;

  const statItems = [
    {
      icon: Bell,
      value: stats.sessionsAttended,
      label: "herinneringen",
      sublabel: "ingesteld",
      color: "text-hh-primary",
      bgColor: "bg-hh-primary/10",
    },
    {
      icon: Video,
      value: stats.recordingsWatched,
      label: "opnames",
      sublabel: "bekeken",
      color: "text-hh-success",
      bgColor: "bg-hh-success/10",
    },
    {
      icon: MessageCircle,
      value: stats.questionsAsked,
      label: "vragen",
      sublabel: "gesteld",
      color: "text-hh-warn",
      bgColor: "bg-hh-warn/10",
    },
  ];

  return (
    <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden bg-gradient-to-r from-hh-ui-50 to-card">
      <div className="p-5 sm:p-6">
        <h3 className="text-[18px] leading-[24px] sm:text-[20px] sm:leading-[28px] font-semibold text-hh-text mb-4 text-center">
          Jouw Webinar Reis
        </h3>
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {statItems.map((item, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${item.bgColor} flex items-center justify-center mb-2`}>
                {loading ? (
                  <Loader2 className={`w-5 h-5 sm:w-6 sm:h-6 ${item.color} animate-spin`} />
                ) : (
                  <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${item.color}`} />
                )}
              </div>
              <span className="text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px] font-bold text-hh-text">
                {loading ? "..." : item.value}
              </span>
              <span className="text-[12px] leading-[16px] sm:text-[14px] sm:leading-[20px] text-hh-muted">
                {item.label}
              </span>
              <span className="text-[11px] leading-[14px] sm:text-[12px] sm:leading-[16px] text-hh-muted">
                {item.sublabel}
              </span>
            </div>
          ))}
        </div>
        {!loading && totalStats === 0 && (
          <p className="text-[13px] leading-[20px] text-hh-muted text-center mt-4 pt-4 border-t border-hh-border">
            Start met je eerste sessie!
          </p>
        )}
      </div>
    </Card>
  );
}

function LiveCoachingHero({ nextSession, hasPastSessions, onScrollToRecordings, onToggleReminder, hasReminder, onRegister, isRegistered }: LiveCoachingHeroProps) {
  const countdown = useCountdown(nextSession?.scheduledDate || null);

  return (
    <div className="relative overflow-hidden rounded-2xl h-[200px] sm:h-[240px]">
      {/* Background Image - Hugo */}
      <img 
        src={hugoLivePhoto}
        alt="Hugo Herbots Webinar"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: '50% 35%' }}
      />
      {/* Gradient overlay - dark to light from left */}
      <div className="absolute inset-0 bg-gradient-to-r from-hh-ink via-hh-ink/80 to-transparent" />
      
      {/* Content */}
      <div className="relative h-full flex items-center p-6 sm:p-8">
        <div className="text-white space-y-3 max-w-lg">
          {/* Green accent badge - dynamic date */}
          <Badge className="text-white border-0" style={{ backgroundColor: '#4F7396' }}>
            <CalendarIcon className="w-3 h-3 mr-1" />
            {nextSession?.scheduledDate 
              ? formatNextSessionDate(new Date(nextSession.scheduledDate))
              : 'Elke dinsdag om 10:00'}
          </Badge>
          
          <h2 className="text-[24px] sm:text-[32px] font-bold leading-tight">
            Webinar met Hugo
          </h2>
          
          <p className="text-white/70 text-[14px] leading-relaxed line-clamp-2">
            Wekelijks live met Hugo — stel vragen, oefen samen en leer van andere verkopers.
          </p>
          
          {/* Countdown inline if session exists */}
          {nextSession && !countdown.isExpired && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-white/60">Nog:</span>
              <span className="font-semibold text-hh-success">
                {countdown.days}d {countdown.hours}u {countdown.minutes}m
              </span>
              <span className="text-white/80">— {nextSession.title}</span>
            </div>
          )}
          
          <div className="flex flex-wrap gap-3 pt-1">
            {nextSession && (
              <Button 
                className={`gap-2 border-0 transition-colors ${isRegistered ? 'bg-white/20 text-white hover:bg-white/30' : 'text-white'}`}
                style={isRegistered ? {} : { backgroundColor: '#3d9a6e' }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!isRegistered) e.currentTarget.style.backgroundColor = '#4daa7e'; }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!isRegistered) e.currentTarget.style.backgroundColor = '#3d9a6e'; }}
                onClick={onRegister}
              >
                {isRegistered ? <CheckCircle className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {isRegistered ? 'Ingeschreven' : 'Inschrijven'}
              </Button>
            )}
            {hasPastSessions && (
              <button 
                className="inline-flex items-center gap-2 h-9 px-4 py-2 rounded-md text-sm font-medium text-white border border-white/30 transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#1C2535'; e.currentTarget.style.borderColor = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                onFocus={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#1C2535'; e.currentTarget.style.borderColor = '#ffffff'; }}
                onBlur={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                onClick={onScrollToRecordings}
              >
                <Play className="w-4 h-4" />
                Opgenomen Webinars
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveCoaching({
  navigate,
  isPreview = false,
  isAdmin,
  onboardingMode,
}: LiveCoachingProps) {
  const [chatMessage, setChatMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "polls">("chat");
  const [sessionInfoOpen, setSessionInfoOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [flowDrawerOpen, setFlowDrawerOpen] = useState(false);
  const [recordingModalOpen, setRecordingModalOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<LiveSession | null>(null);

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [recordings, setRecordings] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [polls, setPolls] = useState<LivePoll[]>([]);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [reminderSessionIds, setReminderSessionIds] = useState<Set<string>>(new Set());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [userStats, setUserStats] = useState<UserProgressStats>({ sessionsAttended: 0, recordingsWatched: 0, questionsAsked: 0 });
  const [userStatsLoading, setUserStatsLoading] = useState(true);
  
  const [activeCall, setActiveCall] = useState<{
    roomUrl: string;
    token: string;
    sessionId: string;
    sessionTitle: string;
    videoDeviceId?: string;
    audioDeviceId?: string;
    initialCameraEnabled?: boolean;
    initialMicEnabled?: boolean;
  } | null>(null);
  const [joiningCall, setJoiningCall] = useState(false);
  const [preJoinSession, setPreJoinSession] = useState<{
    session: LiveSession;
    roomUrl: string;
    token: string;
  } | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<{
    videoDeviceId?: string;
    audioDeviceId?: string;
  }>({});

  const [recordingFeedback, setRecordingFeedback] = useState<{
    [sessionId: string]: {
      rating: number;
      text: string;
      submitted: boolean;
    };
  }>({});
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarInitialized, setCalendarInitialized] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [calendarDetailSession, setCalendarDetailSession] = useState<LiveSession | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past">("all");
  const [sortField, setSortField] = useState<"title" | "date" | "status">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [registeredSessionIds, setRegisteredSessionIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('hh-registered-sessions');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [selectedSessionForRegistration, setSelectedSessionForRegistration] = useState<LiveSession | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleRegisterSession = (session: LiveSession) => {
    setSelectedSessionForRegistration(session);
    setRegistrationSuccess(false);
    setShowRegistrationDialog(true);
  };

  const confirmRegistration = () => {
    if (!selectedSessionForRegistration) return;
    
    const newRegistered = new Set(registeredSessionIds);
    newRegistered.add(selectedSessionForRegistration.id);
    setRegisteredSessionIds(newRegistered);
    
    try {
      localStorage.setItem('hh-registered-sessions', JSON.stringify([...newRegistered]));
    } catch { }
    
    setRegistrationSuccess(true);
    toast.success("Je bent ingeschreven voor deze sessie!");
  };

  const closeRegistrationDialog = () => {
    setShowRegistrationDialog(false);
    setSelectedSessionForRegistration(null);
    setRegistrationSuccess(false);
  };

  const loadFeedbackFromStorage = (recordingId: string) => {
    try {
      const stored = localStorage.getItem(`hh-recording-feedback-${recordingId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecordingFeedback((prev) => ({
          ...prev,
          [recordingId]: {
            rating: parsed.rating || 0,
            text: parsed.text || "",
            submitted: true,
          },
        }));
      }
    } catch { }
  };

  const saveFeedbackToStorage = (recordingId: string, rating: number, text: string) => {
    try {
      localStorage.setItem(`hh-recording-feedback-${recordingId}`, JSON.stringify({ rating, text }));
    } catch { }
  };

  useEffect(() => {
    if (selectedRecording?.id) {
      loadFeedbackFromStorage(selectedRecording.id);
    }
  }, [selectedRecording?.id]);

  useEffect(() => {
    loadSessions();
    loadRecordings();
  }, []);

  useEffect(() => {
    setUserStats({
      sessionsAttended: reminderSessionIds.size,
      recordingsWatched: recordings.length,
      questionsAsked: 0,
    });
    setUserStatsLoading(false);
  }, [reminderSessionIds, recordings.length]);

  async function loadSessions() {
    try {
      setLoading(true);
      const { sessions } = await liveCoachingApi.sessions.list();
      setSessions(sessions);
    } catch (error: any) {
      toast.error("Kon sessies niet laden");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecordings() {
    try {
      setRecordingsLoading(true);
      const { supabase } = await import('@/utils/supabase/client');
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/live-sessions/recordings', {
        headers: authSession?.access_token ? {
          'Authorization': `Bearer ${authSession.access_token}`
        } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecordings(data);
      }
    } catch (error) {
      console.error("Failed to load recordings:", error);
    } finally {
      setRecordingsLoading(false);
    }
  }

  // Use case-insensitive status comparison
  const liveSession = sessions.find((s) => s.status?.toLowerCase() === "live");
  const upcomingSessionsRaw = sessions.filter((s) => s.status?.toLowerCase() === "upcoming");
  const pastSessions = sessions.filter((s) => s.status?.toLowerCase() === "ended");

  useEffect(() => {
    if (!calendarInitialized && sessions.length > 0) {
      const allSorted = [...sessions]
        .filter(s => s.scheduledDate)
        .sort((a, b) => new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime());
      const now = new Date();
      const nextSession = allSorted.find(s => new Date(s.scheduledDate || 0) >= now);
      if (nextSession) {
        const d = new Date(nextSession.scheduledDate || '');
        setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      } else if (allSorted.length > 0) {
        const lastSession = allSorted[allSorted.length - 1];
        const d = new Date(lastSession.scheduledDate || '');
        setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
      setCalendarInitialized(true);
    }
  }, [sessions, calendarInitialized]);

  // Sort helper for sessions
  const handleSort = (field: "title" | "date" | "status") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const upcomingSessionsSorted = [...upcomingSessionsRaw].sort((a, b) => {
    let comparison = 0;
    if (sortField === "title") {
      comparison = (a.title || "").localeCompare(b.title || "");
    } else if (sortField === "date") {
      comparison = new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime();
    } else if (sortField === "status") {
      comparison = (a.status || "").localeCompare(b.status || "");
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const upcomingSessions = selectedCalendarDate
    ? upcomingSessionsSorted.filter((s) => {
        const d = new Date(s.scheduledDate || '');
        return d.getFullYear() === selectedCalendarDate.getFullYear() &&
               d.getMonth() === selectedCalendarDate.getMonth() &&
               d.getDate() === selectedCalendarDate.getDate();
      })
    : upcomingSessionsSorted;


  useEffect(() => {
    let isMounted = true;
    if (liveSession) {
      (async () => {
        await loadChatMessages(liveSession.id, () => isMounted);
        await loadPolls(liveSession.id, () => isMounted);
      })();
    } else {
      setChatMessages([]);
      setPolls([]);
      setChatLoading(false);
    }
    return () => { isMounted = false; };
  }, [liveSession?.id]);

  useEffect(() => {
    let isCancelled = false;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function loadReminders(accessToken: string) {
      if (upcomingSessions.length === 0 || isCancelled) {
        if (!isCancelled) setReminderSessionIds(new Set());
        return;
      }
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        };
        const ids = new Set<string>();
        await Promise.all(upcomingSessions.map(async (session) => {
          try {
            const response = await fetch(`/api/live-sessions/${session.id}/reminder`, {
              method: 'GET',
              headers,
            });
            if (response.ok) {
              const data = await response.json();
              if (data.hasReminder) {
                ids.add(session.id);
              }
            }
          } catch { }
        }));
        if (!isCancelled) {
          setReminderSessionIds(ids);
        }
      } catch {
        if (!isCancelled) {
          setReminderSessionIds(new Set());
        }
      }
    }

    async function initReminders() {
      const { supabase } = await import('@/utils/supabase/client');
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (authSession?.access_token && !isCancelled) {
        loadReminders(authSession.access_token);
      } else {
        if (!isCancelled) setReminderSessionIds(new Set());
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.access_token && !isCancelled) {
            loadReminders(session.access_token);
            subscription.unsubscribe();
            authSubscription = null;
          }
        });
        authSubscription = subscription;
      }
    }

    if (upcomingSessions.length === 0) {
      setReminderSessionIds(new Set());
    } else {
      initReminders();
    }

    return () => {
      isCancelled = true;
      authSubscription?.unsubscribe();
    };
  }, [sessions]);

  async function loadChatMessages(sessionId: string, isMountedCheck?: () => boolean) {
    try {
      setChatLoading(true);
      const { messages } = await liveCoachingApi.chat.list(sessionId);
      if (isMountedCheck && !isMountedCheck()) return;
      setChatMessages(messages);
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
      }, 100);
    } catch (error) {
      console.error("Failed to load chat:", error);
    } finally {
      if (!isMountedCheck || isMountedCheck()) {
        setChatLoading(false);
      }
    }
  }

  async function loadPolls(sessionId: string, isMountedCheck?: () => boolean) {
    try {
      const { polls } = await liveCoachingApi.polls.list(sessionId);
      if (isMountedCheck && !isMountedCheck()) return;
      setPolls(polls);
    } catch (error) {
      console.error("Failed to load polls:", error);
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !liveSession || sendingMessage) return;

    try {
      setSendingMessage(true);
      const newMessage = await liveCoachingApi.chat.send(liveSession.id, chatMessage.trim());
      setChatMessages((prev) => [...prev, newMessage]);
      setChatMessage("");
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    } catch (error: any) {
      if (error.message?.includes("Rate")) {
        toast.error("Maximum 5 berichten per minuut. Probeer het later opnieuw.");
      } else {
        toast.error(error.message || "Kon bericht niet verzenden");
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      setVotingPollId(pollId);
      const { poll: updatedPoll } = await liveCoachingApi.polls.vote(pollId, optionId);
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? { ...p, ...updatedPoll, userVoted: true, userVoteOptionId: optionId } : p))
      );
      toast.success("Stem geregistreerd!");
    } catch (error: any) {
      if (error.message?.includes("gestemd")) {
        toast.error("Je hebt al op deze poll gestemd");
      } else {
        toast.error(error.message || "Kon niet stemmen");
      }
    } finally {
      setVotingPollId(null);
    }
  };

  const handleReaction = (emoji: string) => {
    console.log("Reaction:", emoji);
  };

  const handleRaiseHand = () => {
    setHandRaised(!handRaised);
    if (!handRaised) {
      toast.success("Je hand is opgestoken!");
    }
  };

  const handleJoinLiveSession = async (session: LiveSession) => {
    try {
      setJoiningCall(true);
      const tokenData = await liveCoachingApi.sessions.getToken(session.id);
      if (tokenData.roomUrl && tokenData.token) {
        setPreJoinSession({
          session,
          roomUrl: tokenData.roomUrl,
          token: tokenData.token,
        });
      } else {
        toast.error("Geen geldige sessie data ontvangen");
      }
    } catch (error: any) {
      const errorMessage = error.message || "";
      if (errorMessage.includes("verlopen") || errorMessage.includes("expired") || errorMessage.includes("ROOM_EXPIRED")) {
        toast.error("Deze sessie is verlopen. Probeer het later opnieuw.");
        loadSessions();
      } else if (errorMessage.includes("niet actief") || errorMessage.includes("SESSION_NOT_ACTIVE")) {
        toast.error("Deze sessie is niet meer actief.");
        loadSessions();
      } else {
        toast.error("Kon niet deelnemen: " + errorMessage);
      }
    } finally {
      setJoiningCall(false);
    }
  };

  const handlePreJoinComplete = (devices: { 
    videoDeviceId?: string; 
    audioDeviceId?: string;
    isCameraEnabled: boolean;
    isMicEnabled: boolean;
  }) => {
    if (!preJoinSession) return;
    setSelectedDevices(devices);
    setActiveCall({
      roomUrl: preJoinSession.roomUrl,
      token: preJoinSession.token,
      sessionId: preJoinSession.session.id,
      sessionTitle: preJoinSession.session.title,
      videoDeviceId: devices.videoDeviceId,
      audioDeviceId: devices.audioDeviceId,
      initialCameraEnabled: devices.isCameraEnabled,
      initialMicEnabled: devices.isMicEnabled,
    });
    setPreJoinSession(null);
  };

  const handlePreJoinCancel = () => {
    setPreJoinSession(null);
  };

  const handleLeaveCall = () => {
    setActiveCall(null);
    loadSessions();
  };

  const toggleReminder = async (sessionId: string) => {
    try {
      if (reminderSessionIds.has(sessionId)) {
        await liveCoachingApi.reminders.delete(sessionId);
        setReminderSessionIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
        toast.success("Herinnering verwijderd");
      } else {
        await liveCoachingApi.reminders.create(sessionId);
        setReminderSessionIds((prev) => new Set(prev).add(sessionId));
        toast.success("Herinnering ingesteld! Je ontvangt een notificatie.");
      }
    } catch (error: any) {
      toast.error(error.message || "Kon herinnering niet instellen");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <AppLayout currentPage="live" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-hh-muted" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      currentPage="live"
      navigate={navigate}
      isAdmin={isAdmin}
      onboardingMode={onboardingMode}
      onOpenFlowDrawer={() => setFlowDrawerOpen(true)}
    >
      <div className="p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-[24px] leading-[32px] sm:text-[32px] sm:leading-[40px] lg:text-[40px] lg:leading-[48px] font-normal">
              Webinars
            </h1>
            <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
              Elke week live met Hugo — stel vragen, oefen samen en leer van
              andere verkopers.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {liveSession && (
              <Button
                variant="default"
                className="gap-2 text-white animate-pulse cursor-default bg-hh-primary"
              >
                <Radio className="w-4 h-4" />
                <span>LIVE NU</span>
              </Button>
            )}
            <Button
              onClick={() => {
                setShowCalendar(!showCalendar);
                if (showCalendar) setSelectedCalendarDate(null);
              }}
              className="gap-2 transition-colors bg-hh-primary hover:bg-hh-primary/90 text-white"
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Kalender</span>
            </Button>
          </div>
        </div>

        {/* TODO[REMINDER-SYSTEM]: Implementeer belletje notificatie systeem
           Status: Pending
           Opties te implementeren:
           1. In-app notificatie: Badge op bell icon in header, telt af naar sessie (NU DOEN)
           2. E-mail reminder: Stuur email 1 uur/1 dag vooraf (LATER - email service nodig)
           3. Browser push notificatie: Desktop melding ook als app dicht is (LATER - service worker)
           4. SMS: Hoogste open rate (LATER - Twilio kosten)
           Huidige status: Bell slaat reminder op in localStorage, maar doet nog niets.
        */}
        
        {liveSession && (
          <div className="flex gap-4">
            {/* Main Video Area - Shrinks when chat is open */}
            <div className={`relative rounded-[16px] overflow-hidden shadow-hh-md transition-all duration-300 ${chatPanelOpen ? 'flex-1' : 'w-full'}`} style={{ minHeight: '70vh' }}>
              {preJoinSession ? (
                <PreJoinCheck
                  sessionTitle={preJoinSession.session.title}
                  onJoin={handlePreJoinComplete}
                  onCancel={handlePreJoinCancel}
                />
              ) : activeCall ? (
                <CustomDailyCall
                  roomUrl={activeCall.roomUrl}
                  token={activeCall.token}
                  sessionId={activeCall.sessionId}
                  sessionTitle={activeCall.sessionTitle}
                  isHost={false}
                  onLeave={handleLeaveCall}
                  videoDeviceId={activeCall.videoDeviceId}
                  audioDeviceId={activeCall.audioDeviceId}
                  initialCameraEnabled={activeCall.initialCameraEnabled}
                  initialMicEnabled={activeCall.initialMicEnabled}
                />
              ) : (
                <div className="w-full h-full bg-hh-ink flex items-center justify-center relative overflow-hidden" style={{ minHeight: '70vh' }}>
                  <img
                    src={hugoLivePhoto}
                    alt="Hugo Herbots Webinar"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  
                  {/* Top Bar - Minimal */}
                  <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20">
                    <div className="flex items-center gap-3">
                      <Badge 
                        className="text-white border-none flex items-center gap-2 px-3 py-1.5 bg-hh-primary"
                      >
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span>LIVE</span>
                      </Badge>
                      <span className="text-white/90 font-medium">{liveSession.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {liveSession.viewerCount !== undefined && liveSession.viewerCount > 0 && (
                        <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2">
                          <Eye className="w-4 h-4 text-white" />
                          <span className="text-white text-[14px]">{liveSession.viewerCount}</span>
                        </div>
                      )}
                      {/* Chat toggle verwijderd - chat alleen in sidebar */}
                    </div>
                  </div>
                  
                  {/* Center Join Button */}
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <Button
                      size="lg"
                      className="text-white gap-3 px-10 py-7 text-xl shadow-2xl bg-hh-primary hover:bg-hh-primary/90"
                      onClick={() => handleJoinLiveSession(liveSession)}
                      disabled={joiningCall}
                    >
                      {joiningCall ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : (
                        <Play className="w-7 h-7" />
                      )}
                      Neem deel
                    </Button>
                  </div>
                  
                  {/* Bottom Reactions */}
                  <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                    {["🔥", "👏", "💯", "❤️"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors hover:scale-110"
                      >
                        <span className="text-[24px]">{emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Panel - Side by side with video */}
            {chatPanelOpen && (
            <div 
              className="w-[350px] bg-hh-bg rounded-[16px] shadow-hh-md border border-hh-border flex-shrink-0"
              style={{ minHeight: '70vh' }}
            >
              <div className="flex flex-col h-full">
                {/* Chat Header */}
                <div className="p-4 border-b border-hh-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-hh-primary" />
                    <span className="font-medium text-hh-text">Live Chat</span>
                    {chatMessages.length > 0 && (
                      <Badge className="bg-hh-primary/10 text-hh-primary text-[10px]">{chatMessages.length}</Badge>
                    )}
                  </div>
                  <button 
                    onClick={() => setChatPanelOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-hh-ui-50 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-hh-muted" />
                  </button>
                </div>
                
                {/* Chat Tabs */}
                <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "chat" | "polls")} className="flex flex-col flex-1">
                  <div className="px-4 pt-2">
                    <TabsList className="w-full bg-hh-ui-50">
                      <TabsTrigger value="chat" className="flex-1 text-[13px] data-[state=active]:bg-hh-primary data-[state=active]:text-white">
                        Chat
                      </TabsTrigger>
                      <TabsTrigger value="polls" className="flex-1 text-[13px] data-[state=active]:bg-hh-primary data-[state=active]:text-white">
                        Polls ({polls.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="chat" className="flex-1 flex flex-col mt-0 overflow-hidden">
                    {/* Removed duplicate hand raise button - Daily.co has this built in */}
                    
                    <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                      {chatLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-hh-muted" />
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="text-center py-8 text-hh-muted">
                          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-[14px]">Nog geen berichten</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {chatMessages.map((msg) => (
                            <div key={msg.id} className="flex gap-2">
                              <Avatar className="flex-shrink-0 w-7 h-7">
                                <AvatarFallback className={msg.isHost ? "bg-hh-primary text-white text-[10px]" : "bg-hh-ui-200 text-hh-text text-[10px]"}>
                                  {getInitials(msg.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className={`text-[13px] font-medium ${msg.isHost ? "text-hh-primary" : "text-hh-text"}`}>
                                    {msg.userName}
                                  </span>
                                  {msg.isHost && <Badge className="bg-hh-primary text-white text-[9px] px-1 py-0">HOST</Badge>}
                                </div>
                                <p className="text-[13px] text-hh-text leading-relaxed">{msg.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    <div className="p-3 border-t border-hh-border">
                      <div className="flex gap-2">
                        <Input
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder="Stel een vraag..."
                          className="flex-1 text-[13px]"
                          disabled={sendingMessage}
                          maxLength={500}
                        />
                        <Button onClick={handleSendMessage} disabled={!chatMessage.trim() || sendingMessage} size="icon" className="shrink-0">
                          {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="polls" className="flex-1 p-4 overflow-auto">
                    {polls.length === 0 ? (
                      <div className="text-center py-8 text-hh-muted">
                        <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-[14px]">Geen actieve polls</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {polls.map((poll) => (
                          <div key={poll.id} className="p-3 rounded-lg border border-hh-border">
                            <p className="text-[14px] text-hh-text font-medium mb-3">{poll.question}</p>
                            <div className="space-y-2">
                              {poll.options.map((option) => {
                                const percentage = poll.totalVotes > 0 ? Math.round((option.voteCount / poll.totalVotes) * 100) : 0;
                                const isUserVote = poll.userVoteOptionId === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => !poll.userVoted && poll.isActive && handleVote(poll.id, option.id)}
                                    disabled={poll.userVoted || !poll.isActive}
                                    className={`w-full text-left p-2 rounded-lg border text-[13px] relative overflow-hidden ${
                                      isUserVote ? "border-hh-primary bg-hh-primary/5" : "border-hh-border"
                                    }`}
                                  >
                                    <div className="absolute inset-0 bg-hh-primary/10" style={{ width: `${percentage}%` }} />
                                    <div className="relative flex justify-between">
                                      <span>{option.optionText} {isUserVote && "✓"}</span>
                                      <span className="text-hh-primary">{percentage}%</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            )}
            
            {/* Chat Toggle FAB verwijderd - chat is nu alleen in sidebar */}
          </div>
        )}
        
        {/* Session Info Collapsible - shown when live */}
        {liveSession && (
          <div className="mt-4">
            <Collapsible open={sessionInfoOpen} onOpenChange={setSessionInfoOpen}>
              <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-hh-ui-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {liveSession.topic && <Badge variant="outline">{liveSession.topic}</Badge>}
                    <h3 className="text-hh-text">{liveSession.title}</h3>
                  </div>
                  {sessionInfoOpen ? (
                    <ChevronUp className="w-5 h-5 text-hh-muted" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-hh-muted" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-6 border-t border-hh-border">
                    <h4 className="text-hh-text mb-3">Over deze sessie</h4>
                    <p className="text-hh-muted mb-4">
                      {liveSession.description || "Live coaching sessie met Hugo Herbots."}
                    </p>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-hh-primary" />
                        </div>
                        <div>
                          <p className="text-[14px] leading-[20px] text-hh-muted">Duur</p>
                          <p className="text-hh-text">{liveSession.durationMinutes} min</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                          <CalendarIcon className="w-5 h-5 text-hh-success" />
                        </div>
                        <div>
                          <p className="text-[14px] leading-[20px] text-hh-muted">Datum</p>
                          <p className="text-hh-text">
                            {new Date(liveSession.scheduledDate).toLocaleDateString("nl-NL")}
                          </p>
                        </div>
                      </div>
                      {liveSession.viewerCount !== undefined && (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-hh-warn" />
                          </div>
                          <div>
                            <p className="text-[14px] leading-[20px] text-hh-muted">Kijkers</p>
                            <p className="text-hh-text">{liveSession.viewerCount}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        )}

        {!liveSession && upcomingSessions.length > 0 && (
          <div className="space-y-8">
            <LiveCoachingHero
              nextSession={upcomingSessions[0]}
              hasPastSessions={pastSessions.length > 0}
              onScrollToRecordings={() => {
                document.getElementById('recordings-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onToggleReminder={() => toggleReminder(upcomingSessions[0].id)}
              hasReminder={reminderSessionIds.has(upcomingSessions[0].id)}
              onRegister={() => handleRegisterSession(upcomingSessions[0])}
              isRegistered={registeredSessionIds.has(upcomingSessions[0].id)}
            />
            

            
            {/* Search bar with filters - VideoLibrary style */}
            <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
                  <Input
                    placeholder="Zoek sessies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as "all" | "upcoming" | "past")}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Alle Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="upcoming">Aankomend</SelectItem>
                    <SelectItem value="past">Afgelopen</SelectItem>
                  </SelectContent>
                </Select>
                <div className="hidden sm:flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`${viewMode === "list" ? "bg-hh-primary text-white hover:bg-hh-primary/90" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`${viewMode === "grid" ? "bg-hh-primary text-white hover:bg-hh-primary/90" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>

            <div>

              {showCalendar && (() => {
                const MONTH_NAMES = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
                const DAY_HEADERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
                const year = calendarMonth.getFullYear();
                const month = calendarMonth.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const startDayOfWeek = (firstDay.getDay() + 6) % 7;
                const daysInMonth = lastDay.getDate();
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const allSessions = [...upcomingSessionsSorted, ...pastSessions];
                const sessionsByDay: Record<string, { time: string; status: string; session: LiveSession }[]> = {};
                allSessions.forEach(s => {
                  const d = new Date(s.scheduledDate || '');
                  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                  if (!sessionsByDay[key]) sessionsByDay[key] = [];
                  sessionsByDay[key].push({
                    time: d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
                    status: s.status?.toLowerCase() || '',
                    session: s
                  });
                });

                const cells: (number | null)[] = [];
                for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                while (cells.length % 7 !== 0) cells.push(null);

                const isSelected = (day: number) => {
                  if (!selectedCalendarDate) return false;
                  return selectedCalendarDate.getFullYear() === year && selectedCalendarDate.getMonth() === month && selectedCalendarDate.getDate() === day;
                };

                const isToday = (day: number) => {
                  return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                };

                const getSessionsForDay = (day: number) => sessionsByDay[`${year}-${month}-${day}`] || [];
                const hasSession = (day: number) => getSessionsForDay(day).length > 0;

                return (
                  <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <h3 className="text-[16px] font-semibold text-hh-text">{MONTH_NAMES[month]} {year}</h3>
                      <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {DAY_HEADERS.map(d => (
                        <div key={d} className="text-center text-[11px] font-medium text-hh-muted py-1">{d}</div>
                      ))}
                      {cells.map((day, i) => {
                        const daySessions = day ? getSessionsForDay(day) : [];
                        const sessionDay = daySessions.length > 0;
                        const selected = day ? isSelected(day) : false;
                        const todayDay = day ? isToday(day) : false;
                        return (
                          <button
                            key={i}
                            disabled={!day}
                            onClick={() => {
                              if (!day) return;
                              const clickedDate = new Date(year, month, day);
                              clickedDate.setHours(0, 0, 0, 0);
                              if (sessionDay) {
                                setCalendarDetailSession(daySessions[0].session);
                                setSelectedCalendarDate(clickedDate);
                              } else if (selectedCalendarDate && selected) {
                                setSelectedCalendarDate(null);
                              } else {
                                setSelectedCalendarDate(clickedDate);
                              }
                            }}
                            className={`
                              relative flex flex-col items-center justify-center rounded-lg text-[13px] transition-colors
                              ${!day ? 'invisible' : 'cursor-pointer'}
                              ${selected && !sessionDay ? 'bg-hh-primary text-white rounded-lg' : ''}
                              ${selected && sessionDay ? 'bg-hh-primary text-white rounded-lg' : ''}
                              ${sessionDay && !selected ? 'hover:opacity-80' : ''}
                              ${!sessionDay && !selected ? 'hover:bg-hh-ui-50' : ''}
                              ${todayDay && !selected && !sessionDay ? 'bg-hh-ui-50 font-bold ring-1 ring-hh-primary/30' : ''}
                              ${!selected && !sessionDay && !todayDay ? 'text-hh-text' : ''}
                            `}
                            style={selected ? {
                              padding: '4px 2px',
                              minHeight: '44px',
                            } : sessionDay ? {
                              backgroundColor: 'color-mix(in srgb, var(--hh-success) 15%, transparent)',
                              padding: '4px 2px',
                              minHeight: '44px',
                            } : {
                              padding: '6px 2px',
                              minHeight: '44px',
                            }}
                          >
                            <span className={sessionDay && !selected ? 'font-semibold text-hh-success' : ''} style={todayDay && sessionDay && !selected ? { textDecoration: 'underline', textUnderlineOffset: '2px' } : undefined}>
                              {day}
                            </span>
                            {sessionDay && (
                              <span className={`text-[9px] leading-none mt-0.5 font-medium ${selected ? 'text-white/80' : 'text-hh-success'}`}>
                                {daySessions[0].time}
                              </span>
                            )}
                            {sessionDay && !selected && (
                              <span
                                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-hh-primary shadow-[0_0_0_2px_hsl(var(--hh-primary)/0.25)]"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedCalendarDate && (
                      <div className="mt-3 pt-3 border-t border-hh-border flex items-center justify-between">
                        <span className="text-[13px] text-hh-muted">
                          Gefilterd op: <span className="font-medium text-hh-text">{selectedCalendarDate.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        </span>
                        <Button variant="ghost" size="sm" className="text-hh-muted text-[12px] h-7" onClick={() => setSelectedCalendarDate(null)}>
                          <X className="w-3 h-3 mr-1" /> Wis filter
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })()}

              <h2 className="text-[24px] leading-[32px] text-hh-text mb-4">Aankomende Sessies</h2>
              {viewMode === "grid" ? (
              /* Card Grid View */
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingSessions.map((session, sessionIndex) => {
                const truncatedDescription = session.description 
                  ? session.description.length > 100 
                    ? session.description.substring(0, 100) + "..." 
                    : session.description
                  : null;
                
                return (
                  <Card
                    key={session.id}
                    className="rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-all flex flex-col overflow-hidden"
                  >
                    <div className="relative aspect-video">
                      <img 
                        src={SESSION_IMAGES[sessionIndex % SESSION_IMAGES.length]} 
                        alt={session.title}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                      />
                      <div className="absolute top-3 right-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 bg-card/90 hover:bg-card shadow-sm"
                          onClick={() => toggleReminder(session.id)}
                        >
                          {reminderSessionIds.has(session.id) ? (
                            <BellOff className="w-4 h-4 text-hh-primary" />
                          ) : (
                            <Bell className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="text-[11px] bg-hh-primary text-white border-none">
                          Gepland
                        </Badge>
                        {session.topic && (
                          <Badge variant="outline" className="text-[11px]">
                            {session.topic}
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="text-[16px] leading-[22px] text-hh-text font-semibold mb-2">
                        {session.title}
                      </h3>
                      
                      {truncatedDescription && (
                        <p className="text-[13px] leading-[18px] text-hh-muted mb-3">
                          {truncatedDescription}
                        </p>
                      )}
                      
                      <div className="space-y-1.5 mt-auto">
                        <div className="flex items-center gap-2 text-[13px] leading-[18px] text-hh-text">
                          <CalendarIcon className="w-4 h-4 text-hh-muted flex-shrink-0" />
                          <span>
                            {new Date(session.scheduledDate).toLocaleDateString("nl-NL", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[13px] leading-[18px] text-hh-text">
                          <Clock className="w-4 h-4 text-hh-muted flex-shrink-0" />
                          <span>
                            {new Date(session.scheduledDate).toLocaleTimeString("nl-NL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            • {session.durationMinutes} min
                          </span>
                        </div>
                        {session.viewerCount && session.viewerCount > 0 && (
                          <div className="flex items-center gap-2 text-[13px] leading-[18px] text-hh-primary">
                            <Users className="w-4 h-4 flex-shrink-0" />
                            <span>{session.viewerCount} verkopers nemen deel</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-hh-border space-y-2">
                        <Button
                          size="sm"
                          className={`w-full gap-2 ${registeredSessionIds.has(session.id) ? 'bg-hh-ui-100 text-hh-text hover:bg-hh-ui-200' : 'bg-hh-primary hover:bg-hh-primary/90 text-white'}`}
                          onClick={() => handleRegisterSession(session)}
                        >
                          {registeredSessionIds.has(session.id) ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Ingeschreven
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              Inschrijven
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => downloadIcsFile(session)}
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          Voeg toe aan agenda
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
              </div>
              ) : (
              /* List View - Sortable Table */
              <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-hh-ui-50 border-b border-hh-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium w-[60px]"></th>
                        <th 
                          className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                          onClick={() => handleSort("title")}
                        >
                          <span className="flex items-center gap-1">
                            Onderwerp
                            {sortField === "title" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </span>
                        </th>
                        <th 
                          className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                          onClick={() => handleSort("date")}
                        >
                          <span className="flex items-center gap-1">
                            Datum
                            {sortField === "date" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </span>
                        </th>
                        <th 
                          className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text"
                          onClick={() => handleSort("status")}
                        >
                          <span className="flex items-center gap-1">
                            Status
                            {sortField === "status" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </span>
                        </th>
                        <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingSessions.map((session, sessionIndex) => (
                        <tr key={session.id} className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors">
                          <td className="py-3 px-4">
                            <img 
                              src={SESSION_IMAGES[sessionIndex % SESSION_IMAGES.length]} 
                              alt={session.title}
                              className="w-12 h-12 rounded-lg object-cover object-top"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[15px] text-hh-text font-medium">{session.title}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 text-[13px] text-hh-text">
                                <CalendarIcon className="w-3.5 h-3.5 text-hh-muted" />
                                {new Date(session.scheduledDate).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}
                              </span>
                              <span className="flex items-center gap-1.5 text-[13px] text-hh-muted">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(session.scheduledDate).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} • {session.durationMinutes} min
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className="text-[11px] bg-hh-primary text-white border-none">
                              Gepland
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => toggleReminder(session.id)}
                                title={reminderSessionIds.has(session.id) ? "Herinnering uitschakelen" : "Herinnering instellen"}
                              >
                                {reminderSessionIds.has(session.id) ? (
                                  <BellOff className="w-4 h-4 text-hh-primary" />
                                ) : (
                                  <Bell className="w-4 h-4 text-hh-muted" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => downloadIcsFile(session)}
                                title="Voeg toe aan agenda"
                              >
                                <CalendarIcon className="w-4 h-4 text-hh-muted" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${registeredSessionIds.has(session.id) ? 'text-hh-success' : ''}`}
                                onClick={() => handleRegisterSession(session)}
                                title={registeredSessionIds.has(session.id) ? "Ingeschreven" : "Inschrijven"}
                              >
                                {registeredSessionIds.has(session.id) ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <UserPlus className="w-4 h-4 text-hh-muted" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              )}
            </div>
          </div>
        )}

        {!liveSession && upcomingSessions.length === 0 && (
          <div className="space-y-8">
            <LiveCoachingHero
              nextSession={null}
              hasPastSessions={pastSessions.length > 0}
              onScrollToRecordings={() => {
                document.getElementById('recordings-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onToggleReminder={undefined}
              hasReminder={false}
              onRegister={undefined}
              isRegistered={false}
            />
            

          </div>
        )}

        {((pastSessions.length > 0) || (recordings.length > 0)) && (
          <div id="recordings-section" className="mt-12 pt-8 border-t border-hh-border">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-hh-primary">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-[24px] leading-[32px] text-hh-text font-semibold">
                    Opgenomen Webinars
                  </h2>
                  <p className="text-[13px] leading-[18px] text-hh-muted">
                    {recordings.length} {recordings.length === 1 ? 'opname' : 'opnames'} beschikbaar
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {/* Processed recordings from the pipeline */}
              {recordings.map((session, index) => {
                const sessionDate = new Date(session.scheduledDate || session.createdAt || '');
                const muxPlaybackId = session.muxPlaybackId;
                const thumbnail = muxPlaybackId 
                  ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=640&height=360&fit_mode=preserve`
                  : SESSION_IMAGES[index % SESSION_IMAGES.length];
                
                return (
                  <div
                    key={session.id}
                    className="group cursor-pointer"
                    onClick={() => {
                      if (navigate) {
                        navigate(`video/${session.id}?source=webinar`);
                      }
                    }}
                  >
                    <div className="relative rounded-xl overflow-hidden mb-3 shadow-sm group-hover:shadow-lg transition-shadow" style={{ aspectRatio: "16/9" }}>
                      <img
                        src={thumbnail}
                        alt={session.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 bg-hh-ink"
                        >
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                      
                      <div className="absolute top-2 left-2 flex gap-2">
                        <Badge className="text-[10px] px-2 py-0.5 bg-[#1e293b] text-white border-none">
                          Webinar Opname
                        </Badge>
                      </div>
                      
                      {session.durationMinutes && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] px-2 py-1 rounded">
                          {session.durationMinutes} min
                        </div>
                      )}
                    </div>
                    
                    <h4 className="text-[14px] leading-[20px] text-hh-text font-medium mb-1 line-clamp-2 group-hover:text-hh-primary transition-colors">
                      {session.title}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-[12px] text-hh-muted">
                      <span>
                        {sessionDate.toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {session.aiSummary && (
                      <p className="text-[12px] text-hh-muted mt-2 line-clamp-2 italic">
                        {session.aiSummary}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Fallback legacy past sessions that don't have muxPlaybackId yet */}
              {pastSessions.filter(s => !recordings.find(r => r.id === s.id)).map((session, index) => {
                const sessionDate = new Date(session.scheduledDate);
                const isNew = (Date.now() - sessionDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
                const hugoPhotos = [
                  "/images/Hugo-Herbots-WEB-0350.JPG",
                  "/images/Hugo-Herbots-WEB-0281.JPG",
                  "/images/Hugo-Herbots-WEB-0433.JPG",
                  "/images/Hugo-Herbots-WEB-0536.JPG",
                  "/images/Hugo-Herbots-WEB-0701.JPG",
                  "/images/Hugo-Herbots-WEB-0839.JPG"
                ];
                const placeholderThumbnail = hugoPhotos[index % hugoPhotos.length];
                
                return (
                  <div
                    key={session.id}
                    className="group cursor-pointer"
                    onClick={() => {
                      if (session.recordingUrl) {
                        setSelectedRecording(session);
                        setRecordingModalOpen(true);
                      }
                    }}
                  >
                    <div className="relative rounded-xl overflow-hidden mb-3 shadow-sm group-hover:shadow-lg transition-shadow" style={{ aspectRatio: "16/9" }}>
                      <img
                        src={placeholderThumbnail}
                        alt={session.title}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                      
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 bg-hh-ink"
                        >
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                      
                      {isNew && (
                        <div className="absolute top-2 left-2">
                          <Badge className="text-[10px] px-2 py-0.5 bg-hh-primary text-white border-none">
                            Nieuw
                          </Badge>
                        </div>
                      )}
                      
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] px-2 py-1 rounded">
                        {session.durationMinutes} min
                      </div>
                    </div>
                    
                    <h4 className="text-[14px] leading-[20px] text-hh-text font-medium mb-1 line-clamp-2 group-hover:text-hh-primary transition-colors">
                      {session.title}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-[12px] text-hh-muted">
                      <span>
                        {sessionDate.toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {session.topic && (
                        <>
                          <span className="text-hh-border">•</span>
                          <span>{session.topic}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Sheet open={flowDrawerOpen} onOpenChange={setFlowDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0"
        >
          <EPICSalesFlow
            currentPhase="fase4"
            currentStep="objection-handling"
            onClose={() => setFlowDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <Dialog open={recordingModalOpen} onOpenChange={setRecordingModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px]">
                {selectedRecording?.title}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={() => {
                  if (selectedRecording) {
                    const shareUrl = `${window.location.origin}/live?recording=${selectedRecording.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Link gekopieerd naar klembord!");
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Delen
              </Button>
            </div>
          </DialogHeader>
          {selectedRecording && (
            <div className="space-y-6">
              <div className="w-full bg-hh-ink rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: "16/9" }}>
                {selectedRecording.recordingUrl ? (
                  <video
                    src={selectedRecording.recordingUrl}
                    controls
                    className="w-full h-full"
                    poster={selectedRecording.thumbnailUrl || undefined}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-white text-[16px] leading-[24px]">
                      Opname niet beschikbaar
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {selectedRecording.topic && (
                  <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 px-3 py-1">
                    {selectedRecording.topic}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 text-[14px] leading-[20px] text-hh-muted">
                  <CalendarIcon className="w-4 h-4" />
                  <span>
                    {new Date(selectedRecording.scheduledDate).toLocaleDateString("nl-NL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[14px] leading-[20px] text-hh-muted">
                  <Clock className="w-4 h-4" />
                  <span>{selectedRecording.durationMinutes} min</span>
                </div>
              </div>
              
              {selectedRecording.topic && (
                <Card className="p-4 rounded-[12px] bg-hh-primary/5 border-hh-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-hh-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[14px] leading-[20px] font-medium text-hh-text mb-1">
                        Gerelateerde EPIC fase
                      </h4>
                      <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                        Deze sessie behandelt technieken uit de {selectedRecording.topic} fase van het EPIC verkoopmodel.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-hh-primary"
                        onClick={() => setFlowDrawerOpen(true)}
                      >
                        Bekijk EPIC flow
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
              
              <div>
                <h3 className="text-[18px] leading-[24px] text-hh-text font-medium mb-3">Beschrijving</h3>
                <p className="text-[14px] leading-[22px] text-hh-muted">
                  {selectedRecording.description || "Geen beschrijving beschikbaar."}
                </p>
              </div>

              <Card className="p-4 sm:p-5 rounded-[12px] bg-hh-ui-50 border-hh-border">
                {recordingFeedback[selectedRecording.id]?.submitted ? (
                  <div className="text-center py-2 space-y-3">
                    <div className="flex items-center justify-center gap-2 text-hh-success">
                      <Star className="w-5 h-5 fill-current" />
                      <span className="text-[16px] leading-[24px] font-medium">
                        Je hebt deze sessie beoordeeld
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = star <= (recordingFeedback[selectedRecording.id]?.rating || 0);
                        return (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${
                              isFilled
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-hh-muted"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-[16px] leading-[22px] text-hh-text font-medium text-center">
                      Wat vond je van deze sessie?
                    </h4>
                    
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const currentRating = recordingFeedback[selectedRecording.id]?.rating || 0;
                        const isFilled = star <= currentRating;
                        return (
                          <button
                            key={star}
                            onClick={() => {
                              setRecordingFeedback((prev) => ({
                                ...prev,
                                [selectedRecording.id]: {
                                  ...prev[selectedRecording.id],
                                  rating: star,
                                  text: prev[selectedRecording.id]?.text || "",
                                  submitted: false,
                                },
                              }));
                            }}
                            className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-hh-primary focus:ring-offset-2 rounded"
                            aria-label={`${star} ster${star > 1 ? 'ren' : ''}`}
                          >
                            <Star
                              className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                                isFilled
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-hh-muted"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={recordingFeedback[selectedRecording.id]?.text || ""}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 200);
                          setRecordingFeedback((prev) => ({
                            ...prev,
                            [selectedRecording.id]: {
                              ...prev[selectedRecording.id],
                              rating: prev[selectedRecording.id]?.rating || 0,
                              text: value,
                              submitted: false,
                            },
                          }));
                        }}
                        placeholder="Optionele feedback..."
                        maxLength={200}
                        className="flex-1"
                        disabled={submittingFeedback}
                      />
                      <Button
                        onClick={async () => {
                          const feedback = recordingFeedback[selectedRecording.id];
                          if (!feedback?.rating) {
                            toast.error("Selecteer eerst een rating");
                            return;
                          }
                          setSubmittingFeedback(true);
                          await new Promise((resolve) => setTimeout(resolve, 500));
                          console.log("Feedback submitted:", {
                            sessionId: selectedRecording.id,
                            sessionTitle: selectedRecording.title,
                            rating: feedback.rating,
                            text: feedback.text,
                          });
                          saveFeedbackToStorage(selectedRecording.id, feedback.rating, feedback.text || "");
                          setRecordingFeedback((prev) => ({
                            ...prev,
                            [selectedRecording.id]: {
                              ...prev[selectedRecording.id],
                              submitted: true,
                            },
                          }));
                          setSubmittingFeedback(false);
                          toast.success("Bedankt voor je feedback!");
                        }}
                        disabled={!recordingFeedback[selectedRecording.id]?.rating || submittingFeedback}
                        className="w-full sm:w-auto"
                      >
                        {submittingFeedback ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Stuur
                      </Button>
                    </div>
                    <p className="text-[12px] leading-[16px] text-hh-muted text-center">
                      Max 200 karakters
                    </p>
                  </div>
                )}
              </Card>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  onClick={() => {
                    setRecordingModalOpen(false);
                    navigate?.("coaching");
                  }} 
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Oefen deze technieken
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => {
                    if (selectedRecording) {
                      const shareUrl = `${window.location.origin}/live?recording=${selectedRecording.id}`;
                      navigator.clipboard.writeText(shareUrl);
                      toast.success("Link gekopieerd naar klembord!");
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Deel met team
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Registration Dialog */}
      <Dialog open={showRegistrationDialog} onOpenChange={(open) => { if (!open) closeRegistrationDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[20px] leading-[28px] text-hh-text">
              Inschrijven voor Webinar
            </DialogTitle>
          </DialogHeader>
          
          {selectedSessionForRegistration && (
            <div className="space-y-4">
              {!registrationSuccess ? (
                <>
                  <div className="bg-hh-ui-50 rounded-lg p-4">
                    <h3 className="text-[16px] font-semibold text-hh-text mb-2">
                      {selectedSessionForRegistration.title}
                    </h3>
                    <div className="space-y-2 text-[14px] text-hh-muted">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        <span>
                          {new Date(selectedSessionForRegistration.scheduledDate).toLocaleDateString("nl-NL", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          {new Date(selectedSessionForRegistration.scheduledDate).toLocaleTimeString("nl-NL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          • {selectedSessionForRegistration.durationMinutes || 60} minuten
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={closeRegistrationDialog}
                    >
                      Annuleren
                    </Button>
                    <Button
                      className="flex-1 text-white bg-hh-primary hover:bg-hh-primary/90"
                      onClick={confirmRegistration}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Bevestig Inschrijving
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center py-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-hh-primary">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-[18px] font-semibold text-hh-text mb-2">
                      Inschrijving bevestigd!
                    </h3>
                    <p className="text-[14px] text-hh-muted">
                      Je bent ingeschreven voor "{selectedSessionForRegistration.title}"
                    </p>
                  </div>
                  
                  <div className="bg-hh-ui-50 rounded-lg p-4">
                    <p className="text-[13px] text-hh-muted mb-3">
                      Voeg deze sessie toe aan je agenda zodat je de sessie niet mist.
                    </p>
                    <Button
                      className="w-full text-white bg-hh-primary hover:bg-hh-primary/90"
                      onClick={() => {
                        window.open(generateGoogleCalendarLink(selectedSessionForRegistration), '_blank');
                      }}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Voeg toe aan kalender
                    </Button>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={closeRegistrationDialog}
                  >
                    Sluiten
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Calendar Session Detail Dialog */}
      <Dialog open={!!calendarDetailSession} onOpenChange={(open) => { if (!open) setCalendarDetailSession(null); }}>
        <DialogContent className="p-0 overflow-hidden max-h-[85vh]" style={{ maxWidth: '420px', borderRadius: '16px' }}>
          {calendarDetailSession && (() => {
            const sessionIdx = [...upcomingSessionsSorted, ...pastSessions].findIndex(s => s.id === calendarDetailSession.id);
            const imgSrc = SESSION_IMAGES[(sessionIdx >= 0 ? sessionIdx : 0) % SESSION_IMAGES.length];
            const isRegistered = registeredSessionIds.has(calendarDetailSession.id);
            const hasReminder = reminderSessionIds.has(calendarDetailSession.id);
            return (
              <>
                <div className="relative" style={{ aspectRatio: '16/10' }}>
                  <img
                    src={imgSrc}
                    alt={calendarDetailSession.title}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                  <div className="absolute top-3 right-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 bg-card/90 hover:bg-card shadow-sm rounded-full"
                      onClick={() => toggleReminder(calendarDetailSession.id)}
                    >
                      {hasReminder ? (
                        <BellOff className="w-4 h-4 text-hh-primary" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="text-[11px] px-2.5 py-0.5 bg-hh-primary text-white border-none">
                      Gepland
                    </Badge>
                    {calendarDetailSession.topic && (
                      <Badge variant="outline" className="text-[11px] px-2.5 py-0.5">
                        {calendarDetailSession.topic}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h2 className="text-[20px] leading-[26px] font-semibold text-hh-text mb-1">
                      {calendarDetailSession.title}
                    </h2>
                    {calendarDetailSession.description && (
                      <p className="text-[14px] leading-[20px] text-hh-muted">
                        {calendarDetailSession.description}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-[14px] text-hh-text">
                      <CalendarIcon className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      <span>
                        {new Date(calendarDetailSession.scheduledDate).toLocaleDateString("nl-NL", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[14px] text-hh-text">
                      <Clock className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      <span>
                        {new Date(calendarDetailSession.scheduledDate).toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" "}• {calendarDetailSession.durationMinutes || 60} min
                      </span>
                    </div>
                    {calendarDetailSession.viewerCount && calendarDetailSession.viewerCount > 0 && (
                      <div className="flex items-center gap-2.5 text-[14px] text-hh-primary">
                        <Users className="w-4 h-4 flex-shrink-0" />
                        <span>{calendarDetailSession.viewerCount} verkopers nemen deel</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-hh-border space-y-2.5">
                    <Button
                      className={`w-full gap-2 h-11 text-[15px] ${isRegistered ? 'bg-hh-ui-100 text-hh-text hover:bg-hh-ui-200' : 'bg-hh-primary hover:bg-hh-primary/90 text-white'}`}
                      onClick={() => {
                        setCalendarDetailSession(null);
                        handleRegisterSession(calendarDetailSession);
                      }}
                    >
                      {isRegistered ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Ingeschreven
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Inschrijven
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-11 text-[15px]"
                      onClick={() => downloadIcsFile(calendarDetailSession)}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Voeg toe aan agenda
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
