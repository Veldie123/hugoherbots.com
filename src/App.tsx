import { useState, useEffect, lazy, Suspense } from "react";
import { UserProvider } from "./contexts/UserContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ThemeProvider } from "./components/HH/ThemeProvider";
import { Toaster } from "sonner";
import { auth } from "./utils/supabase/client";

const Login = lazy(() => import("./components/HH/Login").then(m => ({ default: m.Login })));
const Signup = lazy(() => import("./components/HH/Signup").then(m => ({ default: m.Signup })));
const AuthCallback = lazy(() => import("./components/HH/AuthCallback").then(m => ({ default: m.AuthCallback })));
const Landing = lazy(() => import("./components/HH/Landing").then(m => ({ default: m.Landing })));
const ComingSoon = lazy(() => import("./components/HH/ComingSoon").then(m => ({ default: m.ComingSoon })));
const LandingV2 = lazy(() => import("./components/HH/LandingV2").then(m => ({ default: m.LandingV2 })));
const ProductShowcase = lazy(() => import("./components/HH/ProductShowcase").then(m => ({ default: m.ProductShowcase })));
const About = lazy(() => import("./components/HH/About").then(m => ({ default: m.About })));
const Pricing = lazy(() => import("./components/HH/Pricing").then(m => ({ default: m.Pricing })));
const Onboarding = lazy(() => import("./components/HH/Onboarding").then(m => ({ default: m.Onboarding })));
const AppPreview = lazy(() => import("./components/HH/AppPreview").then(m => ({ default: m.AppPreview })));

