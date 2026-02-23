import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { EmptyState } from "./EmptyState";
import { getDailyQuote } from "../../data/hugoQuotes";
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
            title="Klaar om te beginnen?"
            body="Je eerste role-play duurt 2 minuten. Daarna weet je direct waar je staat — en wat je volgende stap is."
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
      <div className="p-4 sm:p-5 lg:p-6 space-y-6">
        {/* Header - Clean & Minimal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="mb-1 text-[28px] leading-[36px] sm:text-[36px] sm:leading-[44px] font-normal">
              Welkom terug, Jan
            </h1>
            <p className="text-[14px] leading-[20px] text-hh-muted">
              Weer een dag om te groeien — laten we werk maken van je sales skills.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[20px]">🔥</span>
            <div>
              <div className="text-[20px] leading-[24px] font-semibold text-hh-text">
                7 dagen streak
              </div>
            </div>
          </div>
        </div>

        {/* Jouw Voortgang - COMPACT */}
        <Card className="p-4 rounded-[16px] border-hh-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] leading-[20px] text-hh-text font-semibold">
              Epic Sales Flow
            </h3>
            <div className="text-[12px] leading-[16px] text-hh-muted">
              4/12 onderwerpen • 33%
            </div>
          </div>

          {/* Horizontal Phase Bar */}
          <div className="flex items-center gap-1">
            {/* Fase -1: Voorbereiding - Completed */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-1.5 bg-hh-success rounded-full" />
              <div className="flex flex-col items-center">
                <div className="text-[11px] leading-[14px] text-hh-success font-semibold">
                  -1
                </div>
                <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                  Voorber.
                </div>
              </div>
            </div>

            {/* Fase 1: Openingsfase - Completed */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-1.5 bg-hh-success rounded-full" />
              <div className="flex flex-col items-center">
                <div className="text-[11px] leading-[14px] text-hh-success font-semibold">
                  1
                </div>
                <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                  Opening
                </div>
              </div>
            </div>

            {/* Fase 2: Ontdekkingsfase - Current */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-1.5 bg-hh-primary rounded-full" />
              <div className="flex flex-col items-center">
                <div className="text-[11px] leading-[14px] text-hh-primary font-semibold">
                  2
                </div>
                <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                  Ontdekking
                </div>
              </div>
            </div>

            {/* Fase 3: Aanbevelingsfase - Upcoming */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-1.5 bg-hh-ui-200 rounded-full" />
              <div className="flex flex-col items-center">
                <div className="text-[11px] leading-[14px] text-hh-muted font-semibold">
                  3
                </div>
                <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                  Voorstel
                </div>
              </div>
            </div>

            {/* Fase 4: Beslissingsfase - Locked */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-1.5 bg-hh-ui-100 rounded-full" />
              <div className="flex flex-col items-center">
                <div className="text-[11px] leading-[14px] text-hh-muted font-semibold">
                  4
                </div>
                <div className="text-[10px] leading-[12px] text-hh-muted text-center hidden sm:block">
                  Afsluiting
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 2 Main Action Blocks - PROMINENT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Digital Coaching */}
          <Card 
            className="p-6 rounded-[16px] border-hh-border hover:border-hh-primary/40 hover:shadow-lg hover:bg-hh-ui-50/30 transition-all group"
          >
            <div className="mb-5">
              <h2 className="text-[24px] leading-[30px] text-hh-text font-semibold mb-2 group-hover:text-hh-primary transition-colors">
                Digital Coaching
              </h2>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Epic Sales Flow • Video + Rollenspel
              </p>
            </div>

            <div className="mb-6">
              <div className="text-[13px] leading-[18px] text-hh-muted mb-2">
                Huidige topic
              </div>
              <div className="text-[18px] leading-[24px] text-hh-text font-semibold mb-1">
                2.1.1 Feitgerichte vragen
              </div>
              <div className="text-[13px] leading-[18px] text-hh-muted">
                Fase 2 • Ontdekkingsfase • 18 min
              </div>
            </div>

            {/* 3 Training Mode Buttons */}
            <Button
              className="w-full h-11 gap-2"
              onClick={() => navigate?.("coaching")}
            >
              <Play className="w-4 h-4" />
              Vervolg training
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </Card>

          {/* Live Coaching */}
          <Card 
            className="p-4 sm:p-6 rounded-[16px] border-hh-border hover:border-hh-primary/40 hover:shadow-lg hover:bg-hh-ui-50/30 transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => {
              console.log("Navigating to live coaching...");
              navigate?.("live");
            }}
          >
            <div className="mb-4 sm:mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-5 h-5 text-destructive" />
                <h2 className="text-[20px] sm:text-[24px] leading-[26px] sm:leading-[30px] text-hh-text font-semibold group-hover:text-hh-primary transition-colors">
                  Live Coaching
                </h2>
              </div>
              <p className="text-[13px] sm:text-[14px] leading-[18px] sm:leading-[20px] text-hh-muted">
                Elke woensdag live met Hugo
              </p>
            </div>

            <div className="mb-4 sm:mb-6">
              <div className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-2">
                Eerstvolgende sessie
              </div>
              <div className="text-[16px] sm:text-[18px] leading-[22px] sm:leading-[24px] text-hh-text font-semibold mb-1">
                Live Q&A: Discovery Technieken
              </div>
              <div className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted">
                Woensdag 22 jan • 14:00 - 15:00
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-10 sm:h-11 text-[14px] sm:text-[16px]"
              onClick={(e) => {
                e.stopPropagation();
                console.log("Button clicked - navigating to live...");
                navigate?.("live");
              }}
            >
              Bekijk live sessie
            </Button>
          </Card>
        </div>

        {/* Hugo's Tip - Minimal */}
        <Card className="p-5 rounded-[16px] border-hh-primary/20 bg-hh-primary/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-hh-primary text-white flex items-center justify-center flex-shrink-0 text-[13px] font-semibold">
              HH
            </div>
            <div>
              <div className="text-[14px] leading-[18px] text-hh-text font-semibold mb-1.5">
                Hugo's woord van de dag
              </div>
              <p className="text-[16px] leading-[24px] text-hh-text italic font-medium">
                "{getDailyQuote().text}"
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}