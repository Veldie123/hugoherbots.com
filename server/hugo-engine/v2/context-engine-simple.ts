/**
 * Simplified Context Engine - Gathers context before coaching
 * Uses OpenAI via Replit AI Integrations
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ContextData {
  sector?: string;
  product?: string;
  klant_type?: string;
  verkoopkanaal?: string;
  ervaring?: string;
  [key: string]: string | undefined;
}

const REQUIRED_FIELDS = ["sector", "product"];
const OPTIONAL_FIELDS = ["klant_type", "verkoopkanaal", "ervaring"];

interface ContextResult {
  response: string;
  updatedContext: ContextData;
  isComplete: boolean;
}

export function isContextComplete(context: ContextData): boolean {
  return REQUIRED_FIELDS.every(field => context[field] && context[field]!.trim() !== "");
}

function extractContextFromMessage(message: string, currentContext: ContextData): ContextData {
  const context: ContextData = { ...currentContext };
  const lower = message.toLowerCase();

  // Extract sector
  if (!context.sector) {
    if (lower.includes("it") || lower.includes("software") || lower.includes("tech") || lower.includes("saas")) {
      context.sector = "IT/Software";
    } else if (lower.includes("financ") || lower.includes("bank") || lower.includes("verzeker")) {
      context.sector = "Financiële diensten";
    } else if (lower.includes("retail") || lower.includes("winkel")) {
      context.sector = "Retail";
    } else if (lower.includes("zorg") || lower.includes("medisch") || lower.includes("gezondheid")) {
      context.sector = "Gezondheidszorg";
    } else if (lower.includes("bouw") || lower.includes("construct")) {
      context.sector = "Bouw";
    } else if (lower.includes("industri") || lower.includes("productie") || lower.includes("manufactur")) {
      context.sector = "Industrie/Productie";
    }
  }

  // Extract product - look for "verkoop" patterns and common product types
  if (!context.product) {
    // Pattern: "verkoop X" or "verkopen X"
    const verkoopMatch = message.match(/verkoop(?:en?)?\s+(.+?)(?:\s+aan|\s+voor|\s+bij|\.|,|$)/i);
    if (verkoopMatch) {
      context.product = verkoopMatch[1].trim();
    }
    // Pattern: specific product keywords
    else if (lower.includes("crm")) {
      context.product = "CRM software";
    } else if (lower.includes("erp")) {
      context.product = "ERP software";
    } else if (lower.includes("saas")) {
      context.product = "SaaS oplossingen";
    } else if (lower.includes("software")) {
      context.product = "Software";
    } else if (lower.includes("verzekering")) {
      context.product = "Verzekeringen";
    } else if (lower.includes("hypothe")) {
      context.product = "Hypotheken";
    } else if (lower.includes("lening") || lower.includes("krediet")) {
      context.product = "Leningen/Krediet";
    } else if (lower.includes("training") || lower.includes("cursus") || lower.includes("opleiding")) {
      context.product = "Training/Opleidingen";
    } else if (lower.includes("consult") || lower.includes("advies")) {
      context.product = "Consultancy/Advies";
    } else if (lower.includes("dienst") || lower.includes("service")) {
      context.product = "Dienstverlening";
    } else if (lower.includes("machine") || lower.includes("apparaat") || lower.includes("equipment")) {
      context.product = "Machines/Apparatuur";
    } else if (lower.includes("hardware")) {
      context.product = "Hardware";
    }
  }

  // Extract klant_type
  if (!context.klant_type) {
    if (lower.includes("b2b") || lower.includes("bedrijven") || lower.includes("zakelijk") || lower.includes("aan bedrijven")) {
      context.klant_type = "B2B";
    } else if (lower.includes("b2c") || lower.includes("consumenten") || lower.includes("particulier")) {
      context.klant_type = "B2C";
    }
  }

  // Extract verkoopkanaal
  if (!context.verkoopkanaal) {
    if (lower.includes("telefon") || lower.includes("bellen")) {
      context.verkoopkanaal = "Telefonisch";
    } else if (lower.includes("fysiek") || lower.includes("face-to-face") || lower.includes("bezoek")) {
      context.verkoopkanaal = "Face-to-face";
    } else if (lower.includes("online") || lower.includes("video") || lower.includes("teams") || lower.includes("zoom")) {
      context.verkoopkanaal = "Online/Remote";
    }
  }

  return context;
}

export async function processContextGathering(
  conversationHistory: Array<{ role: string; content: string }>,
  currentContext: ContextData
): Promise<ContextResult> {
  
  const lastUserMessage = conversationHistory
    .filter(m => m.role === "user")
    .pop()?.content || "";

  const updatedContext = extractContextFromMessage(lastUserMessage, currentContext);

  const missingRequired = REQUIRED_FIELDS.filter(f => !updatedContext[f]);
  const missingOptional = OPTIONAL_FIELDS.filter(f => !updatedContext[f]);
  
  const isComplete = missingRequired.length === 0;

  if (isComplete && missingOptional.length === 0) {
    return {
      response: `Bedankt voor de context! Ik begrijp dat je in de ${updatedContext.sector} sector werkt en ${updatedContext.product} verkoopt. Laten we beginnen met de oefening!`,
      updatedContext,
      isComplete: true
    };
  }

  const systemPrompt = `Je bent Hugo, een warme sales coach. Je verzamelt context voordat je begint met coachen.

Je moet weten:
- Sector: In welke branche werkt de verkoper? ${updatedContext.sector ? `✅ (${updatedContext.sector})` : "❌ (onbekend)"}
- Product: Wat verkoopt de verkoper? ${updatedContext.product ? `✅ (${updatedContext.product})` : "❌ (onbekend)"}
- Klant type: B2B of B2C? ${updatedContext.klant_type ? `✅ (${updatedContext.klant_type})` : "(optioneel)"}
- Verkoopkanaal: Hoe verkoopt de verkoper? ${updatedContext.verkoopkanaal ? `✅ (${updatedContext.verkoopkanaal})` : "(optioneel)"}

${missingRequired.length > 0 ? `NOG TE VERZAMELEN: ${missingRequired.join(", ")}` : "Alle vereiste info is verzameld!"}

Stel ÉÉN natuurlijke vraag om ontbrekende informatie te verzamelen. Als alles compleet is, zeg dat je klaar bent om te beginnen.
Spreek in het Nederlands, wees warm en vriendelijk.`;

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
      max_completion_tokens: 200,
      temperature: 0.7
    });

    const response = completion.choices[0].message.content || 
      "Vertel me meer over wat je verkoopt en in welke sector je werkt.";

    return {
      response,
      updatedContext,
      isComplete
    };
  } catch (error) {
    console.error("[context-engine-simple] OpenAI error:", error);
    
    if (missingRequired.includes("sector")) {
      return {
        response: "In welke sector of branche werk je?",
        updatedContext,
        isComplete: false
      };
    }
    if (missingRequired.includes("product")) {
      return {
        response: "Wat voor product of dienst verkoop je?",
        updatedContext,
        isComplete: false
      };
    }
    
    return {
      response: "Vertel me meer over je situatie.",
      updatedContext,
      isComplete
    };
  }
}
