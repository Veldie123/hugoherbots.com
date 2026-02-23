import MuxPlayer from "@mux/mux-player-react";
import { Play, Clock, X } from "lucide-react";
import { useState } from "react";
import type { VideoEmbed } from "@/types/crossPlatform";

interface InlineVideoPlayerProps {
  video: VideoEmbed;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function InlineVideoPlayer({ video }: InlineVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!video.muxPlaybackId) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3"
        style={{ maxWidth: 480 }}
      >
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ width: 48, height: 48, backgroundColor: "#e2e8f0" }}
        >
          <Play className="w-5 h-5 text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm text-slate-700 truncate">{video.title}</p>
          <p className="text-xs text-slate-400">Video niet beschikbaar</p>
        </div>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ maxWidth: 520 }}>
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
            style={{ width: "100%", aspectRatio: "16/9" }}
            streamType="on-demand"
            accentColor="#3C9A6E"
          />
        </div>
        <div className="px-3 py-2 bg-white">
          <p className="font-medium text-sm text-slate-700">{video.title}</p>
          {video.techniqueId && (
            <p className="text-xs text-slate-400">Techniek {video.techniqueId}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsPlaying(true)}
      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors p-3 flex items-center gap-3 text-left w-full group"
      style={{ maxWidth: 480 }}
    >
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
        style={{ width: 56, height: 56, backgroundColor: "#3C9A6E" }}
      >
        <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-slate-800 truncate">{video.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {video.duration && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(video.duration)}
            </span>
          )}
          {video.techniqueId && (
            <span className="text-xs text-slate-400">Techniek {video.techniqueId}</span>
          )}
        </div>
      </div>
      <span className="text-xs font-medium px-2 py-1 rounded-md" style={{ backgroundColor: "#EBF5F0", color: "#3C9A6E" }}>
        Afspelen
      </span>
    </button>
  );
}
