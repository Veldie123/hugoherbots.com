// Klant Houdingen - Detection Overlay voor Customer Attitudes
// Dit bestand bevat ALLEEN detection metadata voor klanthoudingen
// Alle techniek-gerelateerde content zit in technieken_index.json

export const KLANT_HOUDINGEN = {
  _meta: {
    version: "2.1",
    type: "detection_overlay",
    ssot_note: "Dit bestand bevat ALLEEN detection metadata voor klanthoudingen. Alle techniek-gerelateerde content (beschrijving, stappenplan, wanneer) zit in config/ssot/technieken_index.json en wordt opgehaald via ssot-loader.ts.",
    allowed_fields: ["id", "naam", "houding_beschrijving", "fase_restrictie", "semantic_markers", "recommended_technique_ids", "generation_examples", "fallback_response"],
    forbidden_fields: ["techniek_reactie", "stappenplan", "waarom", "techniek_nummer", "actie", "beschrijving van technieken"],
    changelog: "v2.1: Toegevoegd generation_examples voor AI klant generatie. v2.0: BREAKING - Gestript tot pure detection overlay.",
    detection_note: "semantic_markers worden gebruikt door AI-based classifier. generation_examples worden gebruikt door customer_engine.ts om contextgevoelige responses te genereren."
  },

  houdingen: {
    positief: {
      id: "H1",
      naam: "Positief antwoord",
      houding_beschrijving: "Klant reageert positief t.o.v. onze oplossing (niet generiek 'ja')",
      fase_restrictie: {
        allowed_phases: [1, 2, 3, 4],
        allowed_at_any_phase: true
      },
      semantic_markers: ["agreement", "enthusiasm", "confirmation", "interest_in_solution"],
      recommended_technique_ids: ["2.4", "2.1.2", "2.1.6"],
      fallback_response: "Dat past wel bij wat we zoeken, ja.",
      generation_examples_note: "Dit zijn antwoorden op VRAGEN van de verkoper (budget, timing, ervaring, etc.), niet reacties op uitleg",
      generation_examples: [
        "[budget] 500.000 euro, dat hebben we beschikbaar",
        "[timing] Liefst binnen 3 maanden, we zijn er klaar voor",
        "[ervaring] We hebben eerder al geïnvesteerd en dat beviel goed",
        "[bron] Via jullie website, die zag er professioneel uit"
      ]
    },

    negatief: {
      id: "H2",
      naam: "Negatief antwoord",
      houding_beschrijving: "Klant geeft een antwoord dat niet past bij onze oplossing (te laag budget, verkeerde verwachtingen, niet-passende situatie)",
      fase_restrictie: {
        allowed_phases: [1, 2, 3, 4],
        allowed_at_any_phase: true
      },
      semantic_markers: ["rejection", "disagreement", "refusal", "wrong_expectations", "misalignment", "insufficient_fit"],
      recommended_technique_ids: ["2.1.4", "2.2"],
      fallback_response: "Wij hadden eigenlijk iets heel anders in gedachten.",
      generation_examples_note: "Antwoorden die niet passen bij onze oplossing - ZONDER letterlijk 'nee' te zeggen",
      generation_examples: [
        "[budget] 50.000 euro (terwijl minimum 200.000 is)",
        "[timing] Misschien over 2 jaar (terwijl we nu leveren)",
        "[verwachting] Ik las dat jullie 20% rendement garanderen (terwijl het 3% is)",
        "[ervaring] We hebben een slechte ervaring gehad met iets vergelijkbaars",
        "[bron] Iemand zei dat jullie de goedkoopste zijn (terwijl we premium zijn)"
      ]
    },

    vaag: {
      id: "H3",
      naam: "Vaag antwoord",
      houding_beschrijving: "Klant geeft geen concreet antwoord op de vraag",
      fase_restrictie: {
        allowed_phases: [1, 2, 3, 4],
        allowed_at_any_phase: true
      },
      semantic_markers: ["vagueness", "noncommittal", "ambivalence", "hedging"],
      recommended_technique_ids: ["2.1.3"],
      fallback_response: "Tja, dat hangt ervan af hoe je het bekijkt.",
      generation_examples_note: "Antwoorden zonder concrete informatie",
      generation_examples: [
        "[budget] Goh, goede vraag... ik zou het niet zo kunnen zeggen",
        "[timing] Tja, wanneer het zover is",
        "[ervaring] We hebben wat dingen gedaan, ja",
        "[bron] Ach, via via eigenlijk"
      ]
    },

    ontwijkend: {
      id: "H4",
      naam: "Ontwijkend antwoord",
      houding_beschrijving: "Klant beantwoordt de vraag niet echt, wijkt uit naar iets anders",
      fase_restrictie: {
        allowed_phases: [1, 2, 3, 4],
        allowed_at_any_phase: true
      },
      semantic_markers: ["evasion", "ambiguity", "deflection", "unclear_stance"],
      recommended_technique_ids: ["2.1.5"],
      fallback_response: "Laten we het eerst over iets anders hebben.",
      generation_examples_note: "Klant geeft geen antwoord maar wijkt uit",
      generation_examples: [
        "[budget] Dat hangt ervan af wat jullie aanbieden",
        "[timing] Eerst wil ik weten wat het precies inhoudt",
        "[ervaring] Daar hebben we het later nog wel over",
        "[bron] Is dat relevant?"
      ]
    },

    vraag: {
      id: "H5",
      naam: "Vraag",
      houding_beschrijving: "Klant beantwoordt eerst de vraag en stelt daarna een terugvraag",
      fase_restrictie: {
        allowed_phases: [1, 2, 3, 4],
        allowed_at_any_phase: true
      },
      semantic_markers: ["question", "information_request", "clarification"],
      recommended_technique_ids: ["4.2.1"],
      fallback_response: "Goed punt. Maar hoe zit dat bij jullie precies?",
      generation_examples_note: "Antwoord + tegenvraag",
      generation_examples: [
        "[bron] Via een collega. Maar hoe werkt dat precies bij jullie?",
        "[budget] Goede vraag: wat is jullie minimum eigenlijk?",
        "[timing] Hoe rapper hoe liever. Hoe snel kan dat bij jullie?"
      ]
    },

    twijfel: {
      id: "H6",
      naam: "Twijfel",
      houding_beschrijving: "Klant twijfelt na aanbod/afsluiting, is onzeker over de beslissing",
      fase_restrictie: {
        allowed_phases: [3, 4],
        allowed_at_any_phase: false,
        trigger_techniques: ["3.5"]
      },
      semantic_markers: ["hesitation", "doubt", "uncertainty"],
      recommended_technique_ids: ["4.2.2"],
      fallback_response: "Klinkt goed op papier, maar ik ben er nog niet helemaal uit.",
      generation_examples_note: "Reacties na aanbod in fase 3/4 - twijfel over de beslissing",
      generation_examples: [
        "Hmm, ik weet het niet... het is wel een grote stap",
        "Klinkt goed, maar ik ben er nog niet helemaal uit",
        "Laat me er even over nadenken"
      ]
    },

    bezwaar: {
      id: "H7",
      naam: "Bezwaar",
      houding_beschrijving: "Klant heeft een concreet bezwaar tegen het aanbod",
      fase_restrictie: {
        allowed_phases: [3, 4],
        allowed_at_any_phase: false,
        trigger_techniques: ["3.5"]
      },
      semantic_markers: ["objection", "counterargument", "resistance"],
      recommended_technique_ids: ["4.2.4"],
      fallback_response: "Jullie concurrent bood ons laatst iets vergelijkbaars voor minder.",
      generation_examples_note: "Concrete bezwaren tegen het aanbod",
      generation_examples: [
        "Ja maar, jullie concurrent biedt hetzelfde voor minder",
        "Die levertijd is te lang voor ons",
        "Die prijs past niet in ons budget"
      ]
    },

    uitstel: {
      id: "H8",
      naam: "Uitstel",
      houding_beschrijving: "Klant wil de beslissing uitstellen",
      fase_restrictie: {
        allowed_phases: [3, 4],
        allowed_at_any_phase: false,
        trigger_techniques: ["3.5"]
      },
      semantic_markers: ["postponement", "delay", "deferral"],
      recommended_technique_ids: ["4.2.3"],
      fallback_response: "Ik moet dit eerst intern bespreken met mijn partner.",
      generation_examples_note: "Klant wil nu niet beslissen",
      generation_examples: [
        "Ik moet dit eerst met mijn partner bespreken",
        "Kan ik volgende week terugkomen?",
        "We zijn er nu nog niet klaar voor"
      ]
    },

    angst: {
      id: "H9",
      naam: "Angst / Bezorgdheid",
      houding_beschrijving: "Klant is bang om te beslissen, emotionele blokkade",
      fase_restrictie: {
        allowed_phases: [3, 4],
        allowed_at_any_phase: false,
        trigger_techniques: ["3.5"]
      },
      semantic_markers: ["fear", "anxiety", "concern", "risk_aversion"],
      recommended_technique_ids: ["4.2.5"],
      fallback_response: "Het is zo'n grote investering... wat als het niet uitpakt zoals verwacht?",
      generation_examples_note: "Angst en bezorgdheid over risico",
      generation_examples: [
        "Wat als het misgaat?",
        "Het is zo'n grote investering, stel dat...",
        "Ik ben bang dat we er spijt van krijgen"
      ]
    }
  },

  detection_config: {
    method: "ai_semantic",
    note: "Detection via AI classifier die context begrijpt (seller vraag + klant antwoord → attitude t.o.v. oplossing). Geen regex patterns - die zijn te generiek.",
    priority_order: [
      "bezwaar", "angst", "uitstel", "twijfel",
      "ontwijkend", "vraag", "negatief", "vaag", "positief"
    ],
    priority_note: "Bezwaar/angst/uitstel/twijfel vereisen actieve behandeling. Ontwijkend voor vraag zodat eerst duidelijkheid gezocht wordt."
  }
} as const;

export default KLANT_HOUDINGEN;
