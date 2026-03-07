import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "../utils/supabase/client";

export interface Notification {
  id: string;
  type: "analysis_complete" | "info" | "admin_notification";
  title: string;
  message: string;
  conversationId?: string;
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
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const NOTIFICATIONS_KEY = "hh_notifications";
const PENDING_KEY = "hh_pendingAnalysis";
const POLL_INTERVAL = 5000;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function loadUserNotifications(): Notification[] {
  const all = loadFromStorage<Notification[]>(NOTIFICATIONS_KEY, []);
  // Clean out any leaked admin notifications from previous sessions
  const cleaned = all.filter((n) => !n.id.startsWith("admin-"));
  if (cleaned.length !== all.length) {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(cleaned));
  }
  return cleaned;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(loadUserNotifications);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef<PendingAnalysis[]>(loadFromStorage<PendingAnalysis[]>(PENDING_KEY, []));

  // Clean up stale admin localStorage keys
  useEffect(() => {
    localStorage.removeItem("hh_admin_notif_seen");
  }, []);

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
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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

  // Fetch admin notifications from platform_feedback on mount
  useEffect(() => {
    async function fetchAdminNotifications() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("platform_feedback")
          .select("id, metadata, created_at")
          .eq("user_id", user.id)
          .eq("feedback_type", "admin_notification")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error || !data || data.length === 0) return;

        const seenKey = "hh_admin_notif_seen_ids";
        const seenIds = new Set(loadFromStorage<string[]>(seenKey, []));

        const newNotifs: Notification[] = [];
        for (const row of data) {
          if (seenIds.has(row.id)) continue;
          const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
          newNotifs.push({
            id: `admin-notif-${row.id}`,
            type: "admin_notification",
            title: meta?.title || "Bericht van Hugo",
            message: meta?.message || "",
            read: false,
            createdAt: row.created_at,
          });
          seenIds.add(row.id);
        }

        if (newNotifs.length > 0) {
          localStorage.setItem(seenKey, JSON.stringify([...seenIds]));
          setNotifications((prev) => [...newNotifs, ...prev].slice(0, 50));
        }
      } catch {
        // Non-critical — silently fail
      }
    }
    fetchAdminNotifications();
  }, []);

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
