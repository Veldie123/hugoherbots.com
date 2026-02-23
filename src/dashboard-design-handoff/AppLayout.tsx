import { useState, useEffect } from "react";
import {
  Home,
  Video,
  PlaySquare,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  User,
  Menu,
  ChevronLeft,
  X,
  Youtube,
  Radio,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { AppFooter } from "./AppFooter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  navigate?: (page: string) => void;
}

const navItems = [
  // Core Features
  { id: "home", label: "Home", icon: Home, badge: null, group: "features" },
  { id: "roleplaychat", label: "Rollenspel Training", icon: PlaySquare, badge: null, group: "features" },
  { id: "videos", label: "Video Cursus", icon: Youtube, badge: null, group: "features" },
  { id: "live", label: "Live Coaching", icon: Radio, badge: null, group: "features" },
  { id: "overviewprogress", label: "Overzicht & Voortgang", icon: BookOpen, badge: null, group: "features" },
  // Support/Admin
  { id: "team", label: "Team", icon: Users, badge: null, group: "admin" },
  { id: "analytics", label: "Analytics", icon: BarChart3, badge: null, group: "admin" },
  { id: "settings", label: "Settings", icon: Settings, badge: null, group: "admin" },
];

export function AppLayout({ children, currentPage = "home", navigate }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      // Auto-collapse on mobile
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
      // Map nav item ids to actual page names
      const pageMap: Record<string, string> = {
        home: "dashboard",
        roleplaychat: "roleplaychat",
        overviewprogress: "overviewprogress",
        videos: "videos",
        live: "live",
        team: "team",
        analytics: "analytics",
        settings: "settings",
      };
      navigate(pageMap[pageId] || pageId);
    }
  };

  return (
    <div className="flex h-screen bg-hh-bg">
      {/* Desktop Sidebar - Hidden on mobile */}
      <div
        className={`hidden lg:flex ${
          collapsed ? "w-16" : "w-56"
        } bg-hh-bg border-r border-hh-border flex-col transition-all duration-300`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-hh-border">
          {!collapsed ? (
            <Logo variant="horizontal" className="text-hh-ink text-[14px]" />
          ) : (
            <div className="w-full flex justify-center">
              <Logo variant="icon" className="w-8 h-8 text-hh-ink" />
            </div>
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

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => item.group === "features")
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-hh-primary text-white"
                      : "text-hh-text hover:bg-hh-ui-50"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-[14px] leading-[20px] font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                  {!collapsed && item.badge && (
                    <Badge
                      variant="outline"
                      className="ml-auto bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[10px] px-1.5 py-0"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Admin Section - Sticky to bottom */}
        <div className="p-2 space-y-1 border-t border-hh-border">
          {navItems
            .filter((item) => item.group === "admin")
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-hh-primary text-white"
                      : "text-hh-text hover:bg-hh-ui-50"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-[14px] leading-[20px] font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="p-2 border-t border-hh-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(false)}
              className="w-full h-10"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Sidebar - Icon only */}
      <div className="lg:hidden w-16 bg-hh-bg border-r border-hh-border flex flex-col">
        {/* Logo Icon */}
        <div className="h-16 flex items-center justify-center border-b border-hh-border">
          <Logo variant="icon" className="w-8 h-8 text-hh-ink" />
        </div>

        {/* Navigation Icons Only */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-hh-primary text-white"
                    : "text-hh-text hover:bg-hh-ui-50"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-full sm:w-80 p-0">
          <SheetHeader className="px-6 py-4 border-b border-hh-border">
            <SheetTitle className="flex items-center justify-between">
              <Logo variant="horizontal" className="text-hh-ink text-[16px]" />
            </SheetTitle>
          </SheetHeader>
          <nav className="p-4 space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              const prevItem = navItems[index - 1];
              const showDivider = prevItem && prevItem.group !== item.group;
              
              return (
                <div key={item.id}>
                  {showDivider && (
                    <div className="my-3">
                      <div className="h-px bg-hh-border" />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      handleNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
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
                    {item.badge && (
                      <Badge
                        variant="outline"
                        className="ml-auto bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[10px] px-1.5 py-0"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                </div>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-16 bg-hh-bg border-b border-hh-border flex items-center justify-between px-3 sm:px-6">
          {/* Mobile: Menu button only (no logo - HH icon already in sidebar) */}
          <div className="flex items-center gap-3 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="h-10 w-10"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>

          {/* Desktop: Search */}
          <div className="hidden lg:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
              <Input
                placeholder="Zoek sessies, technieken..."
                className="pl-10 bg-hh-ui-50"
              />
            </div>
          </div>

          {/* Right side: Notifications + User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Search className="w-5 h-5 lg:hidden" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Bell className="w-5 h-5" />
            </Button>
            <UserMenu navigate={navigate} onLogout={() => navigate?.("landing")} />
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <div className="h-full flex flex-col">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
