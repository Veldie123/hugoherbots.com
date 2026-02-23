/**
 * Display Mappings - SSOT → Frontend vertalingen
 * 
 * Vertaalt backend keys naar leesbare Nederlandse tekst
 */

// Buying Clock vertalingen
export const buyingClockToDisplay: Record<string, string> = {
  situation_as_is: "Situatie zoals het is (00u-06u)",
  field_of_tension: "Spanningsveld (06u-08u)",
  market_research: "Marktonderzoek (08u-11u)",
  hesitation: "Aarzeling (11u-12u)",
  decision: "Beslissing (12u)"
};

// Gedragsstijlen (uit persona_templates.json)
export const behaviorStyleToDisplay: Record<string, string> = {
  promoverend: "Promoverend",
  faciliterend: "Faciliterend",
  controlerend: "Controlerend",
  analyserend: "Analyserend"
};

// Difficulty levels (backend → display) - 4 competentie niveaus
export const difficultyToDisplay: Record<string, string> = {
  onbewuste_onkunde: "Onbewust Onbekwaam (1/4)",
  bewuste_onkunde: "Bewust Onbekwaam (2/4)",
  bewuste_kunde: "Bewust Bekwaam (3/4)",
  onbewuste_kunde: "Onbewust Bekwaam (4/4)",
  beginner: "Onbewust Onbekwaam (1/4)",
  gemiddeld: "Bewust Bekwaam (3/4)",
  expert: "Onbewust Bekwaam (4/4)"
};

// Difficulty level keys for UI selector (4 levels)
export const difficultyLevels = [
  { key: "onbewuste_onkunde", label: "Onbewust Onbekwaam", short: "1" },
  { key: "bewuste_onkunde", label: "Bewust Onbekwaam", short: "2" },
  { key: "bewuste_kunde", label: "Bewust Bekwaam", short: "3" },
  { key: "onbewuste_kunde", label: "Onbewust Bekwaam", short: "4" }
];

// Signal vertalingen
export const signalToDisplay: Record<string, string> = {
  positive: "positief",
  positief: "positief",
  neutral: "neutraal",
  neutraal: "neutraal",
  negative: "negatief",
  negatief: "negatief"
};

// Evaluatie vertalingen
export const evaluationToDisplay: Record<string, string> = {
  goed: "positief",
  positief: "positief",
  gemist: "gemist",
  neutraal: "neutraal"
};

/**
 * Helper om veilig te vertalen met fallback
 */
export function translate<T extends Record<string, string>>(
  mapping: T, 
  key: string | undefined | null, 
  fallback = "N/A"
): string {
  if (!key) return fallback;
  return mapping[key] || key;
}

/**
 * Build debug info from API response
 */
export function buildDebugInfoFromResponse(
  apiResponse: any,
  fallbackDifficulty: string = "onbewuste_onkunde"
) {
  const persona = apiResponse?.debug?.persona || {};
  const dynamics = apiResponse?.debug?.dynamics || apiResponse?.debug?.customerDynamics;
  const contextData = apiResponse?.contextData || apiResponse?.debug?.contextData || apiResponse?.debug?.contextState?.gathered || {};
  const phase = apiResponse?.debug?.phase || apiResponse?.phase || "CONTEXT_GATHERING";
  
  // During context gathering, show "Wordt bepaald" for buying clock
  const isContextGathering = phase === "CONTEXT_GATHERING" || !persona.buying_clock_stage;
  const buyingClockDisplay = isContextGathering 
    ? "Wordt bepaald..." 
    : translate(buyingClockToDisplay, persona.buying_clock_stage || persona.koopklok, "Onbekend");
  
  return {
    persona: {
      gedragsstijl: translate(behaviorStyleToDisplay, persona.behavior_style, "Analytisch"),
      koopklok: buyingClockDisplay,
      moeilijkheid: translate(difficultyToDisplay, persona.difficulty_level || fallbackDifficulty)
    },
    customerDynamics: dynamics ? {
      rapport: typeof dynamics.rapport === 'number' ? Math.round(dynamics.rapport <= 1 ? dynamics.rapport * 100 : dynamics.rapport) : 50,
      valueTension: typeof dynamics.valueTension === 'number' ? Math.round(dynamics.valueTension <= 1 ? dynamics.valueTension * 100 : dynamics.valueTension) : 50,
      commitReadiness: typeof dynamics.commitReadiness === 'number' ? Math.round(dynamics.commitReadiness <= 1 ? dynamics.commitReadiness * 100 : dynamics.commitReadiness) : 50
    } : { rapport: 50, valueTension: 50, commitReadiness: 50 },
    context: {
      fase: apiResponse?.debug?.context?.fase || parseInt(phase) || 1,
      gathered: {
        sector: contextData.sector || null,
        product: contextData.product || null,
        klantType: contextData.klant_type || contextData.klantType || null,
        verkoopkanaal: contextData.verkoopkanaal || null,
        ervaring: contextData.ervaring || null
      }
    },
    aiDecision: {
      epicFase: apiResponse?.debug?.epicFase || `Fase ${apiResponse?.debug?.context?.fase || 1}`,
      evaluatie: translate(evaluationToDisplay, apiResponse?.debug?.evaluation?.quality || apiResponse?.debug?.evaluation, "neutraal")
    },
    promptsUsed: apiResponse?.debug?.promptsUsed || apiResponse?.promptsUsed || []
  };
}
