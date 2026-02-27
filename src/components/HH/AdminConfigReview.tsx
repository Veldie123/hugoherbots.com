import React, { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
import { TrackChange } from "./TrackChange";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getCodeBadgeColors } from "../../utils/phaseColors";
import { toast } from "sonner";

interface AdminConfigReviewProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

interface ConfigConflict {
  id: string;
  techniqueNumber: string;
  techniqueName: string;
  type: string;
  source: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "ACTION";
  description: string;
  status: "pending" | "approved" | "rejected";
  detectedAt: string;
  context?: string;
  originalValue?: string;
  newValue?: string;
  originalJson?: any;
  newJson?: any;
  submittedBy?: string;
  targetFile?: string;
  targetKey?: string;
}

export function AdminConfigReview({ navigate, isSuperAdmin }: AdminConfigReviewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [conflicts, setConflicts] = useState<ConfigConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            'technique_edit': 'SSOT Techniek Bewerking',
            'video_edit': 'Video Bewerking',
            'chat_correction': 'Chat Correctie',
            'chat_feedback': 'Chat Feedback',
            'ssot_edit': 'SSOT Bewerking',
            'coach_debrief': 'Debrief Correctie',
            'moment': 'Moment Correctie',
          };
          const sourceOrType = c.source || c.type;
          const isGeneralFeedback = c.field === 'general_feedback';
          const severity = ['technique_edit', 'ssot_edit'].includes(sourceOrType)
            ? 'HIGH'
            : sourceOrType === 'video_edit'
              ? 'MEDIUM'
              : isGeneralFeedback
                ? 'ACTION'
                : 'LOW';
          const techNum = c.field?.match(/\d+\.\d+/)?.[0] || c.type?.charAt(0)?.toUpperCase() || '—';
          const timeAgo = getTimeAgo(new Date(c.created_at));

          let originalJson = null;
          let newJson = null;
          try {
            if (c.original_json) originalJson = typeof c.original_json === 'string' ? JSON.parse(c.original_json) : c.original_json;
          } catch {}
          try {
            if (c.new_json) newJson = typeof c.new_json === 'string' ? JSON.parse(c.new_json) : c.new_json;
          } catch {}

          return {
            id: String(c.id),
            techniqueNumber: techNum,
            techniqueName: c.field || c.type,
            type: typeMap[sourceOrType] || typeMap[c.type] || sourceOrType,
            source: c.source || c.type || '',
            severity,
            description: c.context || `${c.original_value} → ${c.new_value}`,
            status: c.status,
            detectedAt: timeAgo,
            context: c.context,
            originalValue: c.original_value,
            newValue: c.new_value,
            originalJson,
            newJson,
            submittedBy: c.submitted_by || c.reviewed_by || undefined,
            targetFile: c.target_file || undefined,
            targetKey: c.target_key || undefined,
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
    const matchesSource = sourceFilter === "all" || conflict.source === sourceFilter;
    return matchesSearch && matchesSeverity && matchesStatus && matchesSource;
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
      case "ACTION":
        return (
          <Badge className="bg-purple-600 text-white border-0 text-[10px] px-2 py-0.5">
            ACTIE
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
          <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/20">
            pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="text-[11px] bg-green-500/10 text-green-600 border-green-500/20">
            approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20">
            rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge variant="outline" className="text-[11px] bg-hh-ui-50 text-hh-muted border-hh-border">
        {type}
      </Badge>
    );
  };

  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-config-review" navigate={navigate}>
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
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Pending</p>
            <p className="text-[28px] font-semibold text-hh-ink">{pendingCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Approved</p>
            <p className="text-[28px] font-semibold text-hh-ink">{approvedCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Rejected</p>
            <p className="text-[28px] font-semibold text-hh-ink">{rejectedCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
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
                <SelectItem value="ACTION">Actie vereist</SelectItem>
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

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Alle Bronnen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Bronnen</SelectItem>
                <SelectItem value="technique_edit">Techniek Bewerking</SelectItem>
                <SelectItem value="video_edit">Video Bewerking</SelectItem>
                <SelectItem value="chat_feedback">Chat Feedback</SelectItem>
                <SelectItem value="chat_correction">Chat Correctie</SelectItem>
                <SelectItem value="analysis_correction">Analyse Correctie</SelectItem>
                <SelectItem value="ssot_edit">SSOT Bewerking</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div className="space-y-3 md:hidden">
          {loading && (
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
              <p className="text-[13px] text-hh-muted">Correcties laden...</p>
            </Card>
          )}
          {!loading && filteredConflicts.length === 0 && (
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border text-center">
              <Database className="w-8 h-8 mx-auto text-hh-muted/50 mb-2" />
              <p className="text-[14px] font-medium text-hh-text mb-1">Geen correcties gevonden</p>
              <p className="text-[13px] text-hh-muted">Correcties verschijnen hier wanneer een admin feedback geeft op AI-aanduidingen in het transcript.</p>
            </Card>
          )}
          {!loading && filteredConflicts.map((conflict) => {
            const badgeColors = getCodeBadgeColors(conflict.techniqueNumber);
            const isExpanded = expandedId === conflict.id;
            const hasDiff = conflict.originalJson && conflict.newJson;
            return (
              <Card
                key={conflict.id}
                className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden"
              >
                <div
                  className={`p-4 space-y-3 ${hasDiff ? 'cursor-pointer' : ''}`}
                  onClick={() => hasDiff && setExpandedId(isExpanded ? null : conflict.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0 ${badgeColors}`}
                    >
                      {conflict.techniqueNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-hh-ink truncate">
                          {conflict.techniqueName}
                        </span>
                        {hasDiff && (
                          isExpanded
                            ? <ChevronUp className="w-4 h-4 text-hh-muted shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-hh-muted shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {getTypeBadge(conflict.type)}
                        {getSeverityBadge(conflict.severity)}
                        {getStatusBadge(conflict.status)}
                      </div>
                    </div>
                  </div>

                  <div>
                    {conflict.severity === 'ACTION' && conflict.status === 'pending' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-[11px] font-medium text-purple-600">
                          Actie vereist — vrije feedback
                        </span>
                      </div>
                    )}
                    {conflict.originalValue || conflict.newValue ? (
                      <TrackChange
                        original={conflict.originalValue}
                        proposed={conflict.newValue}
                        label={conflict.techniqueName}
                        compact
                      />
                    ) : (
                      <p className="text-[13px] text-hh-text line-clamp-3">
                        {conflict.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-hh-border">
                    <div className="flex items-center gap-3 text-[12px] text-hh-muted">
                      <span>{conflict.detectedAt}</span>
                      {conflict.submittedBy && <span>door {conflict.submittedBy}</span>}
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {conflict.status === "pending" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600"
                            onClick={() => handleApprove(conflict.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600"
                            onClick={() => handleReject(conflict.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
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
                    </div>
                  </div>
                </div>

                {isExpanded && conflict.originalJson && conflict.newJson && (
                  <div className="p-4 bg-hh-ui-50 border-t border-hh-border space-y-3">
                    <div>
                      <p className="text-[12px] font-medium text-red-600 mb-2">Origineel</p>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-1 text-[13px]">
                        {Object.keys(conflict.newJson).filter(key =>
                          JSON.stringify(conflict.originalJson![key]) !== JSON.stringify(conflict.newJson![key])
                        ).map(key => (
                          <div key={key}>
                            <span className="font-medium text-hh-muted">{key}:</span>
                            <span className="ml-2 text-red-700 dark:text-red-400 break-all">
                              {typeof conflict.originalJson![key] === 'object'
                                ? JSON.stringify(conflict.originalJson![key], null, 2)
                                : String(conflict.originalJson![key] || '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-green-600 mb-2">Voorgesteld</p>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-1 text-[13px]">
                        {Object.keys(conflict.newJson).filter(key =>
                          JSON.stringify(conflict.originalJson![key]) !== JSON.stringify(conflict.newJson![key])
                        ).map(key => (
                          <div key={key}>
                            <span className="font-medium text-hh-muted">{key}:</span>
                            <span className="ml-2 text-green-700 dark:text-green-400 break-all">
                              {typeof conflict.newJson![key] === 'object'
                                ? JSON.stringify(conflict.newJson![key], null, 2)
                                : String(conflict.newJson![key] || '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-hh-muted">
                      Ingediend door: {conflict.submittedBy || 'admin'} | Target: {conflict.targetFile || '—'} → {conflict.targetKey || '—'}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Techniek
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Type
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Severity
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Beschrijving
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Status
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Gedetecteerd
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Ingediend door
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                    <p className="text-[13px] text-hh-muted">Correcties laden...</p>
                  </td></tr>
                )}
                {!loading && filteredConflicts.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center">
                    <Database className="w-8 h-8 mx-auto text-hh-muted/50 mb-2" />
                    <p className="text-[14px] font-medium text-hh-text mb-1">Geen correcties gevonden</p>
                    <p className="text-[13px] text-hh-muted">Correcties verschijnen hier wanneer een admin feedback geeft op AI-aanduidingen in het transcript.</p>
                  </td></tr>
                )}
                {filteredConflicts.map((conflict) => {
                  const badgeColors = getCodeBadgeColors(conflict.techniqueNumber);
                  const isExpanded = expandedId === conflict.id;
                  const hasDiff = conflict.originalJson && conflict.newJson;
                  return (
                    <React.Fragment key={conflict.id}>
                      <tr
                        className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50 transition-colors ${hasDiff ? 'cursor-pointer' : ''}`}
                        onClick={() => hasDiff && setExpandedId(isExpanded ? null : conflict.id)}
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
                            {hasDiff && (
                              isExpanded
                                ? <ChevronUp className="w-4 h-4 text-hh-muted ml-1" />
                                : <ChevronDown className="w-4 h-4 text-hh-muted ml-1" />
                            )}
                          </div>
                        </td>
                        <td className="p-4">{getTypeBadge(conflict.type)}</td>
                        <td className="p-4">{getSeverityBadge(conflict.severity)}</td>
                        <td className="p-4">
                          <div className="max-w-[300px]">
                            {conflict.severity === 'ACTION' && conflict.status === 'pending' && (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                <span className="text-[11px] font-medium text-purple-600">
                                  Actie vereist — vrije feedback, geen automatische verwerking
                                </span>
                              </div>
                            )}
                            {conflict.originalValue || conflict.newValue ? (
                              <TrackChange
                                original={conflict.originalValue}
                                proposed={conflict.newValue}
                                label={conflict.techniqueName}
                                compact
                              />
                            ) : (
                              <p className="text-[13px] text-hh-text">
                                {conflict.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-4">{getStatusBadge(conflict.status)}</td>
                        <td className="p-4">
                          <span className="text-[13px] text-hh-muted">
                            {conflict.detectedAt}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-[13px] text-hh-muted">
                            {conflict.submittedBy || '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          {conflict.status === "pending" ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600"
                                onClick={() => handleApprove(conflict.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600"
                                onClick={() => handleReject(conflict.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div onClick={(e) => e.stopPropagation()}>
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
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && conflict.originalJson && conflict.newJson && (
                        <tr>
                          <td colSpan={8} className="p-4 bg-hh-ui-50">
                            <div className="grid grid-cols-2 gap-4 max-w-4xl">
                              <div>
                                <p className="text-[12px] font-medium text-red-600 mb-2">Origineel</p>
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-1 text-[13px]">
                                  {Object.keys(conflict.newJson).filter(key =>
                                    JSON.stringify(conflict.originalJson[key]) !== JSON.stringify(conflict.newJson[key])
                                  ).map(key => (
                                    <div key={key}>
                                      <span className="font-medium text-hh-muted">{key}:</span>
                                      <span className="ml-2 text-red-700 dark:text-red-400">
                                        {typeof conflict.originalJson[key] === 'object'
                                          ? JSON.stringify(conflict.originalJson[key], null, 2)
                                          : String(conflict.originalJson[key] || '—')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[12px] font-medium text-green-600 mb-2">Voorgesteld</p>
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-1 text-[13px]">
                                  {Object.keys(conflict.newJson).filter(key =>
                                    JSON.stringify(conflict.originalJson[key]) !== JSON.stringify(conflict.newJson[key])
                                  ).map(key => (
                                    <div key={key}>
                                      <span className="font-medium text-hh-muted">{key}:</span>
                                      <span className="ml-2 text-green-700 dark:text-green-400">
                                        {typeof conflict.newJson[key] === 'object'
                                          ? JSON.stringify(conflict.newJson[key], null, 2)
                                          : String(conflict.newJson[key] || '—')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] text-hh-muted mt-2">
                              Ingediend door: {conflict.submittedBy || 'admin'} | Target: {conflict.targetFile || '—'} → {conflict.targetKey || '—'}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
