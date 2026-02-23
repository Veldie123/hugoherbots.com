/**
 * SSOT Loader - Single Source of Truth for Techniques
 * 
 * ARCHITECTURE RULE: This is the ONLY way to access technique data.
 * All consumers MUST use this loader. NEVER import JSON directly.
 * 
 * Merges:
 * - config/ssot/technieken_index.json (base SSOT - CANONICAL)
 * - config/ssot/evaluator_overlay.json (AI evaluation points)
 * - config/ssot/coach_overlay.json (practice/roleplay config)
 * 
 * SSOT fields (cannot be overridden by overlays):
 * - nummer, naam, fase, parent, wat, waarom, wanneer, hoe, voorbeeld, stappenplan, tags, doel, themas
 * 
 * Overlay fields (extend SSOT, cannot override):
 * - ai_eval_points (evaluator)
 * - practice config (coach)
 */

import fs from "node:fs";
import path from "node:path";

// ============================================
// READONLY TYPES - Compile-time immutability
// ============================================

interface SsotTechnique {
  readonly nummer: string;
  readonly naam: string;
  readonly fase: string;
  readonly parent?: string;
  readonly is_fase?: boolean;
  readonly doel?: string;
  readonly themas?: readonly string[];
  readonly wat?: string;
  readonly waarom?: string;
  readonly wanneer?: string;
  readonly hoe?: string;
  readonly voorbeeld?: readonly string[];
  readonly stappenplan?: readonly string[];
  readonly tags?: readonly string[];
  readonly verkoper_intentie?: readonly string[];
  readonly kan_starten_op_klant_signaal?: boolean;
  readonly context_requirements?: readonly string[];
}

interface EvaluatorOverlay {
  readonly ai_eval_points?: readonly string[];
}

interface CoachOverlay {
  readonly default_mode: "COACH_CHAT" | "COACH_CHAT_THEN_ROLEPLAY";
  readonly roleplay_capable: boolean;
  readonly roleplay_default: boolean;
  readonly notes?: string;
}

// ============================================
// MERGED TECHNIQUE - Readonly, immutable
// ============================================

export interface MergedTechnique {
  readonly nummer: string;
  readonly naam: string;
  readonly fase: string;
  readonly parent?: string;
  readonly is_fase?: boolean;
  readonly doel?: string;
  readonly themas?: readonly string[];
  readonly wat?: string;
  readonly waarom?: string;
  readonly wanneer?: string;
  readonly hoe?: string;
  readonly voorbeeld?: readonly string[];
  readonly stappenplan?: readonly string[];
  readonly tags?: readonly string[];
  readonly verkoper_intentie?: readonly string[];
  readonly kan_starten_op_klant_signaal?: boolean;
  readonly context_requirements?: readonly string[];
  readonly ai_eval_points: readonly string[];
  readonly practice: {
    readonly default_mode: "COACH_CHAT" | "COACH_CHAT_THEN_ROLEPLAY";
    readonly roleplay_capable: boolean;
    readonly roleplay_default: boolean;
    readonly notes?: string;
  };
  readonly detector_id?: string;
}

// ============================================
// SSOT ID SET - For validation
// ============================================

let validSsotIds: ReadonlySet<string> | null = null;

function getValidSsotIds(): ReadonlySet<string> {
  if (validSsotIds) return validSsotIds;
  const ssot = loadJsonFile<{ technieken: Record<string, SsotTechnique> }>(
    "config/ssot/technieken_index.json"
  );
  validSsotIds = new Set(Object.keys(ssot.technieken));
  return validSsotIds;
}

/**
 * Validate that an ID exists in SSOT
 * Throws error if ID is unknown - prevents drift
 */
export function assertValidTechniqueId(id: string): void {
  const validIds = getValidSsotIds();
  if (!validIds.has(id)) {
    throw new Error(
      `[SSOT VIOLATION] Techniek "${id}" bestaat niet in SSOT. ` +
      `Geldige ID's moeten in config/ssot/technieken_index.json staan.`
    );
  }
}

/**
 * Check if an ID exists in SSOT (non-throwing)
 */
export function isValidTechniqueId(id: string): boolean {
  return getValidSsotIds().has(id);
}

// Cache for merged techniques
let mergedCache: readonly MergedTechnique[] | null = null;
let mergedMapCache: ReadonlyMap<string, MergedTechnique> | null = null;

