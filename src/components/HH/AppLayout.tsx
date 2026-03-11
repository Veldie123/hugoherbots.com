import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Bell,
  Menu,
  ChevronRight,
  FileSearch,
  Shield,
  MessageSquare,
  UserCircle,
  CheckCheck,
  ExternalLink,
  Eye,
  X,
  Sparkles,
  LayoutDashboard,
  Target,
  Video,
  Radio,
  Users,
  BarChart3,
  HelpCircle,
  FileText,
  Settings,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { useNotifications } from "../../contexts/NotificationContext";
import { getHiddenIds } from "../../utils/hiddenItems";
import { useTheme } from "./ThemeProvider";
import { apiFetch } from "../../services/apiFetch";
import { PageFooter } from "./PageFooter";
import { NPSSurvey } from "./NPSSurvey";
import { HugoFeedbackWidget } from "./HugoFeedbackWidget";

interface HistoryItem {
  id: string;
  techniqueNumber: string;
  title: string;
  score?: number;
  date: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  navigate?: (page: string, data?: Record<string, any>) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
  isPreview?: boolean;
  chatHistory?: HistoryItem[];
  analysisHistory?: HistoryItem[];
  onSelectHistoryItem?: (id: string, type: "chat" | "analysis") => void;
  contentClassName?: string;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Zojuist";
  if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} dagen geleden`;
  return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

const mainNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "techniques", label: "E.P.I.C. TECHNIQUE", icon: Target },
  { id: "videos", label: "Video's", icon: Video },
  { id: "live", label: "Webinars", icon: Radio },
  { id: "analysis", label: "Gespreksanalyse", icon: FileSearch, historyType: "analysis" as const, overviewPage: "analysis" },
  { id: "talk-to-hugo", label: "Talk to Hugo AI", icon: Sparkles, historyType: "chat" as const, overviewPage: "hugo-overview" },
];

const bottomNavItems = [
  { id: "team", label: "Gebruikers", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "resources", label: "Resources", icon: FileText },
  { id: "settings", label: "Instellingen", icon: Settings },
];

const defaultChatHistory: HistoryItem[] = [];

export function AppLayout({
  children,
  currentPage = "home",
  navigate,
  isAdmin,
  onboardingMode,
  isPreview,
  contentClassName,
  chatHistory: chatHistoryProp = defaultChatHistory,
  analysisHistory: analysisHistoryProp,
  onSelectHistoryItem,
}: AppLayoutProps) {
  const { resolvedTheme } = useTheme();

  // Module mapping: user view → admin view equivalent
  const userToAdminMap: Record<string, string> = {
    'dashboard': 'admin-dashboard',
    'techniques': 'admin-techniques',
    'videos': 'admin-videos',
    'video-watch': 'admin-videos',
    'live': 'admin-live',
    'analysis': 'admin-uploads',
    'upload-analysis': 'admin-upload-analysis',
    'analysis-results': 'admin-analysis-results',
    'talk-to-hugo': 'admin-sessions',
    'hugo-overview': 'admin-sessions',
    'settings': 'admin-settings',
    'help': 'admin-help',
    'resources': 'admin-resources',
  };

  const shouldAutoCollapse = currentPage === 'video-watch' || currentPage === 'settings';
  const [collapsed, setCollapsed] = useState(shouldAutoCollapse);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const autoDetectPreview = typeof document !== 'undefined' && !!document.querySelector('[data-preview-mode="true"]');
  const effectivePreview = isPreview || autoDetectPreview;

  const HUGO_HIDDEN_MAIN = new Set(['techniques']);
  const HUGO_HIDDEN_BOTTOM = new Set(['team', 'resources', 'settings']);
  const PREVIEW_HIDDEN_MAIN = new Set(['techniques']);
  const visibleMainNavItems = onboardingMode
    ? mainNavItems.filter(item => !HUGO_HIDDEN_MAIN.has(item.id))
    : effectivePreview
      ? mainNavItems.filter(item => !PREVIEW_HIDDEN_MAIN.has(item.id))
      : mainNavItems;
  const PREVIEW_HIDDEN_BOTTOM = new Set(['resources']);
  const visibleBottomNavItems = onboardingMode
    ? bottomNavItems.filter(item => !HUGO_HIDDEN_BOTTOM.has(item.id))
    : effectivePreview
      ? bottomNavItems.filter(item => !PREVIEW_HIDDEN_BOTTOM.has(item.id))
      : bottomNavItems;

  useEffect(() => {
    setCollapsed(shouldAutoCollapse);
  }, [shouldAutoCollapse]);

  useEffect(() => {
    const handleCollapseRequest = (e: CustomEvent) => {
      setCollapsed(e.detail?.collapsed ?? true);
    };
    window.addEventListener('sidebar-collapse-request', handleCollapseRequest as EventListener);
    return () => window.removeEventListener('sidebar-collapse-request', handleCollapseRequest as EventListener);
  }, []);
  const [notifOpen, setNotifOpen] = useState(false);
  const [fetchedAnalysisHistory, setFetchedAnalysisHistory] = useState<HistoryItem[]>([]);
  const [fetchedChatHistory, setFetchedChatHistory] = useState<HistoryItem[]>([]);
  const [analysisTotalCount, setAnalysisTotalCount] = useState(0);
  const [chatTotalCount, setChatTotalCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllRead, removeNotification } = useNotifications();

  const analysisHistory = analysisHistoryProp || fetchedAnalysisHistory;
  const chatHistory = chatHistoryProp.length > 0 ? chatHistoryProp : fetchedChatHistory;

  useEffect(() => {
    if (analysisHistoryProp) return;
    // Stale-while-revalidate: show cached data instantly, refresh in background
    try {
      const cached = sessionStorage.getItem('hh_analysis_history');
      if (cached) {
        const { items, totalCount } = JSON.parse(cached);
        setFetchedAnalysisHistory(items);
        setAnalysisTotalCount(totalCount);
      }
    } catch { }
    const fetchHistory = async () => {
      try {
        const res = await apiFetch('/api/v2/analysis/list?source=upload');
        if (!res.ok) return;
        const data = await res.json();
        const items: HistoryItem[] = (data.analyses || []).slice(0, 5).map((a: any) => ({
          id: a.id,
          techniqueNumber: "",
          title: a.title || 'Untitled',
          score: a.overallScore ?? undefined,
          date: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : '',
        }));
        const totalCount = data.totalCount || data.analyses?.length || 0;
        setFetchedAnalysisHistory(items);
        setAnalysisTotalCount(totalCount);
        try { sessionStorage.setItem('hh_analysis_history', JSON.stringify({ items, totalCount })); } catch { }
      } catch { }
    };
    fetchHistory();
  }, [analysisHistoryProp]);

  useEffect(() => {
    if (chatHistoryProp.length > 0) return;
    // Stale-while-revalidate: show cached data instantly, refresh in background
    try {
      const cached = sessionStorage.getItem('hh_chat_history');
      if (cached) {
        const { items, totalCount } = JSON.parse(cached);
        setFetchedChatHistory(items);
        setChatTotalCount(totalCount);
      }
    } catch { }
    const fetchChatHistory = async () => {
      try {
        const res = await apiFetch('/api/user/sessions');
        if (!res.ok) return;
        const data = await res.json();
        const items: HistoryItem[] = (data.sessions || []).slice(0, 5).map((s: any) => ({
          id: s.id,
          techniqueNumber: s.nummer || '',
          title: s.naam || 'Sessie',
          score: s.score ?? undefined,
          date: s.date || '',
        }));
        const totalCount = data.total || data.sessions?.length || 0;
        setFetchedChatHistory(items);
        setChatTotalCount(totalCount);
        try { sessionStorage.setItem('hh_chat_history', JSON.stringify({ items, totalCount })); } catch { }
      } catch { }
    };
    fetchChatHistory();
  }, [chatHistoryProp]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);


  const handleNavigate = (pageId: string) => {
    if (navigate) {
      navigate(pageId);
    }
  };

  const isNavItemActive = (itemId: string) => {
    const pageMap: Record<string, string[]> = {
      "analysis": ["analysis", "analysis-results", "upload-analysis"],
      "talk-to-hugo": ["hugo-overview", "talk-to-hugo", "roleplay", "roleplays"],
    };
    if (pageMap[itemId]) {
      return pageMap[itemId].includes(currentPage);
    }
    return currentPage === itemId;
  };

  const getHistoryForItem = (historyType?: "chat" | "analysis") => {
    if (!historyType) return [];
    return historyType === "chat" ? chatHistory : analysisHistory;
  };

  return (
    <div className={`flex bg-hh-bg ${effectivePreview ? 'h-[calc(100dvh-48px)]' : 'h-dvh'}`} style={{ height: effectivePreview ? 'calc(100dvh - 48px)' : '100dvh' }}>
      <div
        data-sidebar-collapsed={collapsed ? 'true' : 'false'}
        className={`hidden lg:flex ${
          collapsed ? "w-16" : "w-56"
        } bg-hh-bg border-r border-hh-border flex-col transition-all duration-300 flex-shrink-0`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-16 flex items-center justify-start px-3 border-b border-hh-border flex-shrink-0 hover:bg-hh-ui-50 transition-colors cursor-pointer"
        >
          {!collapsed ? (
            <div className="flex flex-col items-start gap-0">
              <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HUGO</span>
              <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HERBOTS</span>
            </div>
          ) : (
            <Logo variant="icon" className="w-8 h-8" />
          )}
        </button>

        <nav className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {visibleMainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.id);
            const history = getHistoryForItem(item.historyType);

            return (
              <div key={item.id}>
                <button
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? "text-white font-medium bg-hh-primary"
                      : "text-hh-text hover:bg-hh-ui-50"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-[14px] leading-[20px] whitespace-nowrap">
                      {item.label === "Talk to Hugo AI" ? (
                        <>Talk to Hugo<sup className="text-[10px] ml-0.5">AI</sup></>
                      ) : item.label}
                    </span>
                  )}
                </button>

                {!collapsed && isActive && item.historyType && (() => {
                  const hiddenIds = getHiddenIds('user', item.historyType === 'chat' ? 'chat' : 'analysis');
                  const visibleHistory = history.filter(h => !hiddenIds.has(h.id));
                  const totalCount = visibleHistory.length;
                  return (
                  <div className="ml-2 pl-4 border-l-2 border-hh-border space-y-0.5 -mt-0.5">
                    {visibleHistory.slice(0, 3).map((histItem) => (
                      <button
                        key={histItem.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectHistoryItem) {
                            onSelectHistoryItem(histItem.id, item.historyType);
                          } else {
                            if (/^\d+$/.test(histItem.id)) {
                              navigate?.(item.overviewPage || 'hugo-overview');
                              return;
                            }
                            if (item.historyType === 'chat') {
                              navigate?.('talk-to-hugo', { loadSessionId: histItem.id });
                            } else {
                              navigate?.('analysis-results', { conversationId: histItem.id, fromAdmin: false });
                            }
                          }
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left hover:bg-hh-ui-50 transition-colors group cursor-pointer"
                      >
                        <div className="flex-1 min-w-0 pointer-events-none">
                          <p className="text-[13px] text-hh-text truncate group-hover:text-hh-ink">
                            {histItem.title}
                          </p>
                          <p className="text-[11px] text-hh-muted">{histItem.date}</p>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => navigate?.(item.overviewPage)}
                      className="w-full flex items-center gap-1 px-2 py-1.5 text-[12px] text-hh-primary hover:text-hh-primary/80 transition-colors"
                    >
                      <span>Bekijk alle{totalCount > 0 ? ` (${totalCount})` : ""}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </nav>

        <nav className="p-3 space-y-2 flex-shrink-0 border-t border-hh-border">
          {visibleBottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate?.(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "text-white font-medium bg-hh-primary"
                    : "text-hh-text hover:bg-hh-ui-50"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-[14px] leading-[20px] whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}

        </nav>

        {isAdmin && (
          <div className="p-4 border-t border-hh-border flex-shrink-0">
            <button
              onClick={() => navigate?.(userToAdminMap[currentPage] || "admin-dashboard")}
              className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-hh-border text-hh-muted hover:bg-hh-ui-50 hover:text-hh-text transition-colors text-[14px]"
            >
              <Eye className="w-4 h-4" />
              {!collapsed && <span>Admin View</span>}
            </button>
          </div>
        )}
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-full sm:w-80 p-0 flex flex-col bg-hh-bg">
          <SheetHeader className="px-4 py-4 border-b border-hh-border flex-shrink-0">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex flex-col items-start gap-0">
                <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HUGO</span>
                <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HERBOTS</span>
              </div>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 px-3 pb-3 pt-3 overflow-y-auto">
            {visibleMainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(item.id);
              const history = getHistoryForItem(item.historyType);

              return (
                <div key={item.id} className="mb-1">
                  <button
                    onClick={() => {
                      handleNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "text-white font-medium bg-hh-primary"
                        : "text-hh-text hover:bg-hh-ui-50"
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[14px] leading-[20px]">
                      {item.label === "Talk to Hugo AI" ? (
                        <>Talk to Hugo<sup className="text-[10px] ml-0.5">AI</sup></>
                      ) : item.label}
                    </span>
                  </button>

                  {isActive && item.historyType && (() => {
                    const hiddenIds = getHiddenIds('user', item.historyType === 'chat' ? 'chat' : 'analysis');
                    const visibleHistory = history.filter(h => !hiddenIds.has(h.id));
                    const totalCount = visibleHistory.length;
                    return (
                    <div className="ml-3 pl-4 border-l-2 border-hh-border space-y-0.5 -mt-0.5">
                      {visibleHistory.slice(0, 3).map((histItem) => (
                        <button
                          key={histItem.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectHistoryItem) {
                              onSelectHistoryItem(histItem.id, item.historyType);
                            } else {
                              if (/^\d+$/.test(histItem.id)) {
                                navigate?.(item.overviewPage || 'hugo-overview');
                                setMobileMenuOpen(false);
                                return;
                              }
                              if (item.historyType === 'chat') {
                                navigate?.('talk-to-hugo', { loadSessionId: histItem.id });
                              } else {
                                navigate?.('analysis-results', { conversationId: histItem.id, fromAdmin: false });
                              }
                            }
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left hover:bg-hh-ui-50 transition-colors cursor-pointer"
                        >
                          <div className="flex-1 min-w-0 pointer-events-none">
                            <p className="text-[14px] text-hh-text truncate">{histItem.title}</p>
                            <p className="text-[12px] text-hh-muted">{histItem.date}</p>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          navigate?.(item.overviewPage);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-1 px-3 py-2 text-[13px] text-hh-primary hover:text-hh-primary/80 transition-colors"
                      >
                        <span>Bekijk alle{totalCount > 0 ? ` (${totalCount})` : ""}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    );
                  })()}
                </div>
              );
            })}
          </nav>

          <div className="px-3 pb-3 space-y-1 flex-shrink-0 border-t border-hh-border pt-3">
            {visibleBottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate?.(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? "text-white font-medium bg-hh-primary"
                      : "text-hh-text hover:bg-hh-ui-50"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[14px] leading-[20px] whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}

            {isAdmin && (
              <div className="mt-1 pt-3 border-t border-hh-border">
                <button
                  onClick={() => {
                    navigate?.(userToAdminMap[currentPage] || "admin-dashboard");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-hh-muted hover:bg-hh-ui-50 hover:text-hh-text transition-colors text-[14px]"
                >
                  <Eye className="w-4 h-4" />
                  <span>Admin View</span>
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-16 bg-hh-bg border-b border-hh-border flex items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-hh-text hover:text-hh-ink p-2 rounded-lg hover:bg-hh-ui-50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className="hidden lg:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
              <Input
                placeholder="Zoek sessies, technieken..."
                className="pl-10 bg-hh-ui-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="hidden sm:flex lg:hidden" aria-label="Zoeken">
              <Search className="w-5 h-5" />
            </Button>

            <Button
              onClick={() => navigate?.("talk-to-hugo")}
              className="gap-2 h-10 px-3 sm:px-4 rounded-lg bg-hh-success hover:bg-hh-success/90 text-white"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline text-[14px]">
                Talk to Hugo<sup className="text-[10px] ml-0.5">AI</sup>
              </span>
            </Button>

            {/* Hugo Feedback Widget */}
            {onboardingMode && <HugoFeedbackWidget currentPage={currentPage} />}

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', cursor: 'pointer', border: 'none', background: 'transparent', position: 'relative', padding: 0 }}
              >
                <span style={{ display: 'inline-flex', width: '24px', height: '24px' }}>
                  <Bell style={{ width: '24px', height: '24px', color: resolvedTheme === 'dark' ? 'var(--hh-ui-200)' : 'var(--hh-text)', stroke: resolvedTheme === 'dark' ? 'var(--hh-ui-200)' : 'var(--hh-text)', fill: 'none', strokeWidth: 2, display: 'block' }} />
                </span>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', backgroundColor: 'var(--hh-error)', color: 'var(--hh-bg)', fontSize: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 w-[calc(100vw-32px)] sm:w-80 max-h-[400px] bg-hh-bg rounded-xl shadow-xl border border-hh-border z-50 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-hh-border flex-shrink-0">
                      <span className="text-[14px] font-semibold text-hh-ink">Notificaties</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllRead()}
                          className="flex items-center gap-1 text-[12px] text-hh-primary hover:text-hh-primary/80 transition-colors"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Alles gelezen
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[14px] text-hh-muted">
                          Geen notificaties
                        </div>
                      ) : (
                        notifications.slice(0, 20).map((notif) => (
                          <div
                            key={notif.id}
                            className={`relative w-full text-left px-3 py-2.5 border-b border-hh-border/50 hover:bg-hh-ui-50 transition-colors group cursor-pointer ${
                              !notif.read ? "bg-hh-primary/5" : ""
                            }`}
                            onClick={() => {
                              markAsRead(notif.id);
                              if (notif.type === "analysis_complete" && notif.conversationId && navigate) {
                                navigate("analysis-results", { conversationId: notif.conversationId });
                                setNotifOpen(false);
                              } else if (notif.relatedPage && navigate) {
                                navigate(notif.relatedPage);
                                setNotifOpen(false);
                              }
                            }}
                          >
                            <div className="flex items-start gap-2.5">
                              {!notif.read && (
                                <span className="mt-1.5 w-2 h-2 rounded-full bg-hh-primary flex-shrink-0" />
                              )}
                              <div className={`flex-1 min-w-0 ${notif.read ? "ml-[18px]" : ""}`}>
                                <p className="text-[13px] font-medium text-hh-ink truncate">
                                  {notif.title}
                                </p>
                                <p className="text-[12px] text-hh-muted mt-0.5 line-clamp-1">
                                  {notif.message}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[11px] text-hh-muted">
                                    {formatTimeAgo(notif.createdAt)}
                                  </span>
                                  {notif.type === "analysis_complete" && notif.conversationId && (
                                    <span className="flex items-center gap-1 text-[11px] text-hh-success font-medium">
                                      Bekijk resultaten
                                      <ExternalLink className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <UserMenu navigate={navigate} onLogout={() => navigate?.("logout")} />
          </div>
        </div>

        <div className={contentClassName || "flex-1 overflow-y-auto min-h-0 pb-20 lg:pb-8"}>
          {children}
          {!["talk-to-hugo", "admin-chat-expert", "admin-v3-chat"].includes(currentPage || "") && <PageFooter />}
        </div>
      </div>
      <NPSSurvey />
    </div>
  );
}
