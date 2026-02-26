import {
  Radio,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Copy,
  Loader2,
  Video,
  ArrowLeft,
  MessageCircle,
  ThumbsUp,
  Send,
  X,
  Download,
  TrendingUp,
  CheckCircle2,
  Search,
  List,
  Grid3X3,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { CustomDailyCall } from "./CustomDailyCall";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback } from "../ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { liveCoachingApi, exportSessionsCsv } from "@/services/liveCoachingApi";
import type { LiveSession, LiveChatMessage, LivePoll } from "@/types/liveCoaching";
import { toast } from "sonner";

interface AdminLiveSessionsProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AdminLiveSessions({ navigate, isSuperAdmin }: AdminLiveSessionsProps) {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [view, setView] = useState<"list" | "upcoming">("list");
  const [showAdminCalendar, setShowAdminCalendar] = useState(false);
  const [adminCalendarMonth, setAdminCalendarMonth] = useState(() => new Date());
  const [adminSelectedDate, setAdminSelectedDate] = useState<Date | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFase, setFilterFase] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [activeCall, setActiveCall] = useState<{
    roomUrl: string;
    token: string;
    sessionId: string;
    sessionTitle: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"chat" | "polls">("chat");
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [polls, setPolls] = useState<LivePoll[]>([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    topic: "",
    phase_id: "",
    scheduledDate: "",
    scheduledTime: "14:00",
    durationMinutes: 60,
  });

  const generateGoogleCalendarLink = (session: LiveSession): string => {
    const startDate = new Date(session.scheduledDate || '');
    const endDate = new Date(startDate.getTime() + (session.durationMinutes || 60) * 60000);
    
    const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d{3}/g, '');
    
    const platformUrl = `${window.location.origin}/live?session=${session.id}`;
    
    const description = `${session.description || 'Live Coaching sessie met Hugo Herbots'}

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
  };

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      setLoading(true);
      const { sessions } = await liveCoachingApi.sessions.list();
      console.log("📋 Loaded sessions:", JSON.stringify(sessions.map(s => ({ id: s.id.slice(0,8), title: s.title, status: s.status, statusLower: s.status?.toLowerCase() }))));
      setSessions(sessions);
    } catch (error: any) {
      toast.error("Kon sessies niet laden: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const upcomingSessionsAll = sessions.filter((s) => s.status?.toLowerCase() === "upcoming" || s.status?.toLowerCase() === "live");
  const pastSessions = sessions.filter((s) => s.status?.toLowerCase() === "ended");
  
  const dateFilter = (s: LiveSession) => {
    if (!adminSelectedDate) return true;
    const d = new Date(s.scheduledDate || '');
    return d.getFullYear() === adminSelectedDate.getFullYear() &&
           d.getMonth() === adminSelectedDate.getMonth() &&
           d.getDate() === adminSelectedDate.getDate();
  };

  const upcomingSessions = upcomingSessionsAll.filter(dateFilter);

  useEffect(() => {
    let isMounted = true;
    if (activeCall) {
      loadChatMessages(activeCall.sessionId, () => isMounted);
      loadPolls(activeCall.sessionId, () => isMounted);
    } else {
      setChatMessages([]);
      setPolls([]);
    }
    return () => { isMounted = false; };
  }, [activeCall?.sessionId]);

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
    if (!chatMessage.trim() || !activeCall || sendingMessage) return;
    try {
      setSendingMessage(true);
      const newMessage = await liveCoachingApi.chat.send(activeCall.sessionId, chatMessage.trim());
      setChatMessages((prev) => [...prev, newMessage]);
      setChatMessage("");
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    } catch (error: any) {
      toast.error(error.message || "Kon bericht niet versturen");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreatePoll = async () => {
    console.log("[Poll] Creating poll, activeCall:", activeCall?.sessionId, "question:", pollQuestion);
    if (!activeCall) {
      toast.error("Geen actieve sessie gevonden");
      return;
    }
    if (!pollQuestion.trim()) {
      toast.error("Vul een vraag in");
      return;
    }
    const validOptions = pollOptions.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast.error("Minimaal 2 opties vereist");
      return;
    }
    try {
      setCreatingPoll(true);
      console.log("[Poll] Calling API with sessionId:", activeCall.sessionId);
      const newPoll = await liveCoachingApi.polls.create(activeCall.sessionId, { question: pollQuestion.trim(), options: validOptions });
      console.log("[Poll] Created:", newPoll);
      setPolls((prev) => [...prev, newPoll]);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setShowCreatePoll(false);
      toast.success("Poll aangemaakt");
    } catch (error: any) {
      console.error("[Poll] Error:", error);
      toast.error(error.message || "Kon poll niet aanmaken");
    } finally {
      setCreatingPoll(false);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    try {
      await liveCoachingApi.polls.close(pollId);
      setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, isActive: false } : p)));
      toast.success("Poll gesloten");
    } catch (error: any) {
      toast.error(error.message || "Kon poll niet sluiten");
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      topic: "",
      phase_id: "",
      scheduledDate: "",
      scheduledTime: "14:00",
      durationMinutes: 60,
    });
    setEditingSession(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowPlanModal(true);
  };

  const openEditModal = (session: LiveSession) => {
    const date = new Date(session.scheduledDate);
    setFormData({
      title: session.title,
      description: session.description || "",
      topic: session.topic || "",
      phase_id: session.phaseId ? String(session.phaseId) : "",
      scheduledDate: date.toISOString().split("T")[0],
      scheduledTime: date.toTimeString().slice(0, 5),
      durationMinutes: session.durationMinutes,
    });
    setEditingSession(session);
    setShowPlanModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.scheduledDate) {
      toast.error("Titel en datum zijn verplicht");
      return;
    }

    try {
      setSubmitting(true);
      let scheduledDateObj = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
      
      // Alleen ma-vr sessies: verplaats weekend naar maandag
      const dayOfWeek = scheduledDateObj.getDay();
      if (dayOfWeek === 0) { // Zondag -> maandag
        scheduledDateObj.setDate(scheduledDateObj.getDate() + 1);
        toast.info("Datum verplaatst naar maandag (geen sessies in weekend)");
      } else if (dayOfWeek === 6) { // Zaterdag -> maandag
        scheduledDateObj.setDate(scheduledDateObj.getDate() + 2);
        toast.info("Datum verplaatst naar maandag (geen sessies in weekend)");
      }
      
      const scheduledDate = scheduledDateObj.toISOString();

      const updateData = {
        title: formData.title,
        description: formData.description || undefined,
        scheduledDate,
        durationMinutes: formData.durationMinutes,
        topic: formData.topic || undefined,
        phaseId: formData.phase_id ? parseInt(formData.phase_id, 10) : undefined,
      };
      
      console.log("📤 Submitting session:", editingSession ? "UPDATE" : "CREATE", updateData);

      if (editingSession) {
        const result = await liveCoachingApi.sessions.update(editingSession.id, updateData);
        console.log("✅ Session updated:", result);
        toast.success("Sessie bijgewerkt");
      } else {
        const result = await liveCoachingApi.sessions.create(updateData);
        console.log("✅ Session created:", result);
        toast.success("Sessie aangemaakt");
      }

      setShowPlanModal(false);
      resetForm();
      loadSessions();
    } catch (error: any) {
      console.error("❌ Session save error:", error);
      toast.error(error.message || "Er is een fout opgetreden");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (session: LiveSession) => {
    if (!confirm(`Weet je zeker dat je "${session.title}" wilt verwijderen?`)) return;

    try {
      await liveCoachingApi.sessions.delete(session.id);
      toast.success("Sessie verwijderd");
      loadSessions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStartSession = async (session: LiveSession) => {
    try {
      await liveCoachingApi.sessions.start(session.id);
      toast.success("Sessie gestart! Daily room aangemaakt.");
      loadSessions();
      await joinSessionWithToken(session.id, session.title);
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  
  const handleJoinLiveSession = async (session: LiveSession) => {
    await joinSessionWithToken(session.id, session.title);
  };

  const joinSessionWithToken = async (sessionId: string, sessionTitle: string) => {
    try {
      const tokenData = await liveCoachingApi.sessions.getToken(sessionId);
      if (tokenData.roomUrl && tokenData.token) {
        setActiveCall({
          roomUrl: tokenData.roomUrl,
          token: tokenData.token,
          sessionId,
          sessionTitle,
        });
      } else {
        toast.error("Geen geldige meeting data ontvangen");
      }
    } catch (error: any) {
      // Check for specific error codes
      const errorMessage = error.message || "";
      if (errorMessage.includes("verlopen") || errorMessage.includes("expired") || errorMessage.includes("ROOM_EXPIRED")) {
        toast.error("Deze sessie is verlopen. De sessie wordt nu beëindigd.");
        loadSessions(); // Refresh to get updated session states
      } else if (errorMessage.includes("niet actief") || errorMessage.includes("SESSION_NOT_ACTIVE")) {
        toast.error("Deze sessie is niet meer actief.");
        loadSessions();
      } else {
        toast.error("Kon meeting niet starten: " + errorMessage);
      }
    }
  };
  
  const handleLeaveCall = () => {
    setActiveCall(null);
    loadSessions();
  };
  
  const handleEndSessionFromCall = async () => {
    if (!activeCall) return;
    try {
      await liveCoachingApi.sessions.end(activeCall.sessionId);
      toast.success("Sessie beëindigd");
      setActiveCall(null);
      loadSessions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEndSession = async (session: LiveSession) => {
    if (!confirm("Weet je zeker dat je deze sessie wilt beëindigen?")) return;

    try {
      await liveCoachingApi.sessions.end(session.id);
      toast.success("Sessie beëindigd");
      loadSessions();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyJoinLink = (session: LiveSession) => {
    const url = `${window.location.origin}/live/${session.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link gekopieerd");
  };

  const handleTriggerProcess = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      setProcessingId(sessionId);
      await liveCoachingApi.sessions.triggerProcess(sessionId);
      toast.success("Verwerking gestart");
      loadSessions();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const getRecordingStatus = (session: LiveSession) => {
    if (session.muxPlaybackId) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Verwerkt
        </Badge>
      );
    }
    
    if (processingId === session.id || session.recordingReady === 0 && session.dailyRecordingId) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          In verwerking...
        </Badge>
      );
    }

    if (session.dailyRecordingUrl || session.recordingReady === 1) {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">
            Niet verwerkt
          </Badge>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 px-2 text-[11px] gap-1"
            onClick={(e) => handleTriggerProcess(e, session.id)}
            disabled={!!processingId}
          >
            <Play className="w-3 h-3" />
            Verwerk
          </Button>
        </div>
      );
    }

    if (session.status?.toLowerCase() === 'ended' || session.status?.toLowerCase() === 'completed') {
      return (
        <Badge variant="outline" className="text-hh-muted opacity-50">
          Geen opname
        </Badge>
      );
    }

    return null;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "live":
        return (
          <Badge className="bg-red-600 text-white border-0 text-[11px]">
            <Radio className="w-3 h-3 mr-1 animate-pulse" />
            LIVE
          </Badge>
        );
      case "upcoming":
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[11px]">
            Gepland
          </Badge>
        );
      case "ended":
        return (
          <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[11px]">
            Afgelopen
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <AdminLayout currentPage="admin-live" navigate={navigate} isSuperAdmin={isSuperAdmin}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-hh-muted" />
        </div>
      </AdminLayout>
    );
  }

  if (activeCall) {
    return (
      <AdminLayout currentPage="admin-live" navigate={navigate} isSuperAdmin={isSuperAdmin}>
        <div className="p-6 space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveCall}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug naar overzicht
          </Button>
          
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="w-full lg:w-[60%]">
              <CustomDailyCall
                roomUrl={activeCall.roomUrl}
                token={activeCall.token}
                sessionId={activeCall.sessionId}
                sessionTitle={activeCall.sessionTitle}
                isHost={true}
                onLeave={handleLeaveCall}
                onEndSession={handleEndSessionFromCall}
              />
            </div>

            <div className="w-full lg:w-[40%] h-[60vh] lg:h-[600px]">
              <Card className="rounded-[16px] shadow-md border overflow-hidden flex flex-col h-full">
                <Tabs
                  value={activeTab}
                  onValueChange={(v: string) => setActiveTab(v as "chat" | "polls")}
                  className="flex flex-col h-full"
                >
                  <div className="border-b px-4 pt-4 flex-shrink-0">
                    <TabsList className="w-full bg-hh-ui-100">
                      <TabsTrigger
                        value="chat"
                        className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat
                      </TabsTrigger>
                      <TabsTrigger
                        value="polls"
                        className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                      >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Polls ({polls.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="chat" className="flex-1 flex flex-col mt-0 overflow-hidden">
                    <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                      {chatLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-hh-muted" />
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="text-center py-8 text-hh-muted">
                          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Nog geen berichten</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {chatMessages.map((msg) => (
                            <div key={msg.id} className="flex gap-3">
                              <Avatar className="flex-shrink-0 w-8 h-8">
                                <AvatarFallback
                                  className={msg.isHost ? "bg-purple-600 text-white text-[12px]" : "bg-hh-ui-200 text-hh-ink text-[12px]"}
                                >
                                  {getInitials(msg.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className={`text-sm ${msg.isHost ? "font-medium text-purple-600" : "text-hh-ink"}`}>
                                    {msg.userName}
                                  </span>
                                  {msg.isHost && (
                                    <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px] px-1.5 py-0">
                                      HOST
                                    </Badge>
                                  )}
                                  <span className="text-xs text-hh-muted">
                                    {new Date(msg.createdAt).toLocaleTimeString("nl-NL", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="text-sm text-hh-ink">{msg.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    <div className="p-4 border-t flex-shrink-0">
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
                          placeholder="Typ een bericht als host..."
                          className="flex-1"
                          disabled={sendingMessage}
                          maxLength={500}
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!chatMessage.trim() || sendingMessage}
                          size="icon"
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {sendingMessage ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="polls" className="flex-1 p-4 mt-0 overflow-auto">
                    <div className="mb-4">
                      {!showCreatePoll ? (
                        <Button
                          onClick={() => setShowCreatePoll(true)}
                          className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Plus className="w-4 h-4" />
                          Nieuwe Poll
                        </Button>
                      ) : (
                        <Card className="p-4 space-y-3 border-purple-500/30 bg-purple-500/5">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-hh-text">Nieuwe Poll</h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setShowCreatePoll(false);
                                setPollQuestion("");
                                setPollOptions(["", ""]);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <Input
                            value={pollQuestion}
                            onChange={(e) => setPollQuestion(e.target.value)}
                            placeholder="Vraag..."
                            maxLength={200}
                          />
                          <div className="space-y-2">
                            {pollOptions.map((opt, i) => (
                              <div key={i} className="flex gap-2">
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...pollOptions];
                                    newOpts[i] = e.target.value;
                                    setPollOptions(newOpts);
                                  }}
                                  placeholder={`Optie ${i + 1}`}
                                  maxLength={100}
                                />
                                {pollOptions.length > 2 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 flex-shrink-0"
                                    onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            {pollOptions.length < 5 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => setPollOptions([...pollOptions, ""])}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Optie toevoegen
                              </Button>
                            )}
                          </div>
                          <Button
                            onClick={handleCreatePoll}
                            disabled={creatingPoll || !pollQuestion.trim()}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {creatingPoll ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Poll Starten
                          </Button>
                        </Card>
                      )}
                    </div>

                    {polls.length === 0 ? (
                      <div className="text-center py-8 text-hh-muted">
                        <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Geen polls</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {polls.map((poll) => (
                          <Card key={poll.id} className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={poll.isActive ? "bg-purple-500/10 text-purple-500" : "bg-hh-ui-100 text-hh-muted"}>
                                {poll.isActive ? "Actief" : "Gesloten"}
                              </Badge>
                              {poll.isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleClosePoll(poll.id)}
                                >
                                  Sluiten
                                </Button>
                              )}
                            </div>
                            <p className="font-medium text-hh-text mb-3">{poll.question}</p>
                            <div className="space-y-2">
                              {poll.options.map((option) => {
                                const percentage = poll.totalVotes > 0
                                  ? Math.round((option.voteCount / poll.totalVotes) * 100)
                                  : 0;
                                return (
                                  <div key={option.id} className="relative">
                                    <div
                                      className="absolute inset-0 rounded bg-purple-500/15"
                                      style={{ width: `${percentage}%` }}
                                    />
                                    <div className="relative p-2 flex justify-between text-sm">
                                      <span>{option.optionText}</span>
                                      <span className="font-medium">{percentage}% ({option.voteCount})</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-hh-muted mt-2">
                              Totaal: {poll.totalVotes} {poll.totalVotes === 1 ? "stem" : "stemmen"}
                            </p>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="admin-live" navigate={navigate} isSuperAdmin={isSuperAdmin}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Live Coaching Sessies
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer en plan live training sessies
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={`gap-2 ${showAdminCalendar ? 'bg-purple-600 text-white hover:bg-purple-700 border-purple-600' : ''}`}
              onClick={() => {
                setShowAdminCalendar(!showAdminCalendar);
                if (showAdminCalendar) setAdminSelectedDate(null);
              }}
            >
              <CalendarIcon className="w-4 h-4" />
              Kalender
            </Button>
            <Button
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={openCreateModal}
            >
              <Plus className="w-4 h-4" />
              Plan Nieuwe Sessie
            </Button>
          </div>
        </div>

        {/* KPI Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { name: 'Totaal Sessies', value: sessions.length, icon: Radio, bgClass: 'bg-red-600/10', iconClass: 'text-red-600', badge: `+${Math.round(sessions.length * 0.12)}%` },
            { name: 'Aankomend', value: upcomingSessionsAll.length, icon: CalendarIcon, bgClass: 'bg-purple-500/10', iconClass: 'text-purple-500', badge: `+${upcomingSessionsAll.length}` },
            { name: 'Gem. Deelnemers', value: sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + (s.viewerCount || 0), 0) / Math.max(sessions.length, 1)) : 0, icon: Users, bgClass: 'bg-purple-500/10', iconClass: 'text-purple-500', badge: '+8%' },
            { name: 'Voltooide Sessies', value: pastSessions.length, icon: CheckCircle2, bgClass: 'bg-purple-500/10', iconClass: 'text-purple-500', badge: '100%' },
          ].map(stat => (
            <Card key={stat.name} className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bgClass}`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconClass}`} />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-purple-500/10 text-purple-500 border-purple-500/20">
                  {stat.badge}
                </span>
              </div>
              <p className="text-[13px] leading-[18px] text-hh-muted">{stat.name}</p>
              <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-hh-text">{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek op titel, fase..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterFase} onValueChange={setFilterFase}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Alle Fases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fases</SelectItem>
                <SelectItem value="0">Pre-contactfase</SelectItem>
                <SelectItem value="1">Openingsfase</SelectItem>
                <SelectItem value="2">Ontdekkingsfase</SelectItem>
                <SelectItem value="3">Aanbevelingsfase</SelectItem>
                <SelectItem value="4">Beslissingsfase</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="scheduled">Gepland</SelectItem>
                <SelectItem value="completed">Afgelopen</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                className={`rounded-r-none ${view === "list" ? "bg-purple-600 text-white hover:bg-purple-700" : ""}`}
                onClick={() => setView("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={view === "upcoming" ? "default" : "ghost"}
                size="sm"
                className={`rounded-l-none ${view === "upcoming" ? "bg-purple-600 text-white hover:bg-purple-700" : ""}`}
                onClick={() => setView("upcoming")}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {showAdminCalendar && (() => {
          const MONTH_NAMES = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
          const DAY_HEADERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
          const year = adminCalendarMonth.getFullYear();
          const month = adminCalendarMonth.getMonth();
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          const startDayOfWeek = (firstDay.getDay() + 6) % 7;
          const daysInMonth = lastDay.getDate();
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const sessionsByDay: Record<string, { time: string; status: string }[]> = {};
          sessions.forEach(s => {
            const d = new Date(s.scheduledDate || '');
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!sessionsByDay[key]) sessionsByDay[key] = [];
            sessionsByDay[key].push({
              time: d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
              status: s.status?.toLowerCase() || ''
            });
          });

          const cells: (number | null)[] = [];
          for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);

          const isSelected = (day: number) => {
            if (!adminSelectedDate) return false;
            return adminSelectedDate.getFullYear() === year && adminSelectedDate.getMonth() === month && adminSelectedDate.getDate() === day;
          };
          const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const getSessionsForDay = (day: number) => sessionsByDay[`${year}-${month}-${day}`] || [];
          const hasSession = (day: number) => getSessionsForDay(day).length > 0;

          return (
            <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => setAdminCalendarMonth(new Date(year, month - 1, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="text-[16px] font-semibold text-hh-text">{MONTH_NAMES[month]} {year}</h3>
                <Button variant="ghost" size="sm" onClick={() => setAdminCalendarMonth(new Date(year, month + 1, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid gap-1 grid-cols-7">
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
                        if (adminSelectedDate && selected) {
                          setAdminSelectedDate(null);
                        } else {
                          setAdminSelectedDate(clickedDate);
                        }
                      }}
                      className={`
                        relative flex flex-col items-center justify-center rounded-lg text-[13px] transition-colors min-h-[44px]
                        ${!day ? 'invisible' : 'cursor-pointer'}
                        ${selected ? 'bg-purple-600 text-white rounded-lg py-1 px-0.5' : ''}
                        ${sessionDay && !selected ? 'bg-purple-500/10 py-1 px-0.5 hover:opacity-80' : ''}
                        ${!sessionDay && !selected ? 'py-1.5 px-0.5 hover:bg-hh-ui-50' : ''}
                        ${todayDay && !selected && !sessionDay ? 'bg-hh-ui-50 font-bold ring-1 ring-purple-300' : ''}
                        ${!selected && !sessionDay && !todayDay ? 'text-hh-text' : ''}
                      `}
                    >
                      <span className={`${sessionDay && !selected ? 'font-semibold text-purple-700' : ''} ${sessionDay && !selected && todayDay ? 'underline underline-offset-2' : ''}`}>
                        {day}
                      </span>
                      {sessionDay && (
                        <span className={`text-[9px] leading-none mt-0.5 font-medium ${selected ? 'text-white/80' : 'text-purple-600'}`}>
                          {daySessions[0].time}
                        </span>
                      )}
                      {sessionDay && !selected && (
                        <span
                          className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-600 ring-2 ring-purple-500/25"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {adminSelectedDate && (
                <div className="mt-3 pt-3 border-t border-hh-border flex items-center justify-between">
                  <span className="text-[13px] text-hh-muted">
                    Gefilterd op: <span className="font-medium text-hh-text">{adminSelectedDate.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </span>
                  <Button variant="ghost" size="sm" className="text-hh-muted text-[12px] h-7" onClick={() => setAdminSelectedDate(null)}>
                    <X className="w-3 h-3 mr-1" /> Wis filter
                  </Button>
                </div>
              )}
            </Card>
          );
        })()}

        {view === "upcoming" && (
          <div className="space-y-4">
            <h2 className="text-[20px] leading-[28px] text-hh-text">
              Aankomende Sessies ({upcomingSessions.length})
            </h2>
            
            {upcomingSessions.length === 0 ? (
              <Card className="p-8 text-center rounded-[16px] shadow-hh-sm border-hh-border">
                <Video className="w-12 h-12 text-hh-muted mx-auto mb-4" />
                <h3 className="text-[18px] text-hh-text mb-2">Geen sessies gepland</h3>
                <p className="text-hh-muted mb-4">Plan je eerste live coaching sessie</p>
                <Button onClick={openCreateModal} className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Plan Sessie
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {upcomingSessions.map((session) => (
                  <Card
                    key={session.id}
                    className="p-5 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      {getStatusBadge(session.status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {session.status?.toLowerCase() === "upcoming" && (
                            <DropdownMenuItem onClick={() => handleStartSession(session)}>
                              <Play className="w-4 h-4 mr-2" />
                              Start Sessie
                            </DropdownMenuItem>
                          )}
                          {session.status?.toLowerCase() === "live" && (
                            <>
                              <DropdownMenuItem onClick={() => handleJoinLiveSession(session)}>
                                <Video className="w-4 h-4 mr-2" />
                                Open Room
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEndSession(session)}>
                                <Radio className="w-4 h-4 mr-2" />
                                Beëindig Sessie
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => openEditModal(session)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyJoinLink(session)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Kopieer Link
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDelete(session)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Verwijder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <h3 className="text-[18px] leading-[24px] text-hh-text font-medium mb-2">
                      {session.title}
                    </h3>

                    {session.topic && (
                      <Badge variant="outline" className="text-[11px] mb-3">
                        {session.topic}
                      </Badge>
                    )}

                    <div className="space-y-2 text-[14px] leading-[20px]">
                      <div className="flex items-center gap-2 text-hh-text">
                        <CalendarIcon className="w-4 h-4 text-hh-muted" />
                        <span>{new Date(session.scheduledDate).toLocaleDateString("nl-NL", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-hh-text">
                        <Clock className="w-4 h-4 text-hh-muted" />
                        <span>
                          {new Date(session.scheduledDate).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} 
                          {" - "}{session.durationMinutes} min
                        </span>
                      </div>
                      {session.viewerCount !== undefined && session.viewerCount > 0 && (
                        <div className="flex items-center gap-2 text-hh-text">
                          <Users className="w-4 h-4 text-hh-muted" />
                          <span>{session.viewerCount} kijkers</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-hh-border">
                      <div className="flex gap-2">
                        {session.status?.toLowerCase() === "upcoming" && (
                          <Button 
                            size="sm" 
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => handleStartSession(session)}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start Sessie
                          </Button>
                        )}
                        {session.status?.toLowerCase() === "live" && (
                          <Button 
                            size="sm" 
                            onClick={() => handleJoinLiveSession(session)}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <Radio className="w-4 h-4 mr-2 animate-pulse" />
                            Join Live Sessie
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => openEditModal(session)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {pastSessions.length > 0 && (
              <div className="mt-8">
                <h2 className="text-[20px] leading-[28px] text-hh-text mb-4">
                  Afgelopen Sessies ({pastSessions.length})
                </h2>
                <div className="space-y-3">
                  {pastSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="p-4 rounded-[12px] shadow-hh-sm border-hh-border hover:bg-hh-ui-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-[16px] leading-[22px] text-hh-text font-medium">
                              {session.title}
                            </h4>
                            {getStatusBadge(session.status)}
                          </div>
                          <div className="flex items-center gap-4 text-[13px] leading-[18px] text-hh-muted">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              {new Date(session.scheduledDate).toLocaleDateString("nl-NL")}
                            </span>
                            {session.viewerCount !== undefined && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {session.viewerCount} kijkers
                              </span>
                            )}
                          </div>
                        </div>
                        {session.recordingUrl && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(session.recordingUrl ?? undefined, "_blank")}
                          >
                            Bekijk Opname
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === "list" && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th className="text-left py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      #
                    </th>
                    <th className="text-left py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Sessie ↕
                    </th>
                    <th className="text-left py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Datum & Tijd ↕
                    </th>
                    <th className="text-left py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Fase
                    </th>
                    <th className="text-left py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Deelnemers ↕
                    </th>
                    <th className="text-left py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Status ↕
                    </th>
                    <th className="text-left py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Opname status
                    </th>
                    <th className="text-right py-4 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions
                    .filter(session => {
                      if (searchQuery && !session.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                      if (filterStatus !== "all") {
                        const status = session.status?.toLowerCase();
                        if (filterStatus === "scheduled" && status !== "upcoming" && status !== "scheduled") return false;
                        if (filterStatus === "completed" && status !== "ended" && status !== "completed") return false;
                        if (filterStatus === "live" && status !== "live") return false;
                      }
                      if (filterFase !== "all") {
                        const techniqueNum = session.topic?.match(/^\d+\.\d+/) ? session.topic.match(/^\d+\.\d+/)?.[0] : null;
                        const sessionPhase = techniqueNum ? parseInt(techniqueNum.split('.')[0]) : null;
                        if (sessionPhase === null || sessionPhase.toString() !== filterFase) return false;
                      }
                      return true;
                    })
                    .map((session, idx) => {
                      const techniqueNumber = session.topic?.match(/^\d+\.\d+/) ? session.topic.match(/^\d+\.\d+/)?.[0] : `${(idx % 4) + 1}.${idx + 1}`;
                      const phaseNumber = parseInt(techniqueNumber?.split('.')[0] || '1');
                      const phaseColorStyles: Record<number, { bg: string; text: string }> = {
                        0: { bg: '#94a3b8', text: '#ffffff' },
                        1: { bg: '#5b8fb9', text: '#ffffff' },
                        2: { bg: '#1e6b9a', text: '#ffffff' },
                        3: { bg: '#1e3a5f', text: '#ffffff' },
                        4: { bg: '#3C9A6E', text: '#ffffff' },
                      };
                      const phaseNames: Record<number, string> = {
                        0: 'Pre-contactfase',
                        1: 'Openingsfase',
                        2: 'Ontdekkingsfase',
                        3: 'Aanbevelingsfase',
                        4: 'Beslissingsfase',
                      };
                      const colorStyles = phaseColorStyles[phaseNumber] || phaseColorStyles[1];
                      const phaseName = phaseNames[phaseNumber] || 'Onbekend';
                      const isCompleted = session.status?.toLowerCase() === 'ended' || session.status?.toLowerCase() === 'completed';
                      
                      const handleRowClick = () => {
                        const status = session.status?.toLowerCase();
                        if (status === "upcoming" || status === "scheduled") {
                          handleStartSession(session);
                        } else if (status === "live") {
                          handleJoinLiveSession(session);
                        } else if ((status === "ended" || status === "completed") && session.recordingUrl) {
                          window.open(session.recordingUrl, "_blank");
                        }
                      };
                      
                      return (
                        <tr
                          key={session.id}
                          className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                          onClick={handleRowClick}
                        >
                          <td className="py-3 px-4">
                            <span 
                              className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[11px] font-mono font-medium bg-purple-500/10 text-purple-600 border border-purple-500/20"
                            >
                              {techniqueNumber}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[14px] leading-[20px] text-hh-ink font-medium">
                              {session.title}
                            </p>
                            <div className="flex items-center gap-1 text-[12px] leading-[16px] text-hh-muted">
                              <Monitor className="w-3 h-3" />
                              <span>Zoom • {session.durationMinutes} min</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[14px] leading-[20px] text-hh-text">
                              {new Date(session.scheduledDate).toLocaleDateString("nl-NL", { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-[12px] leading-[16px] text-hh-muted">
                              {new Date(session.scheduledDate).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[14px] leading-[20px] text-purple-600">
                              {phaseName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[14px] leading-[20px] text-hh-text">
                            <div className="flex flex-col">
                              <div>
                                <span className="font-medium">{(session as any).registrationCount || Math.floor(Math.random() * 15) + 5}</span>
                                <span className="text-hh-muted"> / 50</span>
                              </div>
                              {!isCompleted && (
                                <span className="text-[11px] text-purple-500">ingeschreven</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span 
                              className={`text-[14px] leading-[20px] ${isCompleted ? 'text-purple-500' : 'text-purple-600'}`}
                            >
                              {isCompleted ? 'Afgelopen' : 'Gepland'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {getRecordingStatus(session)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {session.status?.toLowerCase() === "upcoming" && (
                                  <DropdownMenuItem onClick={() => handleStartSession(session)}>
                                    <Play className="w-4 h-4 mr-2" />
                                    Start Sessie
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => openEditModal(session)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {session.status?.toLowerCase() === "upcoming" && (
                                  <DropdownMenuItem onClick={() => window.open(generateGoogleCalendarLink(session), "_blank")}>
                                    <CalendarIcon className="w-4 h-4 mr-2" />
                                    Toevoegen aan Kalender
                                  </DropdownMenuItem>
                                )}
                                {session.status?.toLowerCase() === "ended" && session.recordingUrl && (
                                  <DropdownMenuItem onClick={() => window.open(session.recordingUrl ?? undefined, "_blank")}>
                                    <Play className="w-4 h-4 mr-2" />
                                    Bekijk Opname
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => handleDelete(session)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Verwijder
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
          </Card>
        )}

        
      </div>

      <Dialog open={showPlanModal} onOpenChange={(open: boolean) => {
        setShowPlanModal(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSession ? "Sessie Bewerken" : "Plan Live Coaching Sessie"}
            </DialogTitle>
            <DialogDescription>
              {editingSession ? "Wijzig de sessie details" : "Maak een nieuwe live training sessie aan"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="session-title" className="text-[14px] mb-2 block">
                Titel *
              </Label>
              <Input
                id="session-title"
                placeholder="Bijv: Discovery Technieken Q&A"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="session-description" className="text-[14px] mb-2 block">
                Beschrijving
              </Label>
              <Textarea
                id="session-description"
                placeholder="Wat wordt er behandeld in deze sessie..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="session-topic" className="text-[14px] mb-2 block">
                  Topic/Fase
                </Label>
                <Select
                  value={formData.topic}
                  onValueChange={(value: string) => setFormData({ ...formData, topic: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Openingsfase">Openingsfase</SelectItem>
                    <SelectItem value="Ontdekkingsfase">Ontdekkingsfase</SelectItem>
                    <SelectItem value="Aanbevelingsfase">Aanbevelingsfase</SelectItem>
                    <SelectItem value="Beslissingsfase">Beslissingsfase</SelectItem>
                    <SelectItem value="Q&A">Q&A Sessie</SelectItem>
                    <SelectItem value="Workshop">Workshop</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="session-duration" className="text-[14px] mb-2 block">
                  Duur
                </Label>
                <Select
                  value={String(formData.durationMinutes)}
                  onValueChange={(value: string) => setFormData({ ...formData, durationMinutes: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minuten</SelectItem>
                    <SelectItem value="60">60 minuten</SelectItem>
                    <SelectItem value="90">90 minuten</SelectItem>
                    <SelectItem value="120">120 minuten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="session-date" className="text-[14px] mb-2 block">
                  Datum *
                </Label>
                <Input 
                  id="session-date" 
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="session-time" className="text-[14px] mb-2 block">
                  Starttijd *
                </Label>
                <Input 
                  id="session-time" 
                  type="time" 
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanModal(false)}>
              Annuleren
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSession ? "Opslaan" : "Sessie Plannen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
