import {
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Mail,
  Shield,
  TrendingUp,
  TrendingDown,
  Calendar,
  Eye,
  Ban,
  CheckCircle2,
  Download,
  Play,
  Award,
  Trash2,
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

interface AdminUserManagementProps {
  navigate?: (page: string) => void;
}

export function AdminUserManagement({ navigate }: AdminUserManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);

  const users = [
    {
      id: 1,
      name: "Jan de Vries",
      email: "jan@techcorp.nl",
      company: "TechCorp BV",
      role: "Sales Manager",
      plan: "Pro",
      planPrice: "€149",
      sessions: 47,
      avgScore: 84,
      scoreDelta: 12,
      streak: 12,
      topTechnique: "E.P.I.C",
      status: "active",
      joined: "15 sept 2024",
      lastLogin: "2 uur geleden",
    },
    {
      id: 2,
      name: "Sarah van Dijk",
      email: "sarah@growco.nl",
      company: "GrowCo",
      role: "Account Executive",
      plan: "Team",
      planPrice: "€499",
      sessions: 23,
      avgScore: 78,
      scoreDelta: 5,
      streak: 7,
      topTechnique: "SPIN",
      status: "active",
      joined: "3 okt 2024",
      lastLogin: "5 min geleden",
    },
    {
      id: 3,
      name: "Mark Peters",
      email: "mark@startup.io",
      company: "StartUp.io",
      role: "Founder",
      plan: "Starter",
      planPrice: "€49",
      sessions: 12,
      avgScore: 72,
      scoreDelta: -3,
      streak: 3,
      topTechnique: "BANT",
      status: "trial",
      joined: "12 dec 2024",
      lastLogin: "1 dag geleden",
    },
    {
      id: 4,
      name: "Lisa de Jong",
      email: "lisa@salesforce.com",
      company: "Salesforce",
      role: "SDR",
      plan: "Pro",
      planPrice: "€149",
      sessions: 34,
      avgScore: 81,
      scoreDelta: 8,
      streak: 9,
      topTechnique: "Discovery",
      status: "active",
      joined: "20 sept 2024",
      lastLogin: "3 uur geleden",
    },
    {
      id: 5,
      name: "Tom Bakker",
      email: "tom@example.com",
      company: "Example Inc",
      role: "Sales Rep",
      plan: "Starter",
      planPrice: "€49",
      sessions: 8,
      avgScore: 68,
      scoreDelta: -2,
      streak: 0,
      topTechnique: "Cold Call",
      status: "inactive",
      joined: "5 nov 2024",
      lastLogin: "2 weken geleden",
    },
  ];

  const viewUserDetail = (user: any) => {
    setSelectedUser(user);
    setShowUserDetail(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px]">
            Actief
          </Badge>
        );
      case "trial":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px]">
            Trial
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-hh-muted/10 text-hh-muted border-hh-muted/20 text-[11px]">
            Inactief
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout currentPage="admin-users" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Coming Soon Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-amber-800 font-medium text-sm">Demo Data - Binnenkort Beschikbaar</p>
            <p className="text-amber-600 text-xs">Deze pagina toont voorbeelddata. Echte gebruikersdata wordt binnenkort gekoppeld.</p>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Gebruikers
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              {users.length} gebruikers totaal
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek gebruikers..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="active">Actief</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="inactive">Inactief</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Plans</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* User Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50">
                <tr>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    <input type="checkbox" className="rounded" />
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Gebruiker
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Plan
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Sessies
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Score
                  </th>
                  <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                    onClick={() => viewUserDetail(user)}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-purple-600/10 text-purple-600 text-[13px]">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                            {user.name}
                          </p>
                          <p className="text-[12px] leading-[16px] text-hh-muted">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        {user.plan}
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        {user.planPrice}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                      {user.sessions}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {user.avgScore}%
                        </span>
                        {user.scoreDelta > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-hh-success" />
                        ) : user.scoreDelta < 0 ? (
                          <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                        ) : null}
                        <span
                          className={`text-[12px] leading-[16px] ${
                            user.scoreDelta > 0
                              ? "text-hh-success"
                              : user.scoreDelta < 0
                              ? "text-red-600"
                              : "text-hh-muted"
                          }`}
                        >
                          {user.scoreDelta > 0 && "+"}
                          {user.scoreDelta}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(user.status)}</td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewUserDetail(user)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="w-4 h-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Ban className="w-4 h-4 mr-2" />
                            Suspend
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-hh-border flex items-center justify-between">
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Toont 1-{users.length} van {users.length}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Vorige
              </Button>
              <Button variant="outline" size="sm" disabled>
                Volgende
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* User Detail Modal */}
      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUser?.name || "Gebruiker Details"}</DialogTitle>
            <DialogDescription>
              {selectedUser?.email || "Gebruikersinformatie"}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* Profile Card */}
              <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-purple-600 text-white text-[20px]">
                      {selectedUser.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-[20px] leading-[28px] text-hh-text font-medium mb-1">
                      {selectedUser.name}
                    </h3>
                    <p className="text-[14px] leading-[20px] text-hh-muted mb-2">
                      {selectedUser.email}
                    </p>
                    <div className="flex items-center gap-4 text-[13px] leading-[18px] text-hh-muted">
                      <span>{selectedUser.company}</span>
                      <span>•</span>
                      <span>{selectedUser.role}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[13px] leading-[18px] text-hh-muted mt-2">
                      <span>Lid sinds: {selectedUser.joined}</span>
                      <span>•</span>
                      <span>Laatste login: {selectedUser.lastLogin}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge className="bg-purple-600/10 text-purple-600 border-purple-600/20">
                        {selectedUser.plan} - {selectedUser.planPrice}
                      </Badge>
                      {getStatusBadge(selectedUser.status)}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <Play className="w-5 h-5 text-hh-primary mx-auto mb-2" />
                  <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                    {selectedUser.sessions}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Sessies</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <TrendingUp className="w-5 h-5 text-hh-success mx-auto mb-2" />
                  <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                    {selectedUser.avgScore}%
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Gem Score</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <span className="text-[20px] mx-auto mb-2 block">🔥</span>
                  <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                    {selectedUser.streak}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Streak</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <Award className="w-5 h-5 text-hh-warn mx-auto mb-2" />
                  <p className="text-[16px] leading-[22px] text-hh-text font-semibold">
                    {selectedUser.topTechnique}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Top Tech</p>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button className="flex-1 gap-2">
                  <Mail className="w-4 h-4" />
                  Stuur Email
                </Button>
                <Button variant="outline" className="flex-1 gap-2">
                  <Eye className="w-4 h-4" />
                  Bekijk Sessies
                </Button>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-600 hover:bg-red-50">
                  <Ban className="w-4 h-4" />
                  Suspend Account
                </Button>
                <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}