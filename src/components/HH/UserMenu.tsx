import { useState } from "react";
import { useUser } from "../../contexts/UserContext";
import { useTheme } from "./ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { FeedbackDialog } from "./FeedbackDialog";
import {
  Settings,
  Diamond,
  Users,
  HelpCircle,
  MessageSquarePlus,
  Sun,
  Moon,
  Monitor,
  LogOut,
} from "lucide-react";

interface UserMenuProps {
  navigate?: (page: string) => void;
  onLogout?: () => void;
}

export function UserMenu({ navigate, onLogout }: UserMenuProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { user: currentUser, logout } = useUser();
  const { theme, setTheme } = useTheme();

  const getInitials = () => {
    if (!currentUser) return "U";
    if (currentUser.first_name && currentUser.last_name) {
      return `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase();
    }
    if (currentUser.full_name) {
      const parts = currentUser.full_name.split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return currentUser.full_name[0].toUpperCase();
    }
    return currentUser.email?.[0].toUpperCase() || "U";
  };

  const user = currentUser ? {
    name: [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") || currentUser.full_name || "User",
    email: currentUser.email,
    initials: getInitials(),
  } : {
    name: "User",
    email: "user@hugoherbots.ai",
    initials: "U",
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
    else if (navigate) navigate("landing");
    else logout();
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Licht', icon: Sun },
    { value: 'dark' as const, label: 'Donker', icon: Moon },
    { value: 'auto' as const, label: 'Auto', icon: Monitor },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none focus:ring-2 focus:ring-hh-primary rounded-full">
            <Avatar className="cursor-pointer hover:ring-2 hover:ring-hh-ui-200 transition-all">
              <AvatarFallback className="bg-hh-primary text-white text-[12px]">
                {user.initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[260px] p-0">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-hh-ui-200 text-hh-text text-[13px]">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-hh-text truncate">{user.name}</p>
              <p className="text-[12px] text-hh-muted truncate">{user.email}</p>
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Theme toggle */}
          <div className="px-3 py-2">
            <div className="flex gap-1 p-1 bg-hh-ui-50 rounded-lg">
              {themeOptions.map((opt) => {
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

          {/* Menu items — all 14px */}
          <div className="p-1">
            <DropdownMenuItem className="gap-3 py-2 px-3 cursor-pointer" onClick={() => navigate?.("settings")}>
              <Settings className="w-4 h-4 text-hh-muted" />
              <span className="text-[14px]">Instellingen</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2 px-3 cursor-pointer" onClick={() => navigate?.("settings:subscription")}>
              <Diamond className="w-4 h-4 text-hh-muted" />
              <span className="text-[14px]">Plans & Pricing</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2 px-3 cursor-pointer" onClick={() => navigate?.("settings:team")}>
              <Users className="w-4 h-4 text-hh-muted" />
              <span className="text-[14px]">Workspace</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2 px-3 cursor-pointer" onClick={() => navigate?.("help")}>
              <HelpCircle className="w-4 h-4 text-hh-muted" />
              <span className="text-[14px]">Help Center</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2 px-3 cursor-pointer" onClick={() => setFeedbackOpen(true)}>
              <MessageSquarePlus className="w-4 h-4 text-hh-muted" />
              <span className="text-[14px]">Feedback</span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator />

          {/* Logout */}
          <div className="p-1">
            <DropdownMenuItem
              className="gap-3 py-2 px-3 cursor-pointer text-hh-error"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[14px]">Uitloggen</span>
            </DropdownMenuItem>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-hh-border">
            <div className="flex gap-2 text-[11px] text-hh-muted">
              <a href="#" className="hover:text-hh-text underline">Privacy</a>
              <span>&middot;</span>
              <a href="#" className="hover:text-hh-text underline">Terms</a>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
