import { supabase } from '../supabase-client';

export interface ContentAsset {
  id: string;
  type: 'video' | 'slide' | 'webinar';
  title: string;
  description?: string;
  techniqueIds: string[];
  phase?: string;
  muxPlaybackId?: string;
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  isArchive?: boolean;
  metadata?: Record<string, unknown>;
}

export const TECHNIQUE_ASSET_MAP: Record<string, { types: Array<'video' | 'slide' | 'webinar'>; phase: string }> = {
  '1.1': { types: ['video', 'slide'], phase: 'E' },
  '1.2': { types: ['video', 'slide'], phase: 'E' },
  '1.3': { types: ['video'], phase: 'E' },
  '1.4': { types: ['video', 'slide'], phase: 'E' },
  '1.5': { types: ['video'], phase: 'E' },
  '1.6': { types: ['slide'], phase: 'E' },
  '1.7': { types: ['video', 'slide'], phase: 'E' },

  '2.1': { types: ['video', 'slide'], phase: 'P' },
  '2.2': { types: ['video'], phase: 'P' },
  '2.3': { types: ['video', 'slide'], phase: 'P' },
  '2.4': { types: ['video'], phase: 'P' },
  '2.5': { types: ['video', 'slide'], phase: 'P' },
  '2.6': { types: ['slide'], phase: 'P' },
  '2.7': { types: ['video', 'slide'], phase: 'P' },

  '3.1': { types: ['video', 'slide'], phase: 'I' },
  '3.2': { types: ['video'], phase: 'I' },
  '3.3': { types: ['video', 'slide'], phase: 'I' },
  '3.4': { types: ['video'], phase: 'I' },
  '3.5': { types: ['video', 'slide'], phase: 'I' },
  '3.6': { types: ['slide'], phase: 'I' },
  '3.7': { types: ['video', 'slide'], phase: 'I' },

  '4.1': { types: ['video', 'slide'], phase: 'C' },
  '4.2': { types: ['video'], phase: 'C' },
  '4.3': { types: ['video', 'slide'], phase: 'C' },
  '4.4': { types: ['video'], phase: 'C' },
  '4.5': { types: ['video', 'slide'], phase: 'C' },
  '4.6': { types: ['slide'], phase: 'C' },
  '4.7': { types: ['video', 'slide'], phase: 'C' },

  '5.1': { types: ['video', 'webinar'], phase: 'X' },
  '5.2': { types: ['video', 'webinar'], phase: 'X' },
  '5.3': { types: ['webinar'], phase: 'X' },
  '5.4': { types: ['video', 'webinar'], phase: 'X' },
  '5.5': { types: ['webinar'], phase: 'X' },
};

export class ContentAssetLibrary {
  private assets: ContentAsset[] = [];
  private loaded = false;

  getAssetsForTechnique(techniqueId: string): ContentAsset[] {
    return this.assets.filter(a => a.techniqueIds.includes(techniqueId));
  }

  getAssetsByType(type: 'video' | 'slide' | 'webinar'): ContentAsset[] {
    return this.assets.filter(a => a.type === type);
  }

  searchAssets(query: string): ContentAsset[] {
    const q = query.toLowerCase();
    return this.assets.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description && a.description.toLowerCase().includes(q)) ||
      a.techniqueIds.some(id => id.includes(q)) ||
      (a.phase && a.phase.toLowerCase().includes(q))
    );
  }

  async loadFromSupabase(): Promise<void> {
    if (this.loaded) return;

    try {
      const { data: videos, error } = await supabase
        .from('videos')
        .select('*');

      if (error) {
        console.error('[ContentAssets] Supabase load error:', error.message);
      }

      if (videos && videos.length > 0) {
        for (const video of videos) {
          const techniqueIds: string[] = [];
          if (video.technique_id) {
            techniqueIds.push(video.technique_id);
          }
          if (video.technique_ids && Array.isArray(video.technique_ids)) {
            techniqueIds.push(...video.technique_ids);
          }

          const phase = techniqueIds.length > 0
            ? TECHNIQUE_ASSET_MAP[techniqueIds[0]]?.phase
            : undefined;

          this.assets.push({
            id: video.id,
            type: 'video',
            title: video.title || video.naam || 'Untitled',
            description: video.description || video.beschrijving,
            techniqueIds: Array.from(new Set(techniqueIds)),
            phase,
            muxPlaybackId: video.mux_playback_id || video.playback_id,
            thumbnailUrl: video.thumbnail_url,
            duration: video.duration,
            isArchive: video.is_archive === true || video.status === 'archive',
            metadata: {
              source: 'supabase',
              createdAt: video.created_at,
            },
          });
        }
        console.log(`[ContentAssets] Loaded ${videos.length} videos from Supabase`);
      }

      this.addPlaceholderMappings();
      this.loaded = true;
      console.log(`[ContentAssets] Total assets: ${this.assets.length}`);
    } catch (err: any) {
      console.error('[ContentAssets] Load error:', err.message);
      this.addPlaceholderMappings();
      this.loaded = true;
    }
  }

  private addPlaceholderMappings(): void {
    const existingIds = new Set(this.assets.map(a => a.id));

    for (const [techniqueId, mapping] of Object.entries(TECHNIQUE_ASSET_MAP)) {
      for (const type of mapping.types) {
        const placeholderId = `placeholder-${techniqueId}-${type}`;
        if (existingIds.has(placeholderId)) continue;

        const hasRealAsset = this.assets.some(
          a => a.type === type && a.techniqueIds.includes(techniqueId)
        );
        if (hasRealAsset) continue;

        this.assets.push({
          id: placeholderId,
          type,
          title: `${type === 'video' ? 'Video' : type === 'slide' ? 'Slide' : 'Webinar'} - Techniek ${techniqueId}`,
          techniqueIds: [techniqueId],
          phase: mapping.phase,
          metadata: { isPlaceholder: true },
        });
      }
    }
  }

  getAll(): ContentAsset[] {
    return this.assets;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export const contentAssetLibrary = new ContentAssetLibrary();
