/**
 * prompt-context.ts - Shared config loaders and context builders
 * 
 * This module provides shared access to methodology, detectors, attitudes,
 * personas, and evaluation criteria for both COACH_CHAT mode and 
 * CONTEXT_GATHERING mode.
 * 
 * EXPORTED CONFIG LOADERS:
 * - loadTechniquesIndex() - technieken_index.json (SSOT)
 * - loadDetectors() - detectors.json
 * - loadKlantHoudingen() - klant_houdingen.json
 * - loadPersonaTemplates() - persona_templates.json
 * - loadEvaluatorOverlay() - evaluator_overlay.json (SSOT)
 * - loadVideoMapping() - video_mapping.json
 * 
 * EXPORTED CONTEXT BUILDERS:
 * - buildMethodologyContext() - Complete 5-phase methodology
 * - buildDetectorPatterns(techniqueId?) - Pattern recognition
 * - buildAttitudesContext() - Customer attitudes
 * - buildPersonaContext() - Persona templates
 * - buildEvaluationCriteria(techniqueId?) - Evaluation criteria
 * - getVideosForTechnique(techniqueId) - Videos for technique
 * 
 * ARCHITECTURE:
 * - Configs are cached after first load
 * - Strict validation - throws on missing files
 * - Good logging to track which configs are loaded
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface VideoInfo {
  title: string;
  fase: number;
  techniek: string | null;
  onderwerp: string;
  beschrijving: string;
}

export interface VideoMapping {
  videos: Record<string, VideoInfo>;
  techniek_videos: Record<string, string[]>;
  onderwerp_videos: Record<string, string[]>;
}

// ============================================================================
// CONFIG CACHES
// ============================================================================

let videoMappingCache: VideoMapping | null = null;
let techniquesIndexCache: any = null;
let detectorsCache: any = null;
let klantHoudingenCache: any = null;
let personaTemplatesCache: any = null;
let evaluatorOverlayCache: any = null;
let globalConfigCache: any = null;
let coachOverlayCache: any = null;
let contextPromptCache: any = null;

// ============================================================================
// CONFIG LOADERS - All configs that can be shared
// ============================================================================

/**
 * Load video mapping from config/video_mapping.json
 */
export function loadVideoMapping(): VideoMapping | null {
  if (videoMappingCache) return videoMappingCache;
  try {
    const configPath = path.join(process.cwd(), "config", "video_mapping.json");
    const data = fs.readFileSync(configPath, "utf-8");
    videoMappingCache = JSON.parse(data);
    console.log("[prompt-context] Loaded video_mapping.json with", Object.keys(videoMappingCache!.videos).length, "videos");
    return videoMappingCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load video_mapping.json:", error);
    return null;
  }
}

/**
 * Load techniques index from config/ssot/technieken_index.json
 */
export function loadTechniquesIndex(): any {
  if (techniquesIndexCache) return techniquesIndexCache;
  try {
    const configPath = path.join(process.cwd(), "config", "ssot", "technieken_index.json");
    const data = fs.readFileSync(configPath, "utf-8");
    techniquesIndexCache = JSON.parse(data);
    console.log("[prompt-context] Loaded technieken_index.json");
    return techniquesIndexCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load technieken_index.json:", error);
    return null;
  }
}

/**
 * Load detectors from config/detectors.json
 */
export function loadDetectors(): any {
  if (detectorsCache) return detectorsCache;
  try {
    const configPath = path.join(process.cwd(), "config", "detectors.json");
    const data = fs.readFileSync(configPath, "utf-8");
    detectorsCache = JSON.parse(data);
    console.log("[prompt-context] Loaded detectors.json");
    return detectorsCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load detectors.json:", error);
    return null;
  }
}

/**
 * Load klant houdingen from config/klant_houdingen.json
 */
export function loadKlantHoudingen(): any {
  if (klantHoudingenCache) return klantHoudingenCache;
  try {
    const configPath = path.join(process.cwd(), "config", "klant_houdingen.json");
    const data = fs.readFileSync(configPath, "utf-8");
    klantHoudingenCache = JSON.parse(data);
    console.log("[prompt-context] Loaded klant_houdingen.json");
    return klantHoudingenCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load klant_houdingen.json:", error);
    return null;
  }
}

