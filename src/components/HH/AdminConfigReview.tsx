import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  MoreVertical,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Database,
} from "lucide-react";
import { getCodeBadgeColors } from "../../utils/phaseColors";
import { toast } from "sonner";

interface AdminConfigReviewProps {
  navigate?: (page: string) => void;
}

interface ConfigConflict {
  id: string;
  techniqueNumber: string;
  techniqueName: string;
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  status: "pending" | "approved" | "rejected";
  detectedAt: string;
  context?: string;
  originalValue?: string;
  newValue?: string;
}

export function AdminConfigReview({ navigate }: AdminConfigReviewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conflicts, setConflicts] = useState<ConfigConflict[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCorrections();
  }, []);

  const fetchCorrections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v2/admin/corrections');
      if (response.ok) {
        const data = await response.json();
        const mapped = (data.corrections || []).map((c: any) => {
          const typeMap: Record<string, string> = {
            'signal': 'Signaal Correctie',
            'technique': 'Techniek Correctie',
            'coach_debrief': 'Debrief Correctie',
            'moment': 'Moment Correctie',
          };
          const severity = c.type === 'signal' ? 'HIGH' : c.type === 'technique' ? 'MEDIUM' : 'LOW';
          const techNum = c.field?.match(/\d+\.\d+/)?.[0] || c.type?.charAt(0)?.toUpperCase() || '—';
          const timeAgo = getTimeAgo(new Date(c.created_at));
          return {
            id: String(c.id),
            techniqueNumber: techNum,
            techniqueName: c.field || c.type,
            type: typeMap[c.type] || c.type,
            severity,
            description: c.context || `${c.original_value} → ${c.new_value}`,
            status: c.status,
            detectedAt: timeAgo,
            context: c.context,
            originalValue: c.original_value,
            newValue: c.new_value,
          };
        });
        setConflicts(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch corrections:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m geleden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}u geleden`;
    const days = Math.floor(hours / 24);
    return `${days}d geleden`;
  };

  const filteredConflicts = conflicts.filter((conflict) => {
    const matchesSearch =
      conflict.techniqueName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conflict.techniqueNumber.includes(searchQuery) ||
      conflict.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === "all" || conflict.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || conflict.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const pendingCount = conflicts.filter((c) => c.status === "pending").length;
  const approvedCount = conflicts.filter((c) => c.status === "approved").length;
  const rejectedCount = conflicts.filter((c) => c.status === "rejected").length;

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/v2/admin/corrections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', reviewedBy: 'superadmin' }),
      });
      if (response.ok) {
        const data = await response.json();
        setConflicts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "approved" as const } : c))
        );
        toast.success(`Correctie goedgekeurd`, {
          description: data.ragGenerated ? 'RAG fragment aangemaakt voor toekomstige analyses' : 'Correctie opgeslagen',
        });
      }
    } catch (err) {
      toast.error('Fout bij goedkeuren');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/v2/admin/corrections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reviewedBy: 'superadmin' }),
      });
      if (response.ok) {
        setConflicts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "rejected" as const } : c))
        );
        toast.error(`Correctie afgewezen`);
      }
    } catch (err) {
      toast.error('Fout bij afwijzen');
    }
  };

  const handleResetStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/v2/admin/corrections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', reviewedBy: null }),
      });
      if (response.ok) {
        setConflicts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "pending" as const } : c))
        );
        toast.info(`Status gereset`);
      }
    } catch (err) {
      toast.error('Fout bij resetten');
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return (
          <Badge className="bg-red-600 text-white border-0 text-[10px] px-2 py-0.5">
            HIGH
          </Badge>
        );
      case "MEDIUM":
        return (
          <Badge className="bg-orange-500 text-white border-0 text-[10px] px-2 py-0.5">
            MEDIUM
          </Badge>
        );
      case "LOW":
        return (
          <Badge className="bg-blue-500 text-white border-0 text-[10px] px-2 py-0.5">
            LOW
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
            pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="text-[11px] bg-green-50 text-green-700 border-green-200">
            approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200">
            rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge variant="outline" className="text-[11px] bg-slate-50 text-slate-600 border-slate-200">
        {type}
      </Badge>
    );
  };

  return (
    <AdminLayout currentPage="admin-config-review" navigate={navigate}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-[32px] leading-[40px] font-bold text-hh-ink mb-2">
            Config Review
          </h1>
          <p className="text-[16px] leading-[24px] text-hh-muted">
            Review en goedkeur AI correcties en configuratie conflicten
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Pending</p>
            <p className="text-[28px] font-semibold text-hh-ink">{pendingCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Approved</p>
            <p className="text-[28px] font-semibold text-hh-ink">{approvedCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Rejected</p>
            <p className="text-[28px] font-semibold text-hh-ink">{rejectedCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-3">
              <LayoutGrid className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Totaal</p>
            <p className="text-[28px] font-semibold text-hh-ink">{conflicts.length}</p>
          </Card>
        </div>

        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek technieken, types, beschrijving..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Alle Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Severity</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hh-border bg-slate-50/50">
                  <th className="text-left p-4 text-[13px] font-medium text-hh-muted">
                    Techniek
                  </th>
                  <th className="text-left p-4 text-[13px] font-medium text-hh-muted">
                    Type
                  </th>
                  <th className="text-left p-4 text-[13px] font-medium text-hh-muted">
                    Severity
                  </th>
                  <th className="text-left p-4 text-[13px] font-medium text-hh-muted">
                    Beschrijving
                  </th>
                  <th className="text-left p-4 text-[13px] font-medium text-hh-muted">
                    Status
                  </th>
                  <th className="text-left p-4 text-[13px] font-medium text-hh-muted">
                    Gedetecteerd
                  </th>
                  <th className="text-left p-4 text-[13px] font-medium text-hh-muted">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                    <p className="text-[13px] text-hh-muted">Correcties laden...</p>
                  </td></tr>
                )}
                {!loading && filteredConflicts.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center">
                    <Database className="w-8 h-8 mx-auto text-hh-muted/50 mb-2" />
                    <p className="text-[14px] font-medium text-hh-text mb-1">Geen correcties gevonden</p>
                    <p className="text-[13px] text-hh-muted">Correcties verschijnen hier wanneer een admin feedback geeft op AI-aanduidingen in het transcript.</p>
                  </td></tr>
                )}
                {filteredConflicts.map((conflict) => {
                  const badgeColors = getCodeBadgeColors(conflict.techniqueNumber);
                  return (
                    <tr
                      key={conflict.id}
                      className="border-b border-hh-border last:border-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-[12px] font-semibold ${badgeColors}`}
                          >
                            {conflict.techniqueNumber}
                          </div>
                          <span className="text-[14px] font-medium text-hh-ink">
                            {conflict.techniqueName}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">{getTypeBadge(conflict.type)}</td>
                      <td className="p-4">{getSeverityBadge(conflict.severity)}</td>
                      <td className="p-4">
                        <p className="text-[13px] text-hh-text max-w-[300px]">
                          {conflict.description}
                        </p>
                      </td>
                      <td className="p-4">{getStatusBadge(conflict.status)}</td>
                      <td className="p-4">
                        <span className="text-[13px] text-hh-muted">
                          {conflict.detectedAt}
                        </span>
                      </td>
                      <td className="p-4">
                        {conflict.status === "pending" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
                              onClick={() => handleApprove(conflict.id)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleReject(conflict.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Bekijk details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetStatus(conflict.id)}>
                                Reset status
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
