import OpenAI from 'openai';
import { TranscriptTurn, TurnEvaluation, CustomerSignalResult, PhaseCoverage } from './analysis-service';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface PhaseTransition {
  turnIdx: number;
  fromPhase: number;
  toPhase: number;
  speaker: 'seller' | 'customer';
}

export interface StructureMetrics {
  phaseFlow: {
    transitions: PhaseTransition[];
    idealFlowScore: number;
    description: string;
  };
  exploreCoverage: {
    themesFound: string[];
    themesMissing: string[];
    coveragePercent: number;
  };
  openingSequence: {
    stepsFound: string[];
    stepsMissing: string[];
    completionPercent: number;
    correctOrder: boolean;
  };
  epicSteps: {
    explore: boolean;
    probe: boolean;
    impact: boolean;
    commit: boolean;
    completionPercent: number;
  };
  overallScore: number;
}

export interface BaatFound {
  turnIdx: number;
  text: string;
  type: 'explicit_baat' | 'voordeel_only' | 'generiek';
  quality: string;
}

export interface OVBCheck {
  turnIdx: number;
  hasOplossing: boolean;
  hasVoordeel: boolean;
  hasBaat: boolean;
  quality: 'volledig' | 'gedeeltelijk' | 'generiek';
  explanation: string;
}

export interface PijnpuntDetail {
  turnIdx: number;
  text: string;
  usedInSolution: boolean;
}

export interface CommitmentDetail {
  summaryGiven: boolean;
  confirmationAsked: boolean;
  turnIdx?: number;
}

export interface ImpactMetrics {
  baatenFound: BaatFound[];
  pijnpuntenFound: number;
  pijnpuntenUsed: number;
  pijnpuntenDetails?: PijnpuntDetail[];
  ovbChecks: OVBCheck[];
  ovbQualityScore: number;
  commitBeforePhase3: boolean;
  commitmentDetail?: CommitmentDetail;
  overallScore: number;
}

export interface HoudingMatch {
  turnIdx: number;
  houding: string;
  phase: number;
  recognized: boolean;
  treated: boolean;
  recommendedTechniques: string[];
  actualTechniques: string[];
}

export interface HoudingenMetrics {
  phase2Recognition: {
    total: number;
    recognized: number;
    percent: number;
  };
  phase3Treatment: {
    total: number;
    treated: number;
    style: 'empathisch' | 'technisch' | 'mixed' | 'geen';
    percent: number;
  };
  phase4Afritten: {
    total: number;
    treated: number;
    percent: number;
  };
  matches: HoudingMatch[];
  overallScore: number;
}

export interface ConversationBalanceMetrics {
  talkRatio: {
    sellerPercent: number;
    customerPercent: number;
    perPhase: Record<number, { seller: number; customer: number }>;
    verdict: 'goed' | 'te_veel_verkoper' | 'te_weinig_verkoper';
  };
  perspective: {
    wijIkCount: number;
    uJijCount: number;
    ratio: number;
    verdict: 'klantgericht' | 'zelfgericht' | 'gemengd';
  };
  questionRatio: {
    questions: number;
    statements: number;
    ratio: number;
    phase2Ratio: number;
  };
  clientLanguage: {
    termsPickedUp: number;
    examples: string[];
  };
  overallScore: number;
}

export interface DetailedMetrics {
  structure: StructureMetrics;
  impact: ImpactMetrics;
  houdingen: HoudingenMetrics;
  balance: ConversationBalanceMetrics;
}

const OPENING_STEPS = [
  { id: '1.1', name: 'Koopklimaat' },
  { id: '1.2', name: "Gentleman's Agreement" },
  { id: '1.3', name: 'Firmavoorstelling (POP)' },
  { id: '1.4', name: 'Instapvraag' },
];

