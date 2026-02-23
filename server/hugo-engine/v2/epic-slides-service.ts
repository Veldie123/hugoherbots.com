import * as fs from 'fs';
import * as path from 'path';

export interface EpicSlide {
  id: string;
  techniqueIds: string[];
  phase: string;
  titel: string;
  kernboodschap: string;
  bulletpoints: string[];
  visual_type: 'diagram' | 'lijst' | 'matrix' | 'quote';
  personalisatie_slots: string[];
}

interface EpicSlidesConfig {
  _meta: { version: string; purpose: string };
  slides: EpicSlide[];
}

let slidesCache: EpicSlidesConfig | null = null;

function loadSlides(): EpicSlidesConfig {
  if (slidesCache) return slidesCache;
  
  const configPath = path.join(process.cwd(), 'config', 'epic_slides.json');
  
  if (!fs.existsSync(configPath)) {
    console.warn('[epic-slides] Config not found:', configPath);
    return { _meta: { version: '0', purpose: '' }, slides: [] };
  }
  
  const raw = fs.readFileSync(configPath, 'utf-8');
  slidesCache = JSON.parse(raw) as EpicSlidesConfig;
  console.log(`[epic-slides] Loaded ${slidesCache.slides.length} slides`);
  return slidesCache;
}

export function getSlidesForTechnique(techniqueId: string): EpicSlide[] {
  const config = loadSlides();
  return config.slides.filter(s => s.techniqueIds.includes(techniqueId));
}

export function getSlideById(slideId: string): EpicSlide | undefined {
  const config = loadSlides();
  return config.slides.find(s => s.id === slideId);
}

export function getSlidesForPhase(phase: string): EpicSlide[] {
  const config = loadSlides();
  return config.slides.filter(s => s.phase === phase);
}

export function getAllSlides(): EpicSlide[] {
  return loadSlides().slides;
}

export function personalizeSlide(
  slide: EpicSlide,
  context: Record<string, string>
): Record<string, string> {
  const personalized: Record<string, string> = {};
  
  for (const slotKey of slide.personalisatie_slots) {
    if (context[slotKey]) {
      personalized[slotKey] = context[slotKey];
    }
  }
  
  return personalized;
}

export function buildEpicSlideRichContent(
  slide: EpicSlide,
  context: Record<string, string>
) {
  const personalizedContext = personalizeSlide(slide, context);
  
  return {
    type: 'epic_slide' as const,
    data: {
      id: slide.id,
      titel: slide.titel,
      kernboodschap: slide.kernboodschap,
      bulletpoints: slide.bulletpoints,
      phase: slide.phase,
      techniqueId: slide.techniqueIds[0] || '',
      visual_type: slide.visual_type,
      personalized_context: Object.keys(personalizedContext).length > 0 
        ? personalizedContext 
        : undefined
    }
  };
}

export function clearSlidesCache(): void {
  slidesCache = null;
}
