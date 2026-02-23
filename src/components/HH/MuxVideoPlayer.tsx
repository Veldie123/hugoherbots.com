import MuxPlayer from "@mux/mux-player-react";
import { useEffect, useRef, useCallback } from "react";
import { videoApi } from "@/services/videoApi";
import { activityService } from "@/services/activityService";

interface VideoPlayerProps {
  playbackId: string;
  videoId?: string;
  title?: string;
  techniekId?: string;
  startTime?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  muted?: boolean;
  showControls?: boolean;
  className?: string;
}

export function MuxVideoPlayer({
  playbackId,
  videoId,
  title,
  techniekId,
  startTime = 0,
  onProgress,
  onEnded,
  autoPlay = false,
  muted = false,
  showControls = true,
  className = "",
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const lastReportedTime = useRef<number>(0);
  const hasLoggedView = useRef<boolean>(false);
  const hasLoggedComplete = useRef<boolean>(false);

  const reportProgress = useCallback(async (currentTime: number, duration: number, completed: boolean = false) => {
    if (!videoId) return;
    
    try {
      await videoApi.updateProgress(videoId, {
        watched_seconds: Math.round(currentTime),
        last_position: Math.round(currentTime),
        completed,
      });

      if (completed && !hasLoggedComplete.current) {
        hasLoggedComplete.current = true;
        await activityService.logVideoComplete(videoId, techniekId);
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }, [videoId, techniekId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handlePlay = async () => {
      if (!hasLoggedView.current && videoId) {
        hasLoggedView.current = true;
        await activityService.logVideoView(videoId, techniekId);
      }
    };

    const handleTimeUpdate = () => {
      const currentTime = player.currentTime || 0;
      const duration = player.duration || 0;

      lastReportedTime.current = currentTime;

      if (onProgress) {
        onProgress(currentTime, duration);
      }

      if (Math.floor(currentTime) % 30 === 0 && currentTime > 0) {
        reportProgress(currentTime, duration);
      }
    };

    const handleEnded = () => {
      const duration = player.duration || 0;
      reportProgress(duration, duration, true);
      
      if (onEnded) {
        onEnded();
      }
    };

    const handlePause = () => {
      const currentTime = player.currentTime || 0;
      const duration = player.duration || 0;
      reportProgress(currentTime, duration);
    };

    player.addEventListener('play', handlePlay);
    player.addEventListener('timeupdate', handleTimeUpdate);
    player.addEventListener('ended', handleEnded);
    player.addEventListener('pause', handlePause);

    return () => {
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('timeupdate', handleTimeUpdate);
      player.removeEventListener('ended', handleEnded);
      player.removeEventListener('pause', handlePause);
    };
  }, [onProgress, onEnded, reportProgress, videoId, techniekId]);

  useEffect(() => {
    if (startTime > 0 && playerRef.current) {
      playerRef.current.currentTime = startTime;
    }
  }, [startTime]);

  return (
    <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden ${className}`}>
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        metadata={{
          video_title: title || "Video",
        }}
        autoPlay={autoPlay}
        muted={muted}
        streamType="on-demand"
        preferPlayback="mse"
        minResolution="720p"
        maxResolution="2160p"
        primaryColor="#ffffff"
        accentColor="#3b82f6"
        style={{ 
          width: "100%", 
          height: "100%",
          "--controls": showControls ? undefined : "none",
        } as React.CSSProperties}
      />
    </div>
  );
}

export default MuxVideoPlayer;
