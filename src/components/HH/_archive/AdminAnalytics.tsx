import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Users,
  Eye,
  Clock,
  Award,
  Video,
  PlayCircle,
  Radio,
  FileText,
  DollarSign,
  Play,
  Loader2,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { getTechniqueByNumber } from "../../data/epicTechniques";
import { useVideoAnalytics, useLiveSessionAnalytics, usePlatformMetrics } from "../../hooks/useAnalytics";

interface AdminAnalyticsProps {
  navigate?: (page: string) => void;
}

export function AdminAnalytics({ navigate }: AdminAnalyticsProps) {
  const { data: videoData, loading: videoLoading } = useVideoAnalytics();
  const { data: liveData, loading: liveLoading } = useLiveSessionAnalytics();
  const { data: platformData, loading: platformLoading } = usePlatformMetrics();
  
  const metrics = [
    {
      label: "Dagelijks Actief",
      value: platformData ? platformData.activeUsersToday.toString() : "...",
      change: "",
      trend: "up",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
    },
    {
      label: "Maandelijks Actief",
      value: platformData ? platformData.activeUsersMonth.toString() : "...",
      change: "",
      trend: "up",
      icon: TrendingUp,
      color: "text-hh-success",
      bgColor: "bg-hh-success/10",
    },
    {
      label: "Totaal Video's",
      value: platformData ? platformData.totalVideos.toString() : "...",
      change: "",
      trend: "up",
      icon: Video,
      color: "text-hh-warn",
      bgColor: "bg-hh-warn/10",
    },
    {
      label: "Video Weergaven",
      value: platformData ? platformData.totalVideoViews.toString() : "...",
      change: "",
      trend: "up",
      icon: Eye,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
  ];

  const dummyContentPerformance = [
    { id: 1, type: "Video", title: "SPIN Questioning Technique", views: 847, completionRate: 92, avgDuration: "17:32", rating: 4.8 },
    { id: 2, type: "Scenario", title: "SaaS Discovery Call", views: 423, completionRate: 88, avgDuration: "24:15", rating: 4.6 },
    { id: 3, type: "Video", title: "E.P.I.C Framework", views: 389, completionRate: 85, avgDuration: "22:48", rating: 4.9 },
    { id: 4, type: "Live", title: "Objection Handling Q&A", views: 234, completionRate: 78, avgDuration: "45:20", rating: 4.7 },
    { id: 5, type: "Scenario", title: "Cold Calling Roleplay", views: 198, completionRate: 82, avgDuration: "18:55", rating: 4.5 },
  ];

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${m}:00`;
  };

  const contentPerformance = videoData?.topVideos?.length
    ? videoData.topVideos.map((v, i) => ({
        id: i + 1,
        type: "Video" as const,
        title: v.title,
        views: v.views,
        completionRate: Math.round(v.completionRate),
        avgDuration: formatMinutes(v.watchTimeMinutes),
        rating: null,
      }))
    : dummyContentPerformance;

  const userEngagement = platformData?.weeklyEngagement || [
    { week: "Week 1", sessions: 0, avgScore: 0 },
    { week: "Week 2", sessions: 0, avgScore: 0 },
    { week: "Week 3", sessions: 0, avgScore: 0 },
    { week: "Week 4", sessions: 0, avgScore: 0 },
  ];

  return (
    <AdminLayout currentPage="admin-analytics" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Loading indicator */}
        {platformLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-blue-800 text-sm">Analytics laden...</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Platform Analytics
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Gedetailleerde platform statistieken en performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="30">
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Laatste 7 dagen</SelectItem>
                <SelectItem value="30">Laatste 30 dagen</SelectItem>
                <SelectItem value="90">Laatste 90 dagen</SelectItem>
                <SelectItem value="365">Laatste jaar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.label}
                className="p-5 rounded-[16px] shadow-hh-sm border-hh-border"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-full ${metric.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                  <Badge
                    className={`${
                      metric.trend === "up"
                        ? "bg-hh-success/10 text-hh-success border-hh-success/20"
                        : "bg-red-500/10 text-red-600 border-red-500/20"
                    } text-[11px]`}
                  >
                    {metric.change}
                  </Badge>
                </div>
                <p className="text-[13px] leading-[18px] text-hh-muted mb-1">
                  {metric.label}
                </p>
                <p className="text-[28px] leading-[36px] text-hh-text font-semibold">
                  {metric.value}
                </p>
              </Card>
            );
          })}
        </div>

        {/* User Growth Chart Placeholder */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
            User Growth (Laatste 6 maanden)
          </h3>
          <div className="h-64 bg-hh-ui-50 rounded-lg flex items-center justify-center border border-hh-border">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-hh-muted mx-auto mb-3" />
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Line chart met nieuwe users, churn, net growth
              </p>
              <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
                Recharts integratie vereist
              </p>
            </div>
          </div>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Content Performance */}
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
              Content Performance (Top 5)
            </h3>
            <div className="space-y-4">
              {contentPerformance.map((content) => (
                <div
                  key={content.id}
                  className="flex items-start gap-3 p-3 bg-hh-ui-50 rounded-lg hover:bg-hh-ui-100 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${
                    content.type === "Video"
                      ? "bg-purple-600/10"
                      : content.type === "Live"
                      ? "bg-red-600/10"
                      : "bg-blue-600/10"
                  } flex items-center justify-center flex-shrink-0`}>
                    {content.type === "Video" ? (
                      <Video className={`w-5 h-5 ${
                        content.type === "Video"
                          ? "text-purple-600"
                          : content.type === "Live"
                          ? "text-red-600"
                          : "text-blue-600"
                      }`} />
                    ) : content.type === "Live" ? (
                      <Play className="w-5 h-5 text-red-600" />
                    ) : (
                      <Play className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium truncate">
                        {content.title}
                      </p>
                      <Badge variant="outline" className="text-[10px] ml-2 flex-shrink-0">
                        {content.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] leading-[16px] text-hh-muted">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {content.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-hh-success" />
                        {content.completionRate}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {content.avgDuration}
                      </span>
                      {content.rating && <span>⭐ {content.rating}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* User Engagement */}
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
              Weekly Activity
            </h3>
            <div className="space-y-4">
              {userEngagement.map((week, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">{week.week}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-hh-text">
                        <span className="font-medium">{week.sessions}</span> sessies
                      </span>
                      <span className="text-hh-text">
                        <span className="font-medium">{week.avgScore}%</span> avg score
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-hh-ui-200 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-hh-success rounded-full transition-all"
                      style={{ width: `${(week.sessions / 800) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-hh-border">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] leading-[16px] text-hh-muted mb-1">
                    Total Sessies
                  </p>
                  <p className="text-[20px] leading-[28px] text-hh-text font-semibold">
                    2,290
                  </p>
                </div>
                <div>
                  <p className="text-[12px] leading-[16px] text-hh-muted mb-1">
                    Gem Score Trend
                  </p>
                  <p className="text-[20px] leading-[28px] text-hh-success font-semibold flex items-center gap-1">
                    +8%
                    <TrendingUp className="w-4 h-4" />
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Platform Statistics */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
            Platform Statistieken
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Total Users
              </p>
              <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                2,847
              </p>
              <p className="text-[12px] leading-[16px] text-hh-muted mt-1">
                Binnenkort beschikbaar
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Video Weergaven
              </p>
              <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                {videoLoading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : (videoData?.totalViews?.toLocaleString('nl-NL') ?? '0')}
              </p>
              <p className="text-[12px] leading-[16px] text-hh-success mt-1">
                {videoData?.completedViews ?? 0} voltooid
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Total Video's
              </p>
              <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                {videoLoading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : (videoData?.totalVideos ?? 0)}
              </p>
              <p className="text-[12px] leading-[16px] text-hh-success mt-1">
                {videoData?.averageCompletionRate ?? 0}% gem. voltooid
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Live Sessies
              </p>
              <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                {liveLoading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : (liveData?.totalSessions ?? 0)}
              </p>
              <p className="text-[12px] leading-[16px] text-hh-success mt-1">
                {liveData?.upcomingSessions ?? 0} gepland
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}