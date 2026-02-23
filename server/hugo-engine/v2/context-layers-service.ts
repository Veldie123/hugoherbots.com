/**
 * context-layers-service.ts - Extended Context Layers for V3 Orchestration
 * 
 * Implements the 4 context layer types defined in coach_overlay_v3.json:
 * - base: Basic seller context (sector, product, channel, customer type, experience)
 * - scenario: Specific customer scenario for roleplay (company, role, situation, challenge)
 * - value_map: Mapping of customer needs to benefits
 * - objection_bank: Common objections and concerns for the product/sector
 * 
 * These layers are progressively gathered based on the technique's context_depth setting.
 */

import { getOpenAI } from '../openai-client';
import type { ContextState } from './context_engine';

export type ContextLayer = 'base' | 'scenario' | 'value_map' | 'objection_bank' | 'positioning_map' | 'offer_map';
export type ContextDepth = 'LIGHT' | 'STANDARD' | 'DEEP';
export type SlotPriority = 'minimum' | 'nice_to_have';

export interface ContextBudget {
  maxQuestionsTotal: number;
  maxQuestionsConsecutive: number;
  layersCollected: number;
}

export interface ScenarioLayer {
  klant_naam?: string;
  klant_functie?: string;
  klant_bedrijf?: string;
  klant_bedrijfsgrootte?: string;
  klant_situatie?: string;
  klant_uitdaging?: string;
  klant_doel?: string;
  koopfase?: string;
}

export interface ValueMapLayer {
  belangrijkste_behoeften: string[];
  pijnpunten: string[];
  gewenste_resultaten: string[];
  prioriteiten: string[];
  besliscriteria?: string[];
}

export interface ObjectionBankLayer {
  veelvoorkomende_bezwaren: string[];
  typische_twijfels: string[];
  concurrentie_argumenten?: string[];
  prijsgevoeligheid?: string;
  risico_percepties?: string[];
}

export interface PositioningMapLayer {
  sterktes: string[];
  zwaktes: string[];
  afhaakredenen_terecht: string[];
  afhaakredenen_onterecht: string[];
  concurrenten: string[];
  differentiators: string[];
}

/**
 * Hiërarchisch Value Model:
 * Product → Oplossingen (meerdere) → Voordelen per oplossing → Baten per voordeel
 * 
 * Voorbeeld totaalrenovatie:
 * - Oplossing 1: "Gedediceerde projectleider"
 *   - Voordeel: "U hoeft zelf niets te doen" → Baat: "Gerust gemoed op reis/golfen"
 *   - Voordeel: "Kwalitatief gedaan" → Baat: "Geen gedoe achteraf"
 * - Oplossing 2: "24/7 klantendienst"
 *   - Voordeel: "Altijd bereikbaar" → Baat: "Direct antwoord bij zorgen"
 * - Oplossing 3: "Aankoopdienst (30% korting)"
 *   - Voordeel: "Lagere materiaalkosten" → Baat: "Meer budget voor afwerking"
 */
export interface BaatItem {
  baat: string;                    // De emotionele/praktische baat voor de klant
  persona_fit?: string;            // Welk type klant vindt dit vooral belangrijk?
}

export interface VoordeelItem {
  voordeel: string;                // Het functionele voordeel
  baten: BaatItem[];               // Meerdere baten per voordeel
}

export interface OplossingsItem {
  naam: string;                    // Naam van de oplossing (bijv. "Gedediceerde projectleider")
  korte_omschrijving: string;      // 1-zin uitleg
  voordelen: VoordeelItem[];       // Meerdere voordelen per oplossing
  bewijsvoering?: string[];        // Cases, referenties, metrics voor deze oplossing
}

export interface OfferMapLayer {
  product_naam: string;            // Het product/dienst (bijv. "Totaalrenovatie")
  product_omschrijving: string;    // 1-zin pitch
  oplossingen: OplossingsItem[];   // Hiërarchische lijst van oplossingen
  prijsrange?: string;             // Globale indicatie
  implementatie_aanpak?: string[]; // Hoe wordt het geleverd?
  next_step_menu?: string[];       // Mogelijke vervolgstappen
}

export interface ExtendedContextLayers {
  base: Record<string, string>;
  scenario?: ScenarioLayer;
  value_map?: ValueMapLayer;
  objection_bank?: ObjectionBankLayer;
  positioning_map?: PositioningMapLayer;
  offer_map?: OfferMapLayer;
}

