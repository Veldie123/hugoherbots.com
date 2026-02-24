import OpenAI from 'openai';
import { getTechnique, loadMergedTechniques } from '../ssot-loader';
import { getExpectedMoves, evaluateConceptually, evaluateFirstTurn } from './evaluator';
import { CustomerSignal, EpicPhase } from './customer_engine';
import { supabase } from '../supabase-client';
import { pool } from '../db';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { computeDetailedMetrics, DetailedMetrics } from './detailed-metrics';
import { buildSSOTContextForEvaluation, findRelevantVideos, VideoRecommendation, buildVideoRecommendationsForMoments } from './ssot-context-builder';
import { searchRag } from './rag-service';

const MIN_SELLER_TURNS_FOR_ANALYSIS = 4;

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const openaiDirect = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ConversationAnalysis {
  id: string;
  userId: string;
  title: string;
  type: 'upload' | 'live';
  status: 'uploading' | 'transcribing' | 'analyzing' | 'evaluating' | 'generating_report' | 'completed' | 'failed';
  consentConfirmed: boolean;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface TranscriptTurn {
  idx: number;
  startMs: number;
  endMs: number;
  speaker: 'seller' | 'customer';
  text: string;
}

export interface TurnEvaluation {
  turnIdx: number;
  techniques: Array<{
    id: string;
    naam: string;
    quality: 'perfect' | 'goed' | 'bijna' | 'gemist';
    score: number;
    stappen_gevolgd?: string[];
  }>;
  overallQuality: string;
  rationale: string;
}

export interface CustomerSignalResult {
  turnIdx: number;
  houding: 'vraag' | 'twijfel' | 'bezwaar' | 'uitstel' | 'interesse' | 'akkoord' | 'neutraal' | 'negatief' | 'vaag' | 'ontwijkend';
  confidence: number;
  recommendedTechniqueIds: string[];
  currentPhase: number;
}

export interface PhaseScore {
  score: number;
  techniquesFound: Array<{ id: string; naam: string; quality: string; count: number }>;
  totalPossible: number;
}

export interface PhaseCoverage {
  phase1: PhaseScore;
  phase2: {
    overall: PhaseScore;
    explore: { score: number; themes: string[]; missing: string[] };
    probe: { score: number; found: boolean; examples: string[] };
    impact: { score: number; found: boolean; examples: string[] };
    commit: { score: number; found: boolean; examples: string[] };
  };
  phase3: PhaseScore;
  phase4: PhaseScore;
  overall: number;
}

export interface MissedOpportunity {
  turnIdx: number;
  type: 'twijfel_niet_uitgepakt' | 'bezwaar_overgeslagen' | 'baat_niet_gemaakt' | 'te_vroeg_fase_3_4' | 'probe_gemist' | 'impact_gemist' | 'commit_gemist';
  description: string;
  sellerSaid: string;
  customerSaid: string;
  betterQuestion: string;
}

export interface CoachMoment {
  id: string;
  timestamp: string;
  turnIndex: number;
  phase: number;
  label: string;
  type: 'big_win' | 'quick_fix' | 'turning_point';
  customerSignal?: string;
  sellerText: string;
  customerText: string;
  whyItMatters: string;
  betterAlternative: string;
  recommendedTechniques: string[];
  videoRecommendations?: VideoRecommendation[];
  replay: {
    startTurnIndex: number;
    contextTurns: number;
  };
}

export interface CoachDebriefMessage {
  type: 'coach_text' | 'moment_ref' | 'scoreboard';
  text?: string;
  momentId?: string;
  cta?: string[];
}

export interface CoachDebrief {
  oneliner: string;
  epicMomentum: string;
  messages: CoachDebriefMessage[];
}

export interface AnalysisInsights {
  phaseCoverage: PhaseCoverage;
  missedOpportunities: MissedOpportunity[];
  summaryMarkdown: string;
  strengths: Array<{ text: string; quote: string; turnIdx: number }>;
  improvements: Array<{ text: string; quote: string; turnIdx: number; betterApproach: string }>;
  microExperiments: string[];
  overallScore: number;
  coachDebrief?: CoachDebrief;
  moments?: CoachMoment[];
  detailedMetrics?: DetailedMetrics;
}

export interface FullAnalysisResult {
  conversation: ConversationAnalysis;
  transcript: TranscriptTurn[];
  evaluations: TurnEvaluation[];
  signals: CustomerSignalResult[];
  insights: AnalysisInsights;
  insufficientTurns?: boolean;
}

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

const analysisJobs = new Map<string, ConversationAnalysis>();
const analysisResults = new Map<string, FullAnalysisResult>();

const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads');

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function uploadAndStore(
  file: Buffer,
  filename: string,
  mimeType: string,
  userId: string
): Promise<string> {
  ensureUploadDir();

  const ext = filename.split('.').pop() || 'wav';
  const storageKey = `${userId}_${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, storageKey);

  fs.writeFileSync(filePath, file);
  console.log(`[Analysis] File saved: ${filePath} (${(file.length / 1024 / 1024).toFixed(1)} MB)`);

  return storageKey;
}

export async function transcribeAudio(storageKey: string): Promise<WhisperSegment[]> {
  const filePath = path.join(UPLOAD_DIR, storageKey);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Bestand niet gevonden: ${storageKey}`);
  }

  const buffer = fs.readFileSync(filePath);
  const ext = storageKey.split('.').pop() || 'wav';
  const file = new File([buffer], `audio.${ext}`, { type: `audio/${ext}` });

  const response = await openaiDirect.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
    language: 'nl',
  });

  const segments: WhisperSegment[] = ((response as any).segments || []).map((seg: any) => ({
    id: seg.id,
    start: seg.start,
    end: seg.end,
    text: (seg.text || '').trim(),
  }));

  return segments;
}

