import { useState, useEffect } from "react";
import { getAuthHeaders } from "../../services/hugoApi";
import {
  Users,
  Video,
  Radio,
  Activity,
  CheckCircle,
  UserPlus,
  Clock,
  Play,
  Upload,
  BarChart3,
  Settings,
  Bell,
  AlertCircle,
  MessageSquare,
  Calendar,
  Info,
  Loader2,
  Zap,
  ArrowRight,
  Edit3,
  CheckCircle2,
  Star,
  ThumbsUp,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface AdminDashboardProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

interface DashboardData {
  kpis: {
    activeUsers: { value: number; change: string };
    sessionsToday: { value: number; change: string };
    newSignups: { value: number; change: string };
    aiSessions: { value: number; change: string };
    revenue?: { value: number; change: string; subscriptions?: number };
  };
  recentActivity: Array<{
    id: string;
    type: string;
    user: string;
    action: string;
    detail: string;
    time: string;
  }>;
  notifications: Array<{
    id: number;
    type: string;
    category: string;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    relatedPage: string | null;
  }>;
  actionItems: Array<{
    id: string;
    icon: string;
    label: string;
    page: string;
    priority: string;
  }>;
  coachees: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    sessionCount: number;
    avgScore: number | null;
    lastActive: string;
  }>;
  unreadNotifications: number;
  topContent: Array<{
    id: string;
    type: string;
    title: string;
    views: number;
    fase: string | null;
  }>;
  feedbackStats?: {
    avgSessionRating: number | null;
    npsScore: number | null;
    recentFeedback: Array<{
      id: string;
      type: string;
      rating: number | null;
      comment: string | null;
      date: string;
    }>;
    errorCount: number;
  };
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "session": return CheckCircle;
    case "live": return Radio;
    case "signup": return UserPlus;
    case "video": return Video;
    default: return Activity;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "video": return "var(--hh-primary)";
    case "session": return "#12B981";
    case "live": return "rgb(239, 68, 68)";
    case "signup": return "rgb(37, 99, 235)";
    default: return "var(--hh-primary)";
  }
};

const getNotificationIcon = (type: string, category: string) => {
  if (category === "users") return Users;
  if (category === "sessions") return Calendar;
  if (category === "content") return MessageSquare;
  if (type === "success") return CheckCircle;
  if (type === "warning") return AlertCircle;
  return Info;
};

const getNotificationColors = (type: string) => {
  switch (type) {
    case "success": return { iconColor: "text-hh-success", iconBg: "bg-hh-success-100" };
    case "warning": return { iconColor: "text-hh-warning", iconBg: "bg-hh-warning-100" };
    case "error": return { iconColor: "text-hh-error", iconBg: "bg-hh-error-100" };
    default: return { iconColor: "text-hh-primary", iconBg: "bg-hh-primary-100" };
  }
};

