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
  Loader2,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ProgressBar } from "./ProgressBar";
import { getTechniqueByNumber } from "../../data/epicTechniques";
import { useVideoAnalytics, useLiveSessionAnalytics } from "../../hooks/useAnalytics";

interface AdminDashboardProps {
  navigate?: (page: string) => void;
}

export function AdminDashboard({ navigate }: AdminDashboardProps) {
  const { data: videoData, loading: videoLoading } = useVideoAnalytics();
  const { data: liveData, loading: liveLoading } = useLiveSessionAnalytics();

  const sessionsToday = (videoData?.todayViews ?? 0) + (liveData?.todaySessions ?? 0);
  const kpiData = [
    {
      label: "Actieve Users",
      value: "847",
      change: "+12%",
      trend: "up",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
    },
    {
      label: "Sessies Vandaag",
      value: (videoLoading || liveLoading) ? "..." : sessionsToday.toLocaleString('nl-NL'),
      change: "",
      trend: "up",
      icon: Play,
      color: "text-hh-success",
      bgColor: "bg-hh-success/10",
    },
    {
      label: "Nieuwe Signups",
      value: "23",
      change: "+15%",
      trend: "up",
      icon: UserPlus,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
    {
      label: "Revenue Deze Mnd",
      value: "€12.5k",
      change: "+18%",
      trend: "up",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
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
      color: "text-hh-success",
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
      color: "text-purple-600",
    },
    {
      id: 5,
      type: "session",
      user: "Tom Bakker",
      action: "voltooide sessie",
      detail: "Objection Handling",
      time: "1 uur geleden",
      icon: CheckCircle,
      color: "text-hh-success",
    },
  ];

  const dummyTopContent = [
    { id: 1, type: "Video", title: "SPIN Questioning Technique", views: 847, completion: 92, rating: 4.8 },
    { id: 2, type: "Scenario", title: "SaaS Discovery Call", views: 423, completion: 88, rating: 4.6 },
    { id: 3, type: "Video", title: "E.P.I.C Framework Deep Dive", views: 389, completion: 85, rating: 4.9 },
    { id: 4, type: "Live", title: "Objection Handling Masterclass", views: 234, completion: 78, rating: 4.7 },
    { id: 5, type: "Scenario", title: "Cold Calling Roleplay", views: 198, completion: 82, rating: 4.5 },
  ];

  const topContent = videoData?.topVideos?.length
    ? videoData.topVideos.map((v, i) => ({
        id: i + 1,
        type: "Video",
        title: v.title,
        views: v.views,
        completion: Math.round(v.completionRate),
        rating: null as number | null,
      }))
    : dummyTopContent;

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
              {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Clock className="w-4 h-4" />
            Laatste 30 dagen
          </Button>
        </div>

        {/* KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-full ${kpi.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                  <Badge
                    className={`${
                      kpi.trend === "up"
                        ? "bg-hh-success/10 text-hh-success border-hh-success/20"
                        : "bg-red-500/10 text-red-600 border-red-500/20"
                    } text-[11px]`}
                  >
                    {kpi.change}
                  </Badge>
                </div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  {kpi.label}
                </p>
                <p className="text-[28px] leading-[36px] text-hh-text font-semibold">
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
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full bg-hh-ui-50 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${activity.color}`} />
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

          {/* Quick Actions */}
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Button
                className="w-full justify-start gap-3 h-auto py-4 bg-purple-600 hover:bg-purple-700"
                onClick={() => navigate?.("admin-videos")}
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] leading-[20px] font-medium">Upload Video</p>
                  <p className="text-[12px] leading-[16px] opacity-90">
                    Nieuwe training video toevoegen
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => navigate?.("admin-live")}
              >
                <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] leading-[20px] font-medium text-hh-text">
                    Plan Live Sessie
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    Nieuwe coaching sessie plannen
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => navigate?.("admin-analytics")}
              >
                <div className="w-10 h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-hh-success" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] leading-[20px] font-medium text-hh-text">
                    Bekijk Analytics
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    Gedetailleerde platform statistieken
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => navigate?.("admin-users")}
              >
                <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] leading-[20px] font-medium text-hh-text">
                    Manage Users
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    Gebruikers beheren en ondersteunen
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => navigate?.("admin-settings")}
              >
                <div className="w-10 h-10 rounded-full bg-hh-slate-gray/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-hh-slate-gray" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] leading-[20px] font-medium text-hh-text">
                    Platform Settings
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    Configuratie en integraties
                  </p>
                </div>
              </Button>
            </div>
          </Card>
        </div>

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
                  <th className="text-left py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Type
                  </th>
                  <th className="text-left py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Titel
                  </th>
                  <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Views
                  </th>
                  <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Completion
                  </th>
                  <th className="text-right py-3 px-2 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((content) => (
                  <tr
                    key={content.id}
                    className="border-b border-hh-border hover:bg-hh-ui-50 transition-colors"
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
                      <span className="text-[14px] leading-[20px] text-hh-success">
                        {content.completion}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-[14px] leading-[20px] text-hh-text">
                        {content.rating ? `⭐ ${content.rating}` : '-'}
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