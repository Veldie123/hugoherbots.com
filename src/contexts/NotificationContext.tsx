import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

export interface Notification {
  id: string;
  type: "analysis_complete" | "info" | "correction_submitted" | "feedback_received";
  title: string;
  message: string;
  conversationId?: string;
  relatedPage?: string;
  read: boolean;
  createdAt: string;
}

interface PendingAnalysis {
  conversationId: string;
  title: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "read" | "createdAt">) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  addPendingAnalysis: (conversationId: string, title: string) => void;
  setIsAdmin: (admin: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const NOTIFICATIONS_KEY = "hh_notifications";
const PENDING_KEY = "hh_pendingAnalysis";
const ADMIN_SEEN_KEY = "hh_admin_notif_seen";
const POLL_INTERVAL = 5000;
const ADMIN_POLL_INTERVAL = 30000;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    loadFromStorage<Notification[]>(NOTIFICATIONS_KEY, [])
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef<PendingAnalysis[]>(loadFromStorage<PendingAnalysis[]>(PENDING_KEY, []));
  const adminSeenIdsRef = useRef<Set<number>>(new Set(loadFromStorage<number[]>(ADMIN_SEEN_KEY, [])));

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback(
    (notif: Omit<Notification, "id" | "read" | "createdAt">) => {
      const newNotif: Notification = {
        ...notif,
        id: crypto.randomUUID?.() || Date.now().toString(),
        read: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    const numId = parseInt(id.replace('admin-', ''));
    if (!isNaN(numId)) {
      fetch(`/api/v2/admin/notifications/${numId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      }).catch(() => {});
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch('/api/v2/admin/notifications/read-all', { method: 'PATCH' }).catch(() => {});
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const addPendingAnalysis = useCallback(
    (conversationId: string, title: string) => {
      const existing = pendingRef.current;
      if (existing.some((p) => p.conversationId === conversationId)) return;
      const updated = [...existing, { conversationId, title }];
      pendingRef.current = updated;
      localStorage.setItem(PENDING_KEY, JSON.stringify(updated));
      startPolling();
    },
    []
  );

  const removePending = useCallback((conversationId: string) => {
    const updated = pendingRef.current.filter(
      (p) => p.conversationId !== conversationId
    );
    pendingRef.current = updated;
    localStorage.setItem(PENDING_KEY, JSON.stringify(updated));
    if (updated.length === 0 && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollPending = useCallback(async () => {
    const pending = pendingRef.current;
    if (pending.length === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    for (const item of pending) {
      try {
        const res = await fetch(
          `/api/v2/analysis/status/${item.conversationId}`
        );
        if (res.status === 404) {
          removePending(item.conversationId);
          continue;
        }
        if (!res.ok) continue;
        const data = await res.json();

        if (data.status === "completed") {
          addNotification({
            type: "analysis_complete",
            title: `Analyse compleet: ${item.title}`,
            message: "Je gespreksanalyse is klaar. Bekijk de resultaten.",
            conversationId: item.conversationId,
          });
          removePending(item.conversationId);
        } else if (data.status === "failed") {
          addNotification({
            type: "info",
            title: `Analyse mislukt: ${item.title}`,
            message: data.error || "Er ging iets mis bij de analyse.",
            conversationId: item.conversationId,
          });
          removePending(item.conversationId);
        }
      } catch {
      }
    }
  }, [addNotification, removePending]);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(pollPending, POLL_INTERVAL);
    pollPending();
  }, [pollPending]);

  const fetchAdminNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/admin/notifications');
      if (!res.ok) return;
      const data = await res.json();
      const backendNotifs: any[] = data.notifications || [];

      const newNotifs: Notification[] = [];
      for (const bn of backendNotifs) {
        if (adminSeenIdsRef.current.has(bn.id)) continue;
        adminSeenIdsRef.current.add(bn.id);

        newNotifs.push({
          id: `admin-${bn.id}`,
          type: bn.type === 'correction_submitted' ? 'correction_submitted'
            : bn.type === 'feedback_received' ? 'feedback_received'
            : 'info',
          title: bn.title,
          message: bn.message,
          relatedPage: bn.related_page || undefined,
          read: bn.read || false,
          createdAt: bn.created_at || new Date().toISOString(),
        });
      }

      if (newNotifs.length > 0) {
        localStorage.setItem(ADMIN_SEEN_KEY, JSON.stringify([...adminSeenIdsRef.current]));
        setNotifications((prev) => {
          const existingIds = new Set(prev.map(n => n.id));
          const truly = newNotifs.filter(n => !existingIds.has(n.id));
          if (truly.length === 0) return prev;
          return [...truly, ...prev].slice(0, 50);
        });
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    if (pendingRef.current.length > 0) {
      startPolling();
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [startPolling]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminNotifications();
      adminPollRef.current = setInterval(fetchAdminNotifications, ADMIN_POLL_INTERVAL);
    } else {
      if (adminPollRef.current) {
        clearInterval(adminPollRef.current);
        adminPollRef.current = null;
      }
    }
    return () => {
      if (adminPollRef.current) {
        clearInterval(adminPollRef.current);
        adminPollRef.current = null;
      }
    };
  }, [isAdmin, fetchAdminNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllRead,
        removeNotification,
        clearNotifications,
        addPendingAnalysis,
        setIsAdmin,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