function computePhasePerTurn(evaluations: TurnEvaluation[]): Map<number, number> {
  const phaseMap = new Map<number, number>();
  let currentPhase = 1;

  const allTurnIdxs = [...new Set(evaluations.map(e => e.turnIdx))].sort((a, b) => a - b);

  for (const turnIdx of allTurnIdxs) {
    const eval_ = evaluations.find(e => e.turnIdx === turnIdx);
    if (!eval_) continue;

    for (const tech of eval_.techniques) {
      const phase = parseInt(tech.id.split('.')[0]);
      if (phase > 0 && phase <= 4) {
        currentPhase = phase;
      }
    }
    phaseMap.set(turnIdx, currentPhase);
  }

  return phaseMap;
}

function computeStructureMetrics(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  phaseCoverage: PhaseCoverage
): StructureMetrics {
  const phasePerTurn = computePhasePerTurn(evaluations);
  const transitions: PhaseTransition[] = [];
  let prevPhase = 0;

  const sortedEntries = [...phasePerTurn.entries()].sort((a, b) => a[0] - b[0]);
  for (const [turnIdx, phase] of sortedEntries) {
    if (phase !== prevPhase) {
      const turn = turns.find(t => t.idx === turnIdx);
      transitions.push({
        turnIdx,
        fromPhase: prevPhase,
        toPhase: phase,
        speaker: turn?.speaker || 'seller',
      });
      prevPhase = phase;
    }
  }

  let idealFlowScore = 100;
  let flowDescription = 'Perfecte fasestructuur';

  const phaseSeq = transitions.map(t => t.toPhase);
  
  const hasPhase1 = phaseSeq.includes(1);
  const hasPhase2 = phaseSeq.includes(2);
  const hasPhase3 = phaseSeq.includes(3);
  const hasPhase4 = phaseSeq.includes(4);

  if (!hasPhase2) {
    idealFlowScore -= 40;
    flowDescription = 'Ontdekkingsfase (EPIC) overgeslagen';
  }
  if (!hasPhase1) {
    idealFlowScore -= 15;
  }
  
  for (let i = 1; i < phaseSeq.length; i++) {
    if (phaseSeq[i] > phaseSeq[i - 1] + 1 && phaseSeq[i - 1] !== 0) {
      idealFlowScore -= 10;
    }
  }

  const phase3To2Count = transitions.filter(t => t.fromPhase === 3 && t.toPhase === 2).length;
  if (phase3To2Count > 0) {
    idealFlowScore += Math.min(phase3To2Count * 5, 15);
    flowDescription = `Goede pendel tussen fase 2↔3 (${phase3To2Count}x terug naar ontdekking)`;
  }

  idealFlowScore = Math.max(0, Math.min(100, idealFlowScore));

  if (idealFlowScore >= 80 && flowDescription === 'Perfecte fasestructuur') {
    flowDescription = 'Goede fasestructuur gevolgd';
  } else if (idealFlowScore >= 50) {
    flowDescription = flowDescription || 'Fasestructuur kan beter';
  } else if (idealFlowScore < 50) {
    flowDescription = flowDescription || 'Fasestructuur significant afwijkend';
  }

  const allTechIds = evaluations.flatMap(e => e.techniques.map(t => t.id));
  const stepsFound: string[] = [];
  const stepsMissing: string[] = [];
  const stepOrder: number[] = [];

  for (const step of OPENING_STEPS) {
    if (allTechIds.some(id => id === step.id || id.startsWith(step.id + '.'))) {
      stepsFound.push(step.name);
      const evalWithStep = evaluations.find(e => e.techniques.some(t => t.id === step.id || t.id.startsWith(step.id + '.')));
      if (evalWithStep) stepOrder.push(evalWithStep.turnIdx);
    } else {
      stepsMissing.push(step.name);
    }
  }

  let correctOrder = true;
  for (let i = 1; i < stepOrder.length; i++) {
    if (stepOrder[i] < stepOrder[i - 1]) {
      correctOrder = false;
      break;
    }
  }

  const epicSteps = {
    explore: phaseCoverage.phase2.explore.score > 0,
    probe: phaseCoverage.phase2.probe.found,
    impact: phaseCoverage.phase2.impact.found,
    commit: phaseCoverage.phase2.commit.found,
    completionPercent: 0,
  };
  const epicCount = [epicSteps.explore, epicSteps.probe, epicSteps.impact, epicSteps.commit].filter(Boolean).length;
  epicSteps.completionPercent = Math.round((epicCount / 4) * 100);

  const overallScore = Math.round(
    idealFlowScore * 0.3 +
    phaseCoverage.phase2.explore.score * 0.25 +
    (stepsFound.length / OPENING_STEPS.length) * 100 * 0.2 +
    epicSteps.completionPercent * 0.25
  );

  return {
    phaseFlow: {
      transitions,
      idealFlowScore,
      description: flowDescription,
    },
    exploreCoverage: {
      themesFound: phaseCoverage.phase2.explore.themes,
      themesMissing: phaseCoverage.phase2.explore.missing,
      coveragePercent: phaseCoverage.phase2.explore.score,
    },
    openingSequence: {
      stepsFound,
      stepsMissing,
      completionPercent: Math.round((stepsFound.length / OPENING_STEPS.length) * 100),
      correctOrder,
    },
    epicSteps,
    overallScore: Math.min(100, overallScore),
  };
}

