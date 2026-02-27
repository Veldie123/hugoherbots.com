import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "./EmptyState";
import {
  Play,
  ChevronRight,
  Clock,
  Calendar,
  MessageSquare,
  Radio,
  Loader2,
  CheckCircle,
  UserPlus,
  Lock,
} from "lucide-react";
import { getDailyQuote } from "../../data/hugoQuotes";
import { getTechniekByNummer } from "../../data/technieken-service";
import { liveSessions } from "../../data/live-sessions-data";
import { getFaseBadgeColors } from "../../utils/phaseColors";
import { useDashboardVideos } from "../../hooks/useDashboardVideos";
import { useDashboardUserData } from "../../hooks/useDashboardUserData";

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
}) => (
  <div className="space-y-3 min-w-0">
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-hh-muted flex-shrink-0" />}
        <h2 className="text-[16px] sm:text-[18px] font-semibold text-hh-text truncate">{title}</h2>
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
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {children}
    </div>
  </div>
);

const VideoCard = ({ 
  title, 
  techniqueNumber,
  fase,
  duration,
  progress,
  thumbnail,
  onClick,
  locked
}: {
  title: string;
  techniqueNumber: string;
  fase: string | number;
  duration: string;
  progress: number;
  thumbnail?: string;
  onClick?: () => void;
  locked?: boolean;
}) => (
  <div 
    className={`flex-shrink-0 w-[200px] group ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    onClick={locked ? undefined : onClick}
  >
    <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-hh-ink to-hh-primary/80 aspect-video mb-2">
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
            <Play className="w-6 h-6 text-hh-ink ml-0.5" />
          </div>
        </div>
      )}
      <Badge className="absolute top-2 left-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium">
        {techniqueNumber}
      </Badge>
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
  techniqueNumber,
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
  techniqueNumber?: string;
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
    className="flex-shrink-0 w-[200px] group cursor-pointer"
    onClick={onClick}
  >
    <div className="relative rounded-lg overflow-hidden aspect-video mb-2">
      <img 
        src={WEBINAR_IMAGES[imageIndex % WEBINAR_IMAGES.length]} 
        alt={title} 
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      {techniqueNumber && (
        <Badge className="absolute top-2 left-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium">
          {techniqueNumber}
        </Badge>
      )}
      {isLive && (
        <Badge className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 animate-pulse">
          LIVE
        </Badge>
      )}
      {isReplay && (
        <Badge className="absolute top-2 right-2 bg-hh-ink/80 text-white text-[10px] px-1.5 py-0.5">
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
          <Play className="w-6 h-6 text-hh-ink ml-0.5" />
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
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-default" 
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
  techniqueNumber,
  fase,
  sessions,
  imageIndex = 0,
  onClick
}: {
  title: string;
  techniqueNumber: string;
  fase: number;
  sessions: number;
  imageIndex?: number;
  onClick?: () => void;
}) => {
  const faseColors = getFaseBadgeColors(String(fase));
  
  return (
    <div 
      className="flex-shrink-0 w-[200px] group cursor-pointer"
      onClick={onClick}
    >
      <div className={`relative rounded-lg overflow-hidden aspect-video mb-2`}>
        <img 
          src={HUGO_TRAINING_IMAGES[imageIndex % HUGO_TRAINING_IMAGES.length]} 
          alt={title} 
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-black/20" />
        <Badge className="absolute top-2 left-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium">
          {techniqueNumber}
        </Badge>
        <Badge className={`absolute top-2 right-2 ${faseColors.bg} ${faseColors.text} text-[10px] px-1.5 py-0.5`}>
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

export function Dashboard({ hasData = true, navigate, isAdmin = false, isPreview = false, onboardingMode }: DashboardProps) {
  const { videos: realVideos, featuredVideo, loading: videosLoading } = useDashboardVideos();
  const { firstName, loginStreak, phaseProgress, totalCompleted, totalVideos } = useDashboardUserData();
  const displayName = isPreview ? "" : firstName;

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

  const upcomingWebinars = liveSessions
    .filter(s => s.status === "upcoming" || s.status === "live" || s.status === "scheduled")
    .slice(0, 5);
  
  const completedWebinars = liveSessions
    .filter(s => s.status === "completed")
    .slice(0, 5);
  
  const continueWatching = realVideos.slice(0, 5).map((v, i) => ({
    ...v,
    progress: i === 0 ? 68 : i === 1 ? 45 : i === 2 ? 12 : 0
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
      <AppLayout currentPage="dashboard" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
        <div className="p-8">
          <EmptyState
            icon={Play}
            title="Klaar om te beginnen?"
            body="Je eerste role-play duurt 2 minuten. Daarna weet je direct waar je staat — en wat je volgende stap is."
            primaryCta={{
              label: "Begin role-play",
              onClick: () => navigate?.("roleplay"),
            }}
            secondaryCta={{
              label: "Bekijk bibliotheek",
              onClick: () => navigate?.("library"),
            }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="dashboard" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
      <div className="p-4 sm:p-5 lg:p-6 space-y-6">
        {/* Header with streak + E.P.I.C. progress */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] font-semibold text-hh-text truncate">
              {displayName ? `Welkom terug, ${displayName}` : 'Welkom terug'}
            </h1>
            <p className="text-[13px] sm:text-[14px] leading-[20px] text-hh-muted line-clamp-2">
              {getDailyQuote().text}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {loginStreak > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-full border border-amber-500/20">
              <span className="text-[16px] sm:text-[18px]">🔥</span>
              <span className="text-[13px] sm:text-[14px] font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">{loginStreak} {loginStreak === 1 ? 'dag' : 'dagen'} streak</span>
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

        {/* Hero Banner - Netflix Style */}
        <div className="relative overflow-hidden rounded-2xl h-[200px] sm:h-[240px]">
          {videosLoading ? (
            <div className="absolute inset-0 bg-hh-ink flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            </div>
          ) : (
            <>
              {featuredVideo?.thumbnail && (
                <img 
                  src={featuredVideo.thumbnail.replace('width=320&height=180', 'width=800&height=450')} 
                  alt="Featured video"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: '50% 35%' }}
                  loading="eager"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-hh-ink via-hh-ink/80 to-transparent" />
              <div className="relative h-full flex items-center p-6 sm:p-8">
                <div className="text-white space-y-3 max-w-lg">
                  <Badge className="bg-hh-success text-white border-0">
                    Aanbevolen voor jou
                  </Badge>
                  <h2 className="text-[24px] sm:text-[32px] font-bold leading-tight">
                    {featuredVideo?.displayTitle || featuredVideo?.title || 'Aanbevolen video'}
                  </h2>
                  <p className="text-white/70 text-[14px] leading-relaxed line-clamp-2">
                    Leer hoe je gerichte vragen stelt om de echte behoeften van je klant te ontdekken. 
                    Dit is de basis van elke succesvolle sale.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button 
                      className="gap-2 text-white border-0 bg-hh-success hover:bg-hh-success/90"
                      onClick={() => {
                        if (featuredVideo?.id) {
                          localStorage.setItem('currentVideoId', featuredVideo.id);
                        }
                        navigate?.("videos");
                      }}
                    >
                      <Play className="w-4 h-4" />
                      Verder kijken
                    </Button>
                    <Button 
                      className="bg-hh-ink/80 text-white hover:bg-hh-ink gap-2 border border-white/30"
                      onClick={() => navigate?.("talk-to-hugo")}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chat met Hugo
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

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
            <div className="flex items-center justify-center w-full py-8">
              <Loader2 className="w-6 h-6 text-hh-muted animate-spin" />
            </div>
          ) : continueWatching.length > 0 ? (
            continueWatching.map((video, index) => {
              const locked = !isVideoUnlocked(video.id);
              return (
              <VideoCard
                key={video.id || index}
                title={video.displayTitle || video.title || 'Video'}
                techniqueNumber={video.techniqueNumber}
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
          {upcomingWebinars.map((webinar, index) => (
            <WebinarCard
              key={webinar.id || index}
              title={webinar.title}
              techniqueNumber={webinar.techniqueNumber}
              date={webinar.date}
              time={webinar.time}
              isLive={webinar.status === "live"}
              isRegistered={index < 2}
              imageIndex={index}
              onClick={() => navigate?.("live")}
            />
          ))}
        </ContentRow>

        {/* Terugkijken - Completed Webinars */}
        {completedWebinars.length > 0 && (
          <ContentRow 
            title="Terugkijken" 
            icon={Play}
            onSeeAll={() => navigate?.("live")}
          >
            {completedWebinars.map((webinar, index) => (
              <WebinarCard
                key={webinar.id || index}
                title={webinar.title}
                techniqueNumber={webinar.techniqueNumber}
                date={webinar.date}
                time={webinar.time}
                isReplay={true}
                imageIndex={index + 5}
                onClick={() => navigate?.("live")}
              />
            ))}
          </ContentRow>
        )}

        {/* Train met Hugo AI */}
        <ContentRow 
          title="Train met Hugo AI" 
          icon={MessageSquare}
          onSeeAll={() => navigate?.("hugo-overview")}
        >
          {hugoTrainings.map((training, index) => (
            <HugoTrainingCard
              key={index}
              title={training.naam}
              techniqueNumber={training.nummer}
              fase={training.fase}
              sessions={training.sessions}
              imageIndex={index}
              onClick={() => navigate?.("talk-to-hugo")}
            />
          ))}
        </ContentRow>

        {/* Compact Progress Footer */}
        <Card className="p-4 rounded-xl border-hh-border bg-hh-ui-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-[14px] font-medium text-hh-text">E.P.I.C. Sales Flow</div>
              <span className="text-[13px] text-hh-muted">{totalCompleted}/{totalVideos} video's • {totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0}%</span>
            </div>
            <div className="flex gap-1 flex-1 max-w-md">
              {phaseProgress.map((p, index) => (
                <div key={index} className="flex-1 h-2 rounded-full bg-hh-ui-200 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      p.percentage >= 100 ? "bg-emerald-500" : 
                      p.percentage > 0 ? "bg-blue-400" : "bg-hh-ui-200"
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