export async function buildTurns(segments: WhisperSegment[]): Promise<TranscriptTurn[]> {
  if (segments.length === 0) return [];

  const GAP_THRESHOLD_S = 1.2;
  const preGroups: Array<{ indices: number[]; texts: string[]; start: number; end: number }> = [];
  let currentGroup: { indices: number[]; texts: string[]; start: number; end: number } | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!currentGroup) {
      currentGroup = { indices: [i], texts: [seg.text], start: seg.start, end: seg.end };
    } else {
      const gap = seg.start - currentGroup.end;
      if (gap > GAP_THRESHOLD_S) {
        preGroups.push(currentGroup);
        currentGroup = { indices: [i], texts: [seg.text], start: seg.start, end: seg.end };
      } else {
        currentGroup.indices.push(i);
        currentGroup.texts.push(seg.text);
        currentGroup.end = seg.end;
      }
    }
  }
  if (currentGroup) preGroups.push(currentGroup);

  console.log(`[Diarization] Pre-grouped ${segments.length} segments into ${preGroups.length} groups by timing gaps (>${GAP_THRESHOLD_S}s)`);

  const groupLines = preGroups.map((g, i) => {
    const timeLabel = `[${Math.floor(g.start / 60)}:${String(Math.floor(g.start % 60)).padStart(2, '0')}]`;
    return `[G${i}] ${timeLabel} ${g.texts.join(' ')}`;
  }).join('\n');

  const CHUNK_SIZE = 120;
  const allGroupLabels: Array<{ gIdx: number; speaker: 'seller' | 'customer' }> = [];

  for (let chunkStart = 0; chunkStart < preGroups.length; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, preGroups.length);
    const chunkLines = preGroups.slice(chunkStart, chunkEnd).map((g, i) => {
      const gIdx = chunkStart + i;
      const timeLabel = `[${Math.floor(g.start / 60)}:${String(Math.floor(g.start % 60)).padStart(2, '0')}]`;
      return `[G${gIdx}] ${timeLabel} ${g.texts.join(' ')}`;
    }).join('\n');

    let prevTranscript = '';
    if (chunkStart > 0) {
      const prevLabeled = allGroupLabels.slice(-15);
      prevTranscript = '\nVoorgaande context (laatste 15 groepen):\n' + prevLabeled.map(l => {
        const g = preGroups[l.gIdx];
        return `[G${l.gIdx}] ${l.speaker === 'seller' ? 'VERKOPER' : 'KLANT'}: ${g.texts.join(' ').substring(0, 80)}`;
      }).join('\n');
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: `Je bent een expert in speaker diarization van verkoopgesprekken. Je ontvangt een transcript opgedeeld in groepen (G0, G1, ...) op basis van stiltes. Elke groep is waarschijnlijk van DEZELFDE spreker.

TAAK: Bepaal per groep of het de Verkoper (V) of Klant (K) is.

REGELS:
1. Een verkoopgesprek wisselt typisch af: V-K-V-K. Eén spreker praat zelden 5+ groepen achter elkaar.
2. De VERKOPER opent het gesprek, stelt vragen, presenteert oplossingen, stuurt het gesprek.
3. De KLANT beschrijft zijn situatie, beantwoordt vragen, geeft bezwaren, stelt vragen over het aanbod.
4. Na een vraag komt typisch een antwoord van de ANDERE spreker.
5. Korte bevestigingen ("ja", "nee", "oké") na een vraag = de ANDERE spreker.
6. Let op voornaamwoorden: "wij bieden aan", "ons product" = verkoper. "Ik zoek", "wij hebben het probleem" = klant.
7. De eerste groep is BIJNA ALTIJD de verkoper (die opent het gesprek).
8. Wees CONSERVATIEF met speaker-wissels. Kies alleen een wissel als de inhoud duidelijk wijst op een andere spreker.

Antwoord als JSON: {"labels": [{"g": 0, "s": "V"}, {"g": 1, "s": "K"}, ...]}
Geef ELKE groep index terug.`
          },
          {
            role: 'user',
            content: `Label elke groep als V (Verkoper) of K (Klant):${prevTranscript}

TE LABELEN GROEPEN:
${chunkLines}`
          }
        ],
        temperature: 0.05,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error('[Diarization] Failed to parse AI response for chunk', chunkStart);
        for (let i = chunkStart; i < chunkEnd; i++) {
          const prevSpeaker = allGroupLabels.length > 0 ? allGroupLabels[allGroupLabels.length - 1].speaker : 'seller';
          allGroupLabels.push({ gIdx: i, speaker: prevSpeaker });
        }
        continue;
      }

      const labels = Array.isArray(parsed) ? parsed : (parsed.labels || parsed.result || Object.values(parsed).find(Array.isArray) || []);

      const labelMap = new Map<number, 'seller' | 'customer'>();
      for (const item of labels) {
        const gIdx = typeof item.g === 'number' ? item.g : (typeof item.idx === 'number' ? item.idx : parseInt(item.g || item.idx));
        const speaker = (item.s === 'V' || item.speaker === 'V') ? 'seller' : 'customer';
        labelMap.set(gIdx, speaker);
      }

      for (let i = chunkStart; i < chunkEnd; i++) {
        const speaker = labelMap.get(i) || (allGroupLabels.length > 0 ? allGroupLabels[allGroupLabels.length - 1].speaker : 'seller');
        allGroupLabels.push({ gIdx: i, speaker });
      }

    } catch (err) {
      console.error('[Diarization] AI call failed for chunk', chunkStart, err);
      for (let i = chunkStart; i < chunkEnd; i++) {
        const prevSpeaker = allGroupLabels.length > 0 ? allGroupLabels[allGroupLabels.length - 1].speaker : 'seller';
        allGroupLabels.push({ gIdx: i, speaker: prevSpeaker });
      }
    }
  }

  const smoothedLabels = [...allGroupLabels];
  for (let i = 1; i < smoothedLabels.length - 1; i++) {
    const prev = smoothedLabels[i - 1].speaker;
    const curr = smoothedLabels[i].speaker;
    const next = smoothedLabels[i + 1].speaker;
    const groupTextLen = preGroups[i].texts.join(' ').length;

    if (curr !== prev && curr !== next && groupTextLen < 60) {
      console.log(`[Diarization] Smoothing: G${i} "${preGroups[i].texts.join(' ').substring(0, 40)}..." flipped ${curr} → ${prev} (isolated short group)`);
      smoothedLabels[i] = { ...smoothedLabels[i], speaker: prev };
    }
  }

  const sellerCount = smoothedLabels.filter(l => l.speaker === 'seller').length;
  const customerCount = smoothedLabels.filter(l => l.speaker === 'customer').length;
  console.log(`[Diarization] Final: ${smoothedLabels.length} groups labeled. Seller: ${sellerCount}, Customer: ${customerCount}`);

  if (customerCount === 0 && smoothedLabels.length > 3) {
    console.log('[Diarization] WARNING: No customer detected — falling back to alternating pattern');
    for (let i = 0; i < smoothedLabels.length; i++) {
      smoothedLabels[i] = { ...smoothedLabels[i], speaker: i % 2 === 0 ? 'seller' : 'customer' };
    }
  }

  const turns: TranscriptTurn[] = [];
  let currentTurn: { speaker: 'seller' | 'customer'; texts: string[]; startMs: number; endMs: number } | null = null;

  for (let i = 0; i < smoothedLabels.length; i++) {
    const label = smoothedLabels[i];
    const group = preGroups[label.gIdx];

    if (!currentTurn || currentTurn.speaker !== label.speaker) {
      if (currentTurn) {
        turns.push({
          idx: turns.length,
          startMs: Math.round(currentTurn.startMs * 1000),
          endMs: Math.round(currentTurn.endMs * 1000),
          speaker: currentTurn.speaker,
          text: currentTurn.texts.join(' '),
        });
      }
      currentTurn = {
        speaker: label.speaker,
        texts: [...group.texts],
        startMs: group.start,
        endMs: group.end,
      };
    } else {
      currentTurn.texts.push(...group.texts);
      currentTurn.endMs = group.end;
    }
  }

  if (currentTurn) {
    turns.push({
      idx: turns.length,
      startMs: Math.round(currentTurn.startMs * 1000),
      endMs: Math.round(currentTurn.endMs * 1000),
      speaker: currentTurn.speaker,
      text: currentTurn.texts.join(' '),
    });
  }

  console.log(`[Diarization] Result: ${turns.length} conversation turns (${turns.filter(t => t.speaker === 'seller').length} seller, ${turns.filter(t => t.speaker === 'customer').length} customer)`);
  return turns;
}

function mapHoudingToCustomerSignal(houding: string): CustomerSignal {
  const mapping: Record<string, CustomerSignal> = {
    'positief': 'positief',
    'negatief': 'negatief',
    'vaag': 'vaag',
    'ontwijkend': 'ontwijkend',
    'vraag': 'vraag',
    'twijfel': 'twijfel',
    'bezwaar': 'bezwaar',
    'uitstel': 'uitstel',
    'angst': 'angst',
    'interesse': 'positief',
    'akkoord': 'positief',
    'neutraal': 'ontwijkend',
  };
  return mapping[houding] || 'ontwijkend';
}

function phaseToEpicPhase(phase: number): EpicPhase {
  switch (phase) {
    case 1: return 'explore';
    case 2: return 'explore';
    case 3: return 'impact';
    case 4: return 'commit';
    default: return 'explore';
  }
}

function phaseToTechniquePrefix(phase: number): string {
  switch (phase) {
    case 1: return '1';
    case 2: return '2';
    case 3: return '3';
    case 4: return '4';
    default: return '1';
  }
}

interface TurnPair {
  customerTurn: TranscriptTurn | null;
  sellerTurn: TranscriptTurn;
  phase: number;
}

function buildTurnPairs(turns: TranscriptTurn[]): TurnPair[] {
  const pairs: TurnPair[] = [];
  let currentPhase = 1;

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.speaker !== 'seller') continue;

    let customerTurn: TranscriptTurn | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (turns[j].speaker === 'customer') {
        customerTurn = turns[j];
        break;
      }
    }

    pairs.push({
      customerTurn,
      sellerTurn: turn,
      phase: currentPhase,
    });
  }

  return pairs;
}

