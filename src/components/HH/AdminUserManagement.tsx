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
  Users,
  CheckCircle,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
} from "lucide-react";
import { CustomCheckbox } from "../ui/custom-checkbox";
import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { getTechniekByNummer } from "../../data/technieken-service";

interface AdminUserManagementProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AdminUserManagement({ navigate, isSuperAdmin }: AdminUserManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [sortField, setSortField] = useState<"name" | "sessions" | "score" | "joined" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/users')
      .then(res => res.json())
      .then((data: any) => {
        const usersList = Array.isArray(data) ? data : data.users || [];
        const mapped = usersList.map((u: any) => ({
          id: u.id,
          name: u.name || u.email || 'Onbekend',
          email: u.email || '',
          company: 'Niet beschikbaar',
          role: u.role || 'Gebruiker',
          plan: u.plan || 'Starter',
          planPrice: '',
          sessions: u.totalActivities || 0,
          avgScore: u.totalVideoViews || 0,
          scoreDelta: 0,
          streak: 0,
          topTechnique: 'Niet beschikbaar',
          status: u.status || 'inactive',
          joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Onbekend',
          lastLogin: u.lastActive ? new Date(u.lastActive).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Niet beschikbaar',
        }));
        setUsers(mapped);
        setIsLoading(false);
      })
      .catch(() => {
        setUsers([]);
        setIsLoading(false);
      });
  }, []);

  const selectionMode = selectedIds.length > 0;

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(userId => userId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedUsers.map(user => user.id));
    }
  };

  const viewUserDetail = (user: any) => {
    setSelectedUser(user);
    setShowUserDetail(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px]">
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

  const handleSort = (field: "name" | "sessions" | "score" | "joined") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (!sortField) return 0;
    if (sortField === "name") {
      return sortDirection === "asc"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    if (sortField === "sessions") {
      return sortDirection === "asc" ? a.sessions - b.sessions : b.sessions - a.sessions;
    }
    if (sortField === "score") {
      return sortDirection === "asc" ? a.avgScore - b.avgScore : b.avgScore - a.avgScore;
    }
    if (sortField === "joined") {
      return sortDirection === "asc"
        ? new Date(a.joined).getTime() - new Date(b.joined).getTime()
        : new Date(b.joined).getTime() - new Date(a.joined).getTime();
    }
    return 0;
  });

  const filteredUsers = sortedUsers.filter((user) => {
    if (filterStatus !== "all" && user.status !== filterStatus) return false;
    if (filterPlan !== "all" && user.plan.toLowerCase() !== filterPlan.toLowerCase()) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.company.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-users" navigate={navigate}>
      <div className="p-6 space-y-6">
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
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Export CSV</span>
              <span className="lg:hidden">Export</span>
            </Button>
          </div>
        </div>

        {/* KPI Tiles - 2x2 grid on mobile, 4 columns on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                <Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#9333ea' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +12%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Totaal Gebruikers
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {users.length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +8%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Actieve Gebruikers
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {users.filter(u => u.status === "active").length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +3.2%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Gem. Score
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {users.length > 0 ? Math.round(users.reduce((acc, u) => acc + u.avgScore, 0) / users.length) : 0}%
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ocean-blue/10 flex items-center justify-center">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ocean-blue" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +18%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Sessies deze week
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {users.reduce((acc, u) => acc + u.sessions, 0)}
            </p>
          </Card>
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
            
            {/* View Toggle - Right Side */}
            <div className="flex gap-1 sm:ml-auto">
              <Button
                variant="ghost"
                size="sm"
                style={viewMode === "list" ? { backgroundColor: '#9333ea', color: 'white' } : {}}
                className={`${
                  viewMode === "list" 
                    ? "" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                style={viewMode === "grid" ? { backgroundColor: '#9333ea', color: 'white' } : {}}
                className={`${
                  viewMode === "grid" 
                    ? "" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* User List/Grid */}
        {isLoading ? (
          <Card className="p-12 rounded-[16px] shadow-hh-sm border-hh-border text-center">
            <p className="text-[16px] text-hh-muted">Laden...</p>
          </Card>
        ) : viewMode === "list" ? (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th className="text-left py-3 px-4 w-12">
                      {selectionMode && (
                        <CustomCheckbox
                          checked={selectedIds.length === sortedUsers.length && sortedUsers.length > 0}
                          onChange={toggleSelectAll}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        Gebruiker
                        {sortField === "name" &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          ))}
                        {sortField !== "name" && (
                          <ArrowUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                      Rol
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                      Plan
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                      Status
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:bg-hh-ui-100 transition-colors"
                      onClick={() => handleSort("joined")}
                    >
                      <div className="flex items-center gap-2">
                        Aangemaakt
                        {sortField === "joined" &&
                          (sortDirection === "asc" ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          ))}
                        {sortField !== "joined" && (
                          <ArrowUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                      onClick={() => viewUserDetail(user)}
                      onMouseEnter={() => setHoveredRow(user.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="py-3 px-4 w-12" onClick={(e) => e.stopPropagation()}>
                        {(selectionMode || hoveredRow === user.id) ? (
                          <CustomCheckbox
                            checked={selectedIds.includes(user.id)}
                            onChange={() => toggleSelectId(user.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : <div className="w-4 h-4" />}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="text-[13px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }}>
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
                          {user.role}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {user.plan}
                        </p>
                        <p className="text-[12px] leading-[16px] text-hh-muted">
                          {user.planPrice}
                        </p>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(user.status)}</td>
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {user.joined}
                        </p>
                      </td>
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
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card
                key={user.id}
                className="p-5 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-shadow cursor-pointer"
                onClick={() => viewUserDetail(user)}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="text-[14px] font-semibold" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }}>
                      {user.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-hh-text truncate">
                      {user.name}
                    </p>
                    <p className="text-[13px] text-hh-muted truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Role */}
                <p className="text-[13px] text-hh-text mb-3">{user.role}</p>

                {/* Plan & Status */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="text-[11px]" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                    {user.plan} - {user.planPrice}
                  </Badge>
                  {getStatusBadge(user.status)}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-hh-border">
                  <div>
                    <p className="text-[11px] text-hh-muted mb-1">Sessies</p>
                    <p className="text-[15px] text-hh-text font-semibold">{user.sessions}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-hh-muted mb-1">Score</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] text-hh-text font-semibold">{user.avgScore}%</p>
                      {user.scoreDelta > 0 && (
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-0">
                          +{user.scoreDelta}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[12px] text-hh-muted">
                  <span>{user.joined}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); viewUserDetail(user); }}>
                        <Eye className="w-4 h-4 mr-2" />
                        Bekijk Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Edit className="w-4 h-4 mr-2" />
                        Bewerken
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Mail className="w-4 h-4 mr-2" />
                        Email verzenden
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-hh-error">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Verwijderen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
                    <AvatarFallback className="text-white text-[20px]" style={{ backgroundColor: '#9333ea' }}>
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
                      <Badge style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                        {selectedUser.plan} - {selectedUser.planPrice}
                      </Badge>
                      {getStatusBadge(selectedUser.status)}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <Play className="w-5 h-5 mx-auto mb-2" style={{ color: '#9333ea' }} />
                  <p className="text-[24px] leading-[32px] text-hh-ink">
                    {selectedUser.sessions}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Sessies</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                  <p className="text-[24px] leading-[32px] text-hh-ink">
                    {selectedUser.avgScore}%
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Gem Score</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <span className="text-[20px] mx-auto mb-2 block">🔥</span>
                  <p className="text-[24px] leading-[32px] text-hh-ink">
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
                <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-600 hover:bg-red-500/10">
                  <Ban className="w-4 h-4" />
                  Suspend Account
                </Button>
                <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-600 hover:bg-red-500/10">
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