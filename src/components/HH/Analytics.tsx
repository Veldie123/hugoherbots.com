import { useState, useMemo, useEffect } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
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
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Award,
  Clock,
  Search,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { ProgressBar } from "./ProgressBar";
import { getTechniekByNummer, getFaseNaam } from "../../data/technieken-service";
import { getCodeBadgeColors } from "../../utils/phaseColors";
import { supabase } from "@/utils/supabase/client";

interface AnalyticsProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

interface SkillData {
  id: number;
  code: string;
  skill: string;
  fase: string;
  score: number;
  sessions: number;
  trend: number;
}

export function Analytics({ navigate, isAdmin, onboardingMode }: AnalyticsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [timePeriod, setTimePeriod] = useState("month");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [sortBy, setSortBy] = useState<"code" | "skill" | "score" | "sessions" | "trend">("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [apiData, setApiData] = useState<any>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        if (!userId) {
          setApiData(null);
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/analytics/user?user_id=${userId}`);
        if (!res.ok) {
          console.error('[Analytics] API error:', res.status);
          setApiData(null);
        } else {
          const data = await res.json();
          setApiData(data);
        }
      } catch (err) {
        console.error('[Analytics] Failed to fetch analytics:', err);
        setApiData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const formatWatchTime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return "0m 0s";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const performanceData = useMemo(() => {
    if (!apiData) {
      return {
        overallScore: 0,
        scoreDelta: 0,
        sessionsCompleted: 0,
        sessionsDelta: 0,
        avgSessionTime: "0m 0s",
        timeDelta: 0,
        completionRate: 0,
        completionDelta: 0,
      };
    }
    const techniques = apiData.techniquesProgress || [];
    const totalViews = techniques.reduce((sum: number, t: any) => sum + (t.views || 0), 0);

    const totalActivities = Object.values(apiData.activityCounts || {}).reduce((sum: number, v: any) => sum + (v || 0), 0) as number;
    const sessionsCompleted = totalActivities + totalViews;

    const completionRate = apiData.totalVideoViews > 0
      ? Math.round((apiData.totalVideoCompletes / apiData.totalVideoViews) * 100)
      : 0;

    const avgWatchPerSession = totalViews > 0 && apiData.totalWatchTime > 0
      ? apiData.totalWatchTime / totalViews
      : 0;

    return {
      overallScore: completionRate,
      scoreDelta: 0,
      sessionsCompleted,
      sessionsDelta: 0,
      avgSessionTime: formatWatchTime(avgWatchPerSession),
      timeDelta: 0,
      completionRate,
      completionDelta: 0,
    };
  }, [apiData]);

  const skillsBreakdown: SkillData[] = useMemo(() => {
    if (!apiData || !apiData.techniquesProgress) return [];
    return apiData.techniquesProgress.map((tp: any, idx: number) => {
      const techId = tp.techniekId || tp.techniek_id;
      const techniek = getTechniekByNummer(techId);
      const faseMatch = techId?.match(/^(\d+)/);
      const fase = faseMatch ? faseMatch[1] : "1";
      const views = tp.views || 0;
      const watchTime = tp.watchTime || 0;
      const avgWatchPct = watchTime > 0 && views > 0 ? Math.min(100, Math.round((watchTime / views / 300) * 100)) : 0;
      return {
        id: idx + 1,
        code: techId || `${idx + 1}`,
        skill: techniek?.naam || techId || `Techniek ${idx + 1}`,
        fase,
        score: avgWatchPct,
        sessions: views,
        trend: 0,
      };
    });
  }, [apiData]);

  const scenarioPerformance: { scenario: string; attempts: number; avgScore: number; bestScore: number }[] = [];

  const weeklyActivity = useMemo(() => {
    if (!apiData || !apiData.weeklyActivity) return [];
    return apiData.weeklyActivity.map((w: any) => ({
      week: w.week,
      sessions: (w.views || 0) + (w.activities || 0),
      avgScore: w.avgScore || 0,
    }));
  }, [apiData]);

  const handleSort = (column: "code" | "skill" | "score" | "sessions" | "trend") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder(column === "code" || column === "skill" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-hh-muted/40" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-hh-ink" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-hh-ink" />
    );
  };

  const filteredSkills = useMemo(() => {
    let filtered = skillsBreakdown.filter((skill) =>
      skill.skill.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (categoryFilter !== "all") {
      filtered = filtered.filter((skill) => skill.fase === categoryFilter);
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "code":
          comparison = a.code.localeCompare(b.code);
          break;
        case "skill":
          comparison = a.skill.localeCompare(b.skill);
          break;
        case "score":
          comparison = a.score - b.score;
          break;
        case "sessions":
          comparison = a.sessions - b.sessions;
          break;
        case "trend":
          comparison = a.trend - b.trend;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [skillsBreakdown, searchQuery, categoryFilter, sortBy, sortOrder]);

  const totalSessions = skillsBreakdown.reduce((sum, s) => sum + s.sessions, 0);
  const avgScore = skillsBreakdown.length > 0
    ? Math.round(skillsBreakdown.reduce((sum, s) => sum + s.score, 0) / skillsBreakdown.length)
    : 0;

  if (loading) {
    return (
      <AppLayout currentPage="analytics" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
        <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 text-hh-primary animate-spin" />
          <p className="text-[16px] text-hh-muted">Laden...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="analytics" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Analytics & Voortgang
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Jouw salesvaardigheden in cijfers — deze maand {performanceData.sessionsCompleted} sessies
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ink" />
              </div>
              <div
                className={`flex items-center gap-0.5 text-[10px] sm:text-[11px] ${
                  performanceData.scoreDelta > 0
                    ? "text-hh-success"
                    : "text-destructive"
                }`}
              >
                {performanceData.scoreDelta > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                +{Math.abs(performanceData.scoreDelta)}%
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Overall Score
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {performanceData.overallScore}%
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-hh-primary" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +{performanceData.sessionsDelta}
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Sessies voltooid
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {performanceData.sessionsCompleted}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ink" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +{performanceData.timeDelta}%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Gemiddelde tijd
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {performanceData.avgSessionTime}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 text-hh-success" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +{performanceData.completionDelta}%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Completion rate
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {performanceData.completionRate}%
            </p>
          </Card>
        </div>

        {/* Search, View Toggle & Filters Card */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek technieken..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Deze week</SelectItem>
                <SelectItem value="month">Deze maand</SelectItem>
                <SelectItem value="quarter">Dit kwartaal</SelectItem>
                <SelectItem value="year">Dit jaar</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Alle Fases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fases</SelectItem>
                <SelectItem value="1">{getFaseNaam("1")}</SelectItem>
                <SelectItem value="2">{getFaseNaam("2")}</SelectItem>
                <SelectItem value="3">{getFaseNaam("3")}</SelectItem>
                <SelectItem value="4">{getFaseNaam("4")}</SelectItem>
              </SelectContent>
            </Select>

            <div className="hidden sm:flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  viewMode === "list" 
                    ? "bg-hh-primary text-white hover:bg-hh-primary/90" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  viewMode === "grid" 
                    ? "bg-hh-primary text-white hover:bg-hh-primary/90" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Skills Breakdown Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-hh-border">
            <h2 className="text-[18px] sm:text-[20px] leading-[26px] sm:leading-[28px] text-hh-text">
              Vaardigheden analyse
            </h2>
            <p className="text-[13px] sm:text-[14px] leading-[18px] sm:leading-[20px] text-hh-muted mt-1">
              Jouw score per techniek — {filteredSkills.length} technieken gevonden
            </p>
          </div>

          {viewMode === "list" ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      <button
                        className="flex items-center gap-1.5 hover:text-hh-ink transition-colors"
                        onClick={() => handleSort("code")}
                      >
                        #
                        <SortIcon column="code" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      <button
                        className="flex items-center gap-1.5 hover:text-hh-ink transition-colors"
                        onClick={() => handleSort("skill")}
                      >
                        Techniek
                        <SortIcon column="skill" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium hidden md:table-cell">
                      <span>
                        Fase
                      </span>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      <button
                        className="flex items-center gap-1.5 hover:text-hh-ink transition-colors"
                        onClick={() => handleSort("sessions")}
                      >
                        Sessies
                        <SortIcon column="sessions" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      <button
                        className="flex items-center gap-1.5 hover:text-hh-ink transition-colors"
                        onClick={() => handleSort("trend")}
                      >
                        Trend
                        <SortIcon column="trend" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium min-w-[180px]">
                      <button
                        className="flex items-center gap-1.5 hover:text-hh-ink transition-colors"
                        onClick={() => handleSort("score")}
                      >
                        Score
                        <SortIcon column="score" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkills.map((skill) => (
                    <tr
                      key={skill.id}
                      className="border-b border-hh-border last:border-0 hover:bg-hh-ui-50/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-mono font-semibold ${getCodeBadgeColors(skill.code)}`}
                        >
                          {skill.code}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[14px] text-hh-text">
                          {skill.skill}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className="text-[11px] bg-hh-primary/10 text-hh-primary border-hh-primary/20"
                        >
                          {getFaseNaam(skill.fase)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[14px] text-hh-muted">
                          {skill.sessions}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div
                          className={`flex items-center gap-1 text-[13px] ${
                            skill.trend > 0
                              ? "text-hh-success"
                              : skill.trend < 0
                              ? "text-destructive"
                              : "text-hh-muted"
                          }`}
                        >
                          {skill.trend > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : skill.trend < 0 ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : null}
                          {skill.trend > 0 ? "+" : ""}
                          {skill.trend}%
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <ProgressBar value={skill.score} size="sm" showValue={false} />
                          </div>
                          <span className="text-[14px] sm:text-[15px] text-hh-text font-medium w-12 text-right">
                            {skill.score}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map((skill) => (
                <Card
                  key={skill.id}
                  className="p-4 rounded-[12px] border-hh-border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-mono font-semibold ${getCodeBadgeColors(skill.code)}`}
                    >
                      {skill.code}
                    </Badge>
                    <div
                      className={`flex items-center gap-1 text-[12px] ${
                        skill.trend > 0
                          ? "text-hh-success"
                          : skill.trend < 0
                          ? "text-destructive"
                          : "text-hh-muted"
                      }`}
                    >
                      {skill.trend > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : skill.trend < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      {skill.trend > 0 ? "+" : ""}
                      {skill.trend}%
                    </div>
                  </div>
                  <h3 className="text-[15px] leading-[22px] text-hh-text mb-2">
                    {skill.skill}
                  </h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-hh-primary/10 text-hh-primary border-hh-primary/20"
                    >
                      {getFaseNaam(skill.fase)}
                    </Badge>
                    <span className="text-[12px] text-hh-muted">
                      {skill.sessions} sessies
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={skill.score} size="sm" />
                    </div>
                    <span className="text-[16px] text-hh-text font-medium">
                      {skill.score}%
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Scenario Performance & Weekly Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-hh-ink" />
              </div>
              <div>
                <h3 className="text-[18px] leading-[24px] text-hh-text">
                  Scenario performance
                </h3>
                <p className="text-[13px] text-hh-muted">
                  Jouw resultaten per scenario
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {scenarioPerformance.map((scenario, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-hh-ui-50"
                >
                  <div>
                    <p className="text-[14px] sm:text-[15px] leading-[22px] text-hh-text mb-0.5">
                      {scenario.scenario}
                    </p>
                    <p className="text-[12px] sm:text-[13px] leading-[18px] text-hh-muted">
                      {scenario.attempts} pogingen • Beste: {scenario.bestScore}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[20px] sm:text-[22px] leading-[28px] text-hh-text font-medium">
                      {scenario.avgScore}%
                    </p>
                    <p className="text-[11px] leading-[14px] text-hh-muted">
                      gemiddeld
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-hh-primary" />
              </div>
              <div>
                <h3 className="text-[18px] leading-[24px] text-hh-text">
                  Weekelijkse activiteit
                </h3>
                <p className="text-[13px] text-hh-muted">
                  Jouw voortgang per week
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {weeklyActivity.map((week, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] sm:text-[15px] leading-[22px] text-hh-text">
                      {week.week}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-[13px] leading-[18px] text-hh-muted">
                        {week.sessions} sessies
                      </span>
                      <span className="text-[15px] leading-[22px] text-hh-text font-medium">
                        {week.avgScore}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={week.avgScore} size="sm" />
                </div>
              ))}
            </div>

            <div className="mt-5 p-4 rounded-lg bg-hh-success/5 border border-hh-success/20">
              <div className="flex gap-3">
                <TrendingUp className="w-5 h-5 text-hh-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] leading-[20px] text-hh-text mb-1">
                    Mooie trend!
                  </p>
                  <p className="text-[13px] leading-[19px] text-hh-muted">
                    Je score stijgt elke week. Blijf oefenen met Hugo om deze
                    lijn vast te houden.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Hugo's Insight */}
        <Card className="p-5 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-ink/20 bg-hh-ink/5">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-hh-ink/10 flex items-center justify-center flex-shrink-0">
              <Award className="w-6 h-6 text-hh-ink" />
            </div>
            <div>
              <h3 className="text-[18px] sm:text-[20px] leading-[26px] sm:leading-[28px] text-hh-text mb-2">
                Hugo's analyse
              </h3>
              <p className="text-[14px] sm:text-[15px] leading-[22px] sm:leading-[24px] text-hh-muted">
                {skillsBreakdown.length > 0
                  ? `Je hebt ${totalSessions} sessies afgerond met een gemiddelde score van ${avgScore}%. Blijf oefenen met de technieken waar je score lager is — consistentie is de sleutel tot groei.`
                  : "Begin met het bekijken van video's en het oefenen van technieken om hier je persoonlijke analyse te zien."
                }
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
