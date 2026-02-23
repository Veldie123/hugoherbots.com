import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Bell,
  Menu,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Shield,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
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
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { useNotifications } from "../../contexts/NotificationContext";
import { getHiddenIds } from "../../utils/hiddenItems";
import { useTheme } from "./ThemeProvider";

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
  onOpenFlowDrawer?: () => void;
  isAdmin?: boolean;
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
  { id: "techniques", label: "E.P.I.C. Technieken", icon: Target },
  { id: "videos", label: "Video's", icon: Video },
  { id: "live", label: "Live Coaching", icon: Radio },
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
  onOpenFlowDrawer,
  isAdmin,
  contentClassName,
  chatHistory: chatHistoryProp = defaultChatHistory,
  analysisHistory: analysisHistoryProp,
  onSelectHistoryItem,
}: AppLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const shouldAutoCollapse = currentPage === 'video-watch';
  const [collapsed, setCollapsed] = useState(shouldAutoCollapse);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllRead, removeNotification } = useNotifications();

  const analysisHistory = analysisHistoryProp || fetchedAnalysisHistory;
  const chatHistory = chatHistoryProp.length > 0 ? chatHistoryProp : fetchedChatHistory;

  useEffect(() => {
    if (analysisHistoryProp) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/v2/analysis/list');
        if (!res.ok) return;
        const data = await res.json();
        const items: HistoryItem[] = (data.analyses || []).slice(0, 5).map((a: any) => ({
          id: a.id,
          techniqueNumber: "",
          title: a.title || 'Untitled',
          score: a.overallScore ?? undefined,
          date: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : '',
        }));
        setFetchedAnalysisHistory(items);
      } catch { }
    };
    fetchHistory();
  }, [analysisHistoryProp]);

  useEffect(() => {
    if (chatHistoryProp.length > 0) return;
    const fetchChatHistory = async () => {
      try {
        const res = await fetch('/api/user/sessions');
        if (!res.ok) return;
        const data = await res.json();
        const items: HistoryItem[] = (data.sessions || []).slice(0, 5).map((s: any) => ({
          id: s.id,
          techniqueNumber: s.nummer || '',
          title: s.naam || 'Sessie',
          score: s.score ?? undefined,
          date: s.date || '',
        }));
        setFetchedChatHistory(items);
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

  const getHistoryForItem = (historyType: "chat" | "analysis") => {
    return historyType === "chat" ? chatHistory : analysisHistory;
  };

  return (
    <div className="flex h-screen bg-hh-bg">
      <div
        data-sidebar-collapsed={collapsed ? 'true' : 'false'}
        className={`hidden lg:flex ${
          collapsed ? "w-[60px]" : "w-[200px]"
        } bg-hh-bg border-r border-hh-border flex-col transition-all duration-300 flex-shrink-0`}
      >
        <div className="h-16 flex items-center justify-between px-3 border-b border-hh-border flex-shrink-0">
          {!collapsed ? (
            <div className="flex flex-col items-start gap-0">
              <span className="text-[18px] leading-[22px] tracking-widest uppercase font-bold text-hh-ink">HUGO</span>
              <span className="text-[18px] leading-[22px] tracking-widest uppercase font-bold text-hh-ink">HERBOTS</span>
            </div>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex justify-center hover:opacity-70 transition-opacity"
              aria-label="Expand sidebar"
            >
              <Logo variant="icon" className="w-8 h-8" />
            </button>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="w-8 h-8 rounded-lg hover:bg-hh-ui-50 flex items-center justify-center text-hh-muted transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2 pt-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.id);
            const history = getHistoryForItem(item.historyType);

            return (
              <div key={item.id} className="mb-1">
                <button
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? "text-white font-medium"
                      : "text-hh-text hover:bg-hh-ui-50"
                  }`}
                  style={isActive ? { backgroundColor: '#4F7396' } : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-[14px] leading-[20px] font-normal whitespace-nowrap">
                      {item.label === "Talk to Hugo AI" ? (
                        <>Talk to Hugo<sup className="text-[10px] ml-0.5">AI</sup></>
                      ) : item.label === "Live Coaching" && !isAdmin ? "Webinars" : item.label}
                    </span>
                  )}
                </button>

                {!collapsed && isActive && (() => {
                  const hiddenIds = getHiddenIds('user', item.historyType === 'chat' ? 'chat' : 'analysis');
                  const visibleHistory = history.filter(h => !hiddenIds.has(h.id));
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
                              sessionStorage.setItem('analysisId', histItem.id);
                              sessionStorage.setItem('analysisFromHugo', 'true');
                            } else {
                              sessionStorage.removeItem('analysisFromHugo');
                            }
                            navigate?.('analysis-results', { conversationId: histItem.id });
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
                      <span>Bekijk alle{visibleHistory.length > 0 ? ` (${visibleHistory.length})` : ""}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </nav>

        <div className="px-2 pb-2 space-y-1 flex-shrink-0 border-t border-hh-border pt-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate?.(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? "text-white font-medium"
                    : "text-hh-text hover:bg-hh-ui-50"
                }`}
                style={isActive ? { backgroundColor: '#4F7396' } : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-[14px] leading-[20px] font-normal whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}

          {isAdmin && (
            <button
              onClick={() => navigate?.("admin-uploads")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-hh-border text-hh-muted hover:bg-hh-ui-50 hover:text-hh-text transition-colors text-[14px]"
            >
              <Eye className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Admin View</span>}
            </button>
          )}
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-full sm:w-80 p-0 flex flex-col bg-hh-bg">
          <SheetHeader className="px-4 py-4 border-b border-hh-border flex-shrink-0">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex flex-col items-start gap-0">
                <span className="text-[18px] leading-[22px] tracking-widest uppercase font-bold text-hh-ink">HUGO</span>
                <span className="text-[18px] leading-[22px] tracking-widest uppercase font-bold text-hh-ink">HERBOTS</span>
              </div>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 px-3 pb-3 pt-3 overflow-y-auto">
            {mainNavItems.map((item) => {
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
                        ? "text-white font-medium"
                        : "text-hh-text hover:bg-hh-ui-50"
                    }`}
                    style={isActive ? { backgroundColor: '#4F7396' } : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[15px] leading-[22px] font-normal">
                      {item.label === "Talk to Hugo AI" ? (
                        <>Talk to Hugo<sup className="text-[10px] ml-0.5">AI</sup></>
                      ) : item.label === "Live Coaching" && !isAdmin ? "Webinars" : item.label}
                    </span>
                  </button>

                  {isActive && (() => {
                    const hiddenIds = getHiddenIds('user', item.historyType === 'chat' ? 'chat' : 'analysis');
                    const visibleHistory = history.filter(h => !hiddenIds.has(h.id));
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
                                return;
                              }
                              if (item.historyType === 'chat') {
                                sessionStorage.setItem('analysisId', histItem.id);
                                sessionStorage.setItem('analysisFromHugo', 'true');
                              } else {
                                sessionStorage.removeItem('analysisFromHugo');
                              }
                              navigate?.('analysis-results', { conversationId: histItem.id });
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
                        <span>Bekijk alle{visibleHistory.length > 0 ? ` (${visibleHistory.length})` : ""}</span>
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
            {bottomNavItems.map((item) => {
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
                      ? "text-white font-medium"
                      : "text-hh-text hover:bg-hh-ui-50"
                  }`}
                  style={isActive ? { backgroundColor: '#4F7396' } : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[14px] leading-[20px] font-normal whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}

            {isAdmin && (
              <button
                onClick={() => {
                  navigate?.("admin-uploads");
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-hh-border text-hh-muted hover:bg-hh-ui-50 hover:text-hh-text transition-colors text-[14px]"
              >
                <Eye className="w-4 h-4" />
                <span>Admin View</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-16 bg-hh-bg border-b border-hh-border flex items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-hh-text hover:text-hh-ink p-1.5 rounded-lg hover:bg-hh-ui-50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {(currentPage === "coaching" || currentPage === "live" || currentPage === "analysis-results") && onOpenFlowDrawer && (
              <button
                onClick={onOpenFlowDrawer}
                className="text-hh-muted hover:text-hh-text p-1.5 rounded-lg hover:bg-hh-ui-50 transition-colors border border-hh-border"
                aria-label="Open Epic Sales Flow"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
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
            <Button variant="ghost" size="icon" className="hidden sm:flex lg:hidden">
              <Search className="w-5 h-5" />
            </Button>

            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-hh-ui-50 transition-colors" title={theme === 'dark' ? 'Licht thema' : 'Donker thema'}>
              {theme === 'dark' ? <Sun className="w-5 h-5 text-hh-text" /> : <Moon className="w-5 h-5 text-hh-text" />}
            </button>

            <Button
              onClick={() => navigate?.("talk-to-hugo")}
              className="gap-2 text-white h-10 px-3 sm:px-4"
              style={{ backgroundColor: '#1F2937' }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#374151')}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = '#1F2937')}
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline text-[14px]">
                Talk to Hugo<sup className="text-[10px] ml-0.5">AI</sup>
              </span>
            </Button>

            <div className="relative" ref={notifRef}>
              <button
                className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-hh-ui-50 transition-colors"
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <Bell style={{ width: '22px', height: '22px', color: isAdmin ? '#7C3AED' : '#1C2535', stroke: isAdmin ? '#7C3AED' : '#1C2535', strokeWidth: 2, display: 'block', minWidth: '22px', minHeight: '22px' }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 w-80 max-h-[400px] bg-hh-bg rounded-xl shadow-xl border border-hh-border z-50 overflow-hidden flex flex-col">
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
            <UserMenu navigate={navigate} onLogout={() => navigate?.("landing")} />
          </div>
        </div>

        <div className={contentClassName || "flex-1 overflow-y-auto min-h-0"}>
          {children}
        </div>
      </div>
    </div>
  );
}