export async function evaluateSellerTurns(turns: TranscriptTurn[]): Promise<TurnEvaluation[]> {
  const pairs = buildTurnPairs(turns);
  const evaluations: TurnEvaluation[] = [];
  let currentPhase = 1;

  console.log(`[Analysis-Unified] Evaluating ${pairs.length} seller turns using coaching engine...`);

  const PARALLEL_BATCH = 5;

  for (let batchStart = 0; batchStart < pairs.length; batchStart += PARALLEL_BATCH) {
    const batchEnd = Math.min(batchStart + PARALLEL_BATCH, pairs.length);
    const batchPairs = pairs.slice(batchStart, batchEnd);

    const batchPromises = batchPairs.map(async (pair) => {
      const customerText = pair.customerTurn?.text || '';
      const sellerText = pair.sellerTurn.text;

      if (sellerText.trim().length < 5) {
        return null;
      }

      let houding: CustomerSignal = 'ontwijkend';
      if (pair.customerTurn && customerText.length > 3) {
        houding = await classifyCustomerHouding(customerText, currentPhase);
      }

      const epicPhase = phaseToEpicPhase(currentPhase);
      const techniquePrefix = phaseToTechniquePrefix(currentPhase);

      try {
        const result = await evaluateConceptually(
          sellerText,
          customerText,
          houding,
          techniquePrefix,
          currentPhase,
          epicPhase
        );

        if (result.detected && result.techniques && result.techniques.length > 0) {
          const detectedPhases = result.techniques.map(t => {
            const firstNum = parseInt(t.id?.split('.')[0] || '0');
            return firstNum;
          }).filter(p => p > 0);
          const maxPhase = Math.max(...detectedPhases, currentPhase);
          if (maxPhase > currentPhase) currentPhase = maxPhase;
        }

        const techniques = (result.techniques || []).map(t => ({
          id: t.id || '',
          naam: t.naam || '',
          quality: (t.quality || result.quality || 'gemist') as string,
          score: t.score ?? result.score ?? 0,
          stappen_gevolgd: [] as string[],
        }));

        if (techniques.length === 0 && result.detected && result.moveId) {
          const ssotTech = getTechnique(result.moveId);
          techniques.push({
            id: result.moveId,
            naam: ssotTech ? ssotTech.naam : (result.moveLabel || ''),
            quality: result.quality || 'goed',
            score: result.score ?? 5,
            stappen_gevolgd: [],
          });
        }

        return {
          turnIdx: pair.sellerTurn.idx,
          techniques,
          overallQuality: result.quality || (result.detected ? 'goed' : 'gemist'),
          rationale: result.rationale || result.feedback || '',
        } as TurnEvaluation;
      } catch (err: any) {
        console.error(`[Analysis-Unified] Eval failed for turn ${pair.sellerTurn.idx}:`, err.message);
        const fallback = evaluateFirstTurn(sellerText, techniquePrefix, currentPhase, houding);
        if (!fallback.detected) return null;

        return {
          turnIdx: pair.sellerTurn.idx,
          techniques: (fallback.techniques || []).map(t => {
            const techId = t.id || fallback.moveId || '';
            const ssotTech = techId ? getTechnique(techId) : null;
            return {
              id: techId,
              naam: ssotTech ? ssotTech.naam : (t.naam || fallback.moveLabel || ''),
              quality: t.quality || 'goed',
              score: t.score ?? fallback.score ?? 5,
              stappen_gevolgd: [],
            };
          }),
          overallQuality: fallback.quality || 'goed',
          rationale: fallback.feedback || '',
        } as TurnEvaluation;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      if (result && result.techniques.length > 0) {
        evaluations.push(result);
      }
    }

    if (batchStart % 20 === 0 && batchStart > 0) {
      console.log(`[Analysis-Unified] Progress: ${batchStart}/${pairs.length} turns evaluated, ${evaluations.length} techniques found`);
    }
  }

  console.log(`[Analysis-Unified] Complete: ${evaluations.length} evaluations with techniques from ${pairs.length} seller turns`);
  return evaluations;
}

async function classifyCustomerHouding(text: string, phase: number): Promise<CustomerSignal> {
  const lower = text.toLowerCase();

  const quickPatterns: Array<{ signal: CustomerSignal; patterns: string[] }> = [
    { signal: 'vraag', patterns: ['hoe werkt', 'wat kost', 'kunt u uitleggen', 'wat houdt in', 'hoe zit het met', 'wat is het', 'waarom is', 'hoeveel', 'kunt u mij', 'kunt ge mij', 'wat bedoelt u', 'wat bedoel je'] },
    { signal: 'positief', patterns: ['dat is exact', 'dat past', 'dat sluit aan', 'dat helpt', 'dat is voldoende', 'interessant', 'klinkt goed', 'dat wil ik', 'graag', 'prima', 'akkoord', 'deal', 'absoluut', 'zeker', 'heel belangrijk', 'wel belangrijk', 'toch wel belangrijk', 'dat is belangrijk', 'rendement', 'dat klopt', 'inderdaad', 'kan dat zeker', 'kan zeker', 'dat is zo'] },
    { signal: 'negatief', patterns: ['dat voldoet niet', 'dat past niet', 'te weinig', 'ik zoek iets anders', 'niet interessant', 'niet bewezen', 'niet inslaagt', 'teleurgesteld', 'slechte ervaring', 'vertrouw het niet', 'niet tevreden', 'jammer', 'spijtig'] },
    { signal: 'vaag', patterns: ['misschien', 'zou kunnen', 'we zullen zien', 'eventueel', 'hangt ervan af', 'je weet maar nooit', 'dat hangt af'] },
    { signal: 'ontwijkend', patterns: ['moeilijk te zeggen', 'dat varieert', 'dat is een goede vraag', 'maakt niet uit', 'geen idee', 'weet ik niet zo'] },
  ];

  if (phase >= 4) {
    quickPatterns.push(
      { signal: 'twijfel', patterns: ['ik weet niet', 'ik twijfel', 'niet zeker', 'ik moet erover nadenken', 'lastig'] },
      { signal: 'bezwaar', patterns: ['te duur', 'te veel', 'dat kan niet', 'niet akkoord', 'dat geloof ik niet', 'nee want'] },
      { signal: 'uitstel', patterns: ['later', 'volgende week', 'nog niet', 'even wachten', 'niet nu', 'binnenkort'] }
    );
  }

  for (const { signal, patterns } of quickPatterns) {
    for (const p of patterns) {
      if (lower.includes(p)) return signal;
    }
  }

  if (text.trim().endsWith('?') || lower.startsWith('hoe') || lower.startsWith('wat') || lower.startsWith('waarom') || lower.startsWith('wanneer')) {
    return 'vraag';
  }

  if (text.length < 20) return 'ontwijkend';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: `Classificeer deze klantuitspraak in een verkoopgesprek (fase ${phase}).

Kies exact één houding op basis van de INHOUD en TOON van wat de klant zegt:
- positief: klant toont interesse, bevestigt, is enthousiast, deelt relevante informatie die wijst op koopintentie, noemt wat belangrijk is voor hen
- negatief: klant uit ontevredenheid, kritiek op huidige situatie, frustratie, teleurstelling (bijv. over bestaande leverancier/bank/product)
- vaag: klant geeft geen duidelijk standpunt, blijft oppervlakkig, zegt ja maar zonder overtuiging
- ontwijkend: klant wijkt bewust af van de vraag, geeft geen inhoudelijk antwoord
- vraag: klant stelt een vraag
${phase >= 4 ? '- twijfel: klant is onzeker over beslissing\n- bezwaar: klant brengt tegenargument tegen het aanbod\n- uitstel: klant wil beslissing uitstellen' : ''}

BELANGRIJK: Als de klant uitgebreid vertelt over hun situatie, ervaringen of behoeften, is dit NIET ontwijkend of neutraal. Beoordeel de emotionele lading en inhoud.

Antwoord als JSON: {"houding": "..."}`
        },
        { role: 'user', content: `Klant: "${text}"` }
      ],
      max_completion_tokens: 50,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.houding || 'ontwijkend') as CustomerSignal;
    }
  } catch {}

  return 'ontwijkend';
}

function determineCurrentPhase(turnIdx: number, evaluations: TurnEvaluation[]): number {
  const techsBefore = evaluations
    .filter(e => e.turnIdx <= turnIdx)
    .flatMap(e => e.techniques.map(t => t.id));

  const hasPhase4 = techsBefore.some(id => id.startsWith('4'));
  const hasPhase3 = techsBefore.some(id => id.startsWith('3'));
  const hasPhase2 = techsBefore.some(id => id.startsWith('2'));

  if (hasPhase4) return 4;
  if (hasPhase3) return 3;
  if (hasPhase2) return 2;
  return 1;
}

export async function detectCustomerSignals(turns: TranscriptTurn[], evaluations: TurnEvaluation[]): Promise<CustomerSignalResult[]> {
  const customerTurns = turns.filter(t => t.speaker === 'customer');
  const results: CustomerSignalResult[] = [];

  const signalHoudingMap: Record<string, CustomerSignalResult['houding']> = {
    'positief': 'interesse',
    'negatief': 'negatief',
    'vaag': 'vaag',
    'ontwijkend': 'ontwijkend',
    'vraag': 'vraag',
    'twijfel': 'twijfel',
    'bezwaar': 'bezwaar',
    'uitstel': 'uitstel',
    'angst': 'twijfel',
  };

  for (const turn of customerTurns) {
    const currentPhase = determineCurrentPhase(turn.idx, evaluations);
    const houding = await classifyCustomerHouding(turn.text, currentPhase);
    const displayHouding = signalHoudingMap[houding] || 'neutraal';

    let recommendedTechniqueIds: string[] = [];
    try {
      const moves = getExpectedMoves(houding);
      recommendedTechniqueIds = moves.map(m => m.id);
    } catch {
      recommendedTechniqueIds = [];
    }

    results.push({
      turnIdx: turn.idx,
      houding: displayHouding,
      confidence: 0.8,
      recommendedTechniqueIds,
      currentPhase,
    });
  }

  return results;
}

const EXPLORE_THEMES = ['Bron', 'Motivatie', 'Ervaring', 'Verwachtingen', 'Alternatieven', 'Budget', 'Timing', 'Beslissingscriteria'];

const themeKeywords: Record<string, string[]> = {
  Bron: ['terechtgekomen', 'gevonden', 'gehoord', 'via wie', 'hoe kwam'],
  Motivatie: ['aanleiding', 'waarom', 'reden', 'wat brengt'],
  Ervaring: ['ervaring', 'eerder', 'al eens', 'bekend met'],
  Verwachtingen: ['verwacht', 'ideaal', 'belangrijk voor', 'hoop'],
  Alternatieven: ['andere', 'alternatieven', 'opties', 'vergelijk'],
  Budget: ['budget', 'investering', 'bedrag', 'prijs'],
  Timing: ['wanneer', 'timing', 'planning', 'deadline'],
  Beslissingscriteria: ['wie beslist', 'beslissing', 'criteria', 'belangrijk voor de keuze'],
};

function qualityToScore(quality: string): number {
  switch (quality) {
    case 'perfect': return 10;
    case 'goed': return 7;
    case 'bijna': return 4;
    case 'gemist': return 0;
    default: return 0;
  }
}

