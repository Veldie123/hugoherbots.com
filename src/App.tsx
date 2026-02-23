import { useState, useEffect } from "react";
import { UserProvider } from "./contexts/UserContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ThemeProvider } from "./components/HH/ThemeProvider";
import { auth } from "./utils/supabase/client";
import { Login } from "./components/HH/Login";
import { Signup } from "./components/HH/Signup";
import { AuthCallback } from "./components/HH/AuthCallback";
import { Landing } from "./components/HH/Landing";
import { About } from "./components/HH/About";
import { Pricing } from "./components/HH/Pricing";
import { Onboarding } from "./components/HH/Onboarding";
import { AppPreview } from "./components/HH/AppPreview";
import { Dashboard } from "./components/HH/Dashboard";
import { RolePlay } from "./components/HH/RolePlay";
import { RolePlayChat } from "./components/HH/RolePlayChat";
import { OverviewProgress } from "./components/HH/OverviewProgress";
import { ScenarioBuilder } from "./components/HH/ScenarioBuilder";
import { VideoLibrary } from "./components/HH/VideoLibrary";
import { LiveCoaching } from "./components/HH/LiveCoaching";
import { TeamSessions } from "./components/HH/TeamSessions";
import { Analytics } from "./components/HH/Analytics";
import { Settings } from "./components/HH/Settings";
import { DigitalCoaching } from "./components/HH/DigitalCoaching";
import { Analysis } from "./components/HH/Analysis";
import { UploadAnalysis } from "./components/HH/UploadAnalysis";
import { AnalysisResults } from "./components/HH/AnalysisResults";
import { AdminDashboard } from "./components/HH/AdminDashboard";
import { AdminVideoManagement } from "./components/HH/AdminVideoManagement";
import { AdminLiveSessions } from "./components/HH/AdminLiveSessions";
import { AdminUserManagement } from "./components/HH/AdminUserManagement";
import { AdminTechniqueManagement } from "./components/HH/AdminTechniqueManagement";
import { AdminContentLibrary } from "./components/HH/AdminContentLibrary";
import { AdminAnalytics } from "./components/HH/AdminAnalytics";
import { AdminSettings } from "./components/HH/AdminSettings";
import { AdminSessionTranscripts } from "./components/HH/AdminSessionTranscripts";
import { HelpCenter } from "./components/HH/HelpCenter";
import { Resources } from "./components/HH/Resources";
import { AdminHelpCenter } from "./components/HH/AdminHelpCenter";
import { AdminResourceLibrary } from "./components/HH/AdminResourceLibrary";
import { AdminProgress } from "./components/HH/AdminProgress";
import { AdminUploads } from "./components/HH/AdminUploads";
import { TechniqueLibrary } from "./components/HH/TechniqueLibrary";
import { HugoAIOverview } from "./components/HH/HugoAIOverview";
import { TalkToHugoAI } from "./components/HH/TalkToHugoAI";
import { AdminSessions } from "./components/HH/AdminSessions";
import { AdminConfigReview } from "./components/HH/AdminConfigReview";
import { AdminNotifications } from "./components/HH/AdminNotifications";
import { UserNotifications } from "./components/HH/UserNotifications";
import { Library } from "./components/HH/Library";
import { PrivacyPolicy } from "./components/HH/PrivacyPolicy";
import { AdminChatExpertMode } from "./components/HH/AdminChatExpertMode";
import { AdminRAGReview } from "./components/HH/AdminRAGReview";
import { AdminConflicts } from "./components/HH/AdminConflicts";
import { SSOValidate } from "./components/HH/SSOValidate";
type Page = "landing" | "pricing" | "about" | "login" | "signup" | "authcallback" | "preview" | "onboarding" | "dashboard" | "technieken" | "techniques" | "coaching" | "roleplay" | "roleplays" | "roleplaychat" | "roleplays-chat" | "overviewprogress" | "builder" | "videos" | "live" | "team" | "analytics" | "settings" | "analysis" | "analysis-results" | "upload-analysis" | "privacy-policy" | "help" | "resources" | "hugo-overview" | "talk-to-hugo" | "library" | "notifications" | "admin-dashboard" | "admin-videos" | "admin-live" | "admin-progress" | "admin-users" | "admin-techniques" | "admin-transcripts" | "admin-uploads" | "admin-content" | "admin-analytics" | "admin-settings" | "admin-help" | "admin-resources" | "admin-sessions" | "admin-config-review" | "admin-notifications" | "admin-chat-expert" | "admin-rag-review" | "admin-conflicts" | "admin-analysis-results" | "admin-upload-analysis" | "sso-validate";