export function AdminDashboard({ navigate, isSuperAdmin }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        const response = await fetch("/api/admin/dashboard-stats", { headers });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.message || `HTTP ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        console.error("[AdminDashboard] Fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const kpiData = data ? [
    {
      label: "Actieve Users",
      value: String(data.kpis.activeUsers.value),
      change: data.kpis.activeUsers.change,
      trend: data.kpis.activeUsers.change.startsWith("+") ? "up" : "down",
      icon: Users,
      color: "var(--hh-primary)",
      bgColor: "var(--hh-primary-100)",
    },
    {
      label: "Sessies Vandaag",
      value: String(data.kpis.sessionsToday.value),
      change: data.kpis.sessionsToday.change,
      trend: data.kpis.sessionsToday.change.startsWith("+") ? "up" : "down",
      icon: Play,
      color: "var(--hh-success)",
      bgColor: "color-mix(in srgb, var(--hh-success) 10%, transparent)",
    },
    {
      label: "Nieuwe Signups",
      value: String(data.kpis.newSignups.value),
      change: data.kpis.newSignups.change,
      trend: data.kpis.newSignups.change.startsWith("+") ? "up" : "down",
      icon: UserPlus,
      color: "#2563eb",
      bgColor: "rgba(37, 99, 235, 0.1)",
    },
    {
      label: "NPS Score",
      value: data.feedbackStats?.npsScore != null ? `${data.feedbackStats.npsScore}/10` : "—",
      change: "+0%",
      trend: "up" as const,
      icon: ThumbsUp,
      color: "var(--hh-success)",
      bgColor: "color-mix(in srgb, var(--hh-success) 10%, transparent)",
    },
  ] : [];

  return (
    <AdminLayout currentPage="admin-dashboard" navigate={navigate} isSuperAdmin={isSuperAdmin}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Platform Overzicht
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Vandaag &bull; {dateStr}
            </p>
          </div>
          <Button variant="outline" className="gap-2 border-hh-primary-200 text-hh-primary hover:bg-hh-primary/5">
            <Clock className="w-4 h-4" />
            Laatste 30 dagen
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-hh-primary" />
            <span className="ml-3 text-hh-muted">Dashboard laden...</span>
          </div>
        ) : error ? (
          <Card className="p-6 rounded-[16px] border-hh-border">
            <div className="flex items-center gap-3 text-hh-error">
              <AlertCircle className="w-5 h-5" />
              <p>Kon dashboard data niet laden: {error}</p>
            </div>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            {isSuperAdmin ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {kpiData.map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <Card key={kpi.label} className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: kpi.bgColor }}>
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: kpi.color }} />
                        </div>
                        <Badge
                          variant="outline"
                          style={kpi.trend === "up" ? { backgroundColor: 'rgba(18, 185, 129, 0.1)', color: '#12B981', borderColor: 'rgba(18, 185, 129, 0.2)' } : undefined}
                          className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 ${
                            kpi.trend !== "up"
                              ? "bg-hh-error-100 text-hh-error-700 border-hh-error-200"
                              : ""
                          }`}
                        >
                          {kpi.change}
                        </Badge>
                      </div>
                      <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
                        {kpi.label}
                      </p>
                      <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px]" style={{ color: 'var(--hh-primary)' }}>
                        {kpi.value}
                      </p>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: "Actieve Video's", icon: Video, color: "var(--hh-primary)", bgColor: "var(--hh-primary-100)", note: "Beheer via Video's" },
                  { label: "Live Webinars", icon: Radio, color: "#2563eb", bgColor: "rgba(37, 99, 235, 0.1)", note: "Beheer via Webinars" },
                  { label: "Coaching Sessies", icon: MessageSquare, color: "#ea580c", bgColor: "rgba(234, 88, 12, 0.1)", note: "Talk to Hugo AI" },
                  { label: "Platform Users", icon: Users, color: "#059669", bgColor: "rgba(5, 150, 105, 0.1)", note: "Ingeschreven gebruikers" },
                ].map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <Card key={kpi.label} className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: kpi.bgColor }}>
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: kpi.color }} />
                        </div>
                      </div>
                      <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
                        {kpi.label}
                      </p>
                      <p className="text-[13px] text-hh-muted italic">{kpi.note}</p>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Action Center + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(() => {
                const iconMap: Record<string, any> = { bell: Bell, edit: Edit3, 'user-plus': UserPlus };
                const unifiedAlerts = [
                  ...(data?.actionItems || []).map(item => ({
                    id: item.id,
                    icon: iconMap[item.icon] || AlertCircle,
                    label: item.label,
                    page: item.page,
                    timestamp: null as string | null,
                  })),
                  ...(data?.notifications || []).map(notif => ({
                    id: String(notif.id),
                    icon: getNotificationIcon(notif.type, notif.category),
                    label: notif.title,
                    page: notif.relatedPage || "admin-notifications",
                    timestamp: notif.timestamp,
                  })),
                ].slice(0, 5);

                return unifiedAlerts.length > 0 ? (
                  <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-hh-primary" />
                      <h3 className="text-[14px] leading-[20px] font-semibold text-hh-text">Aandacht nodig</h3>
                      <Badge variant="outline" className="ml-auto text-[10px] px-2 py-0.5 bg-hh-primary/10 text-hh-primary border-hh-primary/20">
                        {unifiedAlerts.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {unifiedAlerts.map((alert) => {
                        const AlertIcon = alert.icon;
                        return (
                          <div
                            key={alert.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-hh-border hover:border-hh-primary/30 hover:bg-hh-ui-50 transition-colors cursor-pointer"
                            onClick={() => navigate?.(alert.page)}
                          >
                            <AlertIcon className="w-4 h-4 text-hh-primary flex-shrink-0" />
                            <span className="text-[13px] leading-[18px] text-hh-text flex-1">{alert.label}</span>
                            {alert.timestamp && (
                              <span className="text-[11px] text-hh-muted flex-shrink-0">{alert.timestamp}</span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-hh-muted" />
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-hh-success" />
                      <span className="text-[13px] leading-[18px] text-hh-text">Alles up to date — geen openstaande acties</span>
                    </div>
                  </Card>
                );
              })()}

              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Button
                    className="flex-1 justify-start gap-2 h-auto py-3 px-4 bg-hh-primary hover:bg-hh-primary/90 rounded-xl"
                    onClick={() => navigate?.("admin-videos")}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-[14px] leading-[18px] font-medium">Upload Video</p>
                      <p className="text-[11px] leading-[14px] opacity-80">Nieuwe video</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 justify-start gap-2 h-auto py-3 px-4 rounded-xl"
                    onClick={() => navigate?.("admin-live")}
                  >
                    <div className="w-8 h-8 rounded-full bg-hh-error-100 flex items-center justify-center">
                      <Radio className="w-4 h-4 text-hh-error" />
                    </div>
                    <div className="text-left">
                      <p className="text-[14px] leading-[18px] font-medium text-hh-text">Plan Sessie</p>
                      <p className="text-[11px] leading-[14px] text-hh-muted">Live coaching</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 justify-start gap-2 h-auto py-3 px-4 rounded-xl"
                    onClick={() => navigate?.("admin-analytics")}
                  >
                    <div className="w-8 h-8 rounded-full bg-hh-success-100 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-hh-success" />
                    </div>
                    <div className="text-left">
                      <p className="text-[14px] leading-[18px] font-medium text-hh-text">Analytics</p>
                      <p className="text-[11px] leading-[14px] text-hh-muted">Statistieken</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 justify-start gap-2 h-auto py-3 px-4 rounded-xl"
                    onClick={() => navigate?.("admin-users")}
                  >
                    <div className="w-8 h-8 rounded-full bg-hh-primary-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-hh-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-[14px] leading-[18px] font-medium text-hh-text">Gebruikers</p>
                      <p className="text-[11px] leading-[14px] text-hh-muted">Beheren</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 justify-start gap-2 h-auto py-3 px-4 rounded-xl"
                    onClick={() => navigate?.("admin-settings")}
                  >
                    <div className="w-8 h-8 rounded-full bg-hh-slate-gray/10 flex items-center justify-center">
                      <Settings className="w-4 h-4 text-hh-slate-gray" />
                    </div>
                    <div className="text-left">
                      <p className="text-[14px] leading-[18px] font-medium text-hh-text">Settings</p>
                      <p className="text-[11px] leading-[14px] text-hh-muted">Configuratie</p>
                    </div>
                  </Button>
                </div>
              </Card>
            </div>

            {/* Coachees + Notificaties */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coachees Overview */}
              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[18px] leading-[24px] text-hh-text">
                    Coachees
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => navigate?.("admin-users")}>
                    Bekijk allen
                  </Button>
                </div>
                {(data?.coachees || []).length === 0 ? (
                  <p className="text-[14px] text-hh-muted py-4 text-center">Nog geen coachees geregistreerd</p>
                ) : (
                  <div className="space-y-3">
                    {(data?.coachees || []).slice(0, 6).map((coachee) => (
                      <div key={coachee.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-hh-ui-50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-semibold text-hh-primary">
                            {coachee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] leading-[18px] text-hh-text font-medium truncate">{coachee.name}</p>
                          <p className="text-[11px] leading-[14px] text-hh-muted">
                            {coachee.sessionCount} sessie{coachee.sessionCount !== 1 ? 's' : ''}
                            {coachee.avgScore !== null && <> &bull; Gem: {coachee.avgScore}</>}
                          </p>
                        </div>
                        <span className="text-[11px] text-hh-muted whitespace-nowrap">{coachee.lastActive}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
                  Recente Activiteit
                </h3>
                {(data?.recentActivity || []).length === 0 ? (
                  <p className="text-[14px] text-hh-muted py-4 text-center">Nog geen activiteit</p>
                ) : (
                  <div className="space-y-3">
                    {(data?.recentActivity || []).slice(0, 6).map((activity) => {
                      const Icon = getActivityIcon(activity.type);
                      const color = getActivityColor(activity.type);
                      return (
                        <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-hh-ui-50 transition-colors">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
                          >
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] leading-[18px] text-hh-text font-medium truncate">
                              {activity.user}
                            </p>
                            <p className="text-[11px] leading-[14px] text-hh-muted">
                              {activity.action} &bull; {activity.time}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Top Content + Feedback */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[18px] leading-[24px] text-hh-text">
                  Top Performing Content
                </h3>
                <Button variant="outline" size="sm" onClick={() => navigate?.("admin-videos")}>
                  Bekijk alles
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-hh-ui-50 border-b border-hh-border">
                    <tr>
                      <th className="text-left py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">Type</th>
                      <th className="text-left py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">Titel</th>
                      <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">Views</th>
                      <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">Fase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topContent || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[14px] text-hh-muted">
                          Nog geen content data beschikbaar
                        </td>
                      </tr>
                    ) : (
                      (data?.topContent || []).map((content) => (
                        <tr
                          key={content.id}
                          className="border-b border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                          onClick={() => navigate?.("admin-videos")}
                        >
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="text-[11px]">
                              {content.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-[14px] leading-[20px] text-hh-text">
                            {content.title}
                          </td>
                          <td className="py-3 px-2 text-right text-[14px] leading-[20px] text-hh-text">
                            {content.views}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {content.fase ? (
                              <Badge variant="outline" className="text-[11px]">
                                Fase {content.fase}
                              </Badge>
                            ) : (
                              <span className="text-[13px] text-hh-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Feedback & Issues */}
            <Card className="rounded-[16px] border border-hh-border shadow-hh-md p-6">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-hh-primary" />
                Feedback & Issues
              </h3>

              {(data?.feedbackStats?.recentFeedback || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-hh-muted">Recente feedback</p>
                  {data!.feedbackStats!.recentFeedback.map((fb) => (
                    <div key={fb.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-hh-ui-50 transition-colors">
                      <Badge variant="outline" className="text-[11px] flex-shrink-0 mt-0.5">
                        {fb.type === "session_rating" ? "Rating" : fb.type === "bug_report" ? "Bug" : fb.type === "suggestion" ? "Suggestie" : "Feedback"}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-hh-text truncate">
                          {fb.comment || (fb.rating ? `${fb.rating}/5 sterren` : "Geen commentaar")}
                        </p>
                        <p className="text-[11px] text-hh-muted">
                          {new Date(fb.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {fb.rating && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`w-3 h-3 ${s <= fb.rating! ? "text-hh-warning fill-hh-warning" : "text-hh-border"}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] text-hh-muted text-center py-4">
                  Nog geen feedback ontvangen
                </p>
              )}
            </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
