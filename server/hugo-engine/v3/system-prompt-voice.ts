/**
 * V3 Voice System Prompt
 *
 * Extends the base coaching prompt with voice-specific rules:
 * shorter responses, no markdown, conversational Dutch.
 */
import { buildV3SystemPrompt } from "./system-prompt";
import type { UserBriefing } from "./user-briefing";

interface UserProfile {
  name?: string;
  sector?: string;
  product?: string;
  klantType?: string;
  ervaring?: string;
  bedrijfsnaam?: string;
}

const VOICE_RULES = `

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
- TERMINOLOGIE-REGEL blijft van kracht — gebruik exacte SSOT-namen.
- Eindig NOOIT met een lijst of opsomming. Eindig altijd met een vraag.
- Begin je antwoord met een korte, natuurlijke erkenning ("Kijk,", "Ah,", "Ja,", "Oké,", "Goeie vraag,").
  Dit helpt de latency: ElevenLabs begint te spreken zodra de eerste tokens binnenkomen.
  Genereer dit organisch — geen vaste formules, varieer per antwoord.`;

/**
 * Build voice-specific system prompt by extending the base coaching prompt.
 */
export function buildVoiceSystemPrompt(userProfile?: UserProfile, briefing?: UserBriefing): string {
  const basePrompt = buildV3SystemPrompt(userProfile, briefing);
  return basePrompt + VOICE_RULES;
}
