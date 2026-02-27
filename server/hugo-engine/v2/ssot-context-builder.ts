import * as fs from 'fs';
import * as path from 'path';
import { loadMergedTechniques, getTechnique } from '../ssot-loader';

const CONFIG_DIR = path.join(process.cwd(), 'config');

function loadJsonSafe(filePath: string): any {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err: any) {
    console.warn(`[SSOT] Failed to load ${filePath}:`, err.message);
    return null;
  }
}

export interface VideoRecommendation {
  videoId: string;
  title: string;
  fileName: string;
  techniqueId: string;
  techniqueName: string;
  phase: number;
  phaseName: string;
  durationSeconds: number | null;
  muxPlaybackId: string | null;
}

export function findRelevantVideos(techniqueIds: string[], limit: number = 3): VideoRecommendation[] {
  const videoMapping = loadJsonSafe(path.join(CONFIG_DIR, 'video_mapping.json'));
  if (!videoMapping?.videos) return [];

  const results: VideoRecommendation[] = [];

  for (const [, video] of Object.entries(videoMapping.videos) as any) {
    if (video.status === 'deleted' || video.is_hidden) continue;
    if (!video.techniek || !video.has_mux || video.user_ready === false) continue;

    for (const techId of techniqueIds) {
      if (!techId) continue;

      if (
        video.techniek === techId || 
        video.techniek?.startsWith(techId + '.') ||
        techId.startsWith(video.techniek + '.')
      ) {
        results.push({
          videoId: video.id,
          title: video.title,
          fileName: video.file_name,
          techniqueId: video.techniek,
          techniqueName: video.techniek_naam || '',
          phase: video.fase || 0,
          phaseName: video.fase_naam || '',
          durationSeconds: video.duration_seconds,
          muxPlaybackId: video.mux_playback_id,
        });
        break;
      }
    }
  }

  results.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));

  // FALLBACK: If no videos found for techniques, try matching by phase
  if (results.length === 0 && techniqueIds.length > 0) {
    const phases = techniqueIds
      .map(id => parseInt(id.split('.')[0]))
      .filter(p => !isNaN(p));
    
    if (phases.length > 0) {
      const targetPhase = phases[0];
      for (const [, video] of Object.entries(videoMapping.videos) as any) {
        if (video.status === 'deleted' || video.is_hidden) continue;
        if (video.fase === targetPhase && video.has_mux) {
          results.push({
            videoId: video.id,
            title: video.title,
            fileName: video.file_name,
            techniqueId: video.techniek || '',
            techniqueName: video.technique_naam || '',
            phase: video.fase || 0,
            phaseName: video.fase_naam || '',
            durationSeconds: video.duration_seconds,
            muxPlaybackId: video.mux_playback_id,
          });
          if (results.length >= limit) break;
        }
      }
    }
  }

  return results.slice(0, limit);
}

