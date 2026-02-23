import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Sheet, SheetContent } from "../ui/sheet";
import {
  Search,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Play,
  Send,
  X,
  CheckCircle2,
  Clock,
  Lightbulb,
  Target,
} from "lucide-react";
import { useState, useEffect } from "react";
import technieken_index from "../../data/technieken_index.json";

interface Techniek {
  nummer: string;
  naam: string;
  fase: string;
  parent?: string;
  is_fase?: boolean;
  doel?: string;
  wat?: string;
  waarom?: string;
  wanneer?: string;
  hoe?: string;
  voorbeeld?: string[];
  stappenplan?: string[];
  tags?: string[];
  themas?: string[];
}

interface DigitalCoachingProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

export function DigitalCoaching({ navigate, isAdmin }: DigitalCoachingProps) {
  const [expandedFases, setExpandedFases] = useState<string[]>(["1"]); // Fase 1 open by default
  const [selectedTechnique, setSelectedTechnique] = useState<Techniek | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Training mode state
  const [activeTraining, setActiveTraining] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "coach"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");

  // Auto-activate "Talk to Hugo AI" from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const techniqueId = params.get("technique");
    
    if (techniqueId === "talk-to-hugo-ai") {
      const talkToHugoTechnique = {
        nummer: "∞",
        naam: "Talk to Hugo AI",
        fase: "∞",
        doel: "Direct sparren met je AI sales coach. Stel vragen, oefen technieken, of bespreek een klantgesprek.",
        wat: "Onbeperkte chat met Hugo AI voor coaching, vragen, en training.",
        waarom: "Om direct feedback te krijgen en je vaardigheden te verbeteren buiten de gestructureerde technieken.",
        wanneer: "Altijd beschikbaar - gebruik wanneer je directe hulp nodig hebt.",
        hoe: "Stel gewoon je vraag en Hugo helpt je verder.",
        voorbeeld: ["Stel directe vragen over sales technieken", "Bespreek een specifiek klantgesprek", "Vraag om voorbeelden en rollenspel tips"],
        stappenplan: ["Type je vraag", "Hugo geeft advies", "Vraag door voor meer detail"],
        tags: ["AI", "chat", "coaching", "onbeperkt"]
      };
      
      startTraining(talkToHugoTechnique);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Parse technieken from config
  const allTechnieken: Techniek[] = Object.entries(technieken_index.technieken).map(([key, data]: [string, any]) => ({
    nummer: data.nummer,
    naam: data.naam,
    fase: data.fase,
    parent: data.parent,
    is_fase: data.is_fase,
    doel: data.doel,
    wat: data.wat,
    waarom: data.waarom,
    wanneer: data.wanneer,
    hoe: data.hoe,
    voorbeeld: data.voorbeeld,
    stappenplan: data.stappenplan,
    tags: data.tags,
    themas: data.themas,
  }));

  // Add Talk to Hugo AI at the top
  const talkToHugoTechnique: Techniek = {
    nummer: "∞",
    naam: "Talk to Hugo AI",
    fase: "∞",
    doel: "Direct sparren met je AI sales coach. Stel vragen, oefen technieken, of bespreek een klantgesprek.",
    wat: "Onbeperkte chat met Hugo AI voor coaching, vragen, en training.",
    waarom: "Om direct feedback te krijgen en je vaardigheden te verbeteren buiten de gestructureerde technieken.",
    wanneer: "Altijd beschikbaar - gebruik wanneer je directe hulp nodig hebt.",
    hoe: "Stel gewoon je vraag en Hugo helpt je verder.",
    voorbeeld: ["Stel directe vragen over sales technieken", "Bespreek een specifiek klantgesprek", "Vraag om voorbeelden en rollenspel tips"],
    stappenplan: ["Type je vraag", "Hugo geeft advies", "Vraag door voor meer detail"],
    tags: ["AI", "chat", "coaching", "onbeperkt"]
  };

  const allTechniekenWithHugo = [talkToHugoTechnique, ...allTechnieken];

  // Get phases (is_fase = true)
  const phases = allTechniekenWithHugo.filter(t => t.is_fase || t.nummer === "∞");

  // Get children of a fase
  const getChildren = (parent: string) => {
    return allTechniekenWithHugo.filter(t => t.parent === parent);
  };

  // Toggle fase expanded/collapsed
  const toggleFase = (fase: string) => {
    setExpandedFases(prev =>
      prev.includes(fase) ? prev.filter(f => f !== fase) : [...prev, fase]
    );
  };

  // Open technique details
  const openDetails = (technique: Techniek) => {
    setSelectedTechnique(technique);
    setDetailsOpen(true);
  };

  // Start training
  const startTraining = (technique: Techniek) => {
    setSelectedTechnique(technique);
    setActiveTraining(true);
    setChatMessages([
      { role: "coach", text: `Hey! Klaar om ${technique.naam} te oefenen? Ik speel de klant, jij bent de verkoper. Start maar!` }
    ]);
    setChatInput("");
  };

  // End training
  const endTraining = () => {
    setActiveTraining(false);
    setChatMessages([]);
    setSelectedTechnique(null);
  };

  // Send chat message
  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: "user" as const, text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    
    // Simulate coach response
    setTimeout(() => {
      const coachMessage = { role: "coach" as const, text: "Goed bezig! Probeer nu..." };
      setChatMessages(prev => [...prev, coachMessage]);
    }, 1000);
  };

  // Render training interface
  if (activeTraining && selectedTechnique) {
    return (
      <AppLayout currentPage="coaching" navigate={navigate} isAdmin={isAdmin}>
        <div className="h-[calc(100vh-64px)] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-hh-border bg-white">
            <div className="flex items-center gap-3">
              <Badge className="bg-hh-primary text-white">
                {selectedTechnique.nummer}
              </Badge>
              <div>
                <h2 className="text-[18px] leading-[24px] text-hh-text font-[700]">
                  {selectedTechnique.naam}
                </h2>
                <p className="text-[13px] text-hh-muted">
                  {selectedTechnique.nummer === "∞" ? "Onbeperkt" : `Fase ${selectedTechnique.fase}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={endTraining}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-hh-ui-50">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${
                  msg.role === "user" 
                    ? "bg-hh-primary text-white" 
                    : "bg-white text-hh-text border border-hh-border"
                }`}>
                  <p className="text-[14px] leading-[20px]">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-6 border-t border-hh-border bg-white">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Type je antwoord..."
                className="flex-1"
              />
              <Button onClick={sendChatMessage}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Main list view
  return (
    <AppLayout currentPage="coaching" navigate={navigate} isAdmin={isAdmin}>
      <div className="h-[calc(100vh-64px)] flex">
        {/* Sidebar - Hierarchische lijst */}
        <div className="w-[320px] border-r border-hh-border bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-hh-border">
            <h1 className="text-[24px] leading-[32px] text-hh-text font-[700]">
              Digital Coaching
            </h1>
            <p className="text-[14px] leading-[20px] text-hh-muted mt-1">
              E.P.I.C. Sales Flow
            </p>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-hh-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek techniek..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Technique List */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[12px] text-hh-muted uppercase tracking-wide px-2 py-2">
              Totale voortgang: 4/12 technieken • 33%
            </div>

            {phases.map((phase) => {
              const children = getChildren(phase.nummer);
              const isExpanded = expandedFases.includes(phase.nummer);
              const isSpecial = phase.nummer === "∞";

              return (
                <div key={phase.nummer} className="mb-1">
                  {/* Phase Header */}
                  <div
                    onClick={() => !isSpecial && toggleFase(phase.nummer)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSpecial 
                        ? "bg-slate-50 hover:bg-slate-100" 
                        : "hover:bg-hh-ui-50"
                    }`}
                  >
                    {!isSpecial && (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-hh-muted flex-shrink-0" />
                      )
                    )}
                    {isSpecial && <div className="w-4" />}
                    <Badge className={`text-[10px] flex-shrink-0 rounded-full px-2 border-0 ${
                      isSpecial ? "bg-hh-primary text-white" : "bg-teal-100 text-teal-600"
                    }`}>
                      {phase.nummer}
                    </Badge>
                    <span className="text-[13px] text-hh-text truncate flex-1">
                      {phase.naam}
                    </span>
                    {phase.nummer === "1" && (
                      <Badge className="text-[9px] bg-green-100 text-green-700 border-green-200">
                        0/4
                      </Badge>
                    )}
                    {phase.nummer === "∞" && (
                      <Button 
                        size="sm" 
                        className="h-6 px-2 text-[11px] bg-hh-primary hover:bg-slate-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTraining(phase);
                        }}
                      >
                        Chat
                      </Button>
                    )}
                  </div>

                  {/* Children (if expanded) */}
                  {isExpanded && children.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {children.map((child) => (
                        <div
                          key={child.nummer}
                          onClick={() => openDetails(child)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-hh-ui-50 transition-colors"
                        >
                          <Badge className="bg-teal-100 text-teal-600 border-0 text-[10px] flex-shrink-0 rounded-full px-2">
                            {child.nummer}
                          </Badge>
                          <span className="text-[12px] text-hh-muted truncate flex-1">
                            {child.naam}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content - Details or Empty State */}
        <div className="flex-1 overflow-y-auto p-6 bg-hh-ui-50">
          {!detailsOpen && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <Lightbulb className="w-12 h-12 text-hh-muted mx-auto mb-4" />
                <h2 className="text-[20px] leading-[28px] text-hh-text font-[700] mb-2">
                  Selecteer een techniek
                </h2>
                <p className="text-[14px] leading-[20px] text-hh-muted">
                  Klik op een techniek in de sidebar om details te zien en te beginnen met oefenen.
                </p>
              </div>
            </div>
          )}

          {detailsOpen && selectedTechnique && (
            <div className="max-w-3xl mx-auto">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-hh-primary text-white">
                      {selectedTechnique.nummer}
                    </Badge>
                    <Badge variant="outline" className="text-[12px]">
                      Fase {selectedTechnique.fase}
                    </Badge>
                    {selectedTechnique.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[11px] bg-hh-ui-100">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h1 className="text-[32px] leading-[40px] text-hh-text font-[700]">
                    {selectedTechnique.naam}
                  </h1>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDetailsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Doel */}
              {selectedTechnique.doel && (
                <Card className="p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-hh-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-[14px] font-[700] text-hh-text mb-1">Doel</h3>
                      <p className="text-[14px] leading-[20px] text-hh-muted">
                        {selectedTechnique.doel}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Wat */}
              {selectedTechnique.wat && (
                <div className="mb-4">
                  <h3 className="text-[16px] font-[700] text-hh-text mb-2">Wat</h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    {selectedTechnique.wat}
                  </p>
                </div>
              )}

              {/* Waarom */}
              {selectedTechnique.waarom && (
                <div className="mb-4">
                  <h3 className="text-[16px] font-[700] text-hh-text mb-2">Waarom</h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    {selectedTechnique.waarom}
                  </p>
                </div>
              )}

              {/* Wanneer */}
              {selectedTechnique.wanneer && (
                <div className="mb-4">
                  <h3 className="text-[16px] font-[700] text-hh-text mb-2">Wanneer</h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    {selectedTechnique.wanneer}
                  </p>
                </div>
              )}

              {/* Hoe */}
              {selectedTechnique.hoe && (
                <div className="mb-4">
                  <h3 className="text-[16px] font-[700] text-hh-text mb-2">Hoe</h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    {selectedTechnique.hoe}
                  </p>
                </div>
              )}

              {/* Stappenplan */}
              {selectedTechnique.stappenplan && selectedTechnique.stappenplan.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-[16px] font-[700] text-hh-text mb-2">Stappenplan</h3>
                  <ol className="list-decimal list-inside space-y-1">
                    {selectedTechnique.stappenplan.map((step, idx) => (
                      <li key={idx} className="text-[14px] leading-[20px] text-hh-muted">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Voorbeelden */}
              {selectedTechnique.voorbeeld && selectedTechnique.voorbeeld.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[16px] font-[700] text-hh-text mb-2">Voorbeelden</h3>
                  <div className="space-y-2">
                    {selectedTechnique.voorbeeld.map((ex, idx) => (
                      <Card key={idx} className="p-3 bg-hh-ui-50">
                        <p className="text-[13px] leading-[18px] text-hh-muted italic">
                          "{ex}"
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Train deze techniek */}
              <div className="mt-6">
                <h3 className="text-[16px] font-[700] text-hh-text mb-3">Train deze techniek</h3>
                <div className="flex gap-3">
                  <Button
                    className="gap-2"
                    onClick={() => startTraining(selectedTechnique)}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Bespreek met Hugo A.I.
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Play className="w-4 h-4" />
                    Bekijk video
                  </Button>
                </div>
              </div>

              {/* Jouw prestaties */}
              <div className="mt-8">
                <h3 className="text-[16px] font-[700] text-hh-text mb-3">Jouw prestaties</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4 text-center">
                    <Play className="w-6 h-6 text-hh-primary mx-auto mb-2" />
                    <div className="text-[24px] font-[700] text-hh-text">4</div>
                    <div className="text-[12px] text-hh-muted">Sessies</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <CheckCircle2 className="w-6 h-6 text-hh-success mx-auto mb-2" />
                    <div className="text-[24px] font-[700] text-hh-text">94%</div>
                    <div className="text-[12px] text-hh-muted">Gemiddelde score</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <Clock className="w-6 h-6 text-hh-muted mx-auto mb-2" />
                    <div className="text-[24px] font-[700] text-hh-text">14 nov</div>
                    <div className="text-[12px] text-hh-muted">Laatst geoefend</div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