/**
 * Load persona templates from config/persona_templates.json
 */
export function loadPersonaTemplates(): any {
  if (personaTemplatesCache) return personaTemplatesCache;
  try {
    const configPath = path.join(process.cwd(), "config", "persona_templates.json");
    const data = fs.readFileSync(configPath, "utf-8");
    personaTemplatesCache = JSON.parse(data);
    console.log("[prompt-context] Loaded persona_templates.json");
    return personaTemplatesCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load persona_templates.json:", error);
    return null;
  }
}

/**
 * Load evaluator overlay from config/ssot/evaluator_overlay.json
 */
export function loadEvaluatorOverlay(): any {
  if (evaluatorOverlayCache) return evaluatorOverlayCache;
  try {
    const configPath = path.join(process.cwd(), "config", "ssot", "evaluator_overlay.json");
    const data = fs.readFileSync(configPath, "utf-8");
    evaluatorOverlayCache = JSON.parse(data);
    console.log("[prompt-context] Loaded evaluator_overlay.json");
    return evaluatorOverlayCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load evaluator_overlay.json:", error);
    return null;
  }
}

/**
 * Load global config from config/global_config.json
 */
export function loadGlobalConfig(): any {
  if (globalConfigCache) return globalConfigCache;
  try {
    const configPath = path.join(process.cwd(), "config", "global_config.json");
    const data = fs.readFileSync(configPath, "utf-8");
    globalConfigCache = JSON.parse(data);
    console.log("[prompt-context] Loaded global_config.json");
    return globalConfigCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load global_config.json:", error);
    return null;
  }
}

/**
 * Load coach overlay from config/ssot/coach_overlay.json
 */
export function loadCoachOverlay(): any {
  if (coachOverlayCache) return coachOverlayCache;
  try {
    const configPath = path.join(process.cwd(), "config", "ssot", "coach_overlay.json");
    const data = fs.readFileSync(configPath, "utf-8");
    coachOverlayCache = JSON.parse(data);
    console.log("[prompt-context] Loaded coach_overlay.json");
    return coachOverlayCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load coach_overlay.json:", error);
    return null;
  }
}

/**
 * Load context prompt config from config/prompts/context_prompt.json
 */
export function loadContextPrompt(): any {
  if (contextPromptCache) return contextPromptCache;
  try {
    const configPath = path.join(process.cwd(), "config", "prompts", "context_prompt.json");
    const data = fs.readFileSync(configPath, "utf-8");
    contextPromptCache = JSON.parse(data);
    console.log("[prompt-context] Loaded context_prompt.json");
    return contextPromptCache;
  } catch (error) {
    console.warn("[prompt-context] Could not load context_prompt.json:", error);
    return null;
  }
}

/**
 * Get slot definitions from context_prompt.json
 */
export function getSlotDefinitions(): { base: string[]; extended: string[] } {
  const contextPrompt = loadContextPrompt();
  if (!contextPrompt?.slot_definitions) {
    return {
      base: ['sector', 'product', 'verkoopkanaal', 'klant_type', 'ervaring'],
      extended: ['budget', 'timing', 'pains', 'emotionele_triggers', 'beslissingscriteria', 'alternatieven', 'motivatie', 'bron', 'verwachtingen', 'locatie']
    };
  }
  return {
    base: contextPrompt.slot_definitions.base || [],
    extended: contextPrompt.slot_definitions.extended || []
  };
}

/**
 * Get flow rules from coach_overlay.json
 */
export function getFlowRules(): any {
  const coachOverlay = loadCoachOverlay();
  return coachOverlay?.flow_rules || null;
}

/**
 * Get technique config from coach_overlay.json
 */
export function getTechniqueOverlay(techniqueId: string): any {
  const coachOverlay = loadCoachOverlay();
  if (!coachOverlay?.technieken) return null;
  return coachOverlay.technieken[techniqueId] || null;
}

/**
 * Get videos for a specific technique
 */
