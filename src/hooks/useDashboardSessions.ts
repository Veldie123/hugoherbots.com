import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/services/hugoApi';

export interface DashboardSession {
  id: string;
  title: string;
  techniqueNumber: string;
  date: string;
  score: number | null;
  type: string;
}

export function useDashboardSessions() {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        setLoading(true);
        const res = await fetch('/api/user/sessions', {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const mapped: DashboardSession[] = (data.sessions || []).slice(0, 8).map((s: any) => ({
          id: s.id,
          title: s.naam || 'Sessie',
          techniqueNumber: s.nummer || '',
          date: s.date ? new Date(s.date).toLocaleDateString('nl-NL') : '',
          score: s.score ?? null,
          type: s.type || 'ai-chat',
        }));
        setSessions(mapped);
      } catch (err) {
        console.error('[useDashboardSessions] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, []);

  return { sessions, loading };
}
