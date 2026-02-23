import { useState, useEffect } from "react";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Sheet, SheetContent } from "../ui/sheet";
import { EPICSalesFlow } from "./EPICSalesFlow";
import { HeyGenEmbedded } from "./HeyGenEmbedded";
import {
  Play,
  Square,
  RotateCcw,
  Mic,
  TrendingUp,
  Share2,
  Lightbulb,
  X,
  Menu,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Card } from "../ui/card";

type SessionState = "idle" | "recording" | "completed";

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

interface RolePlayProps {
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

export function RolePlay({ navigate, isAdmin }: RolePlayProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [showResults, setShowResults] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);

  const currentPhaseId = 2;
  const currentStepId = "2.1.3";

  // Session timer - counts up when recording
  useEffect(() => {
    if (state === "recording") {
      const interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startSession = () => {
    setState("recording");
    setMicActive(true);
    setSessionTimer(0);
  };

  const stopSession = () => {
    setState("completed");
    setMicActive(false);
    setShowResults(true);
  };

  const retrySession = () => {
    setState("idle");
    setShowResults(false);
    setSessionTimer(0);
  };

  return (
    <AppLayout currentPage="roleplays" navigate={navigate} isAdmin={isAdmin}>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Page Header */}
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4 border-b border-hh-border bg-hh-bg flex-shrink-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h1 className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] mb-2">
                Role-play Video
              </h1>
              <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                Oefen live met Hugo's AI avatar — krijg direct feedback op je salestechnieken
              </p>
            </div>
            <Button
              size="lg"
              onClick={startSession}
              disabled={state === "recording"}
              className="flex-shrink-0 gap-2"
            >
              <Play className="w-4 h-4" />
              {state === "recording" ? "Bezig..." : "Start sessie"}
            </Button>
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

          {/* Center Content - Video/Avatar Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Video/Avatar Area */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-hh-ink">
              <div className="w-full h-full max-w-6xl">
                <Card
                  className={`w-full h-full bg-gradient-to-br from-hh-ui-500 to-hh-ink rounded-[24px] shadow-hh-lg flex items-center justify-center relative overflow-hidden ${
                    state === "idle" ? "cursor-pointer transition-all hover:shadow-hh-xl" : ""
                  }`}
                  onClick={state === "idle" ? startSession : undefined}
                >
                  {state === "idle" && (
                    <div className="text-center pointer-events-none">
                      <Play className="w-16 h-16 text-white/60 mx-auto mb-4" />
                      <p className="text-white/80 text-[18px] leading-[26px]">
                        Klik hier om te beginnen
                      </p>
                      <p className="text-white/60 text-[14px] leading-[20px] mt-2">
                        Discovery call - SaaS enterprise
                      </p>
                    </div>
                  )}
                  {state === "recording" && (
                    <>
                      {/* HeyGen Embedded Avatar - Full card */}
                      <HeyGenEmbedded isActive={true} />
                      
                      {/* Overlay with instructions - Can be hidden after avatar loads */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-hh-ink/90 to-transparent pointer-events-none">
                        <div className="text-center text-white/80">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-hh-success animate-pulse" />
                            <span className="text-[14px] leading-[20px] text-hh-success">
                              Sessie actief
                            </span>
                          </div>
                          <p className="text-[12px] leading-[16px] text-white/60">
                            Klik op de avatar om het gesprek te starten
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  {state === "completed" && (
                    <div className="text-center text-white">
                      <div className="w-16 h-16 rounded-full bg-hh-success flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="w-8 h-8" />
                      </div>
                      <p className="text-[20px] leading-[28px]">
                        Sessie voltooid!
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Status Bar - Compact info during recording */}
            {state === "recording" && (
              <div className="px-4 py-3 bg-hh-ui-50 border-t border-hh-border">
                <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
                  {/* Left: Timer + Fase */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Timer */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      <span className="text-[14px] sm:text-[16px] leading-[20px] sm:leading-[24px] text-hh-text font-[600] tabular-nums">
                        {formatTime(sessionTimer)}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-5 bg-hh-border" />

                    {/* Current Phase Badge */}
                    <Badge variant="outline" className="text-[11px] sm:text-[12px] px-2 py-0.5 bg-hh-primary/10 text-hh-primary border-hh-primary/20">
                      Fase 2: Ontdekkingsfase
                    </Badge>
                  </div>

                  {/* Right: Mic + Flow toggle */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Mic Status */}
                    <div className="flex items-center gap-1.5">
                      <Mic className={`w-4 h-4 ${micActive ? 'text-hh-success' : 'text-hh-muted'}`} />
                      <span className="hidden sm:inline text-[13px] leading-[18px] text-hh-muted">
                        {micActive ? 'Actief' : 'Inactief'}
                      </span>
                    </div>

                    {/* Flow toggle (mobile only) */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="lg:hidden h-8 px-2 gap-1.5"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <Menu className="w-4 h-4" />
                      <span className="text-[12px]">Flow</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Control buttons */}
            <div className="p-4 bg-hh-bg border-t border-hh-border">
              <div className="flex items-center justify-center gap-3">
                {state === "idle" && (
                  <Button onClick={startSession} className="gap-2" size="lg">
                    <Play className="w-4 h-4" /> Start sessie
                  </Button>
                )}
                {state === "recording" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={stopSession}
                      className="gap-2"
                      size="lg"
                    >
                      <Square className="w-4 h-4" /> Stop sessie
                    </Button>
                  </>
                )}
                {state === "completed" && (
                  <Button onClick={retrySession} variant="outline" className="gap-2" size="lg">
                    <RotateCcw className="w-4 h-4" /> Opnieuw
                  </Button>
                )}
              </div>
            </div>

            {/* Tips & Technique Info */}
            {state === "recording" && (
              <div className="p-4 bg-hh-ui-50 border-t border-hh-border">
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-hh-warn" />
                        <h3 className="text-[16px] leading-[24px] text-hh-text">
                          Huidige stap: Feitgerichte vragen onder alternatieve vorm
                        </h3>
                      </div>
                      <p className="text-[14px] leading-[20px] text-hh-muted">
                        Stel vragen die de klant helpen nadenken zonder zich onder druk te voelen. Gebruik alternatieven om meer informatie los te krijgen.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[12px]">
                      ✓ Empathisch luisteren
                    </Badge>
                    <Badge variant="outline" className="text-[12px]">
                      ✓ Open vragen stellen
                    </Badge>
                    <Badge variant="outline" className="text-[12px]">
                      • Doorvragen naar context
                    </Badge>
                  </div>
                </Card>
              </div>
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
      </div>

      {/* Results modal */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="relative">
            <button
              onClick={() => setShowResults(false)}
              className="absolute right-0 top-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              aria-label="Sluit resultaten"
            >
              <X className="h-4 w-4" />
            </button>
            <DialogTitle>Sessie resultaten</DialogTitle>
            <DialogDescription>
              Hier is je feedback van deze role-play sessie
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
                  { label: "Luisteren", score: 92 },
                  { label: "Samenvatten", score: 78 },
                  { label: "Objections", score: 85 },
                  { label: "Next step", score: 81 },
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
                    <strong>Goed:</strong> Je erkende het bezwaar eerst, zonder direct te verdedigen. Dat schept vertrouwen.
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 bg-hh-warn/10 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-hh-warn flex-shrink-0 mt-1" />
                  <p className="text-[14px] leading-[20px] text-hh-text">
                    <strong>Let op:</strong> Je noemde features, niet de waarde voor hen. Focus op hun outcome, niet je product.
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
                "Oefen nog 2x deze week met budget bezwaren. Focus op waarde, niet features. People buy people — maar ze kopen ook resultaten."
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="gap-2">
              <Share2 className="w-4 h-4" /> Deel met manager
            </Button>
            <Button onClick={() => setShowResults(false)}>
              Herhaal met focus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}