import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useUser } from '@/contexts/UserContext';

interface PhaseProgress {
  phase: number;
  completedVideos: number;
  totalVideos: number;
  percentage: number;
}

interface DashboardUserData {
  firstName: string;
  loginStreak: number;
  phaseProgress: PhaseProgress[];
  totalCompleted: number;
  totalVideos: number;
  loading: boolean;
}

export function useDashboardUserData(): DashboardUserData {
  const { user } = useUser();
  const [loginStreak, setLoginStreak] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress[]>([
    { phase: 0, completedVideos: 0, totalVideos: 0, percentage: 0 },
    { phase: 1, completedVideos: 0, totalVideos: 0, percentage: 0 },
    { phase: 2, completedVideos: 0, totalVideos: 0, percentage: 0 },
    { phase: 3, completedVideos: 0, totalVideos: 0, percentage: 0 },
    { phase: 4, completedVideos: 0, totalVideos: 0, percentage: 0 },
  ]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(true);

  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || '';

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        await Promise.all([
          fetchLoginStreak(user!.id),
          fetchEpicProgress(user!.id),
        ]);
      } catch (err) {
        console.error('[Dashboard] Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user?.id]);

  async function fetchLoginStreak(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('created_at')
        .eq('user_id', userId)
        .eq('activity_type', 'login')
        .order('created_at', { ascending: false })
        .limit(90);

      if (error || !data || data.length === 0) {
        setLoginStreak(0);
        return;
      }

      const toLocalDate = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const loginDates = new Set<string>();
      data.forEach(row => {
        loginDates.add(toLocalDate(new Date(row.created_at)));
      });

      const sortedDates = Array.from(loginDates).sort((a, b) => b.localeCompare(a));
      
      const today = toLocalDate(new Date());
      let streak = 0;
      let checkDate = new Date();

      if (!sortedDates.includes(today)) {
        const yesterday = new Date(checkDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toLocalDate(yesterday);
        if (!sortedDates.includes(yesterdayStr)) {
          setLoginStreak(0);
          return;
        }
        checkDate = yesterday;
      }

      while (true) {
        const dateStr = toLocalDate(checkDate);
        if (sortedDates.includes(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      setLoginStreak(streak);
    } catch (err) {
      console.error('[Dashboard] Streak calculation error:', err);
      setLoginStreak(0);
    }
  }

  async function fetchEpicProgress(userId: string) {
    try {
      let allVideos: any[] = [];

      const { data: vWithDet, error: vWithDetErr } = await supabase
        .from('videos')
        .select('id, technique_id, detected_technieken')
        .eq('status', 'completed')
        .not('mux_playback_id', 'is', null);

      if (!vWithDetErr && vWithDet) {
        allVideos = vWithDet;
      } else {
        const { data: vBasic, error: vBasicErr } = await supabase
          .from('videos')
          .select('id, technique_id')
          .eq('status', 'completed')
          .not('mux_playback_id', 'is', null);

        if (vBasicErr || !vBasic) {
          console.error('[Dashboard] Error fetching videos for progress:', vBasicErr);
          return;
        }
        allVideos = vBasic;
      }

      const phaseVideoCount: Record<number, Set<string>> = {
        0: new Set(), 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set()
      };

      allVideos.forEach(v => {
        const phasesAdded = new Set<number>();

        const techId = v.technique_id;
        if (techId) {
          const phase = parseInt(techId.split('.')[0], 10);
          if (phase >= 0 && phase <= 4) {
            phaseVideoCount[phase].add(v.id);
            phasesAdded.add(phase);
          }
        }

        if (v.detected_technieken && Array.isArray(v.detected_technieken)) {
          v.detected_technieken.forEach((dt: any) => {
            const dtId = dt.technique_id || dt.techniek_nummer;
            if (dtId) {
              const phase = parseInt(String(dtId).split('.')[0], 10);
              if (phase >= 0 && phase <= 4 && !phasesAdded.has(phase)) {
                phaseVideoCount[phase].add(v.id);
                phasesAdded.add(phase);
              }
            }
          });
        }
      });

      const { data: completedActivities, error: actError } = await supabase
        .from('user_activity')
        .select('video_id')
        .eq('user_id', userId)
        .eq('activity_type', 'video_view')
        .not('video_id', 'is', null);

      const watchedVideoIds = new Set<string>();
      if (!actError && completedActivities) {
        completedActivities.forEach(a => {
          if (a.video_id) watchedVideoIds.add(a.video_id);
        });
      }

      const progress: PhaseProgress[] = [0, 1, 2, 3, 4].map(phase => {
        const phaseVideos = phaseVideoCount[phase];
        const total = phaseVideos.size;
        let completed = 0;
        phaseVideos.forEach(videoId => {
          if (watchedVideoIds.has(videoId)) completed++;
        });
        return {
          phase,
          completedVideos: completed,
          totalVideos: total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });

      setPhaseProgress(progress);
      setTotalCompleted(progress.reduce((sum, p) => sum + p.completedVideos, 0));
      setTotalVideos(progress.reduce((sum, p) => sum + p.totalVideos, 0));
    } catch (err) {
      console.error('[Dashboard] Progress calculation error:', err);
    }
  }

  return {
    firstName,
    loginStreak,
    phaseProgress,
    totalCompleted,
    totalVideos,
    loading,
  };
}
