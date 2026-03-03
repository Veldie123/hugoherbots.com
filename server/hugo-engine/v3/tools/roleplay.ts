/**
 * V3 Roleplay Tools
 *
 * Manages roleplay state and deterministic progression.
 * The agent (Claude) PLAYS the customer — these tools ensure
 * the EPIC methodology and customer dynamics are correctly tracked.
 *
 * Flow per turn:
 * 1. Agent receives seller message
 * 2. Agent analyzes it (detects techniques, assesses quality)
 * 3. Agent calls process_roleplay_turn with detected techniques + quality
 * 4. Tool does: advance EPIC → update dynamics → select houding
 * 5. Agent plays the customer using the returned houding instruction
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import {
  selectHoudingForTurn,
  buildHoudingSection,
  initializeCustomerDynamics,
  updateCustomerDynamics,
  type SelectedHouding,
  type ResolvedPersona,
  type CustomerDynamics,
} from "../../houding-selector";
import { getTechnique, getScoringRubric } from "../../ssot-loader";
import { saveMemory } from "../memory-service";
import type { V3SessionState } from "../agent";

// ── Roleplay State ──────────────────────────────────────────────────────────

export type EpicPhase = "explore" | "probe" | "impact" | "commit";
type EvalQuality = "perfect" | "goed" | "bijna" | "gemist";

export interface RoleplayState {
  active: boolean;
  techniqueId: string;
  persona: ResolvedPersona;
  dynamics: CustomerDynamics;
  epicPhase: EpicPhase;
  epicPhaseNumeric: number; // 1-4 for houding-selector
  epicMilestones: {
    probeUsed: boolean;
    impactAsked: boolean;
    commitReady: boolean;
  };
  turnNumber: number;
  totalScore: number;
  detectedTechniques: string[]; // All techniques detected across turns
  lastHoudingKey: string | null;
}

// ── Config Loaders ──────────────────────────────────────────────────────────

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

// ── EPIC Phase Logic ────────────────────────────────────────────────────────

function techniqueMatches(detectedId: string, targetId: string): boolean {
  return detectedId === targetId || detectedId.startsWith(targetId + ".");
}

function advanceEpicPhase(
  state: RoleplayState,
  detectedTechniqueIds: string[]
): { advanced: boolean; newPhase: EpicPhase; reason?: string } {
  const oldPhase = state.epicPhase;

  for (const techId of detectedTechniqueIds) {
    // Check for Probe (2.2) — advances explore → probe
    if (
      techniqueMatches(techId, "2.2") &&
      state.epicPhase === "explore"
    ) {
      state.epicPhase = "probe";
      state.epicPhaseNumeric = 2;
      state.epicMilestones.probeUsed = true;
      return {
        advanced: true,
        newPhase: "probe",
        reason: `Seller gebruikt ${techId} (Probe/storytelling) → fase verschuift naar Probe.`,
      };
    }

    // Check for Impact (2.3) — advances explore/probe → impact
    if (
      techniqueMatches(techId, "2.3") &&
      (state.epicPhase === "explore" || state.epicPhase === "probe")
    ) {
      state.epicPhase = "impact";
      state.epicPhaseNumeric = 3;
      state.epicMilestones.impactAsked = true;
      state.epicMilestones.commitReady = true;
      return {
        advanced: true,
        newPhase: "impact",
        reason: `Seller gebruikt ${techId} (Impact-vraag) → fase verschuift naar Impact.`,
      };
    }

    // Check for Commit (2.4, 3.x, 4.x) — advances impact → commit
    if (
      (techniqueMatches(techId, "2.4") ||
        techniqueMatches(techId, "3") ||
        techniqueMatches(techId, "4")) &&
      state.epicPhase === "impact"
    ) {
      state.epicPhase = "commit";
      state.epicPhaseNumeric = 4;
      return {
        advanced: true,
        newPhase: "commit",
        reason: `Seller gebruikt ${techId} (Commitment) → fase verschuift naar Commit.`,
      };
    }
  }

  return { advanced: false, newPhase: oldPhase };
}

// ── Persona Generator ───────────────────────────────────────────────────────

function generateRandomPersona(): ResolvedPersona {
  const templates = loadPersonaTemplates();

  const randomChoice = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

  const behaviorStyles = Object.keys(templates.behavior_styles || {});
  const buyingClockStages = (templates.buying_clock?.stages || []).map(
    (s: any) => s.id
  );
  const experienceLevels = Object.keys(templates.experience_levels || {});
  const difficultyLevels = Object.keys(templates.difficulty_levels || {});

  const defaults = templates.defaults || {};

  return {
    behavior_style:
      randomChoice(behaviorStyles) || defaults.behavior_style || "analyserend",
    buying_clock_stage:
      randomChoice(buyingClockStages) ||
      defaults.buying_clock_stage ||
      "market_research",
    experience_level:
      randomChoice(experienceLevels) ||
      defaults.experience_level ||
      "enige_ervaring",
    difficulty_level:
      randomChoice(difficultyLevels) ||
      defaults.difficulty_level ||
      "bewuste_kunde",
  };
}

// ── Expected Moves ──────────────────────────────────────────────────────────

function getExpectedMoves(customerSignal: string): Array<{ id: string; naam: string }> {
  const klantHoudingen = loadKlantHoudingen();
  const houding = klantHoudingen.houdingen?.[customerSignal];
  if (!houding?.recommended_technique_ids) return [];

  return houding.recommended_technique_ids.map((id: string) => {
    const tech = getTechnique(id);
    return { id, naam: tech?.naam || id };
  });
}

function checkExpectedMoveMatch(
  detectedIds: string[],
  expectedMoves: Array<{ id: string }>
): { matches: boolean; matchedId?: string } {
  for (const detectedId of detectedIds) {
    for (const expected of expectedMoves) {
      if (
        detectedId === expected.id ||
        detectedId.startsWith(expected.id + ".")
      ) {
        return { matches: true, matchedId: detectedId };
      }
    }
  }
  return { matches: false };
}

// ── Tool Definitions ────────────────────────────────────────────────────────

export const roleplayToolDefinitions: Anthropic.Tool[] = [
  {
    name: "start_roleplay",
    description:
      "Start een nieuw rollenspel. Initialiseert een klantpersona, customer dynamics, en EPIC fase. Retourneert de persona-beschrijving en eerste klanthouding. De seller oefent vervolgens door met jou (de klant) te praten.",
    input_schema: {
      type: "object" as const,
      properties: {
        technique_id: {
          type: "string",
          description:
            "Optioneel: techniek-ID waarop geoefend wordt (bv. '2.1.3'). Bepaalt startfase.",
        },
        persona: {
          type: "object",
          description:
            "Optioneel: specifieke persona parameters. Laat leeg voor random persona.",
          properties: {
            behavior_style: {
              type: "string",
              description: "analyserend, controlerend, faciliterend, of promoverend.",
            },
            buying_clock_stage: { type: "string" },
            experience_level: { type: "string" },
            difficulty_level: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "process_roleplay_turn",
    description:
      "VERPLICHT na elk seller-bericht tijdens roleplay. Verwerkt de seller's boodschap: werkt EPIC fase bij, update customer dynamics, selecteert de volgende klanthouding. Jij (Hugo) speelt vervolgens de klant met de geretourneerde houding. Geef ALTIJD je analyse mee van welke technieken de seller gebruikte.",
    input_schema: {
      type: "object" as const,
      properties: {
        detected_technique_ids: {
          type: "array",
          items: { type: "string" },
          description:
            "Techniek-IDs die je herkent in het seller-bericht (bv. ['2.1.3', '2.1.6']). Gebruik search_methodology als je twijfelt.",
        },
        quality: {
          type: "string",
          enum: ["perfect", "goed", "bijna", "gemist"],
          description:
            "Jouw beoordeling van hoe goed de seller de techniek toepaste.",
        },
        detected_thema: {
          type: "string",
          description:
            "Optioneel: gedetecteerd thema (Bron, Motivatie, Ervaring, Verwachtingen, Alternatieven, Budget, Timing, Beslissingscriteria).",
        },
      },
      required: ["detected_technique_ids", "quality"],
    },
  },
  {
    name: "end_roleplay",
    description:
      "Beëindig het rollenspel en krijg debrief-context terug. Bevat score-overzicht, gedetecteerde technieken, EPIC progressie, en verbeterpunten. Gebruik dit om coaching feedback te geven.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ── Tool Execution ──────────────────────────────────────────────────────────

export async function executeRoleplayTool(
  name: string,
  input: Record<string, any>,
  session: V3SessionState
): Promise<string> {
  switch (name) {
    case "start_roleplay":
      return execStartRoleplay(input, session);
    case "process_roleplay_turn":
      return execProcessRoleplayTurn(input, session);
    case "end_roleplay":
      return execEndRoleplay(session);
    default:
      return JSON.stringify({ error: `Unknown roleplay tool: ${name}` });
  }
}

// ── Tool Implementations ────────────────────────────────────────────────────

function execStartRoleplay(
  input: Record<string, any>,
  session: V3SessionState
): string {
  const personaTemplates = loadPersonaTemplates();
  const klantHoudingen = loadKlantHoudingen();

  // Build persona
  const personaInput = input.persona;
  const persona: ResolvedPersona = personaInput
    ? {
        behavior_style:
          personaInput.behavior_style || personaTemplates.defaults?.behavior_style,
        buying_clock_stage:
          personaInput.buying_clock_stage || personaTemplates.defaults?.buying_clock_stage,
        experience_level:
          personaInput.experience_level || personaTemplates.defaults?.experience_level,
        difficulty_level:
          personaInput.difficulty_level || personaTemplates.defaults?.difficulty_level,
      }
    : generateRandomPersona();

  // Initialize customer dynamics
  const dynamics = initializeCustomerDynamics(persona, personaTemplates);

  // Determine start phase based on technique
  const techniqueId = input.technique_id || "2.1";
  let startPhase: EpicPhase = "explore";
  let startPhaseNumeric = 2;
  if (techniqueId.startsWith("3")) {
    startPhase = "impact";
    startPhaseNumeric = 3;
  } else if (techniqueId.startsWith("4")) {
    startPhase = "commit";
    startPhaseNumeric = 4;
  }

  // Create roleplay state
  const roleplayState: RoleplayState = {
    active: true,
    techniqueId,
    persona,
    dynamics,
    epicPhase: startPhase,
    epicPhaseNumeric: startPhaseNumeric,
    epicMilestones: {
      probeUsed: false,
      impactAsked: false,
      commitReady: false,
    },
    turnNumber: 0,
    totalScore: 0,
    detectedTechniques: [],
    lastHoudingKey: null,
  };

  session.roleplay = roleplayState;

  // Select first houding for the opening
  const firstHouding = selectHoudingForTurn(
    persona,
    personaTemplates,
    klantHoudingen,
    startPhaseNumeric,
    dynamics,
    []
  );
  roleplayState.lastHoudingKey = firstHouding.key;

  const houdingSection = buildHoudingSection(firstHouding);

  // Build persona description for the agent
  const behaviorDesc =
    personaTemplates.behavior_styles?.[persona.behavior_style];
  const clockStage = (personaTemplates.buying_clock?.stages || []).find(
    (s: any) => s.id === persona.buying_clock_stage
  );

  return JSON.stringify({
    status: "roleplay_started",
    technique_id: techniqueId,
    epic_phase: startPhase,
    persona: {
      behavior_style: persona.behavior_style,
      behavior_description: behaviorDesc?.beschrijving || persona.behavior_style,
      buying_clock_stage: persona.buying_clock_stage,
      buying_clock_description: clockStage?.beschrijving || persona.buying_clock_stage,
      experience_level: persona.experience_level,
      difficulty_level: persona.difficulty_level,
    },
    dynamics: {
      rapport: dynamics.rapport.toFixed(2),
      valueTension: dynamics.valueTension.toFixed(2),
      commitReadiness: dynamics.commitReadiness.toFixed(2),
    },
    first_houding: {
      key: firstHouding.key,
      naam: firstHouding.naam,
      beschrijving: firstHouding.beschrijving,
      signalen: firstHouding.signalen,
    },
    houding_instruction: houdingSection,
    instruction:
      "Je bent nu de KLANT. Speel deze persona consistent. " +
      "Gebruik de houding-instructie hierboven voor je eerste reactie. " +
      "Na elk bericht van de seller, roep process_roleplay_turn aan " +
      "met je analyse van de gebruikte technieken en kwaliteit.",
  });
}

function execProcessRoleplayTurn(
  input: Record<string, any>,
  session: V3SessionState
): string {
  const roleplay = session.roleplay;
  if (!roleplay?.active) {
    return JSON.stringify({
      error: "Geen actief rollenspel. Gebruik start_roleplay eerst.",
    });
  }

  const personaTemplates = loadPersonaTemplates();
  const klantHoudingen = loadKlantHoudingen();

  const detectedTechniqueIds: string[] = input.detected_technique_ids || [];
  const quality: EvalQuality = input.quality || "gemist";
  const detectedThema: string | undefined = input.detected_thema;

  // Track detected techniques
  roleplay.detectedTechniques.push(...detectedTechniqueIds);

  // 1. Calculate score for this turn
  const rubric = getScoringRubric();
  const baseScore = rubric[quality]?.score ?? 0;

  // Check expected moves bonus
  const previousSignal = roleplay.lastHoudingKey || "positief";
  const expectedMoves = getExpectedMoves(previousSignal);
  const { matches, matchedId } = checkExpectedMoveMatch(
    detectedTechniqueIds,
    expectedMoves
  );
  const moveBonus = matches
    ? klantHoudingen.expected_moves_scoring?.recommended_match_bonus || 5
    : 0;
  const turnScore = baseScore + moveBonus;
  roleplay.totalScore += turnScore;
  roleplay.turnNumber++;

  // 2. Advance EPIC phase
  const epicResult = advanceEpicPhase(roleplay, detectedTechniqueIds);

  // 3. Update customer dynamics
  const epicPhaseForDynamics = roleplay.epicPhase;
  roleplay.dynamics = updateCustomerDynamics(
    roleplay.dynamics,
    quality,
    epicPhaseForDynamics,
    detectedThema
  );

  // 4. Select next houding
  const nextHouding = selectHoudingForTurn(
    roleplay.persona,
    personaTemplates,
    klantHoudingen,
    roleplay.epicPhaseNumeric,
    roleplay.dynamics,
    roleplay.detectedTechniques
  );
  roleplay.lastHoudingKey = nextHouding.key;

  const houdingSection = buildHoudingSection(nextHouding);

  // 5. Get recommended techniques for the next houding
  const nextExpectedMoves = getExpectedMoves(nextHouding.key);

  // 6. Build dynamics summary
  const dynamicsInstructions: string[] = [];
  const d = roleplay.dynamics;
  if (d.rapport < 0.35) dynamicsInstructions.push("Reageer kort en gereserveerd.");
  else if (d.rapport > 0.65) dynamicsInstructions.push("Reageer warmer en vollediger.");
  if (d.valueTension < 0.30)
    dynamicsInstructions.push("Je bent tevreden. Geen urgentie.");
  else if (d.valueTension > 0.60)
    dynamicsInstructions.push("Je voelt spanning en urgentie.");
  if (d.commitReadiness < 0.40) dynamicsInstructions.push("Nog niet klaar om te beslissen.");
  else if (d.commitReadiness > 0.70)
    dynamicsInstructions.push("Je denkt na over beslissing en criteria.");

  return JSON.stringify({
    turn_number: roleplay.turnNumber,

    // Evaluation
    evaluation: {
      quality,
      base_score: baseScore,
      expected_move_match: matches,
      expected_move_bonus: moveBonus,
      matched_technique: matchedId,
      turn_score: turnScore,
      total_score: roleplay.totalScore,
    },

    // EPIC progression
    epic: {
      phase: roleplay.epicPhase,
      phase_numeric: roleplay.epicPhaseNumeric,
      advanced: epicResult.advanced,
      advancement_reason: epicResult.reason,
      milestones: roleplay.epicMilestones,
    },

    // Customer dynamics
    dynamics: {
      rapport: +d.rapport.toFixed(2),
      valueTension: +d.valueTension.toFixed(2),
      commitReadiness: +d.commitReadiness.toFixed(2),
      instructions: dynamicsInstructions,
    },

    // Next houding
    next_houding: {
      key: nextHouding.key,
      naam: nextHouding.naam,
      beschrijving: nextHouding.beschrijving,
      signalen: nextHouding.signalen,
    },
    houding_instruction: houdingSection,
    expected_techniques: nextExpectedMoves,

    // Agent instruction
    instruction:
      "Speel de klant met de houding hierboven. " +
      "Gebruik de signalen en dynamics-instructies voor je toon. " +
      "Geef GEEN tips of feedback aan de seller — je bent de klant!",
  });
}

async function execEndRoleplay(session: V3SessionState): Promise<string> {
  const roleplay = session.roleplay;
  if (!roleplay?.active) {
    return JSON.stringify({
      error: "Geen actief rollenspel om te beëindigen.",
    });
  }

  roleplay.active = false;

  // Build technique detection summary
  const techniqueCounts: Record<string, number> = {};
  for (const techId of roleplay.detectedTechniques) {
    techniqueCounts[techId] = (techniqueCounts[techId] || 0) + 1;
  }
  const techniquesSummary = Object.entries(techniqueCounts).map(
    ([id, count]) => {
      const tech = getTechnique(id);
      return { id, naam: tech?.naam || id, count };
    }
  );

  // Calculate averages
  const avgScore =
    roleplay.turnNumber > 0
      ? +(roleplay.totalScore / roleplay.turnNumber).toFixed(1)
      : 0;

  // Identify which EPIC phases were reached
  const phasesReached: string[] = ["explore"];
  if (roleplay.epicMilestones.probeUsed) phasesReached.push("probe");
  if (roleplay.epicMilestones.impactAsked) phasesReached.push("impact");
  if (roleplay.epicPhase === "commit") phasesReached.push("commit");

  // ── Auto-save session summary to episodic memory ──────────────────────────
  const techNames = techniquesSummary.map((t) => t.naam).join(", ");
  const summaryContent =
    `Rollenspel sessie: techniek ${roleplay.techniqueId}, ` +
    `${roleplay.turnNumber} beurten, gemiddelde score ${avgScore}/10. ` +
    `EPIC progressie: ${phasesReached.join(" → ")}. ` +
    `Gebruikte technieken: ${techNames || "geen gedetecteerd"}. ` +
    `Klanttype: ${roleplay.persona.behavior_style}, ` +
    `moeilijkheidsgraad: ${roleplay.persona.difficulty_level}.`;

  try {
    await saveMemory({
      userId: session.userId,
      content: summaryContent,
      memoryType: "session_summary",
      source: "autonomous",
      techniqueId: roleplay.techniqueId,
      sessionId: session.sessionId,
    });
    console.log("[V3 Roleplay] Session summary saved to memory.");
  } catch (err) {
    console.warn("[V3 Roleplay] Failed to save session summary:", err);
  }

  return JSON.stringify({
    status: "roleplay_ended",

    summary: {
      turns: roleplay.turnNumber,
      total_score: roleplay.totalScore,
      average_score: avgScore,
      technique_id: roleplay.techniqueId,
    },

    epic_progression: {
      final_phase: roleplay.epicPhase,
      phases_reached: phasesReached,
      milestones: roleplay.epicMilestones,
    },

    final_dynamics: {
      rapport: +roleplay.dynamics.rapport.toFixed(2),
      valueTension: +roleplay.dynamics.valueTension.toFixed(2),
      commitReadiness: +roleplay.dynamics.commitReadiness.toFixed(2),
    },

    techniques_used: techniquesSummary,

    persona: {
      behavior_style: roleplay.persona.behavior_style,
      buying_clock_stage: roleplay.persona.buying_clock_stage,
      experience_level: roleplay.persona.experience_level,
      difficulty_level: roleplay.persona.difficulty_level,
    },

    debrief_instruction:
      "Geef nu coaching feedback als Hugo. Bespreek: " +
      "(1) Welke technieken de seller goed toepaste, " +
      "(2) Waar de seller kan verbeteren, " +
      "(3) Hoe de EPIC progressie verliep, " +
      "(4) Concrete tips voor de volgende keer. " +
      "Wees positief maar eerlijk — LSD (Luisteren, Samenvatten, Doorvragen). " +
      "BELANGRIJK: Sla daarna je belangrijkste observaties op met save_insight. " +
      "Sla op: (a) waar de seller mee worstelt (type: struggle), " +
      "(b) wat de seller goed doet (type: insight), " +
      "(c) eventuele doelen die de seller noemde (type: goal).",
  });
}

// ── Exports ─────────────────────────────────────────────────────────────────

export const ROLEPLAY_TOOLS = new Set([
  "start_roleplay",
  "process_roleplay_turn",
  "end_roleplay",
]);
