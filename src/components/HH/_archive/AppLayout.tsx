import { useState } from "react";
import {
  Home,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  Menu,
  ChevronLeft,
  Radio,
  GraduationCap,
  FileSearch,
  Shield,
  Sparkles,
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  navigate?: (page: string) => void;
  onOpenFlowDrawer?: () => void;
}

const mainNavItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "technieken", label: "E.P.I.C Technieken", icon: Sparkles },
  { id: "coaching", label: "Digital Coaching", icon: GraduationCap },
  { id: "live", label: "Live Coaching", icon: Radio },
  { id: "analysis", label: "Gesprek Analyse", icon: FileSearch },
];

const secondaryNavItems = [
  { id: "team", label: "Team", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AppLayout({ children, currentPage = "home", navigate, onOpenFlowDrawer }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useUser();
  
  const isAdmin = user?.email?.toLowerCase().endsWith('@hugoherbots.com') ?? false;

  const handleNavigate = (pageId: string) => {
    if (navigate) {
      const pageMap: Record<string, string> = {
        home: "dashboard",
        technieken: "technieken",
        coaching: "coaching",
        live: "live",
        analysis: "analysis",
        team: "team",
        analytics: "analytics",
        settings: "settings",
      };
      navigate(pageMap[pageId] || pageId);
    }
  };

  return (
    <div className="h-screen bg-hh-bg flex overflow-hidden">
      {/* Sidebar - Always visible, same structure as AdminLayout */}
      <aside
        className={`${
          collapsed ? "w-20" : "w-56"
        } bg-hh-bg border-r border-hh-border flex-shrink-0 flex flex-col transition-all duration-300`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-hh-border">
          {!collapsed ? (
            <Logo variant="horizontal" className="text-hh-ink text-[14px]" />
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex justify-center hover:opacity-70 transition-opacity"
              aria-label="Expand sidebar"
            >
              <Logo variant="icon" className="w-8 h-8 text-hh-ink" />
            </button>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-hh-primary text-white"
                    : "text-hh-text hover:bg-hh-ui-100"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-[14px] leading-[20px]">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Secondary Navigation - Fixed at bottom */}
        <div className="p-3 border-t border-hh-border space-y-1">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-hh-primary text-white"
                    : "text-hh-text hover:bg-hh-ui-100"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="text-[14px] leading-[20px]">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Admin View Button - Only for admins */}
        {isAdmin && (
          <div className="p-3 border-t border-hh-border">
            <Button
              variant="outline"
              className={`w-full gap-2 ${collapsed ? "justify-center px-0" : "justify-start"}`}
              onClick={() => navigate?.("admin-dashboard")}
            >
              <Shield className="w-4 h-4" />
              {!collapsed && <span className="text-[14px]">Admin View</span>}
            </Button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-hh-border flex items-center justify-between px-6 flex-shrink-0">
          {/* Left: Hamburger for flow drawer on coaching pages */}
          <div className="flex items-center gap-2">
            {(currentPage === "coaching" || currentPage === "live" || currentPage === "analysis-results") && onOpenFlowDrawer && (
              <button
                onClick={onOpenFlowDrawer}
                className="text-hh-muted hover:text-hh-text p-1.5 rounded-lg hover:bg-hh-ui-50 transition-colors lg:hidden"
                aria-label="Open Epic Sales Flow"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek sessies, technieken..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Right side: Notifications + User Menu */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Bell className="w-5 h-5" />
            </Button>
            <UserMenu navigate={navigate} onLogout={() => navigate?.("landing")} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
