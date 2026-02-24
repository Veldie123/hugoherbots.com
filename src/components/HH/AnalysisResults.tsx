import { AppLayout } from "./AppLayout";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { ChatBubble } from "./ChatBubble";
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Target,
  BarChart3,
  Loader2,
  MessageSquare,
  Calendar,
  Clock,
  Trophy,
  Wrench,
  RotateCcw,
  Sparkles,
  ArrowRight,
  X,
  Pencil,
  Save,
  AlertTriangle,
  Layers,
  Zap,
  Users,
  Scale,
  CheckCircle,
  Circle,
  Copy,
  Check,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import MuxPlayer from "@mux/mux-player-react";
import { getTechniekByNummer, getAllTechnieken, getTechniekenByFase } from "../../data/technieken-service";
import { useTheme } from "./ThemeProvider";

interface AnalysisResultsProps {
  navigate?: (page: string, data?: any) => void;
  analysisId?: string;
  isPreview?: boolean;
  isAdmin?: boolean;
  navigationData?: { conversationId?: string; fromAdmin?: boolean; autoLoadFirst?: boolean };
}

interface TranscriptTurn {
  idx: number;
  startMs: number;
  endMs: number;
  speaker: 'seller' | 'customer';
  text: string;
}

interface TurnEvaluation {
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

interface CustomerSignalResult {
  turnIdx: number;
  houding: string;
  confidence: number;
  recommendedTechniqueIds: string[];
  currentPhase?: number;
}

interface PhaseScore {
  score: number;
  techniquesFound: Array<{ id: string; naam: string; quality: string; count: number }>;
  totalPossible: number;
}

interface PhaseCoverage {
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

interface MissedOpportunity {
  turnIdx: number;
  type: string;
  description: string;
  sellerSaid: string;
  customerSaid: string;
  betterQuestion: string;
}

interface CoachMoment {
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
  replay: {
    startTurnIndex: number;
    contextTurns: number;
  };
}

interface CoachDebriefMessage {
  type: 'coach_text' | 'moment_ref' | 'scoreboard';
  text?: string;
  momentId?: string;
  cta?: string[];
}

interface CoachDebrief {
  oneliner: string;
  epicMomentum: string;
  messages: CoachDebriefMessage[];
}

interface DetailedMetrics {
  structure: {
    phaseFlow: {
      transitions: Array<{ turnIdx: number; fromPhase: number; toPhase: number; speaker: string }>;
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
  };
  impact: {
    baatenFound: Array<{ turnIdx: number; text: string; type: string; quality: string }>;
    pijnpuntenFound: number;
    pijnpuntenUsed: number;
    pijnpuntenDetails?: Array<{ turnIdx: number; text: string; usedInSolution: boolean }>;
    ovbChecks: Array<{ turnIdx: number; hasOplossing: boolean; hasVoordeel: boolean; hasBaat: boolean; quality: string; explanation: string }>;
    ovbQualityScore: number;
    commitBeforePhase3: boolean;
    commitmentDetail?: { summaryGiven: boolean; confirmationAsked: boolean; turnIdx?: number };
    overallScore: number;
  };
  houdingen: {
    phase2Recognition: { total: number; recognized: number; percent: number };
    phase3Treatment: { total: number; treated: number; style: string; percent: number };
    phase4Afritten: { total: number; treated: number; percent: number };
    matches: Array<{ turnIdx: number; houding: string; phase: number; recognized: boolean; treated: boolean; recommendedTechniques?: string[]; actualTechniques?: string[] }>;
    overallScore: number;
  };
  balance: {
    talkRatio: { sellerPercent: number; customerPercent: number; verdict: string };
    perspective: { wijIkCount: number; uJijCount: number; ratio: number; verdict: string };
    questionRatio: { questions: number; statements: number; ratio: number; phase2Ratio: number };
    clientLanguage: { termsPickedUp: number; examples: string[] };
    overallScore: number;
  };
}

interface AnalysisInsights {
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

interface FullAnalysisResult {
  conversation: {
    id: string;
    userId: string;
    title: string;
    type: string;
    status: string;
    createdAt: string;
    completedAt?: string;
  };
  transcript: TranscriptTurn[];
  evaluations: TurnEvaluation[];
  signals: CustomerSignalResult[];
  insights: AnalysisInsights;
}

const PHASE_LABELS: Record<number, { name: string; description: string; color: string; bgColor: string }> = {
  1: { name: 'Fase 1: Opening', description: 'Koopklimaat, Gentleman\'s Agreement, Instapvraag', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  2: { name: 'Fase 2: EPIC', description: 'Explore, Probe, Impact, Commitment', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  3: { name: 'Fase 3: Aanbeveling', description: 'O.V.B., USP\'s, Mening vragen', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  4: { name: 'Fase 4: Beslissing', description: 'Bezwaarbehandeling, Closing', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
};

function VideoRecommendationCard({ video, adminColors }: { video: any; adminColors: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const hasMux = !!video.muxPlaybackId;

  if (isPlaying && hasMux) {
    return (
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: adminColors ? '#9910FA20' : '#4F739620' }}>
        <div className="relative">
          <button
            onClick={() => setIsPlaying(false)}
            className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <MuxPlayer
            playbackId={video.muxPlaybackId}
            autoPlay
            style={{ width: '100%', aspectRatio: '16/9' }}
            streamType="on-demand"
            primaryColor="#3C9A6E"
            accentColor={adminColors ? '#9910FA' : '#3C9A6E'}
          />
        </div>
        <div className="px-3 py-2" style={{ backgroundColor: adminColors ? '#9910FA05' : '#4F739605' }}>
          <p className="text-[12px] font-medium text-hh-text truncate">{video.title}</p>
          <p className="text-[10px] text-hh-muted">{video.techniqueName}{video.durationSeconds ? ` · ${Math.round(video.durationSeconds / 60)} min` : ''}</p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => hasMux && setIsPlaying(true)}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all"
      style={{
        borderColor: adminColors ? '#9910FA15' : '#4F739615',
        backgroundColor: adminColors ? '#9910FA05' : '#4F739605',
        cursor: hasMux ? 'pointer' : 'default',
      }}
    >
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0 transition-transform"
        style={{
          width: 36, height: 36,
          backgroundColor: adminColors ? '#9910FA15' : '#3C9A6E15',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={adminColors ? '#9910FA' : '#3C9A6E'} stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-hh-text truncate">{video.title}</p>
        <p className="text-[10px] text-hh-muted">{video.techniqueName}{video.durationSeconds ? ` · ${Math.round(video.durationSeconds / 60)} min` : ''}</p>
      </div>
      {hasMux && <span className="text-[10px] font-medium flex-shrink-0" style={{ color: adminColors ? '#9910FA' : '#3C9A6E' }}>Afspelen</span>}
    </button>
  );
}

export function AnalysisResults({
  navigate,
  isPreview = false,
  isAdmin = false,
  navigationData,
}: AnalysisResultsProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"coach" | "timeline">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'timeline' ? 'timeline' : 'coach';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FullAnalysisResult | null>(null);
  const [expandedMoment, setExpandedMoment] = useState<string | null>(null);
  const [expandedMetricCategory, setExpandedMetricCategory] = useState<string | null>(null);
  const [expandedDetailDrilldown, setExpandedDetailDrilldown] = useState<string | null>(null);
  const conversationStorageKey = `viewedCoachMoments_${navigationData?.conversationId || sessionStorage.getItem('analysisId') || 'default'}`;
  const [viewedMoments, setViewedMoments] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(conversationStorageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const markMomentViewed = (momentId: string) => {
    setViewedMoments(prev => {
      const next = new Set(prev);
      next.add(momentId);
      try { localStorage.setItem(conversationStorageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ momentId: string; type: string; data: any } | null>(null);
  const [debriefExpanded, setDebriefExpanded] = useState(false);
  const [editingDebrief, setEditingDebrief] = useState(false);
  const [editedOneliner, setEditedOneliner] = useState('');
  const [editedEpicMomentum, setEditedEpicMomentum] = useState('');
  const [editingMomentId, setEditingMomentId] = useState<string | null>(null);
  const [editedMomentLabel, setEditedMomentLabel] = useState('');
  const [editedMomentWhy, setEditedMomentWhy] = useState('');
  const [editedMomentAlt, setEditedMomentAlt] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackConfirmed, setFeedbackConfirmed] = useState<Set<string>>(new Set());
  const [copiedTurnIdx, setCopiedTurnIdx] = useState<number | null>(null);
  const [goldenSaved, setGoldenSaved] = useState<Set<number>>(new Set());
  const [correctionPanelTurn, setCorrectionPanelTurn] = useState<number | null>(null);
  const [correctionType, setCorrectionType] = useState<'technique' | 'houding'>('technique');
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [percentileData, setPercentileData] = useState<{ percentile: number; totalAnalyses: number; period: string } | null>(null);
  const [percentilePeriod, setPercentilePeriod] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [expandedMatchCount, setExpandedMatchCount] = useState<Record<string, number>>({});
  const [regeneratingCoach, setRegeneratingCoach] = useState(false);
  const [coachRegenerated, setCoachRegenerated] = useState(false);

  const [resolvedConversationId, setResolvedConversationId] = useState<string | null>(
    navigationData?.conversationId || sessionStorage.getItem('analysisId') || null
  );

  const [processingStep, setProcessingStep] = useState<string | null>(null);

  const actionResultRef = useRef<HTMLDivElement>(null);

  const conversationId = resolvedConversationId;

  const submitCorrection = async (type: string, field: string, originalValue: string, newValue: string, context?: string) => {
    if (originalValue === newValue) return;
    setSubmittingCorrection(true);
    try {
      const response = await fetch('/api/v2/admin/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: result?.conversation?.id || conversationId,
          type,
          field,
          originalValue,
          newValue,
          context: context || `Analysis: ${result?.conversation?.title}`,
          submittedBy: 'admin',
        }),
      });
      if (response.ok) {
        toast?.('Correctie ingediend voor review', { description: 'Verschijnt in Config Review' });
      } else {
        toast?.('Fout bij indienen correctie');
      }
    } catch (err) {
      console.error('Correction submit error:', err);
      toast?.('Fout bij indienen correctie');
    } finally {
      setSubmittingCorrection(false);
      setEditingDebrief(false);
      setEditingMomentId(null);
    }
  };

  const handleCopyTurn = async (turnIdx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTurnIdx(turnIdx);
      setTimeout(() => setCopiedTurnIdx(null), 2000);
    } catch {
      toast?.('Kopiëren mislukt');
    }
  };

  const handleGoldenStandard = async (turn: TranscriptTurn) => {
    if (!conversationId || !result) return;
    const evaluation = result.evaluations.find(e => e.turnIdx === turn.idx);
    const signal = result.signals.find(s => s.turnIdx === turn.idx);
    try {
      const techniqueIds = evaluation?.techniques.map(t => t.id) || [];
      const res = await fetch('/api/v2/session/save-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: conversationId,
          techniqueId: techniqueIds[0] || 'unknown',
          message: turn.text,
          context: { evaluations: evaluation?.techniques, signal: signal?.houding, turnText: turn.text, speaker: turn.speaker },
          matchStatus: 'match',
          signal: signal?.houding || 'neutraal',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setGoldenSaved(prev => { const next = new Set(prev); next.add(turn.idx); return next; });
      toast?.('Opgeslagen als Golden Standard', { description: 'Dit voorbeeld wordt gebruikt om de AI te verbeteren' });
    } catch {
      toast?.('Opslaan mislukt');
    }
  };

  const handleCorrectionSubmit = async (turn: TranscriptTurn) => {
    if (!correctionValue || !conversationId || !result) return;
    setCorrectionSubmitting(true);
    try {
      const evaluation = result.evaluations.find(e => e.turnIdx === turn.idx);
      const signal = result.signals.find(s => s.turnIdx === turn.idx);
      const originalValue = correctionType === 'technique'
        ? evaluation?.techniques.map(t => `${t.id}:${t.quality}`).join(', ') || 'geen'
        : signal?.houding || 'neutraal';

      await fetch('/api/v2/admin/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: conversationId,
          type: correctionType,
          field: correctionType === 'technique' ? 'detected_technique' : 'houding',
          originalValue,
          newValue: correctionValue,
          context: `Turn ${turn.idx}: "${turn.text.substring(0, 80)}..."${correctionNote ? ` — ${correctionNote}` : ''}`,
          submittedBy: 'admin',
        }),
      });

      await fetch('/api/v2/session/save-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: conversationId,
          techniqueId: correctionType === 'technique' ? correctionValue : (evaluation?.techniques[0]?.id || 'unknown'),
          message: turn.text,
          context: { correctedBy: 'admin', correctionType, correctionNote, originalSignal: signal?.houding },
          matchStatus: 'mismatch',
          signal: correctionType === 'houding' ? correctionValue : (signal?.houding || 'neutraal'),
          detectedTechnique: evaluation?.techniques[0]?.id || undefined,
        }),
      });

      toast?.('Correctie ingediend', { description: 'Verschijnt in Config Review' });
      setCorrectionPanelTurn(null);
      setCorrectionValue('');
      setCorrectionNote('');
      setCorrectionType('technique');
    } catch {
      toast?.('Correctie indienen mislukt');
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  const KLANT_HOUDINGEN = [
    { id: 'positief', naam: 'Positief antwoord' },
    { id: 'negatief', naam: 'Negatief antwoord' },
    { id: 'vaag', naam: 'Schijninstemming' },
    { id: 'ontwijkend', naam: 'Te algemeen antwoord' },
    { id: 'vraag', naam: 'Vraag' },
    { id: 'twijfel', naam: 'Twijfel' },
    { id: 'bezwaar', naam: 'Bezwaar' },
    { id: 'uitstel', naam: 'Uitstel' },
    { id: 'angst', naam: 'Angst / Bezorgdheid' },
  ];

  useEffect(() => {
    if (navigationData?.conversationId && navigationData.conversationId !== resolvedConversationId) {
      setResolvedConversationId(navigationData.conversationId);
      setResult(null);
      setError(null);
      setLoading(true);
      setActiveTab("coach");
      setExpandedMoment(null);
      setActionLoading(null);
      setActionResult(null);
    }
  }, [navigationData?.conversationId]);

  useEffect(() => {
    if (resolvedConversationId) return;
    if (!navigationData?.autoLoadFirst) {
      setError('Geen analyse ID gevonden');
      setLoading(false);
      return;
    }
    const loadFirst = async () => {
      try {
        const res = await fetch('/api/v2/analysis/list?source=upload');
        if (!res.ok) { setError('Kon analyses niet ophalen'); setLoading(false); return; }
        const data = await res.json();
        const analyses = data.analyses || [];
        if (analyses.length > 0) {
          setResolvedConversationId(analyses[0].id);
        } else {
          setError('Geen analyses gevonden');
          setLoading(false);
        }
      } catch {
        setError('Kon analyses niet ophalen');
        setLoading(false);
      }
    };
    loadFirst();
  }, [resolvedConversationId, navigationData?.autoLoadFirst]);

  useEffect(() => {
    if (!resolvedConversationId) {
      return;
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/v2/analysis/results/${resolvedConversationId}`);
        const data = await response.json();

        if (response.status === 202) {
          const statusLabels: Record<string, string> = {
            'transcribing': 'Transcriberen...',
            'analyzing': 'Turns analyseren...',
            'evaluating': 'EPIC technieken evalueren...',
            'generating_report': 'Rapport genereren...',
          };
          setProcessingStep(statusLabels[data.status] || 'Bezig met verwerken...');

          if (!pollInterval) {
            pollInterval = setInterval(fetchResults, 3000);
          }
          return;
        }

        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }

        if (response.status === 404 && sessionStorage.getItem('analysisFromHugo') === 'true') {
          setProcessingStep('Analyse starten...');
          try {
            const triggerRes = await fetch('/api/v2/analysis/chat-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: resolvedConversationId }),
            });
            const triggerData = await triggerRes.json();
            if (triggerData.error) {
              setError(triggerData.error);
              setProcessingStep(null);
              setLoading(false);
              return;
            }
            if (!pollInterval) {
              pollInterval = setInterval(fetchResults, 3000);
            }
            return;
          } catch {
            setError('Kon analyse niet starten');
            setProcessingStep(null);
            setLoading(false);
            return;
          }
        }

        if (!response.ok) {
          setError(data.error || 'Resultaten ophalen mislukt');
          setLoading(false);
          return;
        }

        setResult(data);
        setProcessingStep(null);
        setLoading(false);
        sessionStorage.removeItem('analysisFromHugo');
      } catch (err) {
        if (pollInterval) clearInterval(pollInterval);
        setError('Kon resultaten niet ophalen');
        setLoading(false);
      }
    };

    fetchResults();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [resolvedConversationId]);

  useEffect(() => {
    if (!resolvedConversationId || !result) return;
    fetch(`/api/v2/analysis/percentile/${resolvedConversationId}?period=${percentilePeriod}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPercentileData(data); })
      .catch(() => {});
  }, [resolvedConversationId, result, percentilePeriod]);

  useEffect(() => {
    if (activeTab !== 'coach' || !result || regeneratingCoach || coachRegenerated) return;
    const moments = result.insights?.moments || [];
    if (moments.length > 0) return;
    if (!resolvedConversationId) return;
    
    setRegeneratingCoach(true);
    fetch(`/api/v2/analysis/regenerate-coach/${resolvedConversationId}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          // Refetch the full results to get updated data
          return fetch(`/api/v2/analysis/results/${resolvedConversationId}`)
            .then(r => r.json())
            .then(updatedData => {
              if (updatedData.insights) {
                setResult(updatedData);
              }
            });
        }
      })
      .catch(err => console.warn('[Coach] Regeneration failed:', err))
      .finally(() => {
        setRegeneratingCoach(false);
        setCoachRegenerated(true);
      });
  }, [activeTab, result, resolvedConversationId, regeneratingCoach, coachRegenerated]);

  useEffect(() => {
    if (result && (navigationData as any)?.scrollToDetail) {
      setTimeout(() => {
        document.getElementById('detailed-metrics')?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, 200);
    }
  }, [result, (navigationData as any)?.scrollToDetail]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-hh-success";
    if (score >= 50) return "text-hh-warn";
    return "text-hh-destructive";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-hh-success/10 border-hh-success/20";
    if (score >= 60) return "bg-hh-warn/10 border-hh-warn/20";
    return "bg-hh-destructive/10 border-hh-destructive/20";
  };

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'perfect': return { label: 'Perfect', color: 'bg-hh-success/10 text-hh-success border-hh-success/20' };
      case 'goed': return { label: 'Goed', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'bijna': return { label: 'Bijna', color: 'bg-hh-warn/10 text-hh-warn border-hh-warn/20' };
      case 'gemist': return { label: 'Gemist', color: 'bg-hh-destructive/10 text-hh-destructive border-hh-destructive/20' };
      default: return { label: quality, color: 'bg-hh-ui-100 text-hh-muted' };
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSignalLabel = (houding: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      'interesse': { label: 'Interesse', color: 'bg-hh-success/10 text-hh-success' },
      'akkoord': { label: 'Akkoord', color: 'bg-hh-success/10 text-hh-success' },
      'vraag': { label: 'Vraag', color: 'bg-blue-100 text-blue-700' },
      'twijfel': { label: 'Twijfel', color: 'bg-hh-warn/10 text-hh-warn' },
      'bezwaar': { label: 'Bezwaar', color: 'bg-hh-destructive/10 text-hh-destructive' },
      'uitstel': { label: 'Uitstel', color: 'bg-orange-100 text-orange-700' },
      'negatief': { label: 'Negatief', color: 'bg-hh-destructive/10 text-hh-destructive' },
      'vaag': { label: 'Vaag', color: 'bg-hh-warn/10 text-hh-warn' },
      'ontwijkend': { label: 'Ontwijkend', color: 'bg-orange-100 text-orange-700' },
      'neutraal': { label: 'Neutraal', color: 'bg-hh-ui-100 text-hh-muted' },
    };
    return labels[houding] || labels['neutraal'];
  };

  const getPhaseBadge = (turnIdx: number) => {
    const signal = result?.signals.find(s => s.turnIdx === turnIdx);
    const phase = signal?.currentPhase;
    if (!phase) {
      const eval_ = result?.evaluations.find(e => e.turnIdx === turnIdx);
      if (eval_ && eval_.techniques.length > 0) {
        const firstTech = eval_.techniques[0].id;
        if (firstTech.startsWith('0') || firstTech.startsWith('1')) return 1;
        if (firstTech.startsWith('2')) return 2;
        if (firstTech.startsWith('3')) return 3;
        if (firstTech.startsWith('4')) return 4;
      }
      return null;
    }
    return phase;
  };

  const determinePhaseForTurn = (turnIdx: number): number | null => {
    if (!result) return null;

    const signal = result.signals.find(s => s.turnIdx === turnIdx);
    if (signal?.currentPhase) return signal.currentPhase;

    const eval_ = result.evaluations.find(e => e.turnIdx === turnIdx);
    if (eval_ && eval_.techniques.length > 0) {
      const firstTech = eval_.techniques[0].id;
      if (firstTech.startsWith('0') || firstTech.startsWith('1')) return 1;
      if (firstTech.startsWith('2')) return 2;
      if (firstTech.startsWith('3')) return 3;
      if (firstTech.startsWith('4')) return 4;
    }

    const prevSignals = result.signals.filter(s => s.turnIdx < turnIdx && s.currentPhase);
    if (prevSignals.length > 0) {
      return prevSignals[prevSignals.length - 1].currentPhase!;
    }

    return 1;
  };

  const navigateToHugoForPractice = (techniqueIds: string[], label: string, momentTurnIdx?: number) => {
    if (navigate) {
      let transcriptTurns: Array<{ speaker: 'seller' | 'customer'; text: string }> = [];
      if (result?.transcript && momentTurnIdx !== undefined) {
        const endIdx = Math.min(result.transcript.length - 1, momentTurnIdx + 1);
        transcriptTurns = result.transcript.slice(0, endIdx + 1).map(t => ({
          speaker: t.speaker,
          text: t.text,
        }));
      }

      const techniqueNames = techniqueIds.map(id => {
        const t = getTechniekByNummer(id);
        return t ? `${id} ${t.naam}` : id;
      }).join(', ');

      const practiceContext = {
        mode: 'practice',
        techniqueIds,
        techniqueNames,
        practiceLabel: label,
        fromAnalysis: true,
        transcriptTurns,
        analysisTitle: result?.conversation?.title || '',
      };
      sessionStorage.setItem('hugoPracticeContext', JSON.stringify(practiceContext));
      navigate(useAdminLayout ? 'admin-chat-expert' : 'talk-to-hugo', practiceContext);
    }
  };

  const runCoachAction = async (momentId: string, actionType: string) => {
    if (!resolvedConversationId) return;
    setActionLoading(`${momentId}-${actionType}`);
    setActionResult(null);
    try {
      const res = await fetch('/api/v2/analysis/coach-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: resolvedConversationId, momentId, actionType }),
      });
      if (!res.ok) throw new Error('Action failed');
      const data = await res.json();
      setActionResult({ momentId, type: actionType, data });
      setTimeout(() => actionResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    } catch (err) {
      setActionResult({ momentId, type: actionType, data: { error: 'Er ging iets mis. Probeer het opnieuw.' } });
      setTimeout(() => actionResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
    setActionLoading(null);
  };

  const useAdminLayout = !!navigationData?.fromAdmin;
  const adminColors = useAdminLayout;
  const fromHugo = !useAdminLayout && sessionStorage.getItem('analysisFromHugo') === 'true';

  const wrapLayout = (children: React.ReactNode) => {
    if (useAdminLayout) {
      return <AdminLayout currentPage="admin-uploads" navigate={navigate as (page: string) => void}>{children}</AdminLayout>;
    }
    return <AppLayout currentPage={fromHugo ? "talk-to-hugo" : "analysis"} navigate={navigate} isAdmin={isAdmin}>{children}</AppLayout>;
  };

  if (loading || processingStep) {
    return wrapLayout(
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 5rem)' }}>
        <div className="text-center space-y-4">
          <Loader2 className={`w-8 h-8 ${adminColors ? 'text-purple-600' : 'text-hh-primary'} animate-spin mx-auto`} />
          <p className="text-hh-text font-medium">{processingStep || 'Resultaten laden...'}</p>
          {processingStep && (
            <p className="text-[14px] leading-[20px] text-hh-muted">
              Dit kan enkele minuten duren afhankelijk van de lengte van het gesprek.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error || !result) {
    return wrapLayout(
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 5rem)' }}>
        <div className="text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-hh-destructive mx-auto" />
          <p className="text-hh-text">{error || 'Geen resultaten gevonden'}</p>
          <Button variant="outline" onClick={() => {
            sessionStorage.removeItem('analysisFromHugo');
            navigate?.(fromHugo ? "hugo-overview" : "upload-analysis");
          }}>
            {fromHugo ? 'Terug naar Talk to Hugo' : 'Terug naar uploads'}
          </Button>
        </div>
      </div>
    );
  }

  const { conversation, transcript, evaluations, signals, insights } = result;

  if ((result as any).insufficientTurns) {
    const accentColor = adminColors ? '#9910FA' : '#3C9A6E';
    const accentBg = adminColors ? 'rgba(153,16,250,0.15)' : 'rgba(60,154,110,0.15)';
    const accentBgLight = adminColors ? 'rgba(153,16,250,0.08)' : 'rgba(60,154,110,0.08)';
    const accentBorder = adminColors ? 'rgba(153,16,250,0.2)' : 'rgba(60,154,110,0.2)';
    return wrapLayout(
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 5rem)' }}>
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: accentBg }}>
            <MessageSquare className="w-8 h-8" style={{ color: accentColor }} />
          </div>
          <h2 className="text-xl font-bold text-hh-text">Oefen verder!</h2>
          <p className="text-hh-muted text-sm leading-relaxed">
            {insights.summaryMarkdown}
          </p>
          <div className="rounded-xl p-4" style={{ backgroundColor: accentBgLight, border: `1px solid ${accentBorder}` }}>
            <p className="text-sm font-medium text-hh-text mb-2">Tip:</p>
            <p className="text-sm text-hh-muted">{insights.microExperiments?.[0] || 'Probeer een volledig gesprek te voeren met Hugo.'}</p>
          </div>
          <Button
            onClick={() => {
              sessionStorage.removeItem('analysisFromHugo');
              navigate?.(fromHugo ? 'talk-to-hugo' : 'upload-analysis');
            }}
            className="text-white"
            style={{ backgroundColor: accentColor }}
          >
            {fromHugo ? 'Verder oefenen met Hugo' : 'Terug naar uploads'}
          </Button>
        </div>
      </div>
    );
  }

  const { phaseCoverage, missedOpportunities, strengths: rawStrengths, improvements: rawImprovements, microExperiments, overallScore } = insights;

  const strengths = rawStrengths.length > 0 ? rawStrengths : evaluations
    .filter(e => e.techniques.some(t => t.quality === 'perfect' || t.quality === 'goed'))
    .slice(0, 5)
    .map(e => {
      const bestTech = e.techniques.find(t => t.quality === 'perfect') || e.techniques.find(t => t.quality === 'goed');
      const turn = transcript.find(t => t.idx === e.turnIdx);
      return {
        text: `${bestTech?.id} ${bestTech?.naam} – ${bestTech?.quality === 'perfect' ? 'perfect' : 'goed'} toegepast`,
        quote: (turn?.text && turn.text.length > 120 ? turn.text.substring(0, 120) + '...' : turn?.text || ''),
        turnIdx: e.turnIdx,
      };
    });

  const strengthTechIds = new Set(strengths.map(s => s.text.split(' ')[0]));

  const improvements = rawImprovements.length > 0 ? rawImprovements : [
    ...evaluations
      .filter(e => e.techniques.some(t => (t.quality === 'bijna' || t.quality === 'gemist') && !strengthTechIds.has(t.id)))
      .slice(0, 3)
      .map(e => {
        const weakTech = e.techniques.find(t => (t.quality === 'gemist' || t.quality === 'bijna') && !strengthTechIds.has(t.id)) || e.techniques.find(t => t.quality === 'gemist') || e.techniques.find(t => t.quality === 'bijna');
        const turn = transcript.find(t => t.idx === e.turnIdx);
        return {
          text: `${weakTech?.id} ${weakTech?.naam} – kan beter worden toegepast`,
          quote: (turn?.text && turn.text.length > 120 ? turn.text.substring(0, 120) + '...' : turn?.text || ''),
          turnIdx: e.turnIdx,
          betterApproach: '',
        };
      }),
    ...missedOpportunities.slice(0, 2).map(opp => ({
      text: opp.description,
      quote: (opp.sellerSaid && opp.sellerSaid.length > 120 ? opp.sellerSaid.substring(0, 120) + '...' : opp.sellerSaid || ''),
      turnIdx: opp.turnIdx,
      betterApproach: opp.betterQuestion,
    })),
  ].slice(0, 5);

  const phaseScores = [
    { phase: 1, label: 'Fase 1', sublabel: 'Opening', score: phaseCoverage?.phase1?.score ?? 0, data: phaseCoverage?.phase1 },
    { phase: 2, label: 'Fase 2', sublabel: 'EPIC', score: phaseCoverage?.phase2?.overall?.score ?? 0, data: phaseCoverage?.phase2?.overall },
    { phase: 3, label: 'Fase 3', sublabel: 'Aanbeveling', score: phaseCoverage?.phase3?.score ?? 0, data: phaseCoverage?.phase3 },
    { phase: 4, label: 'Fase 4', sublabel: 'Beslissing', score: phaseCoverage?.phase4?.score ?? 0, data: phaseCoverage?.phase4 },
  ];

  return wrapLayout(
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 overflow-y-auto h-[calc(100vh-4rem)]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem('analysisFromHugo');
                navigate?.(navigationData?.fromAdmin ? "admin-uploads" : fromHugo ? "hugo-overview" : "analysis");
              }}
              className="gap-1 -ml-2"
            >
              {fromHugo ? '← Terug naar Talk to Hugo' : '← Terug naar analyses'}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-6 sm:gap-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[26px] leading-[32px] sm:text-[30px] sm:leading-[38px] font-semibold text-hh-text tracking-tight">
                  {conversation.title}
                </h1>
                {useAdminLayout && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/v2/analysis/retry/${conversationId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                        const data = await res.json();
                        if (res.ok) {
                          toast?.('Analyse wordt opnieuw gestart...', { description: 'De pagina wordt automatisch ververst.' });
                          setTimeout(() => window.location.reload(), 2000);
                        } else {
                          toast?.('Fout', { description: data.error || 'Kon analyse niet opnieuw starten' });
                        }
                      } catch {
                        toast?.('Fout', { description: 'Netwerkfout bij opnieuw analyseren' });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg font-medium transition-colors border"
                    style={{ borderColor: adminColors ? '#E9D5FF' : 'var(--hh-border)', color: adminColors ? '#9910FA' : '#4F7396', backgroundColor: adminColors ? '#FAF5FF' : 'var(--hh-ui-50)' }}
                    title="Opnieuw analyseren"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Opnieuw analyseren
                  </button>
                )}
              </div>
              <p className="text-[13px] text-hh-muted mt-2 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(conversation.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-hh-border">·</span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {transcript.length} turns
                </span>
                {transcript.length > 0 && (
                  <>
                    <span className="text-hh-border">·</span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(transcript[transcript.length - 1].endMs)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative" style={{ width: '80px', height: '80px' }}>
                <svg width="80" height="80" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke={adminColors ? '#9910FA' : '#3C9A6E'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - overallScore / 100)}`}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-bold text-hh-text leading-none" style={{ fontSize: '22px' }}>{overallScore}%</span>
                </div>
              </div>
              {percentileData && percentileData.totalAnalyses >= 3 && (
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-hh-muted" style={{ fontSize: '12px' }}>
                    Top <span className="font-bold" style={{ color: adminColors ? '#9910FA' : '#3C9A6E' }}>{100 - percentileData.percentile > 0 ? 100 - percentileData.percentile : 1}%</span>
                  </span>
                  <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: 'var(--hh-border)' }}>
                    {(['week', 'month', 'year', 'all'] as const).map((p, idx) => (
                      <button
                        key={p}
                        onClick={() => setPercentilePeriod(p)}
                        className="transition-all cursor-pointer"
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          backgroundColor: percentilePeriod === p ? (adminColors ? '#9910FA' : '#3C9A6E') : 'var(--card)',
                          color: percentilePeriod === p ? '#FFFFFF' : 'var(--hh-muted)',
                          fontWeight: percentilePeriod === p ? 600 : 500,
                          borderRight: idx < 3 ? '1px solid var(--hh-border)' : 'none',
                        }}
                      >
                        {p === 'week' ? '7d' : p === 'month' ? '30d' : p === 'year' ? '1j' : 'alles'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pb-0">
          {[
            { value: 'coach', label: 'Coach View', icon: Sparkles },
            { value: 'timeline', label: 'Transcript + Evaluatie', icon: MessageSquare },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`px-4 py-2.5 text-[14px] font-medium rounded-full transition-colors flex items-center gap-2 ${
                activeTab !== tab.value ? 'hover:bg-hh-ui-100' : ''
              }`}
              style={activeTab === tab.value
                ? { backgroundColor: adminColors ? '#9910FA' : '#3C9A6E', color: 'white' }
                : { color: '#4B5563' }
              }
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'coach' && (<div className="max-w-[860px]">

          {regeneratingCoach && (
            <div className="flex items-center gap-3 p-4 rounded-xl mb-4" style={{ backgroundColor: 'var(--hh-ui-50)', border: '1px solid var(--hh-border)' }}>
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: adminColors ? '#9910FA' : '#3C9A6E' }} />
              <span className="text-[14px] text-hh-text">AI coaching momenten genereren...</span>
            </div>
          )}

          {/* SECTION: Coach Summary + Coaching Moments */}
          {(() => {
            const moments = insights.moments || [];
            const isDark = theme === 'dark';
            const momentConfig: Record<string, { icon: any; color: string; bg: string; iconBg: string; label: string }> = {
              'big_win': { 
                icon: Trophy, 
                color: isDark ? '#34D399' : '#047857', 
                bg: isDark ? '#064E3B' : '#ECFDF5', 
                iconBg: isDark ? '#065F46' : '#D1FAE5', 
                label: 'Big Win' 
              },
              'quick_fix': { 
                icon: Wrench, 
                color: isDark ? '#FBBF24' : '#B45309', 
                bg: isDark ? '#78350F' : '#FFFBEB', 
                iconBg: isDark ? '#92400E' : '#FEF3C7', 
                label: 'Quick Fix' 
              },
              'turning_point': { 
                icon: RotateCcw, 
                color: isDark ? '#FB7185' : '#BE123C', 
                bg: isDark ? '#881337' : '#FFF1F2', 
                iconBg: isDark ? '#9F1239' : '#FFE4E6', 
                label: 'Scharnierpunt' 
              },
            };

            return (
              <div className="space-y-4 mb-8 sm:mb-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4 sm:p-5 relative group flex flex-col justify-center" style={{ backgroundColor: 'var(--hh-ui-50)', border: '1px solid var(--hh-border)', borderLeft: adminColors ? '3px solid #9910FA' : '3px solid #3C9A6E' }}>
                    {useAdminLayout && editingDebrief ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedOneliner}
                          onChange={(e) => setEditedOneliner(e.target.value)}
                          className="w-full px-3 py-2 text-[13px] leading-[18px] border rounded-lg focus:outline-none focus:ring-2 resize-none"
                          style={{ borderColor: '#9910FA40', outlineColor: '#9910FA' }}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1.5 text-[12px] text-white" style={{ backgroundColor: '#9910FA' }} disabled={submittingCorrection}
                            onClick={() => {
                              submitCorrection('coach_debrief', 'oneliner', insights.coachDebrief?.oneliner || '', editedOneliner, 'Coach oneliner correctie');
                              if (editedEpicMomentum !== (insights.coachDebrief?.epicMomentum || '')) {
                                submitCorrection('coach_debrief', 'epicMomentum', insights.coachDebrief?.epicMomentum || '', editedEpicMomentum, 'EPIC momentum correctie');
                              }
                            }}
                          >
                            <Save className="w-3.5 h-3.5" /> Indienen
                          </Button>
                          <Button variant="outline" size="sm" className="text-[12px]" onClick={() => setEditingDebrief(false)}>Annuleren</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: adminColors ? '#9910FA15' : '#3C9A6E15' }}>
                            <Sparkles className="w-3.5 h-3.5" style={{ color: adminColors ? '#9910FA' : '#3C9A6E' }} />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: adminColors ? '#9910FA' : '#3C9A6E' }}>Coach Samenvatting</span>
                        </div>
                        <p className="text-[14px] sm:text-[15px] leading-[22px] sm:leading-[24px] text-hh-text font-medium" style={{ overflowWrap: 'break-word' }}>
                          {insights.coachDebrief?.oneliner || `Laten we je gesprek samen doornemen.`}
                        </p>
                        {useAdminLayout && (
                          <button
                            onClick={() => {
                              setEditedOneliner(insights.coachDebrief?.oneliner || '');
                              setEditedEpicMomentum(insights.coachDebrief?.epicMomentum || '');
                              setEditingDebrief(true);
                            }}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
                            style={{ backgroundColor: '#9910FA15', color: '#9910FA' }}
                            title="Correctie indienen"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                    {moments.slice(0, 4).map((moment) => {
                      const config = momentConfig[moment.type] || momentConfig['quick_fix'];
                      const MomentIcon = config.icon;
                      const isExpanded = expandedMoment === moment.id;

                      return (
                        <div key={moment.id} className="flex flex-col">
                          <button
                            onClick={() => { setExpandedMoment(isExpanded ? null : moment.id); markMomentViewed(moment.id); }}
                            className="text-left rounded-2xl p-4 transition-all group cursor-pointer flex-1"
                            style={{
                              backgroundColor: config.bg,
                              border: isExpanded ? `2px solid ${config.color}40` : '2px solid transparent',
                              boxShadow: isExpanded ? `0 4px 12px ${config.color}15` : 'none',
                            }}
                            onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: config.iconBg }}>
                                <MomentIcon className="w-3.5 h-3.5" style={{ color: config.color }} strokeWidth={1.75} />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>{config.label}</span>
                            </div>
                            <p className="text-[13px] leading-[19px] text-hh-text font-medium mb-2" style={{ overflowWrap: 'break-word' }}>
                              {moment.label}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-hh-muted">{moment.timestamp}</span>
                              <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: config.color }}>
                                Bekijk <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 rounded-2xl bg-card border border-hh-border p-4 space-y-3 shadow-sm" style={{ borderTop: `3px solid ${config.color}30` }}>
                              <p className="text-[13px] leading-[20px] text-hh-text/75" style={{ overflowWrap: 'break-word' }}>{moment.whyItMatters}</p>

                              {(moment.sellerText || moment.customerText) && (
                                <div className="rounded-xl bg-hh-ui-50 p-3 space-y-2">
                                  {moment.customerText && (
                                    <div className="flex justify-start">
                                      <div style={{ maxWidth: '80%' }}>
                                        <p className="text-[10px] font-medium text-hh-muted mb-0.5 px-1">Klant</p>
                                        <div className={`px-3 py-2 rounded-2xl rounded-bl-md text-[12px] leading-[17px] ${adminColors ? 'bg-purple-50 text-hh-text' : 'bg-hh-ui-50 text-hh-text'}`}>
                                          {moment.customerText.length > 200 ? moment.customerText.substring(0, 200) + '...' : moment.customerText}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {moment.sellerText && (
                                    <div className="flex justify-end">
                                      <div style={{ maxWidth: '80%' }}>
                                        <p className="text-[10px] font-medium text-hh-text mb-0.5 px-1 text-right">Jij</p>
                                        <div className={`px-3 py-2 rounded-2xl rounded-br-md text-[12px] leading-[17px] text-white ${adminColors ? 'bg-purple-600' : ''}`} style={!adminColors ? { backgroundColor: '#4F7396' } : undefined}>
                                          {moment.sellerText.length > 200 ? moment.sellerText.substring(0, 200) + '...' : moment.sellerText}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {moment.betterAlternative && moment.type !== 'big_win' && (
                                <div className="p-3 rounded-xl border" style={{ backgroundColor: adminColors ? '#9910FA08' : '#3C9A6E08', borderColor: adminColors ? '#9910FA15' : '#3C9A6E15' }}>
                                  <div className="flex gap-2 items-start">
                                    <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: adminColors ? '#9910FA' : '#3C9A6E' }} />
                                    <div>
                                      <p className="text-[11px] font-medium mb-0.5" style={{ color: adminColors ? '#9910FA' : '#3C9A6E' }}>Wat had je kunnen zeggen?</p>
                                      <p className="text-[13px] leading-[19px] text-hh-text">"{moment.betterAlternative}"</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {moment.recommendedTechniques.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                  {moment.recommendedTechniques.map((t, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                                      style={{ color: adminColors ? '#9910FA' : '#4F7396', borderColor: adminColors ? '#9910FA20' : '#4F739620', backgroundColor: adminColors ? '#9910FA08' : '#4F739608' }}
                                      title={t}
                                    >
                                      {getTechniekByNummer(t)?.naam || t}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {(moment as any).videoRecommendations?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[11px] font-medium" style={{ color: adminColors ? '#9910FA' : '#4F7396' }}>
                                    Aanbevolen trainingsmateriaal:
                                  </p>
                                  {(moment as any).videoRecommendations.map((video: any, vi: number) => (
                                    <VideoRecommendationCard key={vi} video={video} adminColors={adminColors} />
                                  ))}
                                </div>
                              )}

                              <div className="pt-2 border-t border-hh-border flex flex-wrap gap-2">
                                {moment.type !== 'big_win' && (
                                  <button
                                    className="inline-flex items-center gap-1.5 text-[12px] h-8 px-4 text-white rounded-lg font-medium transition-all"
                                    style={{ backgroundColor: adminColors ? '#9910FA' : '#3C9A6E' }}
                                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = adminColors ? '#7C3AED' : '#2D7F57')}
                                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = adminColors ? '#9910FA' : '#3C9A6E')}
                                    onClick={() => navigateToHugoForPractice(moment.recommendedTechniques || [], moment.label, moment.turnIndex)}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> Oefen met Hugo
                                  </button>
                                )}
                              </div>

                              {useAdminLayout && (
                                <div className="pt-2 border-t border-hh-border">
                                  {editingMomentId === moment.id ? (
                                    <div className="space-y-2">
                                      <div>
                                        <label className="text-[11px] font-medium mb-1 block" style={{ color: '#9910FA' }}>Moment label</label>
                                        <input value={editedMomentLabel} onChange={(e) => setEditedMomentLabel(e.target.value)} className="w-full px-3 py-1.5 text-[13px] border rounded-lg focus:outline-none focus:ring-2" style={{ borderColor: '#9910FA40' }} />
                                      </div>
                                      <div>
                                        <label className="text-[11px] font-medium mb-1 block" style={{ color: '#9910FA' }}>Waarom belangrijk</label>
                                        <textarea value={editedMomentWhy} onChange={(e) => setEditedMomentWhy(e.target.value)} className="w-full px-3 py-1.5 text-[13px] border rounded-lg focus:outline-none focus:ring-2 resize-none" style={{ borderColor: '#9910FA40' }} rows={2} />
                                      </div>
                                      {moment.betterAlternative && (
                                        <div>
                                          <label className="text-[11px] font-medium mb-1 block" style={{ color: '#9910FA' }}>Beter alternatief</label>
                                          <textarea value={editedMomentAlt} onChange={(e) => setEditedMomentAlt(e.target.value)} className="w-full px-3 py-1.5 text-[13px] border rounded-lg focus:outline-none focus:ring-2 resize-none" style={{ borderColor: '#9910FA40' }} rows={2} />
                                        </div>
                                      )}
                                      <div className="flex gap-2">
                                        <Button size="sm" className="gap-1.5 text-[12px] text-white" style={{ backgroundColor: '#9910FA' }} disabled={submittingCorrection}
                                          onClick={() => {
                                            if (editedMomentLabel !== moment.label) submitCorrection('moment', 'label', moment.label, editedMomentLabel, `Moment: ${moment.id}`);
                                            if (editedMomentWhy !== moment.whyItMatters) submitCorrection('moment', 'whyItMatters', moment.whyItMatters, editedMomentWhy, `Moment: ${moment.id}`);
                                            if (editedMomentAlt !== (moment.betterAlternative || '')) submitCorrection('moment', 'betterAlternative', moment.betterAlternative || '', editedMomentAlt, `Moment: ${moment.id}`);
                                          }}
                                        >
                                          <Save className="w-3.5 h-3.5" /> Indienen voor review
                                        </Button>
                                        <Button variant="outline" size="sm" className="text-[12px]" onClick={() => setEditingMomentId(null)}>Annuleren</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => { setEditingMomentId(moment.id); setEditedMomentLabel(moment.label); setEditedMomentWhy(moment.whyItMatters); setEditedMomentAlt(moment.betterAlternative || ''); }}
                                      className="flex items-center gap-1.5 text-[12px] font-medium"
                                      style={{ color: '#9910FA' }}
                                    >
                                      <Pencil className="w-3 h-3" /> Correctie indienen
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })()}

          {/* SECTION 3: Detailed Analysis — Fase-cards + Klanthoudingen + Impact + Balans */}
          {(() => {
            const dm = insights.detailedMetrics;
            if (!dm?.structure || !dm?.impact || !dm?.houdingen || !dm?.balance) return null;

            const accentColor = adminColors ? '#9910FA' : '#3C9A6E';
            const accentColorLight = adminColors ? '#9910FA15' : '#3C9A6E15';
            const accentColorBg = adminColors ? '#9910FA08' : '#3C9A6E08';

            const PHASE_COLORS: Record<number, string> = {
              1: '#3B82F6',
              2: '#10B981',
              3: '#8B5CF6',
              4: '#F59E0B',
            };

            const phaseDetails: Array<{ phase: number; label: string; sublabel: string; score: number; color: string; details: any[] }> = [
              {
                phase: 1, label: 'Fase 1: Opening', sublabel: 'Koopklimaat, GA, Instapvraag', score: phaseScores[0].score, color: PHASE_COLORS[1],
                details: [
                  {
                    label: 'Opening-stappen',
                    value: `${dm.structure.openingSequence?.stepsFound?.length ?? 0}/4 stappen`,
                    score: dm.structure.openingSequence?.completionPercent ?? 0,
                    sub: dm.structure.openingSequence?.correctOrder ? 'Correcte volgorde' : 'Volgorde kan beter',
                    kind: 'checklist' as const,
                    checklistItems: [
                      ...(dm.structure.openingSequence?.stepsFound || []).map((s: string) => ({ label: s, found: true })),
                      ...(dm.structure.openingSequence?.stepsMissing || []).map((s: string) => ({ label: s, found: false })),
                    ],
                  },
                  ...((phaseCoverage?.phase1 as any)?.techniquesFound?.length > 0 ? [{
                    label: 'Technieken herkend',
                    value: `${(phaseCoverage?.phase1 as any)?.techniquesFound?.length || 0} technieken`,
                    score: (phaseCoverage?.phase1 as any)?.score ?? 0,
                    sub: ((phaseCoverage?.phase1 as any)?.techniquesFound || []).map((t: any) => t.naam).join(', '),
                    kind: 'checklist' as const,
                    checklistItems: ((phaseCoverage?.phase1 as any)?.techniquesFound || []).map((t: any) => ({ label: `${t.naam} (${t.quality})`, found: t.quality !== 'gemist' })),
                  }] : []),
                ],
              },
              {
                phase: 2, label: 'Fase 2: EPIC', sublabel: 'Explore, Probe, Impact, Commit', score: phaseScores[1].score, color: PHASE_COLORS[2],
                details: [
                  {
                    label: 'EPIC-stappen',
                    value: `${dm.structure.epicSteps?.completionPercent ?? 0}%`,
                    score: dm.structure.epicSteps?.completionPercent ?? 0,
                    sub: [
                      dm.structure.epicSteps?.explore ? 'Explore ✓' : 'Explore ✗',
                      dm.structure.epicSteps?.probe ? 'Probe ✓' : 'Probe ✗',
                      dm.structure.epicSteps?.impact ? 'Impact ✓' : 'Impact ✗',
                      dm.structure.epicSteps?.commit ? 'Commit ✓' : 'Commit ✗',
                    ].join(' · '),
                    kind: 'checklist' as const,
                    checklistItems: [
                      { label: 'Explore: breed ontdekken', found: !!dm.structure.epicSteps?.explore },
                      { label: 'Probe: doorvragen', found: !!dm.structure.epicSteps?.probe },
                      { label: 'Impact: gevolgen benoemen', found: !!dm.structure.epicSteps?.impact },
                      { label: 'Commit: commitment vragen', found: !!dm.structure.epicSteps?.commit },
                    ],
                  },
                  {
                    label: 'Explore-dekking',
                    value: `${dm.structure.exploreCoverage?.themesFound?.length ?? 0}/8 thema's`,
                    score: dm.structure.exploreCoverage?.coveragePercent ?? 0,
                    sub: (dm.structure.exploreCoverage?.themesMissing?.length ?? 0) > 0
                      ? `Missend: ${(dm.structure.exploreCoverage?.themesMissing || []).join(', ')}`
                      : 'Alle thema\'s aangeraakt',
                    kind: 'checklist' as const,
                    checklistItems: [
                      ...(dm.structure.exploreCoverage?.themesFound || []).map((t: string) => ({ label: t, found: true })),
                      ...(dm.structure.exploreCoverage?.themesMissing || []).map((t: string) => ({ label: t, found: false })),
                    ],
                  },
                  ...((phaseCoverage?.phase2 as any)?.overall?.techniquesFound?.length > 0 ? [{
                    label: 'Technieken herkend',
                    value: `${(phaseCoverage?.phase2 as any)?.overall?.techniquesFound?.length || 0} technieken`,
                    score: (phaseCoverage?.phase2 as any)?.overall?.score ?? 0,
                    sub: ((phaseCoverage?.phase2 as any)?.overall?.techniquesFound || []).slice(0, 4).map((t: any) => t.naam).join(', '),
                    kind: 'checklist' as const,
                    checklistItems: ((phaseCoverage?.phase2 as any)?.overall?.techniquesFound || []).map((t: any) => ({ label: `${t.naam} (${t.quality})`, found: t.quality !== 'gemist' })),
                  }] : []),
                ],
              },
              {
                phase: 3, label: 'Fase 3: Aanbeveling', sublabel: 'O.V.B., USP, Mening vragen', score: phaseScores[2].score, color: PHASE_COLORS[3],
                details: [
                  {
                    label: 'O.V.B. kwaliteit',
                    value: dm.impact.ovbQualityScore > 0 ? `${dm.impact.ovbQualityScore}%` : 'Geen O.V.B.',
                    score: dm.impact.ovbQualityScore,
                    sub: dm.impact.ovbChecks.length > 0 ? `${dm.impact.ovbChecks.length} O.V.B. checks` : 'Geen Oplossing-Voordeel-Baat structuur gevonden',
                    kind: 'checklist' as const,
                    checklistItems: dm.impact.ovbChecks.length > 0
                      ? dm.impact.ovbChecks.slice(0, 3).map((c: any) => ({
                          label: c.explanation || `Beurt ${c.turnIdx + 1}`,
                          found: c.hasOplossing && c.hasVoordeel && c.hasBaat,
                        }))
                      : [
                          { label: 'Oplossing benoemd', found: false },
                          { label: 'Voordeel vertaald', found: false },
                          { label: 'Baat voor klant', found: false },
                        ],
                  },
                  {
                    label: 'Commitment vóór aanbeveling',
                    value: dm.impact.commitBeforePhase3 ? 'Ja' : 'Nee',
                    score: dm.impact.commitBeforePhase3 ? 100 : 0,
                    sub: dm.impact.commitBeforePhase3 ? 'Klant bevestigde begrip' : 'Geen commitment gevraagd vóór aanbeveling',
                    kind: 'checklist' as const,
                    checklistItems: dm.impact.commitmentDetail
                      ? [
                          { label: 'Samenvatting gegeven', found: dm.impact.commitmentDetail.summaryGiven },
                          { label: 'Bevestiging gevraagd', found: dm.impact.commitmentDetail.confirmationAsked },
                        ]
                      : [
                          { label: 'Commitment gedetecteerd', found: dm.impact.commitBeforePhase3 },
                        ],
                  },
                  ...((phaseCoverage?.phase3 as any)?.techniquesFound?.length > 0 ? [{
                    label: 'Technieken herkend',
                    value: `${(phaseCoverage?.phase3 as any)?.techniquesFound?.length || 0} technieken`,
                    score: (phaseCoverage?.phase3 as any)?.score ?? 0,
                    sub: ((phaseCoverage?.phase3 as any)?.techniquesFound || []).map((t: any) => t.naam).join(', '),
                    kind: 'checklist' as const,
                    checklistItems: ((phaseCoverage?.phase3 as any)?.techniquesFound || []).map((t: any) => ({ label: `${t.naam} (${t.quality})`, found: t.quality !== 'gemist' })),
                  }] : []),
                ],
              },
              {
                phase: 4, label: 'Fase 4: Beslissing', sublabel: 'Bezwaarbehandeling, Closing', score: phaseScores[3].score, color: PHASE_COLORS[4],
                details: [
                  ...((phaseCoverage?.phase4 as any)?.techniquesFound?.length > 0 ? [{
                    label: 'Technieken herkend',
                    value: `${(phaseCoverage?.phase4 as any)?.techniquesFound?.length || 0} technieken`,
                    score: (phaseCoverage?.phase4 as any)?.score ?? 0,
                    sub: ((phaseCoverage?.phase4 as any)?.techniquesFound || []).map((t: any) => t.naam).join(', '),
                    kind: 'checklist' as const,
                    checklistItems: ((phaseCoverage?.phase4 as any)?.techniquesFound || []).map((t: any) => ({ label: `${t.naam} (${t.quality})`, found: t.quality !== 'gemist' })),
                  }] : [{
                    label: 'Closing technieken',
                    value: 'Geen herkend',
                    score: 0,
                    sub: 'Geen closing technieken gedetecteerd',
                    kind: 'checklist' as const,
                    checklistItems: [
                      { label: 'Closing vraag gesteld', found: false },
                      { label: 'Volgende stap afgesproken', found: false },
                    ],
                  }]),
                ],
              },
            ];

            const analysisCategories = [
              {
                key: 'houdingen',
                icon: Users,
                label: 'Klanthoudingen',
                sublabel: 'Herkenning & behandeling',
                score: dm.houdingen.overallScore,
                color: '#EF4444',
                details: [
                  {
                    label: 'Herkenning (Fase 2)',
                    value: dm.houdingen.phase2Recognition.total > 0
                      ? `${dm.houdingen.phase2Recognition.recognized}/${dm.houdingen.phase2Recognition.total} herkend`
                      : 'Geen signalen in fase 2',
                    score: dm.houdingen.phase2Recognition.percent,
                    sub: dm.houdingen.phase2Recognition.total > 0
                      ? `${dm.houdingen.phase2Recognition.percent}% van klantsignalen opgepikt`
                      : 'Geen klantsignalen gedetecteerd in ontdekkingsfase',
                    matches: dm.houdingen.matches.filter((m: any) => m.phase === 2),
                    kind: 'recognition' as const,
                  },
                  {
                    label: 'Behandeling (Fase 3)',
                    value: dm.houdingen.phase3Treatment.total > 0
                      ? `${dm.houdingen.phase3Treatment.treated}/${dm.houdingen.phase3Treatment.total} behandeld`
                      : 'Geen bezwaren in fase 3',
                    score: dm.houdingen.phase3Treatment.percent,
                    sub: dm.houdingen.phase3Treatment.style !== 'geen'
                      ? `Stijl: ${dm.houdingen.phase3Treatment.style === 'empathisch' ? 'Empathisch (goed)' : dm.houdingen.phase3Treatment.style === 'technisch' ? 'Technisch (verbeterpunt)' : 'Gemengd'}`
                      : '',
                    ...(dm.houdingen.matches.filter((m: any) => m.phase === 3).length > 0
                      ? { matches: dm.houdingen.matches.filter((m: any) => m.phase === 3), kind: 'treatment' as const }
                      : { kind: 'checklist' as const, checklistItems: [{ label: 'Bezwaren gedetecteerd', found: false }, { label: 'Empathisch behandeld', found: false }] }
                    ),
                  },
                  {
                    label: 'Afritten (Fase 4)',
                    value: dm.houdingen.phase4Afritten.total > 0
                      ? `${dm.houdingen.phase4Afritten.treated}/${dm.houdingen.phase4Afritten.total} behandeld`
                      : 'Geen afritten in fase 4',
                    score: dm.houdingen.phase4Afritten.percent,
                    sub: dm.houdingen.phase4Afritten.total > 0
                      ? 'Vragen, twijfels, bezwaren, uitstel'
                      : 'Geen weerstand gedetecteerd in beslissingsfase',
                    ...(dm.houdingen.matches.filter((m: any) => m.phase === 4).length > 0
                      ? { matches: dm.houdingen.matches.filter((m: any) => m.phase === 4), kind: 'treatment' as const }
                      : { kind: 'checklist' as const, checklistItems: [{ label: 'Vragen behandeld', found: false }, { label: 'Bezwaren overwonnen', found: false }] }
                    ),
                  },
                ],
              },
              {
                key: 'impact',
                icon: Zap,
                label: 'Impact & Baten',
                sublabel: 'Pijnpunten, voordelen & O.V.B.',
                score: dm.impact.overallScore,
                color: '#F97316',
                details: [
                  {
                    label: 'Pijnpunten gevonden',
                    value: dm.impact.pijnpuntenFound > 0 ? `${dm.impact.pijnpuntenUsed}/${dm.impact.pijnpuntenFound} gebruikt` : 'Geen gevonden',
                    score: dm.impact.pijnpuntenFound > 0 ? Math.round((dm.impact.pijnpuntenUsed / dm.impact.pijnpuntenFound) * 100) : 0,
                    sub: dm.impact.pijnpuntenFound > 0 ? 'Pijnpunten vertaald naar oplossing' : 'Geen pijnpunten gedetecteerd',
                    kind: 'checklist' as const,
                    checklistItems: dm.impact.pijnpuntenDetails?.slice(0, 5).map((p: any) => ({
                      label: p.text.length > 60 ? p.text.substring(0, 60) + '...' : p.text,
                      found: p.usedInSolution,
                    })) || [{ label: 'Pijnpunten besproken', found: false }, { label: 'Vertaald naar oplossing', found: false }],
                  },
                  {
                    label: 'Baten benoemd',
                    value: dm.impact.baatenFound.length > 0 ? `${dm.impact.baatenFound.length} baten` : 'Geen baten',
                    score: Math.min(100, dm.impact.baatenFound.length * 25),
                    sub: dm.impact.baatenFound.length > 0
                      ? dm.impact.baatenFound.slice(0, 2).map((b: any) => b.text.substring(0, 40)).join('; ')
                      : 'Geen concrete baten voor klant benoemd',
                    kind: 'checklist' as const,
                    checklistItems: dm.impact.baatenFound.length > 0
                      ? dm.impact.baatenFound.slice(0, 5).map((b: any) => ({
                          label: b.text.length > 50 ? b.text.substring(0, 50) + '...' : b.text,
                          found: b.quality === 'goed' || b.quality === 'perfect',
                        }))
                      : [{ label: 'Concrete baat benoemd', found: false }],
                  },
                ],
              },
              {
                key: 'balance',
                icon: Scale,
                label: 'Gespreksbalans',
                sublabel: 'Spreektijd, perspectief & vragen',
                score: dm.balance.overallScore,
                color: '#8B5CF6',
                details: [
                  {
                    label: 'Spreektijd',
                    value: `Verkoper ${dm.balance.talkRatio.sellerPercent}% — Klant ${dm.balance.talkRatio.customerPercent}%`,
                    score: dm.balance.talkRatio.verdict === 'goed' ? 100 : Math.max(0, 100 - Math.abs(dm.balance.talkRatio.sellerPercent - 50) * 2),
                    sub: dm.balance.talkRatio.verdict === 'te_veel_verkoper' ? 'Verkoper is te veel aan het woord'
                      : dm.balance.talkRatio.verdict === 'te_weinig_verkoper' ? 'Verkoper neemt te weinig initiatief'
                      : 'Goed evenwicht',
                    kind: 'checklist' as const,
                    checklistItems: [
                      { label: `Verkoper: ${dm.balance.talkRatio.sellerPercent}% spreektijd`, found: dm.balance.talkRatio.sellerPercent <= 60 },
                      { label: `Klant: ${dm.balance.talkRatio.customerPercent}% spreektijd`, found: dm.balance.talkRatio.customerPercent >= 40 },
                    ],
                  },
                  {
                    label: '"Wij/ik" vs "U/jij"',
                    value: `${dm.balance.perspective.uJijCount}x klant vs ${dm.balance.perspective.wijIkCount}x zelf`,
                    score: dm.balance.perspective.verdict === 'klantgericht' ? 100 : dm.balance.perspective.verdict === 'gemengd' ? 60 : 30,
                    sub: dm.balance.perspective.verdict === 'klantgericht' ? 'Spreekt vanuit klantperspectief'
                      : dm.balance.perspective.verdict === 'zelfgericht' ? 'Te veel "wij doen dit, wij bieden dat"'
                      : 'Gemengd perspectief',
                    kind: 'checklist' as const,
                    checklistItems: [
                      { label: `"U/jij" perspectief: ${dm.balance.perspective.uJijCount}x`, found: dm.balance.perspective.uJijCount > dm.balance.perspective.wijIkCount },
                      { label: `"Wij/ik" perspectief: ${dm.balance.perspective.wijIkCount}x`, found: dm.balance.perspective.wijIkCount < dm.balance.perspective.uJijCount },
                    ],
                  },
                  {
                    label: 'Vraag-ratio (Fase 2)',
                    value: `${Math.round(dm.balance.questionRatio.phase2Ratio * 100)}% vragen`,
                    score: Math.min(100, Math.round(dm.balance.questionRatio.phase2Ratio * 150)),
                    sub: dm.balance.questionRatio.phase2Ratio >= 0.5 ? 'Goede vraaghouding in ontdekking' : 'Meer vragen stellen in ontdekkingsfase',
                    kind: 'checklist' as const,
                    checklistItems: [
                      { label: `${dm.balance.questionRatio.questions} vragen gesteld`, found: dm.balance.questionRatio.questions > 5 },
                      { label: `${Math.round(dm.balance.questionRatio.phase2Ratio * 100)}% van uitingen zijn vragen`, found: dm.balance.questionRatio.phase2Ratio >= 0.5 },
                    ],
                  },
                  {
                    label: 'Klant-taal oppakken',
                    value: `${dm.balance.clientLanguage.termsPickedUp} termen`,
                    score: Math.min(100, dm.balance.clientLanguage.termsPickedUp * 20),
                    sub: dm.balance.clientLanguage.examples.length > 0
                      ? `Bijv: ${dm.balance.clientLanguage.examples.slice(0, 3).join(', ')}`
                      : 'Geen klanttermen hergebruikt',
                    kind: 'checklist' as const,
                    checklistItems: dm.balance.clientLanguage.examples.length > 0
                      ? dm.balance.clientLanguage.examples.slice(0, 4).map(term => ({ label: `"${term}"`, found: true }))
                      : [{ label: 'Klanttermen hergebruikt', found: false }],
                  },
                ],
              },
            ];

            const renderDetailDrilldown = (detail: any, drilldownKey: string, catColor: string) => {
              const hasMatches = detail.matches && detail.matches.length > 0;
              const hasChecklist = detail.kind === 'checklist' && detail.checklistItems && detail.checklistItems.length > 0;
              const isClickable = hasMatches || hasChecklist;
              const isDrilldownOpen = expandedDetailDrilldown === drilldownKey;
              const matchLimit = expandedMatchCount[drilldownKey] || 5;

              return (
                <div key={drilldownKey}>
                  <div
                    className={`flex items-start gap-2 sm:gap-3 py-2.5 ${isClickable ? 'cursor-pointer hover:bg-hh-ui-50 -mx-3 px-3 sm:-mx-4 sm:px-4 rounded-lg transition-colors' : ''}`}
                    onClick={isClickable ? () => setExpandedDetailDrilldown(isDrilldownOpen ? null : drilldownKey) : undefined}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {detail.score >= 70 ? (
                        <CheckCircle className="w-4 h-4" style={{ color: '#22C55E' }} />
                      ) : detail.score >= 30 ? (
                        <Circle className="w-4 h-4" style={{ color: '#F59E0B' }} />
                      ) : (
                        <XCircle className="w-4 h-4" style={{ color: '#EF4444' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[12px] sm:text-[13px] font-medium text-hh-text">{detail.label}</span>
                        <span className="text-[11px] sm:text-[12px] font-semibold text-right min-w-0 truncate" style={{
                          color: detail.score >= 70 ? '#22C55E' : detail.score >= 30 ? '#F59E0B' : '#EF4444',
                          maxWidth: '55%',
                        }}>{detail.value}</span>
                      </div>
                      {detail.sub && (
                        <p className="text-[10px] sm:text-[11px] text-hh-muted leading-[14px] sm:leading-[16px]">{detail.sub}</p>
                      )}
                      <div className="mt-1.5 h-1 rounded-full bg-hh-ui-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{
                          width: `${detail.score}%`,
                          backgroundColor: detail.score >= 70 ? '#22C55E' : detail.score >= 30 ? '#F59E0B' : '#EF4444'
                        }} />
                      </div>
                    </div>
                    {isClickable && (
                      <div className="flex-shrink-0 mt-0.5">
                        <ChevronRight className={`w-3.5 h-3.5 text-hh-muted transition-transform ${isDrilldownOpen ? 'rotate-90' : ''}`} />
                      </div>
                    )}
                  </div>

                  {isDrilldownOpen && hasChecklist && (
                    <div className="ml-2 sm:ml-4 mb-3 mt-2">
                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--hh-border)' }}>
                        <div className="divide-y" style={{ borderColor: 'var(--hh-ui-100)' }}>
                          {detail.checklistItems.map((item: any, cIdx: number) => (
                            <div key={cIdx} className="flex items-center gap-2.5 px-3 py-2" style={{ backgroundColor: item.found ? '#F0FDF4' : '#FEF2F2' }}>
                              {item.found ? (
                                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22C55E' }} />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                              )}
                              <span className="text-[12px] font-medium" style={{ color: item.found ? '#166534' : '#991B1B' }}>
                                {item.label}
                              </span>
                              <span className="ml-auto text-[10px] font-medium" style={{ color: item.found ? '#22C55E' : '#EF4444' }}>
                                {item.found ? 'Aanwezig' : 'Ontbreekt'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {isDrilldownOpen && hasMatches && (
                    <div className="ml-2 sm:ml-4 mb-3 mt-2 space-y-4">
                      {detail.matches.slice(0, matchLimit).map((match: any, mIdx: number) => {
                        const matchTurn = result?.transcript?.find((t: any) => t.idx === match.turnIdx);
                        const isRecognized = match.recognized;
                        const isTreated = match.treated;
                        const statusOk = detail.kind === 'recognition' ? isRecognized : isTreated;

                        const contextTurns = result?.transcript
                          ?.filter((t: any) => t.idx >= match.turnIdx - 2 && t.idx <= match.turnIdx + 1)
                          ?.sort((a: any, b: any) => a.idx - b.idx) || [];

                        return (
                          <div key={mIdx} className="rounded-xl border overflow-hidden" style={{ borderColor: statusOk ? '#BBF7D0' : '#FECACA' }}>
                            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: statusOk ? '#F0FDF4' : '#FEF2F2' }}>
                              {statusOk ? (
                                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22C55E' }} />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                              )}
                              <span className="text-[11px] font-semibold" style={{ color: statusOk ? '#166534' : '#991B1B' }}>
                                {statusOk
                                  ? (detail.kind === 'recognition' ? 'Herkend' : 'Behandeld')
                                  : (detail.kind === 'recognition' ? 'Gemist' : 'Niet behandeld')
                                }
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--hh-ui-100)', color: 'var(--hh-muted)' }}>
                                {match.houding || match.type || ''}
                              </span>
                              {matchTurn && (
                                <span className="text-[10px] text-hh-muted">
                                  Beurt {match.turnIdx + 1} · {formatTime(matchTurn.startMs)}
                                </span>
                              )}
                            </div>

                            <div className="px-3 py-2 space-y-2" style={{ backgroundColor: 'var(--hh-ui-50)' }}>
                              {contextTurns.map((ct: any) => {
                                const isHighlighted = ct.idx === match.turnIdx;
                                const isSeller = ct.speaker === 'seller';
                                return (
                                  <div key={ct.idx} className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}>
                                    <div className="max-w-[85%]">
                                      <div className={`flex items-center gap-1.5 mb-0.5 ${isSeller ? 'justify-end' : ''}`}>
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--hh-muted)' }}>
                                          {isSeller ? 'Jij' : 'Klant'}
                                        </span>
                                        <span className="text-[9px]" style={{ color: 'var(--hh-ui-300)' }}>
                                          {formatTime(ct.startMs)}
                                        </span>
                                      </div>
                                      <div
                                        className="px-3 py-2 text-[11px] sm:text-[12px] leading-[16px] sm:leading-[18px]"
                                        style={{
                                          borderRadius: isSeller ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                          backgroundColor: isHighlighted
                                            ? (statusOk ? '#DCFCE7' : '#FEE2E2')
                                            : (isSeller ? (adminColors ? '#F3E8FF' : 'var(--hh-ui-100)') : 'var(--card)'),
                                          border: isHighlighted
                                            ? `1.5px solid ${statusOk ? '#86EFAC' : '#FCA5A5'}`
                                            : '1px solid var(--hh-border)',
                                          color: 'var(--hh-ink)',
                                        }}
                                      >
                                        {ct.text.length > 250 ? ct.text.substring(0, 250) + '…' : ct.text}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {((!statusOk && match.recommendedTechniques?.length > 0) || (statusOk && match.actualTechniques?.length > 0)) && (
                              <div className="px-3 py-2 flex flex-wrap gap-1 items-center" style={{ backgroundColor: 'var(--hh-ui-50)', borderTop: '1px solid var(--hh-ui-100)' }}>
                                <span className="text-[10px] text-hh-muted">{statusOk ? 'Toegepast:' : 'Aanbevolen:'}</span>
                                {(statusOk ? match.actualTechniques : match.recommendedTechniques)?.map((tech: string, tIdx: number) => (
                                  <span key={tIdx} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{
                                    backgroundColor: statusOk ? '#DCFCE7' : '#DBEAFE',
                                    color: statusOk ? '#166534' : '#1E40AF',
                                  }}>
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {detail.matches.length > matchLimit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedMatchCount(prev => ({ ...prev, [drilldownKey]: matchLimit + 10 }));
                          }}
                          className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                          style={{ color: accentColor, backgroundColor: accentColorBg }}
                        >
                          Toon meer ({detail.matches.length - matchLimit} resterend)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div id="detailed-metrics" className="space-y-6 mb-8 sm:mb-12">
                <h3 className="text-[16px] font-semibold text-hh-text">Waar is nog werk?</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {phaseDetails.map((pd) => {
                    const isExpanded = expandedMetricCategory === `phase-${pd.phase}`;

                    return (
                      <div key={pd.phase} className="flex flex-col">
                        <button
                          onClick={() => setExpandedMetricCategory(isExpanded ? null : `phase-${pd.phase}`)}
                          className="text-left rounded-2xl p-4 sm:p-5 transition-all group cursor-pointer"
                          style={{
                            backgroundColor: 'var(--hh-ui-50)',
                            border: isExpanded ? `2px solid ${pd.color}30` : '2px solid var(--hh-ui-100)',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-[14px] font-semibold text-hh-text">{pd.label}</p>
                              <p className="text-[11px] text-hh-muted">{pd.sublabel}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[16px] font-bold" style={{ color: pd.score >= 60 ? pd.color : pd.score >= 30 ? '#F59E0B' : '#EF4444' }}>{pd.score}%</span>
                              <ChevronRight className={`w-4 h-4 text-hh-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-hh-ui-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{
                              width: `${pd.score}%`,
                              backgroundColor: pd.score >= 60 ? pd.color : pd.score >= 30 ? '#F59E0B' : '#EF4444'
                            }} />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 rounded-2xl bg-card border border-hh-border p-3 sm:p-4 space-y-0 shadow-sm">
                            {pd.details.map((detail: any, dIdx: number) => (
                              <div key={dIdx} style={dIdx < pd.details.length - 1 ? { borderBottom: '1px solid var(--hh-ui-100)' } : {}}>
                                {renderDetailDrilldown(detail, `phase-${pd.phase}-${dIdx}`, pd.color)}
                              </div>
                            ))}
                            <div className="pt-3 mt-2 border-t border-hh-border">
                              <button
                                className="inline-flex items-center gap-1.5 text-[12px] h-8 px-4 text-white rounded-lg font-medium transition-all"
                                style={{ backgroundColor: accentColor }}
                                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.opacity = '0.85')}
                                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.opacity = '1')}
                                onClick={() => {
                                  const phaseKey = `phase${pd.phase}` as string;
                                  const phaseTechs = (phaseCoverage as any)?.[phaseKey];
                                  const techsFound = phaseTechs?.techniquesFound || phaseTechs?.overall?.techniquesFound || [];
                                  const missedTechs = techsFound.filter((t: any) => t.quality === 'gemist').map((t: any) => t.id || t.nummer) || [];
                                  navigateToHugoForPractice(missedTechs, `${pd.label} verbeteren`);
                                }}
                              >
                                <Sparkles className="w-3.5 h-3.5" /> Oefen {pd.label.split(':')[1]?.trim() || pd.label} met Hugo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {analysisCategories.map((cat) => {
                    const CatIcon = cat.icon;
                    const isExpanded = expandedMetricCategory === cat.key;

                    return (
                      <div key={cat.key} className={`flex flex-col ${cat.key === 'balance' ? 'md:col-span-2' : ''}`}>
                        <button
                          onClick={() => setExpandedMetricCategory(isExpanded ? null : cat.key)}
                          className="text-left rounded-2xl p-3 sm:p-5 transition-all group cursor-pointer"
                          style={{
                            backgroundColor: 'var(--hh-ui-50)',
                            border: isExpanded ? `2px solid ${cat.color}30` : '2px solid var(--hh-ui-100)',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.color}15` }}>
                                <CatIcon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: cat.color }} strokeWidth={1.75} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] sm:text-[14px] font-semibold text-hh-text truncate">{cat.label}</p>
                                <p className="text-[10px] sm:text-[11px] text-hh-muted truncate">{cat.sublabel}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                              <span className="text-[16px] font-bold" style={{ color: cat.score >= 60 ? cat.color : cat.score >= 30 ? '#F59E0B' : '#EF4444' }}>{cat.score}%</span>
                              <ChevronRight className={`w-4 h-4 text-hh-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-hh-ui-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{
                              width: `${cat.score}%`,
                              backgroundColor: cat.score >= 60 ? cat.color : cat.score >= 30 ? '#F59E0B' : '#EF4444'
                            }} />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 rounded-2xl bg-card border border-hh-border p-3 sm:p-4 space-y-0 shadow-sm">
                            {cat.details.map((detail: any, dIdx: number) => (
                              <div key={dIdx} style={dIdx < cat.details.length - 1 ? { borderBottom: '1px solid var(--hh-ui-100)' } : {}}>
                                {renderDetailDrilldown(detail, `${cat.key}-${dIdx}`, cat.color)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* SECTION 4: Single primary action */}
          <div className="text-center">
            <button
              className="inline-flex items-center justify-center gap-2 text-[14px] h-11 px-6 text-white rounded-xl font-medium transition-all shadow-sm"
              style={{ backgroundColor: adminColors ? '#9910FA' : '#3C9A6E' }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = adminColors ? '#7C3AED' : '#2D7F57')}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.backgroundColor = adminColors ? '#9910FA' : '#3C9A6E')}
              onClick={() => {
                const analysisContext = {
                  analysisDiscussion: true,
                  conversationId: conversationId,
                  overallScore: result?.insights?.overallScore,
                  title: result?.conversation?.title,
                  summaryMarkdown: result?.insights?.summaryMarkdown,
                  strengths: result?.insights?.strengths?.slice(0, 3),
                  improvements: result?.insights?.improvements?.slice(0, 3),
                };
                navigate?.("talk-to-hugo", analysisContext);
              }}
            >
              <Sparkles className="w-4 h-4" /> Bespreek met Hugo <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>)}

          {activeTab === 'timeline' && (<div className="mt-6">
            <Card className="p-4 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border max-w-[780px]">
              <h3 className="text-hh-text mb-2">Transcript met EPIC Evaluatie</h3>
              <p className="text-[13px] sm:text-[14px] leading-[20px] text-hh-muted mb-6">
                Gesprek als chat met gedetecteerde technieken, klantsignalen en fase-indicatie
              </p>

              <div className="space-y-3">
                {(() => {
                  let lastPhase: number | null = null;

                  return transcript.map((turn) => {
                    const evaluation = evaluations.find(e => e.turnIdx === turn.idx);
                    const signal = signals.find(s => s.turnIdx === turn.idx);
                    const currentPhase = determinePhaseForTurn(turn.idx);
                    const showPhaseDivider = currentPhase !== null && currentPhase !== lastPhase;
                    if (currentPhase !== null) lastPhase = currentPhase;

                    return (
                      <div key={turn.idx}>
                        {showPhaseDivider && currentPhase && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-hh-border" />
                            <span className={`text-[12px] font-semibold px-3 py-1 rounded-full border ${PHASE_LABELS[currentPhase].bgColor} ${PHASE_LABELS[currentPhase].color}`}>
                              {PHASE_LABELS[currentPhase].name}
                            </span>
                            <span className="text-[11px] text-hh-muted hidden sm:inline">{PHASE_LABELS[currentPhase].description}</span>
                            <div className="flex-1 h-px bg-hh-border" />
                          </div>
                        )}
                        <ChatBubble
                          speaker={turn.speaker === 'seller' ? 'seller' : 'customer'}
                          text={turn.text}
                          timestamp={formatTime(turn.startMs)}
                          adminColors={adminColors}
                          variant="default"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {turn.speaker === 'customer' && signal && signal.houding !== 'neutraal' && (() => {
                                const badgeKey = `signal-${turn.idx}`;
                                const isConfirmed = feedbackConfirmed.has(badgeKey);
                                const isFeedbackPanelOpen = feedbackOpen === badgeKey;
                                return (
                                  <span className="relative inline-flex items-center group/badge">
                                    <Badge className={`${getSignalLabel(signal.houding).color} text-[10px] px-2 py-0.5`}>
                                      {getSignalLabel(signal.houding).label}
                                    </Badge>
                                    {useAdminLayout && !isConfirmed && (
                                      <span className="inline-flex items-center gap-0.5 ml-1 opacity-0 group-hover/badge:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            submitCorrection('signal', 'houding_confirmed', signal.houding, signal.houding, `Turn ${turn.idx}: ${signal.houding} bevestigd`);
                                            setFeedbackConfirmed(prev => { const next = new Set(prev); next.add(badgeKey); return next; });
                                          }}
                                          className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                                          style={{ color: 'var(--hh-muted)' }}
                                          onMouseEnter={(e) => { e.currentTarget.style.color = '#22C55E'; e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.08)'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--hh-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                          title="Klopt"
                                        >
                                          <ThumbsUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => { setFeedbackOpen(isFeedbackPanelOpen ? null : badgeKey); setFeedbackText(''); }}
                                          className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                                          style={{ color: isFeedbackPanelOpen ? '#EF4444' : 'var(--hh-muted)' }}
                                          onMouseEnter={(e) => { if (!isFeedbackPanelOpen) { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; } }}
                                          onMouseLeave={(e) => { if (!isFeedbackPanelOpen) { e.currentTarget.style.color = 'var(--hh-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
                                          title="Klopt niet"
                                        >
                                          <ThumbsDown className="w-3 h-3" />
                                        </button>
                                      </span>
                                    )}
                                    {isConfirmed && (
                                      <CheckCircle className="w-3 h-3 ml-1" style={{ color: '#22C55E' }} />
                                    )}
                                  </span>
                                );
                              })()}
                              {evaluation && evaluation.techniques.length > 0 && evaluation.techniques.map((tech, i) => {
                                const badge = getQualityBadge(tech.quality);
                                const badgeKey = `tech-${turn.idx}-${tech.id}`;
                                const isConfirmed = feedbackConfirmed.has(badgeKey);
                                const isFeedbackPanelOpen = feedbackOpen === badgeKey;
                                return (
                                  <span key={i} className="relative inline-flex items-center group/badge">
                                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${badge.color}`}>
                                      {tech.quality === 'gemist' ? '✗' : '✓'} {tech.naam || tech.id}
                                    </Badge>
                                    {useAdminLayout && !isConfirmed && (
                                      <span className="inline-flex items-center gap-0.5 ml-1 opacity-0 group-hover/badge:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            submitCorrection('technique', 'quality_confirmed', `${tech.id}:${tech.quality}`, `${tech.id}:${tech.quality}`, `Turn ${turn.idx}: ${tech.naam || tech.id} bevestigd`);
                                            setFeedbackConfirmed(prev => { const next = new Set(prev); next.add(badgeKey); return next; });
                                          }}
                                          className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                                          style={{ color: 'var(--hh-muted)' }}
                                          onMouseEnter={(e) => { e.currentTarget.style.color = '#22C55E'; e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.08)'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--hh-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                          title="Klopt"
                                        >
                                          <ThumbsUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => { setFeedbackOpen(isFeedbackPanelOpen ? null : badgeKey); setFeedbackText(''); }}
                                          className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                                          style={{ color: isFeedbackPanelOpen ? '#EF4444' : 'var(--hh-muted)' }}
                                          onMouseEnter={(e) => { if (!isFeedbackPanelOpen) { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; } }}
                                          onMouseLeave={(e) => { if (!isFeedbackPanelOpen) { e.currentTarget.style.color = 'var(--hh-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
                                          title="Klopt niet"
                                        >
                                          <ThumbsDown className="w-3 h-3" />
                                        </button>
                                      </span>
                                    )}
                                    {isConfirmed && (
                                      <CheckCircle className="w-3 h-3 ml-1" style={{ color: '#22C55E' }} />
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                            {useAdminLayout && feedbackOpen && (feedbackOpen === `signal-${turn.idx}` || feedbackOpen?.startsWith(`tech-${turn.idx}-`)) && (
                              <div className="rounded-lg border p-2.5 mt-1" style={{ backgroundColor: '#FEFCE8', borderColor: '#FDE68A' }}>
                                <p className="text-[10px] font-medium mb-1.5" style={{ color: '#92400E' }}>Wat zou het moeten zijn?</p>
                                <div className="flex gap-1.5 items-start">
                                  <input
                                    type="text"
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    placeholder="Typ correctie of selecteer techniek..."
                                    className="flex-1 text-[11px] px-2 py-1.5 rounded border bg-card min-w-0"
                                    style={{ borderColor: 'var(--hh-border)' }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && feedbackText.trim()) {
                                        const isSignal = feedbackOpen.startsWith('signal-');
                                        const turnIdx = parseInt(feedbackOpen.split('-')[1]);
                                        if (isSignal) {
                                          const sig = signals.find(s => s.turnIdx === turnIdx);
                                          submitCorrection('signal', 'houding', sig?.houding || '', feedbackText.trim(), `Turn ${turnIdx}: ${sig?.houding || ''} → ${feedbackText.trim()}`);
                                        } else {
                                          const techId = feedbackOpen.split('-').slice(2).join('-');
                                          const ev = evaluations.find(e => e.turnIdx === turnIdx);
                                          const tech = ev?.techniques.find(t => t.id === techId);
                                          submitCorrection('technique', 'quality', `${techId}:${tech?.quality || ''}`, feedbackText.trim(), `Turn ${turnIdx}: ${tech?.naam || techId} → ${feedbackText.trim()}`);
                                        }
                                        setFeedbackConfirmed(prev => { const next = new Set(prev); next.add(feedbackOpen); return next; });
                                        setFeedbackOpen(null);
                                        setFeedbackText('');
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => {
                                      if (!feedbackText.trim()) return;
                                      const isSignal = feedbackOpen.startsWith('signal-');
                                      const turnIdx = parseInt(feedbackOpen.split('-')[1]);
                                      if (isSignal) {
                                        const sig = signals.find(s => s.turnIdx === turnIdx);
                                        submitCorrection('signal', 'houding', sig?.houding || '', feedbackText.trim(), `Turn ${turnIdx}: ${sig?.houding || ''} → ${feedbackText.trim()}`);
                                      } else {
                                        const techId = feedbackOpen.split('-').slice(2).join('-');
                                        const ev = evaluations.find(e => e.turnIdx === turnIdx);
                                        const tech = ev?.techniques.find(t => t.id === techId);
                                        submitCorrection('technique', 'quality', `${techId}:${tech?.quality || ''}`, feedbackText.trim(), `Turn ${turnIdx}: ${tech?.naam || techId} → ${feedbackText.trim()}`);
                                      }
                                      setFeedbackConfirmed(prev => { const next = new Set(prev); next.add(feedbackOpen); return next; });
                                      setFeedbackOpen(null);
                                      setFeedbackText('');
                                    }}
                                    className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center"
                                    style={{ backgroundColor: '#9910FA', color: 'white' }}
                                    title="Correctie indienen"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { setFeedbackOpen(null); setFeedbackText(''); }}
                                    className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center"
                                    style={{ backgroundColor: 'var(--hh-ui-100)', color: 'var(--hh-muted)' }}
                                    title="Annuleren"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                            {useAdminLayout && (
                              <div className="flex items-center gap-0.5 mt-1">
                                <button
                                  onClick={() => handleCopyTurn(turn.idx, turn.text)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                  title="Kopieer"
                                >
                                  {copiedTurnIdx === turn.idx ? (
                                    <Check className="w-3.5 h-3.5" style={{ color: '#22C55E' }} />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleGoldenStandard(turn)}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    goldenSaved.has(turn.idx)
                                      ? 'text-green-600 bg-green-50'
                                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                  }`}
                                  title="Markeer als correct — Golden Standard"
                                  disabled={goldenSaved.has(turn.idx)}
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setCorrectionPanelTurn(correctionPanelTurn === turn.idx ? null : turn.idx);
                                    setCorrectionValue('');
                                    setCorrectionNote('');
                                    setCorrectionType('technique');
                                  }}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    correctionPanelTurn === turn.idx
                                      ? 'text-red-500 bg-red-50'
                                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                  }`}
                                  title="AI tag is fout — Corrigeer"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const lastCustomer = [...(result?.transcript || [])].reverse().find(t => t.speaker === 'customer' && t.idx < turn.idx);
                                    if (lastCustomer) {
                                      navigator.clipboard.writeText(`Klant: ${lastCustomer.text}\nVerkoper: ${turn.text}`);
                                      toast?.('Context gekopieerd');
                                    }
                                  }}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                  title="Kopieer met context"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const techIds = evaluation?.techniques.map(t => t.id) || [];
                                    if (techIds.length > 0) {
                                      const tech = getTechniekByNummer(techIds[0]);
                                      if (tech) toast?.(`${tech.naam}`, { description: tech.doel || tech.wat || '' });
                                    }
                                  }}
                                  className="p-1.5 rounded-md transition-colors hover:bg-purple-50"
                                  style={{ color: '#9910FA' }}
                                  title="Bekijk EPIC techniek"
                                >
                                  <Lightbulb className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            {useAdminLayout && correctionPanelTurn === turn.idx && (
                              <div className="rounded-xl border p-3 mt-2" style={{ backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }}>
                                <p className="text-[11px] font-semibold mb-2" style={{ color: '#7C3AED' }}>
                                  Welk type wil je corrigeren?
                                </p>
                                <div className="flex gap-2 mb-3">
                                  <button
                                    onClick={() => setCorrectionType('technique')}
                                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors"
                                    style={{
                                      backgroundColor: correctionType === 'technique' ? '#9910FA' : 'var(--hh-ui-100)',
                                      color: correctionType === 'technique' ? 'white' : 'var(--hh-muted)',
                                    }}
                                  >
                                    Techniek
                                  </button>
                                  <button
                                    onClick={() => setCorrectionType('houding')}
                                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors"
                                    style={{
                                      backgroundColor: correctionType === 'houding' ? '#9910FA' : 'var(--hh-ui-100)',
                                      color: correctionType === 'houding' ? 'white' : 'var(--hh-muted)',
                                    }}
                                  >
                                    Houding
                                  </button>
                                </div>
                                <div className="mb-2">
                                  <select
                                    value={correctionValue}
                                    onChange={(e) => setCorrectionValue(e.target.value)}
                                    className="w-full text-[12px] px-2.5 py-2 rounded-lg border bg-card"
                                    style={{ borderColor: '#E9D5FF' }}
                                  >
                                    <option value="">
                                      {correctionType === 'technique' ? 'Selecteer juiste techniek...' : 'Selecteer juiste houding...'}
                                    </option>
                                    {correctionType === 'technique' ? (
                                      <>
                                        {['Engagement', 'Probing', 'Influencing', 'Closing'].map((faseName, faseIdx) => {
                                          const faseNum = faseIdx + 1;
                                          const techs = getAllTechnieken().filter(t => t.fase === `${faseNum}` && !t.is_fase);
                                          if (techs.length === 0) return null;
                                          return (
                                            <optgroup key={faseName} label={`Fase ${faseNum}: ${faseName}`}>
                                              {techs.map(t => (
                                                <option key={t.nummer} value={t.nummer}>{t.nummer} — {t.naam}</option>
                                              ))}
                                            </optgroup>
                                          );
                                        })}
                                      </>
                                    ) : (
                                      KLANT_HOUDINGEN.map(h => (
                                        <option key={h.id} value={h.id}>{h.naam}</option>
                                      ))
                                    )}
                                  </select>
                                </div>
                                <input
                                  type="text"
                                  value={correctionNote}
                                  onChange={(e) => setCorrectionNote(e.target.value)}
                                  placeholder="Optionele toelichting..."
                                  className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border bg-card mb-2"
                                  style={{ borderColor: '#E9D5FF' }}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleCorrectionSubmit(turn)}
                                    disabled={!correctionValue || correctionSubmitting}
                                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
                                    style={{ backgroundColor: '#9910FA' }}
                                  >
                                    {correctionSubmitting ? 'Bezig...' : 'Indienen'}
                                  </button>
                                  <button
                                    onClick={() => { setCorrectionPanelTurn(null); setCorrectionValue(''); setCorrectionNote(''); }}
                                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors"
                                    style={{ backgroundColor: 'var(--hh-ui-100)', color: 'var(--hh-muted)' }}
                                  >
                                    Annuleren
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </ChatBubble>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          </div>)}

      </div>
  );
}