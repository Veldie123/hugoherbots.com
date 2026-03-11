import { useState, useEffect } from 'react';
import { videoApi } from '@/services/videoApi';
import { getTechniekByNummer } from '@/data/technieken-service';

export interface DashboardVideo {
  id: string;
  title: string;
  displayTitle: string;
  techniqueNumber: string;
  fase: number;
  duration: string;
  progress: number;
  thumbnail: string;
  muxPlaybackId: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getFaseFromTechnique(techniqueId: string | null): number {
  if (!techniqueId) return 2;
  const firstDigit = techniqueId.split('.')[0];
  const fase = parseInt(firstDigit, 10);
  return isNaN(fase) ? 2 : fase;
}

function getMuxThumbnail(playbackId: string | null, size: 'card' | 'hero' = 'card'): string {
  if (!playbackId) return '';
  const dims = size === 'hero' ? 'width=800&height=450' : 'width=320&height=180';
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=5&${dims}`;
}

function isRawFilename(title: string): boolean {
  return /^MVI_\d+$/i.test(title) || /^IMG_\d+$/i.test(title) || /^DSC_?\d+$/i.test(title) || /^DJI_\d+$/i.test(title) || /^GOPR?\d+$/i.test(title);
}

export function useDashboardVideos() {
  const [videos, setVideos] = useState<DashboardVideo[]>([]);
  const [featuredVideo, setFeaturedVideo] = useState<DashboardVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        setLoading(true);
        const library = await videoApi.getLibrary('completed');
        
        const mappedVideos: DashboardVideo[] = library
          .filter(v => v.mux_playback_id)
          .map(v => {
            const technique = v.technique_id ? getTechniekByNummer(v.technique_id) : null;
            const techniqueName = technique?.naam || (technique as any)?.name || null;
            let displayTitle = v.title || techniqueName || 'Sales Training Video';
            return {
              id: v.id,
              title: v.title,
              displayTitle,
              techniqueNumber: v.technique_id || '',
              fase: getFaseFromTechnique(v.technique_id),
              duration: formatDuration(v.duration),
              progress: 0,
              thumbnail: getMuxThumbnail(v.mux_playback_id),
              muxPlaybackId: v.mux_playback_id,
              _playbackOrder: v.playback_order ?? Infinity,
            };
          })
          .sort((a, b) => (a as any)._playbackOrder - (b as any)._playbackOrder)
          .map(({ _playbackOrder, ...rest }) => rest as DashboardVideo);

        setVideos(mappedVideos);
        
        if (mappedVideos.length > 0) {
          const featured = mappedVideos.find(v => v.techniqueNumber === '2.1.1') || mappedVideos[0];
          setFeaturedVideo({ ...featured, thumbnail: getMuxThumbnail(featured.muxPlaybackId, 'hero') });
        }
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard videos:', err);
        setError('Kon video\'s niet laden');
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();
  }, []);

  return { videos, featuredVideo, loading, error };
}