export const LAYER_SLOTS: Record<ContextLayer, { minimum: string[]; nice_to_have: string[] }> = {
  base: {
    minimum: ['sector', 'product', 'klant_type', 'verkoopkanaal'],
    nice_to_have: ['ervaring', 'prijsrange', 'regio', 'maturity']
  },
  scenario: {
    minimum: ['afspraak_type', 'rol_gesprekspartner', 'context_afspraak', 'lastige_openingsvraag'],
    nice_to_have: ['dmu', 'timing_urgentie', 'huidige_oplossing']
  },
  value_map: {
    minimum: ['top_pain', 'gewenste_uitkomst', 'huidige_workaround'],
    nice_to_have: ['top_3_pains', 'top_3_baten', 'koopredenen_recent', 'besliscriteria']
  },
  objection_bank: {
    minimum: ['typisch_bezwaar', 'typische_twijfel', 'typische_uitstelreden'],
    nice_to_have: ['top_5_bezwaren', 'top_5_twijfels', 'angst_risico_patroon']
  },
  positioning_map: {
    minimum: ['top_3_sterktes', 'top_2_zwaktes', 'top_3_concurrenten'],
    nice_to_have: ['afhaakredenen_terecht', 'afhaakredenen_onterecht', 'differentiators']
  },
  offer_map: {
    minimum: ['product_naam', 'product_omschrijving', 'oplossingen'],
    nice_to_have: ['prijsrange', 'implementatie_aanpak', 'next_step_menu']
  }
};

export const FLOW_RULES = {
  max_consecutive_questions: 2,
  context_budget_per_session: 5,
  after_questions_always: 'deliver_value',
  progressive_disclosure: true
};

export const CONTEXT_DEPTH_LAYERS: Record<ContextDepth | 'FULL', ContextLayer[]> = {
  LIGHT: ['base'],
  STANDARD: ['base', 'scenario'],
  DEEP: ['base', 'scenario', 'value_map', 'objection_bank'],
  FULL: ['base', 'scenario', 'value_map', 'objection_bank', 'positioning_map', 'offer_map']
};

export function getRequiredLayers(depth: ContextDepth): ContextLayer[] {
  return CONTEXT_DEPTH_LAYERS[depth] || CONTEXT_DEPTH_LAYERS.LIGHT;
}

export function hasRequiredLayers(
  layers: ExtendedContextLayers,
  required: ContextLayer[]
): { complete: boolean; missing: ContextLayer[] } {
  const missing: ContextLayer[] = [];
  
  for (const layer of required) {
    if (layer === 'base') {
      if (!layers.base || Object.keys(layers.base).length < 2) {
        missing.push('base');
      }
    } else if (layer === 'scenario') {
      if (!layers.scenario || !layers.scenario.klant_situatie) {
        missing.push('scenario');
      }
    } else if (layer === 'value_map') {
      if (!layers.value_map || layers.value_map.belangrijkste_behoeften.length === 0) {
        missing.push('value_map');
      }
    } else if (layer === 'objection_bank') {
      if (!layers.objection_bank || layers.objection_bank.veelvoorkomende_bezwaren.length === 0) {
        missing.push('objection_bank');
      }
    }
  }
  
  return { complete: missing.length === 0, missing };
}

