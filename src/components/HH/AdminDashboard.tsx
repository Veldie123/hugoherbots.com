import { useState, useEffect } from "react";
import {
  Users,
  TrendingUp,
  Video,
  Radio,
  DollarSign,
  Activity,
  CheckCircle,
  UserPlus,
  Eye,
  Target,
  Award,
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
    revenue: { value: number; change: string; subscriptions: number };
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
  unreadNotifications: number;
  topContent: Array<{
    id: string;
    type: string;
    title: string;
    views: number;
    fase: string | null;
  }>;
}

const formatRevenue = (amount: number): string => {
  if (amount >= 1000) {
    return `€${(amount / 1000).toFixed(1)}k`;
  }
  return `€${amount.toFixed(0)}`;
};

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
    case "video": return "#9333ea";
    case "session": return "#12B981";
    case "live": return "rgb(239, 68, 68)";
    case "signup": return "rgb(37, 99, 235)";
    default: return "#9333ea";
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
    case "success": return { iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" };
    case "warning": return { iconColor: "text-orange-600", iconBg: "bg-orange-100 dark:bg-orange-500/10" };
    case "error": return { iconColor: "text-red-500", iconBg: "bg-red-500/10" };
    default: return { iconColor: "text-blue-600", iconBg: "bg-blue-100 dark:bg-blue-500/10" };
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
        const response = await fetch("/api/admin/dashboard-stats");
        if (!response.ok) throw new Error("Failed to fetch dashboard data");
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
      color: "#9333ea",
      bgColor: "rgba(147, 51, 234, 0.1)",
    },
    {
      label: "Sessies Vandaag",
      value: String(data.kpis.sessionsToday.value),
      change: data.kpis.sessionsToday.change,
      trend: data.kpis.sessionsToday.change.startsWith("+") ? "up" : "down",
      icon: Play,
      color: "#12B981",
      bgColor: "rgba(18, 185, 129, 0.1)",
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
      label: "Revenue Deze Mnd",
      value: formatRevenue(data.kpis.revenue.value),
      change: data.kpis.revenue.change,
      trend: data.kpis.revenue.change.startsWith("+") ? "up" : "down",
      icon: DollarSign,
      color: "#f97316",
      bgColor: "rgba(249, 115, 22, 0.1)",
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
          <Button variant="outline" className="gap-2 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20">
            <Clock className="w-4 h-4" />
            Laatste 30 dagen
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <span className="ml-3 text-hh-muted">Dashboard laden...</span>
          </div>
        ) : error ? (
          <Card className="p-6 rounded-[16px] border-hh-border">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <p>Kon dashboard data niet laden: {error}</p>
            </div>
          </Card>
        ) : (
          <>
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
                              ? "bg-hh-error/10 text-hh-error border-hh-error/20"
                              : ""
                          }`}
                        >
                          {kpi.change}
                        </Badge>
                      </div>
                      <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
                        {kpi.label}
                      </p>
                      <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px]" style={{ color: '#7c3aed' }}>
                        {kpi.value}
                      </p>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: "Actieve Video's", icon: Video, color: "#9333ea", bgColor: "rgba(147, 51, 234, 0.1)", note: "Beheer via Video's" },
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
                  Recent Activity
                </h3>
                <div className="space-y-4">
                  {(data?.recentActivity || []).length === 0 ? (
                    <p className="text-[14px] text-hh-muted py-4 text-center">Nog geen recente activiteit</p>
                  ) : (
                    (data?.recentActivity || []).slice(0, 5).map((activity) => {
                      const Icon = getActivityIcon(activity.type);
                      return (
                        <div key={activity.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-hh-ui-50 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4" style={{ color: getActivityColor(activity.type) }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] leading-[20px] text-hh-text">
                              <span className="font-medium">{activity.user}</span>{" "}
                              {activity.action}
                            </p>
                            <p className="text-[13px] leading-[18px] text-hh-muted truncate">
                              {activity.detail}
                            </p>
                            <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
                              {activity.time}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate?.("admin-analytics")}>
                  Bekijk alle activiteit
                </Button>
              </Card>

              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[18px] leading-[24px] text-hh-text">
                    Notificaties
                  </h3>
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                    {data?.unreadNotifications || 0} nieuw
                  </Badge>
                </div>
                <div className="space-y-3">
                  {(data?.notifications || []).length === 0 ? (
                    <p className="text-[14px] text-hh-muted py-4 text-center">Geen notificaties</p>
                  ) : (
                    (data?.notifications || []).slice(0, 3).map((notif) => {
                      const Icon = getNotificationIcon(notif.type, notif.category);
                      const colors = getNotificationColors(notif.type);
                      return (
                        <div
                          key={notif.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors cursor-pointer"
                          onClick={() => navigate?.(notif.relatedPage || "admin-notifications")}
                        >
                          <div className={`w-10 h-10 rounded-full ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${colors.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] leading-[20px] text-hh-ink font-medium">
                              {notif.title}
                            </p>
                            <p className="text-[13px] leading-[18px] text-hh-muted truncate">
                              {notif.message}
                            </p>
                            <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
                              {notif.timestamp}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4 gap-2"
                  onClick={() => navigate?.("admin-notifications")}
                >
                  <Bell className="w-4 h-4" />
                  Alle notificaties
                </Button>
              </Card>
            </div>

            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Button
                  className="flex-1 justify-start gap-2 h-auto py-3 px-4 bg-red-600 hover:bg-red-700 rounded-xl"
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
                  <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center">
                    <Radio className="w-4 h-4 text-red-600" />
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
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
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
                  <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
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
          </>
        )}
      </div>
    </AdminLayout>
  );
}
