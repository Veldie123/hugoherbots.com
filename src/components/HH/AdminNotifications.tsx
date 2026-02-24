import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Info,
  TrendingUp,
  Users,
  Calendar,
  MessageSquare,
  Settings,
  Archive,
  Trash2,
  Check,
  Search,
  Filter,
  MoreVertical,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
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

interface AdminNotificationsProps {
  navigate?: (page: string) => void;
}

type NotificationFilter = "all" | "unread" | "read" | "archived";
type NotificationCategory = "all" | "system" | "users" | "sessions" | "content";

export function AdminNotifications({ navigate }: AdminNotificationsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [category, setCategory] = useState<NotificationCategory>("all");
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getTimeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'nu';
    if (mins < 60) return `${mins}m geleden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}u geleden`;
    const days = Math.floor(hours / 24);
    return `${days}d geleden`;
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v2/admin/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications((data.notifications || []).map((n: any) => ({
          id: n.id,
          type: n.severity === 'warning' ? 'warning' : n.severity === 'critical' ? 'warning' : n.type === 'correction_submitted' ? 'warning' : 'info',
          category: n.category || 'content',
          title: n.title,
          message: n.message,
          timestamp: getTimeAgo(new Date(n.created_at)),
          read: n.read,
          icon: n.type === 'correction_submitted' ? Settings : n.category === 'users' ? Users : n.category === 'system' ? CheckCircle2 : Zap,
          iconColor: n.severity === 'warning' ? 'text-orange-500' : n.severity === 'critical' ? 'text-red-500' : 'text-purple-500',
          iconBg: n.severity === 'warning' ? 'bg-orange-500/10' : n.severity === 'critical' ? 'bg-red-500/10' : 'bg-purple-500/10',
          action: n.related_page || undefined,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filteredNotifications = notifications.filter((notification) => {
    const matchesSearch =
      searchQuery === "" ||
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "read" && notification.read) ||
      (filter === "unread" && !notification.read);
    const matchesCategory =
      category === "all" || notification.category === category;
    return matchesSearch && matchesFilter && matchesCategory;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  const toggleSelection = (id: number) => {
    setSelectedNotifications((prev) =>
      prev.includes(id) ? prev.filter((nId) => nId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedNotifications(filteredNotifications.map((n) => n.id));
  };

  const deselectAll = () => {
    setSelectedNotifications([]);
  };

  const markAsRead = async () => {
    for (const id of selectedNotifications) {
      await fetch(`/api/v2/admin/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    }
    setNotifications(prev => prev.map(n => 
      selectedNotifications.includes(n.id) ? { ...n, read: true } : n
    ));
    setSelectedNotifications([]);
  };

  const archiveSelected = () => {
    console.log("Archive:", selectedNotifications);
    setSelectedNotifications([]);
  };

  const deleteSelected = () => {
    console.log("Delete:", selectedNotifications);
    setSelectedNotifications([]);
  };

  return (
    <AdminLayout currentPage="admin-notifications" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="max-w-[50%]">
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Notificaties
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer systeem notificaties en meldingen
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedNotifications.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={markAsRead}
                >
                  <Check className="w-4 h-4" />
                  <span className="hidden lg:inline">Markeer gelezen</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={archiveSelected}
                >
                  <Archive className="w-4 h-4" />
                  <span className="hidden lg:inline">Archiveer</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-red-600 hover:text-red-700"
                  onClick={deleteSelected}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden lg:inline">Verwijder</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* KPI Tiles - 4 columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Totaal Notificaties
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {notifications.length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-orange-500/10 text-orange-500 border-orange-500/20"
              >
                Nieuw
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Ongelezen
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {unreadCount}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Gelezen
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {readCount}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +12%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Deze week
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              24
            </p>
          </Card>
        </div>

        {/* Filter Card */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="space-y-3">
            {/* Row 1: Search + Bulk Actions */}
            <div className="flex items-center gap-3">
              {/* Search - Left Side */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
                <Input
                  placeholder="Zoek notificaties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {/* Bulk Actions - Right Side */}
              {selectedNotifications.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[12px]">
                    {selectedNotifications.length} geselecteerd
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAll}
                    className="text-[12px]"
                  >
                    Deselecteer
                  </Button>
                </div>
              )}
              {selectedNotifications.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">Alles</span>
                </Button>
              )}
            </div>

            {/* Row 2: Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={filter} onValueChange={(v) => setFilter(v as NotificationFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle notificaties</SelectItem>
                  <SelectItem value="unread">Ongelezen</SelectItem>
                  <SelectItem value="read">Gelezen</SelectItem>
                  <SelectItem value="archived">Gearchiveerd</SelectItem>
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={(v) => setCategory(v as NotificationCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Categorie filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle categorieën</SelectItem>
                  <SelectItem value="system">Systeem</SelectItem>
                  <SelectItem value="users">Gebruikers</SelectItem>
                  <SelectItem value="sessions">Sessies</SelectItem>
                  <SelectItem value="content">Content</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Notifications List */}
        <div className="space-y-2">
          {filteredNotifications.length === 0 ? (
            <Card className="p-8 rounded-[16px] border-hh-border text-center">
              <Bell className="w-12 h-12 text-hh-muted mx-auto mb-3" />
              <p className="text-[16px] text-hh-muted">
                {loading ? "Notificaties laden..." : "Nog geen notificaties. Notificaties verschijnen hier wanneer een admin wijzigingen indient."}
              </p>
            </Card>
          ) : (
            filteredNotifications.map((notification) => {
              const Icon = notification.icon;
              const isSelected = selectedNotifications.includes(notification.id);

              return (
                <Card
                  key={notification.id}
                  className={`p-4 rounded-[16px] border-hh-border transition-all ${
                    isSelected
                      ? "ring-2 ring-hh-primary bg-hh-primary/5"
                      : "hover:shadow-md"
                  } ${!notification.read ? "bg-blue-500/5" : "bg-card"}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelection(notification.id)}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-hh-primary border-hh-primary"
                          : "border-hh-border hover:border-hh-primary"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full ${notification.iconBg} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${notification.iconColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h3
                          className={`text-[15px] leading-[22px] ${
                            notification.read
                              ? "text-hh-text"
                              : "text-hh-ink font-semibold"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <span className="text-[12px] text-hh-muted whitespace-nowrap">
                          {notification.timestamp}
                        </span>
                      </div>
                      <p className="text-[14px] leading-[20px] text-hh-muted mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {notification.category}
                        </Badge>
                        {!notification.read && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
                          >
                            Nieuw
                          </Badge>
                        )}
                        {"action" in notification && notification.action && navigate && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                            onClick={() => {
                              const action = notification.action as string;
                              navigate(action.startsWith('admin-') ? action : `admin-${action}`);
                            }}
                          >
                            Bekijk
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Check className="w-4 h-4 mr-2" />
                          Markeer als gelezen
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="w-4 h-4 mr-2" />
                          Archiveer
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Verwijder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