const PHASE_KEY_TECHNIQUES: Record<number, string[]> = {
  1: ['1.1', '1.2', '1.3', '1.4'],
  2: ['2.1', '2.2', '2.3', '2.4'],
  3: ['3.1', '3.2', '3.3', '3.5'],
  4: ['4.1', '4.2', '4.3'],
};

function calculatePhaseScore(
  evaluations: TurnEvaluation[],
  phaseFilter: (id: string) => boolean,
  totalPossible: number
): PhaseScore {
  const techMap = new Map<string, { id: string; naam: string; quality: string; count: number; totalScore: number }>();

  for (const ev of evaluations) {
    for (const t of ev.techniques) {
      if (!phaseFilter(t.id)) continue;
      const existing = techMap.get(t.id);
      if (existing) {
        existing.count++;
        existing.totalScore += qualityToScore(t.quality);
        if (qualityToScore(t.quality) > qualityToScore(existing.quality)) {
          existing.quality = t.quality;
        }
      } else {
        techMap.set(t.id, {
          id: t.id,
          naam: t.naam,
          quality: t.quality,
          count: 1,
          totalScore: qualityToScore(t.quality),
        });
      }
    }
  }

  const techniquesFound = Array.from(techMap.values()).map(v => ({
    id: v.id,
    naam: v.naam,
    quality: v.quality,
    count: v.count,
  }));

  const phaseNum = techMap.size > 0 ? parseInt(Array.from(techMap.keys())[0]?.split('.')[0] || '1') : 1;
  const keyTechniques = PHASE_KEY_TECHNIQUES[phaseNum] || PHASE_KEY_TECHNIQUES[1];
  const effectiveDenominator = Math.max(keyTechniques.length, techniquesFound.length);

  const sumScores = Array.from(techMap.values()).reduce((sum, v) => sum + qualityToScore(v.quality), 0);
  const maxScore = effectiveDenominator * 10;
  const score = maxScore > 0 ? Math.round((sumScores / maxScore) * 100) : 0;

  return { score: Math.min(score, 100), techniquesFound, totalPossible: effectiveDenominator };
}

export function calculatePhaseCoverage(
  evaluations: TurnEvaluation[],
  turns: TranscriptTurn[]
): PhaseCoverage {
  const allTechniques = loadMergedTechniques();
  const nonFaseTechniques = allTechniques.filter(t => !t.is_fase);

  const phase1Count = nonFaseTechniques.filter(t => t.fase === '0' || t.fase === '1').length;
  const phase2Count = nonFaseTechniques.filter(t => t.fase === '2').length;
  const phase3Count = nonFaseTechniques.filter(t => t.fase === '3').length;
  const phase4Count = nonFaseTechniques.filter(t => t.fase === '4').length;

  const phase1 = calculatePhaseScore(
    evaluations,
    (id) => id.startsWith('0') || id.startsWith('1'),
    phase1Count
  );

  const phase2Overall = calculatePhaseScore(
    evaluations,
    (id) => id.startsWith('2'),
    phase2Count
  );

  const allTechIds = evaluations.flatMap(e => e.techniques.map(t => t.id));
  const sellerTexts = turns.filter(t => t.speaker === 'seller').map(t => t.text.toLowerCase()).join(' ');

  const coveredThemes: string[] = [];
  const missingThemes: string[] = [];
  for (const theme of EXPLORE_THEMES) {
    const keywords = themeKeywords[theme] || [];
    const found = keywords.some(kw => sellerTexts.includes(kw));
    if (found) {
      coveredThemes.push(theme);
    } else {
      missingThemes.push(theme);
    }
  }
  const exploreScore = EXPLORE_THEMES.length > 0 ? Math.round((coveredThemes.length / EXPLORE_THEMES.length) * 100) : 0;

  const probeFound = allTechIds.some(id => id.startsWith('2.2'));
  const probeExamples: string[] = [];
  if (probeFound) {
    const probeEvals = evaluations.filter(e => e.techniques.some(t => t.id.startsWith('2.2')));
    for (const ev of probeEvals) {
      const turn = turns.find(t => t.idx === ev.turnIdx);
      if (turn) probeExamples.push(turn.text.substring(0, 100));
    }
  }

  const impactFound = allTechIds.some(id => id.startsWith('2.3'));
  const impactExamples: string[] = [];
  if (impactFound) {
    const impactEvals = evaluations.filter(e => e.techniques.some(t => t.id.startsWith('2.3')));
    for (const ev of impactEvals) {
      const turn = turns.find(t => t.idx === ev.turnIdx);
      if (turn) impactExamples.push(turn.text.substring(0, 100));
    }
  }

  const commitFound = allTechIds.some(id => id.startsWith('2.4'));
  const commitExamples: string[] = [];
  if (commitFound) {
    const commitEvals = evaluations.filter(e => e.techniques.some(t => t.id.startsWith('2.4')));
    for (const ev of commitEvals) {
      const turn = turns.find(t => t.idx === ev.turnIdx);
      if (turn) commitExamples.push(turn.text.substring(0, 100));
    }
  }

  const phase3 = calculatePhaseScore(
    evaluations,
    (id) => id.startsWith('3'),
    phase3Count
  );

  const phase4 = calculatePhaseScore(
    evaluations,
    (id) => id.startsWith('4'),
    phase4Count
  );

  const overall = Math.round(
    phase1.score * 0.15 +
    phase2Overall.score * 0.40 +
    phase3.score * 0.25 +
    phase4.score * 0.20
  );

  return {
    phase1,
    phase2: {
      overall: phase2Overall,
      explore: { score: exploreScore, themes: coveredThemes, missing: missingThemes },
      probe: { score: probeFound ? 100 : 0, found: probeFound, examples: probeExamples },
      impact: { score: impactFound ? 100 : 0, found: impactFound, examples: impactExamples },
      commit: { score: commitFound ? 100 : 0, found: commitFound, examples: commitExamples },
    },
    phase3,
    phase4,
    overall,
  };
}

export async function detectMissedOpportunities(
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[],
  turns: TranscriptTurn[]
): Promise<MissedOpportunity[]> {
  const missed: MissedOpportunity[] = [];
  const allTechIds = evaluations.flatMap(e => e.techniques.map(t => t.id));

  const hasPhase3or4 = allTechIds.some(id => id.startsWith('3.') || id.startsWith('4.'));
  const exploreCount = allTechIds.filter(id => id.startsWith('2.1')).length;

  if (hasPhase3or4 && exploreCount < 3) {
    const phase3Turn = evaluations.find(e => e.techniques.some(t => t.id.startsWith('3.') || t.id.startsWith('4.')));
    const turnIdx = phase3Turn?.turnIdx ?? 0;
    const sellerTurn = turns.find(t => t.idx === turnIdx);
    const prevCustomer = turns.filter(t => t.idx < turnIdx && t.speaker === 'customer').pop();

    missed.push({
      turnIdx,
      type: 'te_vroeg_fase_3_4',
      description: 'Verkoper ging te snel naar aanbeveling/closing zonder voldoende ontdekking.',
      sellerSaid: sellerTurn?.text || '',
      customerSaid: prevCustomer?.text || '',
      betterQuestion: '',
    });
  }

  if (!allTechIds.some(id => id.startsWith('2.2'))) {
    missed.push({
      turnIdx: 0,
      type: 'probe_gemist',
      description: 'Geen Probe-techniek (storytelling/hypothetische scenario\'s) toegepast in het gesprek.',
      sellerSaid: '',
      customerSaid: '',
      betterQuestion: '',
    });
  }

  if (!allTechIds.some(id => id.startsWith('2.3'))) {
    missed.push({
      turnIdx: 0,
      type: 'impact_gemist',
      description: 'Geen Impact-vragen gesteld. De klant is niet bewust gemaakt van de gevolgen.',
      sellerSaid: '',
      customerSaid: '',
      betterQuestion: '',
    });
  }

  if (!allTechIds.some(id => id.startsWith('2.4'))) {
    missed.push({
      turnIdx: 0,
      type: 'commit_gemist',
      description: 'Geen Commitment-vraag gesteld. De klant heeft niet bevestigd dat de baat belangrijk is.',
      sellerSaid: '',
      customerSaid: '',
      betterQuestion: '',
    });
  }

  for (const signal of signals) {
    if (signal.houding === 'twijfel') {
      const nextSellerTurn = turns.find(t => t.idx > signal.turnIdx && t.speaker === 'seller');
      if (nextSellerTurn) {
        const nextEval = evaluations.find(e => e.turnIdx === nextSellerTurn.idx);
        const hasImpactOrCommit = nextEval?.techniques.some(t =>
          t.id.startsWith('2.3') || t.id.startsWith('2.4')
        );
        if (!hasImpactOrCommit) {
          const customerTurn = turns.find(t => t.idx === signal.turnIdx);
          missed.push({
            turnIdx: nextSellerTurn.idx,
            type: 'twijfel_niet_uitgepakt',
            description: 'Klant toonde twijfel, maar verkoper ging niet in op de impact of vroeg geen commitment.',
            sellerSaid: nextSellerTurn.text,
            customerSaid: customerTurn?.text || '',
            betterQuestion: '',
          });
        }
      }
    }

    if (signal.houding === 'bezwaar') {
      const nextSellerTurn = turns.find(t => t.idx > signal.turnIdx && t.speaker === 'seller');
      if (nextSellerTurn) {
        const lower = nextSellerTurn.text.toLowerCase();
        const argues = lower.includes('maar') || lower.includes('nee') || lower.includes('integendeel') || lower.includes('dat klopt niet');
        if (argues) {
          const customerTurn = turns.find(t => t.idx === signal.turnIdx);
          missed.push({
            turnIdx: nextSellerTurn.idx,
            type: 'bezwaar_overgeslagen',
            description: 'Klant had een bezwaar, maar verkoper ging direct in de verdediging in plaats van empathie te tonen en door te vragen.',
            sellerSaid: nextSellerTurn.text,
            customerSaid: customerTurn?.text || '',
            betterQuestion: '',
          });
        }
      }
    }
  }

  const sellerTurnsWithVoordeel = turns.filter(t => {
    if (t.speaker !== 'seller') return false;
    const lower = t.text.toLowerCase();
    return lower.includes('voordeel') || lower.includes('het mooie is') || lower.includes('het fijne is');
  });

  for (const vTurn of sellerTurnsWithVoordeel) {
    const nextTurns = turns.filter(t => t.idx > vTurn.idx && t.idx <= vTurn.idx + 3);
    const hasBaat = nextTurns.some(t => {
      const lower = t.text.toLowerCase();
      return lower.includes('concreet betekent') || lower.includes('dat betekent voor u') || lower.includes('baat');
    });
    if (!hasBaat) {
      const prevCustomer = turns.filter(t => t.idx < vTurn.idx && t.speaker === 'customer').pop();
      missed.push({
        turnIdx: vTurn.idx,
        type: 'baat_niet_gemaakt',
        description: 'Verkoper benoemde een voordeel maar vertaalde het niet naar een concrete baat voor de klant.',
        sellerSaid: vTurn.text,
        customerSaid: prevCustomer?.text || '',
        betterQuestion: '',
      });
    }
  }

  if (missed.length > 0) {
    const toEnrich = missed.filter(m => !m.betterQuestion);
    const batchPrompt = toEnrich.map((m, i) => `${i + 1}. Type: ${m.type}
Verkoper: "${m.sellerSaid.substring(0, 150)}"
Klant: "${m.customerSaid.substring(0, 150)}"`).join('\n\n');

    if (batchPrompt.length > 10) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-5.1',
          messages: [
            {
              role: 'system',
              content: `Je bent een verkoopcoach die de EPIC-methode gebruikt. Genereer voor elk gemist moment een betere vraag die de verkoper had kunnen stellen. Antwoord als JSON object: {"suggestions": [{"idx": 1, "betterQuestion": "..."}]}`
            },
            {
              role: 'user',
              content: `Genereer voor elk gemist moment een betere vraag:\n\n${batchPrompt}`
            }
          ],
          max_completion_tokens: 600,
          temperature: 0.5,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content?.trim() || '{}';
        try {
          const parsed = JSON.parse(content);
          const suggestions = parsed.suggestions || parsed.results || [];
          for (const s of suggestions) {
            const idx = (s.idx || s.index || 1) - 1;
            if (toEnrich[idx]) {
              toEnrich[idx].betterQuestion = s.betterQuestion || '';
            }
          }
        } catch {}
      } catch {
      }
    }
  }

  return missed;
}

