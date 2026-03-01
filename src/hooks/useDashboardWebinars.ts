import { useState, useEffect } from 'react';
import { liveCoachingApi } from '@/services/liveCoachingApi';

export interface DashboardWebinar {
  id: string | number;
  title: string;
  techniqueNumber?: string;
  date: string;
  time: string;
  status: string;
  thumbnailUrl?: string | null;
  muxPlaybackId?: string | null;
}

function formatSessionDate(scheduledDate: string): { date: string; time: string } {
  try {
    const d = new Date(scheduledDate);
    const date = d.toISOString().split('T')[0];
    const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { date, time };
  } catch {
    return { date: '', time: '' };
  }
}

function mapToWebinar(session: any): DashboardWebinar {
  const { date, time } = formatSessionDate(session.scheduledDate || session.scheduled_date || '');
  const phaseId = session.phaseId || session.phase_id;
  const techniqueNumber = phaseId ? `${phaseId}.1` : undefined;

  return {
    id: session.id,
    title: session.title || 'Webinar',
    techniqueNumber,
    date,
    time,
    status: session.status || 'upcoming',
    thumbnailUrl: session.thumbnailUrl || session.thumbnail_url || null,
    muxPlaybackId: session.muxPlaybackId || session.mux_playback_id || null,
  };
}

export function useDashboardWebinars() {
  const [upcomingWebinars, setUpcoming] = useState<DashboardWebinar[]>([]);
  const [completedWebinars, setCompleted] = useState<DashboardWebinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWebinars() {
      try {
        setLoading(true);

        const { sessions } = await liveCoachingApi.sessions.list();

        const upcoming = sessions
          .filter(s => s.status === 'upcoming' || s.status === 'live')
          .slice(0, 5)
          .map(mapToWebinar);

        const completed = sessions
          .filter(s => s.status === 'ended')
          .filter(s => s.muxPlaybackId || s.recordingReady)
          .slice(0, 5)
          .map(s => ({ ...mapToWebinar(s), status: 'completed' }));

        setUpcoming(upcoming);
        setCompleted(completed);
        setError(null);
      } catch (err: any) {
        console.error('[useDashboardWebinars] Fetch error:', err);
        setError(err.message || 'Kon webinars niet laden');
      } finally {
        setLoading(false);
      }
    }

    fetchWebinars();
  }, []);

  return { upcomingWebinars, completedWebinars, loading, error };
}
