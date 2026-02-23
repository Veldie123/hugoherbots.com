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
import { useState } from "react";
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

  const notifications = [
    {
      id: 9,
      type: "warning",
      category: "content",
      title: "RAG techniek review vraagt jouw aandacht",
      message: "Er zijn nieuwe technieksuggesties die je moet reviewen",
      timestamp: "nu",
      read: false,
      icon: Zap,
      iconColor: "text-purple-500",
      iconBg: "bg-purple-500/10",
      action: "admin-rag-review",
    },
    {
      id: 1,
      type: "success",
      category: "users",
      title: "Nieuwe gebruiker geregistreerd",
      message: "Jan de Vries heeft zich aangemeld voor het Pro abonnement",
      timestamp: "2 min geleden",
      read: false,
      icon: Users,
      iconColor: "text-green-500",
      iconBg: "bg-green-500/10",
    },
    {
      id: 2,
      type: "warning",
      category: "sessions",
      title: "Live sessie start binnenkort",
      message: "Discovery Technieken Q&A begint over 15 minuten",
      timestamp: "15 min geleden",
      read: false,
      icon: Calendar,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
    },
    {
      id: 3,
      type: "info",
      category: "content",
      title: "Nieuwe feedback ontvangen",
      message: "5 nieuwe reviews voor SPIN Questioning Workshop",
      timestamp: "1 uur geleden",
      read: false,
      icon: MessageSquare,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
    {
      id: 4,
      type: "success",
      category: "system",
      title: "Database backup voltooid",
      message: "Automatische backup succesvol afgerond",
      timestamp: "2 uur geleden",
      read: true,
      icon: CheckCircle2,
      iconColor: "text-green-500",
      iconBg: "bg-green-500/10",
    },
    {
      id: 5,
      type: "info",
      category: "users",
      title: "Gebruikersactiviteit stijgt",
      message: "42% meer actieve gebruikers deze week",
      timestamp: "3 uur geleden",
      read: true,
      icon: TrendingUp,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
    {
      id: 6,
      type: "warning",
      category: "system",
      title: "Server gebruik hoog",
      message: "CPU gebruik heeft 85% bereikt",
      timestamp: "5 uur geleden",
      read: true,
      icon: AlertCircle,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
    },
    {
      id: 7,
      type: "info",
      category: "sessions",
      title: "Sessie opname beschikbaar",
      message: "Cold Calling Best Practices opname is beschikbaar",
      timestamp: "1 dag geleden",
      read: true,
      icon: Calendar,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
    {
      id: 8,
      type: "success",
      category: "users",
      title: "Nieuwe team toegevoegd",
      message: "TechCorp heeft 12 nieuwe gebruikers toegevoegd",
      timestamp: "2 dagen geleden",
      read: true,
      icon: Users,
      iconColor: "text-green-500",
      iconBg: "bg-green-500/10",
    },
  ];

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

  const markAsRead = () => {
    console.log("Mark as read:", selectedNotifications);
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
                Geen notificaties gevonden
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
                  } ${!notification.read ? "bg-blue-50/50" : "bg-white"}`}
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
                            className="h-6 text-[11px] px-2 border-purple-300 text-purple-700 hover:bg-purple-50"
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
