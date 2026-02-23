import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Info,
  TrendingUp,
  Play,
  Calendar,
  MessageSquare,
  Award,
  Check,
  Search,
  MoreVertical,
} from "lucide-react";
import { useState } from "react";
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

interface UserNotificationsProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

type NotificationFilter = "all" | "unread" | "read";
type NotificationCategory = "all" | "coaching" | "videos" | "progress" | "system";

export function UserNotifications({ navigate, isAdmin }: UserNotificationsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [category, setCategory] = useState<NotificationCategory>("all");

  const notifications = [
    {
      id: 1,
      type: "success",
      category: "progress",
      title: "Nieuwe badge verdiend!",
      message: "Je hebt de 'Ontdekking Master' badge behaald door 10 technieken te voltooien",
      timestamp: "10 min geleden",
      read: false,
      icon: Award,
      iconColor: "#22c55e",
      iconBg: "rgba(34, 197, 94, 0.1)",
    },
    {
      id: 2,
      type: "info",
      category: "coaching",
      title: "Live sessie vandaag",
      message: "Discovery Technieken Q&A met Hugo begint om 14:00",
      timestamp: "1 uur geleden",
      read: false,
      icon: Calendar,
      iconColor: "#3b82f6",
      iconBg: "rgba(59, 130, 246, 0.1)",
    },
    {
      id: 3,
      type: "success",
      category: "videos",
      title: "Nieuwe video beschikbaar",
      message: "#2.3 Bezwaartechnieken is nu te bekijken in je bibliotheek",
      timestamp: "2 uur geleden",
      read: false,
      icon: Play,
      iconColor: "#22c55e",
      iconBg: "rgba(34, 197, 94, 0.1)",
    },
    {
      id: 4,
      type: "info",
      category: "progress",
      title: "Wekelijkse voortgang",
      message: "Je hebt deze week 3 video's bekeken en 2 oefeningen voltooid",
      timestamp: "1 dag geleden",
      read: true,
      icon: TrendingUp,
      iconColor: "#3b82f6",
      iconBg: "rgba(59, 130, 246, 0.1)",
    },
    {
      id: 5,
      type: "warning",
      category: "coaching",
      title: "Sessie herinnering",
      message: "Je bent ingeschreven voor de webinar morgen om 10:00",
      timestamp: "1 dag geleden",
      read: true,
      icon: AlertCircle,
      iconColor: "#f97316",
      iconBg: "rgba(249, 115, 22, 0.1)",
    },
    {
      id: 6,
      type: "success",
      category: "progress",
      title: "Streak bereikt!",
      message: "7 dagen op rij actief - blijf zo doorgaan!",
      timestamp: "2 dagen geleden",
      read: true,
      icon: CheckCircle2,
      iconColor: "#22c55e",
      iconBg: "rgba(34, 197, 94, 0.1)",
    },
    {
      id: 7,
      type: "info",
      category: "system",
      title: "Welkom bij Hugo Herbots",
      message: "Begin met de Openingsfase technieken voor de beste resultaten",
      timestamp: "1 week geleden",
      read: true,
      icon: Info,
      iconColor: "#3b82f6",
      iconBg: "rgba(59, 130, 246, 0.1)",
    },
  ];

  const filteredNotifications = notifications.filter((n) => {
    const matchesSearch =
      searchQuery === "" ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && !n.read) ||
      (filter === "read" && n.read);
    const matchesCategory = category === "all" || n.category === category;
    return matchesSearch && matchesFilter && matchesCategory;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;
  const coachingCount = notifications.filter((n) => n.category === "coaching").length;
  const videosCount = notifications.filter((n) => n.category === "videos").length;

  const markAllAsRead = () => {
    console.log("Marking all as read");
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (notification.category === "videos") {
      navigate?.("videos");
    } else if (notification.category === "coaching") {
      navigate?.("live");
    } else if (notification.category === "progress") {
      navigate?.("dashboard");
    }
  };

  const getCategoryBadgeStyle = (cat: string) => {
    switch (cat) {
      case "coaching":
        return { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)' };
      case "videos":
        return { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.2)' };
      case "progress":
        return { backgroundColor: 'rgba(30, 58, 95, 0.1)', color: '#1e3a5f', borderColor: 'rgba(30, 58, 95, 0.2)' };
      case "system":
        return { backgroundColor: 'rgba(100, 116, 139, 0.1)', color: '#64748b', borderColor: 'rgba(100, 116, 139, 0.2)' };
      default:
        return { backgroundColor: 'rgba(100, 116, 139, 0.1)', color: '#64748b', borderColor: 'rgba(100, 116, 139, 0.2)' };
    }
  };

  return (
    <AppLayout currentPage="notifications" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="max-w-[50%]">
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Notificaties
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Je persoonlijke meldingen en updates
            </p>
          </div>
          <Button
            variant="outline"
            onClick={markAllAsRead}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Alles gelezen
          </Button>
        </div>

        {/* KPI Tiles - Same style as Admin View but with Steel Blue accent */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(30, 58, 95, 0.1)' }}
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#1e3a5f' }} />
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
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)' }}
              >
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#f97316' }} />
              </div>
              {unreadCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5"
                  style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.2)' }}
                >
                  Nieuw
                </Badge>
              )}
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
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#22c55e' }} />
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
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
              >
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#3b82f6' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5"
                style={{ backgroundColor: 'rgba(0, 195, 137, 0.1)', color: '#00c389', borderColor: 'rgba(0, 195, 137, 0.2)' }}
              >
                +12%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Deze week
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {coachingCount + videosCount}
            </p>
          </Card>
        </div>

        {/* Search & Filters - Same style as Admin */}
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
            <div className="flex gap-2 w-full sm:w-auto">
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
              <Select value={category} onValueChange={(v: string) => setCategory(v as NotificationCategory)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Alle categorieën" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle categorieën</SelectItem>
                  <SelectItem value="coaching">Coaching</SelectItem>
                  <SelectItem value="videos">Video's</SelectItem>
                  <SelectItem value="progress">Voortgang</SelectItem>
                  <SelectItem value="system">Systeem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Notifications List - Same style as Admin */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="divide-y divide-hh-border">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-hh-muted mx-auto mb-4" />
                <p className="text-hh-muted">Geen notificaties gevonden</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 flex items-start gap-4 hover:bg-hh-ui-50 transition-colors cursor-pointer ${
                    !notification.read ? "bg-slate-50/50" : ""
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: notification.iconBg }}
                  >
                    <notification.icon className="w-5 h-5" style={{ color: notification.iconColor }} />
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
                          {notification.timestamp}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <DropdownMenuItem>
                              <Check className="w-4 h-4 mr-2" />
                              Markeer als gelezen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="text-[10px]"
                        style={getCategoryBadgeStyle(notification.category)}
                      >
                        {notification.category === "coaching" && "Coaching"}
                        {notification.category === "videos" && "Video's"}
                        {notification.category === "progress" && "Voortgang"}
                        {notification.category === "system" && "Systeem"}
                      </Badge>
                      {!notification.read && (
                        <Badge
                          className="text-[10px] px-1.5 py-0.5"
                          style={{ backgroundColor: '#1e3a5f', color: 'white' }}
                        >
                          Nieuw
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
