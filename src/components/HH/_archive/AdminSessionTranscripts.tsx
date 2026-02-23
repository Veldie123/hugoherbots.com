import {
  Search,
  Filter,
  Download,
  Eye,
  MessageSquare,
  Flag,
  Clock,
  User,
  Calendar,
  Video,
  Mic,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { getTechniqueByNumber } from "../../data/epicTechniques";

interface AdminSessionTranscriptsProps {
  navigate?: (page: string) => void;
}

export function AdminSessionTranscripts({ navigate }: AdminSessionTranscriptsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterQuality, setFilterQuality] = useState("all");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const sessions = [
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
          <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px]">
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
    setSelectedSession(session);
    setShowTranscript(true);
  };

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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Total Sessions
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {sessions.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-hh-success" />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Excellent
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {sessions.filter((s) => s.quality === "excellent").length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-hh-warn" />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Needs Review
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {sessions.filter((s) => s.quality === "needs-improvement").length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
                <Flag className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Flagged
                </p>
                <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                  {sessions.filter((s) => s.flagged).length}
                </p>
              </div>
            </div>
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
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Types</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterQuality} onValueChange={setFilterQuality}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Kwaliteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kwaliteit</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="needs-improvement">Needs Work</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Sessions Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50">
                <tr>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Gebruiker
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Techniek
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Type
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Duur
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Score
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Kwaliteit
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Datum
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    className={`border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer ${
                      session.flagged ? "bg-red-50" : ""
                    }`}
                    onClick={() => viewTranscript(session)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-purple-600/10 text-purple-600 text-[11px]">
                            {session.user
                              .split(" ")
                              .map((n) => n[0])
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
                    <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                      {session.duration}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`text-[14px] leading-[20px] font-medium ${
                          session.score >= 80
                            ? "text-hh-success"
                            : session.score >= 70
                            ? "text-blue-600"
                            : "text-hh-warn"
                        }`}
                      >
                        {session.score}%
                      </span>
                    </td>
                    <td className="py-3 px-4">{getQualityBadge(session.quality)}</td>
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
                            className={session.flagged ? "text-hh-success" : "text-red-600"}
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
      </div>

      {/* Transcript Modal */}
      <Dialog open={showTranscript} onOpenChange={setShowTranscript}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{selectedSession?.user || "Session Details"}</span>
              {selectedSession && (
                <>
                  <Badge variant="outline" className="text-[11px]">
                    {selectedSession.techniek}
                  </Badge>
                  {getQualityBadge(selectedSession.quality)}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedSession
                ? `${selectedSession.date} • ${selectedSession.duration} • Score: ${selectedSession.score}%`
                : "Session transcript en feedback"}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-6">
              {/* Transcript */}
              <Card className="p-4 rounded-[16px] border-hh-border">
                <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-3">
                  Transcript
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {selectedSession.transcript.map((line: any, index: number) => (
                    <div
                      key={index}
                      className={`flex gap-3 p-3 rounded-lg ${
                        line.speaker === "AI Coach"
                          ? "bg-purple-50"
                          : "bg-blue-50"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            line.speaker === "AI Coach"
                              ? "bg-purple-600/10 text-purple-600 border-purple-600/20"
                              : "bg-blue-600/10 text-blue-600 border-blue-600/20"
                          }`}
                        >
                          {line.time}
                        </Badge>
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] leading-[18px] font-medium text-hh-text mb-1">
                          {line.speaker}:
                        </p>
                        <p className="text-[14px] leading-[20px] text-hh-text">
                          {line.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* AI Feedback */}
              <Card className="p-4 rounded-[16px] border-hh-border">
                <h3 className="text-[16px] leading-[22px] text-hh-text font-medium mb-3">
                  AI Feedback
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[13px] leading-[18px] text-hh-success font-medium mb-2 flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4" />
                      Strengths:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedSession.feedback.strengths.map((item: string, i: number) => (
                        <li key={i} className="text-[14px] leading-[20px] text-hh-text">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[13px] leading-[18px] text-hh-warn font-medium mb-2 flex items-center gap-2">
                      <ThumbsDown className="w-4 h-4" />
                      Areas for Improvement:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedSession.feedback.improvements.map((item: string, i: number) => (
                        <li key={i} className="text-[14px] leading-[20px] text-hh-text">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2">
                  <Download className="w-4 h-4" />
                  Download Transcript
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 gap-2 ${
                    selectedSession.flagged
                      ? "text-hh-success border-hh-success"
                      : "text-red-600 border-red-600"
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  {selectedSession.flagged ? "Unflag Session" : "Flag for Review"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}