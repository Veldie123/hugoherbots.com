// Configuration loader with validation
import fs from "node:fs";
import { z } from "zod";
import { loadMergedTechniques, getTechnique, getTechniquesByFase, getFases as getSsotFases, getChildTechniques, type MergedTechnique, type FaseTechnique } from "./ssot-loader";

// Schema definitions for config validation
const TechniqueSchema = z.object({
  nummer: z.string().optional(),
  naam: z.string(),
  verplicht_volgnummer: z.number().optional(),
});

const FaseSchema = z.object({
  fase: z.number(),
  naam: z.string(),
  themas: z.array(z.string()),
  technieken: z.array(z.union([TechniqueSchema, z.string()])),
  uitleg: z.string(),
});

// AI Prompt schema - v5.0 aligned (modes/system/guardrails now optional for V2 engine)
const AiPromptSchema = z.object({
  version: z.string(),
  language: z.string(),
  persona: z.string(),
  system: z.string().optional(), // Optional in v5.0 - V2 engine uses separate prompt files
  coach_intros: z.record(z.string(), z.string()).optional(),
  goals: z.object({
    context: z.string().optional(),
    coach_chat: z.string().optional(),
    roleplay: z.string().optional(),
    feedback: z.string().optional(),
  }).optional(),
  constraints: z.any().optional(),
  constraints_persona_overridable: z.any().optional(),
  human_variation: z.any().optional(),
  modes: z.object({
    COACH_CHAT: z.any().optional(),
    ROLEPLAY: z.any().optional(),
    COACH_FEEDBACK: z.any().optional(),
  }).optional(), // Optional in v5.0 - V2 engine uses mode-specific prompt files
  guardrails: z.array(z.string()).optional(), // Optional in v5.0 - now in _global_guidelines
  latency_hints: z.any().optional(),
  templates: z.object({
    coach_chat: z.any().optional(),
    coach_intro: z.any().optional(),
    roleplay: z.any().optional(),
    defaults: z.any().optional(),
    feedback: z.any().optional(),
  }).optional(),
  coach_chat_prompt_blocks: z.any().optional(),
  roleplay_prompt_blocks: z.any().optional(),
  context_questions: z.any().optional(),
  context_normalization: z.any().optional(),
  _architecture_note: z.string().optional(),
  _global_guidelines: z.any().optional(),
});

// Load and cache configurations
let fasesCache: z.infer<typeof FaseSchema>[] | null = null;
let aiPromptCache: z.infer<typeof AiPromptSchema> | null = null;

/**
 * Load fases from SSOT and transform to legacy format
 * Delegates to ssot-loader.getFases() for data, then transforms to expected schema
 */
export function loadFases() {
  if (fasesCache) return fasesCache;
  
  // Get fases from SSOT
  const ssotFases = getSsotFases();
  
  // Transform SSOT format to legacy fases.json format
  const transformed = ssotFases.map((fase: FaseTechnique) => {
    // Get child techniques for this fase
    const childTechniques = getChildTechniques(fase.nummer);
    
    return {
      fase: Number(fase.nummer),
      naam: fase.naam,
      themas: fase.themas || [],
      technieken: childTechniques.map(t => {
        // Parse sequence number from technique ID (e.g., "2.1.3" -> 3)
        const parts = t.nummer.split('.');
        const lastPart = parts[parts.length - 1];
        const seqNum = parseInt(lastPart);
        return {
          nummer: t.nummer,
          naam: t.naam,
          verplicht_volgnummer: isNaN(seqNum) ? undefined : seqNum,
        };
      }),
      uitleg: (fase as any).doel || '', // Use doel as uitleg for legacy compatibility
    };
  });
  
  fasesCache = z.array(FaseSchema).parse(transformed);
  return fasesCache;
}

/**
 * Load techniques catalog from SSOT
 * @deprecated Use loadMergedTechniques() from ssot-loader.ts directly
 */
export function loadTechniquesCatalog(): readonly MergedTechnique[] {
  return loadMergedTechniques();
}

export function loadAiPrompt() {
  if (aiPromptCache) return aiPromptCache;
  const data = JSON.parse(fs.readFileSync("config/ai_prompt.json", "utf-8"));
  aiPromptCache = AiPromptSchema.parse(data);
  return aiPromptCache;
}

// Get context slots for a given phase from ai_prompt.json
export function getContextSlotsForPhase(fase: number): string[] {
  const aiPrompt = loadAiPrompt();
  const phases = (aiPrompt as any).context_questions?._meta?.phases;
  if (!phases) {
    console.warn("[config-loader] No context_questions._meta.phases in ai_prompt.json");
    return [];
  }
  
  // Always include basis slots
  let slots: string[] = [...(phases.basis || [])];
  
  // Phase-specific slots - handle fase2 special case with multiple sub-categories
  if (fase === 2) {
    // Fase 2 has multiple sub-categories in config
    const fase2Slots = [
      ...(phases.fase2_algemeen || []),
      ...(phases.fase2_themas || []),
      ...(phases.fase2_technieken || []),
    ];
    slots = [...slots, ...fase2Slots];
  } else {
    const phaseKey = `fase${fase}`;
    const phaseSlots = phases[phaseKey];
    if (phaseSlots && Array.isArray(phaseSlots)) {
      slots = [...slots, ...phaseSlots];
    }
  }
  
  return slots;
}

// Get technique details from catalog
export function getTechniqueFromCatalog(techniqueId: string): MergedTechnique | undefined {
  return getTechnique(techniqueId);
}

// Helper: Get allowed techniques for a given phase
export function getAllowedTechniques(fase: number, _attitude: string | null): string[] {
  const fases = loadFases();

  // Phase 1: enforce sequential order
  if (fase === 1) {
    const faseData = fases.find(f => f.fase === 1);
    if (!faseData) return ["1.1"];
    
    return faseData.technieken
      .filter((t): t is { nummer?: string; naam: string; verplicht_volgnummer?: number } => 
        typeof t === 'object' && t !== null
      )
      .sort((a, b) => (a.verplicht_volgnummer || 0) - (b.verplicht_volgnummer || 0))
      .map(t => t.nummer || `1.${t.verplicht_volgnummer || 1}`);
  }

  // For phases 2-4: get all techniques for that phase from catalog
  const catalog = loadTechniquesCatalog();
  const techniques = catalog
    .filter(t => t.fase === String(fase))
    .map(t => t.nummer);

  // Generic answer technique is always allowed
  techniques.push("A1");

  return techniques;
}