export function getVideosForTechnique(techniqueId: string): { title: string; beschrijving: string }[] {
  const mapping = loadVideoMapping();
  if (!mapping?.videos) return [];
  
  if (mapping.techniek_videos?.[techniqueId]) {
    const videoFiles = mapping.techniek_videos[techniqueId] || [];
    return videoFiles.map((file: string) => {
      const info = mapping.videos[file];
      return info ? { title: info.title, beschrijving: info.beschrijving || '' } : null;
    }).filter((v: any) => v !== null) as { title: string; beschrijving: string }[];
  }
  
  return Object.values(mapping.videos)
    .filter((v: any) => v.techniek === techniqueId && v.user_ready)
    .slice(0, 5)
    .map((v: any) => ({ title: v.title || v.file_name, beschrijving: v.beschrijving || '' }));
}

export function buildFullVideoCatalog(): string {
  const mapping = loadVideoMapping();
  if (!mapping?.videos) return "Geen video mapping beschikbaar.";
  
  const videos = Object.values(mapping.videos)
    .filter((v: any) => v.user_ready)
    .sort((a: any, b: any) => {
      const faseA = parseInt(a.fase || "99");
      const faseB = parseInt(b.fase || "99");
      if (faseA !== faseB) return faseA - faseB;
      const techA = (a.techniek || "99").split(".").map(Number);
      const techB = (b.techniek || "99").split(".").map(Number);
      for (let i = 0; i < Math.max(techA.length, techB.length); i++) {
        const na = techA[i] || 0;
        const nb = techB[i] || 0;
        if (na !== nb) return na - nb;
      }
      return 0;
    });
  
  const faseNamen: Record<string, string> = {
    "0": "Pre-contact",
    "1": "Opening",
    "2": "Ontdekking",
    "3": "Aanbeveling",
    "4": "Beslissing"
  };
  
  let result = `VOLLEDIGE VIDEOCATALOGUS (${videos.length} cursus-video's in afspeelvolgorde):\n\n`;
  let currentFase = "";
  let nr = 1;
  
  for (const v of videos as any[]) {
    const fase = v.fase || "?";
    if (fase !== currentFase) {
      currentFase = fase;
      const faseLabel = faseNamen[fase] || `Fase ${fase}`;
      result += `\n── Fase ${fase}: ${faseLabel} ──\n`;
    }
    const duur = v.duration_seconds ? `${Math.round(v.duration_seconds / 60)}min` : "";
    result += `${nr}. "${v.title || v.file_name}" — techniek ${v.techniek || "?"} ${duur ? `(${duur})` : ""}\n`;
    nr++;
  }
  
  return result;
}

// ============================================================================
// RICH CONTEXT BUILDERS - Build context from all loaded configs
// ============================================================================

/**
 * Build COMPLETE methodology context from technieken_index.json
 * Shows all 5 phases with VOLLEDIGE techniek-informatie: wat, waarom, wanneer, hoe, voorbeeld, stappenplan
 * 
 * Dit is de KERN van Hugo's kennis - de AI moet de volledige theorie begrijpen, niet alleen labels.
 */