export default function App() {
  // Development screenshot bypass: check URL path immediately (synchronously)
  const getDevPreviewPage = (): Page | null => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/_dark/')) {
      localStorage.setItem('hh-theme', 'dark');
      document.documentElement.classList.add('dark');
      const pageName = path.replace('/_dark/', '');
      console.log('🌙 Dark mode dev preview:', pageName);
      return pageName as Page;
    }
    if (path.startsWith('/_dev/')) {
      let pageName = path.replace('/_dev/', '');
      if (pageName === 'videos/watch') {
        localStorage.setItem('dev_watch_first', 'true');
        pageName = 'videos';
      }
      console.log('🔧 Dev preview mode activated via path:', pageName);
      return pageName as Page;
    }
    // Check for Hugo onboarding paths: /_hugo/dashboard, /_hugo/videos, etc.
    if (path.startsWith('/_hugo/')) {
      const pageName = path.replace('/_hugo/', '');
      console.log('👋 Hugo onboarding preview activated via path:', pageName);
      localStorage.setItem('hugo_onboarding_mode', 'true');
      return pageName as Page;
    }
    // Also check query params as fallback
    const urlParams = new URLSearchParams(window.location.search);
    const devPreview = urlParams.get('dev_preview');
    if (devPreview && (import.meta.env.DEV || window.location.hostname.includes('replit'))) {
      console.log('🔧 Dev preview mode activated via param:', devPreview);
      return devPreview as Page;
    }
    return null;
  };
  
  const devPage = getDevPreviewPage();
  const [currentPage, setCurrentPage] = useState<Page | null>(devPage); // Use dev page if set
  const [settingsSection, setSettingsSection] = useState<"profile" | "notifications" | "subscription" | "team" | "danger">("profile");
  const [navigationData, setNavigationData] = useState<Record<string, any> | undefined>(undefined);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!devPage); // Skip auth check if dev preview
  const [isAdmin, setIsAdmin] = useState(!!devPage); // Track if current user is admin (dev mode = admin)
  const [onboardingMode, setOnboardingMode] = useState(false); // Simplified UI for Hugo's onboarding

  console.log('📍 App.tsx rendered, currentPage:', currentPage);

  // Check auth state on mount - determine initial route
  useEffect(() => {
    // Skip if dev preview mode is active
    if (devPage) {
      console.log('🔧 Skipping auth check - dev preview mode');
      return;
    }
    
    const checkAuthAndRoute = async () => {
      console.log('🔐 Checking initial auth state...');
      
      try {
        const { session } = await auth.getSession();
        
        if (session?.user) {
          const email = (session.user.email || '').toLowerCase();
          const isSuperAdmin = email === 'stephane@hugoherbots.com';
          const isHugoOnboarding = email === 'hugo@hugoherbots.com';
          const userIsAdmin = isSuperAdmin;
          
          setIsAdmin(userIsAdmin);
          setOnboardingMode(isHugoOnboarding);
          
          if (isHugoOnboarding) {
            console.log('👋 Hugo onboarding mode activated - simplified UI');
            localStorage.setItem('hugo_onboarding_mode', 'true');
            setCurrentPage("dashboard");
          } else {
            localStorage.removeItem('hugo_onboarding_mode');
            if (userIsAdmin) {
              console.log('✅ Admin user logged in, route to admin-dashboard');
              setCurrentPage("admin-dashboard");
            } else {
              console.log('✅ User is logged in, route to dashboard');
              setCurrentPage("dashboard");
            }
          }
        } else {
          setIsAdmin(false);
          console.log('❌ No session, route to landing');
          setCurrentPage("landing");
        }
      } catch (error) {
        console.error('❌ Error checking auth:', error);
        // Default to landing on error
        setCurrentPage("landing");
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthAndRoute();
  }, []);

  // Navigation context - doorgeven aan alle pages
  const navigate = (page: Page | string, data?: Record<string, any>) => {
    console.log('🧭 Navigate called with:', page, data);
    if (page === "landing" || page === "logout") {
      setIsAdmin(false);
      setOnboardingMode(false);
      setNavigationData(undefined);
      setCurrentPage("landing");
      window.scrollTo(0, 0);
      return;
    }
    setNavigationData(data);
    if (page.startsWith("settings:")) {
      const section = page.split(":")[1] as "profile" | "notifications" | "subscription" | "team" | "danger";
      setSettingsSection(section);
      setCurrentPage("settings");
    } else {
      setCurrentPage(page as Page);
      setSettingsSection("profile");
    }
    window.scrollTo(0, 0);
  };

  return (
    <ThemeProvider>
    <UserProvider>
    <NotificationProvider>
      {/* Show loading while checking auth */}
      {isCheckingAuth && (
        <div className="flex items-center justify-center min-h-screen bg-white">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-hh-ocean-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-hh-slate-600">HugoHerbots.ai laden...</p>
          </div>
        </div>
      )}

      {/* Render pages only after auth check */}
      {!isCheckingAuth && (
        <>
          {/* Login page */}
          {currentPage === "login" && (
            <Login
              onSignupClick={() => navigate("signup")}
              onLoginSuccess={async () => {
                const { session } = await auth.getSession();
                const email = session?.user?.email || '';
                const isHugo = email.toLowerCase() === 'hugo@hugoherbots.com';
                
                if (isHugo) {
                  setOnboardingMode(true);
                  localStorage.setItem('hugo_onboarding_mode', 'true');
                  navigate("dashboard");
                } else if (email.endsWith('@hugoherbots.com')) {
                  navigate("admin-dashboard");
                } else {
                  navigate("dashboard");
                }
              }}
              navigate={navigate}
            />
          )}

          {/* Signup page */}
          {currentPage === "signup" && (
            <Signup
              onLoginClick={() => navigate("login")}
              onSignupSuccess={async () => {
                const { session } = await auth.getSession();
                const email = session?.user?.email || '';
                if (email.endsWith('@hugoherbots.com')) {
                  navigate("admin-dashboard");
                } else {
                  navigate("onboarding");
                }
              }}
              navigate={navigate}
            />
          )}

          {/* AuthCallback page */}
          {currentPage === "authcallback" && (
            <AuthCallback navigate={navigate} />
          )}

          {/* Landing page - met navigate prop */}
          {currentPage === "landing" && <Landing navigate={navigate} />}

          {/* About page */}
          {currentPage === "about" && <About navigate={navigate} />}

          {/* Pricing page */}
          {currentPage === "pricing" && <Pricing navigate={navigate} />}

          {/* Onboarding page */}
          {currentPage === "onboarding" && <Onboarding navigate={navigate} />}

          {/* App Preview - Interactive demo */}
          {currentPage === "preview" && <AppPreview navigate={navigate} />}

          {/* App pages - gebruik AppLayout's interne navigatie */}
          {currentPage === "dashboard" && <Dashboard hasData={true} navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "technieken" && <TechniqueLibrary navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "roleplay" && <RolePlay navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "roleplays" && <RolePlay navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "roleplaychat" && <RolePlayChat navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "roleplays-chat" && <RolePlayChat navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "overviewprogress" && <OverviewProgress navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "builder" && <ScenarioBuilder navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "videos" && <VideoLibrary navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "live" && <LiveCoaching navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "team" && <TeamSessions navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "analytics" && <Analytics navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "settings" && <Settings navigate={navigate} initialSection={settingsSection} isAdmin={isAdmin} />}
          {currentPage === "help" && <HelpCenter navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "resources" && <Resources navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "admin-dashboard" && <AdminDashboard navigate={navigate} />}
          {currentPage === "admin-videos" && <AdminVideoManagement navigate={navigate} />}
          {currentPage === "admin-live" && <AdminLiveSessions navigate={navigate} />}
          {currentPage === "admin-progress" && <AdminProgress navigate={navigate} />}
          {currentPage === "admin-users" && <AdminUserManagement navigate={navigate} />}
          {currentPage === "admin-techniques" && <AdminTechniqueManagement navigate={navigate} />}
          {currentPage === "admin-transcripts" && <AdminSessionTranscripts navigate={navigate} />}
          {currentPage === "admin-uploads" && <AdminUploads navigate={navigate} />}
          {currentPage === "admin-content" && <AdminContentLibrary navigate={navigate} />}
          {currentPage === "admin-analytics" && <AdminAnalytics navigate={navigate} />}
          {currentPage === "admin-settings" && <AdminSettings navigate={navigate} />}
          {currentPage === "admin-help" && <AdminHelpCenter navigate={navigate} />}
          {currentPage === "admin-resources" && <AdminResourceLibrary navigate={navigate} />}
          {currentPage === "admin-sessions" && <AdminSessions navigate={navigate} />}
          {currentPage === "admin-config-review" && <AdminConfigReview navigate={navigate} />}
          {currentPage === "admin-notifications" && <AdminNotifications navigate={navigate} />}
          {currentPage === "admin-chat-expert" && <AdminChatExpertMode sessionId="default" sessionTitle="Talk to myself AI" navigate={navigate} />}
          {currentPage === "admin-rag-review" && <AdminRAGReview navigate={navigate} currentPage={currentPage} />}
          {currentPage === "admin-conflicts" && <AdminConflicts navigate={navigate} />}
          {currentPage === "admin-analysis-results" && <AnalysisResults navigate={navigate} isAdmin={true} navigationData={navigationData} />}
          {currentPage === "admin-upload-analysis" && <UploadAnalysis navigate={navigate} isAdmin={true} />}
          {currentPage === "sso-validate" && <SSOValidate navigate={navigate} />}
          {currentPage === "coaching" && <DigitalCoaching navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "analysis" && <Analysis navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "analysis-results" && <AnalysisResults navigate={navigate} isAdmin={isAdmin} navigationData={navigationData} />}
          {currentPage === "upload-analysis" && <UploadAnalysis navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "privacy-policy" && <PrivacyPolicy navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "hugo-overview" && <HugoAIOverview navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "talk-to-hugo" && <TalkToHugoAI navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "techniques" && <TechniqueLibrary navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "library" && <Library navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "notifications" && <UserNotifications navigate={navigate} isAdmin={isAdmin} />}
        </>
      )}
    </NotificationProvider>
    </UserProvider>
    </ThemeProvider>
  );
}