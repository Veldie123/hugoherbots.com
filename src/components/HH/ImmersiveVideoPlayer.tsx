import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { MuxVideoPlayer } from "./MuxVideoPlayer";
import { Badge } from "../ui/badge";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  SkipForward,
  List,
  CheckCircle2,
} from "lucide-react";
import { getTechniekByNummer } from "@/data/technieken-service";

interface VideoItem {
  id: string;
  title: string;
  displayTitle: string | null;
  muxPlaybackId: string;
  techniqueNumber: string;
  duration: string;
  thumbnail: string;
  playbackOrder: number | null;
  aiSummary?: string | null;
}

interface ImmersiveVideoPlayerProps {
  videos: VideoItem[];
  currentVideoId: string;
  onClose: () => void;
  onVideoComplete: (videoId: string) => void;
  completedVideoIds: Set<string>;
  startTime?: number;
}

export function ImmersiveVideoPlayer({
  videos,
  currentVideoId,
  onClose,
  onVideoComplete,
  completedVideoIds,
  startTime = 0,
}: ImmersiveVideoPlayerProps) {
  const [activeVideoId, setActiveVideoId] = useState(currentVideoId);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(3);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const playlistRef = useRef<HTMLDivElement>(null);

  const currentIndex = videos.findIndex(v => v.id === activeVideoId);
  const currentVideo = videos[currentIndex];
  const nextVideo = currentIndex < videos.length - 1 ? videos[currentIndex + 1] : null;
  const prevVideo = currentIndex > 0 ? videos[currentIndex - 1] : null;

  const technique = currentVideo?.techniqueNumber ? getTechniekByNummer(currentVideo.techniqueNumber) : null;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showPlaylist && !showNextOverlay) setControlsVisible(false);
    }, 4000);
  }, [showPlaylist, showNextOverlay]);

  const goToVideo = useCallback((videoId: string) => {
    setShowNextOverlay(false);
    setNextCountdown(3);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setActiveVideoId(videoId);
    localStorage.setItem('lastWatchedVideoId', videoId);
    localStorage.setItem('lastWatchedVideoProgress', '0');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && nextVideo) goToVideo(nextVideo.id);
      if (e.key === 'ArrowLeft' && prevVideo) goToVideo(prevVideo.id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextVideo, prevVideo, onClose, goToVideo]);

  const handleVideoEnded = useCallback(() => {
    onVideoComplete(activeVideoId);
    if (nextVideo) {
      setShowNextOverlay(true);
      setNextCountdown(3);
      countdownRef.current = setInterval(() => {
        setNextCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            goToVideo(nextVideo.id);
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [activeVideoId, nextVideo, onVideoComplete, goToVideo]);

  const handleProgress = useCallback((currentTime: number, duration: number) => {
    if (duration > 0) {
      const pct = Math.round((currentTime / duration) * 100);
      localStorage.setItem('lastWatchedVideoProgress', String(pct));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (playlistRef.current) {
      const activeEl = playlistRef.current.querySelector(`[data-video-id="${activeVideoId}"]`);
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeVideoId, showPlaylist]);

  if (!currentVideo) return null;

  const nextTechnique = nextVideo?.techniqueNumber ? getTechniekByNummer(nextVideo.techniqueNumber) : null;

  const playerContent = (
    <div 
      className="fixed inset-0 bg-black"
      style={{ zIndex: 99999, isolation: 'isolate' }}
      onMouseMove={resetControlsTimeout}
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
        <div className={`w-full h-full flex items-center justify-center ${showPlaylist ? 'pr-[340px] sm:pr-[380px]' : ''}`} style={{ transition: 'padding 0.3s ease' }}>
          <div className="w-full h-full flex items-center justify-center p-0">
            <div className="relative w-full h-full">
              <MuxVideoPlayer
                key={activeVideoId}
                playbackId={currentVideo.muxPlaybackId}
                videoId={currentVideo.id}
                title={currentVideo.title}
                techniekId={currentVideo.techniqueNumber}
                startTime={activeVideoId === currentVideoId ? startTime : 0}
                autoPlay={true}
                onEnded={handleVideoEnded}
                onProgress={handleProgress}
                className="w-full h-full !rounded-none"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        className="fixed top-4 left-4 sm:top-5 sm:left-5 w-10 h-10 flex items-center justify-center rounded-full text-white bg-black/80 hover:bg-white/20 transition-all cursor-pointer"
        style={{ zIndex: 100001 }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
        aria-label="Sluiten"
      >
        <X className="w-5 h-5" />
      </button>

      <button
        className="fixed top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-medium text-[14px] transition-all cursor-pointer"
        style={{ zIndex: 100001, backgroundColor: '#1a1f2e' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPlaylist(!showPlaylist); }}
        aria-label="Playlist"
      >
        <List className="w-4 h-4" />
        <span className="hidden sm:inline">Playlist</span>
      </button>

      <div 
        className={`fixed top-0 left-14 right-14 sm:left-16 sm:right-16 flex items-end pt-3 pb-2 transition-opacity duration-300 pointer-events-none ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ zIndex: 100000, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)' }}
      >
        <div className="min-w-0 px-2">
          <h2 className="text-white text-[15px] sm:text-[17px] font-semibold truncate">
            {currentVideo.displayTitle || currentVideo.title}
          </h2>
          <p className="text-white/60 text-[12px]">
            Video {currentIndex + 1} van {videos.length}
            {technique?.fase && ` · Fase ${technique.fase}`}
          </p>
        </div>
      </div>

      <div 
        className={`fixed left-3 top-1/2 -translate-y-1/2 transition-opacity duration-300 ${controlsVisible && !showNextOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ zIndex: 100000 }}
      >
        {prevVideo && (
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full text-white bg-black/60 hover:bg-white/20 transition-all cursor-pointer"
            onClick={(e) => { e.stopPropagation(); goToVideo(prevVideo.id); }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
      </div>
      <div 
        className={`fixed top-1/2 -translate-y-1/2 transition-opacity duration-300 ${controlsVisible && !showNextOverlay && !showPlaylist ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ zIndex: 100000, right: showPlaylist ? '372px' : '12px' }}
      >
        {nextVideo && (
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full text-white bg-black/60 hover:bg-white/20 transition-all cursor-pointer"
            onClick={(e) => { e.stopPropagation(); goToVideo(nextVideo.id); }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      <div 
        className={`fixed bottom-0 left-0 right-0 px-5 py-3 transition-opacity duration-300 pointer-events-none ${controlsVisible && !showNextOverlay ? 'opacity-100' : 'opacity-0'}`}
        style={{ zIndex: 100000, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentVideo.techniqueNumber && (
              <Badge className="bg-teal-500/80 text-white border-0 text-[10px] font-mono">
                #{currentVideo.techniqueNumber}
              </Badge>
            )}
            <span className="text-white/70 text-[12px]">{currentVideo.duration}</span>
          </div>
        </div>
      </div>

      {showNextOverlay && nextVideo && (
        <div 
          className="fixed inset-0 bg-black/85 flex items-center justify-center"
          style={{ zIndex: 100002 }}
        >
          <div className="text-center space-y-6 px-4 max-w-lg">
            <p className="text-white/60 text-[14px] uppercase tracking-wider">Volgende video in {nextCountdown}s</p>
            <div className="flex items-center gap-4 bg-white/10 rounded-xl p-4">
              <div className="w-24 h-14 sm:w-32 sm:h-18 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                <img 
                  src={nextVideo.thumbnail} 
                  alt={nextVideo.displayTitle || nextVideo.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left min-w-0">
                <p className="text-white font-semibold text-[15px] truncate">
                  {nextVideo.displayTitle || nextVideo.title}
                </p>
                <p className="text-white/50 text-[12px]">
                  {nextVideo.duration}
                  {nextTechnique?.fase && ` · Fase ${nextTechnique.fase}`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                className="px-5 py-2.5 rounded-lg border border-white/40 text-white text-[14px] font-medium transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#1C2535'; e.currentTarget.style.borderColor = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowNextOverlay(false);
                  if (countdownRef.current) clearInterval(countdownRef.current);
                }}
              >
                Annuleren
              </button>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-[14px] font-medium transition-colors hover:brightness-110 cursor-pointer"
                style={{ backgroundColor: '#3d9a6e' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToVideo(nextVideo.id); }}
              >
                <SkipForward className="w-4 h-4" />
                Nu afspelen
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={`fixed top-0 right-0 bottom-0 w-[340px] sm:w-[380px] flex flex-col transition-transform duration-300 ${showPlaylist ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
        style={{ zIndex: 100003, backgroundColor: '#0d0f14', borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-12px 0 40px rgba(0,0,0,0.8)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <h3 className="text-white font-semibold text-[16px]">Cursus Playlist</h3>
            <p className="text-white/40 text-[12px] mt-0.5">{videos.length} video's · Video {currentIndex + 1} van {videos.length}</p>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setShowPlaylist(false); }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={playlistRef} className="flex-1 overflow-y-auto" style={{ backgroundColor: '#0d0f14' }}>
          {videos.map((video, idx) => {
            const isActive = video.id === activeVideoId;
            const isCompleted = completedVideoIds.has(video.id);
            const vTech = video.techniqueNumber ? getTechniekByNummer(video.techniqueNumber) : null;
            return (
              <div
                key={video.id}
                data-video-id={video.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all ${
                  isActive ? 'border-l-[3px]' : 'border-l-[3px] border-l-transparent hover:bg-white/[0.04]'
                }`}
                style={{ 
                  backgroundColor: isActive ? 'rgba(61,154,110,0.12)' : undefined,
                  borderLeftColor: isActive ? '#3d9a6e' : undefined,
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
                onClick={() => goToVideo(video.id)}
              >
                <div className="flex-shrink-0 w-6 pt-1 text-center">
                  {isActive ? (
                    <Play className="w-4 h-4 mx-auto" style={{ color: '#3d9a6e' }} />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: '#3d9a6e' }} />
                  ) : (
                    <span className="text-white/25 text-[12px] font-mono">{idx + 1}</span>
                  )}
                </div>
                <div className="w-[72px] h-[42px] rounded-md overflow-hidden flex-shrink-0" style={{ backgroundColor: '#1a1d24' }}>
                  <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className={`text-[13px] leading-tight line-clamp-2 ${isActive ? 'text-white font-semibold' : 'text-white/75'}`}>
                    {video.displayTitle || video.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/35 text-[11px]">{video.duration}</span>
                    {vTech?.fase && <span className="text-white/25 text-[10px]">· Fase {vTech.fase}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(playerContent, document.body);
}
