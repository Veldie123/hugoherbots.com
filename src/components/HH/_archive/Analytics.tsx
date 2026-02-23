import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
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
  Download,
  Calendar,
  Target,
  Award,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { EPIC_TECHNIQUES, getTechniqueByNumber } from "../../data/epicTechniques";

interface AnalyticsProps {
  navigate?: (page: string) => void;
}

export function Analytics({ navigate }: AnalyticsProps) {
  const performanceData = {
    overallScore: 82,
    scoreDelta: 8,
    sessionsCompleted: 47,
    sessionsDelta: 12,
    avgSessionTime: "8m 32s",
    timeDelta: -15,
    completionRate: 94,
    completionDelta: 3,
  };

  const skillsBreakdown = [
    {
      skill: getTechniqueByNumber("2.1.2")?.naam || "Meningsgerichte vragen",
      score: 91,
      sessions: 18,
      trend: 7,
    },
    {
      skill: getTechniqueByNumber("4.2.4")?.naam || "Bezwaren",
      score: 85,
      sessions: 22,
      trend: 12,
    },
    {
      skill: getTechniqueByNumber("3.3")?.naam || "Voordeel",
      score: 78,
      sessions: 15,
      trend: -2,
    },
    {
      skill: getTechniqueByNumber("4.1")?.naam || "Proefafsluiting",
      score: 74,
      sessions: 12,
      trend: 5,
    },
    {
      skill: getTechniqueByNumber("2.1.6")?.naam || "Actief en empathisch luisteren",
      score: 88,
      sessions: 20,
      trend: 4,
    },
    {
      skill: getTechniqueByNumber("1.2")?.naam || "Gentleman's agreement",
      score: 71,
      sessions: 8,
      trend: -5,
    },
  ];

  const scenarioPerformance = [
    { scenario: "Discovery call - SaaS", attempts: 8, avgScore: 87, bestScore: 94 },
    { scenario: "Budget bezwaar", attempts: 12, avgScore: 82, bestScore: 91 },
    { scenario: "Cold call - SMB", attempts: 6, avgScore: 79, bestScore: 86 },
    { scenario: "Closing - Finale beslissing", attempts: 5, avgScore: 74, bestScore: 83 },
  ];

  const weeklyActivity = [
    { week: "Week 1", sessions: 8, avgScore: 74 },
    { week: "Week 2", sessions: 11, avgScore: 78 },
    { week: "Week 3", sessions: 13, avgScore: 81 },
    { week: "Week 4", sessions: 15, avgScore: 82 },
  ];

  return (
    <AppLayout currentPage="analytics" navigate={navigate}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
              Analytics & Voortgang
            </h1>
            <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
              Jouw salesvaardigheden in cijfers — deze maand 47 sessies
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Select defaultValue="month">
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Deze week</SelectItem>
                <SelectItem value="month">Deze maand</SelectItem>
                <SelectItem value="quarter">Dit kwartaal</SelectItem>
                <SelectItem value="year">Dit jaar</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export rapport
            </Button>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-hh-success" />
              </div>
              <div
                className={`flex items-center gap-1 text-[14px] ${
                  performanceData.scoreDelta > 0
                    ? "text-hh-success"
                    : "text-destructive"
                }`}
              >
                {performanceData.scoreDelta > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(performanceData.scoreDelta)}%
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
              Overall Score
            </p>
            <p className="text-[32px] leading-[40px] text-hh-text">
              {performanceData.overallScore}%
            </p>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-hh-primary" />
              </div>
              <div className="flex items-center gap-1 text-[14px] text-hh-success">
                <TrendingUp className="w-4 h-4" />
                {performanceData.sessionsDelta}
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
              Sessies voltooid
            </p>
            <p className="text-[32px] leading-[40px] text-hh-text">
              {performanceData.sessionsCompleted}
            </p>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-hh-warn" />
              </div>
              <div className="flex items-center gap-1 text-[14px] text-hh-success">
                <TrendingUp className="w-4 h-4" />
                {performanceData.completionDelta}%
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
              Completion rate
            </p>
            <p className="text-[32px] leading-[40px] text-hh-text">
              {performanceData.completionRate}%
            </p>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-hh-ui-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-hh-text" />
              </div>
              <div className="flex items-center gap-1 text-[14px] text-hh-success">
                <TrendingUp className="w-4 h-4" />
                {Math.abs(performanceData.timeDelta)}%
              </div>
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
              Gemiddelde tijd
            </p>
            <p className="text-[32px] leading-[40px] text-hh-text">
              {performanceData.avgSessionTime}
            </p>
          </Card>
        </div>

        {/* Skills Breakdown */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="mb-1">Vaardigheden analyse</h2>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Jouw score per techniek — waar kun je groeien?
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate?.("videos")}
            >
              Bekijk alle technieken
            </Button>
          </div>

          <div className="space-y-6">
            {skillsBreakdown.map((skill, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[16px] leading-[24px] text-hh-text">
                      {skill.skill}
                    </span>
                    <Badge variant="outline" className="text-[12px]">
                      {skill.sessions} sessies
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center gap-1 text-[14px] ${
                        skill.trend > 0 ? "text-hh-success" : "text-destructive"
                      }`}
                    >
                      {skill.trend > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {Math.abs(skill.trend)}%
                    </div>
                    <span className="text-[20px] leading-[28px] text-hh-text w-16 text-right">
                      {skill.score}%
                    </span>
                  </div>
                </div>
                <ProgressBar value={skill.score} size="md" />
              </div>
            ))}
          </div>
        </Card>

        {/* Scenario Performance */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[20px] leading-[28px] text-hh-text mb-4">
              Scenario performance
            </h3>
            <div className="space-y-4">
              {scenarioPerformance.map((scenario, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-lg bg-hh-ui-50"
                >
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text mb-1">
                      {scenario.scenario}
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      {scenario.attempts} pogingen • Beste: {scenario.bestScore}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[24px] leading-[32px] text-hh-text">
                      {scenario.avgScore}%
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      gemiddeld
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
            <h3 className="text-[20px] leading-[28px] text-hh-text mb-4">
              Weekelijkse activiteit
            </h3>
            <div className="space-y-4">
              {weeklyActivity.map((week, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] leading-[24px] text-hh-text">
                      {week.week}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-[14px] leading-[20px] text-hh-muted">
                        {week.sessions} sessies
                      </span>
                      <span className="text-[16px] leading-[24px] text-hh-text">
                        {week.avgScore}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={week.avgScore} size="sm" />
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-hh-success/5 border border-hh-success/20">
              <div className="flex gap-3">
                <TrendingUp className="w-5 h-5 text-hh-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] leading-[20px] text-hh-text mb-1">
                    Mooie trend!
                  </p>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Je score stijgt elke week. Blijf oefenen met Hugo om deze
                    lijn vast te houden.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Hugo's Insight */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-primary/20 bg-hh-primary/5">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
              <Award className="w-6 h-6 text-hh-primary" />
            </div>
            <div>
              <h3 className="text-[20px] leading-[28px] text-hh-text mb-2">
                Hugo's analyse
              </h3>
              <p className="text-[16px] leading-[24px] text-hh-muted mb-4">
                Je ontdekkingsfase (91%) is sterk — dit is je grootste wapen. Nu focus op negotiation (71%) en closing (74%). Dáár win je deals. Train deze 15 min per dag, de komende 2 weken. Je ziet resultaat binnen 10 sessies.
              </p>
              <Button variant="outline" className="gap-2">
                Volg aanbeveling <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}