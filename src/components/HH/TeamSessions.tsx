import { useState, useEffect } from "react";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Users,
  Crown,
  ArrowRight,
  Sparkles,
  BarChart3,
  MessageSquare,
  Target,
  Loader2,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";

interface TeamSessionsProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

export function TeamSessions({ navigate, isAdmin }: TeamSessionsProps) {
  const { workspace, isLoading: userLoading } = useUser();
  const isTeamPlan = workspace?.plan_tier === "team";

  if (userLoading) {
    return (
      <AppLayout currentPage="team" navigate={navigate} isAdmin={isAdmin}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-hh-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isTeamPlan) {
    return (
      <AppLayout currentPage="team" navigate={navigate} isAdmin={isAdmin}>
        <UpgradeCTA navigate={navigate} currentPlan={workspace?.plan_tier || "starter"} />
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="team" navigate={navigate} isAdmin={isAdmin}>
      <TeamEmptyState />
    </AppLayout>
  );
}

function UpgradeCTA({ navigate, currentPlan }: { navigate?: (page: string) => void; currentPlan: string }) {
  const planLabel = currentPlan === "pro" ? "Pro" : "Starter";

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="w-20 h-20 rounded-full bg-hh-primary/10 flex items-center justify-center mx-auto">
          <Users className="w-10 h-10 text-hh-primary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-[28px] leading-[36px] sm:text-[36px] sm:leading-[44px] text-hh-text">
            Team Coaching
          </h1>
          <p className="text-[16px] leading-[24px] text-hh-muted max-w-lg mx-auto">
            Met het Team plan kun je collega's uitnodigen, voortgang volgen en samen beter worden in sales.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
          <Card className="p-5 rounded-[16px] border-hh-border text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center mx-auto">
              <Target className="w-5 h-5 text-hh-primary" />
            </div>
            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
              Gedeelde doelen
            </p>
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Stel team targets en volg de voortgang
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] border-hh-border text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-hh-success/10 flex items-center justify-center mx-auto">
              <BarChart3 className="w-5 h-5 text-hh-success" />
            </div>
            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
              Team analytics
            </p>
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Vergelijk scores en ontdek verbeterpunten
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] border-hh-border text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center mx-auto">
              <MessageSquare className="w-5 h-5 text-hh-warn" />
            </div>
            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
              Coaching feedback
            </p>
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Geef en ontvang feedback op sessies
            </p>
          </Card>
        </div>

        <Card className="p-6 rounded-[16px] border-hh-primary/20 bg-hh-primary/5 max-w-md mx-auto">
          <div className="flex items-center gap-2 justify-center mb-3">
            <Crown className="w-5 h-5 text-hh-primary" />
            <span className="text-[14px] leading-[20px] text-hh-primary font-medium">
              Je hebt nu het {planLabel} plan
            </span>
          </div>
          <p className="text-[14px] leading-[20px] text-hh-muted mb-4">
            Upgrade naar Team om teamleden uit te nodigen en samen te trainen.
          </p>
          <Button
            className="gap-2 w-full sm:w-auto"
            onClick={() => navigate?.("pricing")}
          >
            <Sparkles className="w-4 h-4" />
            Bekijk Team plan
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      </div>
    </div>
  );
}

function TeamEmptyState() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="mb-2">Team Overzicht</h1>
          <p className="text-hh-muted">
            Nodig teamleden uit om samen te trainen
          </p>
        </div>
      </div>

      <Card className="p-12 rounded-[16px] shadow-hh-sm border-hh-border text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-hh-primary/10 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-hh-primary" />
          </div>
          <h3 className="text-[20px] leading-[28px] text-hh-text">
            Nog geen teamleden
          </h3>
          <p className="text-[14px] leading-[20px] text-hh-muted">
            Je team plan is actief. Nodig collega's uit via hun e-mailadres om samen te starten met sales coaching.
          </p>
          <p className="text-[13px] leading-[18px] text-hh-muted italic">
            Team management wordt binnenkort beschikbaar.
          </p>
        </div>
      </Card>
    </div>
  );
}
