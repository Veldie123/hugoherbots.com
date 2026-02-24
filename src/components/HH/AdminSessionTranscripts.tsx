import {
  Search,
  Download,
  Eye,
  MessageSquare,
  Flag,
  Video,
  Mic,
  AlertTriangle,
  CheckCircle2,
  Play,
  MoreVertical,
  ThumbsUp,
  BarChart3,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { getTechniekByNummer } from "../../data/technieken-service";

interface Session {
  id: number;
  user: string;
  userEmail: string;
  techniek: string;
  fase: string;
  type: string;
  duration: string;
  score: number;
  quality: string;
  date: string;
  flagged: boolean;
  transcript: Array<{ speaker: string; time: string; text: string }>;
  feedback: {
    strengths: string[];
    improvements: string[];
  };
}

interface AdminSessionTranscriptsProps {
  navigate?: (page: string, data?: any) => void;
}

export function AdminSessionTranscripts({ navigate }: AdminSessionTranscriptsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTechnique, setFilterTechnique] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const openTranscriptDialog = (session: Session) => {
    if (navigate) {
      navigate("admin-analysis-results", { conversationId: session.id.toString(), fromAdmin: true });
    }
  };
  const [sortField, setSortField] = useState<"user" | "score" | "date" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");

  const handleSort = (field: "user" | "score" | "date") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sessions: Session[] = [
    {
      id: 1,
      user: "Jan de Vries",
      userEmail: "jan@techcorp.nl",
      techniek: "2.1 - SPIN Questioning",
      fase: "Ontdekkingsfase",
      type: "audio",
      duration: "18:45",
      score: 88,
      quality: "excellent",
      date: "2025-01-15 14:23",
      flagged: false,
      transcript: [
        { speaker: "AI Coach", time: "00:00", text: "Goedemiddag! Vandaag gaan we oefenen met SPIN vragen. Ben je er klaar voor?" },
        { speaker: "Jan", time: "00:05", text: "Ja, ik ben er klaar voor. Ik wil graag beter worden in het stellen van de juiste vragen." },
        { speaker: "AI Coach", time: "00:12", text: "Perfect! Stel je voor: je belt een prospect die interesse heeft getoond in jullie software. Begin maar met je opening." },
        { speaker: "Jan", time: "00:20", text: "Goedemiddag, met Jan van TechCorp. Ik bel naar aanleiding van uw interesse in onze CRM oplossing. Klopt het dat jullie momenteel uitdagingen ervaren met klantendata?" },
        { speaker: "AI Coach", time: "00:35", text: "Goede opening! Je gaat direct in op hun situatie. Ja, dat klopt. We hebben inderdaad moeite met het centraliseren van klantinformatie." },
        { speaker: "Jan", time: "00:45", text: "Wat zijn de gevolgen hiervan voor jullie team? Merken jullie dat bepaalde processen hierdoor trager verlopen?" },
        { speaker: "AI Coach", time: "00:55", text: "Uitstekende Problem vraag! Ja, onze salesmedewerkers verliezen veel tijd met zoeken naar klantgeschiedenis. Soms bellen we zelfs dezelfde klant twee keer." },
      ],
      feedback: {
        strengths: ["Goede opening", "Sterke SPIN vragen", "Actief luisteren"],
        improvements: ["Meer doorvragen na antwoord", "Pauzes inbouwen"],
      },
    },
    {
      id: 2,
      user: "Sarah van Dijk",
      userEmail: "sarah@growco.nl",
      techniek: "4.1 - Objection Handling",
      fase: "Beslissingsfase",
      type: "video",
      duration: "24:12",
      score: 76,
      quality: "good",
      date: "2025-01-15 10:45",
      flagged: false,
      transcript: [
        { speaker: "AI Coach", time: "00:00", text: "Vandaag oefenen we met bezwaar afhandeling. Ik zal de rol spelen van een sceptische klant. Klaar?" },
        { speaker: "Sarah", time: "00:06", text: "Ja, laten we beginnen." },
        { speaker: "AI Coach", time: "00:08", text: "Jullie prijs is veel te hoog vergeleken met de concurrent. Waarom zou ik voor jullie kiezen?" },
        { speaker: "Sarah", time: "00:15", text: "Ik begrijp uw bezorgdheid over de prijs. Mag ik vragen met welke concurrent u ons vergelijkt?" },
      ],
      feedback: {
        strengths: ["Kalm blijven bij bezwaar", "Doorvragen"],
        improvements: ["Meer empathie tonen", "Value proposition versterken"],
      },
    },
    {
      id: 3,
      user: "Mark Peters",
      userEmail: "mark@startup.io",
      techniek: "1.2 - Gentleman's Agreement",
      fase: "Openingsfase",
      type: "chat",
      duration: "12:30",
      score: 68,
      quality: "needs-improvement",
      date: "2025-01-14 16:20",
      flagged: true,
      transcript: [
        { speaker: "AI Coach", time: "00:00", text: "Laten we oefenen met het openen van een gesprek en het gentleman's agreement. Begin maar!" },
        { speaker: "Mark", time: "00:05", text: "Hoi, ik ben Mark. Kan ik u iets vertellen over ons product?" },
        { speaker: "AI Coach", time: "00:10", text: "Dat klopt niet helemaal. Probeer eerst een gentleman's agreement te maken voordat je begint met pitchen." },
      ],
      feedback: {
        strengths: ["Enthousiasme"],
        improvements: ["Structuur verbeteren", "Gentleman's agreement toepassen", "Minder direct pitchen"],
      },
    },
    {
      id: 4,
      user: "Lisa de Jong",
      userEmail: "lisa@salesforce.com",
      techniek: "2.2 - E.P.I.C Framework",
      fase: "Ontdekkingsfase",
      type: "audio",
      duration: "21:18",
      score: 91,
      quality: "excellent",
      date: "2025-01-14 11:30",
      flagged: false,
      transcript: [
        { speaker: "AI Coach", time: "00:00", text: "Vandaag oefenen we het E.P.I.C framework. Probeer alle vier de elementen toe te passen." },
        { speaker: "Lisa", time: "00:07", text: "Perfect! Laten we beginnen. Mag ik vragen naar uw huidige Environment - hoe ziet jullie salesproces er nu uit?" },
      ],
      feedback: {
        strengths: ["Excellente structuur", "Alle EPIC elementen toegepast", "Natuurlijke flow"],
        improvements: ["Geen - top prestatie!"],
      },
    },
    {
      id: 5,
      user: "Tom Bakker",
      userEmail: "tom@example.com",
      techniek: "3.1 - Value Proposition",
      fase: "Aanbevelingsfase",
      type: "video",
      duration: "15:42",
      score: 72,
      quality: "good",
      date: "2025-01-13 14:10",
      flagged: true,
      transcript: [
        { speaker: "AI Coach", time: "00:00", text: "Laten we oefenen met het presenteren van je value proposition. Klaar?" },
        { speaker: "Tom", time: "00:04", text: "Ja. Ons product is het beste op de markt omdat we de meeste features hebben." },
        { speaker: "AI Coach", time: "00:12", text: "Stop! Je begint met features in plaats van value. Probeer opnieuw, maar start met de waarde voor de klant." },
      ],
      feedback: {
        strengths: ["Zelfvertrouwen", "Product kennis"],
        improvements: ["Focus op value i.p.v. features", "Klantperspectief innemen"],
      },
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "audio":
        return <Mic className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "chat":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Play className="w-4 h-4" />;
    }
  };

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case "excellent":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Excellent
          </Badge>
        );
      case "good":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px]">
            <ThumbsUp className="w-3 h-3 mr-1" />
            Good
          </Badge>
        );
      case "needs-improvement":
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[11px]">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Work
          </Badge>
        );
      default:
        return null;
    }
  };

  const viewTranscript = (session: any) => {
    if (navigate) {
      navigate("admin-analysis-results", { conversationId: session.id.toString(), fromAdmin: true });
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.techniek.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.fase.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTechnique = filterTechnique === "all" || session.techniek === filterTechnique;
    const matchesStatus = filterStatus === "all" || session.quality === filterStatus;
    return matchesSearch && matchesTechnique && matchesStatus;
  }).sort((a, b) => {
    if (sortField === "user") {
      return sortDirection === "asc"
        ? a.user.localeCompare(b.user)
        : b.user.localeCompare(a.user);
    } else if (sortField === "score") {
      return sortDirection === "asc"
        ? a.score - b.score
        : b.score - a.score;
    } else if (sortField === "date") {
      return sortDirection === "asc"
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });

  return (
    <AdminLayout currentPage="admin-transcripts" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Session Transcripts
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Bekijk en analyseer gebruiker-AI gesprekken voor kwaliteitscontrole
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards - Exact zoals AdminDashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#9333ea' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +15%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Total Sessions
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {sessions.length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +8%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Excellent Quality
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {sessions.filter(s => s.quality === "excellent").length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +2.3%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Avg Score
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {Math.round(sessions.reduce((acc, s) => acc + s.score, 0) / sessions.length)}%
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-hh-warn" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-error/10 text-hh-error border-hh-error/20"
              >
                -5%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Needs Improvement
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {sessions.filter(s => s.quality === "needs-improvement").length}
            </p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek sessies, gebruikers, technieken..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterTechnique} onValueChange={setFilterTechnique}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Techniek" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Technieken</SelectItem>
                <SelectItem value="2.1 - SPIN Questioning">SPIN Questioning</SelectItem>
                <SelectItem value="4.1 - Objection Handling">Objection Handling</SelectItem>
                <SelectItem value="1.2 - Gentleman's Agreement">Gentleman's Agreement</SelectItem>
                <SelectItem value="2.2 - E.P.I.C Framework">E.P.I.C Framework</SelectItem>
                <SelectItem value="3.1 - Value Proposition">Value Proposition</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Statussen</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="needs-improvement">Needs Work</SelectItem>
              </SelectContent>
            </Select>
            
            {/* View Toggle - Right Side */}
            <div className="flex gap-1 sm:ml-auto shrink-0">
              <Button
                variant="ghost"
                size="sm"
                style={viewMode === "list" ? { backgroundColor: '#9333ea', color: 'white' } : {}}
                className={viewMode === "list" ? "hover:opacity-90" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                style={viewMode === "grid" ? { backgroundColor: '#9333ea', color: 'white' } : {}}
                className={viewMode === "grid" ? "hover:opacity-90" : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Sessions List/Grid */}
        {viewMode === "list" ? (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th
                    className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("user")}
                  >
                    <div className="flex items-center gap-2">
                      Gebruiker
                      {sortField === "user" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                      {sortField !== "user" && (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Techniek
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Scenario
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("score")}
                  >
                    <div className="flex items-center gap-2">
                      Score
                      {sortField === "score" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                      {sortField !== "score" && (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Duur
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-2">
                      Datum
                      {sortField === "date" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        ))}
                      {sortField !== "date" && (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="text-right px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session, index) => (
                  <tr
                    key={session.id}
                    className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50 transition-colors ${
                      index % 2 === 0 ? "bg-card" : "bg-hh-ui-50/30"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-[11px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }}>
                            {session.user
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[14px] leading-[20px] text-hh-text font-medium flex items-center gap-2">
                            {session.user}
                            {session.flagged && (
                              <Flag className="w-3.5 h-3.5 text-red-600" />
                            )}
                          </p>
                          <p className="text-[12px] leading-[16px] text-hh-muted">
                            {session.userEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        {session.techniek}
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        {session.fase}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-[14px] leading-[20px] text-hh-text">
                        {getTypeIcon(session.type)}
                        <span className="capitalize">{session.type}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[14px] leading-[20px] font-medium ${
                          session.score >= 80
                            ? "text-emerald-500"
                            : session.score >= 70
                            ? "text-blue-600"
                            : "text-hh-warn"
                        }`}
                      >
                        {session.score}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                      {session.duration}
                    </td>
                    <td className="py-3 px-4 text-[13px] leading-[18px] text-hh-muted">
                      {session.date}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewTranscript(session)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Transcript
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={session.flagged ? "text-emerald-500" : "text-red-600"}
                          >
                            <Flag className="w-4 h-4 mr-2" />
                            {session.flagged ? "Unflag" : "Flag for Review"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => {
              const scoreColor = session.quality === "excellent"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : session.quality === "good"
                ? "bg-blue-600/10 text-blue-600 border-blue-600/20"
                : "bg-hh-warn/10 text-hh-warn border-hh-warn/20";

              return (
                <Card
                  key={session.id}
                  className="p-5 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-shadow cursor-pointer"
                  onClick={() => openTranscriptDialog(session)}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="text-[12px] font-semibold" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }}>
                        {session.user.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-hh-text truncate">
                        {session.user}
                      </p>
                      <p className="text-[12px] text-hh-muted truncate">
                        {session.userEmail}
                      </p>
                    </div>
                  </div>

                  {/* Technique */}
                  <div className="mb-3">
                    <p className="text-[13px] font-medium text-hh-text mb-1">
                      {session.techniek}
                    </p>
                    <Badge className="text-[11px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                      {session.fase}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-hh-border">
                    <div>
                      <p className="text-[11px] text-hh-muted mb-1">Score</p>
                      <Badge variant="outline" className={`text-[12px] font-semibold ${scoreColor}`}>
                        {session.score}%
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[11px] text-hh-muted mb-1">Duur</p>
                      <p className="text-[13px] text-hh-text font-medium">{session.duration}</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-hh-muted">{session.date}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); openTranscriptDialog(session); }}>
                          <Eye className="w-4 h-4 mr-2" />
                          Bekijk Transcript
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-hh-error">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

    </AdminLayout>
  );
}