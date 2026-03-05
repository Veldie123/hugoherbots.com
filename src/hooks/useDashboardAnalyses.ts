import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/services/hugoApi';

export interface DashboardAnalysis {
  id: string;
  title: string;
  date: string;
  score: number | null;
  status: 'completed' | 'transcribing' | 'analyzing' | 'evaluating' | 'generating_report' | 'failed';
  duration: string;
}

export function useDashboardAnalyses() {
  const [analyses, setAnalyses] = useState<DashboardAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalyses() {
      try {
        setLoading(true);
        const res = await fetch('/api/v2/analysis/list?source=upload', {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const mapped: DashboardAnalysis[] = (data.analyses || []).slice(0, 8).map((a: any) => ({
          id: a.id,
          title: a.title || 'Analyse',
          date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('nl-NL') : '',
          score: a.overallScore ?? null,
          status: a.status || 'completed',
          duration: a.durationMs
            ? `${Math.floor(a.durationMs / 60000)}:${String(Math.floor((a.durationMs % 60000) / 1000)).padStart(2, '0')}`
            : '',
        }));
        setAnalyses(mapped);
      } catch (err) {
        console.error('[useDashboardAnalyses] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalyses();
  }, []);

  return { analyses, loading };
}