export function buildSSOTContextForEvaluation(detectedTechniqueIds: string[]): string {
  const parts: string[] = [];

  const techniques = loadMergedTechniques();
  if (detectedTechniqueIds.length > 0 && techniques) {
    const relevantTechs = detectedTechniqueIds
      .map(id => getTechnique(id))
      .filter((t): t is NonNullable<typeof t> => t != null)
      .slice(0, 8);
    
    if (relevantTechs.length > 0) {
      parts.push('RELEVANTE HUGO HERBOTS TECHNIEKEN:');
      for (const tech of relevantTechs) {
        parts.push(`- ${tech.nummer} ${tech.naam} (Fase ${tech.fase}): ${tech.wat || ''}`);
        if (tech.doel) parts.push(`  Doel: ${tech.doel}`);
        if (tech.hoe) parts.push(`  Hoe: ${tech.hoe}`);
        if (tech.stappenplan?.length) {
          parts.push(`  Stappenplan: ${tech.stappenplan.slice(0, 4).join(' → ')}`);
        }
      }
    }
  }

  const houdingen = loadJsonSafe(path.join(CONFIG_DIR, 'klant_houdingen.json'));
  if (houdingen?.houdingen) {
    parts.push('\nKLANTHOUDINGEN (Hugo Herbots model):');
    for (const [key, h] of Object.entries(houdingen.houdingen) as any) {
      parts.push(`- ${h.naam || key}: ${h.houding_beschrijving?.substring(0, 120) || ''}`);
      if (h.recommended_technique_ids?.length) {
        parts.push(`  → Aanbevolen technieken: ${h.recommended_technique_ids.join(', ')}`);
      }
    }
  }

  const dynamics = loadJsonSafe(path.join(CONFIG_DIR, 'customer_dynamics.json'));
  if (dynamics) {
    parts.push('\nKLANTDYNAMIEK MODEL:');
    parts.push(`Rapport (vertrouwen), ValueTension (urgentie/waarde), CommitReadiness (beslisbereidheid).`);
    if (dynamics.evaluation_effects) {
      parts.push(`Kwaliteitseffecten: perfect → rapport +${dynamics.evaluation_effects.perfect?.rapport}, niet → rapport ${dynamics.evaluation_effects.niet?.rapport}`);
    }
  }

  const personas = loadJsonSafe(path.join(CONFIG_DIR, 'persona_templates.json'));
  if (personas?.behavior_styles) {
    parts.push('\nGEDRAGSSTIJLEN (koopstijlen):');
    for (const [key, style] of Object.entries(personas.behavior_styles) as any) {
      parts.push(`- ${style.name || key}: ${style.principles?.[0]?.substring(0, 100) || ''}`);
    }
  }

  const detectors = loadJsonSafe(path.join(CONFIG_DIR, 'detectors.json'));
  if (detectors?.lexicon) {
    parts.push('\nDETECTIE LEXICON (kernmarkers):');
    if (detectors.lexicon.context_markers) parts.push(`Context: ${detectors.lexicon.context_markers.join(', ')}`);
    if (detectors.lexicon.benefit_markers) parts.push(`Baten: ${detectors.lexicon.benefit_markers.join(', ')}`);
    if (detectors.lexicon.objection_markers) parts.push(`Bezwaren: ${detectors.lexicon.objection_markers.join(', ')}`);
  }

  const coachOverlay = loadJsonSafe(path.join(CONFIG_DIR, 'ssot', 'coach_overlay_v3_1.json'));
  if (coachOverlay?.flow_rules) {
    parts.push('\nCOACH OVERLAY (sessieflow):');
    parts.push(`Start: ${coachOverlay.flow_rules.always_start_with || 'CONTEXT_GATHERING'}`);
    if (coachOverlay.flow_rules.feedback_trigger) {
      parts.push(`Feedback trigger: ${JSON.stringify(coachOverlay.flow_rules.feedback_trigger).substring(0, 200)}`);
    }
  }

  const ragHeuristics = loadJsonSafe(path.join(CONFIG_DIR, 'rag_heuristics.json'));
  if (ragHeuristics?.scoring) {
    parts.push('\nRAG HEURISTICS (matching):');
    parts.push(`Anchor weight: ${ragHeuristics.scoring.anchor_weight}, mention weight: ${ragHeuristics.scoring.mention_weight || 1}`);
    if (ragHeuristics.matching) {
      parts.push(`Matching mode: ${ragHeuristics.matching.mode}, case insensitive: ${ragHeuristics.matching.case_insensitive}`);
    }
  }

  const videos = findRelevantVideos(detectedTechniqueIds, 5);
  if (videos.length > 0) {
    parts.push('\nBESCHIKBARE TRAININGSVIDEO\'S voor deze technieken:');
    for (const v of videos) {
      const duration = v.durationSeconds ? `${Math.round(v.durationSeconds / 60)} min` : '';
      parts.push(`- "${v.title}" (${v.techniqueId} ${v.techniqueName}) ${duration}`);
    }
  }

  return parts.join('\n');
}

export function buildVideoRecommendationsForMoments(
  moments: Array<{ recommendedTechniques: string[]; type: string }>
): Map<string, VideoRecommendation[]> {
  const result = new Map<string, VideoRecommendation[]>();
  
  for (const moment of moments) {
    if (moment.recommendedTechniques?.length > 0) {
      const videos = findRelevantVideos(moment.recommendedTechniques, 2);
      if (videos.length > 0) {
        result.set(moment.type, videos);
      }
    }
  }

  return result;
}
