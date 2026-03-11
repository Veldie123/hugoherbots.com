import { useState, useRef, useCallback } from 'react';
import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "./EmptyState";
import { HeroBanner } from "./HeroBanner";
import { useHeroText } from "../../hooks/useHeroText";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  MessageSquare,
  Radio,
  Loader2,
  CheckCircle,
  UserPlus,
  Lock,
  BarChart3,
  Upload,
} from "lucide-react";
import { getDailyQuote } from "../../data/hugoQuotes";
import { useDashboardWebinars } from "../../hooks/useDashboardWebinars";
import { getFaseBadgeColors } from "../../utils/phaseColors";
import { useDashboardVideos } from "../../hooks/useDashboardVideos";
import { useDashboardUserData } from "../../hooks/useDashboardUserData";
import { useDashboardAnalyses } from "../../hooks/useDashboardAnalyses";
import { useDashboardSessions } from "../../hooks/useDashboardSessions";

interface DashboardProps {
  hasData?: boolean;
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
  isPreview?: boolean;
}

const ContentRow = ({
  title,
  icon: Icon,
  children,
  onSeeAll
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  onSeeAll?: () => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  return (
    <div className="space-y-3 min-w-0 group/row">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-hh-muted flex-shrink-0" />}
          <h2 className="text-[16px] sm:text-[18px] font-medium text-hh-text truncate">{title}</h2>
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="flex items-center gap-1 text-[12px] sm:text-[13px] text-hh-primary hover:text-hh-ink transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Alles bekijken</span>
            <span className="sm:hidden">Alle</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-0 top-0 bottom-2 z-10 w-10 items-center justify-center bg-gradient-to-r from-hh-bg via-hh-bg/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5 text-hh-text" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          onMouseEnter={checkScroll}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        >
          {children}
        </div>
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-0 top-0 bottom-2 z-10 w-10 items-center justify-center bg-gradient-to-l from-hh-bg via-hh-bg/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-5 h-5 text-hh-text" />
          </button>
        )}
      </div>
    </div>
  );
};

