import {
  Building2,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  Download,
  Plus,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Crown,
  CheckCircle2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

interface AdminOrganizationManagementProps {
  navigate?: (page: string) => void;
}

export function AdminOrganizationManagement({ navigate }: AdminOrganizationManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("card", "list");
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [showOrgDetail, setShowOrgDetail] = useState(false);

  const organizations = [
    {
      id: 1,
      name: "TechCorp BV",
      domain: "techcorp.nl",
      plan: "Team",
      planPrice: "€499",
      users: 24,
      activeUsers: 19,
      totalSessions: 347,
      avgScore: 82,
      mrr: 499,
      status: "active",
      joined: "15 sept 2024",
      admin: "Jan de Vries",
      adminEmail: "jan@techcorp.nl",
    },
    {
      id: 2,
      name: "GrowCo",
      domain: "growco.nl",
      plan: "Pro",
      planPrice: "€149",
      users: 5,
      activeUsers: 4,
      totalSessions: 89,
      avgScore: 76,
      mrr: 149,
      status: "active",
      joined: "3 okt 2024",
      admin: "Sarah van Dijk",
      adminEmail: "sarah@growco.nl",
    },
    {
      id: 3,
      name: "StartUp.io",
      domain: "startup.io",
      plan: "Starter",
      planPrice: "€49",
      users: 2,
      activeUsers: 1,
      totalSessions: 23,
      avgScore: 68,
      mrr: 49,
      status: "trial",
      joined: "12 dec 2024",
      admin: "Mark Peters",
      adminEmail: "mark@startup.io",
    },
    {
      id: 4,
      name: "Salesforce EMEA",
      domain: "salesforce.com",
      plan: "Enterprise",
      planPrice: "€2.499",
      users: 127,
      activeUsers: 98,
      totalSessions: 1834,
      avgScore: 88,
      mrr: 2499,
      status: "active",
      joined: "20 sept 2024",
      admin: "Lisa de Jong",
      adminEmail: "lisa@salesforce.com",
    },
    {
      id: 5,
      name: "Example Inc",
      domain: "example.com",
      plan: "Pro",
      planPrice: "€149",
      users: 3,
      activeUsers: 0,
      totalSessions: 8,
      avgScore: 62,
      mrr: 149,
      status: "inactive",
      joined: "5 nov 2024",
      admin: "Tom Bakker",
      adminEmail: "tom@example.com",
    },
  ];

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1 inline" />
    );
  };

  const viewOrgDetail = (org: any) => {
    setSelectedOrg(org);
    setShowOrgDetail(true);
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

  const filteredOrgs = organizations.filter((org) => {
    if (filterStatus !== "all" && org.status !== filterStatus) return false;
    if (filterPlan !== "all" && org.plan.toLowerCase() !== filterPlan) return false;
    if (searchQuery && !org.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <AdminLayout currentPage="admin-organizations" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Organisaties
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer {organizations.length} organisatie accounts
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Export</span>
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">Nieuwe Organisatie</span>
            </Button>
          </div>
        </div>

        {/* KPI Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#9333ea' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +8%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Totaal Organisaties
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {organizations.length}
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
                +5%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Actieve Organisaties
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {organizations.filter(o => o.status === "active").length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
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
              {organizations.reduce((acc, o) => acc + o.users, 0)}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +15%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Total MRR
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              €{organizations.reduce((acc, o) => acc + o.mrr, 0).toLocaleString()}
            </p>
          </Card>
        </div>

        {/* Search, View Toggle & Filters Card */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="space-y-3">
            {/* Search + View Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
                <Input
                  placeholder="Zoek organisaties..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
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
                  style={viewMode === "card" ? { backgroundColor: '#9333ea', color: 'white' } : {}}
                  className={`${
                    viewMode === "card" 
                      ? "" 
                      : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                  }`}
                  onClick={() => setViewMode("card")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="active">Actief</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="inactive">Inactief</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Plans</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* List View - Table */}
        {viewMode === "list" && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer" onClick={() => handleSort("name")}>
                      Organisatie {getSortIcon("name")}
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer" onClick={() => handleSort("plan")}>
                      Plan {getSortIcon("plan")}
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer" onClick={() => handleSort("users")}>
                      Gebruikers {getSortIcon("users")}
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer" onClick={() => handleSort("sessions")}>
                      Sessies {getSortIcon("sessions")}
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer" onClick={() => handleSort("mrr")}>
                      MRR {getSortIcon("mrr")}
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map((org) => (
                    <tr
                      key={org.id}
                      className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                      onClick={() => viewOrgDetail(org)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }} className="text-[13px]">
                              {org.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                              {org.name}
                            </p>
                            <p className="text-[12px] leading-[16px] text-hh-muted">
                              {org.domain}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {org.plan === "Enterprise" && (
                            <Crown className="w-3.5 h-3.5 text-hh-warn" />
                          )}
                          <div>
                            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                              {org.plan}
                            </p>
                            <p className="text-[12px] leading-[16px] text-hh-muted">
                              {org.planPrice}/mnd
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="text-[14px] leading-[20px] text-hh-text">
                          {org.users}
                        </p>
                        <p className="text-[12px] leading-[16px] text-hh-muted">
                          {org.activeUsers} actief
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                        {org.totalSessions}
                      </td>
                      <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-emerald-500 font-medium">
                        €{org.mrr}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(org.status)}</td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => viewOrgDetail(org)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
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
          </Card>
        )}

        {/* Card View - Grid */}
        {viewMode === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrgs.map((org) => (
              <Card key={org.id} className="p-4 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-shadow cursor-pointer" onClick={() => viewOrgDetail(org)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea' }} className="text-[16px]">
                        {org.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[16px] leading-[22px] text-hh-text font-medium">
                        {org.name}
                      </p>
                      <p className="text-[13px] leading-[18px] text-hh-muted">
                        {org.domain}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(org.status)}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">Plan:</span>
                    <span className="text-hh-text font-medium flex items-center gap-1">
                      {org.plan === "Enterprise" && <Crown className="w-3.5 h-3.5 text-hh-warn" />}
                      {org.plan}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">Gebruikers:</span>
                    <span className="text-hh-text font-medium">{org.users} ({org.activeUsers} actief)</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">Sessies:</span>
                    <span className="text-hh-text font-medium">{org.totalSessions}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">MRR:</span>
                    <span className="text-emerald-500 font-medium">€{org.mrr}/mnd</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-hh-border">
                  <div className="flex items-center gap-2 text-[12px] leading-[16px] text-hh-muted">
                    <span>Admin: {org.admin}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Organization Detail Modal */}
      <Dialog open={showOrgDetail} onOpenChange={setShowOrgDetail}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedOrg?.name || "Organisatie Details"}</DialogTitle>
            <DialogDescription>
              {selectedOrg?.domain || "Organisatie informatie"}
            </DialogDescription>
          </DialogHeader>

          {selectedOrg && (
            <div className="space-y-6">
              {/* Profile Card */}
              <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback style={{ backgroundColor: '#9333ea', color: 'white' }} className="text-[20px]">
                      {selectedOrg.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-[20px] leading-[28px] text-hh-text font-medium mb-1">
                      {selectedOrg.name}
                    </h3>
                    <p className="text-[14px] leading-[20px] text-hh-muted mb-2">
                      {selectedOrg.domain}
                    </p>
                    <div className="flex items-center gap-4 text-[13px] leading-[18px] text-hh-muted">
                      <span>Admin: {selectedOrg.admin}</span>
                      <span>•</span>
                      <span>{selectedOrg.adminEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                        {selectedOrg.plan} - {selectedOrg.planPrice}
                      </Badge>
                      {getStatusBadge(selectedOrg.status)}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <Users className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                  <p className="text-[24px] leading-[32px] text-hh-ink">
                    {selectedOrg.users}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Gebruikers</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                  <p className="text-[24px] leading-[32px] text-hh-ink">
                    {selectedOrg.activeUsers}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Actief</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <TrendingUp className="w-5 h-5" style={{ color: '#9333ea' }} />
                  <p className="text-[24px] leading-[32px] text-hh-ink">
                    {selectedOrg.totalSessions}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">Sessies</p>
                </Card>
                <Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border text-center">
                  <DollarSign className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                  <p className="text-[24px] leading-[32px] text-hh-ink">
                    €{selectedOrg.mrr}
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">MRR</p>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button className="flex-1 gap-2">
                  <Eye className="w-4 h-4" />
                  Bekijk Gebruikers
                </Button>
                <Button variant="outline" className="flex-1 gap-2">
                  <Edit className="w-4 h-4" />
                  Bewerk
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
