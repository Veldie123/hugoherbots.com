import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { projectId } from '@/utils/supabase/info';

const VIDEO_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/api/videos`;
const LIVE_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/api/live`;

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}

export interface VideoAnalytics {
  totalVideos: number;
  totalViews: number;
  todayViews: number;
  totalWatchTimeMinutes: number;
  completedViews: number;
  averageCompletionRate: number;
  topVideos: Array<{
    id: string;
    title: string;
    views: number;
    completionRate: number;
    watchTimeMinutes: number;
  }>;
  userProgress: Array<{
    userId: string;
    name: string;
    email: string;
    videosWatched: number;
    completed: number;
    watchTimeMinutes: number;
    lastActivity: string | null;
  }>;
}

export interface LiveSessionAnalytics {
  totalSessions: number;
  todaySessions: number;
  upcomingSessions: number;
  completedSessions: number;
  totalChatMessages: number;
  totalPolls: number;
  totalPollVotes: number;
  averageParticipants: number;
  recordingsCount: number;
  topSessions: Array<{
    id: string;
    title: string;
    date: string;
    chatCount: number;
    pollCount: number;
    participants: number;
  }>;
}

export function useVideoAnalytics() {
  const [data, setData] = useState<VideoAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${VIDEO_API_BASE}/analytics`, { 
          headers: await getAuthHeaders() 
        });
        
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Kon analytics niet ophalen' }));
          throw new Error(err.error || 'Kon analytics niet ophalen');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Er is een fout opgetreden');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  return { data, loading, error, refetch: () => setLoading(true) };
}

export function useLiveSessionAnalytics() {
  const [data, setData] = useState<LiveSessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${LIVE_API_BASE}/analytics`, { 
          headers: await getAuthHeaders() 
        });
        
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Kon analytics niet ophalen' }));
          throw new Error(err.error || 'Kon analytics niet ophalen');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Er is een fout opgetreden');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  return { data, loading, error, refetch: () => setLoading(true) };
}

export async function exportVideosCsv(): Promise<void> {
  const response = await fetch(`${VIDEO_API_BASE}/export/csv`, { 
    headers: await getAuthHeaders() 
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'Export mislukt');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'videos_analytics_export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportLiveSessionsCsv(): Promise<void> {
  const response = await fetch(`${LIVE_API_BASE}/sessions/export/csv`, { 
    headers: await getAuthHeaders() 
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'Export mislukt');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'live_sessions_analytics_export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface PlatformMetrics {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersMonth: number;
  totalVideoViews: number;
  totalVideos: number;
  totalLiveSessions: number;
  completedSessions: number;
  weeklyEngagement: Array<{
    week: string;
    sessions: number;
    avgScore: number;
  }>;
}

export function usePlatformMetrics() {
  const [data, setData] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/analytics/platform');
        
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Analytics ophalen mislukt' }));
          throw new Error(err.error || 'Analytics ophalen mislukt');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        console.error('Platform metrics error:', err);
        setError(err.message || 'Er is een fout opgetreden');
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  return { data, loading, error };
}