export async function generateCoachReport(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[],
  phaseCoverage: PhaseCoverage,
  missedOpps: MissedOpportunity[],
  ssotContext: string = '',
  ragContext: string = ''
): Promise<AnalysisInsights> {
  const turnSummaries = turns.map(t => `[${t.speaker}] "${t.text.substring(0, 120)}"`).join('\n');
  const evalSummaries = evaluations.map(e => {
    const techs = e.techniques.map(t => `${t.id} ${t.naam} (${t.quality})`).join(', ');
    return `Beurt ${e.turnIdx}: ${techs || 'geen techniek'} - ${e.rationale.substring(0, 80)}`;
  }).join('\n');
  const signalSummaries = signals.map(s => `Beurt ${s.turnIdx}: ${s.houding} (${Math.round(s.confidence * 100)}%) [fase ${s.currentPhase}]`).join('\n');
  const missedSummaries = missedOpps.map(m => `${m.type}: ${m.description.substring(0, 100)}`).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: `Je bent Hugo Herbots, verkoopcoach en expert in de EPIC-methode. Je schrijft een coachrapport in het Nederlands over een verkoopgesprek. 

Stijl: concreet, coachend, niet academisch. Gebruik "je" (informeel). Geef concrete voorbeelden met quotes uit het gesprek.

EPIC staat voor: Explore (2.1), Probe (2.2), Impact (2.3), Commitment (2.4).

REGELS:
- strengths: technieken die goed of perfect werden toegepast. Gebruik het techniek-ID en naam. De quote moet letterlijk uit het transcript komen en relevant zijn voor die techniek.
- improvements: technieken die beter konden. De quote moet het moment tonen waar het misging. betterApproach moet concreet uitleggen wat de verkoper anders had moeten zeggen/doen.
- microExperiments: 3 concrete oefentips gebaseerd op de SPECIFIEKE zwakke punten uit dit gesprek. Verwijs naar de exacte situatie of techniek die gemist werd. Geen generieke tips.
- Een techniek mag NIET in zowel strengths als improvements voorkomen.

Genereer het rapport als JSON met deze structuur:
{
  "summaryMarkdown": "Korte samenvatting in markdown (3-4 zinnen)",
  "strengths": [{"text": "techniek-ID techniek-naam – kwaliteit (perfect/goed)", "quote": "letterlijk citaat uit gesprek", "turnIdx": 0}],
  "improvements": [{"text": "techniek-ID techniek-naam – wat er mis was", "quote": "letterlijk citaat uit gesprek", "turnIdx": 0, "betterApproach": "concreet alternatief"}],
  "microExperiments": ["concrete oefening gebaseerd op specifiek verbeterpunt 1", "concrete oefening 2", "concrete oefening 3"],
  "overallScore": 65
}

Geef exact 3 strengths, 3 improvements en 3 micro-experimenten. Score van 0-100.`
        },
        {
          role: 'user',
          content: `GESPREKSTRANSCRIPT:
${turnSummaries}

TECHNIEK-EVALUATIES:
${evalSummaries}

KLANTSIGNALEN:
${signalSummaries}

FASE COVERAGE:
- Fase 1 (Opening): ${phaseCoverage.phase1.score}% (${phaseCoverage.phase1.techniquesFound.length} technieken gevonden van ${phaseCoverage.phase1.totalPossible})
- Fase 2 (EPIC Ontdekking): ${phaseCoverage.phase2.overall.score}%
  - Explore: ${phaseCoverage.phase2.explore.score}% (thema's: ${phaseCoverage.phase2.explore.themes.join(', ')} | missend: ${phaseCoverage.phase2.explore.missing.join(', ')})
  - Probe: ${phaseCoverage.phase2.probe.score}%
  - Impact: ${phaseCoverage.phase2.impact.score}%
  - Commit: ${phaseCoverage.phase2.commit.score}%
- Fase 3 (Aanbeveling): ${phaseCoverage.phase3.score}% (${phaseCoverage.phase3.techniquesFound.length} technieken gevonden van ${phaseCoverage.phase3.totalPossible})
- Fase 4 (Beslissing): ${phaseCoverage.phase4.score}% (${phaseCoverage.phase4.techniquesFound.length} technieken gevonden van ${phaseCoverage.phase4.totalPossible})
- Overall: ${phaseCoverage.overall}%

GEMISTE KANSEN:
${missedSummaries || 'Geen'}
${ssotContext ? `\n--- HUGO HERBOTS METHODIEK CONTEXT ---\n${ssotContext}` : ''}
${ragContext ? `\n${ragContext}` : ''}

Gebruik bovenstaande methodiek-context om je feedback te gronden in de Hugo Herbots EPIC-methode. Verwijs naar specifieke technieken uit het framework, niet generieke verkooptips.

Schrijf het coachrapport.`
        }
      ],
      max_completion_tokens: 1500,
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        phaseCoverage,
        missedOpportunities: missedOpps,
        summaryMarkdown: parsed.summaryMarkdown || '',
        strengths: (parsed.strengths || []).slice(0, 3).map((s: any) => ({
          text: s.text || '',
          quote: s.quote || '',
          turnIdx: s.turnIdx ?? 0,
        })),
        improvements: (parsed.improvements || []).slice(0, 3).map((s: any) => ({
          text: s.text || '',
          quote: s.quote || '',
          turnIdx: s.turnIdx ?? 0,
          betterApproach: s.betterApproach || '',
        })),
        microExperiments: (parsed.microExperiments || []).slice(0, 3),
        overallScore: parsed.overallScore ?? phaseCoverage.overall,
      };
    }

    throw new Error('Geen geldig JSON in coachrapport');
  } catch (err: any) {
    return {
      phaseCoverage,
      missedOpportunities: missedOpps,
      summaryMarkdown: 'Het coachrapport kon niet volledig worden gegenereerd.',
      strengths: [],
      improvements: [],
      microExperiments: [],
      overallScore: phaseCoverage.overall,
    };
  }
}

