import { useState } from "react";
import { useUser } from "../../contexts/UserContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import {
  Diamond,
  Settings,
  User,
  HelpCircle,
  Sun,
  LogOut,
  ChevronRight,
  Check,
  Users,
} from "lucide-react";

interface UserMenuProps {
  navigate?: (page: string) => void;
  onLogout?: () => void;
}

export function UserMenu({ navigate, onLogout }: UserMenuProps) {
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const { user: currentUser, workspace: currentWorkspace, logout } = useUser();

  // Generate initials from user data
  const getInitials = () => {
    if (!currentUser) return "U";
    if (currentUser.first_name && currentUser.last_name) {
      return `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase();
    }
    if (currentUser.full_name) {
      const parts = currentUser.full_name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return currentUser.full_name[0].toUpperCase();
    }
    return currentUser.email?.[0].toUpperCase() || "U";
  };

  // Real user data from context (or fallback to mock for preview mode)
  const user = currentUser ? {
    firstName: currentUser.first_name || currentUser.full_name?.split(" ")[0] || "User",
    lastName: currentUser.last_name || currentUser.full_name?.split(" ")[1] || "",
    email: currentUser.email,
    initials: getInitials(),
  } : {
    firstName: "Jan",
    lastName: "de Vries",
    email: "jan.devries@hugoherbots.ai",
    initials: "JD",
  };

  const workspace = currentWorkspace ? {
    name: currentWorkspace.name,
    teamSize: 1, // TODO: Fetch from memberships
    type: currentWorkspace.plan_tier === 'team' ? 'Team' : 'Personal',
  } : {
    name: "Hugo Herbots",
    teamSize: 1,
    type: "Team",
  };

  const handleNavigate = (page: string) => {
    if (navigate) {
      navigate(page);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else if (navigate) {
      // Default: navigate to landing page
      navigate("landing");
    } else {
      logout();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none focus:ring-2 focus:ring-hh-primary rounded-full">
            <Avatar className="cursor-pointer hover:ring-2 hover:ring-hh-ui-200 transition-all">
              <AvatarFallback className="bg-hh-primary text-white">
                {user.initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] p-0">
          {/* Personal Section */}
          <div className="p-4 pb-3">
            <DropdownMenuLabel className="px-0 pb-3 text-[14px] leading-[20px] text-hh-muted font-normal">
              Personal
            </DropdownMenuLabel>
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-hh-ui-100 text-hh-text text-[20px] leading-[28px]">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] leading-[24px] font-semibold text-hh-text truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[14px] leading-[20px] text-hh-muted truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Workspace Section */}
          <div className="p-4 py-3">
            <DropdownMenuLabel className="px-0 pb-3 text-[14px] leading-[20px] text-hh-muted font-normal">
              Workspace
            </DropdownMenuLabel>
            <button
              onClick={() => setWorkspaceDialogOpen(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-hh-ui-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-hh-ui-100 flex items-center justify-center">
                <div className="w-6 h-6 rounded bg-hh-primary/20 flex items-center justify-center">
                  <span className="text-[12px] leading-[16px] font-semibold text-hh-primary">
                    HH
                  </span>
                </div>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[16px] leading-[24px] font-semibold text-hh-text truncate">
                  {workspace.name}
                </p>
                <div className="flex items-center gap-2 text-[14px] leading-[20px] text-hh-muted">
                  <Users className="w-3.5 h-3.5" />
                  <span>{workspace.teamSize}</span>
                  <span>•</span>
                  <span>{workspace.type}</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-hh-muted group-hover:text-hh-text transition-colors" />
            </button>
          </div>

          <DropdownMenuSeparator />

          {/* Menu Items */}
          <div className="p-2">
            <DropdownMenuItem
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => navigate?.("settings:subscription")}
            >
              <Diamond className="w-5 h-5 text-hh-warn" />
              <span className="text-[16px] leading-[24px]">Plans & Pricing</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => handleNavigate("settings")}
            >
              <Settings className="w-5 h-5 text-hh-muted" />
              <span className="text-[16px] leading-[24px]">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => navigate?.("settings:team")}
            >
              <User className="w-5 h-5 text-hh-muted" />
              <span className="text-[16px] leading-[24px]">Manage Workspace</span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator />

          {/* Help & Resources */}
          <div className="p-2">
            <DropdownMenuItem 
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => handleNavigate("help")}
            >
              <HelpCircle className="w-5 h-5 text-hh-muted" />
              <span className="text-[16px] leading-[24px]">Help Center</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => handleNavigate("resources")}
            >
              <Sun className="w-5 h-5 text-hh-muted" />
              <span className="text-[16px] leading-[24px]">Resources</span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator />

          {/* Logout */}
          <div className="p-2">
            <DropdownMenuItem
              className="gap-3 py-2.5 px-3 cursor-pointer text-hh-text hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[16px] leading-[24px]">Log out</span>
            </DropdownMenuItem>
          </div>

          {/* Footer Links */}
          <div className="p-4 pt-3 border-t border-hh-border">
            <div className="flex flex-wrap gap-2 text-[14px] leading-[20px]">
              <a
                href="#"
                className="text-hh-muted hover:text-hh-text underline transition-colors"
              >
                Privacy
              </a>
              <span className="text-hh-muted">and</span>
              <a
                href="#"
                className="text-hh-muted hover:text-hh-text underline transition-colors"
              >
                Terms
              </a>
            </div>
            <a
              href="#"
              className="text-[14px] leading-[20px] text-hh-muted hover:text-hh-text underline transition-colors mt-1 inline-block"
            >
              Cookie preference
            </a>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Workspace Selector Dialog */}
      <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-[24px] leading-[32px] text-hh-text">
              Change Workspace
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-[20px] text-hh-muted">
              Select a workspace to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {/* Current Workspace (selected) */}
            <button className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-hh-ui-50 transition-colors border-2 border-hh-primary bg-hh-primary/5">
              <div className="w-12 h-12 rounded-lg bg-hh-ui-100 flex items-center justify-center">
                <div className="w-8 h-8 rounded bg-hh-primary/20 flex items-center justify-center">
                  <span className="text-[14px] leading-[20px] font-semibold text-hh-primary">
                    HH
                  </span>
                </div>
              </div>
              <div className="flex-1 text-left">
                <p className="text-[18px] leading-[26px] font-semibold text-hh-text">
                  {workspace.name}
                </p>
                <div className="flex items-center gap-2 text-[14px] leading-[20px] text-hh-muted">
                  <Users className="w-4 h-4" />
                  <span>{workspace.teamSize} {workspace.teamSize === 1 ? 'gebruiker' : 'gebruikers'}</span>
                  <span>•</span>
                  <span>{workspace.type}</span>
                </div>
              </div>
              <Check className="w-6 h-6 text-hh-primary" />
            </button>

            {/* Add more workspaces here if user has multiple */}
            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setWorkspaceDialogOpen(false)}
              >
                Maak nieuwe workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}