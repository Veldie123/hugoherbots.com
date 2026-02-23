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
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ProgressBar } from "./ProgressBar";
import { getTechniekByNummer } from "../../data/technieken-service";

interface AdminDashboardProps {
  navigate?: (page: string) => void;
}

export function AdminDashboard({ navigate }: AdminDashboardProps) {
  const kpiData = [
    {
      label: "Actieve Users",
      value: "847",
      change: "+12%",
      trend: "up",
      icon: Users,
      color: "#9333ea",
      bgColor: "rgba(147, 51, 234, 0.1)",
    },
    {
      label: "Sessies Vandaag",
      value: "234",
      change: "+8%",
      trend: "up",
      icon: Play,
      color: "#12B981",
      bgColor: "rgba(18, 185, 129, 0.1)",
    },
    {
      label: "Nieuwe Signups",
      value: "23",
      change: "+15%",
      trend: "up",
      icon: UserPlus,
      color: "#2563eb",
      bgColor: "rgba(37, 99, 235, 0.1)",
    },
    {
      label: "Revenue Deze Mnd",
      value: "€12.5k",
      change: "+18%",
      trend: "up",
      icon: DollarSign,
      color: "#f97316",
      bgColor: "rgba(249, 115, 22, 0.1)",
    },
  ];

  const recentActivity = [
    {
      id: 1,
      type: "session",
      user: "Jan de Vries",
      action: "voltooide sessie",
      detail: "SPIN Questioning",
      time: "5 min geleden",
      icon: CheckCircle,
      color: "#12B981",
    },
    {
      id: 2,
      type: "live",
      user: "Sarah van Dijk",
      action: "startte live sessie",
      detail: "Discovery Technieken Q&A",
      time: "12 min geleden",
      icon: Radio,
      color: "text-red-600",
    },
    {
      id: 3,
      type: "signup",
      user: "Mark Peters",
      action: "nieuwe gebruiker",
      detail: "Pro plan",
      time: "23 min geleden",
      icon: UserPlus,
      color: "text-blue-600",
    },
    {
      id: 4,
      type: "video",
      user: "Lisa de Jong",
      action: "bekeek video",
      detail: "E.P.I.C Questioning Technique",
      time: "35 min geleden",
      icon: Video,
      color: "#9333ea",
    },
    {
      id: 5,
      type: "session",
      user: "Tom Bakker",
      action: "voltooide sessie",
      detail: "Objection Handling",
      time: "1 uur geleden",
      icon: CheckCircle,
      color: "#12B981",
    },
  ];

  const topContent = [
    {
      id: 1,
      type: "Video",
      title: "SPIN Questioning Technique",
      views: 847,
      completion: 92,
      rating: 4.8,
    },
    {
      id: 2,
      type: "Scenario",
      title: "SaaS Discovery Call",
      views: 423,
      completion: 88,
      rating: 4.6,
    },
    {
      id: 3,
      type: "Video",
      title: "E.P.I.C Framework Deep Dive",
      views: 389,
      completion: 85,
      rating: 4.9,
    },
    {
      id: 4,
      type: "Live",
      title: "Objection Handling Masterclass",
      views: 234,
      completion: 78,
      rating: 4.7,
    },
    {
      id: 5,
      type: "Scenario",
      title: "Cold Calling Roleplay",
      views: 198,
      completion: 82,
      rating: 4.5,
    },
  ];

  const recentNotifications = [
    {
      id: 1,
      type: "success",
      category: "users",
      title: "Nieuwe gebruiker geregistreerd",
      message: "Jan de Vries heeft zich aangemeld voor het Pro abonnement",
      timestamp: "2 min geleden",
      icon: Users,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
    },
    {
      id: 2,
      type: "warning",
      category: "sessions",
      title: "Live sessie start binnenkort",
      message: "Discovery Technieken Q&A begint over 15 minuten",
      timestamp: "15 min geleden",
      icon: Calendar,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
    },
    {
      id: 3,
      type: "info",
      category: "content",
      title: "Nieuwe feedback ontvangen",
      message: "5 nieuwe reviews voor SPIN Questioning Workshop",
      timestamp: "1 uur geleden",
      icon: MessageSquare,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
    {
      id: 4,
      type: "success",
      category: "system",
      title: "Database backup voltooid",
      message: "Automatische backup succesvol afgerond",
      timestamp: "2 uur geleden",
      icon: CheckCircle,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
    },
  ];

  return (
    <AdminLayout currentPage="admin-dashboard" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Platform Overzicht
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Vandaag • 15 januari 2025
            </p>
          </div>
          <Button variant="outline" className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50">
            <Clock className="w-4 h-4" />
            Laatste 30 dagen
          </Button>
        </div>

        {/* KPI Tiles - 2x2 grid on mobile, 4 columns on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center`} style={{ backgroundColor: kpi.bgColor }}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5`} style={{ color: kpi.color }} />
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
                <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
                  {kpi.value}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity Feed */}
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
              Recent Activity
            </h3>
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const Icon = activity.icon;
                const getActivityColor = (type: string) => {
                  switch(type) {
                    case "video":
                      return "#9333ea";
                    case "session":
                      return "#12B981";
                    case "live":
                      return "rgb(239, 68, 68)";
                    case "signup":
                      return "rgb(37, 99, 235)";
                    default:
                      return "#9333ea";
                  }
                };
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full bg-hh-ui-50 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4`} style={{ color: getActivityColor(activity.type) }} />
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
              })}
            </div>
            <Button variant="outline" className="w-full mt-4">
              Bekijk alle activiteit
            </Button>
          </Card>

          {/* Recent Notifications */}
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] leading-[24px] text-hh-text">
                Notificaties
              </h3>
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                {recentNotifications.length} nieuw
              </Badge>
            </div>
            <div className="space-y-3">
              {/* Notification 1 - Green */}
              <div 
                className="flex items-start gap-3 p-3 rounded-lg border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors cursor-pointer"
                onClick={() => navigate?.("admin-notifications")}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] leading-[20px] text-hh-ink font-medium">
                    Nieuwe gebruiker geregistreerd
                  </p>
                  <p className="text-[13px] leading-[18px] text-hh-muted truncate">
                    Jan de Vries heeft zich aangemeld voor het Pro abonnement
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
                    2 min geleden
                  </p>
                </div>
              </div>
              {/* Notification 2 - Orange */}
              <div 
                className="flex items-start gap-3 p-3 rounded-lg border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors cursor-pointer"
                onClick={() => navigate?.("admin-notifications")}
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] leading-[20px] text-hh-ink font-medium">
                    Live sessie start binnenkort
                  </p>
                  <p className="text-[13px] leading-[18px] text-hh-muted truncate">
                    Discovery Technieken Q&A begint over 15 minuten
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
                    15 min geleden
                  </p>
                </div>
              </div>
              {/* Notification 3 - Blue */}
              <div 
                className="flex items-start gap-3 p-3 rounded-lg border border-hh-border bg-hh-bg hover:bg-hh-ui-50 transition-colors cursor-pointer"
                onClick={() => navigate?.("admin-notifications")}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] leading-[20px] text-hh-ink font-medium">
                    Nieuwe feedback ontvangen
                  </p>
                  <p className="text-[13px] leading-[18px] text-hh-muted truncate">
                    5 nieuwe reviews voor SPIN Questioning Workshop
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
                    1 uur geleden
                  </p>
                </div>
              </div>
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

        {/* Quick Actions - Full Width Below */}
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
                <p className="text-[11px] leading-[14px] opacity-80">
                  Nieuwe video
                </p>
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
                <p className="text-[14px] leading-[18px] font-medium text-hh-text">
                  Plan Sessie
                </p>
                <p className="text-[11px] leading-[14px] text-hh-muted">
                  Live coaching
                </p>
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
                <p className="text-[14px] leading-[18px] font-medium text-hh-text">
                  Analytics
                </p>
                <p className="text-[11px] leading-[14px] text-hh-muted">
                  Statistieken
                </p>
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
                <p className="text-[14px] leading-[18px] font-medium text-hh-text">
                  Gebruikers
                </p>
                <p className="text-[11px] leading-[14px] text-hh-muted">
                  Beheren
                </p>
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
                <p className="text-[14px] leading-[18px] font-medium text-hh-text">
                  Settings
                </p>
                <p className="text-[11px] leading-[14px] text-hh-muted">
                  Configuratie
                </p>
              </div>
            </Button>
          </div>
        </Card>

        {/* Top Performing Content */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] leading-[24px] text-hh-text">
              Top Performing Content
            </h3>
            <Button variant="outline" size="sm">
              Bekijk alles
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hh-border">
                  <th className="text-left py-3 px-2 text-[13px] leading-[18px] text-hh-text font-semibold">
                    Type
                  </th>
                  <th className="text-left py-3 px-2 text-[13px] leading-[18px] text-hh-text font-semibold">
                    Titel
                  </th>
                  <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-text font-semibold">
                    Views
                  </th>
                  <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-text font-semibold">
                    Completion
                  </th>
                  <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-text font-semibold">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((content) => (
                  <tr
                    key={content.id}
                    className="border-b border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (content.type === "Video") {
                        navigate?.("admin-videos");
                      } else if (content.type === "Scenario") {
                        navigate?.("admin-sessions");
                      } else if (content.type === "Live") {
                        navigate?.("admin-live");
                      }
                    }}
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
                      <span className="text-[14px] leading-[20px] text-emerald-500">
                        {content.completion}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-[14px] leading-[20px] text-hh-text">
                        ⭐ {content.rating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}