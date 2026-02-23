import { useState } from "react";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
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
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Download,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  BarChart3,
  Play,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  sessionsThisWeek: number;
  avgScore: number;
  delta: number;
  lastSession: string;
  topTechnique: string;
  status: "active" | "inactive" | "new";
}

interface TeamSessionsProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

export function TeamSessions({ navigate, isAdmin }: TeamSessionsProps) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const teamMembers: TeamMember[] = [
    {
      id: "1",
      name: "Sarah van Dijk",
      initials: "SV",
      role: "Senior Sales Rep",
      sessionsThisWeek: 8,
      avgScore: 87,
      delta: 5,
      lastSession: "2 uur geleden",
      topTechnique: "E.P.I.C",
      status: "active",
    },
    {
      id: "2",
      name: "Mark Peters",
      initials: "MP",
      role: "Account Executive",
      sessionsThisWeek: 12,
      avgScore: 82,
      delta: 8,
      lastSession: "5 uur geleden",
      topTechnique: "Objection Handling",
      status: "active",
    },
    {
      id: "3",
      name: "Lisa de Jong",
      initials: "LJ",
      role: "SDR",
      sessionsThisWeek: 15,
      avgScore: 79,
      delta: 12,
      lastSession: "1 dag geleden",
      topTechnique: "Discovery",
      status: "active",
    },
    {
      id: "4",
      name: "Tom Bakker",
      initials: "TB",
      role: "SDR",
      sessionsThisWeek: 6,
      avgScore: 74,
      delta: -3,
      lastSession: "3 dagen geleden",
      topTechnique: "Active Listening",
      status: "inactive",
    },
    {
      id: "5",
      name: "Emma Visser",
      initials: "EV",
      role: "Junior Sales Rep",
      sessionsThisWeek: 10,
      avgScore: 71,
      delta: 15,
      lastSession: "4 uur geleden",
      topTechnique: "Value Selling",
      status: "new",
    },
  ];

  const teamStats = {
    totalSessions: 51,
    avgScore: 79,
    activeMembers: 5,
    topPerformer: "Sarah van Dijk",
  };

  return (
    <AppLayout currentPage="team" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="mb-2">Team Overzicht</h1>
            <p className="text-hh-muted">
              Volg de voortgang van je team — deze week {teamStats.totalSessions}{" "}
              sessies afgerond
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Download className="w-4 h-4" /> Exporteer data
            </Button>
            <Button className="gap-2 w-full sm:w-auto" onClick={() => setInviteModalOpen(true)}>
              <Users className="w-4 h-4" /> Nodig teamlid uit
            </Button>
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-hh-primary" />
              </div>
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted">
                  Totaal sessies
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {teamStats.totalSessions}
                </p>
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted">
              Deze week
            </p>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-hh-success" />
              </div>
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted">
                  Gemiddelde score
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {teamStats.avgScore}%
                </p>
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted">
              Team gemiddelde
            </p>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-hh-warn" />
              </div>
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted">
                  Actieve leden
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {teamStats.activeMembers}
                </p>
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted">
              Van de 5 teamleden
            </p>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-hh-primary" />
              </div>
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted">
                  Top performer
                </p>
                <p className="text-[20px] leading-[28px] text-hh-text">
                  {teamStats.topPerformer}
                </p>
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted">
              87% gemiddeld
            </p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek teamlid..."
                className="pl-10 bg-hh-ui-50"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle status</SelectItem>
                <SelectItem value="active">Actief</SelectItem>
                <SelectItem value="inactive">Inactief</SelectItem>
                <SelectItem value="new">Nieuw</SelectItem>
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

        {/* Team Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teamlid</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Sessies</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Top techniek</TableHead>
                <TableHead>Laatste sessie</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-hh-primary text-white">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[16px] leading-[24px] text-hh-text">
                        {member.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[14px] leading-[20px] text-hh-muted">
                      {member.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[16px] leading-[24px] text-hh-text">
                      {member.sessionsThisWeek}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] leading-[24px] text-hh-text">
                        {member.avgScore}%
                      </span>
                      <div
                        className={`flex items-center gap-1 text-[12px] ${
                          member.delta > 0
                            ? "text-hh-success"
                            : "text-destructive"
                        }`}
                      >
                        {member.delta > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {Math.abs(member.delta)}%
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[12px]">
                      {member.topTechnique}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[14px] leading-[20px] text-hh-muted">
                      <Clock className="w-3 h-3" />
                      {member.lastSession}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        member.status === "active"
                          ? "bg-hh-success/10 text-hh-success border-hh-success/20"
                          : member.status === "new"
                          ? "bg-hh-warn/10 text-hh-warn border-hh-warn/20"
                          : "bg-hh-ui-100 text-hh-muted border-hh-border"
                      }
                    >
                      {member.status === "active"
                        ? "Actief"
                        : member.status === "new"
                        ? "Nieuw"
                        : "Inactief"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Hugo's Team Tip */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-primary/20 bg-hh-primary/5">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-hh-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-[20px] leading-[28px] text-hh-text mb-2">
                Hugo's team tip
              </h3>
              <p className="text-[16px] leading-[24px] text-hh-muted">
                Je team laat geweldige vooruitgang zien deze week. Blijf samen oefenen — consistent trainen is de sleutel tot langdurige groei.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nodig een teamlid uit</DialogTitle>
            <DialogDescription>
              Voeg een nieuw teamlid toe aan je team door hun e-mailadres in te
              voeren en een rol te selecteren.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="email" className="sm:text-right">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                className="sm:col-span-3"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="role" className="sm:text-right">
                Rol
              </Label>
              <div className="sm:col-span-3">
                <Select
                  value={inviteRole}
                  onValueChange={(value: string) => setInviteRole(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Teamlid</SelectItem>
                    <SelectItem value="admin">Beheerder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogHeader>
            <DialogTitle>Bevestiging</DialogTitle>
            <DialogDescription>
              We zullen een uitnodigingslink naar {inviteEmail} sturen met de
              geselecteerde rol.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInviteModalOpen(false)}
            >
              Annuleren
            </Button>
            <Button size="sm">Uitnodigen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}