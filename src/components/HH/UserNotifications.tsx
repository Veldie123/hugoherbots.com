import {
  Bell,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Check,
  Search,
  MoreVertical,
} from "lucide-react";
import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useNotifications } from "../../contexts/NotificationContext";
import React from "react";

interface UserNotificationsProps {
  navigate?: (page: string, data?: Record<string, any>) => void;
  isAdmin?: boolean;
}

type NotificationFilter = "all" | "unread" | "read";

export function UserNotifications({ navigate, isAdmin }: UserNotificationsProps) {
  const { notifications, markAsRead, markAllRead, removeNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<NotificationFilter>("all");

  const filteredNotifications = notifications.filter((n) => {
    const matchesSearch =
      searchQuery === "" ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && !n.read) ||
      (filter === "read" && n.read);
    return matchesSearch && matchesFilter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    if (notification.type === "analysis_complete" && notification.conversationId) {
      navigate?.("analysis-results", { conversationId: notification.conversationId });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "analysis_complete": return { icon: BarChart3, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" };
      case "info": return { icon: AlertCircle, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" };
      default: return { icon: Bell, color: "#64748b", bg: "rgba(100, 116, 139, 0.1)" };
    }
  };

  function formatTimeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Zojuist";
    if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} dagen geleden`;
    return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  return (
    <AppLayout currentPage="notifications" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="max-w-[50%]">
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Notificaties
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Je persoonlijke meldingen en updates
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={markAllRead}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Alles gelezen
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-hh-primary/10">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-hh-primary" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] text-hh-muted mb-1">Totaal</p>
            <p className="text-[24px] sm:text-[28px] text-hh-ink">{notifications.length}</p>
          </Card>
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-hh-warning/10">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-hh-warning" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] text-hh-muted mb-1">Ongelezen</p>
            <p className="text-[24px] sm:text-[28px] text-hh-ink">{unreadCount}</p>
          </Card>
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-hh-success/10">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-hh-success" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] text-hh-muted mb-1">Gelezen</p>
            <p className="text-[24px] sm:text-[28px] text-hh-ink">{readCount}</p>
          </Card>
        </div>

        <Card className="rounded-[16px] shadow-hh-sm border-hh-border p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek notificaties..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={(v: string) => setFilter(v as NotificationFilter)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Alle notificaties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle notificaties</SelectItem>
                <SelectItem value="unread">Ongelezen</SelectItem>
                <SelectItem value="read">Gelezen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="divide-y divide-hh-border">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-hh-muted mx-auto mb-4" />
                <p className="text-[14px] text-hh-muted">
                  {notifications.length === 0
                    ? "Nog geen notificaties — je wordt hier op de hoogte gehouden van analyses en updates"
                    : "Geen notificaties gevonden"}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const { icon: Icon, color, bg } = getIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 flex items-start gap-4 hover:bg-hh-ui-50 transition-colors cursor-pointer ${
                      !notification.read ? "bg-hh-primary/5" : ""
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: bg }}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`text-[14px] font-medium ${!notification.read ? "text-hh-text" : "text-hh-muted"}`}>
                            {notification.title}
                          </h3>
                          <p className="text-[13px] text-hh-muted mt-0.5">
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[12px] text-hh-muted whitespace-nowrap">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              {!notification.read && (
                                <DropdownMenuItem onClick={() => markAsRead(notification.id)}>
                                  <Check className="w-4 h-4 mr-2" />
                                  Markeer als gelezen
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-hh-error"
                                onClick={() => removeNotification(notification.id)}
                              >
                                Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-hh-primary/10 text-hh-primary border-hh-primary/20">
                          {notification.type === "analysis_complete" ? "Analyse" : "Systeem"}
                        </Badge>
                        {!notification.read && (
                          <Badge className="text-[10px] px-1.5 py-0.5 bg-hh-primary text-white">
                            Nieuw
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