export async function generateCoachArtifacts(
  turns: TranscriptTurn[],
  evaluations: TurnEvaluation[],
  signals: CustomerSignalResult[],
  phaseCoverage: PhaseCoverage,
  missedOpps: MissedOpportunity[],
  insights: AnalysisInsights,
  ssotContext: string = '',
  ragContext: string = ''
): Promise<{ coachDebrief: CoachDebrief; moments: CoachMoment[] }> {
  const formatTimestamp = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const determinePhase = (turnIdx: number): number => {
    const signal = signals.find(s => s.turnIdx === turnIdx);
    if (signal?.currentPhase) return signal.currentPhase;
    const eval_ = evaluations.find(e => e.turnIdx === turnIdx);
    if (eval_ && eval_.techniques.length > 0) {
      const firstTech = eval_.techniques[0].id;
      if (firstTech.startsWith('0') || firstTech.startsWith('1')) return 1;
      if (firstTech.startsWith('2')) return 2;
      if (firstTech.startsWith('3')) return 3;
      if (firstTech.startsWith('4')) return 4;
    }
    return 1;
  };

  const turnSummaries = turns.map(t => `[${t.idx}][${t.speaker}][${formatTimestamp(t.startMs)}] "${t.text.substring(0, 200)}"`).join('\n');
  const evalSummaries = evaluations.map(e => {
    const techs = e.techniques.map(t => `${t.id} ${t.naam} (${t.quality}, score:${t.score})`).join(', ');
    return `Turn ${e.turnIdx}: ${techs || 'geen techniek'} - ${e.rationale.substring(0, 100)}`;
  }).join('\n');
  const signalSummaries = signals.map(s => `Turn ${s.turnIdx}: ${s.houding} (${Math.round(s.confidence * 100)}%) [fase ${s.currentPhase}]`).join('\n');
  const missedSummaries = missedOpps.map(m => `Turn ${m.turnIdx}: ${m.type} - ${m.description} | Verkoper: "${m.sellerSaid.substring(0, 100)}" | Klant: "${m.customerSaid.substring(0, 100)}" | Beter: "${m.betterQuestion.substring(0, 100)}"`).join('\n');

  const aiClient = process.env.OPENAI_API_KEY ? openaiDirect : openai;
  const aiModel = process.env.OPENAI_API_KEY ? 'gpt-4o' : 'gpt-5.1';

  try {
    const response = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [
        {
          role: 'system',
          content: `Je bent Hugo Herbots, verkoopcoach. Je genereert een coach-debrief en 3 key moments uit een verkoopgesprek.

STIJL: Coachend, direct, informeel ("je"). GEEN rapport-taal, GEEN schoolcijfers. Praat alsof je naast de verkoper zit na het gesprek.

Je output is JSON met deze structuur:
{
  "oneliner": "1 zin die de kern samenvat, coachend en specifiek (bv: 'Je EPIC zit goed. Je laat kansen liggen op commitment → daardoor blijft de klant twijfelen.')",
  "epicMomentum": "Kort (1-2 zinnen) over hoe goed de EPIC-flow liep. Geen percentages, wel concreet (bv: 'Je Explore was sterk, maar je sprong te snel naar aanbeveling zonder Impact te maken.')",
  "moments": [
    {
      "type": "big_win",
      "turnIndex": 0,
      "label": "Korte beschrijving van het moment (bv: 'Sterke doorvraag op pijnpunt')",
      "whyItMatters": "Waarom dit goed was, in coachtaal (bv: 'Hier liet je de klant zijn eigen probleem verwoorden. Dat is goud — want dan hoef jij het niet meer te verkopen.')",
      "betterAlternative": "",
      "recommendedTechniques": ["2.1"]
    },
    {
      "type": "quick_fix",
      "turnIndex": 0,
      "label": "Korte beschrijving (bv: 'Gemiste kans om door te vragen')",
      "whyItMatters": "Waarom dit een quick fix is (bv: 'De klant gaf hier een koopsignaal maar je ging door met je presentatie. Eén vraag had het verschil gemaakt.')",
      "betterAlternative": "Concreet wat de verkoper had kunnen zeggen (bv: 'Stel je voor dat je dat probleem oplost — wat zou dat betekenen voor jullie team?')",
      "recommendedTechniques": ["2.3"]
    },
    {
      "type": "turning_point",
      "turnIndex": 0,
      "label": "Korte beschrijving (bv: 'Hier kantelde het gesprek')",
      "whyItMatters": "Waarom dit het scharnierpunt was (bv: 'Dit was HET moment om commitment te vragen. De klant was klaar, maar je ging terug naar features.')",
      "betterAlternative": "Wat de verkoper hier had moeten doen",
      "recommendedTechniques": ["2.4"]
    }
  ],
  "debriefMessages": [
    {"type": "coach_text", "text": "Opening van de debrief — 1-2 zinnen die het gesprek contextualiseren"},
    {"type": "moment_ref", "momentType": "big_win"},
    {"type": "coach_text", "text": "Overgang naar verbeterpunt — kort, coachend"},
    {"type": "moment_ref", "momentType": "quick_fix"},
    {"type": "coach_text", "text": "Overgang naar scharnierpunt"},
    {"type": "moment_ref", "momentType": "turning_point"},
    {"type": "coach_text", "text": "Afsluitende coaching — 1-2 zinnen, positief, actiegericht"}
  ]
}

REGELS:
- big_win: het sterkste moment van de verkoper. Positief, concreet. Geen betterAlternative nodig (laat leeg).
- quick_fix: iets dat met 1 kleine aanpassing veel beter kan. Concreet betterAlternative verplicht.
- turning_point: HET scharnierpunt met de hoogste impact. Dit is waar het gesprek een andere kant op had gekund. Concreet betterAlternative verplicht.
- turnIndex moet verwijzen naar een echte turn uit het transcript (gebruik de [idx] nummers).
- debriefMessages: dit wordt gerenderd als een chat van Hugo. Elke message is kort (max 2 zinnen). moment_ref verwijst naar het type moment.
- recommendedTechniques: gebruik techniek-IDs (bv "2.1", "2.3", "1.2").
- Schrijf in het Nederlands.`
        },
        {
          role: 'user',
          content: `TRANSCRIPT (${turns.length} turns):
${turnSummaries}

TECHNIEK-EVALUATIES:
${evalSummaries}

KLANTSIGNALEN:
${signalSummaries}

GEMISTE KANSEN:
${missedSummaries || 'Geen'}

FASE SCORES: Opening ${phaseCoverage.phase1.score}% | EPIC ${phaseCoverage.phase2.overall.score}% (E:${phaseCoverage.phase2.explore.score}% P:${phaseCoverage.phase2.probe.score}% I:${phaseCoverage.phase2.impact.score}% C:${phaseCoverage.phase2.commit.score}%) | Aanbeveling ${phaseCoverage.phase3.score}% | Beslissing ${phaseCoverage.phase4.score}% | Overall: ${phaseCoverage.overall}%
${ssotContext ? `\n--- HUGO HERBOTS METHODIEK CONTEXT ---\n${ssotContext}` : ''}
${ragContext ? `\n${ragContext}` : ''}

Gebruik de methodiek-context om je coaching te gronden in het Hugo Herbots framework. Verwijs naar specifieke EPIC-technieken. Genereer de coach debrief + 3 moments.`
        }
      ],
      max_completion_tokens: 2000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const moments: CoachMoment[] = (parsed.moments || []).slice(0, 3).map((m: any, idx: number) => {
        const turnIdx = m.turnIndex ?? 0;
        const turn = turns.find(t => t.idx === turnIdx);
        const prevTurn = turns.find(t => t.idx === turnIdx - 1) || turns.find(t => t.idx === turnIdx + 1);
        const signal = signals.find(s => s.turnIdx === turnIdx);

        return {
          id: `m-${turn ? formatTimestamp(turn.startMs).replace(':', '') : idx}`,
          timestamp: turn ? formatTimestamp(turn.startMs) : '00:00',
          turnIndex: turnIdx,
          phase: determinePhase(turnIdx),
          label: m.label || `Moment ${idx + 1}`,
          type: m.type || (['big_win', 'quick_fix', 'turning_point'][idx] as any),
          customerSignal: signal?.houding,
          sellerText: turn?.speaker === 'seller' ? turn.text : (prevTurn?.speaker === 'seller' ? prevTurn.text : ''),
          customerText: turn?.speaker === 'customer' ? turn.text : (prevTurn?.speaker === 'customer' ? prevTurn.text : ''),
          whyItMatters: m.whyItMatters || '',
          betterAlternative: m.betterAlternative || '',
          recommendedTechniques: m.recommendedTechniques || [],
          videoRecommendations: findRelevantVideos(m.recommendedTechniques || [], 2),
          replay: {
            startTurnIndex: Math.max(0, turnIdx - 2),
            contextTurns: 4,
          },
        };
      });

      const debriefMessages: CoachDebriefMessage[] = (parsed.debriefMessages || []).map((msg: any) => {
        if (msg.type === 'moment_ref') {
          const moment = moments.find(m => m.type === msg.momentType);
          return {
            type: 'moment_ref' as const,
            momentId: moment?.id || moments[0]?.id || '',
            cta: ['play', 'see_why'],
          };
        }
        return {
          type: 'coach_text' as const,
          text: msg.text || '',
        };
      });

      const coachDebrief: CoachDebrief = {
        oneliner: parsed.oneliner || `Je gesprek laat potentie zien. Laten we kijken waar je het verschil kunt maken.`,
        epicMomentum: parsed.epicMomentum || `De EPIC-flow had sterkere momenten en gemiste kansen.`,
        messages: debriefMessages,
      };

      console.log(`[Analysis] Coach artifacts generated: ${moments.length} moments, ${debriefMessages.length} debrief messages`);
      return { coachDebrief, moments };
    }

    throw new Error('Geen geldig JSON in coach artifacts');
  } catch (err: any) {
    console.warn('[Analysis] Coach artifact generation failed:', err.message);
    return {
      coachDebrief: {
        oneliner: 'Laten we je gesprek samen doornemen.',
        epicMomentum: 'De EPIC-flow wordt geanalyseerd.',
        messages: [{ type: 'coach_text', text: 'Laten we kijken naar de belangrijkste momenten uit je gesprek.' }],
      },
      moments: [],
    };
  }
}

