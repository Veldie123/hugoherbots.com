import { useState, useEffect } from "react";
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
import { getTechniekByNummer } from "../../data/technieken-service";

interface AdminAnalyticsProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

interface PlatformData {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersMonth: number;
  totalVideoViews: number;
  totalVideos: number;
  totalLiveSessions: number;
  completedSessions: number;
  weeklyEngagement: { week: string; sessions: number; avgScore: number }[];
}

interface ContentItem {
  videoId: string;
  title: string;
  views: number;
  techniqueId: string;
  fase: string;
}

export function AdminAnalytics({ navigate, isSuperAdmin }: AdminAnalyticsProps) {
  const [platformData, setPlatformData] = useState<PlatformData | null>(null);
  const [contentData, setContentData] = useState<ContentItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [platformRes, contentRes] = await Promise.all([
          fetch("/api/analytics/platform"),
          fetch("/api/analytics/content-performance"),
        ]);

        if (platformRes.ok) {
          const pData = await platformRes.json();
          setPlatformData(pData);
        }

        if (contentRes.ok) {
          const cData = await contentRes.json();
          setContentData(Array.isArray(cData) ? cData : cData.videos || []);
        }
      } catch (err) {
        console.error("Failed to fetch analytics data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const retentionRate = platformData && platformData.activeUsersMonth > 0 && platformData.totalUsers > 0
    ? Math.round((platformData.activeUsersMonth / platformData.totalUsers) * 100)
    : 0;

  const completionRate = platformData && platformData.totalLiveSessions > 0
    ? Math.round((platformData.completedSessions / platformData.totalLiveSessions) * 100)
    : 0;

  const metrics = [
    {
      label: "DAU (Daily Active Users)",
      value: platformData ? platformData.activeUsersToday.toLocaleString() : loading ? "..." : "0",
      change: "",
      trend: "up" as const,
      icon: Users,
      color: "#9333ea",
      bgColor: "rgba(147, 51, 234, 0.1)",
    },
    {
      label: "MAU (Monthly Active)",
      value: platformData ? platformData.activeUsersMonth.toLocaleString() : loading ? "..." : "0",
      change: "",
      trend: "up" as const,
      icon: TrendingUp,
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.1)",
    },
    {
      label: "Retention Rate",
      value: platformData ? `${retentionRate}%` : loading ? "..." : "0%",
      change: "",
      trend: "up" as const,
      icon: Award,
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.1)",
    },
    {
      label: "Sessie Completion",
      value: platformData ? `${completionRate}%` : loading ? "..." : "0%",
      change: "",
      trend: "up" as const,
      icon: DollarSign,
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.1)",
    },
  ];

  const contentPerformance = contentData
    ? contentData.slice(0, 5).map((item, index) => ({
        id: index + 1,
        type: "Video" as const,
        title: item.title,
        views: item.views,
        completionRate: 0,
        avgDuration: "—",
        rating: 0,
        fase: item.fase,
      }))
    : [];

  const userEngagement = platformData?.weeklyEngagement?.length
    ? platformData.weeklyEngagement
    : [];

  const totalSessions = userEngagement.reduce((sum, w) => sum + w.sessions, 0);
  const maxSessions = userEngagement.length > 0
    ? Math.max(...userEngagement.map((w) => w.sessions))
    : 1;
  const avgScoreFirst = userEngagement.length > 0 ? userEngagement[0].avgScore : 0;
  const avgScoreLast = userEngagement.length > 0 ? userEngagement[userEngagement.length - 1].avgScore : 0;
  const scoreTrend = avgScoreLast - avgScoreFirst;

  if (loading) {
    return (
      <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-analytics" navigate={navigate}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <p className="text-hh-muted text-[16px]">Laden...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-analytics" navigate={navigate}>
      <div className="p-6 space-y-6">
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
          <div className="flex flex-col sm:flex-row gap-2">
            <Select defaultValue="30">
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Laatste 7 dagen</SelectItem>
                <SelectItem value="30">Laatste 30 dagen</SelectItem>
                <SelectItem value="90">Laatste 90 dagen</SelectItem>
                <SelectItem value="365">Laatste jaar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Export Report</span>
              <span className="lg:hidden">Export</span>
            </Button>
          </div>
        </div>

        {/* Key Metrics - 2x2 grid on mobile, 4 columns on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.label}
                className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center`} style={{ backgroundColor: metric.bgColor }}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5`} style={{ color: metric.color }} />
                  </div>
                  {metric.change ? (
                    <Badge
                      className={`${
                        metric.trend === "up"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                      } text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5`}
                    >
                      {metric.change}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1">
                  {metric.label}
                </p>
                <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
                  {metric.value}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Weekly Engagement Overview */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
            Platform Activiteit (Laatste 4 weken)
          </h3>
          {userEngagement.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-[14px] text-hh-muted">Geen activiteit data beschikbaar</p>
            </div>
          ) : (
            <div className="flex items-end gap-3 h-48 px-4">
              {userEngagement.map((week, index) => {
                const barHeight = maxSessions > 0 ? Math.max(8, (week.sessions / maxSessions) * 100) : 8;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[12px] text-hh-muted font-medium">{week.sessions}</span>
                    <div className="w-full flex justify-center" style={{ height: '140px', alignItems: 'flex-end', display: 'flex' }}>
                      <div
                        className="w-full max-w-[60px] rounded-t-lg transition-all bg-red-600"
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-hh-muted">{week.week}</span>
                    {week.avgScore > 0 && (
                      <span className="text-[10px] text-hh-muted">{week.avgScore}% avg</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Content Performance */}
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
              Content Performance (Top 5)
            </h3>
            <div className="space-y-4">
              {contentPerformance.length === 0 ? (
                <p className="text-[14px] text-hh-muted py-4 text-center">Geen content data beschikbaar</p>
              ) : (
                contentPerformance.map((content) => (
                  <div
                    key={content.id}
                    className="flex items-start gap-3 p-3 bg-hh-ui-50 rounded-lg hover:bg-hh-ui-100 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`} style={{
                      backgroundColor: content.type === "Video"
                        ? "rgba(147, 51, 234, 0.1)"
                        : content.type === "Live"
                        ? "rgba(239, 68, 68, 0.1)"
                        : "rgba(37, 99, 235, 0.1)"
                    }}>
                      {content.type === "Video" ? (
                        <Video className={`w-5 h-5`} style={{
                          color: "#9333ea"
                        }} />
                      ) : content.type === "Live" ? (
                        <Play className="w-5 h-5" style={{ color: "#EF4444" }} />
                      ) : (
                        <Play className="w-5 h-5" style={{ color: "#2563EB" }} />
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
                        {content.fase && (
                          <span className="flex items-center gap-1">
                            Fase: {content.fase}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* User Engagement */}
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[18px] leading-[24px] text-hh-text mb-4">
              Weekly Activity
            </h3>
            <div className="space-y-4">
              {userEngagement.length === 0 ? (
                <p className="text-[14px] text-hh-muted py-4 text-center">Geen engagement data beschikbaar</p>
              ) : (
                userEngagement.map((week, index) => (
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
                        className="absolute inset-y-0 left-0 bg-red-600 rounded-full transition-all"
                        style={{ width: `${(week.sessions / (maxSessions * 1.1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-hh-border">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] leading-[16px] text-hh-muted mb-1">
                    Total Sessies
                  </p>
                  <p className="text-[20px] leading-[28px] text-hh-text font-semibold">
                    {totalSessions.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] leading-[16px] text-hh-muted mb-1">
                    Gem Score Trend
                  </p>
                  <p className={`text-[20px] leading-[28px] font-semibold flex items-center gap-1 ${scoreTrend >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {scoreTrend >= 0 ? "+" : ""}{scoreTrend}%
                    {scoreTrend >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
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
              <p className="text-[24px] leading-[32px] text-hh-ink">
                {platformData ? platformData.totalUsers.toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Total Video Views
              </p>
              <p className="text-[24px] leading-[32px] text-hh-ink">
                {platformData ? platformData.totalVideoViews.toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Total Video's
              </p>
              <p className="text-[24px] leading-[32px] text-hh-ink">
                {platformData ? platformData.totalVideos.toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Live Sessies
              </p>
              <p className="text-[24px] leading-[32px] text-hh-ink">
                {platformData ? platformData.totalLiveSessions.toLocaleString() : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}