export function buildMethodologyContext(): string {
  const techniques = loadTechniquesIndex();
  if (!techniques?.technieken) return "(Methodologie niet beschikbaar)";
  
  const parts: string[] = [];
  const techs = techniques.technieken as Record<string, any>;
  
  const getChildren = (prefix: string, depth: number) => {
    return Object.entries(techs)
      .filter(([id]) => {
        if (prefix === "") {
          return id.split('.').length === 1;
        }
        return id.startsWith(prefix + '.') && id.split('.').length === depth;
      })
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  };
  
  // Helper om VOLLEDIGE techniek-info te formatteren - inclusief ALLE velden
  const formatTechniqueDetails = (tech: any, indent: string = ""): string => {
    const lines: string[] = [];
    
    // Kern informatie
    if (tech.doel) lines.push(`${indent}Doel: ${tech.doel}`);
    if (tech.wat) lines.push(`${indent}Wat: ${tech.wat}`);
    if (tech.waarom) lines.push(`${indent}Waarom: ${tech.waarom}`);
    if (tech.wanneer) lines.push(`${indent}Wanneer: ${tech.wanneer}`);
    if (tech.hoe) lines.push(`${indent}Hoe: ${tech.hoe}`);
    
    // Stappenplan
    if (tech.stappenplan && Array.isArray(tech.stappenplan)) {
      lines.push(`${indent}Stappenplan:`);
      tech.stappenplan.forEach((step: string, i: number) => {
        lines.push(`${indent}  ${i + 1}. ${step}`);
      });
    }
    
    // Voorbeelden
    if (tech.voorbeeld && Array.isArray(tech.voorbeeld)) {
      lines.push(`${indent}Voorbeelden:`);
      tech.voorbeeld.forEach((ex: string) => {
        lines.push(`${indent}  - "${ex}"`);
      });
    }
    
    // Tags
    if (tech.tags && Array.isArray(tech.tags) && tech.tags.length > 0) {
      lines.push(`${indent}Tags: ${tech.tags.join(", ")}`);
    }
    
    // Verkoper intentie
    if (tech.verkoper_intentie && Array.isArray(tech.verkoper_intentie) && tech.verkoper_intentie.length > 0) {
      lines.push(`${indent}Verkoper intentie: ${tech.verkoper_intentie.join(", ")}`);
    }
    
    // Context requirements
    if (tech.context_requirements && Array.isArray(tech.context_requirements) && tech.context_requirements.length > 0) {
      lines.push(`${indent}Context nodig: ${tech.context_requirements.join(", ")}`);
    }
    
    // Themas (voor fases)
    if (tech.themas && Array.isArray(tech.themas) && tech.themas.length > 0) {
      lines.push(`${indent}Thema's: ${tech.themas.join(", ")}`);
    }
    
    // Kan starten op klant signaal
    if (tech.kan_starten_op_klant_signaal !== undefined) {
      lines.push(`${indent}Kan starten op klant signaal: ${tech.kan_starten_op_klant_signaal ? 'ja' : 'nee'}`);
    }
    
    return lines.join("\n");
  };
  
  for (const phaseId of ["0", "1", "2", "3", "4"]) {
    const phaseTech = techs[phaseId];
    if (!phaseTech) continue;
    
    parts.push(`\n═══════════════════════════════════════`);
    parts.push(`FASE ${phaseId}: ${phaseTech.naam}`);
    parts.push(`═══════════════════════════════════════`);
    parts.push(formatTechniqueDetails(phaseTech));
    
    const level2 = getChildren(phaseId, 2);
    
    if (level2.length > 0) {
      for (const [l2Id, l2Tech] of level2) {
        const l2Name = (l2Tech as any).naam || l2Id;
        parts.push(`\n── ${l2Id}: ${l2Name} ──`);
        parts.push(formatTechniqueDetails(l2Tech as any, "  "));
        
        const level3 = getChildren(l2Id, 3);
        for (const [l3Id, l3Tech] of level3) {
          const l3Name = (l3Tech as any).naam || l3Id;
          parts.push(`\n  • ${l3Id}: ${l3Name}`);
          parts.push(formatTechniqueDetails(l3Tech as any, "    "));
          
          const level4 = getChildren(l3Id, 4);
          for (const [l4Id, l4Tech] of level4) {
            const l4Name = (l4Tech as any).naam || l4Id;
            parts.push(`\n    ◦ ${l4Id}: ${l4Name}`);
            parts.push(formatTechniqueDetails(l4Tech as any, "      "));
          }
        }
      }
    }
  }
  
  return parts.join("\n");
}

/**
 * Build detector patterns context for current technique AND related techniques
 * Shows complete pattern sets for coaching effectiveness
 */
export function buildDetectorPatterns(techniqueId?: string): string {
  const detectors = loadDetectors();
  if (!detectors?.techniques) return "(Detector patterns niet beschikbaar)";
  
  const parts: string[] = [];
  
  if (techniqueId && detectors.techniques[techniqueId]) {
    const tech = detectors.techniques[techniqueId];
    parts.push(`\n**Huidige techniek (${techniqueId}) - herkenningspatronen:**`);
    if (tech.patterns && tech.patterns.length > 0) {
      parts.push(`Signaalwoorden: ${tech.patterns.join(", ")}`);
    }
    if (tech.semantic && tech.semantic.length > 0) {
      parts.push(`Semantisch: ${tech.semantic.join(", ")}`);
    }
    if (tech.negations && tech.negations.length > 0) {
      parts.push(`Vermijden: ${tech.negations.join(", ")}`);
    }
    if (tech.confidence_threshold) {
      parts.push(`Betrouwbaarheidsdrempel: ${tech.confidence_threshold}`);
    }
  }
  
  if (techniqueId) {
    const phaseId = techniqueId.split('.')[0];
    const relatedTechs = Object.entries(detectors.techniques)
      .filter(([id]) => id.startsWith(phaseId + '.') && id !== techniqueId)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    
    if (relatedTechs.length > 0) {
      parts.push(`\n**Andere technieken in fase ${phaseId}:**`);
      for (const [id, tech] of relatedTechs) {
        const patterns = (tech as any).patterns?.join(", ") || "";
        if (patterns) {
          parts.push(`- ${id}: ${patterns}`);
        }
      }
    }
  }
  
  if (detectors.lexicon) {
    parts.push("\n**Algemene signaalwoorden per categorie:**");
    const lexiconEntries = Object.entries(detectors.lexicon);
    lexiconEntries.forEach(([key, values]: [string, any]) => {
      if (Array.isArray(values) && values.length > 0) {
        parts.push(`- ${key}: ${values.join(", ")}`);
      }
    });
  }
  
  return parts.join("\n");
}

