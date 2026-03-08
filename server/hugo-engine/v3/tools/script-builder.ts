/**
 * V3 Script Builder Tools
 *
 * Generates personalized sales scripts per EPIC phase based on
 * seller context, SSOT techniques, RAG training materials, and
 * episodic memory. Scripts are built iteratively — one phase at
 * a time with seller feedback between phases.
 *
 * Follows the roleplay tool pattern:
 * start_script_builder → build_script_phase (per phase) → finalize_script
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "../../db";
import { supabase } from "../../supabase-client";
import {
  recallMemories,
  saveMemory,
} from "../memory-service";
import type { V3SessionState } from "../agent";

// ── Script Builder State ────────────────────────────────────────────────────

export interface ScriptPhaseResult {
  steps: {
    action: string;
    example_line: string;
    technique_id?: string;
    hugo_tip?: string;
  }[];
  approved_by_seller: boolean;
  seller_feedback?: string;
}

export interface ScriptBuilderState {
  active: boolean;
  scriptId: string;
  version: number;
  sellerContext: {
    sector?: string;
    product?: string;
    bedrijfsnaam?: string;
    verkoopkanaal?: string;
    klantType?: string;
    ervaring?: string;
    dealgrootte?: string;
    salescycle?: string;
    concurrenten?: string[];
    eigen_usps?: string[];
    eigen_sterktes?: string[];
    eigen_zwaktes?: string[];
    koopredenen?: string[];
    verliesredenen?: string[];
    ovb_items?: { behoefte: string; oplossing: string; voordeel: string; baat: string }[];
    uploadedMaterials?: string;
  };
  phases: Record<string, ScriptPhaseResult>;
  currentPhase: string;
  techniquesUsed: string[];
  completenessScore: number;
}

// ── SSOT Loader ─────────────────────────────────────────────────────────────

let techniqueCache: any = null;

function loadTechniques(): any {
  if (techniqueCache) return techniqueCache;
  const filePath = join(process.cwd(), "config/ssot/technieken_index.json");
  techniqueCache = JSON.parse(readFileSync(filePath, "utf-8"));
  return techniqueCache;
}

function getTechniqueById(id: string): any {
  const data = loadTechniques();
  return data.technieken?.[id] || null;
}

function getTechniquesForPhase(phase: string): any[] {
  const data = loadTechniques();
  const technieken = data.technieken || {};
  return Object.values(technieken).filter((t: any) => t.fase === phase);
}

// ── Completeness Calculator ─────────────────────────────────────────────────

function calculateCompleteness(ctx: ScriptBuilderState["sellerContext"]): number {
  let score = 0;
  const total = 20;

  // A. Identity (8 slots, 2 pts each = 16 pts max but weighted)
  if (ctx.sector) score += 2;
  if (ctx.product) score += 2;
  if (ctx.klantType) score += 1.5;
  if (ctx.bedrijfsnaam) score += 0.5;
  if (ctx.verkoopkanaal) score += 0.5;
  if (ctx.ervaring) score += 0.5;
  if (ctx.dealgrootte) score += 0.5;
  if (ctx.salescycle) score += 0.5;

  // B. Market (5 slots)
  if (ctx.concurrenten?.length) score += 1.5;
  if (ctx.eigen_usps?.length) score += 1.5;
  if (ctx.eigen_sterktes?.length) score += 0.5;
  if (ctx.eigen_zwaktes?.length) score += 0.5;

  // D. Reverse engineering (most important)
  if (ctx.koopredenen?.length) score += Math.min(ctx.koopredenen.length * 0.7, 3);
  if (ctx.verliesredenen?.length) score += Math.min(ctx.verliesredenen.length * 0.7, 3);

  // E. O.V.B. items
  if (ctx.ovb_items?.length) score += Math.min(ctx.ovb_items.length * 0.5, 2);

  // F. Uploaded materials
  if (ctx.uploadedMaterials) score += 1;

  return Math.min(Math.round((score / total) * 100), 100);
}

function getAvailablePhases(score: number): string[] {
  const phases: string[] = [];
  if (score >= 20) phases.push("opening");
  if (score >= 40) phases.push("explore");
  if (score >= 55) phases.push("probe", "impact");
  if (score >= 65) phases.push("commit", "recommendation");
  if (score >= 75) phases.push("objection_handling");
  if (score >= 85) phases.push("closing");
  return phases;
}

// ── Tool Definitions ────────────────────────────────────────────────────────

export const scriptBuilderToolDefinitions: Anthropic.Tool[] = [
  {
    name: "start_script_builder",
    description:
      "Start een scriptbouw-sessie. Haalt bestaande seller context op uit geheugen en profiel. Berekent completeness score en retourneert wat er al bekend is en wat nog ontbreekt. Genereer hierna de Opening fase als er genoeg context is.",
    input_schema: {
      type: "object" as const,
      properties: {
        koopredenen: {
          type: "array",
          items: { type: "string" },
          description: "Waarom klanten kopen — concrete baten en pijnpunten.",
        },
        verliesredenen: {
          type: "array",
          items: { type: "string" },
          description: "Waarom prospects NIET kopen — bezwaren, twijfels, uitstel, angst.",
        },
        concurrenten: {
          type: "array",
          items: { type: "string" },
          description: "Concurrenten met sterktes/zwaktes.",
        },
        eigen_usps: {
          type: "array",
          items: { type: "string" },
          description: "Unique selling propositions.",
        },
        ovb_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              behoefte: { type: "string" },
              oplossing: { type: "string" },
              voordeel: { type: "string" },
              baat: { type: "string" },
            },
          },
          description: "O.V.B. per klantbehoefte: Oplossing → Voordeel → Baat.",
        },
        uploaded_materials_summary: {
          type: "string",
          description: "Samenvatting van geüpload materiaal (brochures, productinfo).",
        },
      },
    },
  },
  {
    name: "build_script_phase",
    description:
      "Genereer een specifieke EPIC fase van het script. Retourneert technieken, stappen, en voorbeeldzinnen gepersonaliseerd op de seller context. Roep dit aan na seller-goedkeuring van de vorige fase.",
    input_schema: {
      type: "object" as const,
      properties: {
        phase: {
          type: "string",
          enum: [
            "opening",
            "explore",
            "probe",
            "impact",
            "commit",
            "recommendation",
            "objection_handling",
            "closing",
          ],
          description: "De EPIC fase om te genereren.",
        },
        seller_feedback: {
          type: "string",
          description: "Feedback van de seller op de vorige fase.",
        },
        focus_techniques: {
          type: "array",
          items: { type: "string" },
          description: "Optioneel: specifieke techniek-IDs om te integreren.",
        },
      },
      required: ["phase"],
    },
  },
  {
    name: "finalize_script",
    description:
      "Sla het voltooide script op en maak het beschikbaar voor review door Hugo. Stuurt een notificatie.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description:
            "Titel voor het script, bv. 'Verkoopscript MedTech — Ziekenhuizen'.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "load_script",
    description:
      "Laad een eerder gegenereerd script voor verdere iteratie of review.",
    input_schema: {
      type: "object" as const,
      properties: {
        script_id: {
          type: "string",
          description: "ID van het script om te laden.",
        },
      },
      required: ["script_id"],
    },
  },
];

// ── Tool Router ─────────────────────────────────────────────────────────────

export const SCRIPT_BUILDER_TOOLS = new Set([
  "start_script_builder",
  "build_script_phase",
  "finalize_script",
  "load_script",
]);

export async function executeScriptBuilderTool(
  name: string,
  input: Record<string, any>,
  session: V3SessionState
): Promise<string> {
  switch (name) {
    case "start_script_builder":
      return execStartScriptBuilder(input, session);
    case "build_script_phase":
      return execBuildScriptPhase(input, session);
    case "finalize_script":
      return execFinalizeScript(input, session);
    case "load_script":
      return execLoadScript(input, session);
    default:
      return JSON.stringify({ error: `Unknown script builder tool: ${name}` });
  }
}

// ── Tool Implementations ────────────────────────────────────────────────────

async function execStartScriptBuilder(
  input: Record<string, any>,
  session: V3SessionState
): Promise<string> {
  try {
    // Gather existing seller context from session profile + memories
    const profile = session.userProfile || {};
    const memories = await recallMemories({
      userId: session.userId,
      query: "sector product koopredenen verliesredenen concurrenten",
      limit: 10,
    });

    // Build seller context from profile + input + memories
    const sellerContext: ScriptBuilderState["sellerContext"] = {
      sector: profile.sector || extractFromMemories(memories, "sector"),
      product: profile.product || extractFromMemories(memories, "product"),
      bedrijfsnaam: profile.bedrijfsnaam || extractFromMemories(memories, "bedrijf"),
      klantType: profile.klantType || extractFromMemories(memories, "klanttype"),
      ervaring: profile.ervaring,
      koopredenen: input.koopredenen || [],
      verliesredenen: input.verliesredenen || [],
      concurrenten: input.concurrenten || [],
      eigen_usps: input.eigen_usps || [],
      ovb_items: input.ovb_items || [],
      uploadedMaterials: input.uploaded_materials_summary || undefined,
    };

    const completeness = calculateCompleteness(sellerContext);
    const availablePhases = getAvailablePhases(completeness);
    const scriptId = crypto.randomUUID();

    // Initialize script builder state on session
    const scriptState: ScriptBuilderState = {
      active: true,
      scriptId,
      version: 1,
      sellerContext,
      phases: {},
      currentPhase: "opening",
      techniquesUsed: [],
      completenessScore: completeness,
    };

    session.scriptBuilder = scriptState;

    // Build missing context report
    const missing: string[] = [];
    if (!sellerContext.sector) missing.push("sector/branche");
    if (!sellerContext.product) missing.push("product/dienst");
    if (!sellerContext.klantType) missing.push("klanttype (doelgroep)");
    if (!sellerContext.koopredenen?.length) missing.push("koopredenen (waarom klanten kopen)");
    if (!sellerContext.verliesredenen?.length) missing.push("verliesredenen (waarom prospects afhaken)");
    if (!sellerContext.concurrenten?.length) missing.push("concurrenten");
    if (!sellerContext.eigen_usps?.length) missing.push("USPs (onderscheidende kenmerken)");
    if (!sellerContext.ovb_items?.length) missing.push("O.V.B. items (Oplossing → Voordeel → Baat)");

    // Load opening techniques for context
    const openingTechniques = ["1", "1.1", "1.2", "1.3", "1.4"].map(id => {
      const t = getTechniqueById(id);
      return t ? { id, naam: t.naam, doel: t.doel, voorbeeld: t.voorbeeld } : null;
    }).filter(Boolean);

    return JSON.stringify({
      started: true,
      script_id: scriptId,
      completeness_score: completeness,
      available_phases: availablePhases,
      seller_context: {
        sector: sellerContext.sector || "onbekend",
        product: sellerContext.product || "onbekend",
        bedrijfsnaam: sellerContext.bedrijfsnaam || "onbekend",
        klantType: sellerContext.klantType || "onbekend",
        koopredenen_count: sellerContext.koopredenen?.length || 0,
        verliesredenen_count: sellerContext.verliesredenen?.length || 0,
        concurrenten_count: sellerContext.concurrenten?.length || 0,
        ovb_items_count: sellerContext.ovb_items?.length || 0,
      },
      missing_context: missing,
      opening_techniques: openingTechniques,
      instructions:
        completeness < 30
          ? "Te weinig context voor een script. Verzamel eerst sector, product, en klanttype."
          : `Context ${completeness}% compleet. Je kunt nu de Opening fase genereren. Ontbrekend: ${missing.join(", ") || "niets"}.`,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Script builder starten mislukt: ${err.message}` });
  }
}

async function execBuildScriptPhase(
  input: Record<string, any>,
  session: V3SessionState
): Promise<string> {
  try {
    const scriptState = session.scriptBuilder;
    if (!scriptState?.active) {
      return JSON.stringify({
        error: "Geen actieve script-sessie. Roep eerst start_script_builder aan.",
      });
    }

    const phase = input.phase as string;
    const sellerFeedback = input.seller_feedback as string | undefined;
    const focusTechniques = input.focus_techniques as string[] | undefined;

    // If there's feedback on a previous phase, store it
    if (sellerFeedback && scriptState.phases[scriptState.currentPhase]) {
      scriptState.phases[scriptState.currentPhase].seller_feedback = sellerFeedback;
    }

    // Map phase to SSOT techniques
    const phaseMapping: Record<string, { ssot_phase: string; technique_ids: string[] }> = {
      opening: { ssot_phase: "1", technique_ids: ["1.1", "1.2", "1.3", "1.4"] },
      explore: { ssot_phase: "2", technique_ids: ["2.1", "2.1.1", "2.1.2", "2.1.3", "2.1.4", "2.1.5", "2.1.6"] },
      probe: { ssot_phase: "2", technique_ids: ["2.2"] },
      impact: { ssot_phase: "2", technique_ids: ["2.3"] },
      commit: { ssot_phase: "2", technique_ids: ["2.4"] },
      recommendation: { ssot_phase: "3", technique_ids: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"] },
      objection_handling: { ssot_phase: "4", technique_ids: ["4.1", "4.2", "4.2.1", "4.2.2", "4.2.3", "4.2.4", "4.2.5", "4.2.6"] },
      closing: { ssot_phase: "4", technique_ids: ["4.3", "4.INDIEN", "4.ABC"] },
    };

    const mapping = phaseMapping[phase];
    if (!mapping) {
      return JSON.stringify({ error: `Onbekende fase: ${phase}` });
    }

    // Load relevant techniques with full detail
    const techniqueIds = focusTechniques?.length ? focusTechniques : mapping.technique_ids;
    const techniques = techniqueIds.map(id => {
      const t = getTechniqueById(id);
      if (!t) return null;
      return {
        id,
        naam: t.naam,
        doel: t.doel,
        wat: t.wat,
        hoe: t.hoe,
        wanneer: t.wanneer,
        stappenplan: t.stappenplan,
        voorbeeld: t.voorbeeld,
        voorbeeld_zinnen: t.voorbeeld_zinnen,
      };
    }).filter(Boolean);

    // Track techniques used
    const newTechIds = techniqueIds.filter(id => !scriptState.techniquesUsed.includes(id));
    scriptState.techniquesUsed.push(...newTechIds);

    // Update current phase
    scriptState.currentPhase = phase;

    // Build context for the agent to use when generating the script phase
    const ctx = scriptState.sellerContext;

    return JSON.stringify({
      phase,
      techniques,
      seller_context: {
        sector: ctx.sector,
        product: ctx.product,
        bedrijfsnaam: ctx.bedrijfsnaam,
        klantType: ctx.klantType,
        verkoopkanaal: ctx.verkoopkanaal,
        koopredenen: ctx.koopredenen,
        verliesredenen: ctx.verliesredenen,
        concurrenten: ctx.concurrenten,
        eigen_usps: ctx.eigen_usps,
        ovb_items: ctx.ovb_items,
      },
      seller_feedback: sellerFeedback || null,
      completeness_score: scriptState.completenessScore,
      instructions: buildPhaseInstructions(phase, ctx),
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Fase genereren mislukt: ${err.message}` });
  }
}

async function execFinalizeScript(
  input: Record<string, any>,
  session: V3SessionState
): Promise<string> {
  try {
    const scriptState = session.scriptBuilder;
    if (!scriptState?.active) {
      return JSON.stringify({ error: "Geen actieve script-sessie." });
    }

    const title = input.title as string;

    // Save to database
    const result = await pool.query(
      `INSERT INTO sales_scripts (id, user_id, version, title, script, context, status, review_status, techniques_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        scriptState.scriptId,
        session.userId,
        scriptState.version,
        title,
        JSON.stringify(scriptState.phases),
        JSON.stringify(scriptState.sellerContext),
        "active",
        "pending",
        scriptState.techniquesUsed,
      ]
    );

    // Create admin correction for review
    const corrResult = await pool.query(
      `INSERT INTO admin_corrections (type, field, new_value, context, submitted_by, source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        "script_review",
        title,
        JSON.stringify({ script_id: scriptState.scriptId, phases: Object.keys(scriptState.phases), techniques: scriptState.techniquesUsed }),
        `Script gegenereerd voor ${scriptState.sellerContext.bedrijfsnaam || session.userId} (${scriptState.sellerContext.sector || "onbekend"} — ${scriptState.sellerContext.product || "onbekend"}). Completeness: ${scriptState.completenessScore}%.`,
        "Hugo (AI)",
        "script_builder",
        "pending",
      ]
    );

    const correctionId = corrResult.rows[0]?.id;

    // Create admin notification
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        "script_generated",
        `Nieuw script: ${title}`,
        `Script gegenereerd voor ${scriptState.sellerContext.bedrijfsnaam || "onbekende verkoper"} (${scriptState.sellerContext.sector || "?"} — ${scriptState.sellerContext.product || "?"}). ${Object.keys(scriptState.phases).length} fasen, ${scriptState.techniquesUsed.length} technieken. Completeness: ${scriptState.completenessScore}%.`,
        "content",
        "medium",
        correctionId,
        "admin-config-review",
      ]
    );

    // Save to episodic memory
    await saveMemory({
      userId: session.userId,
      content: `Script "${title}" gegenereerd. Fasen: ${Object.keys(scriptState.phases).join(", ")}. Technieken: ${scriptState.techniquesUsed.join(", ")}. Completeness: ${scriptState.completenessScore}%.`,
      memoryType: "session_summary",
      sessionId: session.sessionId,
    });

    // Deactivate script builder
    scriptState.active = false;

    return JSON.stringify({
      finalized: true,
      script_id: scriptState.scriptId,
      title,
      phases_completed: Object.keys(scriptState.phases).length,
      techniques_used: scriptState.techniquesUsed.length,
      completeness_score: scriptState.completenessScore,
      review_status: "pending",
      notification_sent: true,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Script opslaan mislukt: ${err.message}` });
  }
}

async function execLoadScript(
  input: Record<string, any>,
  session: V3SessionState
): Promise<string> {
  try {
    const scriptId = input.script_id as string;

    const result = await pool.query(
      `SELECT * FROM sales_scripts WHERE id = $1`,
      [scriptId]
    );

    if (result.rows.length === 0) {
      return JSON.stringify({ error: `Script '${scriptId}' niet gevonden.` });
    }

    const row = result.rows[0];

    // Restore script builder state for iteration
    session.scriptBuilder = {
      active: true,
      scriptId: row.id,
      version: (row.version || 1) + 1,
      sellerContext: row.context || {},
      phases: row.script || {},
      currentPhase: Object.keys(row.script || {}).pop() || "opening",
      techniquesUsed: row.techniques_used || [],
      completenessScore: calculateCompleteness(row.context || {}),
    };

    return JSON.stringify({
      loaded: true,
      script_id: row.id,
      title: row.title,
      version: row.version,
      new_version: (row.version || 1) + 1,
      status: row.status,
      review_status: row.review_status,
      review_feedback: row.review_feedback,
      phases: Object.keys(row.script || {}),
      techniques_used: row.techniques_used,
      context: row.context,
      completeness_score: calculateCompleteness(row.context || {}),
      created_at: row.created_at,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Script laden mislukt: ${err.message}` });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractFromMemories(memories: any[], keyword: string): string | undefined {
  for (const m of memories) {
    const content = (m.content || "").toLowerCase();
    if (content.includes(keyword)) {
      // Extract a short value from memory content
      const match = content.match(new RegExp(`${keyword}[:\\s]+([^.\\n]+)`, "i"));
      if (match) return match[1].trim();
    }
  }
  return undefined;
}

function buildPhaseInstructions(phase: string, ctx: ScriptBuilderState["sellerContext"]): string {
  switch (phase) {
    case "opening":
      return `Genereer Fase 1 — Opening met:
- Koopklimaat openers (aangepast aan ${ctx.verkoopkanaal || "face-to-face"} in ${ctx.sector || "onbekende sector"})
- Gentleman's Agreement (gepersonaliseerd op ${ctx.product || "het product"})
- POP: Persoon (${ctx.bedrijfsnaam || "het bedrijf"}), Organisatie, Proces
- Instapvraag naar Fase 2 (2 varianten)`;

    case "explore":
      return `Genereer Fase 2.1 — EXPLORE vragen over de 8 thema's:
Bron, Motivatie, Ervaring, Verwachtingen, Alternatieven, Budget, Timing, Beslissingscriteria.
Personaliseer op: ${ctx.sector || "onbekend"}, ${ctx.product || "onbekend"}, ${ctx.klantType || "onbekend"}.
${ctx.concurrenten?.length ? `Concurrenten: ${ctx.concurrenten.join(", ")}` : ""}`;

    case "probe":
      return `Genereer Fase 2.2 — PROBE (hypothetische scenario's / storytelling).
Baseer scenario's op: ${ctx.koopredenen?.length ? `koopredenen: ${ctx.koopredenen.join("; ")}` : "geen koopredenen bekend"}.
Gebruik "Stel dat..." en "Wat als..." formuleringen.`;

    case "impact":
      return `Genereer Fase 2.3 — IMPACT (consequentievragen).
Baseer op: ${ctx.koopredenen?.length ? `baten: ${ctx.koopredenen.join("; ")}` : "geen baten bekend"}.
Vraag naar gevolgen: "Wat betekent dat voor u?", "Wat kost het u als dit zo blijft?"`;

    case "commit":
      return `Genereer Fase 2.4 — COMMIT (bevestiging van begrip).
Samenvatten wat ontdekt is en expliciete bevestiging vragen.`;

    case "recommendation":
      return `Genereer Fase 3 — O.V.B. Aanbeveling.
${ctx.ovb_items?.length
  ? `Per behoefte:\n${ctx.ovb_items.map(i => `- ${i.behoefte}: O=${i.oplossing}, V=${i.voordeel}, B=${i.baat}`).join("\n")}`
  : "Geen O.V.B. items bekend — genereer generieke O.V.B. structuur."}
${ctx.eigen_usps?.length ? `USPs: ${ctx.eigen_usps.join(", ")}` : ""}
Voeg technisch voorrekenen toe als prijsdata beschikbaar is.`;

    case "objection_handling":
      return `Genereer Fase 4.2 — Afritten behandelen.
${ctx.verliesredenen?.length
  ? `Verliesredenen:\n${ctx.verliesredenen.map(r => `- ${r}`).join("\n")}\nClassificeer elk als: bezwaar (H7→4.2.4), twijfel (H6→4.2.2), uitstel (H8→4.2.3), angst (H9→4.2.5), of risico (→4.2.6).`
  : "Geen verliesredenen bekend — genereer generieke bezwaarbehandeling."}
${ctx.eigen_zwaktes?.length ? `Anticipeer op zwaktes: ${ctx.eigen_zwaktes.join(", ")}` : ""}`;

    case "closing":
      return `Genereer Fase 4.3 — Finale Closing.
- Proefafsluiting (4.1) — 2-3 varianten
- INDIEN-techniek — 2 varianten gepersonaliseerd op ${ctx.product || "het product"}
- Finale closing: samenvatten → koppelen → CVP → alternatieve keuze → order schrijven`;

    default:
      return `Genereer fase: ${phase}`;
  }
}