function computeHoudingenMetrics(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[]
): HoudingenMetrics {
  const matches: HoudingMatch[] = [];
  
  const phase2Signals = signals.filter(s => s.currentPhase === 2 && s.houding !== 'neutraal');
  const phase3Signals = signals.filter(s => s.currentPhase === 3 && ['twijfel', 'bezwaar', 'negatief'].includes(s.houding));
  const phase4Signals = signals.filter(s => s.currentPhase === 4 && ['twijfel', 'bezwaar', 'uitstel', 'negatief'].includes(s.houding));

  let phase2Recognized = 0;
  for (const sig of phase2Signals) {
    const nextSellerTurn = turns.find(t => t.idx > sig.turnIdx && t.speaker === 'seller');
    const nextEval = nextSellerTurn ? evaluations.find(e => e.turnIdx === nextSellerTurn.idx) : null;
    const actualTechs = nextEval?.techniques.map(t => t.id) || [];
    const recognized = actualTechs.length > 0;
    if (recognized) phase2Recognized++;

    matches.push({
      turnIdx: sig.turnIdx,
      houding: sig.houding,
      phase: 2,
      recognized,
      treated: recognized,
      recommendedTechniques: sig.recommendedTechniqueIds,
      actualTechniques: actualTechs,
    });
  }

  let phase3Treated = 0;
  let empathyCount = 0;
  let techCount = 0;
  for (const sig of phase3Signals) {
    const nextSellerTurn = turns.find(t => t.idx > sig.turnIdx && t.speaker === 'seller');
    const nextEval = nextSellerTurn ? evaluations.find(e => e.turnIdx === nextSellerTurn.idx) : null;
    const actualTechs = nextEval?.techniques.map(t => t.id) || [];
    
    const treated = actualTechs.some(id => sig.recommendedTechniqueIds.includes(id)) || actualTechs.length > 0;
    if (treated) phase3Treated++;

    if (nextSellerTurn) {
      const lower = nextSellerTurn.text.toLowerCase();
      const hasEmpathy = lower.includes('begrijp') || lower.includes('snap') || lower.includes('terecht') || lower.includes('logisch') || lower.includes('gevoel');
      if (hasEmpathy) empathyCount++;
      else techCount++;
    }

    matches.push({
      turnIdx: sig.turnIdx,
      houding: sig.houding,
      phase: 3,
      recognized: true,
      treated,
      recommendedTechniques: sig.recommendedTechniqueIds,
      actualTechniques: actualTechs,
    });
  }

  let phase4Treated = 0;
  for (const sig of phase4Signals) {
    const nextSellerTurn = turns.find(t => t.idx > sig.turnIdx && t.speaker === 'seller');
    const nextEval = nextSellerTurn ? evaluations.find(e => e.turnIdx === nextSellerTurn.idx) : null;
    const actualTechs = nextEval?.techniques.map(t => t.id) || [];
    const treated = actualTechs.length > 0;
    if (treated) phase4Treated++;

    matches.push({
      turnIdx: sig.turnIdx,
      houding: sig.houding,
      phase: 4,
      recognized: true,
      treated,
      recommendedTechniques: sig.recommendedTechniqueIds,
      actualTechniques: actualTechs,
    });
  }

  const p2Total = phase2Signals.length;
  const p3Total = phase3Signals.length;
  const p4Total = phase4Signals.length;
  
  let treatmentStyle: 'empathisch' | 'technisch' | 'mixed' | 'geen' = 'geen';
  if (empathyCount + techCount > 0) {
    const empathyRatio = empathyCount / (empathyCount + techCount);
    if (empathyRatio >= 0.6) treatmentStyle = 'empathisch';
    else if (empathyRatio <= 0.3) treatmentStyle = 'technisch';
    else treatmentStyle = 'mixed';
  }

  const p2Score = p2Total > 0 ? (phase2Recognized / p2Total) * 100 : 50;
  const p3Score = p3Total > 0 ? (phase3Treated / p3Total) * 100 : 50;
  const p4Score = p4Total > 0 ? (phase4Treated / p4Total) * 100 : 50;
  const overallScore = Math.round(p2Score * 0.3 + p3Score * 0.4 + p4Score * 0.3);

  return {
    phase2Recognition: {
      total: p2Total,
      recognized: phase2Recognized,
      percent: p2Total > 0 ? Math.round((phase2Recognized / p2Total) * 100) : 0,
    },
    phase3Treatment: {
      total: p3Total,
      treated: phase3Treated,
      style: treatmentStyle,
      percent: p3Total > 0 ? Math.round((phase3Treated / p3Total) * 100) : 0,
    },
    phase4Afritten: {
      total: p4Total,
      treated: phase4Treated,
      percent: p4Total > 0 ? Math.round((phase4Treated / p4Total) * 100) : 0,
    },
    matches,
    overallScore: Math.min(100, overallScore),
  };
}

