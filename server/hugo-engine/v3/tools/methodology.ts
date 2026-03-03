/**
 * V3 Methodology Enforcement Tools
 *
 * Deterministic tools that enforce Hugo's EPIC sales methodology.
 * These are NOT AI-based — they use pure code logic to guarantee
 * methodology rules are followed during roleplay and evaluation.
 *
 * Rules enforced:
 * A) Phase restrictions: H6-H9 only in phases 3+4, with trigger techniques
 * B) Trigger techniques: H6-H9 require 4.1 or 4.INDIEN detected first
 * C) Always exactly 1 houding per turn
 * D) Expected moves: recommended techniques per houding from SSOT
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import {
  selectHoudingForTurn,
  getHoudingProbabilities,
  buildHoudingSection,
  initializeCustomerDynamics,
  updateCustomerDynamics,
  type SelectedHouding,
  type ResolvedPersona,
  type CustomerDynamics,
} from "../../houding-selector";
import {
  getTechnique,
  getScoringRubric,
  type MergedTechnique,
} from "../../ssot-loader";

// ── Config Loaders ───────────────────────────────────────────────────────────

let klantHoudingenCache: any = null;
let personaTemplatesCache: any = null;

function loadKlantHoudingen(): any {
  if (klantHoudingenCache) return klantHoudingenCache;
  const filePath = join(process.cwd(), "config/klant_houdingen.json");
  klantHoudingenCache = JSON.parse(readFileSync(filePath, "utf-8"));
  return klantHoudingenCache;
}

function loadPersonaTemplates(): any {
  if (personaTemplatesCache) return personaTemplatesCache;
  const filePath = join(process.cwd(), "config/persona_templates.json");
  personaTemplatesCache = JSON.parse(readFileSync(filePath, "utf-8"));
  return personaTemplatesCache;
}

// ── Valid customer signals ───────────────────────────────────────────────────

type CustomerSignal =
  | "positief"
  | "negatief"
  | "vaag"
  | "ontwijkend"
  | "vraag"
  | "twijfel"
  | "bezwaar"
  | "uitstel"
  | "angst";

const ALL_SIGNALS: CustomerSignal[] = [
  "positief",
  "negatief",
  "vaag",
  "ontwijkend",
  "vraag",
  "twijfel",
  "bezwaar",
  "uitstel",
  "angst",
];

// ── Tool Definitions (Claude format) ─────────────────────────────────────────

export const methodologyToolDefinitions: Anthropic.Tool[] = [
  {
    name: "select_customer_attitude",
    description:
      "VERPLICHT bij elke roleplay-beurt. Selecteert exact 1 klanthouding op basis van EPIC fase, customer dynamics, en persona. Deterministische logica — geen AI. Retourneert de houding die je MOET spelen als klant, inclusief signalen, beschrijving, en verwachte technieken.",
    input_schema: {
      type: "object" as const,
      properties: {
        phase: {
          type: "number",
          description:
            "Huidige EPIC fase (1=kennismaking, 2=ontdekking, 3=aanbeveling, 4=afsluiting).",
        },
        dynamics: {
          type: "object",
          description:
            "Customer dynamics state. Optioneel — wordt geïnitialiseerd als niet opgegeven.",
          properties: {
            rapport: {
              type: "number",
              description: "Rapport level 0-1.",
            },
            valueTension: {
              type: "number",
              description: "Value tension level 0-1.",
            },
            commitReadiness: {
              type: "number",
              description: "Commit readiness level 0-1.",
            },
          },
        },
        last_detected_techniques: {
          type: "array",
          items: { type: "string" },
          description:
            "Techniek-IDs die de seller recent heeft toegepast. Nodig voor trigger-check bij H6-H9.",
        },
        persona: {
          type: "object",
          description:
            "Persona parameters. Optioneel — defaults worden gebruikt als niet opgegeven.",
          properties: {
            behavior_style: {
              type: "string",
              description:
                "Gedragsstijl: analyserend, controlerend, faciliterend, promoverend.",
            },
            buying_clock_stage: {
              type: "string",
              description: "Koopklok fase.",
            },
            experience_level: {
              type: "string",
              description: "Ervaringsniveau van de klant.",
            },
            difficulty_level: {
              type: "string",
              description: "Moeilijkheidsgraad.",
            },
          },
        },
      },
      required: ["phase"],
    },
  },
  {
    name: "classify_customer_signal",
    description:
      "Valideert of een geplande klanthouding toegestaan is in de huidige fase. Enforcement: als de houding geblokkeerd is (bv. twijfel in fase 2), wordt een fallback geretourneerd (vaag → ontwijkend → positief). Deterministische logica.",
    input_schema: {
      type: "object" as const,
      properties: {
        suggested_signal: {
          type: "string",
          enum: ALL_SIGNALS,
          description:
            "De houding die je wilt gebruiken (bv. 'twijfel', 'bezwaar').",
        },
        phase: {
          type: "number",
          description: "Huidige EPIC fase (1-4).",
        },
      },
      required: ["suggested_signal", "phase"],
    },
  },
  {
    name: "get_recommended_techniques",
    description:
      "Retourneert de aanbevolen technieken voor een specifiek klantsignaal. Uit klant_houdingen.json SSOT. Gebruik dit om de seller te begeleiden naar de juiste reactie.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_signal: {
          type: "string",
          enum: ALL_SIGNALS,
          description: "Het klantsignaal waarvoor technieken gezocht worden.",
        },
      },
      required: ["customer_signal"],
    },
  },
  {
    name: "evaluate_technique",
    description:
      "Evalueer of de seller de juiste techniek toepast. Retourneert: SSOT stappenplan, voorbeeldzinnen, expected moves, en scoring rubric. Gebruik de context om zelf te beoordelen of de seller de techniek correct toepast.",
    input_schema: {
      type: "object" as const,
      properties: {
        seller_message: {
          type: "string",
          description: "Het bericht van de seller om te evalueren.",
        },
        customer_signal: {
          type: "string",
          enum: ALL_SIGNALS,
          description: "Het huidige klantsignaal.",
        },
        technique_id: {
          type: "string",
          description:
            "De techniek-ID die je verwacht of wilt evalueren (bv. '2.1.3').",
        },
        detected_technique_ids: {
          type: "array",
          items: { type: "string" },
          description:
            "Optioneel: techniek-IDs die je al gedetecteerd hebt in het seller bericht.",
        },
      },
      required: ["seller_message", "customer_signal", "technique_id"],
    },
  },
];

// ── Tool Execution ──────────────────────────────────────────────────────────

export function executeMethodologyTool(
  name: string,
  input: Record<string, any>
): string {
  switch (name) {
    case "select_customer_attitude":
      return execSelectCustomerAttitude(input);
    case "classify_customer_signal":
      return execClassifyCustomerSignal(input);
    case "get_recommended_techniques":
      return execGetRecommendedTechniques(input);
    case "evaluate_technique":
      return execEvaluateTechnique(input);
    default:
      return JSON.stringify({ error: `Unknown methodology tool: ${name}` });
  }
}

// ── Tool Implementations ────────────────────────────────────────────────────

function execSelectCustomerAttitude(input: Record<string, any>): string {
  const klantHoudingen = loadKlantHoudingen();
  const personaTemplates = loadPersonaTemplates();

  const phase: number = input.phase;
  const dynamics: CustomerDynamics | undefined = input.dynamics;
  const lastDetectedTechniques: string[] | undefined =
    input.last_detected_techniques;

  // Build persona — use defaults from persona_templates if not provided
  const defaults = personaTemplates.defaults || {};
  const personaInput = input.persona || {};
  const persona: ResolvedPersona = {
    behavior_style:
      personaInput.behavior_style || defaults.behavior_style || "analyserend",
    buying_clock_stage:
      personaInput.buying_clock_stage ||
      defaults.buying_clock_stage ||
      "market_research",
    experience_level:
      personaInput.experience_level ||
      defaults.experience_level ||
      "enige_ervaring",
    difficulty_level:
      personaInput.difficulty_level ||
      defaults.difficulty_level ||
      "bewuste_kunde",
  };

  // Select houding using the deterministic selector
  const selected: SelectedHouding = selectHoudingForTurn(
    persona,
    personaTemplates,
    klantHoudingen,
    phase,
    dynamics,
    lastDetectedTechniques
  );

  // Also get probabilities for transparency
  const probabilities = getHoudingProbabilities(
    persona,
    personaTemplates,
    klantHoudingen,
    phase,
    dynamics,
    lastDetectedTechniques
  );

  // Build the houding instruction section for the agent
  const houdingSection = buildHoudingSection(selected);

  // Get recommended techniques for this houding
  const houding = klantHoudingen.houdingen?.[selected.key];
  const recommendedTechniqueIds: string[] =
    houding?.recommended_technique_ids || [];
  const recommendedTechniques = recommendedTechniqueIds.map((id: string) => {
    const tech = getTechnique(id);
    return { id, naam: tech?.naam || id };
  });

  return JSON.stringify({
    selected_houding: {
      id: selected.id,
      key: selected.key,
      naam: selected.naam,
      beschrijving: selected.beschrijving,
      signalen: selected.signalen,
    },
    recommended_techniques: recommendedTechniques,
    houding_instruction: houdingSection,
    probabilities,
    phase,
    persona,
  });
}

function execClassifyCustomerSignal(input: Record<string, any>): string {
  const suggestedSignal = input.suggested_signal as CustomerSignal;
  const phase: number = input.phase;

  if (!ALL_SIGNALS.includes(suggestedSignal)) {
    return JSON.stringify({
      error: `Ongeldig signaal: ${suggestedSignal}. Geldige signalen: ${ALL_SIGNALS.join(", ")}`,
    });
  }

  // Phase restriction enforcement — re-implemented from customer_engine.ts
  // to avoid importing the full V2 module with OpenAI dependencies
  const klantHoudingen = loadKlantHoudingen();
  const attitudeConfig = klantHoudingen.houdingen?.[suggestedSignal];

  if (attitudeConfig) {
    const faseRestrictie = attitudeConfig.fase_restrictie;
    if (faseRestrictie && !faseRestrictie.allowed_at_any_phase) {
      const allowedPhases: number[] = faseRestrictie.allowed_phases || [];
      if (!allowedPhases.includes(phase)) {
        // Signal is blocked in this phase — apply fallback chain
        const fallbackOrder: CustomerSignal[] = [
          "vaag",
          "ontwijkend",
          "positief",
        ];
        for (const fallback of fallbackOrder) {
          const fbConfig = klantHoudingen.houdingen?.[fallback];
          const fbRestriction = fbConfig?.fase_restrictie;
          if (
            fbRestriction?.allowed_at_any_phase ||
            fbRestriction?.allowed_phases?.includes(phase)
          ) {
            return JSON.stringify({
              original_signal: suggestedSignal,
              enforced_signal: fallback,
              was_blocked: true,
              reason: `${suggestedSignal} is niet toegestaan in fase ${phase}. Alleen in fase ${allowedPhases.join(", ")}. Fallback: ${fallback}.`,
            });
          }
        }
        // Ultimate fallback
        return JSON.stringify({
          original_signal: suggestedSignal,
          enforced_signal: "positief",
          was_blocked: true,
          reason: `${suggestedSignal} geblokkeerd, geen fallback gevonden. Default: positief.`,
        });
      }
    }
  }

  // Signal is allowed
  return JSON.stringify({
    original_signal: suggestedSignal,
    enforced_signal: suggestedSignal,
    was_blocked: false,
  });
}

function execGetRecommendedTechniques(input: Record<string, any>): string {
  const customerSignal = input.customer_signal as CustomerSignal;

  if (!ALL_SIGNALS.includes(customerSignal)) {
    return JSON.stringify({
      error: `Ongeldig signaal: ${customerSignal}.`,
    });
  }

  const klantHoudingen = loadKlantHoudingen();
  const houding = klantHoudingen.houdingen?.[customerSignal];

  if (!houding || !houding.recommended_technique_ids) {
    return JSON.stringify({
      customer_signal: customerSignal,
      recommended_techniques: [],
      message: `Geen aanbevolen technieken voor signaal: ${customerSignal}.`,
    });
  }

  const techniques = houding.recommended_technique_ids.map(
    (id: string, index: number) => {
      const tech = getTechnique(id);
      return {
        id,
        naam: tech?.naam || id,
        wat: tech?.wat || undefined,
        hoe: tech?.hoe || undefined,
        priority: index + 1,
      };
    }
  );

  return JSON.stringify({
    customer_signal: customerSignal,
    houding_naam: houding.naam,
    recommended_techniques: techniques,
    scoring: klantHoudingen.expected_moves_scoring,
  });
}

function execEvaluateTechnique(input: Record<string, any>): string {
  const sellerMessage: string = input.seller_message;
  const customerSignal = input.customer_signal as CustomerSignal;
  const techniqueId: string = input.technique_id;
  const detectedTechniqueIds: string[] = input.detected_technique_ids || [];

  // 1. Load technique definition from SSOT
  const technique = getTechnique(techniqueId);
  const techniqueContext: any = technique
    ? {
        id: technique.nummer,
        naam: technique.naam,
        fase: technique.fase,
        wat: technique.wat,
        waarom: technique.waarom,
        hoe: technique.hoe,
        stappenplan: technique.stappenplan,
        voorbeeld: technique.voorbeeld,
      }
    : { error: `Techniek ${techniqueId} niet gevonden in SSOT.` };

  // 2. Get expected moves for this customer signal
  const klantHoudingen = loadKlantHoudingen();
  const houding = klantHoudingen.houdingen?.[customerSignal];
  const recommendedIds: string[] = houding?.recommended_technique_ids || [];
  const expectedMoves = recommendedIds.map((id: string, i: number) => {
    const tech = getTechnique(id);
    return { id, naam: tech?.naam || id, priority: i + 1 };
  });

  // 3. Check if detected techniques match expected moves
  const scoring = klantHoudingen.expected_moves_scoring || {
    recommended_match_bonus: 5,
    no_match_penalty: 0,
  };

  let expectedMoveMatch = false;
  let matchedTechniqueId: string | undefined;
  const idsToCheck =
    detectedTechniqueIds.length > 0
      ? detectedTechniqueIds
      : [techniqueId];

  for (const detectedId of idsToCheck) {
    for (const expected of expectedMoves) {
      if (
        detectedId === expected.id ||
        detectedId.startsWith(expected.id + ".")
      ) {
        expectedMoveMatch = true;
        matchedTechniqueId = detectedId;
        break;
      }
    }
    if (expectedMoveMatch) break;
  }

  // 4. Get scoring rubric
  const rubric = getScoringRubric();

  return JSON.stringify({
    technique: techniqueContext,
    expected_moves: expectedMoves,
    expected_move_match: {
      matches: expectedMoveMatch,
      bonus: expectedMoveMatch ? scoring.recommended_match_bonus : 0,
      matched_technique_id: matchedTechniqueId,
    },
    scoring_rubric: rubric,
    evaluation_instruction:
      "Beoordeel het seller-bericht tegen het stappenplan en de voorbeeldzinnen. " +
      "Geef een kwaliteitslabel: perfect (exact goed), goed (juiste richting), " +
      "bijna (gedeeltelijk correct), of gemist (techniek niet herkend). " +
      "Tel de expected move bonus op bij de basis-score als de techniek matcht.",
  });
}

// ── Exports for agent.ts ────────────────────────────────────────────────────

export const METHODOLOGY_TOOLS = new Set([
  "select_customer_attitude",
  "classify_customer_signal",
  "get_recommended_techniques",
  "evaluate_technique",
]);