function loadJsonFile<T>(relativePath: string): T {
  const fullPath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

/**
 * Load and merge SSOT with overlays
 * Returns READONLY array - consumers cannot mutate
 * Validates overlay IDs against SSOT at load time
 */
export function loadMergedTechniques(): readonly MergedTechnique[] {
  if (mergedCache) return mergedCache;

  const ssot = loadJsonFile<{ technieken: Record<string, SsotTechnique> }>(
    "config/ssot/technieken_index.json"
  );
  const evaluatorOverlay = loadJsonFile<{ technieken: Record<string, EvaluatorOverlay> }>(
    "config/ssot/evaluator_overlay.json"
  );
  const coachOverlay = loadJsonFile<{ technieken: Record<string, CoachOverlay> }>(
    "config/ssot/coach_overlay.json"
  );

  const ssotIds = new Set(Object.keys(ssot.technieken));

  // RUNTIME VALIDATION: Check for orphan overlay entries
  for (const overlayId of Object.keys(evaluatorOverlay.technieken)) {
    if (!ssotIds.has(overlayId)) {
      console.error(`[SSOT VIOLATION] evaluator_overlay bevat onbekend ID: ${overlayId}`);
    }
  }
  for (const overlayId of Object.keys(coachOverlay.technieken)) {
    if (!ssotIds.has(overlayId)) {
      console.error(`[SSOT VIOLATION] coach_overlay bevat onbekend ID: ${overlayId}`);
    }
  }

  const merged: MergedTechnique[] = [];

  for (const [nummer, technique] of Object.entries(ssot.technieken)) {
    const evalData = evaluatorOverlay.technieken[nummer] || {};
    const coachData = coachOverlay.technieken[nummer] || {
      default_mode: "COACH_CHAT" as const,
      roleplay_capable: false,
      roleplay_default: false,
    };

    merged.push({
      ...technique,
      nummer,
      ai_eval_points: evalData.ai_eval_points || [],
      practice: {
        default_mode: coachData.default_mode,
        roleplay_capable: coachData.roleplay_capable,
        roleplay_default: coachData.roleplay_default,
        notes: coachData.notes,
      },
      detector_id: nummer,
    });
  }

  // Freeze to prevent mutation
  mergedCache = Object.freeze(merged);
  return mergedCache;
}

/**
 * Get technique by nummer (ID)
 */
export function getTechnique(nummer: string): MergedTechnique | undefined {
  if (!mergedMapCache) {
    const techniques = loadMergedTechniques();
    mergedMapCache = new Map(techniques.map(t => [t.nummer, t]));
  }
  return mergedMapCache.get(nummer);
}

/**
 * Get all techniques for a specific fase
 */
export function getTechniquesByFase(fase: string | number): MergedTechnique[] {
  const faseStr = String(fase);
  return loadMergedTechniques().filter(t => t.fase === faseStr);
}

/**
 * Get technique name by nummer (for roleplay-engine compatibility)
 */
export function getTechniqueName(nummer: string): string | undefined {
  return getTechnique(nummer)?.naam;
}

/**
 * Get all technique nummers
 */
export function getAllTechniqueNummers(): string[] {
  return loadMergedTechniques().map(t => t.nummer);
}

/**
 * Clear cache (for hot-reloading in development)
 */
export function clearCache(): void {
  mergedCache = null;
  mergedMapCache = null;
  validSsotIds = null;
}

/**
 * Extended technique interface for fase-level entries
 * Uses standardized fields: doel, themas, hoe, stappenplan, voorbeeld
 */
export interface FaseTechnique extends MergedTechnique {
  readonly is_fase: true;
  readonly themas: readonly string[];
  readonly doel: string;
}

// ============================================
// UTILITY GETTERS - For specific SSOT fields
// ============================================

/**
 * Get technique description (wat field) by ID
 */
export function getTechniqueWat(nummer: string): string | undefined {
  return getTechnique(nummer)?.wat;
}

/**
 * Get technique purpose (doel field) by ID
 */
export function getTechniqueDoel(nummer: string): string | undefined {
  return getTechnique(nummer)?.doel;
}

/**
 * Get technique how-to (hoe field) by ID
 */
export function getTechniqueHoe(nummer: string): string | undefined {
  return getTechnique(nummer)?.hoe;
}

/**
 * Get technique examples by ID
 */
export function getTechniqueExamples(nummer: string): readonly string[] {
  return getTechnique(nummer)?.voorbeeld || [];
}

/**
 * Get technique step plan by ID
 */
export function getTechniqueStappenplan(nummer: string): readonly string[] {
  return getTechnique(nummer)?.stappenplan || [];
}

/**
 * Get full technique description for coach intro
 * Combines naam + wat/doel + hoe for natural language output
 * Uses template from config/ai_prompt.json
 */
export function getTechniqueCoachIntro(nummer: string): string | undefined {
  const t = getTechnique(nummer);
  if (!t) return undefined;
  
  const description = t.doel || t.wat || "";
  const examples = t.voorbeeld?.slice(0, 2).join(", ") || "";
  
  const aiPromptPath = path.join(process.cwd(), "config/ai_prompt.json");
  let template = "Practice {{nummer}}: {{naam}}. {{doel}}{{voorbeelden}}";
  
  try {
    const aiPrompt = JSON.parse(fs.readFileSync(aiPromptPath, "utf-8"));
    template = aiPrompt.templates?.coach_intro?.technique_practice_template || template;
  } catch {
  }
  
  return template
    .replace("{{nummer}}", t.nummer)
    .replace("{{naam}}", t.naam)
    .replace("{{doel}}", description)
    .replace("{{voorbeelden}}", examples ? ` Voorbeelden: ${examples}` : "");
}

/**
 * Get all fase-level techniques (parent phases 0-4)
 * Returns in format compatible with old fases.json consumers
 */
export function getFases(): FaseTechnique[] {
  const techniques = loadMergedTechniques();
  return techniques
    .filter((t: any) => t.is_fase === true)
    .sort((a, b) => Number(a.nummer) - Number(b.nummer)) as FaseTechnique[];
}

/**
 * Get single fase by nummer
 */
export function getFase(nummer: string | number): FaseTechnique | undefined {
  const fases = getFases();
  return fases.find(f => f.nummer === String(nummer));
}

/**
 * Get child techniques for a specific fase
 */
export function getChildTechniques(faseNummer: string | number): MergedTechnique[] {
  const techniques = loadMergedTechniques();
  return techniques.filter(t => t.parent === String(faseNummer));
}

/**
 * Get scoring rubric from evaluator overlay
 */
export function getScoringRubric(): Record<string, { score: number; label: string }> {
  const evaluatorOverlay = loadJsonFile<{ _meta: { scoring_rubric?: Record<string, { score: number; label: string }> } }>(
    "config/ssot/evaluator_overlay.json"
  );
  return evaluatorOverlay._meta.scoring_rubric || {
    perfect: { score: 10, label: "Precies goed" },
    goed: { score: 5, label: "Goed alternatief" },
    bijna: { score: 2, label: "Juiste richting" },
    gemist: { score: 0, label: "Gemist" }
  };
}

/**
 * Validate that SSOT, evaluator overlay, and coach overlay are in sync
 * Returns list of issues found
 */
export function validateSsotConsistency(): string[] {
  const issues: string[] = [];

  const ssot = loadJsonFile<{ technieken: Record<string, SsotTechnique> }>(
    "config/ssot/technieken_index.json"
  );
  const evaluatorOverlay = loadJsonFile<{ technieken: Record<string, EvaluatorOverlay> }>(
    "config/ssot/evaluator_overlay.json"
  );
  const coachOverlay = loadJsonFile<{ technieken: Record<string, CoachOverlay> }>(
    "config/ssot/coach_overlay.json"
  );

  const ssotNummers = new Set(Object.keys(ssot.technieken));
  const evalNummers = new Set(Object.keys(evaluatorOverlay.technieken));
  const coachNummers = new Set(Object.keys(coachOverlay.technieken));

  // Check for orphans in overlays
  Array.from(evalNummers).forEach(num => {
    if (!ssotNummers.has(num)) {
      issues.push(`evaluator_overlay has orphan: ${num}`);
    }
  });
  Array.from(coachNummers).forEach(num => {
    if (!ssotNummers.has(num)) {
      issues.push(`coach_overlay has orphan: ${num}`);
    }
  });

  // Check for missing overlay entries
  Array.from(ssotNummers).forEach(num => {
    if (!evalNummers.has(num)) {
      issues.push(`evaluator_overlay missing: ${num}`);
    }
    if (!coachNummers.has(num)) {
      issues.push(`coach_overlay missing: ${num}`);
    }
  });

  return issues;
}