async function persistStatusToDb(conversationId: string, status: string, extra?: Record<string, any>): Promise<void> {
  try {
    const sets = ['status = $1'];
    const values: any[] = [status];
    let idx = 2;

    if (extra) {
      for (const [key, val] of Object.entries(extra)) {
        sets.push(`${key} = $${idx}`);
        values.push(key === 'result' ? JSON.stringify(val) : val);
        idx++;
      }
    }

    values.push(conversationId);
    await pool.query(
      `UPDATE conversation_analyses SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
  } catch (err: any) {
    console.warn('[Analysis] DB status update failed:', err.message);
  }
}

export async function initAnalysisTable(): Promise<void> {
  try {
    const result = await pool.query('SELECT 1 FROM conversation_analyses LIMIT 1');
    await pool.query(`ALTER TABLE conversation_analyses ADD COLUMN IF NOT EXISTS storage_key TEXT`);
    console.log('[Analysis] Local PostgreSQL conversation_analyses table ready');
  } catch (err: any) {
    if (err.code === '42P01') {
      console.warn('[Analysis] conversation_analyses table does not exist. Creating...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS conversation_analyses (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'transcribing',
          error TEXT,
          result JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          storage_key TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_ca_user_id ON conversation_analyses(user_id);
        CREATE INDEX IF NOT EXISTS idx_ca_status ON conversation_analyses(status);
        CREATE INDEX IF NOT EXISTS idx_ca_created_at ON conversation_analyses(created_at DESC);
      `);
      console.log('[Analysis] conversation_analyses table created');
    } else {
      console.warn('[Analysis] DB init check failed:', err.message);
    }
  }
}

initAnalysisTable();

async function recoverStuckAnalyses() {
  try {
    const stuckStatuses = ['transcribing', 'analyzing', 'evaluating', 'generating_report'];
    const { rows } = await pool.query(
      `UPDATE conversation_analyses 
       SET status = 'failed', error = 'Server herstart - analyse onderbroken. Gebruik opnieuw proberen om de analyse opnieuw te starten.'
       WHERE status = ANY($1::text[])
       RETURNING id, title`,
      [stuckStatuses]
    );
    if (rows.length > 0) {
      console.log(`[Analysis] Auto-recovery: marked ${rows.length} stuck analyses as failed:`, rows.map(r => `${r.title} (${r.id})`).join(', '));
    }
  } catch (err: any) {
    console.warn('[Analysis] Auto-recovery failed:', err.message);
  }
}
setTimeout(() => recoverStuckAnalyses(), 5000);

export async function runFullAnalysis(
  conversationId: string,
  storageKey: string,
  userId: string,
  title?: string
): Promise<void> {
  const effectiveTitle = title || `Analyse ${new Date().toLocaleDateString('nl-NL')}`;
  const job: ConversationAnalysis = {
    id: conversationId,
    userId,
    title: effectiveTitle,
    type: 'upload',
    status: 'transcribing',
    consentConfirmed: true,
    createdAt: new Date().toISOString(),
  };
  analysisJobs.set(conversationId, job);

  try {
    await pool.query(
      `INSERT INTO conversation_analyses (id, user_id, title, status, created_at, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET status = $4, storage_key = $6`,
      [conversationId, userId, effectiveTitle, 'transcribing', new Date().toISOString(), storageKey]
    );
  } catch (err: any) {
    console.warn('[Analysis] DB initial insert failed:', err.message);
  }

  try {
    job.status = 'transcribing';
    analysisJobs.set(conversationId, { ...job });
    const segments = await transcribeAudio(storageKey);

    job.status = 'analyzing';
    analysisJobs.set(conversationId, { ...job });
    await persistStatusToDb(conversationId, 'analyzing');
    const turns = await buildTurns(segments);

    if (turns.length === 0) {
      throw new Error('Geen spraak gedetecteerd in het audiobestand.');
    }

    job.status = 'evaluating';
    analysisJobs.set(conversationId, { ...job });
    await persistStatusToDb(conversationId, 'evaluating');

    const evaluations = await evaluateSellerTurns(turns);
    const signals = await detectCustomerSignals(turns, evaluations);

    const phaseCoverage = calculatePhaseCoverage(evaluations, turns);
    const missedOpps = await detectMissedOpportunities(evaluations, signals, turns);

    const allDetectedTechIds = evaluations.flatMap(e => e.techniques.map(t => t.id));
    const uniqueTechIds = [...new Set(allDetectedTechIds)];
    const ssotContext = buildSSOTContextForEvaluation(uniqueTechIds);

    let ragContext = '';
    try {
      const techNames = uniqueTechIds.slice(0, 3).map(id => {
        const t = getTechnique(id);
        return t ? t.naam : id;
      }).join(', ');
      const ragQuery = `verkooptechnieken feedback: ${techNames}`;
      const ragResult = await searchRag(ragQuery, { limit: 3, threshold: 0.25 });
      if (ragResult.documents.length > 0) {
        ragContext = '\nRAG GROUNDING (cursusmateriaal & eerdere correcties):\n' +
          ragResult.documents.map(d => `- [${d.docType}] ${d.title}: ${d.content.substring(0, 200)}`).join('\n');
      }
    } catch (ragErr: any) {
      console.warn('[Analysis] RAG search failed (non-fatal):', ragErr.message);
    }

    job.status = 'generating_report';
    analysisJobs.set(conversationId, { ...job });
    await persistStatusToDb(conversationId, 'generating_report');
    const insights = await generateCoachReport(turns, evaluations, signals, phaseCoverage, missedOpps, ssotContext, ragContext);

    const { coachDebrief, moments } = await generateCoachArtifacts(turns, evaluations, signals, phaseCoverage, missedOpps, insights, ssotContext, ragContext);
    insights.coachDebrief = coachDebrief;
    insights.moments = moments;

    try {
      const detailedMetrics = await computeDetailedMetrics(turns, evaluations, signals, phaseCoverage);
      insights.detailedMetrics = detailedMetrics;
    } catch (err: any) {
      console.warn('[Analysis] Detailed metrics computation failed (non-fatal):', err.message);
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    analysisJobs.set(conversationId, { ...job });

    const fullResult: FullAnalysisResult = {
      conversation: { ...job },
      transcript: turns,
      evaluations,
      signals,
      insights,
    };

    analysisResults.set(conversationId, fullResult);

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, completed_at = $2, result = $3 WHERE id = $4`,
        ['completed', new Date().toISOString(), JSON.stringify(fullResult), conversationId]
      );
    } catch (err: any) {
      console.warn('[Analysis] DB completed update failed:', err.message);
    }

    try {
      const cleanupPath = path.join(UPLOAD_DIR, storageKey);
      if (fs.existsSync(cleanupPath)) {
        fs.unlinkSync(cleanupPath);
        console.log(`[Analysis] Temp file cleaned up after success: ${storageKey}`);
      }
    } catch {}
  } catch (err: any) {
    job.status = 'failed';
    job.error = err.message || 'Onbekende fout';
    analysisJobs.set(conversationId, { ...job });

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, error = $2 WHERE id = $3`,
        ['failed', err.message || 'Onbekende fout', conversationId]
      );
    } catch (dbErr: any) {
      console.warn('[Analysis] DB error update failed:', dbErr.message);
    }
  }
}

export async function getAnalysisStatus(conversationId: string): Promise<ConversationAnalysis | undefined> {
  const memJob = analysisJobs.get(conversationId);
  if (memJob) return memJob;

  try {
    const { rows } = await pool.query(
      'SELECT id, user_id, title, status, error, created_at, completed_at FROM conversation_analyses WHERE id = $1',
      [conversationId]
    );

    if (rows.length > 0) {
      const data = rows[0];
      return {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        type: 'upload',
        status: data.status as any,
        consentConfirmed: true,
        createdAt: data.created_at,
        completedAt: data.completed_at || undefined,
        error: data.error || undefined,
      };
    }
  } catch (err: any) {
    console.warn('[Analysis] DB status lookup failed:', err.message);
  }
  return undefined;
}

