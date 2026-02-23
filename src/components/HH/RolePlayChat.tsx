import {
  Play,
  Square,
  RotateCcw,
  Send,
  TrendingUp,
  Share2,
  Lightbulb,
  X,
  Menu,
  MessageSquare,
  Phone,
  Video,
  Pause,
  Volume2,
  Maximize,
  Mic,
  MicOff,
  Loader2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Sheet, SheetContent } from "../ui/sheet";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { EPICSalesFlow } from "./EPICSalesFlow";
import { Card } from "../ui/card";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

type SessionState = "idle" | "active" | "completed";

interface Message {
  id: string;
  sender: "hugo" | "user";
  text: string;
  timestamp: Date;
}

interface Step {
  id: string;
  name: string;
  status: "completed" | "current" | "upcoming" | "locked";
  duration: string;
  nummer: string;
  isVerplicht?: boolean;
}

interface Phase {
  id: number;
  name: string;
  color: string;
  themas: string[];
  uitleg: string;
  steps: Step[];
}

interface RolePlayChatProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

// Scenario flow data gebaseerd op Hugo's 4-fasen methodologie
const scenarioFlowData: Phase[] = [
  {
    id: 1,
    name: "Openingsfase",
    color: "#6B7A92",
    themas: [],
    uitleg: "Volg deze volgorde, tenzij klant spontaan een stap aanbrengt (dan overslaan en terug oppakken waar je zat).",
    steps: [
      { id: "1.1", name: "Koopklimaat creëren", status: "completed", duration: "2 min", nummer: "1.1", isVerplicht: true },
      { id: "1.2", name: "Gentleman's agreement", status: "completed", duration: "1 min", nummer: "1.2", isVerplicht: true },
      { id: "1.3", name: "Firmavoorstelling + reference story", status: "completed", duration: "2 min", nummer: "1.3", isVerplicht: true },
      { id: "1.4", name: "Instapvraag", status: "completed", duration: "1 min", nummer: "1.4", isVerplicht: true },
    ],
  },
  {
    id: 2,
    name: "Ontdekkingsfase",
    color: "#6B7A92",
    themas: ["Bron", "Motivatie", "Ervaring", "Verwachtingen", "Alternatieven", "Budget", "Timing", "Beslissingscriteria"],
    uitleg: "Hier breng je systematisch alle klantnoden, wensen en bezwaren in kaart, zodat je straks een relevante oplossing kan voorstellen.",
    steps: [
      { id: "2.1.1", name: "Feitgerichte vragen", status: "completed", duration: "3 min", nummer: "2.1.1" },
      { id: "2.1.2", name: "Meningsgerichte vragen (open vragen)", status: "completed", duration: "3 min", nummer: "2.1.2" },
      { id: "2.1.3", name: "Feitgerichte vragen onder alternatieve vorm", status: "current", duration: "2 min", nummer: "2.1.3" },
      { id: "2.1.4", name: "Ter zijde schuiven", status: "upcoming", duration: "2 min", nummer: "2.1.4" },
      { id: "2.1.5", name: "Pingpong techniek", status: "upcoming", duration: "2 min", nummer: "2.1.5" },
      { id: "2.1.6", name: "Actief en empathisch luisteren", status: "upcoming", duration: "3 min", nummer: "2.1.6" },
      { id: "2.1.7", name: "LEAD questioning (storytelling)", status: "upcoming", duration: "4 min", nummer: "2.1.7" },
      { id: "2.1.8", name: "Lock questioning", status: "upcoming", duration: "2 min", nummer: "2.1.8" },
    ],
  },
  {
    id: 3,
    name: "Aanbevelingsfase",
    color: "#6B7A92",
    themas: ["USP's"],
    uitleg: "Nu verbind je wat je geleerd hebt over de klant aan jouw oplossing en USP's. Je toont hoe jouw aanbod past bij hun situatie en vraagt expliciet naar hun mening.",
    steps: [
      { id: "3.1", name: "Empathie tonen", status: "upcoming", duration: "2 min", nummer: "3.1" },
      { id: "3.2", name: "Oplossing", status: "upcoming", duration: "3 min", nummer: "3.2" },
      { id: "3.3", name: "Voordeel", status: "upcoming", duration: "2 min", nummer: "3.3" },
      { id: "3.4", name: "Baat", status: "upcoming", duration: "2 min", nummer: "3.4" },
      { id: "3.5", name: "Mening vragen / standpunt onder alternatieve vorm", status: "upcoming", duration: "2 min", nummer: "3.5" },
    ],
  },
  {
    id: 4,
    name: "Beslissingsfase",
    color: "#6B7A92",
    themas: ["beslissing"],
    uitleg: "In deze laatste fase stuur je richting een definitieve beslissing door in te spelen op alle resterende vragen, twijfels, bezwaren en eventuele angst. Hier maak je het verschil met je afsluittechniek.",
    steps: [
      { id: "4.1", name: "Proefafsluiting", status: "locked", duration: "2 min", nummer: "4.1" },
      { id: "4.2.1", name: "Klant stelt vragen", status: "locked", duration: "3 min", nummer: "4.2.1" },
      { id: "4.2.2", name: "Twijfels", status: "locked", duration: "3 min", nummer: "4.2.2" },
      { id: "4.2.3", name: "Poging tot uitstel", status: "locked", duration: "2 min", nummer: "4.2.3" },
      { id: "4.2.4", name: "Bezwaren", status: "locked", duration: "4 min", nummer: "4.2.4" },
      { id: "4.2.5", name: "Angst / Bezorgdheden", status: "locked", duration: "3 min", nummer: "4.2.5" },
    ],
  },
];

