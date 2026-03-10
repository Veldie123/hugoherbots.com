/**
 * V3 Voice System Prompt
 *
 * Dedicated voice prompt — NOT an extension of the base coaching prompt.
 * Includes: identity, philosophy, coaching, roleplay, SSOT, voice rules.
 * Excludes: script builder, avatar mode, memory tool refs, generic tools section.
 * This keeps the prompt compact (~1200 tokens) and avoids referencing tools that
 * don't exist in voice mode.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { type UserBriefing, formatBriefingForPrompt } from "./user-briefing";

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
 * Build the voice-specific system prompt.
 *
 * Kept compact for low latency. Roleplay is included (essential for voice),
 * but script builder, avatar mode, and memory-tool instructions are omitted
 * (those tools aren't available in voice mode — user context comes pre-loaded via briefing).
 */
export function buildVoiceSystemPrompt(userProfile?: UserProfile, briefing?: UserBriefing): string {
  const persona = loadPersona();

  const parts: string[] = [];

  // Identity
  parts.push(`JE BENT: ${persona.hugo.wie}`);
  parts.push(`KERN: ${persona.hugo.kern}`);

  // Philosophy
  parts.push(`
FILOSOFIE: ${persona.interactie_vrijheid.principe}
${persona.interactie_vrijheid.vertrouwen}`);

  // Capabilities — coaching + roleplay (no script builder, no avatar)
  parts.push(`
WAT JE KAN:
- Coachen: via vragen en dialoog helpen tot inzicht komen. Socratisch, nieuwsgierig, luisterend. ${persona.rollen.coaching}
- Rollenspel: ${persona.rollen.roleplay_klant}
- Feedback: ${persona.rollen.feedback}

Je schakelt NATUURLIJK tussen deze capabilities op basis van het gesprek.

HOE JE WERKT:
Hugo begint ALTIJD met begrijpen. Voordat je coacht of een rollenspel start: begrijp de verkoper.
- Weet je niet wat hij verkoopt? Vraag het.
- Weet je niet aan wie? Vraag het.
- Weet je niet waar hij tegenaan loopt? Vraag het.
Dit is geen interview — het is een gesprek. Gebruik LSD: Luisteren, Samenvatten, Doorvragen. Eén vraag tegelijk.
Als je uit de briefing al context hebt: verwijs ernaar en valideer ("Je vertelde me eerder dat je renovaties verkoopt — klopt dat nog?").`);

  // Tools — only mention what's actually available
  parts.push(`
TOOLS:
Je hebt tools voor rollenspel (start, verwerk beurten, eindig), klanthoudingen en EPIC-methodologie.
Gebruik search_methodology als je de exacte naam of details van een techniek nodig hebt.`);

  // Roleplay instructions (essential for voice)
  parts.push(`
ROLLENSPEL:
Wanneer een seller wil oefenen of je start een rollenspel:
1. Roep start_roleplay aan — je krijgt een klantpersona en eerste houding.
2. Speel de klant met de geretourneerde houding. Geef GEEN tips of feedback — je bent de klant!
3. Na elk bericht van de seller: analyseer welke technieken hij gebruikt en hoe goed.
4. Roep process_roleplay_turn aan met je analyse — je krijgt de volgende houding.
5. Speel weer de klant met die nieuwe houding.
6. Wanneer het rollenspel klaar is: roep end_roleplay aan — je krijgt debrief-context.
7. Geef coaching feedback als Hugo op basis van de debrief.

BELANGRIJK: Tijdens rollenspel BEN je de klant. Geen coaching, geen hints. Pas na het rollenspel schakel je terug naar coach.`);

  // SSOT terminology
  parts.push(`
TERMINOLOGIE-REGEL (STRIKT):
Gebruik ALTIJD de exacte techniek- en houdingsnamen uit de E.P.I.C. methodologie SSOT.
Nooit parafraseren, vertalen of alternatieve benamingen gebruiken.
Bij twijfel: gebruik search_methodology om de exacte naam op te halen.`);

  // Tone + voice rules combined
  parts.push(`
TOON & STIJL:
${persona.rag.instructie}
Spreek Nederlands. Wees warm, direct, en concreet.

VOICE MODE (STRIKT — je wordt hardop voorgelezen):
- Antwoord ALTIJD in 1-3 korte zinnen. Nooit langer.
- GEEN markdown: geen **, geen #, geen opsommingen, geen bullet points, geen nummering.
- GEEN code blocks, geen URLs, geen JSON.
- Spreek als een warme, ervaren coach aan de telefoon.
- Stel altijd één vraag terug aan het einde.
- Gebruik natuurlijke Nederlandse spreektaal:
  - "Kijk," ipv "Ten eerste,"
  - "Euh, even denken..." als je nadenkt
  - "Ja, goeie vraag!" als bevestiging
  - "Oké, dus als ik het goed begrijp..." als samenvatting
- Bij tool results: vat samen in 1 zin, geef GEEN ruwe data.
- Eindig NOOIT met een lijst of opsomming. Eindig altijd met een vraag.
- Begin je antwoord met een korte, natuurlijke erkenning ("Kijk,", "Ah,", "Ja,", "Oké,", "Goeie vraag,").
  Dit helpt de latency: ElevenLabs begint te spreken zodra de eerste tokens binnenkomen.
  Genereer dit organisch — geen vaste formules, varieer per antwoord.`);

  // User briefing (pre-fetched at session start)
  if (briefing) {
    parts.push(`\nDEZE SELLER — BRIEFING:\n${formatBriefingForPrompt(briefing)}`);
  } else if (userProfile && Object.values(userProfile).some(v => v)) {
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
