import {
  LayoutDashboard,
  Video,
  Radio,
  Users,
  Target,
  Library,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Bell,
  User,
  LogOut,
  Eye,
  MessageSquare,
  ArrowLeftRight,
  HelpCircle,
  FileText,
  Upload,
  Menu,
  UserPlus,
  AlertCircle,
  Sparkles,
  Zap,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { Logo } from "./Logo";
import React, { useState, useEffect } from "react";
import { apiFetch } from "../../services/apiFetch";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { useTheme } from "./ThemeProvider";
import { PageFooter } from "./PageFooter";

interface HistoryItem {
  id: string;
  title: string;
  date: string;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  navigate?: (page: string, data?: Record<string, any>) => void;
  isSuperAdmin?: boolean;
  contentClassName?: string;
}

export function AdminLayout({ children, currentPage, navigate, isSuperAdmin: isSuperAdminProp, contentClassName }: AdminLayoutProps) {
  const { theme, setTheme } = useTheme();

  // Module mapping: admin view → user view equivalent
  const adminToUserMap: Record<string, string> = {
    'admin-dashboard': 'dashboard',
    'admin-techniques': 'techniques',
    'admin-videos': 'videos',
    'admin-live': 'live',
    'admin-uploads': 'analysis',
    'admin-upload-analysis': 'upload-analysis',
    'admin-analysis-results': 'analysis-results',
    'admin-sessions': 'hugo-overview',
    'admin-chat-expert': 'talk-to-hugo',
    'admin-v3-chat': 'talk-to-hugo',
    'admin-settings': 'settings',
    'admin-help': 'help',
    'admin-resources': 'resources',
  };

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentChatSessions, setRecentChatSessions] = useState<HistoryItem[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<HistoryItem[]>([]);
  const [analysisTotalCount, setAnalysisTotalCount] = useState(0);
  const [chatTotalCount, setChatTotalCount] = useState(0);
  const [adminUserName, setAdminUserName] = useState('Admin');
  const [adminUserRole, setAdminUserRole] = useState('Admin');
  const [adminUserInitials, setAdminUserInitials] = useState('AD');

  useEffect(() => {
    const loadAdminUser = async () => {
      try {
        const { auth } = await import('../../utils/supabase/client');
        const { session } = await auth.getSession();
        if (session?.user) {
          const email = (session.user.email || '').toLowerCase();
          const meta = session.user.user_metadata || {};
          const firstName = meta.first_name || meta.firstName || '';
          const lastName = meta.last_name || meta.lastName || '';
          const fullName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
          const initials = firstName && lastName
            ? `${firstName[0]}${lastName[0]}`.toUpperCase()
            : fullName.substring(0, 2).toUpperCase();
          const detectedSuperAdmin = email === 'stephane@hugoherbots.com';
          setAdminUserName(fullName);
          setAdminUserRole(detectedSuperAdmin ? 'Super Admin' : 'Admin');
          setAdminUserInitials(initials);
        }
      } catch {}
    };
    loadAdminUser();
  }, []);

  useEffect(() => {
    const fetchChatSessions = async () => {
      try {
        const res = await apiFetch('/api/user/sessions');
        if (!res.ok) return;
        const data = await res.json();
        const items: HistoryItem[] = (data.sessions || []).slice(0, 5).map((s: any) => ({
          id: s.id,
          title: s.naam || 'Sessie',
          date: s.date || '',
        }));
        setRecentChatSessions(items);
        setChatTotalCount(data.total || data.sessions?.length || 0);
      } catch { }
    };
    const fetchAnalyses = async () => {
      try {
        const res = await apiFetch('/api/v2/analysis/list?source=upload');
        if (!res.ok) return;
        const data = await res.json();
        const items: HistoryItem[] = (data.analyses || []).slice(0, 5).map((a: any) => ({
          id: a.id,
          title: a.title || 'Untitled',
          date: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : '',
        }));
        setRecentAnalyses(items);
        setAnalysisTotalCount(data.totalCount || data.analyses?.length || 0);
      } catch { }
    };
    fetchChatSessions();
    fetchAnalyses();
  }, []);

  // Auto-collapse sidebar on sub-pages (diepere navigatie)
  useEffect(() => {
    // Lijst van "diepere" pagina's waar de sidebar automatisch inklapt
    const subPages = [
      "admin-sessions-detail",
      "admin-video-detail",
      "admin-user-detail",
      "admin-technique-detail",
      "admin-transcript-detail",
      "admin-webinar-detail",
      "admin-upload-detail",
    ];

    // Klap in als we op een subpagina zijn
    if (subPages.includes(currentPage)) {
      setCollapsed(true);
    } else {
      // Klap uit als we terug naar hoofdpagina gaan - maar alleen voor desktop
      // Op mobile blijft het altijd collapsed
      if (window.innerWidth >= 1024) {
        setCollapsed(false);
      }
    }
  }, [currentPage]);

  useEffect(() => {
    const handleCollapseRequest = (e: CustomEvent) => {
      setCollapsed(e.detail?.collapsed ?? true);
    };
    window.addEventListener('sidebar-collapse-request', handleCollapseRequest as EventListener);
    return () => window.removeEventListener('sidebar-collapse-request', handleCollapseRequest as EventListener);
  }, []);

  const allMainNavItems = [
    { id: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "admin-techniques", label: "E.P.I.C. TECHNIQUE", icon: Target, superAdminOnly: true },
    { id: "admin-videos", label: "Video's", icon: Video },
    { id: "admin-live", label: "Webinars", icon: Radio },
    { id: "admin-uploads", label: "Gespreksanalyse", icon: Upload, historyType: "analysis" as const, overviewPage: "admin-uploads", superAdminOnly: true },
    { id: "admin-sessions", label: "Talk to Hugo", icon: MessageSquare, hasSuperscript: true, historyType: "chat" as const, overviewPage: "admin-sessions", superAdminOnly: true },
  ];
  const mainNavItems = allMainNavItems.filter(item => isSuperAdminProp || !item.superAdminOnly);

  const getHistoryForItem = (historyType?: "chat" | "analysis"): HistoryItem[] => {
    if (historyType === "chat") return recentChatSessions;
    if (historyType === "analysis") return recentAnalyses;
    return [];
  };

  const allAdminManagementItems = [
    { id: "admin-users", label: "Gebruikers", icon: Users, superAdminOnly: true },
    { id: "admin-analytics", label: "Analytics", icon: BarChart3 },
    { id: "admin-help", label: "Help Center", icon: HelpCircle, superAdminOnly: true },
    { id: "admin-resources", label: "Resources", icon: Library, superAdminOnly: true },
    { id: "admin-settings", label: "Instellingen", icon: Settings, superAdminOnly: true },
  ];
  const adminManagementItems = allAdminManagementItems.filter(item => isSuperAdminProp || !item.superAdminOnly);

  const handleNavigate = (page: string) => {
    setMobileMenuOpen(false);
    navigate?.(page);
  };

  // Helper to check if a nav item should be marked as active
  // This handles sub-pages being highlighted under their parent menu item
  const isNavItemActive = (itemId: string): boolean => {
    if (currentPage === itemId) return true;
    
    const analysisFromHugo = typeof window !== 'undefined' && sessionStorage.getItem('analysisFromHugo') === 'true';
    
    // Map sub-pages to their parent menu items
    const subPageMapping: Record<string, string> = {
      "admin-hugo-agent": "admin-sessions",
      "admin-chat-expert": "admin-sessions",
      "admin-sessions-detail": "admin-sessions",
      "admin-analysis-results": analysisFromHugo ? "admin-sessions" : "admin-uploads",
      "admin-upload-detail": "admin-uploads",
      "admin-transcript-detail": "admin-uploads",
    };
    
    return subPageMapping[currentPage] === itemId;
  };

  const [notifications, setNotifications] = useState<Array<{
    id: string; title: string; message: string; time: string;
    type: string; severity?: string; read: boolean;
  }>>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await apiFetch('/api/v2/admin/notifications');
        if (!res.ok) return;
        const data = await res.json();
        const items = (data.notifications || []).slice(0, 20).map((n: any) => ({
          id: String(n.id),
          title: n.title,
          message: n.message || '',
          time: formatTimeAgo(n.created_at),
          type: n.type === 'correction_submitted' ? 'config'
            : n.type === 'chat_feedback' ? 'user'
            : n.type === 'onboarding_feedback' ? 'config'
            : 'info',
          severity: n.severity === 'warning' ? 'medium' : n.severity === 'critical' ? 'high' : undefined,
          read: n.read || false,
        }));
        setNotifications(items);
        setUnreadCount(items.filter((n: any) => !n.read).length);
      } catch { }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  function formatTimeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Zojuist";
    if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d geleden`;
    return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await apiFetch(`/api/v2/admin/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
    } catch { }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiFetch('/api/v2/admin/notifications/read-all', {
        method: 'PATCH',
      });
    } catch { }
  };

  return (
    <div className="admin-session flex h-dvh bg-hh-bg" style={{ height: '100dvh' }}>
      {/* Mobile Menu Sheet - Full screen */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="admin-session w-full p-0 flex flex-col bg-hh-bg">
          <SheetHeader className="px-6 py-4 border-b border-hh-border flex-shrink-0">
            <SheetTitle className="flex items-center gap-3">
              <div className="flex flex-col items-start gap-0">
                <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HUGO</span>
                <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HERBOTS</span>
              </div>
              <Badge className="bg-hh-primary text-white border-0 text-[10px] px-2 py-0.5 self-start mt-0.5">
                ADMIN
              </Badge>
            </SheetTitle>
          </SheetHeader>

          {/* Mobile Navigation - Split top/bottom */}
          <div className="flex-1 flex flex-col justify-between overflow-y-auto">
            {/* Top section */}
            <nav className="p-4 space-y-1">
              {/* Primary items */}
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(item.id);
                const history = getHistoryForItem((item as any).historyType);

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-hh-primary text-white"
                          : "text-hh-text hover:bg-hh-ui-50"
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-[16px] leading-[24px] font-normal">
                        {(item as any).hasSuperscript ? (
                          <>{item.label} <sup className="text-[11px]">AI</sup></>
                        ) : item.label}
                      </span>
                    </button>

                    {isActive && history.length > 0 && (
                      <div className="ml-3 pl-4 border-l-2 border-hh-primary/30 space-y-0.5 -mt-0.5">
                        {history.slice(0, 3).map((histItem) => (
                          <button
                            key={histItem.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const historyType = (item as any).historyType;
                              if (historyType === "chat") {
                                sessionStorage.setItem('analysisFromHugo', 'true');
                                navigate?.('admin-chat-expert', { sessionId: histItem.id });
                              } else {
                                sessionStorage.setItem('analysisFromHugo', 'false');
                                navigate?.('admin-analysis-results', { conversationId: histItem.id, fromAdmin: true });
                              }
                              setMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-hh-primary/10 transition-colors cursor-pointer"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] text-hh-text truncate">{histItem.title}</p>
                              <p className="text-[12px] text-hh-muted">{histItem.date}</p>
                            </div>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            navigate?.((item as any).overviewPage);
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-1 px-3 py-2 text-[13px] text-hh-primary hover:text-hh-primary transition-colors"
                        >
                          <span>Bekijk alle{history.length > 0 ? ` (${history.length})` : ""}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Bottom section */}
            <div className="border-t border-hh-border">
              <nav className="p-4 space-y-1">
                {/* Secondary items */}
                {adminManagementItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-hh-primary text-white"
                          : "text-hh-text hover:bg-hh-ui-50"
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-[16px] leading-[24px] font-medium">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </nav>

              {/* User View switch - Bottom */}
              <div className="p-4 border-t border-hh-border">
                <Button
                  variant="outline"
                  className="w-full gap-2 justify-start h-12"
                  onClick={() => handleNavigate(adminToUserMap[currentPage] || "dashboard")}
                >
                  <Eye className="w-5 h-5" />
                  <span className="text-[16px] font-normal">User View</span>
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - In-flow flex child */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 ${
          collapsed ? "w-16" : "w-56"
        } bg-hh-bg border-r border-hh-border transition-all duration-300 h-dvh`}
      >
        {/* Logo - Fixed top - Klikbaar voor collapse/expand */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-16 flex items-center justify-start px-3 border-b border-hh-border flex-shrink-0 hover:bg-hh-ui-50 transition-colors cursor-pointer"
        >
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start gap-0">
                <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HUGO</span>
                <span className="text-[20px] leading-[24px] tracking-[0.15em] uppercase font-bold text-hh-ink">HERBOTS</span>
              </div>
              <Badge className="bg-hh-primary text-white border-0 text-[10px] px-2 py-0.5 self-start mt-0.5">
                ADMIN
              </Badge>
            </div>
          ) : (
            <Logo variant="icon" className="w-8 h-8 text-hh-ink" />
          )}
        </button>

        {/* Primary Navigation - Scrollable if needed */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.id);
            const history = getHistoryForItem((item as any).historyType);

            return (
              <div key={item.id}>
                <button
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? "bg-hh-primary-100 text-hh-primary border-l-2 border-hh-primary"
                      : "text-hh-text hover:bg-hh-ui-100"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-[14px] leading-[20px]">
                      {(item as any).hasSuperscript ? (
                        <>{item.label} <sup className="text-[10px]">AI</sup></>
                      ) : item.label}
                    </span>
                  )}
                </button>

                {!collapsed && isActive && history.length > 0 && (
                  <div className="ml-2 pl-4 border-l-2 border-hh-primary-200 space-y-0.5 -mt-0.5">
                    {history.slice(0, 3).map((histItem) => (
                      <button
                        key={histItem.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const historyType = (item as any).historyType;
                          if (historyType === "chat") {
                            sessionStorage.setItem('analysisFromHugo', 'true');
                            navigate?.('admin-chat-expert', { sessionId: histItem.id });
                          } else {
                            sessionStorage.setItem('analysisFromHugo', 'false');
                            navigate?.('admin-analysis-results', { conversationId: histItem.id, fromAdmin: true });
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-hh-primary/10 transition-colors group cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-hh-text truncate group-hover:text-hh-primary">{histItem.title}</p>
                          <p className="text-[11px] text-hh-muted">{histItem.date}</p>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => navigate?.((item as any).overviewPage)}
                      className="w-full flex items-center gap-1 px-2 py-1.5 text-[12px] text-hh-primary hover:text-hh-primary-dark transition-colors"
                    >
                      <span>Bekijk alle{history.length > 0 ? ` (${history.length})` : ""}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Management Section - Fixed at bottom (no scroll) */}
        <nav className="p-3 space-y-2 border-t border-hh-border flex-shrink-0">
          {adminManagementItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.id);

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-hh-primary-100 text-hh-primary border-l-2 border-hh-primary"
                    : "text-hh-text hover:bg-hh-ui-100"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-[14px] leading-[20px]">
                    {(item as any).hasSuperscript ? (
                      <>{item.label} <sup className="text-[10px]">AI</sup></>
                    ) : item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-hh-border flex-shrink-0">
          <button
            onClick={() => navigate?.(adminToUserMap[currentPage] || "dashboard")}
            className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-hh-border text-hh-muted hover:bg-hh-ui-50 hover:text-hh-text transition-colors text-[14px]"
          >
            <Eye className="w-4 h-4" />
            {!collapsed && <span>User View</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

        {/* Admin Topbar - STICKY */}
        <header className="h-16 bg-hh-bg border-b border-hh-border flex items-center justify-between px-3 sm:px-6 flex-shrink-0">
          {/* Left: Hamburger (mobile) + Search */}
          <div className="flex items-center gap-3 flex-1">
            {/* Hamburger menu - mobile only */}
            <button
              className="lg:hidden text-hh-text hover:text-hh-ink p-2 rounded-lg hover:bg-hh-ui-50 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Search */}
            <div className="flex-1 max-w-md hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
                <Input
                  placeholder="Zoek video's, users, sessies..."
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Quick Actions + User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate?.("admin-chat-expert")}
              className="flex items-center gap-2 text-white h-10 px-3 sm:px-4 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--hh-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hh-primary-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--hh-primary)')}
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline text-[14px]">
                Talk to Hugo<sup className="text-[10px] ml-0.5">AI</sup>
              </span>
            </button>

            {/* Notifications Bell - Purple for Admin */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', cursor: 'pointer', border: 'none', background: 'transparent', position: 'relative', padding: 0 }}
              >
                <span style={{ display: 'inline-flex', width: '24px', height: '24px', color: '#7C3AED' }}>
                  <Bell style={{ width: '24px', height: '24px', color: '#7C3AED', stroke: '#7C3AED', fill: 'none', strokeWidth: 2, display: 'block' }} />
                </span>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', backgroundColor: '#DC2626', color: 'white', fontSize: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 top-11 w-[calc(100vw-32px)] sm:w-80 max-h-[400px] bg-hh-bg rounded-xl shadow-xl border border-hh-border z-50 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-hh-border flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[14px] font-semibold text-hh-text">
                          Notificaties
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[12px]"
                          onClick={markAllAsRead}
                        >
                          Alles gelezen
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-96">
                      {notifications.map((notif: any) => (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-hh-border last:border-0 hover:bg-hh-ui-50 cursor-pointer ${
                            !notif.read ? "bg-hh-primary/5" : ""
                          }`}
                          onClick={() => {
                            markAsRead(notif.id);
                            if (notif.type === "config") {
                              navigate?.("admin-config-review");
                              setNotificationsOpen(false);
                            } else if (notif.type === "rag") {
                              navigate?.("admin-rag-review");
                              setNotificationsOpen(false);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                !notif.read ? "bg-hh-primary" : "bg-transparent"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className="text-[13px] text-hh-text font-medium">
                                  {notif.title}
                                </p>
                                {notif.severity === "high" && (
                                  <Badge className="bg-hh-error text-white border-0 text-[9px] px-1.5 py-0 flex-shrink-0">
                                    HIGH
                                  </Badge>
                                )}
                                {notif.severity === "medium" && (
                                  <Badge className="bg-orange-600 text-white border-0 text-[9px] px-1.5 py-0 flex-shrink-0">
                                    MED
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[12px] text-hh-muted line-clamp-2">
                                {notif.message}
                              </p>
                              <p className="text-[11px] text-hh-muted mt-1">
                                {notif.time}
                              </p>
                            </div>
                            {notif.type === "video" && (
                              <Video className="w-4 h-4 text-hh-primary flex-shrink-0" />
                            )}
                            {notif.type === "user" && (
                              <UserPlus className="w-4 h-4 text-hh-success flex-shrink-0" />
                            )}
                            {notif.type === "config" && (
                              <AlertCircle className="w-4 h-4 text-hh-error flex-shrink-0" />
                            )}
                            {notif.type === "rag" && (
                              <Zap className="w-4 h-4 text-hh-primary flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 border-t border-hh-border flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center text-[12px]"
                        onClick={() => { navigate?.("admin-notifications"); setNotificationsOpen(false); }}
                      >
                        Alle notificaties
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none focus:ring-2 focus:ring-hh-primary rounded-full">
                  <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-hh-ui-200 transition-all">
                    <AvatarFallback className="bg-hh-primary text-white text-[12px]">
                      {adminUserInitials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Theme Picker */}
                <div className="px-3 py-2">
                  <p className="text-[11px] leading-[14px] text-hh-muted font-medium mb-1.5">Weergave</p>
                  <div className="flex gap-1 p-1 bg-hh-ui-50 rounded-lg">
                    {([
                      { value: 'light' as const, label: 'Licht', icon: Sun },
                      { value: 'dark' as const, label: 'Donker', icon: Moon },
                      { value: 'auto' as const, label: 'Auto', icon: Monitor },
                    ]).map((opt) => {
                      const Icon = opt.icon;
                      const isActive = theme === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTheme(opt.value); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                            isActive
                              ? "bg-hh-bg text-hh-text shadow-sm"
                              : "text-hh-muted hover:text-hh-text"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate?.(adminToUserMap[currentPage] || "dashboard")}>
                  <Eye className="w-4 h-4 mr-2" />
                  Switch to User View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate("admin-settings")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Admin Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-hh-error"
                  onClick={() => navigate?.("landing")}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Uitloggen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className={contentClassName || "flex-1 overflow-y-auto overflow-x-hidden"}>
          {children}
          <PageFooter />
        </main>
      </div>
    </div>
  );
}