/**
 * Simplified Coach Engine - Standalone version without complex dependencies
 * Uses OpenAI via Replit AI Integrations
 */

import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface TechniqueInfo {
  nummer: string;
  naam: string;
  fase: string;
  doel?: string;
  wat?: string;
  waarom?: string;
  wanneer?: string;
  hoe?: string;
  stappenplan?: string[];
}

interface CoachMessageParams {
  sessionId: string;
  techniqueId: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  contextData: any;
  isExpert: boolean;
}

interface CoachResult {
  response: string;
  signal: "positief" | "neutraal" | "negatief";
  detectedTechniques: string[];
  evaluation: string;
}

let techniquesCache: any = null;

function loadTechniquesIndex(): any {
  if (techniquesCache) return techniquesCache;
  try {
    const configPath = path.join(process.cwd(), "config", "ssot", "technieken_index.json");
    const data = fs.readFileSync(configPath, "utf-8");
    techniquesCache = JSON.parse(data);
    return techniquesCache;
  } catch (error) {
    console.warn("[coach-engine-simple] Could not load technieken_index.json:", error);
    return { technieken: {} };
  }
}

function findTechnique(techniqueId: string): TechniqueInfo {
  const index = loadTechniquesIndex();
  const technieken = index.technieken || {};
  
  if (technieken[techniqueId]) {
    return technieken[techniqueId];
  }
  
  return {
    nummer: techniqueId,
    naam: "Onbekende techniek",
    fase: "0",
    doel: "",
    wat: "",
    waarom: "",
    wanneer: "",
    hoe: ""
  };
}

function detectSignal(message: string): "positief" | "neutraal" | "negatief" {
  const positive = ["ja", "zeker", "goed", "mooi", "interessant", "graag", "prima", "top", "uitstekend"];
  const negative = ["nee", "niet", "moeilijk", "lastig", "probleem", "maar", "echter", "helaas"];
  
  const lower = message.toLowerCase();
  
  const positiveCount = positive.filter(w => lower.includes(w)).length;
  const negativeCount = negative.filter(w => lower.includes(w)).length;
  
  if (positiveCount > negativeCount) return "positief";
  if (negativeCount > positiveCount) return "negatief";
  return "neutraal";
}

export async function processCoachMessage(params: CoachMessageParams): Promise<CoachResult> {
  const { techniqueId, conversationHistory, contextData, isExpert } = params;
  
  const technique = findTechnique(techniqueId);
  
  const systemPrompt = `Je bent Hugo, een warme en ervaren sales coach met 40 jaar ervaring. Je helpt verkopers de techniek "${technique.naam}" te oefenen.

=== TECHNIEK INFO ===
Techniek: ${technique.nummer} - ${technique.naam}
Fase: ${technique.fase}
Doel: ${technique.doel || "Niet beschikbaar"}
Wat: ${technique.wat || "Niet beschikbaar"}
Waarom: ${technique.waarom || "Niet beschikbaar"}
Wanneer: ${technique.wanneer || "Niet beschikbaar"}
Hoe: ${technique.hoe || "Niet beschikbaar"}

=== CONTEXT VAN DE VERKOPER ===
${JSON.stringify(contextData, null, 2)}

=== COACHING RICHTLIJNEN ===
- Gebruik de LSD-methode: Luisteren, Samenvatten, Doorvragen
- Stel ÉÉN vraag per beurt om het gesprek gefocust te houden
- Geef concrete, praktische feedback gebaseerd op de techniek
- Wees bemoedigend maar eerlijk - vier successen, benoem verbeterpunten
- Gebruik voorbeelden uit de praktijk van de verkoper
- Spreek de verkoper aan met "je" (informeel maar professioneel)
- Houd je antwoorden beknopt (max 3-4 zinnen) tenzij uitleg nodig is

=== TAAL ===
Antwoord altijd in het Nederlands.`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }))
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_completion_tokens: 500,
      temperature: 0.7
    });

    const response = completion.choices[0].message.content || "Ik begrijp je. Vertel me meer.";
    const signal = detectSignal(params.userMessage);

    return {
      response,
      signal,
      detectedTechniques: [techniqueId],
      evaluation: signal === "positief" ? "goed" : signal === "negatief" ? "aandachtspunt" : "neutraal"
    };
  } catch (error) {
    console.error("[coach-engine-simple] OpenAI error:", error);
    return {
      response: "Er ging iets mis met de AI. Probeer het opnieuw.",
      signal: "neutraal",
      detectedTechniques: [],
      evaluation: "error"
    };
  }
}

export async function buildOpeningMessage(techniqueId: string): Promise<string> {
  const technique = findTechnique(techniqueId);
  
  const systemPrompt = `Je bent Hugo, een warme sales coach. Genereer een korte, vriendelijke openingsboodschap voor een coachingsessie over techniek "${technique.naam}".

De boodschap moet:
- De verkoper welkom heten
- Kort uitleggen wat jullie gaan oefenen
- Eindigen met een open vraag om context te verzamelen

Houd het kort (2-3 zinnen). Spreek in het Nederlands.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Start het gesprek." }
      ],
      max_completion_tokens: 200,
      temperature: 0.8
    });

    return completion.choices[0].message.content || 
      `Welkom! Vandaag gaan we werken aan "${technique.naam}". Vertel me eerst iets over je situatie - wat voor product of dienst verkoop je?`;
  } catch (error) {
    console.error("[coach-engine-simple] OpenAI error in opening:", error);
    return `Welkom! Vandaag gaan we werken aan "${technique.naam}". Vertel me eerst iets over je situatie - wat voor product of dienst verkoop je?`;
  }
}