function computeBalanceMetrics(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[]
): ConversationBalanceMetrics {
  const sellerTurns = turns.filter(t => t.speaker === 'seller');
  const customerTurns = turns.filter(t => t.speaker === 'customer');
  
  const sellerChars = sellerTurns.reduce((sum, t) => sum + t.text.length, 0);
  const customerChars = customerTurns.reduce((sum, t) => sum + t.text.length, 0);
  const totalChars = sellerChars + customerChars || 1;
  
  const sellerPercent = Math.round((sellerChars / totalChars) * 100);
  const customerPercent = 100 - sellerPercent;

  const phasePerTurn = computePhasePerTurn(evaluations);
  const perPhase: Record<number, { seller: number; customer: number }> = {};
  
  for (const turn of turns) {
    const phase = phasePerTurn.get(turn.idx) || 1;
    if (!perPhase[phase]) perPhase[phase] = { seller: 0, customer: 0 };
    perPhase[phase][turn.speaker] += turn.text.length;
  }
  
  for (const phase of Object.keys(perPhase)) {
    const p = perPhase[parseInt(phase)];
    const total = p.seller + p.customer || 1;
    p.seller = Math.round((p.seller / total) * 100);
    p.customer = 100 - p.seller;
  }

  let talkVerdict: 'goed' | 'te_veel_verkoper' | 'te_weinig_verkoper' = 'goed';
  if (sellerPercent > 65) talkVerdict = 'te_veel_verkoper';
  else if (sellerPercent < 30) talkVerdict = 'te_weinig_verkoper';

  const wijIkRegex = /\b(wij|ons|onze|ik|mij|mijn|we)\b/gi;
  const uJijRegex = /\b(u|uw|jij|jou|jouw|jullie|je)\b/gi;
  
  const sellerText = sellerTurns.map(t => t.text).join(' ');
  const wijIkMatches = sellerText.match(wijIkRegex) || [];
  const uJijMatches = sellerText.match(uJijRegex) || [];
  
  const wijIkCount = wijIkMatches.length;
  const uJijCount = uJijMatches.length;
  const perspectiveRatio = uJijCount / (wijIkCount || 1);
  
  let perspectiveVerdict: 'klantgericht' | 'zelfgericht' | 'gemengd' = 'gemengd';
  if (perspectiveRatio >= 1.5) perspectiveVerdict = 'klantgericht';
  else if (perspectiveRatio < 0.8) perspectiveVerdict = 'zelfgericht';

  const questionRegex = /\?/g;
  let totalQuestions = 0;
  let totalStatements = 0;
  let phase2Questions = 0;
  let phase2Statements = 0;

  for (const turn of sellerTurns) {
    const questions = (turn.text.match(questionRegex) || []).length;
    const sentences = turn.text.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
    const statements = Math.max(0, sentences - questions);
    
    totalQuestions += questions;
    totalStatements += statements;
    
    const phase = phasePerTurn.get(turn.idx) || 1;
    if (phase === 2) {
      phase2Questions += questions;
      phase2Statements += statements;
    }
  }

  const questionRatio = totalQuestions / (totalQuestions + totalStatements || 1);
  const phase2Ratio = phase2Questions / (phase2Questions + phase2Statements || 1);

  const customerWords = new Set<string>();
  for (const ct of customerTurns) {
    const words = ct.text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    words.forEach(w => customerWords.add(w));
  }

  const commonWordsList = [
    'hebben', 'worden', 'zouden', 'kunnen', 'moeten', 'willen',
    'gaan', 'doen', 'maken', 'zeggen', 'komen', 'staan',
    'denken', 'weten', 'vinden', 'laten', 'geven', 'nemen',
    'houden', 'zitten', 'liggen', 'lopen', 'brengen', 'zoeken',
    'schrijven', 'lezen', 'spreken', 'spelen', 'werken', 'wonen',
    'leven', 'reizen', 'kopen', 'verkopen', 'betalen', 'verdienen',
    'beginnen', 'stoppen', 'proberen', 'helpen', 'nodig',
    'eigenlijk', 'natuurlijk', 'misschien', 'gewoon', 'echt',
    'helemaal', 'precies', 'inderdaad', 'wellicht', 'altijd',
    'nooit', 'soms', 'vaak', 'heel', 'zeer', 'best', 'goed',
    'groot', 'klein', 'lang', 'kort', 'mooi', 'nieuw', 'andere',
    'eigen', 'zelf', 'niet', 'maar', 'want', 'omdat', 'deze',
    'waar', 'wanneer', 'waarom', 'welke', 'hoeveel',
  ];
  const commonWords = new Set(commonWordsList);

  const meaningfulCustomerWords = [...customerWords].filter(w => !commonWords.has(w));

  const pickedUpExamples: string[] = [];
  let termsPickedUp = 0;

  for (const word of meaningfulCustomerWords) {
    const sellerUsed = sellerTurns.some(st => {
      const customerBefore = customerTurns.filter(ct => ct.idx < st.idx);
      const customerUsedWord = customerBefore.some(ct => ct.text.toLowerCase().includes(word));
      return customerUsedWord && st.text.toLowerCase().includes(word);
    });
    
    if (sellerUsed) {
      termsPickedUp++;
      if (pickedUpExamples.length < 5) pickedUpExamples.push(word);
    }
  }

  const talkScore = talkVerdict === 'goed' ? 100 : (talkVerdict === 'te_veel_verkoper' ? Math.max(0, 100 - (sellerPercent - 55) * 3) : 50);
  const perspScore = perspectiveVerdict === 'klantgericht' ? 100 : perspectiveVerdict === 'gemengd' ? 60 : 30;
  const qScore = Math.min(100, Math.round(phase2Ratio * 150));
  const langScore = Math.min(100, termsPickedUp * 20);
  
  const overallScore = Math.round(talkScore * 0.3 + perspScore * 0.25 + qScore * 0.25 + langScore * 0.2);

  return {
    talkRatio: {
      sellerPercent,
      customerPercent,
      perPhase,
      verdict: talkVerdict,
    },
    perspective: {
      wijIkCount,
      uJijCount,
      ratio: Math.round(perspectiveRatio * 100) / 100,
      verdict: perspectiveVerdict,
    },
    questionRatio: {
      questions: totalQuestions,
      statements: totalStatements,
      ratio: Math.round(questionRatio * 100) / 100,
      phase2Ratio: Math.round(phase2Ratio * 100) / 100,
    },
    clientLanguage: {
      termsPickedUp,
      examples: pickedUpExamples,
    },
    overallScore: Math.min(100, overallScore),
  };
}