const Dashboard = lazy(() => import("./components/HH/Dashboard").then(m => ({ default: m.Dashboard })));
const RolePlay = lazy(() => import("./components/HH/RolePlay").then(m => ({ default: m.RolePlay })));
const RolePlayChat = lazy(() => import("./components/HH/RolePlayChat").then(m => ({ default: m.RolePlayChat })));
const OverviewProgress = lazy(() => import("./components/HH/OverviewProgress").then(m => ({ default: m.OverviewProgress })));
const ScenarioBuilder = lazy(() => import("./components/HH/ScenarioBuilder").then(m => ({ default: m.ScenarioBuilder })));
const VideoLibrary = lazy(() => import("./components/HH/VideoLibrary").then(m => ({ default: m.VideoLibrary })));
const LiveCoaching = lazy(() => import("./components/HH/LiveCoaching").then(m => ({ default: m.LiveCoaching })));
const TeamSessions = lazy(() => import("./components/HH/TeamSessions").then(m => ({ default: m.TeamSessions })));
const Analytics = lazy(() => import("./components/HH/Analytics").then(m => ({ default: m.Analytics })));
const Settings = lazy(() => import("./components/HH/Settings").then(m => ({ default: m.Settings })));
const DigitalCoaching = lazy(() => import("./components/HH/DigitalCoaching").then(m => ({ default: m.DigitalCoaching })));
const Analysis = lazy(() => import("./components/HH/Analysis").then(m => ({ default: m.Analysis })));
const UploadAnalysis = lazy(() => import("./components/HH/UploadAnalysis").then(m => ({ default: m.UploadAnalysis })));
const AnalysisResults = lazy(() => import("./components/HH/AnalysisResults").then(m => ({ default: m.AnalysisResults })));
const TechniqueLibrary = lazy(() => import("./components/HH/TechniqueLibrary").then(m => ({ default: m.TechniqueLibrary })));
const HugoAIOverview = lazy(() => import("./components/HH/HugoAIOverview").then(m => ({ default: m.HugoAIOverview })));
const TalkToHugoAI = lazy(() => import("./components/HH/TalkToHugoAI").then(m => ({ default: m.TalkToHugoAI })));
const HelpCenter = lazy(() => import("./components/HH/HelpCenter").then(m => ({ default: m.HelpCenter })));
const Resources = lazy(() => import("./components/HH/Resources").then(m => ({ default: m.Resources })));
const Library = lazy(() => import("./components/HH/Library").then(m => ({ default: m.Library })));
const PrivacyPolicy = lazy(() => import("./components/HH/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const UserNotifications = lazy(() => import("./components/HH/UserNotifications").then(m => ({ default: m.UserNotifications })));
const SSOValidate = lazy(() => import("./components/HH/SSOValidate").then(m => ({ default: m.SSOValidate })));

const AdminDashboard = lazy(() => import("./components/HH/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AdminVideoManagement = lazy(() => import("./components/HH/AdminVideoManagement").then(m => ({ default: m.AdminVideoManagement })));
const AdminLiveSessions = lazy(() => import("./components/HH/AdminLiveSessions").then(m => ({ default: m.AdminLiveSessions })));
const AdminUserManagement = lazy(() => import("./components/HH/AdminUserManagement").then(m => ({ default: m.AdminUserManagement })));
const AdminTechniqueManagement = lazy(() => import("./components/HH/AdminTechniqueManagement").then(m => ({ default: m.AdminTechniqueManagement })));
const AdminContentLibrary = lazy(() => import("./components/HH/AdminContentLibrary").then(m => ({ default: m.AdminContentLibrary })));
const AdminAnalytics = lazy(() => import("./components/HH/AdminAnalytics").then(m => ({ default: m.AdminAnalytics })));
const AdminSettings = lazy(() => import("./components/HH/AdminSettings").then(m => ({ default: m.AdminSettings })));
const AdminSessionTranscripts = lazy(() => import("./components/HH/AdminSessionTranscripts").then(m => ({ default: m.AdminSessionTranscripts })));
const AdminHelpCenter = lazy(() => import("./components/HH/AdminHelpCenter").then(m => ({ default: m.AdminHelpCenter })));
const AdminResourceLibrary = lazy(() => import("./components/HH/AdminResourceLibrary").then(m => ({ default: m.AdminResourceLibrary })));
const AdminProgress = lazy(() => import("./components/HH/AdminProgress").then(m => ({ default: m.AdminProgress })));
const AdminUploads = lazy(() => import("./components/HH/AdminUploads").then(m => ({ default: m.AdminUploads })));
const AdminSessions = lazy(() => import("./components/HH/AdminSessions").then(m => ({ default: m.AdminSessions })));
const AdminConfigReview = lazy(() => import("./components/HH/AdminConfigReview").then(m => ({ default: m.AdminConfigReview })));
const AdminNotifications = lazy(() => import("./components/HH/AdminNotifications").then(m => ({ default: m.AdminNotifications })));
const AdminChatExpertMode = lazy(() => import("./components/HH/AdminChatExpertMode").then(m => ({ default: m.AdminChatExpertMode })));
const AdminRAGReview = lazy(() => import("./components/HH/AdminRAGReview").then(m => ({ default: m.AdminRAGReview })));
const AdminConflicts = lazy(() => import("./components/HH/AdminConflicts").then(m => ({ default: m.AdminConflicts })));
const AdminV3Chat = lazy(() => import("./components/HH/AdminV3Chat").then(m => ({ default: m.AdminV3Chat })));
const PAGES = ["landing", "landing-v2", "pricing", "about", "login", "signup", "authcallback", "preview", "onboarding", "dashboard", "technieken", "techniques", "coaching", "roleplay", "roleplays", "roleplaychat", "roleplays-chat", "overviewprogress", "builder", "videos", "live", "team", "analytics", "settings", "analysis", "analysis-results", "upload-analysis", "privacy-policy", "help", "resources", "hugo-overview", "talk-to-hugo", "library", "notifications", "admin-dashboard", "admin-videos", "admin-live", "admin-progress", "admin-users", "admin-techniques", "admin-transcripts", "admin-uploads", "admin-content", "admin-analytics", "admin-settings", "admin-help", "admin-resources", "admin-sessions", "admin-config-review", "admin-notifications", "admin-chat-expert", "admin-rag-review", "admin-conflicts", "admin-analysis-results", "admin-upload-analysis", "admin-hugo-agent", "admin-v3-chat", "sso-validate", "showcase", "showcase-video", "showcase-roleplay", "showcase-analysis"] as const;
type Page = (typeof PAGES)[number];
const PAGE_SET: Set<string> = new Set(PAGES);

export default function App() {
  // Development screenshot bypass: check URL path immediately (synchronously)
  const getDevPreviewPage = (): Page | null => {
    if (typeof window === 'undefined') return null;
    // SEC-003: Only allow dev preview routes in development
    const isDev = import.meta.env.DEV;
    const path = window.location.pathname;
    if (path.startsWith('/_dark/') && isDev) {
      localStorage.setItem('hh-theme', 'dark');
      document.documentElement.classList.add('dark');
      const pageName = path.replace('/_dark/', '');
      return pageName as Page;
    }
    if (path.startsWith('/_dev/') && isDev) {
      let pageName = path.replace('/_dev/', '');
      if (pageName === 'videos/watch') {
        localStorage.setItem('dev_watch_first', 'true');
        pageName = 'videos';
      }
      const detailMatch = pageName.match(/^techniques\/(.+)$/);
      if (detailMatch) {
        localStorage.setItem('selectedTechniqueNumber', detailMatch[1]);
        pageName = 'techniques';
      }
      const devParams = new URLSearchParams(window.location.search);
      const detailParam = devParams.get('detail');
      if (detailParam) {
        localStorage.setItem('selectedTechniqueNumber', detailParam);
      }
      return pageName as Page;
    }
    // Check for Hugo onboarding paths: /_hugo/dashboard, /_hugo/videos, etc.
    if (path.startsWith('/_hugo/') && isDev) {
      const pageName = path.replace('/_hugo/', '');
      localStorage.setItem('hugo_onboarding_mode', 'true');
      return pageName as Page;
    }
    // Also check query params as fallback
    const urlParams = new URLSearchParams(window.location.search);
    const devPreview = urlParams.get('dev_preview');
    if (devPreview && import.meta.env.DEV) {
      return devPreview as Page;
    }
    return null;
  };
  
  const devPage = getDevPreviewPage();
  const [currentPage, setCurrentPage] = useState<Page | null>(devPage); // Use dev page if set
  const [settingsSection, setSettingsSection] = useState<"profile" | "notifications" | "subscription" | "team" | "danger">("profile");
  const devNavData = (() => {
    if (devPage === 'analysis-results' || devPage === 'admin-analysis-results') {
      const params = new URLSearchParams(window.location.search);
      const cid = params.get('id');
      const isAdminRoute = devPage === 'admin-analysis-results';
      if (cid) return { conversationId: cid, ...(isAdminRoute ? { fromAdmin: true } : {}) };
      return { autoLoadFirst: true, ...(isAdminRoute ? { fromAdmin: true } : {}) };
    }
    return undefined;
  })();
  const [navigationData, setNavigationData] = useState<Record<string, any> | undefined>(devNavData);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!devPage); // Skip auth check if dev preview
  const isHugoDevPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/_hugo/');
  const [isAdmin, setIsAdmin] = useState(!!devPage); // Track if current user is admin (dev mode = admin)
  const [isSuperAdmin, setIsSuperAdmin] = useState(!!devPage && !isHugoDevPath); // Stéphane only — full access
  const [onboardingMode, setOnboardingMode] = useState(isHugoDevPath); // Simplified UI for Hugo's onboarding
  const [viewMode, setViewMode] = useState<'admin' | 'user'>(devPage && String(devPage).startsWith('admin-') ? 'admin' : 'user'); // Tracks admin/user view for Talk to Hugo

  // Check auth state on mount - determine initial route
  useEffect(() => {
    // Skip if dev preview mode is active
    if (devPage) {
      return;
    }
    
    const checkAuthAndRoute = async () => {
      try {
        const { session } = await auth.getSession();
        
        if (session?.user) {
          const email = (session.user.email || '').toLowerCase();
          const superAdmin = email === 'stephane@hugoherbots.com';
          const isHugoOnboarding = email === 'hugo@hugoherbots.com';
          const isHugobotsAdmin = email.endsWith('@hugoherbots.com') && !isHugoOnboarding;
          const userIsAdmin = superAdmin || isHugobotsAdmin || isHugoOnboarding;
          
          setIsAdmin(userIsAdmin);
          setIsSuperAdmin(superAdmin);
          setOnboardingMode(isHugoOnboarding);
          
          // Restore page from URL on refresh (if valid)
          const rawPath = window.location.pathname.replace(/^\//, '');

          if (isHugoOnboarding) {
            localStorage.setItem('hugo_onboarding_mode', 'true');
            setViewMode('admin');
            setCurrentPage("talk-to-hugo");
          } else {
            localStorage.removeItem('hugo_onboarding_mode');

            // Handle settings:section URL format (e.g. /settings:notifications)
            const isSettingsPath = rawPath.startsWith('settings:');
            const pageName = isSettingsPath ? 'settings' : rawPath;
            const isAdminPage = rawPath.startsWith('admin-');
            const isValidPath = PAGE_SET.has(pageName);

            if (isValidPath && rawPath !== '') {
              // Prevent non-admins from accessing admin pages
              if (isAdminPage && !userIsAdmin) {
                setCurrentPage("dashboard");
              } else {
                setViewMode(isAdminPage ? 'admin' : 'user');
                setCurrentPage(pageName as Page);
                if (isSettingsPath) {
                  const section = rawPath.split(':')[1] as "profile" | "notifications" | "subscription" | "team" | "danger";
                  if (section) setSettingsSection(section);
                }
              }
            } else if (userIsAdmin) {
              setViewMode('admin');
              setCurrentPage("admin-dashboard");
            } else {
              setCurrentPage("dashboard");
            }
          }
        } else {
          setIsAdmin(false);
          const publicPages: Page[] = ["pricing", "about", "login", "signup", "privacy-policy"];
          const pathPage = window.location.pathname.replace('/', '') as Page;
          if (publicPages.includes(pathPage)) {
            setCurrentPage(pathPage);
          } else {
            setCurrentPage("landing");
          }
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
    if (page === "landing" || page === "logout") {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setOnboardingMode(false);
      setViewMode('user');
      setNavigationData(undefined);
      setCurrentPage("landing");
      window.history.pushState({ page: "landing" }, "", "/");
      window.scrollTo(0, 0);
      return;
    }
    // Track admin/user view mode based on target page
    if (typeof page === 'string' && page.startsWith('admin-')) {
      setViewMode('admin');
    } else if (!page.startsWith('admin-')) {
      setViewMode('user');
    }
    setNavigationData(data);
    if (page.startsWith("settings:")) {
      const section = page.split(":")[1] as "profile" | "notifications" | "subscription" | "team" | "danger";
      setSettingsSection(section);
      setCurrentPage("settings");
      window.history.pushState({ page: "settings", section }, "", `/${page}`);
    } else {
      setCurrentPage(page as Page);
      setSettingsSection("profile");
      window.history.pushState({ page }, "", `/${page}`);
    }
    window.scrollTo(0, 0);
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.page) {
        setCurrentPage(state.page as Page);
        if (state.section) setSettingsSection(state.section);
        setNavigationData(undefined);
        if (typeof state.page === 'string' && state.page.startsWith('admin-')) {
          setViewMode('admin');
        } else {
          setViewMode('user');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    // Set initial history state
    if (currentPage && !window.history.state?.page) {
      window.history.replaceState({ page: currentPage }, "", window.location.pathname === "/" ? "/" : `/${currentPage}`);
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <ThemeProvider>
    <UserProvider>
    <NotificationProvider>
      {/* Show app shell skeleton while checking auth */}
      {isCheckingAuth && (
        <div className="flex min-h-screen bg-hh-bg">
          {/* Sidebar skeleton */}
          <div className="hidden lg:flex flex-col w-64 bg-hh-card border-r border-hh-border p-4 space-y-4">
            <div className="h-8 w-32 bg-hh-border/50 rounded animate-pulse" />
            <div className="space-y-2 mt-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-9 bg-hh-border/30 rounded-lg animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>
          {/* Content skeleton */}
          <div className="flex-1 p-6 space-y-6">
            <div className="h-8 w-48 bg-hh-border/50 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-hh-card rounded-xl border border-hh-border animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <div className="h-64 bg-hh-card rounded-xl border border-hh-border animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Render pages only after auth check */}
      {!isCheckingAuth && (
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-hh-bg">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-hh-ocean-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-hh-muted">Laden...</p>
            </div>
          </div>
        }>
          {/* Login page */}
          {currentPage === "login" && (
            <Login
              onSignupClick={() => navigate("signup")}
              onLoginSuccess={async () => {
                const { session } = await auth.getSession();
                const email = (session?.user?.email || '').toLowerCase();
                const isHugo = email === 'hugo@hugoherbots.com';
                const superAdmin = email === 'stephane@hugoherbots.com';
                const isHugobotsAdmin = email.endsWith('@hugoherbots.com') && !isHugo;
                
                if (isHugo) {
                  setIsAdmin(true);
                  setIsSuperAdmin(false);
                  setOnboardingMode(true);
                  setViewMode('admin');
                  localStorage.setItem('hugo_onboarding_mode', 'true');
                  navigate("talk-to-hugo");
                } else if (isHugobotsAdmin) {
                  setIsAdmin(true);
                  setIsSuperAdmin(superAdmin);
                  setOnboardingMode(false);
                  setViewMode('admin');
                  localStorage.removeItem('hugo_onboarding_mode');
                  navigate("admin-dashboard");
                } else {
                  setIsAdmin(false);
                  setIsSuperAdmin(false);
                  setViewMode('user');
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
                const email = (session?.user?.email || '').toLowerCase();
                const isHugo = email === 'hugo@hugoherbots.com';
                const isHugobotsAdmin = email.endsWith('@hugoherbots.com') && !isHugo;
                if (isHugobotsAdmin) {
                  setIsAdmin(true);
                  setOnboardingMode(false);
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

          {/* Landing page — ComingSoon tijdelijk uit voor Stripe verificatie */}
          {currentPage === "landing" && <Landing navigate={navigate} />}
          {/* {currentPage === "landing" && <ComingSoon navigate={navigate} />} */}
          {currentPage === "landing-v2" && <LandingV2 navigate={navigate} />}

          {/* Dev showcase preview */}
          {currentPage === "showcase" && (
            <div className="bg-white py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <ProductShowcase />
            </div>
          )}
          {currentPage === "showcase-video" && (
            <div className="bg-white py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <ProductShowcase initialTab={1} />
            </div>
          )}
          {currentPage === "showcase-roleplay" && (
            <div className="bg-white py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <ProductShowcase initialTab={2} />
            </div>
          )}
          {currentPage === "showcase-analysis" && (
            <div className="bg-white py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <ProductShowcase initialTab={3} />
            </div>
          )}

          {/* About page */}
          {currentPage === "about" && <About navigate={navigate} />}

          {/* Pricing page */}
          {currentPage === "pricing" && <Pricing navigate={navigate} />}

          {/* Onboarding page */}
          {currentPage === "onboarding" && <Onboarding navigate={navigate} />}

          {/* App Preview - Interactive demo */}
          {currentPage === "preview" && <AppPreview navigate={navigate} />}

          {/* App pages - gebruik AppLayout's interne navigatie */}
          {currentPage === "dashboard" && <Dashboard hasData={true} navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "technieken" && <TechniqueLibrary navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "roleplay" && <RolePlay navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "roleplays" && <RolePlay navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "roleplaychat" && <RolePlayChat navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "roleplays-chat" && <RolePlayChat navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "overviewprogress" && <OverviewProgress navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "builder" && <ScenarioBuilder navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "videos" && <VideoLibrary navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "live" && <LiveCoaching navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "team" && <TeamSessions navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "analytics" && <Analytics navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "settings" && <Settings navigate={navigate} initialSection={settingsSection} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "help" && <HelpCenter navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "resources" && <Resources navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "admin-dashboard" && <AdminDashboard navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-videos" && <AdminVideoManagement navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-live" && <AdminLiveSessions navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-progress" && <AdminProgress navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-users" && <AdminUserManagement navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-techniques" && <AdminTechniqueManagement navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-transcripts" && <AdminSessionTranscripts navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-uploads" && <AdminUploads navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-content" && <AdminContentLibrary navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-analytics" && <AdminAnalytics navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-settings" && <AdminSettings navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-help" && <AdminHelpCenter navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-resources" && <AdminResourceLibrary navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-sessions" && <AdminSessions navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-config-review" && <AdminConfigReview navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-notifications" && <AdminNotifications navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-chat-expert" && <AdminChatExpertMode sessionId="default" sessionTitle="Talk to Hugo AI" navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-hugo-agent" && <AdminChatExpertMode sessionId="hugo-agent" sessionTitle="Talk to Hugo AI" navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-rag-review" && <AdminRAGReview navigate={navigate} currentPage={currentPage} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-conflicts" && <AdminConflicts navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-v3-chat" && <AdminV3Chat navigate={navigate} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "admin-analysis-results" && <AnalysisResults navigate={navigate} isAdmin={true} isSuperAdmin={isSuperAdmin} navigationData={navigationData} />}
          {currentPage === "admin-upload-analysis" && <UploadAnalysis navigate={navigate} isAdmin={true} isSuperAdmin={isSuperAdmin} />}
          {currentPage === "sso-validate" && <SSOValidate navigate={navigate} />}
          {currentPage === "coaching" && <DigitalCoaching navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "analysis" && <Analysis navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "analysis-results" && <AnalysisResults navigate={navigate} isAdmin={isAdmin} navigationData={navigationData} />}
          {currentPage === "upload-analysis" && <UploadAnalysis navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "privacy-policy" && <PrivacyPolicy navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "hugo-overview" && <HugoAIOverview navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "talk-to-hugo" && <TalkToHugoAI navigate={navigate} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onboardingMode={onboardingMode} adminViewMode={viewMode === 'admin'} navigationData={navigationData} />}
          {currentPage === "techniques" && <TechniqueLibrary navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} />}
          {currentPage === "library" && <Library navigate={navigate} isAdmin={isAdmin} />}
          {currentPage === "notifications" && <UserNotifications navigate={navigate} isAdmin={isAdmin} />}
        </Suspense>
      )}
    </NotificationProvider>
    </UserProvider>
    <Toaster position="top-center" richColors />
    </ThemeProvider>
  );
}