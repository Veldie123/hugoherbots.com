/**
 * LangWatch Scenario Tests -- HugoClawV3 Coaching Mode
 *
 * Tests the coaching agent's ability to:
 * 1. Respond appropriately to different customer attitudes (H1-H9)
 * 2. Use correct SSOT technique names (no paraphrasing)
 * 3. Follow the LSD method (Listen, Summarize, Dig deeper)
 *
 * Prerequisites:
 * - V3 server running locally (npm run dev:local)
 * - SCENARIO_AUTH_TOKEN set (valid Supabase JWT)
 * - ANTHROPIC_API_KEY set (for the judge agent)
 *
 * Run: npm run test:scenarios
 */
import scenario from "@langwatch/scenario";
import { describe, it, expect } from "vitest";
import { createHugoAgent } from "./agent-adapter";

// Base judge criteria shared across all coaching scenarios
const BASE_COACHING_CRITERIA = [
  "Agent antwoordt in het Nederlands",
  "Agent geeft geen directe oplossing zonder eerst de situatie te begrijpen",
  "Agent gedraagt zich als een ervaren sales coach",
];

describe("HugoClawV3 Coaching — Klanthoudingen", () => {
  it("H1: Positieve klant — herkent positieve houding en vraagt door", async () => {
    const result = await scenario.run({
      name: "H1 - Positieve klant",
      description: `Je bent een verkoper die met een enthousiaste klant praat.
        De klant is positief over het product en geeft signalen van interesse.
        Je vraagt de coaching AI om advies over hoe je deze situatie het beste kunt benutten.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent herkent dat de klant positief is",
            "Agent adviseert om door te vragen en de positieve signalen te verdiepen",
            "Agent moedigt de verkoper aan om de klant niet te onderbreken",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });

  it("H5: Klant met bezwaar — adviseert wedervraag-techniek", async () => {
    const result = await scenario.run({
      name: "H5 - Klant met bezwaar",
      description: `Je bent een verkoper die coaching wilt over een klant die prijsbezwaren heeft.
        De klant zegt "Dat is veel te duur" en "Ik kan het budget niet verantwoorden".
        Vraag de coaching AI hoe je hiermee om moet gaan.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent adviseert NIET om meteen korting te geven",
            "Agent adviseert om het bezwaar eerst te valideren en doorvragen te stellen",
            "Agent suggereert een wedervraag-aanpak om het echte bezwaar te achterhalen",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });

  it("H8: Agressieve klant — adviseert de-escalatie", async () => {
    const result = await scenario.run({
      name: "H8 - Agressieve klant",
      description: `Je bent een verkoper die coaching wilt over een boze klant.
        De klant is geirriteerd, verheft zijn stem en dreigt naar de concurrent te gaan.
        Vraag de coaching AI hoe je professioneel kunt reageren.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent adviseert een kalme, professionele aanpak",
            "Agent suggereert om de frustratie van de klant te erkennen",
            "Agent adviseert NIET om te argumenteren of defensief te reageren",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });
});

describe("HugoClawV3 Coaching — SSOT Compliance", () => {
  it("Gebruikt Nederlandse coaching termen en LSD methode", async () => {
    const result = await scenario.run({
      name: "SSOT - Nederlandse termen",
      description: `Je bent een nieuwe verkoper die wilt leren over verkooptechnieken.
        Vraag de coaching AI om de basis uit te leggen van een goed verkoopgesprek.
        Stel doorvragen over welke technieken je kunt gebruiken.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            "Agent antwoordt volledig in het Nederlands",
            "Agent verwijst naar concrete verkooptechnieken met specifieke namen",
            "Agent legt de LSD-methode uit of verwijst ernaar (Luisteren, Samenvatten, Doorvragen)",
            "Agent noemt fases van het verkoopgesprek (EPIC: Entree, Probleemanalyse, Implicatie, Commitment)",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });
});

describe("HugoClawV3 Coaching — Roleplay", () => {
  it("Start een roleplay sessie wanneer gevraagd", async () => {
    const result = await scenario.run({
      name: "Roleplay - Start",
      description: `Je bent een verkoper die wilt oefenen met een moeilijk gesprek.
        Vraag de coaching AI om een rollenspel te doen waar de klant prijsbezwaren heeft.
        Ga mee in het rollenspel wanneer het begint.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent biedt aan om een rollenspel te starten",
            "Agent neemt de rol van een klant aan in het rollenspel",
            "De klant-simulatie voelt realistisch en in karakter",
          ],
        }),
      ],
      maxTurns: 8,
    });
    expect(result.success).toBe(true);
  });
});