async function computeImpactMetrics(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  phaseCoverage: PhaseCoverage
): Promise<ImpactMetrics> {
  const allTechIds = evaluations.flatMap(e => e.techniques.map(t => t.id));
  const commitResult = (() => {
    const commitEval = evaluations.find(e => e.techniques.some(t => t.id.startsWith('2.4')));
    const phase3Eval = evaluations.find(e => e.techniques.some(t => t.id.startsWith('3.')));
    const summaryEval = evaluations.find(e => e.techniques.some(t => t.id === '2.4.1' || t.id === '2.4.2'));
    const confirmEval = evaluations.find(e => e.techniques.some(t => t.id === '2.4.3' || t.id === '2.4.4'));
    const beforePhase3 = (commitEval && phase3Eval) ? commitEval.turnIdx < phase3Eval.turnIdx : false;
    return {
      commitBeforePhase3: beforePhase3,
      commitmentDetail: {
        summaryGiven: !!summaryEval,
        confirmationAsked: !!confirmEval,
        turnIdx: commitEval?.turnIdx,
      }
    };
  })();
  const commitBeforePhase3 = commitResult.commitBeforePhase3;
  const commitmentDetail = commitResult.commitmentDetail;

  const phasePerTurn = computePhasePerTurn(evaluations);
  
  const phase2SellerTurns = turns.filter(t => t.speaker === 'seller' && (phasePerTurn.get(t.idx) === 2 || phasePerTurn.get(t.idx) === 3));
  const relevantText = phase2SellerTurns.map(t => `[Turn ${t.idx}] ${t.text}`).join('\n');

  let baatenFound: BaatFound[] = [];
  let ovbChecks: OVBCheck[] = [];
  let pijnpuntenFound = 0;
  let pijnpuntenUsed = 0;
  let pijnpuntenDetails: PijnpuntDetail[] = [];

  if (relevantText.length > 50) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: `Je bent een EPIC-verkoopcoach die gesprekken analyseert. Analyseer de seller turns uit fase 2 en 3.

DEFINITIES:
- BAAT = persoonlijke impact voor de klant (wat het voor HEM/HAAR concreet betekent in het dagelijks leven/werk)
- VOORDEEL = eigenschap/feature van het product/dienst (wat het product doet)
- PIJNPUNT = probleem, frustratie of risico dat de klant noemt of ervaart
- O.V.B. = Oplossing → Voordeel → Baat (de vertaalslag van product naar klantimpact)

Analyseer en geef JSON:
{
  "baaten": [
    {"turnIdx": 12, "text": "de baat die genoemd is", "type": "explicit_baat|voordeel_only|generiek", "quality": "uitleg"}
  ],
  "pijnpunten_found": 2,
  "pijnpunten_used": 1,
  "pijnpunten_details": [
    {"turnIdx": 8, "text": "korte beschrijving van het pijnpunt", "usedInSolution": false}
  ],
  "ovb_checks": [
    {"turnIdx": 30, "hasOplossing": true, "hasVoordeel": true, "hasBaat": false, "quality": "gedeeltelijk", "explanation": "Noemt oplossing en voordeel maar geen persoonlijke baat"}
  ]
}

Let op:
- "type": "explicit_baat" = verkoper maakt het persoonlijk ("dat betekent voor u dat...")
- "type": "voordeel_only" = verkoper noemt alleen productvoordeel zonder persoonlijke vertaling
- "type": "generiek" = vage uitspraken ("wij leveren kwaliteit")
- OVB check alleen op fase 3 turns waar de verkoper een aanbeveling doet`
          },
          {
            role: 'user',
            content: `Analyseer deze seller turns:\n\n${relevantText.substring(0, 4000)}`
          }
        ],
        max_completion_tokens: 800,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content?.trim() || '{}';
      try {
        const parsed = JSON.parse(content);
        baatenFound = (parsed.baaten || []).map((b: any) => ({
          turnIdx: b.turnIdx || 0,
          text: b.text || '',
          type: b.type || 'generiek',
          quality: b.quality || '',
        }));
        pijnpuntenFound = parsed.pijnpunten_found || 0;
        pijnpuntenUsed = parsed.pijnpunten_used || 0;
        pijnpuntenDetails = (parsed.pijnpunten_details || []).map((p: any) => ({
          turnIdx: p.turnIdx || 0,
          text: p.text || '',
          usedInSolution: p.usedInSolution || false,
        }));
        ovbChecks = (parsed.ovb_checks || []).map((o: any) => ({
          turnIdx: o.turnIdx || 0,
          hasOplossing: o.hasOplossing || false,
          hasVoordeel: o.hasVoordeel || false,
          hasBaat: o.hasBaat || false,
          quality: o.quality || 'generiek',
          explanation: o.explanation || '',
        }));
      } catch {}
    } catch (err) {
      console.warn('[DetailedMetrics] Impact AI analysis failed:', err);
    }
  }

  const explicitBaaten = baatenFound.filter(b => b.type === 'explicit_baat').length;
  const baatScore = Math.min(100, explicitBaaten * 30 + baatenFound.filter(b => b.type === 'voordeel_only').length * 10);
  
  const ovbComplete = ovbChecks.filter(o => o.quality === 'volledig').length;
  const ovbPartial = ovbChecks.filter(o => o.quality === 'gedeeltelijk').length;
  const ovbTotal = ovbChecks.length || 1;
  const ovbQualityScore = Math.round(((ovbComplete * 100 + ovbPartial * 50) / ovbTotal));
  
  const commitScore = commitBeforePhase3 ? 100 : 0;
  const pijnScore = pijnpuntenFound > 0 ? (pijnpuntenUsed > 0 ? 100 : 40) : 0;

  const overallScore = Math.round(
    baatScore * 0.35 +
    Math.min(100, ovbQualityScore) * 0.30 +
    commitScore * 0.15 +
    pijnScore * 0.20
  );

  return {
    baatenFound,
    pijnpuntenFound,
    pijnpuntenUsed,
    pijnpuntenDetails: pijnpuntenDetails.length > 0 ? pijnpuntenDetails : undefined,
    ovbChecks,
    ovbQualityScore: Math.min(100, ovbQualityScore),
    commitBeforePhase3,
    commitmentDetail,
    overallScore: Math.min(100, overallScore),
  };
}

export async function computeDetailedMetrics(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[],
  phaseCoverage: PhaseCoverage
): Promise<DetailedMetrics> {
  console.log('[DetailedMetrics] Computing detailed analysis metrics...');
  
  const structure = computeStructureMetrics(turns, evaluations, phaseCoverage);
  const houdingen = computeHoudingenMetrics(turns, evaluations, signals);
  const balance = computeBalanceMetrics(turns, evaluations);
  const impact = await computeImpactMetrics(turns, evaluations, phaseCoverage);

  console.log(`[DetailedMetrics] Complete - Structure: ${structure.overallScore}%, Impact: ${impact.overallScore}%, Houdingen: ${houdingen.overallScore}%, Balance: ${balance.overallScore}%`);

  return { structure, impact, houdingen, balance };
}