export async function getAnalysisResults(conversationId: string): Promise<FullAnalysisResult | undefined> {
  const memResult = analysisResults.get(conversationId);
  if (memResult) return memResult;

  try {
    const { rows } = await pool.query(
      'SELECT result FROM conversation_analyses WHERE id = $1 AND status = $2',
      [conversationId, 'completed']
    );

    if (rows.length > 0 && rows[0].result) {
      const result = rows[0].result as FullAnalysisResult;
      analysisResults.set(conversationId, result);
      return result;
    }
  } catch (err: any) {
    console.warn('[Analysis] DB results lookup failed:', err.message);
  }
  return undefined;
}

/**
 * Convert AI chat session conversation_history (CoachMessage[]) to TranscriptTurn[] format
 * In roleplay: user = seller, assistant = customer (AI coach plays the customer role)
 */
function convertChatHistoryToTurns(
  conversationHistory: Array<{ role: string; content: string }>,
  sessionCreatedAt?: string
): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  let idx = 0;

  for (const msg of conversationHistory) {
    if (msg.role === 'system') continue;
    if (!msg.content || msg.content.trim().length === 0) continue;

    const speaker: 'seller' | 'customer' = (msg.role === 'user' || msg.role === 'seller') ? 'seller' : 'customer';
    const startMs = idx * 5000;
    const endMs = startMs + 4500;

    turns.push({
      idx,
      startMs,
      endMs,
      speaker,
      text: msg.content,
    });
    idx++;
  }

  return turns;
}

/**
 * Run full analysis on an AI chat session (skip transcription, use existing chat history)
 */
export async function runChatAnalysis(
  conversationId: string,
  chatHistory: Array<{ role: string; content: string }>,
  userId: string,
  title: string,
  techniqueId?: string,
  sessionCreatedAt?: string
): Promise<void> {
  const job: ConversationAnalysis = {
    id: conversationId,
    userId,
    title,
    type: 'live',
    status: 'analyzing',
    consentConfirmed: true,
    createdAt: new Date().toISOString(),
  };
  analysisJobs.set(conversationId, job);

  try {
    await pool.query(
      `INSERT INTO conversation_analyses (id, user_id, title, status, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET status = $4`,
      [conversationId, userId, title, 'analyzing', new Date().toISOString()]
    );
  } catch (err: any) {
    console.warn('[ChatAnalysis] DB initial insert failed:', err.message);
  }

  try {
    console.log(`[ChatAnalysis] Raw chatHistory length: ${chatHistory.length}, roles: ${[...new Set(chatHistory.map(m => m.role))].join(', ')}`);
    const turns = convertChatHistoryToTurns(chatHistory, sessionCreatedAt);

    if (turns.length === 0) {
      throw new Error('Geen berichten gevonden in de chat sessie.');
    }

    const sellerTurns = turns.filter(t => t.speaker === 'seller');
    if (sellerTurns.length === 0) {
      console.warn(`[ChatAnalysis] No seller turns found. Turn speakers: ${turns.map(t => t.speaker).join(', ')}`);
      throw new Error('Geen verkoper berichten gevonden in de chat sessie.');
    }

    console.log(`[ChatAnalysis] Processing ${turns.length} turns (${sellerTurns.length} seller) for session ${conversationId}`);

    if (sellerTurns.length < MIN_SELLER_TURNS_FOR_ANALYSIS) {
      console.log(`[ChatAnalysis] Only ${sellerTurns.length} seller turns (< ${MIN_SELLER_TURNS_FOR_ANALYSIS}), returning simplified result`);
      
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      analysisJobs.set(conversationId, { ...job });

      const emptyPhaseScore: PhaseScore = { score: 0, techniquesFound: [], totalPossible: 0 };
      const simplifiedInsights: AnalysisInsights = {
        phaseCoverage: {
          phase1: { ...emptyPhaseScore },
          phase2: {
            overall: { ...emptyPhaseScore },
            explore: { score: 0, themes: [], missing: [] },
            probe: { score: 0, found: false, examples: [] },
            impact: { score: 0, found: false, examples: [] },
            commit: { score: 0, found: false, examples: [] },
          },
          phase3: { ...emptyPhaseScore },
          phase4: { ...emptyPhaseScore },
          overall: 0,
        },
        missedOpportunities: [],
        summaryMarkdown: `Dit gesprek bevat slechts ${sellerTurns.length} verkoper-beurten. Voor een volledige analyse heb je minstens ${MIN_SELLER_TURNS_FOR_ANALYSIS} beurten nodig. Oefen verder met Hugo om meer feedback te krijgen!`,
        strengths: [],
        improvements: [],
        microExperiments: ['Oefen een volledig verkoopgesprek met Hugo — begin bij de opening en werk door naar een commitment.'],
        overallScore: 0,
      };

      const fullResult: FullAnalysisResult = {
        conversation: { ...job },
        transcript: turns,
        evaluations: [],
        signals: [],
        insights: simplifiedInsights,
        insufficientTurns: true,
      };

      analysisResults.set(conversationId, fullResult);
      try {
        await pool.query(
          `UPDATE conversation_analyses SET status = $1, completed_at = $2, result = $3 WHERE id = $4`,
          ['completed', new Date().toISOString(), JSON.stringify(fullResult), conversationId]
        );
      } catch (err: any) {
        console.warn('[ChatAnalysis] DB simplified update failed:', err.message);
      }
      return;
    }

    job.status = 'evaluating';
    analysisJobs.set(conversationId, { ...job });
    await persistStatusToDb(conversationId, 'evaluating');

    const evaluations = await evaluateSellerTurns(turns);
    const signals = await detectCustomerSignals(turns, evaluations);

    const phaseCoverage = calculatePhaseCoverage(evaluations, turns);
    const missedOpps = await detectMissedOpportunities(evaluations, signals, turns);

    const allDetectedTechIds = evaluations.flatMap(e => e.techniques.map(t => t.id));
    const uniqueTechIds = [...new Set(allDetectedTechIds)];
    const ssotContext = buildSSOTContextForEvaluation(uniqueTechIds);
    console.log(`[ChatAnalysis] SSOT context built for ${uniqueTechIds.length} techniques`);

    let ragContext = '';
    try {
      const techNames = uniqueTechIds.slice(0, 3).map(id => {
        const t = getTechnique(id);
        return t ? t.naam : id;
      }).join(', ');
      const ragQuery = `verkooptechnieken feedback: ${techNames}`;
      const ragResult = await searchRag(ragQuery, { limit: 3, threshold: 0.25 });
      if (ragResult.documents.length > 0) {
        ragContext = '\nRAG GROUNDING (cursusmateriaal & eerdere correcties):\n' +
          ragResult.documents.map(d => `- [${d.docType}] ${d.title}: ${d.content.substring(0, 200)}`).join('\n');
        console.log(`[ChatAnalysis] RAG returned ${ragResult.documents.length} docs in ${ragResult.searchTimeMs}ms`);
      }
    } catch (ragErr: any) {
      console.warn('[ChatAnalysis] RAG search failed (non-fatal):', ragErr.message);
    }

    job.status = 'generating_report';
    analysisJobs.set(conversationId, { ...job });
    await persistStatusToDb(conversationId, 'generating_report');
    const insights = await generateCoachReport(turns, evaluations, signals, phaseCoverage, missedOpps, ssotContext, ragContext);

    const { coachDebrief, moments } = await generateCoachArtifacts(turns, evaluations, signals, phaseCoverage, missedOpps, insights, ssotContext, ragContext);
    insights.coachDebrief = coachDebrief;
    insights.moments = moments;

    try {
      const detailedMetrics = await computeDetailedMetrics(turns, evaluations, signals, phaseCoverage);
      insights.detailedMetrics = detailedMetrics;
    } catch (err: any) {
      console.warn('[ChatAnalysis] Detailed metrics computation failed (non-fatal):', err.message);
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    analysisJobs.set(conversationId, { ...job });

    const fullResult: FullAnalysisResult = {
      conversation: { ...job },
      transcript: turns,
      evaluations,
      signals,
      insights,
    };

    analysisResults.set(conversationId, fullResult);

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, completed_at = $2, result = $3 WHERE id = $4`,
        ['completed', new Date().toISOString(), JSON.stringify(fullResult), conversationId]
      );
    } catch (err: any) {
      console.warn('[ChatAnalysis] DB completed update failed:', err.message);
    }

    console.log(`[ChatAnalysis] Completed analysis for session ${conversationId}`);
  } catch (err: any) {
    console.error(`[ChatAnalysis] Failed for session ${conversationId}:`, err.message);
    job.status = 'failed';
    job.error = err.message || 'Onbekende fout';
    analysisJobs.set(conversationId, { ...job });

    try {
      await pool.query(
        `UPDATE conversation_analyses SET status = $1, error = $2 WHERE id = $3`,
        ['failed', err.message || 'Onbekende fout', conversationId]
      );
    } catch (dbErr: any) {
      console.warn('[ChatAnalysis] DB error update failed:', dbErr.message);
    }
  }
}
