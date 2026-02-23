import { useCallback, useEffect, useState, useRef } from "react";
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObjectParticipant } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Maximize2,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Radio,
  Circle,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { liveCoachingApi } from "@/services/liveCoachingApi";
import { activityService } from "@/services/activityService";
import { toast } from "sonner";

interface CustomDailyCallProps {
  roomUrl: string;
  token: string;
  sessionId: string;
  sessionTitle: string;
  isHost: boolean;
  onLeave: () => void;
  onEndSession?: () => void;
  videoDeviceId?: string;
  audioDeviceId?: string;
  initialCameraEnabled?: boolean;
  initialMicEnabled?: boolean;
}

type ConnectionState = "idle" | "connecting" | "connected" | "error" | "left";

interface ParticipantInfo {
  sessionId: string;
  userName: string;
  isLocal: boolean;
  isOwner: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  videoOn: boolean;
  audioOn: boolean;
}

export function CustomDailyCall({
  roomUrl,
  token,
  sessionId,
  sessionTitle,
  isHost,
  onLeave,
  onEndSession,
  videoDeviceId,
  audioDeviceId,
  initialCameraEnabled = true,
  initialMicEnabled = true,
}: CustomDailyCallProps) {
  const callObjectRef = useRef<DailyCall | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, ParticipantInfo>>(new Map());
  const [isMuted, setIsMuted] = useState(!initialMicEnabled);
  const [isCameraOff, setIsCameraOff] = useState(!initialCameraEnabled);
  const hasAppliedInitialSettings = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const hasLoggedWebinarAttend = useRef(false);

  const updateParticipants = useCallback((call: DailyCall) => {
    const dailyParticipants = call.participants();
    const newParticipants = new Map<string, ParticipantInfo>();

    Object.values(dailyParticipants).forEach((p: DailyParticipant) => {
      newParticipants.set(p.session_id, {
        sessionId: p.session_id,
        userName: p.user_name || (p.local ? "Jij" : "Deelnemer"),
        isLocal: p.local,
        isOwner: p.owner,
        videoTrack: p.tracks?.video?.persistentTrack || null,
        audioTrack: p.tracks?.audio?.persistentTrack || null,
        videoOn: p.video,
        audioOn: p.audio,
      });
    });

    setParticipants(newParticipants);
  }, []);

  const destroyCallObject = useCallback(() => {
    if (callObjectRef.current) {
      try {
        callObjectRef.current.destroy();
      } catch (e) {
        console.warn("[Daily] Error destroying call:", e);
      }
      callObjectRef.current = null;
    }
  }, []);

  const initializeCall = useCallback(async () => {
    if (!roomUrl || !token) {
      setError("Geen room URL of token beschikbaar");
      setConnectionState("error");
      return;
    }

    // Destroy any existing instance first
    destroyCallObject();

    setConnectionState("connecting");
    setError(null);

    try {
      const call = DailyIframe.createCallObject();
      callObjectRef.current = call;

      call.on("joined-meeting", async () => {
        if (!isMountedRef.current) return;
        console.log("[Daily] Joined meeting");
        setConnectionState("connected");
        updateParticipants(call);
        if (!hasLoggedWebinarAttend.current) {
          hasLoggedWebinarAttend.current = true;
          await activityService.logWebinarAttend(sessionId, sessionTitle);
        }
        
        if (!hasAppliedInitialSettings.current) {
          hasAppliedInitialSettings.current = true;
          if (!initialCameraEnabled) {
            call.setLocalVideo(false);
          }
          if (!initialMicEnabled) {
            call.setLocalAudio(false);
          }
        }
      });

      call.on("left-meeting", () => {
        if (!isMountedRef.current) return;
        console.log("[Daily] Left meeting");
        setConnectionState("left");
      });

      call.on("participant-joined", (event) => {
        if (!isMountedRef.current) return;
        console.log("[Daily] Participant joined:", event?.participant?.user_name);
        updateParticipants(call);
      });

      call.on("participant-left", (event) => {
        if (!isMountedRef.current) return;
        console.log("[Daily] Participant left:", event?.participant?.user_name);
        updateParticipants(call);
      });

      call.on("participant-updated", () => {
        if (!isMountedRef.current) return;
        updateParticipants(call);
      });

      call.on("track-started", () => {
        if (!isMountedRef.current) return;
        updateParticipants(call);
      });

      call.on("track-stopped", () => {
        if (!isMountedRef.current) return;
        updateParticipants(call);
      });

      call.on("error", (event) => {
        if (!isMountedRef.current) return;
        console.error("[Daily] Error:", event);
        const msg = event?.errorMsg || "Onbekende fout";
        if (msg.includes("expired") || msg.includes("not found")) {
          setError("Deze sessie is verlopen of niet meer beschikbaar.");
        } else {
          setError(`Verbindingsfout: ${msg}`);
        }
        setConnectionState("error");
      });

      call.on("camera-error", (event) => {
        console.error("[Daily] Camera error:", event);
      });

      const joinOptions: Parameters<typeof call.join>[0] = {
        url: roomUrl,
        token: token,
        userName: isHost ? "Host" : undefined,
      };

      if (videoDeviceId) {
        joinOptions.videoSource = videoDeviceId;
      }
      if (audioDeviceId) {
        joinOptions.audioSource = audioDeviceId;
      }

      await call.join(joinOptions);

    } catch (err: any) {
      console.error("[Daily] Failed to join:", err);
      const msg = err?.message || err?.error || "Onbekende fout";
      if (msg.includes("expired") || msg.includes("not found") || msg === "{}") {
        setError("Deze sessie is verlopen of niet meer beschikbaar. Start een nieuwe sessie.");
      } else if (msg.includes("Duplicate")) {
        setError("Er is al een actieve verbinding. Probeer opnieuw.");
      } else {
        setError(`Kon niet verbinden: ${msg}`);
      }
      setConnectionState("error");
    }
  }, [roomUrl, token, isHost, updateParticipants, destroyCallObject, videoDeviceId, audioDeviceId, initialCameraEnabled, initialMicEnabled]);

  const fetchRecordingStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      const status = await liveCoachingApi.recording.getStatus(sessionId);
      setIsRecording(status.isRecording);
    } catch (err) {
      console.warn("[Recording] Could not fetch status:", err);
      setIsRecording(false);
    }
  }, [sessionId]);

  useEffect(() => {
    isMountedRef.current = true;
    initializeCall();

    return () => {
      isMountedRef.current = false;
      destroyCallObject();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    
    fetchRecordingStatus();
    
    const interval = setInterval(() => {
      fetchRecordingStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [sessionId, fetchRecordingStatus]);

  // Auto-start recording when host connects
  const hasAutoStartedRecording = useRef(false);
  useEffect(() => {
    if (
      connectionState === "connected" && 
      isHost && 
      !isRecording && 
      !recordingLoading &&
      !hasAutoStartedRecording.current &&
      sessionId
    ) {
      hasAutoStartedRecording.current = true;
      console.log("[Recording] Auto-starting recording for host");
      
      // Start recording with a small delay to ensure connection is stable
      const timer = setTimeout(async () => {
        try {
          await liveCoachingApi.recording.start(sessionId);
          await fetchRecordingStatus();
          console.log("[Recording] Auto-started successfully");
        } catch (err) {
          console.error("[Recording] Auto-start failed:", err);
          // Don't show error toast - recording can still be started manually
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [connectionState, isHost, isRecording, recordingLoading, sessionId, fetchRecordingStatus]);

  const handleToggleMute = useCallback(() => {
    if (callObjectRef.current) {
      callObjectRef.current.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleToggleCamera = useCallback(() => {
    if (callObjectRef.current) {
      callObjectRef.current.setLocalVideo(isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  }, [isCameraOff]);

  const handleLeave = useCallback(async () => {
    if (callObjectRef.current) {
      try {
        await callObjectRef.current.leave();
      } catch (e) {
        console.warn("[Daily] Error leaving:", e);
      }
    }
    destroyCallObject();
    onLeave();
  }, [onLeave, destroyCallObject]);

  const handleEndSession = useCallback(async () => {
    if (callObjectRef.current) {
      try {
        await callObjectRef.current.leave();
      } catch (e) {
        console.warn("[Daily] Error ending session:", e);
      }
    }
    destroyCallObject();
    onEndSession?.();
  }, [onEndSession, destroyCallObject]);

  const handleRetry = useCallback(() => {
    destroyCallObject();
    setError(null);
    setConnectionState("idle");
    initializeCall();
  }, [destroyCallObject, initializeCall]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (!sessionId || recordingLoading) return;
    
    setRecordingLoading(true);
    try {
      if (isRecording) {
        await liveCoachingApi.recording.stop(sessionId);
        toast.success("Opname gestopt");
      } else {
        await liveCoachingApi.recording.start(sessionId);
        toast.success("Opname gestart");
      }
      await fetchRecordingStatus();
    } catch (err: any) {
      console.error("[Recording] Error:", err);
      toast.error(err.message || "Opname fout");
      await fetchRecordingStatus();
    } finally {
      setRecordingLoading(false);
    }
  }, [sessionId, isRecording, recordingLoading, fetchRecordingStatus]);

  const participantList = Array.from(participants.values());
  const localParticipant = participantList.find(p => p.isLocal);
  const remoteParticipants = participantList.filter(p => !p.isLocal);

  console.log("[CustomDailyCall] participantList:", participantList.length, participantList.map(p => ({ 
    sessionId: p.sessionId.slice(0,8), 
    userName: p.userName, 
    isLocal: p.isLocal,
    videoOn: p.videoOn,
    hasVideoTrack: !!p.videoTrack
  })));

  if (connectionState === "error") {
    return (
      <Card className="p-8 bg-hh-bg border border-hh-border shadow-lg">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Verbindingsfout
          </h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleRetry} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <RefreshCw className="w-4 h-4" />
              Opnieuw proberen
            </Button>
            <Button variant="outline" onClick={onLeave} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Terug
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (connectionState === "connecting" || connectionState === "idle") {
    return (
      <Card className="p-8 bg-hh-bg border border-hh-border shadow-lg">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Verbinden met sessie
          </h3>
          <p className="text-gray-600 mb-4">
            Even geduld, we stellen de verbinding in...
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Radio className="w-4 h-4 animate-pulse text-purple-500" />
            <span>{sessionTitle}</span>
          </div>
          <Button variant="ghost" onClick={onLeave} className="mt-6 text-gray-500">
            Annuleren
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex flex-col bg-gray-50 rounded-lg overflow-hidden border border-hh-border",
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : "h-[600px]"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-hh-bg border-b border-hh-border">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLeave}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Terug
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-gray-900 font-medium text-sm">LIVE</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded animate-pulse">
              <Circle className="w-3 h-3 fill-current" />
              REC
            </div>
          )}
          <span className="text-gray-600 text-sm">{sessionTitle}</span>
          {isHost && (
            <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded">
              HOST
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mr-2">
            <Users className="w-4 h-4" />
            <span>{participants.size}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className="text-gray-600 hover:text-gray-900"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden min-h-[400px]">
        <div className={cn(
          "grid gap-3 h-full",
          participantList.length === 0 && "grid-cols-1",
          participantList.length === 1 && "grid-cols-1",
          participantList.length === 2 && "grid-cols-2",
          participantList.length >= 3 && participantList.length <= 4 && "grid-cols-2 grid-rows-2",
          participantList.length > 4 && "grid-cols-3 grid-rows-2"
        )}>
          {participantList.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl min-h-[300px] bg-gradient-to-br from-hh-ui-50 to-hh-ui-100 border border-hh-border">
              <div className="text-center max-w-sm mx-auto px-6">
                {/* Elegant waiting animation */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-hh-ui-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-hh-primary animate-spin" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Users className="w-8 h-8 text-hh-primary" />
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-hh-text mb-2">
                  Wachten op deelnemers
                </h3>
                <p className="text-sm text-hh-muted mb-4">
                  {isHost 
                    ? "De sessie is gestart. Deelnemers kunnen nu binnenkomen." 
                    : "Even geduld, de host start zo de sessie."}
                </p>
                
                {/* Session info */}
                <div className="inline-flex items-center gap-2 bg-hh-bg rounded-full px-4 py-2 shadow-sm border border-hh-border">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#3d9a6e' }} />
                  <span className="text-sm text-hh-text font-medium">{sessionTitle}</span>
                </div>
              </div>
            </div>
          ) : (
            participantList.map((participant) => (
              <VideoTile
                key={participant.sessionId}
                participant={participant}
                isLarge={participantList.length <= 2}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 px-4 py-4 bg-hh-bg border-t border-hh-border">
        <Button
          size="lg"
          variant={isMuted ? "destructive" : "secondary"}
          onClick={handleToggleMute}
          className="w-14 h-14 rounded-full p-0"
          title={isMuted ? "Microfoon aan" : "Microfoon uit"}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        <Button
          size="lg"
          variant={isCameraOff ? "destructive" : "secondary"}
          onClick={handleToggleCamera}
          className="w-14 h-14 rounded-full p-0"
          title={isCameraOff ? "Camera aan" : "Camera uit"}
        >
          {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </Button>

        {isHost && (
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "secondary"}
            onClick={handleToggleRecording}
            disabled={recordingLoading}
            className={cn(
              "w-14 h-14 rounded-full p-0",
              isRecording && "bg-red-600 hover:bg-red-700 animate-pulse"
            )}
            title={isRecording ? "Stop opname" : "Start opname"}
          >
            {recordingLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Circle className={cn("w-6 h-6", isRecording && "fill-current")} />
            )}
          </Button>
        )}

        <Button
          size="lg"
          variant="destructive"
          onClick={isHost && onEndSession ? handleEndSession : handleLeave}
          className="w-14 h-14 rounded-full p-0 bg-red-600 hover:bg-red-700"
          title={isHost ? "Sessie beëindigen" : "Verlaten"}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>

      </div>
    </div>
  );
}

interface VideoTileProps {
  participant: ParticipantInfo;
  isLarge?: boolean;
}

function VideoTile({ participant, isLarge = false }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (participant.videoTrack && participant.videoOn) {
      const stream = new MediaStream([participant.videoTrack]);
      video.srcObject = stream;
      video.play()
        .then(() => setVideoReady(true))
        .catch((e) => console.warn("[VideoTile] Play failed:", e));
    } else {
      video.srcObject = null;
      setVideoReady(false);
    }

    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [participant.videoTrack, participant.videoOn]);

  const showVideo = participant.videoOn && participant.videoTrack;

  return (
    <div 
      className={cn(
        "relative bg-gray-800 rounded-lg overflow-hidden w-full",
        isLarge ? "h-full min-h-[300px]" : "h-full min-h-[150px]"
      )}
      style={{ aspectRatio: isLarge ? "16/9" : "4/3" }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
          showVideo && videoReady ? "opacity-100" : "opacity-0"
        )}
      />
      
      {(!showVideo || !videoReady) && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' }}>
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {participant.userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium truncate max-w-[150px]">
              {participant.userName}
              {participant.isLocal && " (Jij)"}
            </span>
            {participant.isOwner && (
              <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded">
                Host
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!participant.audioOn && (
              <div className="w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center">
                <MicOff className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            {!participant.videoOn && (
              <div className="w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center">
                <VideoOff className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomDailyCall;
