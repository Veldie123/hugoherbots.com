import { contentAssetLibrary, type ContentAsset } from './content-assets';
import { type IntentResult } from './intent-detector';
import { getSlidesForTechnique, buildEpicSlideRichContent } from './epic-slides-service';

export interface RichContentItem {
  type: 'card' | 'video' | 'slide' | 'webinar' | 'action' | 'roleplay' | 'epic_slide';
  data: Record<string, unknown>;
}

export interface RichChatResponse {
  response: string;
  sessionId: string;
  mode: string;
  technique?: string;
  richContent?: RichContentItem[];
  suggestions?: string[];
  sources?: Array<{
    type: string;
    title: string;
    snippet: string;
    relevance: number;
  }>;
}

const MAX_RICH_ITEMS = 3;

function assetToRichItem(asset: ContentAsset): RichContentItem {
  switch (asset.type) {
    case 'video':
      return {
        type: 'video',
        data: {
          title: asset.title,
          description: asset.description,
          muxPlaybackId: asset.muxPlaybackId,
          thumbnailUrl: asset.thumbnailUrl,
          duration: asset.duration,
          techniqueId: asset.techniqueIds[0],
          phase: asset.phase,
        },
      };
    case 'slide':
      return {
        type: 'slide',
        data: {
          title: asset.title,
          description: asset.description,
          slideUrl: asset.url,
          thumbnailUrl: asset.thumbnailUrl,
          techniqueId: asset.techniqueIds[0],
          phase: asset.phase,
        },
      };
    case 'webinar':
      return {
        type: 'webinar',
        data: {
          title: asset.title,
          description: asset.description,
          url: asset.url,
          techniqueId: asset.techniqueIds[0],
          phase: asset.phase,
        },
      };
  }
}

function buildActionButton(label: string, action: string, payload?: Record<string, unknown>): RichContentItem {
  return {
    type: 'action',
    data: { label, action, payload: payload || {} },
  };
}

function buildRoleplayItem(techniqueId: string, techniqueName?: string): RichContentItem {
  return {
    type: 'roleplay',
    data: {
      title: `Rollenspel: ${techniqueName || `Techniek ${techniqueId}`}`,
      description: 'Oefen deze techniek in een realistische verkoopsituatie',
      techniqueId,
      action: 'start_roleplay',
    },
  };
}

export async function buildRichResponse(
  textResponse: string,
  intentResult: IntentResult,
  sessionContext: {
    techniqueId?: string;
    techniqueName?: string;
    phase?: string;
    userId?: string;
    gatheredContext?: Record<string, string>;
  }
): Promise<RichChatResponse> {
  if (!contentAssetLibrary.isLoaded()) {
    try {
      await contentAssetLibrary.loadFromSupabase();
    } catch (err: any) {
      console.error('[RichResponse] Failed to load content assets:', err.message);
    }
  }

  const richContent: RichContentItem[] = [];
  const suggestions: string[] = [];

  const techniqueId = sessionContext.techniqueId;

  for (const suggestion of intentResult.contentSuggestions) {
    if (richContent.length >= MAX_RICH_ITEMS) break;

    const targetTechnique = suggestion.techniqueId || techniqueId;

    switch (suggestion.type) {
      case 'video': {
        if (!targetTechnique) break;
        const videoAssets = contentAssetLibrary
          .getAssetsForTechnique(targetTechnique)
          .filter(a => a.type === 'video' && !a.isArchive);

        if (videoAssets.length > 0) {
          richContent.push(assetToRichItem(videoAssets[0]));
          richContent.push(buildActionButton('Bekijk video', 'watch_video', {
            techniqueId: targetTechnique,
            assetId: videoAssets[0].id,
          }));
        }
        break;
      }
      case 'slide': {
        if (!targetTechnique) break;
        const slideAssets = contentAssetLibrary
          .getAssetsForTechnique(targetTechnique)
          .filter(a => a.type === 'slide');

        if (slideAssets.length > 0) {
          richContent.push(assetToRichItem(slideAssets[0]));
        }
        break;
      }
      case 'webinar': {
        if (!targetTechnique) break;
        const webinarAssets = contentAssetLibrary
          .getAssetsForTechnique(targetTechnique)
          .filter(a => a.type === 'webinar');

        if (webinarAssets.length > 0) {
          richContent.push(assetToRichItem(webinarAssets[0]));
        }
        break;
      }
      case 'roleplay': {
        if (!targetTechnique) break;
        richContent.push(buildRoleplayItem(targetTechnique, sessionContext.techniqueName));
        richContent.push(buildActionButton('Start rollenspel', 'start_roleplay', {
          techniqueId: targetTechnique,
        }));
        break;
      }
      case 'technique': {
        if (!targetTechnique) break;
        richContent.push({
          type: 'card',
          data: {
            title: sessionContext.techniqueName || `Techniek ${targetTechnique}`,
            techniqueId: targetTechnique,
            phase: sessionContext.phase,
            action: 'view_technique',
          },
        });
        break;
      }
    }
  }

  if (techniqueId && richContent.length < MAX_RICH_ITEMS) {
    try {
      const epicSlides = getSlidesForTechnique(techniqueId);
      if (epicSlides.length > 0) {
        const ctx = sessionContext.gatheredContext || {};
        const slideItem = buildEpicSlideRichContent(epicSlides[0], ctx);
        richContent.push(slideItem as unknown as RichContentItem);
      }
    } catch (err: any) {
      console.warn('[RichResponse] Failed to load EPIC slides:', err.message);
    }
  }

  if (intentResult.primaryIntent === 'learn' || intentResult.primaryIntent === 'explore') {
    suggestions.push('Laat me een voorbeeld zien');
    suggestions.push('Kan ik dit oefenen?');
  }
  if (intentResult.primaryIntent === 'practice') {
    suggestions.push('Geef me feedback');
    suggestions.push('Nog een keer proberen');
  }
  if (intentResult.primaryIntent === 'review') {
    suggestions.push('Volgende techniek');
    suggestions.push('Laat me oefenen');
  }

  const trimmedContent = richContent.slice(0, MAX_RICH_ITEMS);

  return {
    response: textResponse,
    sessionId: '',
    mode: '',
    technique: sessionContext.techniqueName,
    richContent: trimmedContent.length > 0 ? trimmedContent : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}