export async function generateScenarioLayer(
  baseContext: Record<string, string>
): Promise<ScenarioLayer> {
  const openai = getOpenAI();
  
  const prompt = `Je bent een scenario-generator voor sales roleplay training.

Gebaseerd op deze verkoper context:
- Sector: ${baseContext.sector || 'onbekend'}
- Product: ${baseContext.product || 'onbekend'}
- Verkoopkanaal: ${baseContext.verkoopkanaal || 'onbekend'}
- Klant type: ${baseContext.klant_type || 'onbekend'}

Genereer een realistisch klantscenario voor een roleplay oefening.

Antwoord in JSON formaat:
{
  "klant_naam": "Voornaam Achternaam",
  "klant_functie": "Functietitel",
  "klant_bedrijf": "Bedrijfsnaam",
  "klant_bedrijfsgrootte": "klein/midden/groot",
  "klant_situatie": "Korte beschrijving van de huidige situatie",
  "klant_uitdaging": "Het specifieke probleem of de uitdaging",
  "klant_doel": "Wat de klant wil bereiken",
  "koopfase": "orienterend/vergelijkend/beslissend"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as ScenarioLayer;
  } catch (error: any) {
    console.error('[context-layers] Error generating scenario:', error.message);
    return {
      klant_naam: 'Jan de Vries',
      klant_functie: 'Manager',
      klant_bedrijf: 'Voorbeeld BV',
      klant_situatie: 'Zoekt naar een oplossing',
      klant_uitdaging: 'Huidige proces is inefficient',
      koopfase: 'orienterend'
    };
  }
}

export async function generateValueMapLayer(
  baseContext: Record<string, string>,
  scenario?: ScenarioLayer
): Promise<ValueMapLayer> {
  const openai = getOpenAI();
  
  const prompt = `Je bent een value mapping expert voor sales training.

Verkoper context:
- Sector: ${baseContext.sector || 'onbekend'}
- Product: ${baseContext.product || 'onbekend'}
- Klant type: ${baseContext.klant_type || 'onbekend'}
${scenario ? `
Klant scenario:
- Functie: ${scenario.klant_functie || 'onbekend'}
- Situatie: ${scenario.klant_situatie || 'onbekend'}
- Uitdaging: ${scenario.klant_uitdaging || 'onbekend'}
` : ''}

Genereer een value map die typische behoeften, pijnpunten en gewenste resultaten beschrijft voor dit type klant.

Antwoord in JSON formaat:
{
  "belangrijkste_behoeften": ["behoefte 1", "behoefte 2", "behoefte 3"],
  "pijnpunten": ["pijnpunt 1", "pijnpunt 2", "pijnpunt 3"],
  "gewenste_resultaten": ["resultaat 1", "resultaat 2", "resultaat 3"],
  "prioriteiten": ["prioriteit 1", "prioriteit 2"],
  "besliscriteria": ["criterium 1", "criterium 2"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as ValueMapLayer;
  } catch (error: any) {
    console.error('[context-layers] Error generating value map:', error.message);
    return {
      belangrijkste_behoeften: ['Efficientie verbeteren', 'Kosten besparen', 'Risicos beperken'],
      pijnpunten: ['Tijdgebrek', 'Onduidelijke processen', 'Gebrek aan inzicht'],
      gewenste_resultaten: ['Meer controle', 'Betere resultaten', 'Minder stress'],
      prioriteiten: ['ROI', 'Implementatietijd']
    };
  }
}

export async function generateObjectionBankLayer(
  baseContext: Record<string, string>,
  scenario?: ScenarioLayer
): Promise<ObjectionBankLayer> {
  const openai = getOpenAI();
  
  const prompt = `Je bent een sales trainer die bezwaren en twijfels voorspelt.

Verkoper context:
- Sector: ${baseContext.sector || 'onbekend'}
- Product: ${baseContext.product || 'onbekend'}
- Klant type: ${baseContext.klant_type || 'onbekend'}
${scenario ? `
Klant scenario:
- Functie: ${scenario.klant_functie || 'onbekend'}
- Bedrijfsgrootte: ${scenario.klant_bedrijfsgrootte || 'onbekend'}
- Koopfase: ${scenario.koopfase || 'onbekend'}
` : ''}

Genereer typische bezwaren en twijfels die deze klant zou kunnen hebben.

Antwoord in JSON formaat:
{
  "veelvoorkomende_bezwaren": ["bezwaar 1", "bezwaar 2", "bezwaar 3"],
  "typische_twijfels": ["twijfel 1", "twijfel 2", "twijfel 3"],
  "concurrentie_argumenten": ["concurrent argument 1", "concurrent argument 2"],
  "prijsgevoeligheid": "laag/gemiddeld/hoog",
  "risico_percepties": ["risico 1", "risico 2"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as ObjectionBankLayer;
  } catch (error: any) {
    console.error('[context-layers] Error generating objection bank:', error.message);
    return {
      veelvoorkomende_bezwaren: ['Te duur', 'Geen tijd voor implementatie', 'Moet met collega overleggen'],
      typische_twijfels: ['Werkt het echt?', 'Past het bij ons?', 'Wat als het niet werkt?'],
      prijsgevoeligheid: 'gemiddeld',
      risico_percepties: ['Implementatierisico', 'Veranderingsrisico']
    };
  }
}

export async function generatePositioningMapLayer(
  baseContext: Record<string, string>
): Promise<PositioningMapLayer> {
  const openai = getOpenAI();
  
  const prompt = `Je bent een sales positioneringsexpert. Analyseer dit product/dienst en genereer een SWOT-achtige positioneringskaart.

Verkoper context:
- Sector: ${baseContext.sector || 'onbekend'}
- Product: ${baseContext.product || 'onbekend'}
- Klant type: ${baseContext.klant_type || 'onbekend'}
- Verkoopkanaal: ${baseContext.verkoopkanaal || 'onbekend'}

Genereer een positioneringskaart met sterktes, zwaktes, concurrenten en afhaakredenen.

Antwoord in JSON formaat:
{
  "sterktes": ["sterkte 1", "sterkte 2", "sterkte 3"],
  "zwaktes": ["zwakte/trade-off 1", "zwakte/trade-off 2"],
  "afhaakredenen_terecht": ["terechte reden 1", "terechte reden 2"],
  "afhaakredenen_onterecht": ["misperceptie 1", "misperceptie 2", "misperceptie 3"],
  "concurrenten": ["concurrent/alternatief 1", "concurrent/alternatief 2", "concurrent/alternatief 3"],
  "differentiators": ["wat ons onderscheidt 1", "wat ons onderscheidt 2"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as PositioningMapLayer;
  } catch (error: any) {
    console.error('[context-layers] Error generating positioning map:', error.message);
    return {
      sterktes: ['Expertise en ervaring', 'Goede service', 'Flexibiliteit'],
      zwaktes: ['Hogere prijs dan budget-opties', 'Langere implementatietijd'],
      afhaakredenen_terecht: ['Budget is echt te beperkt', 'Geen fit met werkwijze'],
      afhaakredenen_onterecht: ['Te complex (terwijl implementatie begeleid wordt)', 'Te duur (zonder ROI te berekenen)'],
      concurrenten: ['Goedkopere alternatieven', 'Intern doen', 'Niets doen'],
      differentiators: ['Persoonlijke aanpak', 'Bewezen resultaten']
    };
  }
}

export async function generateOfferMapLayer(
  baseContext: Record<string, string>,
  valueMap?: ValueMapLayer
): Promise<OfferMapLayer> {
  const openai = getOpenAI();
  
  const prompt = `Je bent een sales aanbod-structureerder. Maak een coherent aanbod gebaseerd op de context.

Verkoper context:
- Sector: ${baseContext.sector || 'onbekend'}
- Product: ${baseContext.product || 'onbekend'}
- Klant type: ${baseContext.klant_type || 'onbekend'}
${valueMap ? `
Klant behoeften:
- Behoeften: ${valueMap.belangrijkste_behoeften.join(', ')}
- Pijnpunten: ${valueMap.pijnpunten.join(', ')}
- Gewenste resultaten: ${valueMap.gewenste_resultaten.join(', ')}
` : ''}

Genereer een hiërarchische offer map die het aanbod structureert.
Let op: een product heeft meerdere OPLOSSINGEN, elke oplossing heeft meerdere VOORDELEN, en elk voordeel heeft meerdere BATEN.

Voorbeeld voor "Totaalrenovatie":
- Oplossing: "Gedediceerde projectleider" 
  - Voordeel: "U hoeft zelf niets te doen" → Baat: "Gerust gemoed op reis"
  - Voordeel: "Controle op onderaannemers" → Baat: "Geen slechte afwerking"

Antwoord in JSON formaat:
{
  "product_naam": "Naam van het product/dienst",
  "product_omschrijving": "1-zin pitch van wat het is",
  "oplossingen": [
    {
      "naam": "Naam van oplossing 1",
      "korte_omschrijving": "Wat deze oplossing inhoudt",
      "voordelen": [
        {
          "voordeel": "Functioneel voordeel",
          "baten": [
            { "baat": "Emotionele/praktische baat voor klant", "persona_fit": "Drukke ondernemer" }
          ]
        }
      ],
      "bewijsvoering": ["Case of referentie"]
    }
  ],
  "prijsrange": "indicatie van prijsrange",
  "implementatie_aanpak": ["stap 1", "stap 2"],
  "next_step_menu": ["demo", "workshop", "voorstel"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 1500,  // Verhoogd voor hiërarchische structuur
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    console.log('[context-layers] AI generated offer_map successfully');
    return JSON.parse(content) as OfferMapLayer;
  } catch (error: any) {
    console.error('[context-layers] Error generating offer map:', error.message);
    return {
      product_naam: baseContext.product || 'Onze oplossing',
      product_omschrijving: 'Een complete oplossing die u helpt uw doelen te bereiken',
      oplossingen: [
        {
          naam: 'Standaard oplossing',
          korte_omschrijving: 'De basis van wat wij bieden',
          voordelen: [
            {
              voordeel: 'Tijdsbesparing',
              baten: [{ baat: 'Meer tijd voor wat echt belangrijk is' }]
            },
            {
              voordeel: 'Kostenbesparing', 
              baten: [{ baat: 'Meer budget voor andere prioriteiten' }]
            }
          ],
          bewijsvoering: ['Klanten hebben X% verbetering gezien']
        }
      ],
      prijsrange: 'Afhankelijk van scope',
      next_step_menu: ['Demo', 'Voorstel']
    };
  }
}

export async function buildExtendedContext(
  baseContext: Record<string, string>,
  requiredLayers: ContextLayer[],
  options?: { thinSlice?: boolean }
): Promise<ExtendedContextLayers> {
  const result: ExtendedContextLayers = {
    base: baseContext
  };
  
  if (requiredLayers.includes('scenario')) {
    console.log('[context-layers] Generating scenario layer...');
    result.scenario = await generateScenarioLayer(baseContext);
  }
  
  if (requiredLayers.includes('value_map')) {
    console.log('[context-layers] Generating value map layer...');
    result.value_map = await generateValueMapLayer(baseContext, result.scenario);
  }
  
  if (requiredLayers.includes('objection_bank')) {
    console.log('[context-layers] Generating objection bank layer...');
    result.objection_bank = await generateObjectionBankLayer(baseContext, result.scenario);
  }
  
  if (requiredLayers.includes('positioning_map')) {
    console.log('[context-layers] Generating positioning map layer...');
    result.positioning_map = await generatePositioningMapLayer(baseContext);
  }
  
  if (requiredLayers.includes('offer_map')) {
    console.log('[context-layers] Generating offer map layer...');
    result.offer_map = await generateOfferMapLayer(baseContext, result.value_map);
  }
  
  console.log('[context-layers] Extended context built with layers:', Object.keys(result));
  return result;
}

export function formatExtendedContextForPrompt(layers: ExtendedContextLayers): string {
  const sections: string[] = [];
  
  sections.push('── VERKOPER CONTEXT ──');
  for (const [key, value] of Object.entries(layers.base)) {
    sections.push(`${key}: ${value}`);
  }
  
  if (layers.scenario) {
    sections.push('\n── KLANT SCENARIO ──');
    if (layers.scenario.klant_naam) sections.push(`Naam: ${layers.scenario.klant_naam}`);
    if (layers.scenario.klant_functie) sections.push(`Functie: ${layers.scenario.klant_functie}`);
    if (layers.scenario.klant_bedrijf) sections.push(`Bedrijf: ${layers.scenario.klant_bedrijf}`);
    if (layers.scenario.klant_bedrijfsgrootte) sections.push(`Bedrijfsgrootte: ${layers.scenario.klant_bedrijfsgrootte}`);
    if (layers.scenario.klant_situatie) sections.push(`Situatie: ${layers.scenario.klant_situatie}`);
    if (layers.scenario.klant_uitdaging) sections.push(`Uitdaging: ${layers.scenario.klant_uitdaging}`);
    if (layers.scenario.klant_doel) sections.push(`Doel: ${layers.scenario.klant_doel}`);
    if (layers.scenario.koopfase) sections.push(`Koopfase: ${layers.scenario.koopfase}`);
  }
  
  if (layers.value_map) {
    sections.push('\n── VALUE MAP ──');
    sections.push(`Belangrijkste behoeften: ${layers.value_map.belangrijkste_behoeften.join(', ')}`);
    sections.push(`Pijnpunten: ${layers.value_map.pijnpunten.join(', ')}`);
    sections.push(`Gewenste resultaten: ${layers.value_map.gewenste_resultaten.join(', ')}`);
    sections.push(`Prioriteiten: ${layers.value_map.prioriteiten.join(', ')}`);
    if (layers.value_map.besliscriteria) {
      sections.push(`Besliscriteria: ${layers.value_map.besliscriteria.join(', ')}`);
    }
  }
  
  if (layers.objection_bank) {
    sections.push('\n── OBJECTION BANK ──');
    sections.push(`Veelvoorkomende bezwaren: ${layers.objection_bank.veelvoorkomende_bezwaren.join(', ')}`);
    sections.push(`Typische twijfels: ${layers.objection_bank.typische_twijfels.join(', ')}`);
    if (layers.objection_bank.concurrentie_argumenten) {
      sections.push(`Concurrentie argumenten: ${layers.objection_bank.concurrentie_argumenten.join(', ')}`);
    }
    if (layers.objection_bank.prijsgevoeligheid) {
      sections.push(`Prijsgevoeligheid: ${layers.objection_bank.prijsgevoeligheid}`);
    }
    if (layers.objection_bank.risico_percepties) {
      sections.push(`Risico percepties: ${layers.objection_bank.risico_percepties.join(', ')}`);
    }
  }
  
  if (layers.positioning_map) {
    sections.push('\n── POSITIONING MAP ──');
    sections.push(`Sterktes: ${layers.positioning_map.sterktes.join(', ')}`);
    sections.push(`Zwaktes: ${layers.positioning_map.zwaktes.join(', ')}`);
    sections.push(`Concurrenten: ${layers.positioning_map.concurrenten.join(', ')}`);
    sections.push(`Afhaakredenen (terecht): ${layers.positioning_map.afhaakredenen_terecht.join(', ')}`);
    sections.push(`Afhaakredenen (onterecht/mispercepties): ${layers.positioning_map.afhaakredenen_onterecht.join(', ')}`);
    sections.push(`Differentiators: ${layers.positioning_map.differentiators.join(', ')}`);
  }
  
  if (layers.offer_map) {
    sections.push('\n── OFFER MAP ──');
    sections.push(`Product: ${layers.offer_map.product_naam}`);
    sections.push(`Omschrijving: ${layers.offer_map.product_omschrijving}`);
    
    // Hiërarchische weergave: Product → Oplossingen → Voordelen → Baten
    if (layers.offer_map.oplossingen && layers.offer_map.oplossingen.length > 0) {
      sections.push('\nOplossingen:');
      for (const opl of layers.offer_map.oplossingen) {
        sections.push(`  ▸ ${opl.naam}: ${opl.korte_omschrijving}`);
        for (const vd of opl.voordelen || []) {
          sections.push(`    • Voordeel: ${vd.voordeel}`);
          for (const bt of vd.baten || []) {
            sections.push(`      → Baat: ${bt.baat}${bt.persona_fit ? ` (${bt.persona_fit})` : ''}`);
          }
        }
        if (opl.bewijsvoering && opl.bewijsvoering.length > 0) {
          sections.push(`    📊 Bewijs: ${opl.bewijsvoering.join(', ')}`);
        }
      }
    }
    
    if (layers.offer_map.prijsrange) {
      sections.push(`\nPrijsrange: ${layers.offer_map.prijsrange}`);
    }
    if (layers.offer_map.implementatie_aanpak) {
      sections.push(`Implementatie: ${layers.offer_map.implementatie_aanpak.join(' → ')}`);
    }
    if (layers.offer_map.next_step_menu) {
      sections.push(`Next steps: ${layers.offer_map.next_step_menu.join(', ')}`);
    }
  }
  
  return sections.join('\n');
}

export function checkRoleplayUnlock(
  techniqueId: string,
  userAttempts: Record<string, number>,
  overlayConfig: any
): { unlocked: boolean; message?: string; missingPrerequisites?: string[] } {
  const techniqueConfig = overlayConfig.technieken?.[techniqueId];
  if (!techniqueConfig?.orchestrator?.roleplay_unlock) {
    return { unlocked: true };
  }
  
  const unlock = techniqueConfig.orchestrator.roleplay_unlock;
  if (unlock.type !== 'after_attempts') {
    return { unlocked: true };
  }
  
  const missingPrerequisites: string[] = [];
  for (const prereq of unlock.prerequisites || []) {
    const attempts = userAttempts[prereq] || 0;
    if (attempts < (unlock.min_attempts || 1)) {
      missingPrerequisites.push(prereq);
    }
  }
  
  if (missingPrerequisites.length > 0) {
    return {
      unlocked: false,
      message: unlock.lock_behavior?.locked_message || `Oefen eerst: ${missingPrerequisites.join(', ')}`,
      missingPrerequisites
    };
  }
  
  return { unlocked: true };
}

export function getSequenceRank(techniqueId: string, overlayConfig: any): number {
  const techniqueConfig = overlayConfig.technieken?.[techniqueId];
  const learningFunction = techniqueConfig?.orchestrator?.learning_function || 'COACH_TRANSLATE';
  const rankMap = overlayConfig.flow_rules?.sequence_policy?.rank_by_learning_function || {
    COACH_TRANSLATE: 10,
    MICRO_DRILL: 20,
    ROLEPLAY_DRILL: 80,
    ROLEPLAY_INTEGRATED: 90
  };
  return rankMap[learningFunction] || 50;
}
