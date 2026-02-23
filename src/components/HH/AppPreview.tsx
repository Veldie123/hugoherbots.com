import { useState, useEffect } from "react";
import { Dashboard } from "./Dashboard";
import { RolePlay } from "./RolePlay";
import { RolePlayChat } from "./RolePlayChat";
import { OverviewProgress } from "./OverviewProgress";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { MySessions } from "./MySessions";
import { VideoLibrary } from "./VideoLibrary";
import { LiveCoaching } from "./LiveCoaching";
import { TeamSessions } from "./TeamSessions";
import { Analytics } from "./Analytics";
import { Settings } from "./Settings";
import { DigitalCoaching } from "./DigitalCoaching";
import { ConversationAnalysis } from "./ConversationAnalysis";
import { SignupModal } from "./SignupModal";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

type PreviewPage = "dashboard" | "roleplay" | "roleplayvideo" | "roleplaychat" | "library" | "builder" | "mysessions" | "videos" | "live" | "team" | "analytics" | "settings" | "digitalcoaching" | "conversationanalysis";

interface AppPreviewProps {
  navigate: (page: any) => void;
}

export function AppPreview({ navigate }: AppPreviewProps) {
  const [currentPreviewPage, setCurrentPreviewPage] = useState<PreviewPage>("dashboard");
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<"first" | "reminder">("first");
  const [hasSeenFirstModal, setHasSeenFirstModal] = useState(false);

  console.log("AppPreview render - showSignupModal:", showSignupModal);

  // Timer logic
  useEffect(() => {
    // First modal after 10 minutes
    const firstTimer = setTimeout(() => {
      console.log("🎯 First signup modal triggered");
      setShowSignupModal(true);
      setModalVariant("first");
      setHasSeenFirstModal(true);
    }, 600000); // 10 minutes (600000 ms)

    return () => clearTimeout(firstTimer);
  }, []);

  // Reminder modal after 20 more seconds (if first modal was closed)
  useEffect(() => {
    if (hasSeenFirstModal && !showSignupModal) {
      const reminderTimer = setTimeout(() => {
        console.log("🔔 Reminder modal triggered");
        setShowSignupModal(true);
        setModalVariant("reminder");
      }, 20000); // 20 seconds for testing (change to 120000 for 2 more minutes)

      return () => clearTimeout(reminderTimer);
    }
  }, [hasSeenFirstModal, showSignupModal]);

  const handlePreviewNavigate = (page: string) => {
    // Handle logout in preview - return to landing page
    if (page === "landing" || page === "logout") {
      navigate("landing");
      return;
    }

    // Map page names to preview pages
    const pageMap: Record<string, PreviewPage> = {
      home: "dashboard",
      dashboard: "dashboard",
      roleplay: "roleplay",
      roleplays: "roleplay",
      roleplayvideo: "roleplayvideo",
      roleplaychat: "roleplaychat",
      library: "library",
      builder: "builder",
      mysessions: "mysessions",
      videos: "videos",
      live: "live",
      team: "team",
      analytics: "analytics",
      settings: "settings",
      coaching: "digitalcoaching", // Map "coaching" to "digitalcoaching"
      digitalcoaching: "digitalcoaching",
      analysis: "conversationanalysis", // Map "analysis" to "conversationanalysis"
      conversationanalysis: "conversationanalysis",
    };
    
    const mappedPage = pageMap[page] || "dashboard";
    setCurrentPreviewPage(mappedPage as PreviewPage);
    window.scrollTo(0, 0);
  };

  const handleSignup = () => {
    navigate("signup");
  };

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      {/* Preview Banner - Sticky */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-hh-primary/10 to-hh-success/10 border-b border-hh-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 flex-shrink-0">
              <Sparkles className="w-3 h-3 mr-1" />
              Preview mode
            </Badge>
            <p className="text-[14px] leading-[20px] text-hh-muted hidden sm:block truncate">
              Je bekijkt de demo — start gratis om je voortgang op te slaan
            </p>
          </div>
          <Button 
            size="sm" 
            variant="default" 
            className="gap-2 flex-shrink-0 bg-hh-success hover:bg-hh-success/90 text-white"
            onClick={handleSignup}
          >
            Start gratis <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Preview Content - Render current page */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {currentPreviewPage === "dashboard" && (
          <Dashboard hasData={true} navigate={handlePreviewNavigate} isPreview={true} />
        )}
        {currentPreviewPage === "roleplay" && (
          <RolePlay navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "roleplayvideo" && (
          <RolePlay navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "roleplaychat" && (
          <RolePlayChat navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "library" && (
          <OverviewProgress navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "builder" && (
          <ScenarioBuilder navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "mysessions" && (
          <MySessions navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "videos" && (
          <VideoLibrary navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "live" && (
          <LiveCoaching navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "team" && (
          <TeamSessions navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "analytics" && (
          <Analytics navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "settings" && (
          <Settings navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "digitalcoaching" && (
          <DigitalCoaching navigate={handlePreviewNavigate} />
        )}
        {currentPreviewPage === "conversationanalysis" && (
          <ConversationAnalysis navigate={handlePreviewNavigate} />
        )}
      </div>

      {/* Signup Modal */}
      <SignupModal
        open={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSignup={handleSignup}
        variant={modalVariant}
      />
    </div>
  );
}