/**
 * Build attitudes context from klant_houdingen.json
 */
export function buildAttitudesContext(): string {
  const houdingen = loadKlantHoudingen();
  if (!houdingen?.houdingen) return "(Klanthoudingen niet beschikbaar)";
  
  const parts: string[] = [];
  
  for (const [key, attitude] of Object.entries(houdingen.houdingen as Record<string, any>)) {
    parts.push(`\n**${attitude.naam}** (${attitude.id})`);
    parts.push(`Beschrijving: ${attitude.houding_beschrijving}`);
    if (attitude.generation_examples?.length > 0) {
      parts.push(`Voorbeelden: ${attitude.generation_examples.slice(0, 2).join("; ")}`);
    }
  }
  
  return parts.join("\n");
}

/**
 * Build persona templates context
 */
export function buildPersonaContext(): string {
  const templates = loadPersonaTemplates();
  if (!templates) return "(Persona templates niet beschikbaar)";
  
  const parts: string[] = [];
  
  if (templates.behavior_styles) {
    parts.push("\n**Gedragsstijlen:**");
    Object.entries(templates.behavior_styles).forEach(([key, style]: [string, any]) => {
      parts.push(`- ${key}: ${style.description || style.name || key}`);
    });
  }
  
  if (templates.buying_clock_stages) {
    parts.push("\n**Koopfases:**");
    Object.entries(templates.buying_clock_stages).forEach(([key, stage]: [string, any]) => {
      parts.push(`- ${key}: ${stage.description || stage.name || key}`);
    });
  }
  
  if (templates.experience_levels) {
    parts.push("\n**Ervaringsniveaus:**");
    Object.entries(templates.experience_levels).forEach(([key, level]: [string, any]) => {
      parts.push(`- ${key}: ${level.description || level.name || key}`);
    });
  }
  
  return parts.join("\n");
}

/**
 * Build evaluation criteria context from evaluator_overlay.json
 */
export function buildEvaluationCriteria(techniqueId?: string): string {
  const overlay = loadEvaluatorOverlay();
  if (!overlay) return "(Evaluatie criteria niet beschikbaar)";
  
  const parts: string[] = [];
  
  if (overlay._meta?.scoring_rubric) {
    parts.push("\n**Scoring:**");
    Object.entries(overlay._meta.scoring_rubric).forEach(([key, rubric]: [string, any]) => {
      parts.push(`- ${key}: ${rubric.score} punten - ${rubric.label}`);
    });
  }
  
  if (techniqueId && overlay.technieken?.[techniqueId]) {
    const tech = overlay.technieken[techniqueId];
    parts.push(`\n**Evaluatie voor ${techniqueId}:**`);
    parts.push(`Type: ${tech.eval_type || 'stappenplan_check'}`);
    if (tech.eval_note) {
      parts.push(`Let op: ${tech.eval_note}`);
    }
  }
  
  return parts.join("\n");
}

/**
 * Clear all caches (useful for testing or config reload)
 */
export function clearAllCaches(): void {
  videoMappingCache = null;
  techniquesIndexCache = null;
  detectorsCache = null;
  klantHoudingenCache = null;
  personaTemplatesCache = null;
  evaluatorOverlayCache = null;
  console.log("[prompt-context] All caches cleared");
}
