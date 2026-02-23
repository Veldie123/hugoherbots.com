import { AppLayout } from "./AppLayout";
import { KPITile } from "./KPITile";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Download,
  Search,
  Calendar,
  Play,
  TrendingUp,
  Clock,
  ChevronRight,
  Filter,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  scenario: string;
  date: string;
  duration: string;
  score: number;
  phase: string;
  technique: string;
  status: "completed" | "in-progress" | "paused";
}

interface MySessionsProps {
  navigate?: (page: string) => void;
}

export function MySessions({ navigate }: MySessionsProps) {
  const sessions: Session[] = [
    {
      id: "1",
      title: "Discovery call - SaaS prospect",
      scenario: "Tech industry discovery",
      date: "Vandaag om 14:30",
      duration: "12 min",
      score: 87,
      phase: "Fase 1 • Discovery",
      technique: "E.P.I.C",
      status: "completed",
    },
    {
      id: "2",
      title: "Objection handling - Budget bezwaar",
      scenario: "Price objection handling",
      date: "Vandaag om 11:15",
      duration: "8 min",
      score: 91,
      phase: "Fase 2 • Objections",
      technique: "Value Selling",
      status: "completed",
    },
    {
      id: "3",
      title: "Cold call - Enterprise lead",
      scenario: "Cold calling enterprise",
      date: "Gisteren om 16:45",
      duration: "15 min",
      score: 68,
      phase: "Fase 1 • Discovery",
      technique: "SPIN",
      status: "completed",
    },
    {
      id: "4",
      title: "Closing - High-value deal",
      scenario: "Enterprise closing",
      date: "Gisteren om 10:20",
      duration: "18 min",
      score: 84,
      phase: "Fase 4 • Closing",
      technique: "Urgency Creation",
      status: "completed",
    },
    {
      id: "5",
      title: "Proposal presentation - ROI focus",
      scenario: "B2B proposal practice",
      date: "2 dagen geleden",
      duration: "14 min",
      score: 79,
      phase: "Fase 3 • Proposal",
      technique: "ROI Calculation",
      status: "completed",
    },
    {
      id: "6",
      title: "Discovery call - Manufacturing sector",
      scenario: "Industry-specific discovery",
      date: "3 dagen geleden",
      duration: "11 min",
      score: 82,
      phase: "Fase 1 • Discovery",
      technique: "Active Listening",
      status: "completed",
    },
  ];

  const weekStats = {
    totalSessions: 12,
    avgScore: 82,
    totalTime: "2u 24min",
    improvement: 8,
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-hh-success";
    if (score >= 60) return "text-hh-warn";
    return "text-destructive";
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80)
      return "bg-hh-success/10 text-hh-success border-hh-success/20";
    if (score >= 60) return "bg-hh-warn/10 text-hh-warn border-hh-warn/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <AppLayout currentPage="sessions" navigate={navigate}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="mb-2">Mijn Trainingssessies</h1>
            <p className="text-hh-muted">
              Je hebt deze week {weekStats.totalSessions} sessies afgerond —
              blijf oefenen, groei is meetbaar.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Download className="w-4 h-4" /> Exporteer data
            </Button>
            <Button
              className="gap-2 w-full sm:w-auto"
              onClick={() => navigate?.("roleplay")}
            >
              <Play className="w-4 h-4" /> Start nieuwe sessie
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <KPITile
            metric="Sessies deze week"
            value={weekStats.totalSessions}
            delta={{ value: "+3", type: "up" }}
            label="vs vorige week"
          />
          <KPITile
            metric="Gemiddelde score"
            value={weekStats.avgScore}
            delta={{ value: `+${weekStats.improvement}%`, type: "up" }}
            label="Groei is zichtbaar"
          />
          <KPITile
            metric="Totale trainingstijd"
            value={weekStats.totalTime}
            label="Deze week"
          />
          <KPITile
            metric="Langste sessie"
            value="18 min"
            label="Closing scenario"
          />
        </div>

        {/* Filters */}
        <Card className="p-4 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek scenario of techniek..."
                className="pl-10 bg-hh-ui-50"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle fases</SelectItem>
                <SelectItem value="1">Fase 1 • Discovery</SelectItem>
                <SelectItem value="2">Fase 2 • Objections</SelectItem>
                <SelectItem value="3">Fase 3 • Proposal</SelectItem>
                <SelectItem value="4">Fase 4 • Closing</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="week">
              <SelectTrigger>
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Deze week</SelectItem>
                <SelectItem value="month">Deze maand</SelectItem>
                <SelectItem value="quarter">Dit kwartaal</SelectItem>
                <SelectItem value="all">Alle tijd</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Sessions Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sessie</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Duur</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Top techniek</TableHead>
                <TableHead className="text-right">Actie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-hh-ui-50"
                  onClick={() => console.log("View session", session.id)}
                >
                  <TableCell>
                    <div>
                      <p className="text-hh-text">{session.title}</p>
                      <p className="text-hh-muted text-[14px] leading-[20px]">
                        {session.scenario}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-hh-muted text-[14px] leading-[20px]">
                      <Calendar className="w-3.5 h-3.5" />
                      {session.date}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-hh-muted text-[14px] leading-[20px]">
                      <Clock className="w-3.5 h-3.5" />
                      {session.duration}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getScoreBadgeClass(session.score)}>
                      {session.score}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[12px]">
                      {session.phase}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-hh-text text-[14px] leading-[20px]">
                      {session.technique}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-1">
                      Details <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Hugo's Training Tip */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-primary/20 bg-hh-primary/5">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-hh-primary" />
            </div>
            <div>
              <h3 className="text-hh-text mb-2">Hugo's training tip</h3>
              <p className="text-hh-muted mb-4">
                Je score op discovery calls is consistent hoog (87%), maar bij
                closing scenario's zakt die naar 68%. Focus deze week op{" "}
                <strong className="text-hh-text">
                  Urgency Creation
                </strong>{" "}
                en{" "}
                <strong className="text-hh-text">Closing Techniques</strong>.
                Herhaal het "High-value deal" scenario met dit in je achterhoofd.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate?.("library")}
                >
                  Bekijk closing scenarios
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate?.("analytics")}
                >
                  Analyse per techniek
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
