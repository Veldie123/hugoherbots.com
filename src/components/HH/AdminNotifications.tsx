import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  Users,
  Zap,
  Check,
  X,
  Search,
  Loader2,
  Database,
  MoreVertical,
  ExternalLink,
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
import { toast } from "sonner";

interface AdminNotificationsProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

type NotificationFilter = "all" | "unread" | "read";
type NotificationCategory = "all" | "system" | "users" | "sessions" | "content";

export function AdminNotifications({ navigate, isSuperAdmin }: AdminNotificationsProps) {
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
          type: n.type,
          category: n.category || 'content',
          title: n.title,
          message: n.message,
          timestamp: getTimeAgo(new Date(n.created_at)),
          read: n.read,
          severity: n.severity || 'info',
          relatedPage: n.related_page || undefined,
          submittedBy: n.submitted_by || undefined,
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

  const handleMarkRead = async (id: number) => {
    try {
      await fetch(`/api/v2/admin/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      toast.success('Gemarkeerd als gelezen');
    } catch {
      toast.error('Fout bij markeren');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/v2/admin/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setSelectedNotifications(prev => prev.filter(nId => nId !== id));
        toast.success('Notificatie verwijderd');
      }
    } catch {
      toast.error('Fout bij verwijderen');
    }
  };

  const handleBulkMarkRead = async () => {
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
    toast.success(`${selectedNotifications.length} notificatie(s) als gelezen gemarkeerd`);
    setSelectedNotifications([]);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedNotifications) {
      await fetch(`/api/v2/admin/notifications/${id}`, { method: 'DELETE' });
    }
    setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
    toast.success(`${selectedNotifications.length} notificatie(s) verwijderd`);
    setSelectedNotifications([]);
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'correction_submitted': 'Correctie',
      'feedback_received': 'Feedback',
      'system': 'Systeem',
    };
    return map[type] || type;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-600 text-white border-0 text-[10px] px-2 py-0.5">Kritiek</Badge>;
      case "warning":
        return <Badge className="bg-orange-500 text-white border-0 text-[10px] px-2 py-0.5">Waarschuwing</Badge>;
      default:
        return <Badge className="bg-blue-500 text-white border-0 text-[10px] px-2 py-0.5">Info</Badge>;
    }
  };

  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-notifications" navigate={navigate}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] font-bold text-hh-ink mb-2">
              Notificaties
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer systeem notificaties en meldingen
            </p>
          </div>
          {selectedNotifications.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[12px]">
                {selectedNotifications.length} geselecteerd
              </Badge>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkMarkRead}>
                <Check className="w-3.5 h-3.5" />
                Gelezen
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={handleBulkDelete}>
                <X className="w-3.5 h-3.5" />
                Verwijder
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Totaal</p>
            <p className="text-[28px] font-semibold text-hh-ink">{notifications.length}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Ongelezen</p>
            <p className="text-[28px] font-semibold text-hh-ink">{unreadCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Gelezen</p>
            <p className="text-[28px] font-semibold text-hh-ink">{readCount}</p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-[13px] text-hh-muted mb-1">Correcties</p>
            <p className="text-[28px] font-semibold text-hh-ink">
              {notifications.filter(n => n.type === 'correction_submitted').length}
            </p>
          </Card>
        </div>

        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek notificaties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filter} onValueChange={(v) => setFilter(v as NotificationFilter)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle notificaties</SelectItem>
                <SelectItem value="unread">Ongelezen</SelectItem>
                <SelectItem value="read">Gelezen</SelectItem>
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={(v) => setCategory(v as NotificationCategory)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Categorie" />
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
        </Card>

        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th className="w-12 p-4">
                    <button
                      onClick={() => {
                        if (selectedNotifications.length === filteredNotifications.length) {
                          setSelectedNotifications([]);
                        } else {
                          setSelectedNotifications(filteredNotifications.map(n => n.id));
                        }
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0
                          ? "bg-purple-600 border-purple-600"
                          : "border-hh-border hover:border-purple-400"
                      }`}
                    >
                      {selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0 && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Bericht
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Type
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Severity
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Status
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Tijd
                  </th>
                  <th className="text-left p-4 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                    <p className="text-[13px] text-hh-muted">Notificaties laden...</p>
                  </td></tr>
                )}
                {!loading && filteredNotifications.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center">
                    <Database className="w-8 h-8 mx-auto text-hh-muted/50 mb-2" />
                    <p className="text-[14px] font-medium text-hh-text mb-1">Geen notificaties</p>
                    <p className="text-[13px] text-hh-muted">Notificaties verschijnen hier wanneer een admin wijzigingen indient.</p>
                  </td></tr>
                )}
                {filteredNotifications.map((notification) => {
                  const isSelected = selectedNotifications.includes(notification.id);
                  return (
                    <tr
                      key={notification.id}
                      className={`border-b border-hh-border last:border-0 transition-colors ${
                        notification.relatedPage ? 'cursor-pointer hover:bg-hh-ui-50' : 'hover:bg-hh-ui-50'
                      } ${!notification.read ? 'bg-purple-500/5' : ''}`}
                      onClick={() => {
                        if (notification.relatedPage && navigate) {
                          handleMarkRead(notification.id);
                          const page = notification.relatedPage;
                          navigate(page.startsWith('admin-') ? page : `admin-${page}`);
                        }
                      }}
                    >
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSelection(notification.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-purple-600 border-purple-600"
                              : "border-hh-border hover:border-purple-400"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="max-w-[400px]">
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                            )}
                            <p className={`text-[14px] leading-[20px] ${!notification.read ? 'font-semibold text-hh-ink' : 'text-hh-text'}`}>
                              {notification.title}
                            </p>
                          </div>
                          <p className="text-[13px] leading-[18px] text-hh-muted mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          {notification.relatedPage && (
                            <div className="flex items-center gap-1 mt-1">
                              <ExternalLink className="w-3 h-3 text-purple-500" />
                              <span className="text-[11px] text-purple-600">Bekijk in Config Review</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-[11px] bg-hh-ui-50 text-hh-muted border-hh-border">
                          {getTypeLabel(notification.type)}
                        </Badge>
                      </td>
                      <td className="p-4">{getSeverityBadge(notification.severity)}</td>
                      <td className="p-4">
                        {notification.read ? (
                          <Badge variant="outline" className="text-[11px] bg-green-500/10 text-green-600 border-green-500/20">
                            Gelezen
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Nieuw
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-[13px] text-hh-muted whitespace-nowrap">
                          {notification.timestamp}
                        </span>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600"
                              onClick={() => handleMarkRead(notification.id)}
                              title="Markeer als gelezen"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600"
                            onClick={() => handleDelete(notification.id)}
                            title="Verwijder"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