export function RolePlayChat({ navigate, isAdmin }: RolePlayChatProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [sessionMode, setSessionMode] = useState<"chat" | "audio" | "video" | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentPhaseId = 2;
  const currentStepId = "2.1.3";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startChatSession = () => {
    setSessionMode("chat");
    setState("active");
    // Hugo's opening message
    setTimeout(() => {
      addHugoMessage("Goedemiddag! Bedankt voor je interesse in onze SaaS oplossing. Voor we beginnen, mag ik vragen hoe je bij ons terecht bent gekomen?");
    }, 1000);
  };

  const startAudioSession = () => {
    setSessionMode("audio");
    setState("active");
  };

  const startVideoSession = () => {
    setSessionMode("video");
    setState("active");
    setIsVideoPlaying(true);
  };

  const stopSession = () => {
    setState("completed");
    setShowResults(true);
  };

  const retrySession = () => {
    setState("idle");
    setSessionMode(null);
    setShowResults(false);
    setMessages([]);
    setInputValue("");
    setIsRecording(false);
    setIsVideoPlaying(false);
  };

  const addHugoMessage = (text: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "hugo",
          text,
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Simulate Hugo's response based on context
    setTimeout(() => {
      const responses = [
        "Interessant. Kun je me wat meer vertellen over jullie huidige situatie?",
        "Ik begrijp het. Wat zijn op dit moment jullie grootste uitdagingen?",
        "Dat klinkt bekend. Mag ik vragen hoe jullie dat nu aanpakken?",
        "Goed om te horen. Als je één ding zou kunnen verbeteren, wat zou dat dan zijn?",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      addHugoMessage(randomResponse);
    }, 2000);
  };

  return (
    <AppLayout currentPage="roleplaychat" navigate={navigate} isAdmin={isAdmin}>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Page Header */}
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4 border-b border-hh-border bg-hh-bg flex-shrink-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h1 className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] mb-2">
                Role-play Chat
              </h1>
              <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                Train in je eigen tempo — kies je voorkeur: chat, audio of video
              </p>
            </div>
            
            {/* 3 Mode Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="lg"
                onClick={startChatSession}
                disabled={state === "active"}
                className="gap-2"
                title="Start chat sessie"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={state === "active"}
                className="gap-2"
                title="Start audio sessie (binnenkort)"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Audio</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={state === "active"}
                className="gap-2"
                title="Start video sessie (binnenkort)"
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Video</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile Sidebar Sheet */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="right" className="p-0 w-80">
              <EPICSalesFlow
                phases={scenarioFlowData}
                currentPhaseId={currentPhaseId}
                currentStepId={currentStepId}
              />
            </SheetContent>
          </Sheet>

          {/* Main Content Area - Chat Interface */}
          <div className="flex-1 flex flex-col overflow-hidden bg-hh-ui-50">
            {state === "idle" ? (
              /* Idle State */
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 rounded-full bg-hh-primary/10 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-10 h-10 text-hh-primary" />
                  </div>
                  <h2 className="text-[24px] leading-[32px] text-hh-text mb-2">
                    Klaar om te oefenen?
                  </h2>
                  <p className="text-hh-muted mb-6">
                    Start een rollenspel en oefen de verschillende technieken met Hugo. Kies of je wil chatten, praten of video-callen met Hugo.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button onClick={startChatSession} size="lg" className="gap-2 w-full">
                      <MessageSquare className="w-4 h-4" /> Chat met Hugo
                    </Button>
                    <Button onClick={startAudioSession} size="lg" variant="outline" className="gap-2 w-full">
                      <Phone className="w-4 h-4" /> Bellen met Hugo
                    </Button>
                    <Button onClick={startVideoSession} size="lg" variant="outline" className="gap-2 w-full">
                      <Video className="w-4 h-4" /> Video-call met Hugo
                      <Badge className="bg-hh-warn text-white border-0 text-[10px] px-2 py-0.5 ml-1">
                        Beta
                      </Badge>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Active/Completed State */
              <>
                {/* CHAT MODE - Text-based chat interface */}
                {sessionMode === "chat" && (
                  <>
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.sender === "user" ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback className={message.sender === "hugo" ? "bg-hh-primary text-white" : "bg-hh-ui-200"}>
                              {message.sender === "hugo" ? "HH" : "JD"}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`max-w-[70%] rounded-[16px] p-4 ${
                              message.sender === "hugo"
                                ? "bg-white shadow-hh-sm"
                                : "bg-hh-primary text-white"
                            }`}
                          >
                            <p className="text-[16px] leading-[24px]">{message.text}</p>
                            <p className={`text-[12px] leading-[16px] mt-2 ${
                              message.sender === "hugo" ? "text-hh-muted" : "text-white/70"
                            }`}>
                              {message.timestamp.toLocaleTimeString("nl-NL", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Typing Indicator */}
                      {isTyping && (
                        <div className="flex gap-3">
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback className="bg-hh-primary text-white">HH</AvatarFallback>
                          </Avatar>
                          <div className="bg-white shadow-hh-sm rounded-[16px] p-4">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-hh-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-2 h-2 bg-hh-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-2 h-2 bg-hh-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    {state === "active" && (
                      <div className="border-t border-hh-border bg-white p-4">
                        <div className="flex gap-3 max-w-4xl mx-auto">
                          <Input
                            placeholder="Type je antwoord..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            className="flex-1"
                            disabled={isTyping}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isTyping}
                            size="icon"
                            className="flex-shrink-0"
                          >
                            <Send className="w-4 h-4" />
                            <span className="sr-only">Verstuur</span>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={stopSession}
                            size="icon"
                            className="flex-shrink-0"
                          >
                            <Square className="w-4 h-4" />
                            <span className="sr-only">Stop</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                          >
                            <Menu className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Completed controls */}
                    {state === "completed" && (
                      <div className="border-t border-hh-border bg-white p-4">
                        <div className="flex gap-3 justify-center">
                          <Button onClick={retrySession} variant="outline" className="gap-2">
                            <RotateCcw className="w-4 h-4" /> Opnieuw
                          </Button>
                          <Button onClick={() => setShowResults(true)} className="gap-2">
                            <TrendingUp className="w-4 h-4" /> Bekijk resultaten
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tips Panel - Active State */}
                    {state === "active" && (
                      <div className="border-t border-hh-border bg-hh-ui-50 p-4">
                        <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
                          <div className="flex items-start gap-3">
                            <Lightbulb className="w-5 h-5 text-hh-warn flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="text-[16px] leading-[24px] text-hh-text mb-1">
                                Tip: Feitgerichte vragen onder alternatieve vorm
                              </h3>
                              <p className="text-[14px] leading-[20px] text-hh-muted">
                                Stel vragen die de klant helpen nadenken zonder druk. Gebruik alternatieven om meer informatie los te krijgen.
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    )}
                  </>
                )}

                {/* AUDIO MODE - Voice call with animated orb */}
                {sessionMode === "audio" && (
                  <>
                    {/* Audio Interface - Centered Orb */}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-hh-ui-50 to-hh-primary/5">
                      <div className="text-center max-w-md space-y-6">
                        {/* Animated Orb */}
                        <div className="relative w-48 h-48 mx-auto">
                          {/* Outer glow rings */}
                          <div className="absolute inset-0 rounded-full bg-hh-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
                          <div className="absolute inset-4 rounded-full bg-hh-primary/20 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }} />
                          
                          {/* Main orb */}
                          <div className="absolute inset-8 rounded-full bg-gradient-to-br from-hh-primary to-hh-accent shadow-hh-lg flex items-center justify-center">
                            {isRecording ? (
                              <div className="flex gap-1">
                                <div className="w-2 h-8 bg-white rounded-full animate-pulse" style={{ animationDuration: "0.6s" }} />
                                <div className="w-2 h-12 bg-white rounded-full animate-pulse" style={{ animationDuration: "0.7s", animationDelay: "0.1s" }} />
                                <div className="w-2 h-10 bg-white rounded-full animate-pulse" style={{ animationDuration: "0.8s", animationDelay: "0.2s" }} />
                                <div className="w-2 h-6 bg-white rounded-full animate-pulse" style={{ animationDuration: "0.6s", animationDelay: "0.3s" }} />
                              </div>
                            ) : (
                              <Mic className="w-16 h-16 text-white" />
                            )}
                          </div>
                        </div>

                        {/* Status Text */}
                        <div className="space-y-2">
                          <h2 className="text-[24px] leading-[32px] text-hh-text">
                            {isRecording ? "Hugo luistert..." : "Bel met Hugo"}
                          </h2>
                          <p className="text-[16px] leading-[24px] text-hh-muted">
                            {isRecording 
                              ? "Spreek je antwoord uit, Hugo geeft real-time feedback"
                              : "Tap op de microfoon om te beginnen praten"
                            }
                          </p>
                        </div>

                        {/* Controls */}
                        <div className="flex gap-3 justify-center">
                          <Button
                            size="lg"
                            variant={isRecording ? "destructive" : "default"}
                            onClick={() => setIsRecording(!isRecording)}
                            className="gap-2"
                          >
                            {isRecording ? (
                              <>
                                <MicOff className="w-4 h-4" /> Stop gesprek
                              </>
                            ) : (
                              <>
                                <Mic className="w-4 h-4" /> Start gesprek
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={stopSession}
                            className="gap-2"
                          >
                            <Square className="w-4 h-4" /> Beëindig sessie
                          </Button>
                        </div>

                        {/* Current technique tip */}
                        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border text-left">
                          <div className="flex items-start gap-3">
                            <Lightbulb className="w-5 h-5 text-hh-warn flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="text-[14px] leading-[20px] text-hh-text mb-1">
                                Focus: Feitgerichte vragen onder alternatieve vorm
                              </h3>
                              <p className="text-[12px] leading-[18px] text-hh-muted">
                                Gebruik alternatieve formuleringen om de klant te laten nadenken
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </>
                )}

                {/* VIDEO MODE - HeyGen video call interface */}
                {sessionMode === "video" && (
                  <>
                    {/* Video Interface */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                        <Card className="rounded-[16px] shadow-hh-md border-hh-ink/20 overflow-hidden bg-hh-ink max-w-5xl mx-auto">
                          <div
                            className="w-full relative overflow-hidden"
                            style={{ aspectRatio: "16/9" }}
                          >
                            {/* Temporary placeholder - Backend implementatie nodig */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-hh-ink to-hh-ui-700 text-white">
                              <div className="text-center space-y-4 p-8">
                                <div className="w-20 h-20 rounded-full bg-hh-primary/20 flex items-center justify-center mx-auto mb-4">
                                  <Video className="w-10 h-10 text-hh-primary" />
                                </div>
                                <h3 className="text-[24px] leading-[32px]">
                                  HeyGen LiveAvatar integratie vereist
                                </h3>
                                <p className="text-[16px] leading-[24px] text-white/70 max-w-md">
                                  Deze functie vereist backend setup met HeyGen Interactive Avatar SDK.
                                </p>
                                <div className="bg-hh-ui-800/50 rounded-lg p-4 text-left text-[14px] leading-[20px] text-white/60 font-mono max-w-md">
                                  <p className="mb-2">📋 Vereiste stappen:</p>
                                  <p>• API Key: fa6ef0c3-d6a6-11f0-a99e-066a7fa2e369</p>
                                  <p>• SDK: HeyGen Interactive Avatar</p>
                                  <p>• Microphone: WebRTC audio streaming</p>
                                  <p>• Backend: Session management</p>
                                </div>
                                <p className="text-[14px] leading-[20px] text-white/50 italic">
                                  Zie /roleplay-training-handoff/README.md voor implementatie details
                                </p>
                              </div>
                            </div>

                            {/* Video Title Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-hh-ink/90 to-transparent pointer-events-none">
                              <p className="text-white text-[16px] leading-[24px]">
                                Video-call met Hugo • Live feedback
                              </p>
                              <p className="text-white/70 text-[14px] leading-[20px] mt-1">
                                Ontdekkingsfase • Feitgerichte vragen
                              </p>
                            </div>
                          </div>
                        </Card>

                        {/* Controls below video */}
                        <div className="flex gap-3 justify-center mt-6">
                          <Button
                            variant="outline"
                            onClick={stopSession}
                            className="gap-2"
                          >
                            <Square className="w-4 h-4" /> Beëindig sessie
                          </Button>
                        </div>

                        {/* Key Takeaways */}
                        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border mt-6 max-w-5xl mx-auto">
                          <div className="flex items-start gap-3 mb-4">
                            <Lightbulb className="w-5 h-5 text-hh-warn flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="text-[18px] leading-[26px] text-hh-text mb-2">
                                Real-time feedback
                              </h3>
                              <div className="space-y-2">
                                <p className="text-[14px] leading-[20px] text-hh-muted">
                                  • Hugo reageert live op je vragen en technieken
                                </p>
                                <p className="text-[14px] leading-[20px] text-hh-muted">
                                  • Let op non-verbale signalen in de video
                                </p>
                                <p className="text-[14px] leading-[20px] text-hh-muted">
                                  • Oefen je timing en intonatie
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right Sidebar - Desktop Only - E.P.I.C Sales Flow */}
          <div className="hidden lg:block w-80 flex-shrink-0 overflow-hidden">
            <EPICSalesFlow
              phases={scenarioFlowData}
              currentPhaseId={currentPhaseId}
              currentStepId={currentStepId}
            />
          </div>
        </div>

        {/* Results modal */}
        <Dialog open={showResults} onOpenChange={setShowResults}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sessie resultaten</DialogTitle>
              <DialogDescription>
                Hier is je feedback van deze chat-based role-play sessie
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Overall score */}
              <div className="text-center p-6 bg-hh-ui-50 rounded-[16px]">
                <p className="text-[16px] leading-[24px] text-hh-muted mb-2">
                  Totaalscore
                </p>
                <p className="text-[48px] leading-[56px] text-hh-text">
                  84
                  <span className="text-[24px] leading-[32px]">%</span>
                </p>
                <Badge className="mt-2 bg-hh-success/10 text-hh-success border-hh-success/20">
                  +7% vs vorige sessie
                </Badge>
              </div>

              {/* Sub-scores */}
              <div className="space-y-3">
                <h3 className="text-[18px] leading-[26px] text-hh-text">
                  Scores per onderdeel
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Vraagstelling", score: 88 },
                    { label: "Empathie", score: 82 },
                    { label: "Structuur", score: 85 },
                    { label: "Next steps", score: 79 },
                  ].map((item) => (
                    <Card
                      key={item.label}
                      className="p-4 rounded-[12px] shadow-hh-sm border-hh-border"
                    >
                      <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                        {item.label}
                      </p>
                      <p className="text-[28px] leading-[36px] text-hh-text">
                        {item.score}
                        <span className="text-[16px] leading-[24px]">%</span>
                      </p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Highlights */}
              <div className="space-y-3">
                <h3 className="text-[18px] leading-[26px] text-hh-text">
                  Highlights
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 bg-hh-success/10 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-hh-success flex-shrink-0 mt-1" />
                    <p className="text-[14px] leading-[20px] text-hh-text">
                      <strong>Goed:</strong> Je stelde de juiste open vragen om de situatie te begrijpen.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-hh-warn/10 rounded-lg">
                    <Lightbulb className="w-4 h-4 text-hh-warn flex-shrink-0 mt-1" />
                    <p className="text-[14px] leading-[20px] text-hh-text">
                      <strong>Let op:</strong> Je zou meer kunnen doorvragen op budget en timing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-3">
                <h3 className="text-[18px] leading-[26px] text-hh-text">
                  Hugo's advies
                </h3>
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  "Goed begin! Probeer je vragen nog meer te structureren volgens de BANT methodiek. Oefen ook met stemmodulatie zodra we audio toevoegen."
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" /> Deel met manager
              </Button>
              <Button onClick={() => { setShowResults(false); retrySession(); }}>
                Opnieuw oefenen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}