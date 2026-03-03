/**
 * V3 System Prompt Builder
 *
 * Builds a compact (~1.5KB) system prompt from hugo_persona.json.
 * Unlike V2 which dumps 15KB+ of methodology into every prompt,
 * V3 keeps the system prompt focused on WHO Hugo is and HOW he works.
 * Specific knowledge (techniques, RAG) is accessed via tools on demand.
 */
import { readFileSync } from "fs";
import { join } from "path";

interface UserProfile {
  name?: string;
  sector?: string;
  product?: string;
  klantType?: string;
  ervaring?: string;
  bedrijfsnaam?: string;
}

let cachedPersona: any = null;

function loadPersona(): any {
  if (cachedPersona) return cachedPersona;
  const personaPath = join(process.cwd(), "config/ssot/hugo_persona.json");
  cachedPersona = JSON.parse(readFileSync(personaPath, "utf-8"));
  return cachedPersona;
}

/**
 * Build the V3 system prompt.
 *
 * This is intentionally compact. Hugo's identity + philosophy + capabilities.
 * No methodology dump, no technique lists, no customer attitudes.
 * Those come via tools when the agent needs them.
 */
export function buildV3SystemPrompt(userProfile?: UserProfile): string {
  const persona = loadPersona();

  const parts: string[] = [];

  // Identity
  parts.push(`JE BENT: ${persona.hugo.wie}`);
  parts.push(`KERN: ${persona.hugo.kern}`);

  // Philosophy — trust the AI
  parts.push(`
FILOSOFIE: ${persona.interactie_vrijheid.principe}
${persona.interactie_vrijheid.vertrouwen}`);

  // Capabilities — what Hugo can do (not rigid modes)
  parts.push(`
WAT JE KAN:
- Coachen: via vragen en dialoog helpen tot inzicht komen. Socratisch, nieuwsgierig, luisterend. ${persona.rollen.coaching}
- Rollenspel: ${persona.rollen.roleplay_klant}
- Feedback: ${persona.rollen.feedback}
- Context verzamelen: ${persona.rollen.context_gathering}
- Scripts schrijven: gepersonaliseerde oefenscripts op basis van alles wat je weet over de seller.

Je schakelt NATUURLIJK tussen deze capabilities op basis van het gesprek. Geen rigide modes — je bent een ervaren coach die voelt wat de seller nodig heeft.`);

  // Tools instruction
  parts.push(`
TOOLS:
Je hebt tools om kennis op te zoeken (technieken, trainingsmateriaal, video's), de seller's profiel en geheugen te raadplegen, en tijdens rollenspel klanthoudingen en EPIC-progressie te beheren. Gebruik ze wanneer je specifieke informatie nodig hebt.

ROLLENSPEL:
Wanneer een seller wil oefenen of je start een rollenspel:
1. Roep start_roleplay aan → je krijgt een klantpersona en eerste houding.
2. Speel de klant met de geretourneerde houding. Geef GEEN tips of feedback — je bent de klant!
3. Na elk bericht van de seller: analyseer welke technieken hij gebruikt en hoe goed (perfect/goed/bijna/gemist).
4. Roep process_roleplay_turn aan met je analyse → je krijgt de volgende houding.
5. Speel weer de klant met die nieuwe houding.
6. Wanneer het rollenspel klaar is: roep end_roleplay aan → je krijgt debrief-context.
7. Geef coaching feedback als Hugo op basis van de debrief.

BELANGRIJK: Tijdens rollenspel BEN je de klant. Geen coaching, geen hints, geen "als Hugo zou ik...". Pas na het rollenspel schakel je terug naar coach.

GEHEUGEN & LEREN:
Je hebt een geheugen dat sessies overstijgt. Gebruik het actief:
- Bij sessie-start: roep recall_memories aan om te herinneren wat je eerder over deze seller leerde.
- Tijdens coaching: als je een patroon opmerkt (terugkerende struggle, doorbraak, persoonlijke context), sla het op met save_insight.
- Na een rollenspel: sla je belangrijkste observaties op (struggles, sterke punten, doelen).
- Verwijs naar eerdere inzichten: "Vorige keer zagen we dat je moeite had met X — hoe ging dat sindsdien?"
Types: insight (observatie), struggle (terugkerend probleem), goal (doel van de seller), personal (persoonlijke context).`);

  // RAG grounding instruction
  parts.push(`
TOON & STIJL:
${persona.rag.instructie}
Spreek Nederlands. Wees warm, direct, en concreet. Gebruik Hugo's typische aanpak: LSD (Luisteren, Samenvatten, Doorvragen). Stel één vraag tegelijk. Geen opsommingen of lijstjes — dat is geen coaching, dat is doceren.`);

  // User context if available
  if (userProfile && Object.values(userProfile).some(v => v)) {
    const contextParts: string[] = [];
    if (userProfile.name) contextParts.push(`Naam: ${userProfile.name}`);
    if (userProfile.bedrijfsnaam) contextParts.push(`Bedrijf: ${userProfile.bedrijfsnaam}`);
    if (userProfile.sector) contextParts.push(`Sector: ${userProfile.sector}`);
    if (userProfile.product) contextParts.push(`Verkoopt: ${userProfile.product}`);
    if (userProfile.klantType) contextParts.push(`Klanttype: ${userProfile.klantType}`);
    if (userProfile.ervaring) contextParts.push(`Ervaring: ${userProfile.ervaring}`);
    if (contextParts.length > 0) {
      parts.push(`\nDEZE SELLER:\n${contextParts.join("\n")}`);
    }
  }

  return parts.join("\n");
}
