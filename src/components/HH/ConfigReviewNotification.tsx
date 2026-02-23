import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Bell, ArrowRight, Clock, FileText, Video } from "lucide-react";

interface PendingContentChange {
  type: 'video' | 'technique';
  id: string;
  original: Record<string, unknown>;
  edited: Record<string, unknown>;
  techniqueId?: string;
  timestamp: string;
  status?: 'pending' | 'approved' | 'rejected';
}

interface ConfigReviewNotificationProps {
  navigate?: (page: string) => void;
  onOpenChange?: (id: string) => void;
}

export function ConfigReviewNotification({
  navigate,
}: ConfigReviewNotificationProps) {
  const [pendingChanges, setPendingChanges] = useState<PendingContentChange[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadPendingChanges = useCallback(() => {
    const stored = localStorage.getItem('pendingConfigReview');
    if (stored) {
      try {
        const changes = JSON.parse(stored) as PendingContentChange[];
        setPendingChanges(changes.filter(c => (c.status || 'pending') === 'pending'));
      } catch (e) {
        console.error('Failed to parse pending config review:', e);
      }
    }
  }, []);

  useEffect(() => {
    loadPendingChanges();
    
    const interval = setInterval(() => {
      loadPendingChanges();
    }, 10 * 1000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pendingConfigReview') {
        loadPendingChanges();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadPendingChanges]);

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Zojuist";
    if (minutes < 60) return `${minutes}m geleden`;
    if (hours < 24) return `${hours}u geleden`;
    return `${days}d geleden`;
  };

  const getChangeName = (change: PendingContentChange): string => {
    if (change.type === 'video') {
      return (change.edited as { title?: string }).title || 
             (change.original as { title?: string }).title || 
             'Naamloze video';
    } else {
      return (change.edited as { naam?: string }).naam || 
             (change.original as { naam?: string }).naam || 
             'Naamloze techniek';
    }
  };

  const latestChanges = pendingChanges.slice(0, 5);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0 hover:bg-hh-ui-50"
        >
          <Bell className="h-5 w-5 text-slate-600" />
          {pendingChanges.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-red-600"
            >
              {pendingChanges.length > 99 ? "99+" : pendingChanges.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-hh-ink">
            Config Review
          </span>
          {pendingChanges.length > 0 && (
            <Badge
              variant="outline"
              className="text-[11px] bg-amber-50 text-amber-600 border-amber-200"
            >
              {pendingChanges.length} wachtend
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {latestChanges.length === 0 ? (
          <div className="p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <p className="text-[14px] font-medium text-hh-ink mb-1">
              Geen wijzigingen
            </p>
            <p className="text-[13px] text-hh-muted">
              Alle configuraties zijn up-to-date
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[400px] overflow-y-auto">
              {latestChanges.map((change, idx) => (
                <DropdownMenuItem
                  key={`${change.type}-${change.id}-${idx}`}
                  className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-hh-ui-50"
                  onClick={() => {
                    setIsOpen(false);
                    navigate?.("admin-config-review");
                  }}
                >
                  <div className="flex items-start justify-between w-full gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                        {change.type === 'video' ? (
                          <Video className="w-3 h-3 text-hh-primary" />
                        ) : (
                          <FileText className="w-3 h-3 text-hh-primary" />
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-50 text-amber-600 border-amber-200"
                      >
                        Pending
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-hh-muted shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(change.timestamp)}
                    </div>
                  </div>
                  <div className="w-full">
                    <p className="text-[13px] font-medium text-hh-text">
                      {getChangeName(change)}
                    </p>
                    {change.techniqueId && (
                      <p className="text-[11px] text-hh-muted mt-0.5">
                        Techniek {change.techniqueId}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center justify-center gap-2 p-3 font-medium text-hh-primary hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              onClick={() => {
                setIsOpen(false);
                navigate?.("admin-config-review");
              }}
            >
              Bekijk alle wijzigingen
              <ArrowRight className="w-4 h-4" />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
