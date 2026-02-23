/**
 * brief-generator-service.ts - Brief Generation for V3 Orchestration
 * 
 * Generates structured briefs after roleplay completion:
 * - discovery_brief: Summary of what was discovered in phase 2 (Explore/Probe/Impact)
 * - offer_brief: Summary of the offer presented in phase 3 (Recommend)
 * 
 * These briefs are stored as artifacts and used as input for subsequent phases.
 */

import { getOpenAI } from '../openai-client';
import { saveArtifact, type ArtifactContent } from './artifact-service';
import type { ExtendedContextLayers, ScenarioLayer, ValueMapLayer } from './context-layers-service';

export interface DiscoveryBrief {
  klant_situatie_samenvatting: string;
  ontdekte_behoeften: string[];
  kernpijnpunten: string[];
  gewenste_uitkomsten: string[];
  belangrijkste_quotes: string[];
  koopsignalen: string[];
  waarschuwingssignalen: string[];
  vervolgadvies: string;
}

export interface OfferBrief {
  aangeboden_oplossing: string;
  gekoppelde_baten: Array<{
    behoefte: string;
    baat: string;
  }>;
  klant_reactie_samenvatting: string;
  openstaande_bezwaren: string[];
  afspraken_gemaakt: string[];
  afsluiting_status: 'positief' | 'neutraal' | 'negatief' | 'uitgesteld';
  vervolgstappen: string[];
}

export async function generateDiscoveryBrief(
  sessionId: string,
  userId: string,
  techniqueId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  contextLayers?: ExtendedContextLayers
): Promise<DiscoveryBrief> {
  const openai = getOpenAI();
  
  const conversationText = conversationHistory
    .map(msg => `${msg.role === 'user' ? 'Verkoper' : 'Klant'}: ${msg.content}`)
    .join('\n\n');
  
  const prompt = `Je bent een sales coach die een roleplay gesprek analyseert.

Analyseer het volgende gesprek en maak een Discovery Brief - een samenvatting van wat er ontdekt is over de klant.

${contextLayers?.scenario ? `
Klant scenario:
- Naam: ${contextLayers.scenario.klant_naam || 'onbekend'}
- Functie: ${contextLayers.scenario.klant_functie || 'onbekend'}
- Situatie: ${contextLayers.scenario.klant_situatie || 'onbekend'}
` : ''}

GESPREK:
${conversationText}

Maak een gestructureerde Discovery Brief in JSON formaat:
{
  "klant_situatie_samenvatting": "Korte samenvatting van de klantsituatie zoals ontdekt in het gesprek",
  "ontdekte_behoeften": ["behoefte 1", "behoefte 2", "..."],
  "kernpijnpunten": ["pijnpunt 1", "pijnpunt 2", "..."],
  "gewenste_uitkomsten": ["uitkomst 1", "uitkomst 2", "..."],
  "belangrijkste_quotes": ["Letterlijke quote van klant 1", "Quote 2", "..."],
  "koopsignalen": ["positief signaal 1", "signaal 2", "..."],
  "waarschuwingssignalen": ["negatief signaal 1", "signaal 2", "..."],
  "vervolgadvies": "Advies voor de volgende fase van het gesprek"
}

Focus op wat de verkoper daadwerkelijk heeft ontdekt. Als iets niet besproken is, laat de array leeg.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const brief = JSON.parse(content) as DiscoveryBrief;
    
    await saveArtifact(
      sessionId,
      userId,
      'discovery_brief',
      techniqueId,
      brief as unknown as ArtifactContent,
      'probe'
    );
    
    console.log('[brief-generator] Discovery brief generated and saved');
    return brief;
    
  } catch (error: any) {
    console.error('[brief-generator] Error generating discovery brief:', error.message);
    const fallback: DiscoveryBrief = {
      klant_situatie_samenvatting: 'Niet geanalyseerd',
      ontdekte_behoeften: [],
      kernpijnpunten: [],
      gewenste_uitkomsten: [],
      belangrijkste_quotes: [],
      koopsignalen: [],
      waarschuwingssignalen: [],
      vervolgadvies: 'Ga terug naar de verkenningsfase'
    };
    return fallback;
  }
}

export async function generateOfferBrief(
  sessionId: string,
  userId: string,
  techniqueId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  discoveryBrief?: DiscoveryBrief,
  contextLayers?: ExtendedContextLayers
): Promise<OfferBrief> {
  const openai = getOpenAI();
  
  const conversationText = conversationHistory
    .map(msg => `${msg.role === 'user' ? 'Verkoper' : 'Klant'}: ${msg.content}`)
    .join('\n\n');
  
  const prompt = `Je bent een sales coach die een aanbevelingsfase analyseert.

Analyseer het volgende gesprek en maak een Offer Brief - een samenvatting van het aanbod en de klantreactie.

${discoveryBrief ? `
DISCOVERY BRIEF (uit vorige fase):
- Situatie: ${discoveryBrief.klant_situatie_samenvatting}
- Behoeften: ${discoveryBrief.ontdekte_behoeften.join(', ')}
- Pijnpunten: ${discoveryBrief.kernpijnpunten.join(', ')}
` : ''}

GESPREK (Aanbevelingsfase):
${conversationText}

Maak een gestructureerde Offer Brief in JSON formaat:
{
  "aangeboden_oplossing": "Beschrijving van wat de verkoper heeft aangeboden",
  "gekoppelde_baten": [
    {"behoefte": "klantbehoefte", "baat": "gekoppelde baat/voordeel"},
    {"behoefte": "andere behoefte", "baat": "andere baat"}
  ],
  "klant_reactie_samenvatting": "Hoe reageerde de klant op het aanbod",
  "openstaande_bezwaren": ["bezwaar 1", "bezwaar 2"],
  "afspraken_gemaakt": ["afspraak 1", "afspraak 2"],
  "afsluiting_status": "positief|neutraal|negatief|uitgesteld",
  "vervolgstappen": ["stap 1", "stap 2"]
}

Focus op wat er daadwerkelijk besproken is. Als iets niet aan bod kwam, laat arrays leeg.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const brief = JSON.parse(content) as OfferBrief;
    
    await saveArtifact(
      sessionId,
      userId,
      'offer_brief',
      techniqueId,
      brief as unknown as ArtifactContent,
      'commit'
    );
    
    console.log('[brief-generator] Offer brief generated and saved');
    return brief;
    
  } catch (error: any) {
    console.error('[brief-generator] Error generating offer brief:', error.message);
    const fallback: OfferBrief = {
      aangeboden_oplossing: 'Niet geanalyseerd',
      gekoppelde_baten: [],
      klant_reactie_samenvatting: 'Onbekend',
      openstaande_bezwaren: [],
      afspraken_gemaakt: [],
      afsluiting_status: 'neutraal',
      vervolgstappen: []
    };
    return fallback;
  }
}

export async function generateScenarioSnapshot(
  sessionId: string,
  userId: string,
  techniqueId: string,
  contextLayers: ExtendedContextLayers
): Promise<void> {
  const snapshot = {
    base: contextLayers.base,
    scenario: contextLayers.scenario,
    value_map: contextLayers.value_map,
    objection_bank: contextLayers.objection_bank,
    generated_at: new Date().toISOString()
  };
  
  await saveArtifact(
    sessionId,
    userId,
    'scenario_snapshot',
    techniqueId,
    snapshot as unknown as ArtifactContent,
    'explore'
  );
  
  console.log('[brief-generator] Scenario snapshot saved');
}
