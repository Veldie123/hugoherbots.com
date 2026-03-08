/**
 * Live Analyse — System prompt builder for real-time coaching tips
 *
 * Builds a compact prompt with SSOT techniques + houdingen for Claude
 * to analyze each customer turn and return a coaching tip.
 */

import { getTechniqueName, getAllTechniqueNummers } from "../ssot-loader";
import * as fs from "fs";
import * as path from "path";

/** Build compact SSOT technique list grouped by fase */
export function buildSSOTTechniqueList(): string {
  const nummers = getAllTechniqueNummers();
  const fases: Record<string, string[]> = {};
  for (const nr of nummers) {
    const name = getTechniqueName(nr);
    if (!name) continue;
    const fase = nr.split(".")[0];
    if (!fases[fase]) fases[fase] = [];
    const depth = nr.split(".").length;
    if (depth <= 3) {
      fases[fase].push(`${nr}: ${name}`);
    }
  }
  const faseLabels: Record<string, string> = {
    "0": "Fase 0 (Voorbereiding)",
    "1": "Fase 1 (Opening)",
    "2": "Fase 2 (Ontdekking/EPIC)",
    "3": "Fase 3 (Aanbeveling)",
    "4": "Fase 4 (Beslissing)",
  };
  return Object.entries(fases)
    .map(([fase, techniques]) => `- ${faseLabels[fase] || `Fase ${fase}`}: ${techniques.join(", ")}`)
    .join("\n");
}

/** Build compact houding list with IDs */
function buildHoudingList(): string {
  const houdPath = path.join(process.cwd(), "config/klant_houdingen.json");
  const data = JSON.parse(fs.readFileSync(houdPath, "utf-8"));
  const entries: string[] = [];
  for (const [, houding] of Object.entries(data.houdingen) as [string, any][]) {
    const markers = houding.semantic_markers?.slice(0, 5).join(", ") || "";
    entries.push(`${houding.id} "${houding.naam}": ${markers}`);
  }
  return entries.join("\n");
}

/** Build the system prompt for live analyse Claude calls */
export function buildLiveAnalyseSystemPrompt(currentPhase: number): string {
  const techniqueList = buildSSOTTechniqueList();
  const houdingList = buildHoudingList();

  return `Je bent een real-time sales coach die meeluistert met een verkoopgesprek. Je analyseert de LAATSTE klantbeurt en geeft EEN korte coachingtip.

EPIC Technieken (gebruik ALTIJD deze exacte namen):
${techniqueList}

Klanthoudingen (H1-H9):
${houdingList}

Huidige gespreksfase: ${currentPhase}

INSTRUCTIES:
1. Detecteer de klanthouding (H1-H9) op basis van de laatste klantbeurt
2. Identificeer welke techniek de verkoper gebruikte (als dat zichtbaar is)
3. Retourneer JSON met je analyse

BELANGRIJK — SSOT terminologie:
- Gebruik ALTIJD de exacte techniek-namen uit bovenstaande lijst (bijv. "Meningvragen" niet "doorvragen", "Probe" niet "concretiseren")
- Gebruik ALTIJD de exacte houding-namen (bijv. "Schijninstemming" niet "vaag antwoord")
- Verwijs naar technieken met hun nummer (bijv. "2.1.2")

Retourneer ALLEEN valid JSON:
{
  "houding_id": "H1-H9",
  "houding_naam": "exacte naam uit SSOT",
  "detected_technique": "nummer of null",
  "phase": ${currentPhase},
  "new_phase": null
}

Als de gespreksfase verandert (bijv. van ontdekking naar aanbeveling), zet "new_phase" naar het nieuwe fasenummer.
Houd "new_phase" null als de fase niet verandert.`;
}
