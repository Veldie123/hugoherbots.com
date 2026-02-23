import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { EmptyState } from "./EmptyState";
import {
  Play,
  Video,
  Radio,
  TrendingUp,
  ArrowRight,
  Calendar,
  Bell,
  BarChart3,
  Target,
  Award,
  Clock,
} from "lucide-react";

interface DashboardProps {
  hasData?: boolean;
  navigate?: (page: string) => void;
}

export function Dashboard({ hasData = true, navigate }: DashboardProps) {
  if (!hasData) {
    return (
      <AppLayout currentPage="home" navigate={navigate}>
        <div className="p-8">
          <EmptyState
            icon={Play}
            title="Nog geen sessies"
            body="Start je eerste role-play en krijg binnen 2 min feedback."
            primaryCta={{
              label: "Begin role-play",
              onClick: () => navigate?.("roleplay"),
            }}
            secondaryCta={{
              label: "Bekijk bibliotheek",
              onClick: () => navigate?.("library"),
            }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="home" navigate={navigate}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header with Streak */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] font-normal">
              Welkom terug, Jan
            </h1>
            <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
              Blijf oefenen — groei is meetbaar, vooruitgang is zichtbaar.
            </p>
          </div>

          {/* Streak Indicator - Desktop: rechts, Mobile: onder header */}
          <Card className="p-4 rounded-[12px] border-hh-primary/20 bg-gradient-to-br from-hh-primary/5 to-hh-success/5 self-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hh-primary/10 border border-hh-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[20px]">🔥</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[24px] leading-[28px] font-semibold text-hh-text">
                    7
                  </span>
                  <span className="text-[14px] leading-[20px] text-hh-muted">
                    dagen streak
                  </span>
                </div>
                <p className="text-[12px] leading-[16px] text-hh-success font-medium">
                  Op weg naar 14 dagen! 💪
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* 4 Main Action Blocks - 2x2 Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* 1. Rollenspel Training */}
          <Card className="p-6 sm:p-8 rounded-[16px] shadow-hh-md border-hh-border hover:shadow-hh-lg transition-all group cursor-pointer relative overflow-hidden">
            {/* Gradient accent top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hh-primary to-hh-slate-gray" />

            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center">
                  <Play className="w-6 h-6 text-hh-primary" />
                </div>
                <div>
                  <h3 className="text-[20px] leading-[28px] text-hh-text mb-1">
                    Rollenspel Training
                  </h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Train verder
                  </p>
                </div>
              </div>
              <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20">
                3 sessies
              </Badge>
            </div>

            {/* Next Scenario Card */}
            <div className="bg-hh-ui-50 rounded-[12px] p-4 mb-4 border border-hh-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-hh-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[16px] font-semibold">2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="mb-2 text-[12px]">
                    Fase 2 • Ontdekkingsfase
                  </Badge>
                  <h4 className="text-[16px] leading-[24px] text-hh-text mb-1">
                    SPIN Questioning bij SaaS Prospect
                  </h4>
                  <div className="flex items-center gap-3 text-[12px] leading-[16px] text-hh-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      15-20 min
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Gemiddeld
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 text-[12px] leading-[16px]">
                <span className="text-hh-muted">Voortgang scenario reeks</span>
                <span className="text-hh-primary font-medium">1/8 voltooid</span>
              </div>
              <div className="w-full h-2 bg-hh-ui-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-hh-primary rounded-full transition-all"
                  style={{ width: "12.5%" }}
                />
              </div>
            </div>

            {/* CTA */}
            <Button
              className="w-full gap-2 group-hover:shadow-md transition-all"
              onClick={() => navigate?.("roleplay")}
            >
              <Play className="w-4 h-4" />
              Start volgende sessie
              <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>

          {/* 2. Video Cursus */}
          <Card className="p-6 sm:p-8 rounded-[16px] shadow-hh-md border-hh-border hover:shadow-hh-lg transition-all group cursor-pointer">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-hh-warn/10 flex items-center justify-center">
                  <Video className="w-6 h-6 text-hh-warn" />
                </div>
                <div>
                  <h3 className="text-[20px] leading-[28px] text-hh-text mb-1">
                    Video Cursus
                  </h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Ga verder met leren
                  </p>
                </div>
              </div>
              <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20">
                45% compleet
              </Badge>
            </div>

            {/* Current Video */}
            <div className="bg-hh-ui-50 rounded-[12px] p-4 mb-4 border border-hh-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-hh-warn to-orange-500 flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="mb-2 text-[12px]">
                    Fase 2 • Ontdekkingsfase
                  </Badge>
                  <h4 className="text-[16px] leading-[24px] text-hh-text mb-1">
                    Lock Questioning Techniek
                  </h4>
                  <div className="flex items-center gap-3 text-[12px] leading-[16px] text-hh-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      12:34 van 18:45
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 text-[12px] leading-[16px]">
                <span className="text-hh-muted">Fase 2 voortgang</span>
                <span className="text-hh-warn font-medium">
                  5/12 video's voltooid
                </span>
              </div>
              <div className="w-full h-2 bg-hh-ui-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-hh-warn rounded-full transition-all"
                  style={{ width: "42%" }}
                />
              </div>
            </div>

            {/* CTA */}
            <Button
              variant="outline"
              className="w-full gap-2 group-hover:border-hh-warn group-hover:text-hh-warn transition-all"
              onClick={() => navigate?.("videos")}
            >
              <Play className="w-4 h-4" />
              Ga verder met kijken
              <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>

          {/* 3. Opkomende Live Coaching */}
          <Card className="p-6 sm:p-8 rounded-[16px] shadow-hh-md border-hh-border hover:shadow-hh-lg transition-all group cursor-pointer">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Radio className="w-6 h-6 text-destructive animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[20px] leading-[28px] text-hh-text mb-1">
                    Live Coaching
                  </h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Elke woensdag live
                  </p>
                </div>
              </div>
              <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                Eerstvolgende
              </Badge>
            </div>

            {/* Next Session */}
            <div className="bg-hh-ui-50 rounded-[12px] p-4 mb-4 border border-hh-border">
              <Badge variant="outline" className="mb-3 text-[12px]">
                Fase 2 • Ontdekkingsfase
              </Badge>
              <h4 className="text-[16px] leading-[24px] text-hh-text mb-3">
                Live Q&A: Discovery Technieken
              </h4>
              <div className="space-y-2 text-[14px] leading-[20px]">
                <div className="flex items-center gap-2 text-hh-text">
                  <Calendar className="w-4 h-4 text-hh-muted flex-shrink-0" />
                  <span>Woensdag 22 januari 2025</span>
                </div>
                <div className="flex items-center gap-2 text-hh-text">
                  <Clock className="w-4 h-4 text-hh-muted flex-shrink-0" />
                  <span>14:00 - 15:00 uur (60 min)</span>
                </div>
              </div>
            </div>

            {/* Upcoming count */}
            <div className="mb-6 text-[12px] leading-[16px] text-hh-muted">
              📅 Nog <span className="text-hh-primary font-medium">2 sessies</span> gepland deze maand
            </div>

            {/* CTA */}
            <Button
              variant="outline"
              className="w-full gap-2 group-hover:border-destructive group-hover:text-destructive transition-all"
              onClick={() => navigate?.("live")}
            >
              <Bell className="w-4 h-4" />
              Herinnering instellen
              <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>

          {/* 4. Overzicht & Vooruitgang */}
          <Card className="p-6 sm:p-8 rounded-[16px] shadow-hh-md border-hh-border hover:shadow-hh-lg transition-all group cursor-pointer">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-hh-success/10 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-hh-success" />
                </div>
                <div>
                  <h3 className="text-[20px] leading-[28px] text-hh-text mb-1">
                    Jouw Vooruitgang
                  </h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Deze week
                  </p>
                </div>
              </div>
              <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20">
                +12% groei
              </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Stat 1 */}
              <div className="bg-hh-ui-50 rounded-[12px] p-4 border border-hh-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-hh-success" />
                  <span className="text-[12px] leading-[16px] text-hh-muted">
                    Gem. score
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] leading-[32px] text-hh-text font-semibold">
                    82
                  </span>
                  <span className="text-[14px] leading-[20px] text-hh-success">
                    +8%
                  </span>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="bg-hh-ui-50 rounded-[12px] p-4 border border-hh-border">
                <div className="flex items-center gap-2 mb-2">
                  <Play className="w-4 h-4 text-hh-primary" />
                  <span className="text-[12px] leading-[16px] text-hh-muted">
                    Sessies
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] leading-[32px] text-hh-text font-semibold">
                    12
                  </span>
                  <span className="text-[14px] leading-[20px] text-hh-success">
                    +3
                  </span>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="bg-hh-ui-50 rounded-[12px] p-4 border border-hh-border">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-hh-warn" />
                  <span className="text-[12px] leading-[16px] text-hh-muted">
                    Top techniek
                  </span>
                </div>
                <div className="text-[16px] leading-[24px] text-hh-text font-medium truncate">
                  E.P.I.C
                </div>
              </div>

              {/* Stat 4 */}
              <div className="bg-hh-ui-50 rounded-[12px] p-4 border border-hh-border">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-hh-primary" />
                  <span className="text-[12px] leading-[16px] text-hh-muted">
                    Streak
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] leading-[32px] text-hh-text font-semibold">
                    7
                  </span>
                  <span className="text-[14px] leading-[20px] text-hh-muted">
                    dagen
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Button
              variant="outline"
              className="w-full gap-2 group-hover:border-hh-success group-hover:text-hh-success transition-all"
              onClick={() => navigate?.("analytics")}
            >
              <BarChart3 className="w-4 h-4" />
              Bekijk alle statistieken
              <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
            </Button>
          </Card>
        </div>

        {/* Hugo's Tip Card */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-primary/20 bg-hh-primary/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-hh-primary text-white flex items-center justify-center flex-shrink-0 text-[18px] font-semibold">
              HH
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-[16px] leading-[24px] text-hh-text font-semibold">
                  Hugo's tip van de dag
                </h4>
                <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 text-[10px] px-2 py-0">
                  COACH
                </Badge>
              </div>
              <p className="text-[14px] leading-[22px] text-hh-text">
                Je scoort sterk op E.P.I.C questioning, maar ik zie kansen bij
                bezwaarhandeling. Focus deze week op de{" "}
                <span className="text-hh-primary font-medium">
                  'Acknowledge & Reframe'
                </span>{" "}
                techniek — dat geeft je de doorbraak naar 90%+.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