const VideoCard = ({ 
  title,
  fase,
  duration,
  progress,
  thumbnail,
  onClick,
  locked
}: {
  title: string;
  fase: string | number;
  duration: string;
  progress: number;
  thumbnail?: string;
  onClick?: () => void;
  locked?: boolean;
}) => (
  <div 
    style={{ width: 200, flexShrink: 0 }} className={`dashboard-card group ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    onClick={locked ? undefined : onClick}
  >
    <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-hh-text to-hh-primary/80 aspect-video mb-2">
      {thumbnail ? (
        <img src={thumbnail} alt={title} className={`w-full h-full object-cover ${locked ? 'grayscale' : ''}`} loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Play className="w-10 h-10 text-white/60" />
        </div>
      )}
      {progress > 0 && !locked && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div 
            className="h-full bg-hh-success" 
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {locked ? (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Lock className="w-6 h-6 text-white/80" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-6 h-6 ml-0.5" style={{ color: '#1e293b' }} />
          </div>
        </div>
      )}
    </div>
    <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors">
      {title}
    </h3>
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[11px] text-hh-muted">Fase {fase}</span>
      <span className="text-[11px] text-hh-muted">•</span>
      <span className="text-[11px] text-hh-muted flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {duration}
      </span>
    </div>
  </div>
);

const WEBINAR_IMAGES = [
  "/images/Hugo-Herbots-WEB-0081.JPG",
  "/images/Hugo-Herbots-WEB-0116.JPG",
  "/images/Hugo-Herbots-WEB-0251.JPG",
  "/images/Hugo-Herbots-WEB-0309.JPG",
  "/images/Hugo-Herbots-WEB-0368.JPG",
  "/images/Hugo-Herbots-WEB-0444.JPG",
  "/images/Hugo-Herbots-WEB-0555.JPG",
  "/images/Hugo-Herbots-WEB-0649.JPG",
  "/images/Hugo-Herbots-WEB-0732.JPG",
  "/images/Hugo-Herbots-WEB-0839.JPG",
];

const WebinarCard = ({
  title,
  date,
  time,
  isLive,
  isRegistered,
  isReplay,
  imageIndex = 0,
  onClick,
  onRegister
}: {
  title: string;
  date: string;
  time: string;
  isLive?: boolean;
  isRegistered?: boolean;
  isReplay?: boolean;
  imageIndex?: number;
  onClick?: () => void;
  onRegister?: () => void;
}) => (
  <div 
    style={{ width: 200, flexShrink: 0 }} className="dashboard-card group cursor-pointer"
    onClick={onClick}
  >
    <div className="relative rounded-lg overflow-hidden aspect-video mb-2">
      <img
        src={WEBINAR_IMAGES[imageIndex % WEBINAR_IMAGES.length]} 
        alt={title} 
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      {isLive && (
        <Badge className="absolute top-2 right-2 bg-hh-error text-white text-[10px] px-3 py-1 animate-pulse">
          LIVE
        </Badge>
      )}
      {isReplay && (
        <Badge className="absolute top-2 right-2 bg-hh-ink/80 text-white text-[10px] px-3 py-1">
          Opname
        </Badge>
      )}
      {isRegistered && !isLive && !isReplay && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-hh-success flex items-center justify-center">
          <span className="text-white text-[12px] font-bold">✓</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-6 h-6 ml-0.5" style={{ color: '#1e293b' }} />
        </div>
      </div>
    </div>
    <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors">
      {title}
    </h3>
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[11px] text-hh-muted flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {isReplay ? "Opgenomen" : date} • {time}
      </span>
    </div>
    {!isReplay && !isLive && onRegister && (
      <button
        onClick={(e) => { e.stopPropagation(); onRegister(); }}
        className={`mt-2 w-full text-[11px] font-medium py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
          isRegistered
            ? "bg-hh-success/10 text-hh-success cursor-default"
            : "bg-hh-success text-white hover:bg-hh-success/90"
        }`}
      >
        {isRegistered ? (
          <><CheckCircle className="w-3 h-3" /> Ingeschreven</>
        ) : (
          <><UserPlus className="w-3 h-3" /> Inschrijven</>
        )}
      </button>
    )}
  </div>
);

const HUGO_TRAINING_IMAGES = [
  "/images/Hugo-Herbots-WEB-0365.JPG",
  "/images/Hugo-Herbots-WEB-0399.JPG",
  "/images/Hugo-Herbots-WEB-0433.JPG",
  "/images/Hugo-Herbots-WEB-0476.JPG",
  "/images/Hugo-Herbots-WEB-0536.JPG",
  "/images/Hugo-Herbots-WEB-0576.JPG",
  "/images/Hugo-Herbots-WEB-0628.JPG",
  "/images/Hugo-Herbots-WEB-0676.JPG",
  "/images/Hugo-Herbots-WEB-0726.JPG",
  "/images/Hugo-Herbots-WEB-0761.JPG",
];

const HugoTrainingCard = ({
  title,
  fase,
  sessions,
  imageIndex = 0,
  onClick
}: {
  title: string;
  fase: number;
  sessions: number;
  imageIndex?: number;
  onClick?: () => void;
}) => {
  const faseColors = getFaseBadgeColors(String(fase));
  
  return (
    <div 
      style={{ width: 200, flexShrink: 0 }} className="dashboard-card group cursor-pointer"
      onClick={onClick}
    >
      <div className={`relative rounded-lg overflow-hidden aspect-video mb-2`}>
        <img
          src={HUGO_TRAINING_IMAGES[imageIndex % HUGO_TRAINING_IMAGES.length]} 
          alt={title} 
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-black/20" />
        <Badge className={`absolute top-2 right-2 ${faseColors.bg} ${faseColors.text} text-[10px] px-3 py-1`}>
          Fase {fase}
        </Badge>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-hh-ink" />
          </div>
        </div>
      </div>
      <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors">
        {title}
      </h3>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] text-hh-muted">{sessions} sessies</span>
      </div>
    </div>
  );
};

const ANALYSIS_IMAGES = [
  "/images/Hugo-Herbots-WEB-0102.JPG",
  "/images/Hugo-Herbots-WEB-0173.JPG",
  "/images/Hugo-Herbots-WEB-0244.JPG",
  "/images/Hugo-Herbots-WEB-0303.JPG",
  "/images/Hugo-Herbots-WEB-0342.JPG",
  "/images/Hugo-Herbots-WEB-0461.JPG",
  "/images/Hugo-Herbots-WEB-0566.JPG",
  "/images/Hugo-Herbots-WEB-0663.JPG",
  "/images/Hugo-Herbots-WEB-0749.JPG",
  "/images/Hugo-Herbots-WEB-0827.JPG",
];

const SESSION_IMAGES = [
  "/images/Hugo-Herbots-WEB-0115.JPG",
  "/images/Hugo-Herbots-WEB-0119.JPG",
  "/images/Hugo-Herbots-WEB-0197.JPG",
  "/images/Hugo-Herbots-WEB-0281.JPG",
  "/images/Hugo-Herbots-WEB-0350.JPG",
  "/images/Hugo-Herbots-WEB-0404.JPG",
  "/images/Hugo-Herbots-WEB-0580.JPG",
  "/images/Hugo-Herbots-WEB-0680.JPG",
  "/images/Hugo-Herbots-WEB-0789.JPG",
  "/images/Hugo-Herbots-WEB-0861.JPG",
];

const AnalysisCard = ({
  title,
  date,
  score,
  status,
  duration,
  imageIndex = 0,
  onClick
}: {
  title: string;
  date: string;
  score: number | null;
  status: string;
  duration: string;
  imageIndex?: number;
  onClick?: () => void;
}) => {
  const isProcessing = status !== 'completed' && status !== 'failed';
  const scoreColor = score !== null
    ? score >= 80 ? 'text-hh-success' : score >= 50 ? 'text-hh-warning' : 'text-hh-error'
    : 'text-hh-muted';

  return (
    <div
      style={{ width: 200, flexShrink: 0 }} className="dashboard-card group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative rounded-lg overflow-hidden aspect-video mb-2">
        <img
          src={ANALYSIS_IMAGES[imageIndex % ANALYSIS_IMAGES.length]}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover object-top"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-hh-ink" />
          </div>
        </div>
      </div>
      <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors">
        {title}
      </h3>
      <div className="flex items-center gap-2 mt-1">
        {isProcessing ? (
          <span className="text-[11px] text-hh-muted flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Bezig...
          </span>
        ) : status === 'failed' ? (
          <span className="text-[11px] text-hh-error font-medium">Mislukt</span>
        ) : score !== null ? (
          <span className={`text-[11px] font-medium ${scoreColor}`}>{score}%</span>
        ) : null}
        {!isProcessing && <span className="text-[11px] text-hh-muted">•</span>}
        <span className="text-[11px] text-hh-muted">{date}</span>
        {duration && (
          <>
            <span className="text-[11px] text-hh-muted">•</span>
            <span className="text-[11px] text-hh-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {duration}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

const SessionCard = ({
  title,
  date,
  score,
  type,
  imageIndex = 0,
  onClick
}: {
  title: string;
  date: string;
  score: number | null;
  type: string;
  imageIndex?: number;
  onClick?: () => void;
}) => {
  const typeLabel = type === 'ai-audio' ? 'Audio' : type === 'ai-video' ? 'Video' : 'Chat';

  return (
    <div
      style={{ width: 200, flexShrink: 0 }} className="dashboard-card group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative rounded-lg overflow-hidden aspect-video mb-2">
        <img
          src={SESSION_IMAGES[imageIndex % SESSION_IMAGES.length]}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover object-top"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-hh-ink" />
          </div>
        </div>
      </div>
      <h3 className="text-[12px] font-medium text-hh-text leading-tight line-clamp-2 group-hover:text-hh-primary transition-colors">
        {title}
      </h3>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] text-hh-muted">{typeLabel}</span>
        {score !== null && (
          <>
            <span className="text-[11px] text-hh-muted">•</span>
            <span className={`text-[11px] font-medium ${score >= 80 ? 'text-hh-success' : score >= 50 ? 'text-hh-warning' : 'text-hh-error'}`}>{score}%</span>
          </>
        )}
        <span className="text-[11px] text-hh-muted">•</span>
        <span className="text-[11px] text-hh-muted">{date}</span>
      </div>
    </div>
  );
};

export function Dashboard({ hasData: hasDataProp, navigate, isAdmin = false, isPreview = false, onboardingMode }: DashboardProps) {
  const { heroText } = useHeroText("dashboard", {
    badge: "Aanbevolen voor jou",
    title: "Welkom bij Hugo Herbots",
    subtitle: "Leer hoe je gerichte vragen stelt om de echte behoeften van je klant te ontdekken. Dit is de basis van elke succesvolle sale.",
  });
  const { videos: realVideos, featuredVideo, loading: videosLoading } = useDashboardVideos();
  const { firstName, loginStreak, phaseProgress, totalCompleted, totalVideos } = useDashboardUserData();
  const { upcomingWebinars, completedWebinars, loading: webinarsLoading } = useDashboardWebinars();
  const { analyses, loading: analysesLoading } = useDashboardAnalyses();
  const { sessions: hugoSessions, loading: sessionsLoading } = useDashboardSessions();
  const displayName = isPreview ? "" : firstName;

  // hasData: default true since dashboard always has shared content (videos, webinars)
  const hasData = hasDataProp ?? true;

  const getCompletedVideoIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem('hh_completed_videos');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  };
  const completedVideoIds = getCompletedVideoIds();
  const allCompleted = completedVideoIds.size > 0 && realVideos.length > 0 && realVideos.every(v => completedVideoIds.has(v.id));

  const isVideoUnlocked = (videoId: string): boolean => {
    if (isAdmin || allCompleted) return true;
    if (completedVideoIds.has(videoId)) return true;
    if (realVideos.length === 0) return true;
    if (realVideos[0].id === videoId) return true;
    const idx = realVideos.findIndex(v => v.id === videoId);
    if (idx <= 0) return true;
    return completedVideoIds.has(realVideos[idx - 1].id);
  };

  // Find where the user left off: first unwatched video, then show from there
  const firstUnwatchedIdx = realVideos.findIndex(v => !completedVideoIds.has(v.id));
  const startIdx = firstUnwatchedIdx > 0 ? firstUnwatchedIdx - 1 : 0; // include last watched
  const continueWatching = realVideos.slice(startIdx, startIdx + 12).map((v) => ({
    ...v,
    progress: completedVideoIds.has(v.id) ? 100 : 0,
  }));

  const hugoTrainings = [
    { nummer: "1.1", naam: "Eerste Indruk", fase: 1, sessions: 5 },
    { nummer: "2.1.1", naam: "Feitgerichte vragen", fase: 2, sessions: 12 },
    { nummer: "2.3.1", naam: "Actief Luisteren", fase: 2, sessions: 8 },
    { nummer: "3.1", naam: "Waarde Presentatie", fase: 3, sessions: 3 },
    { nummer: "4.1", naam: "Closing Techniques", fase: 4, sessions: 2 },
  ];

  if (!hasData) {
    return (
      <AppLayout currentPage="dashboard" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} isPreview={isPreview}>
        <div className="p-8">
          <EmptyState
            icon={MessageSquare}
            title="Klaar om te beginnen?"
            body="Praat met Hugo, je persoonlijke sales coach. Hij leert je kennen en helpt je direct op weg."
            primaryCta={{
              label: "Praat met Hugo",
              onClick: () => navigate?.("talk-to-hugo"),
            }}
            secondaryCta={{
              label: "Bekijk video's",
              onClick: () => navigate?.("videos"),
            }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="dashboard" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode} isPreview={isPreview}>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        {/* Header with streak + E.P.I.C. progress */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] font-medium text-hh-text truncate">
              {displayName ? `Welkom, ${displayName}` : 'Welkom!'}
            </h1>
            <p className="text-[13px] sm:text-[14px] leading-[20px] text-hh-muted line-clamp-2">
              {getDailyQuote().text}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {loginStreak > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-hh-warning/10 rounded-full border border-hh-warning/20">
              <span className="text-[16px] sm:text-[18px]">🔥</span>
              <span className="text-[13px] sm:text-[14px] font-medium text-hh-warning whitespace-nowrap">{loginStreak} {loginStreak === 1 ? 'dag' : 'dagen'} streak</span>
            </div>
            )}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-hh-bg rounded-full border border-hh-border">
              <span className="text-[13px] sm:text-[14px] font-medium text-hh-text whitespace-nowrap">E.P.I.C.</span>
              <div className="flex items-center gap-1">
                {phaseProgress.map((p, i) => (
                  <div key={i} className={`w-5 h-1.5 rounded-full ${
                    p.percentage >= 100 ? 'bg-hh-success' :
                    p.percentage > 0 ? 'bg-hh-primary' :
                    'bg-hh-ui-200'
                  }`} />
                ))}
              </div>
              <span className="text-[11px] sm:text-[12px] text-hh-muted whitespace-nowrap">{totalCompleted}/{totalVideos}</span>
            </div>
          </div>
        </div>

        {/* Hero Banner */}
        <HeroBanner
          image="/images/Hugo-Herbots-WEB-0197.JPG"
          imagePosition="50% 20%"
          badge={{ label: heroText.badge }}
          title={heroText.title}
          subtitle={heroText.subtitle}
          primaryAction={{
            label: "Verder kijken",
            icon: <Play className="w-4 h-4" />,
            onClick: () => { if (featuredVideo?.id) localStorage.setItem('currentVideoId', featuredVideo.id); navigate?.("videos"); },
          }}
          secondaryAction={{
            label: "Talk to Hugo",
            icon: <MessageSquare className="w-4 h-4" />,
            onClick: () => navigate?.("talk-to-hugo"),
          }}
          isLoading={videosLoading}
        />

        {/* Verder kijken - Videos */}
        <ContentRow 
          title="Verder kijken" 
          icon={Play}
          onSeeAll={() => {
            localStorage.setItem('videoLibraryExpanded', 'true');
            navigate?.("videos");
          }}
        >
          {videosLoading ? (
            <>{[...Array(5)].map((_, i) => (
              <div key={i} style={{ width: 200, flexShrink: 0 }} className="dashboard-card space-y-2">
                <div className="aspect-video bg-hh-border/30 rounded-lg animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="h-3 w-24 bg-hh-border/30 rounded animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
                <div className="h-3 w-16 bg-hh-border/20 rounded animate-pulse" style={{ animationDelay: `${i * 80 + 80}ms` }} />
              </div>
            ))}</>
          ) : continueWatching.length > 0 ? (
            continueWatching.map((video, index) => {
              const locked = !isVideoUnlocked(video.id);
              return (
              <VideoCard
                key={video.id || index}
                title={video.displayTitle || video.title || 'Video'}

                fase={video.fase}
                duration={video.duration}
                progress={video.progress || 0}
                thumbnail={video.thumbnail}
                locked={locked}
                onClick={() => {
                  localStorage.setItem('currentVideoId', video.id);
                  navigate?.("videos");
                }}
              />
              );
            })
          ) : (
            <div className="text-center text-hh-muted text-sm py-4">
              Nog geen video's beschikbaar
            </div>
          )}
        </ContentRow>

        {/* Live Webinars */}
        <ContentRow 
          title="Live Webinars" 
          icon={Radio}
          onSeeAll={() => navigate?.("live")}
        >
          {webinarsLoading ? (
            <>{[...Array(3)].map((_, i) => (
              <div key={i} style={{ width: 200, flexShrink: 0 }} className="dashboard-card p-3 bg-hh-card rounded-lg border border-hh-border space-y-2">
                <div className="h-4 w-32 bg-hh-border/30 rounded animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="h-3 w-20 bg-hh-border/20 rounded animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
              </div>
            ))}</>
          ) : upcomingWebinars.length === 0 ? (
            <p className="text-[13px] text-hh-muted py-4 px-2">Geen geplande webinars</p>
          ) : (
            upcomingWebinars.map((webinar, index) => (
              <WebinarCard
                key={webinar.id || index}
                title={webinar.title}

                date={webinar.date}
                time={webinar.time}
                isLive={webinar.status === "live"}
                imageIndex={index}
                onClick={() => navigate?.("live")}
              />
            ))
          )}
        </ContentRow>

        {/* Terugkijken - Completed Webinars */}
        {!webinarsLoading && completedWebinars.length > 0 && (
          <ContentRow 
            title="Terugkijken" 
            icon={Play}
            onSeeAll={() => navigate?.("live")}
          >
            {completedWebinars.map((webinar, index) => (
              <WebinarCard
                key={webinar.id || index}
                title={webinar.title}

                date={webinar.date}
                time={webinar.time}
                isReplay={true}
                imageIndex={index + 5}
                onClick={() => navigate?.("live")}
              />
            ))}
          </ContentRow>
        )}

        {/* Talk to Hugo AI — real sessions or fallback to suggestions */}
        <ContentRow
          title="Talk to Hugo AI"
          icon={MessageSquare}
          onSeeAll={() => navigate?.("hugo-overview")}
        >
          {sessionsLoading ? (
            <>{[...Array(3)].map((_, i) => (
              <div key={i} style={{ width: 200, flexShrink: 0 }} className="dashboard-card space-y-2">
                <div className="aspect-video bg-hh-border/30 rounded-lg animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="h-3 w-24 bg-hh-border/30 rounded animate-pulse" />
              </div>
            ))}</>
          ) : hugoSessions.length > 0 ? (
            hugoSessions.map((session, index) => (
              <SessionCard
                key={session.id || index}
                title={session.title}
                date={session.date}
                score={session.score}
                type={session.type}
                imageIndex={index}
                onClick={() => navigate?.("hugo-overview")}
              />
            ))
          ) : (
            hugoTrainings.map((training, index) => (
              <HugoTrainingCard
                key={index}
                title={training.naam}

                fase={training.fase}
                sessions={training.sessions}
                imageIndex={index}
                onClick={() => navigate?.("talk-to-hugo")}
              />
            ))
          )}
        </ContentRow>

        {/* Gespreksanalyses */}
        <ContentRow
          title="Gespreksanalyses"
          icon={BarChart3}
          onSeeAll={() => navigate?.("analysis")}
        >
          {analysesLoading ? (
            <>{[...Array(3)].map((_, i) => (
              <div key={i} style={{ width: 200, flexShrink: 0 }} className="dashboard-card space-y-2">
                <div className="aspect-video bg-hh-border/30 rounded-lg animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="h-3 w-24 bg-hh-border/30 rounded animate-pulse" />
              </div>
            ))}</>
          ) : analyses.length > 0 ? (
            analyses.map((analysis, index) => (
              <AnalysisCard
                key={analysis.id || index}
                title={analysis.title}
                date={analysis.date}
                score={analysis.score}
                status={analysis.status}
                duration={analysis.duration}
                imageIndex={index}
                onClick={() => navigate?.("analysis")}
              />
            ))
          ) : (
            <div
              style={{ width: 200, flexShrink: 0 }} className="dashboard-card cursor-pointer group"
              onClick={() => navigate?.("analysis")}
            >
              <div className="rounded-lg border-2 border-dashed border-hh-border group-hover:border-hh-primary/50 aspect-video mb-2 flex flex-col items-center justify-center gap-2 transition-colors">
                <Upload className="w-8 h-8 text-hh-muted group-hover:text-hh-primary transition-colors" />
                <span className="text-[12px] text-hh-muted group-hover:text-hh-primary transition-colors font-medium">
                  Upload je eerste gesprek
                </span>
              </div>
              <h3 className="text-[12px] font-medium text-hh-muted leading-tight">
                Analyseer je verkoopgesprekken met AI
              </h3>
            </div>
          )}
        </ContentRow>

        {/* Compact Progress Footer */}
        <Card className="p-4 rounded-xl border-hh-border bg-hh-ui-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-[14px] font-medium text-hh-text">E.P.I.C. TECHNIQUE</div>
              <span className="text-[13px] text-hh-muted">{totalCompleted}/{totalVideos} video's • {totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0}%</span>
            </div>
            <div className="flex gap-1 flex-1 max-w-md">
              {phaseProgress.map((p, index) => (
                <div key={index} className="flex-1 h-2 rounded-full bg-hh-ui-200 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      p.percentage >= 100 ? "bg-hh-success" :
                      p.percentage > 0 ? "bg-hh-primary" : "bg-hh-ui-200"
                    }`}
                    style={{ width: `${p.percentage}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
