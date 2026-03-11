import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/components/ui/utils";

interface PreJoinCheckProps {
  sessionTitle: string;
  onJoin: (selectedDevices: {
    videoDeviceId?: string;
    audioDeviceId?: string;
    isCameraEnabled: boolean;
    isMicEnabled: boolean;
    virtualBackground?: string;
  }) => void;
  onCancel: () => void;
}

type PermissionState = "idle" | "requesting" | "granted" | "denied" | "error";

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export function PreJoinCheck({ sessionTitle, onJoin, onCancel }: PreJoinCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasInitializedRef = useRef(false);
  const isJoiningRef = useRef(false);

  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [videoDevices, setVideoDevices] = useState<DeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<DeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    stopAudioMonitoring();
    setIsVideoReady(false);
  }, [stopAudioMonitoring]);

  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    stopAudioMonitoring();

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        setAudioLevel(normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("[PreJoinCheck] Audio monitoring failed:", err);
    }
  }, [stopAudioMonitoring]);

  const attachVideoToPreview = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play()
        .then(() => setIsVideoReady(true))
        .catch((e) => console.warn("[PreJoinCheck] Video play failed:", e));
    }
  }, []);

  const requestInitialMediaAccess = useCallback(async () => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    stopCurrentStream();
    setPermissionState("requesting");
    setErrorMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;

      attachVideoToPreview(stream);
      startAudioLevelMonitoring(stream);

      const devices = await navigator.mediaDevices.enumerateDevices();

      const cameras = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));

      const microphones = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microfoon ${i + 1}`,
        }));

      setVideoDevices(cameras);
      setAudioDevices(microphones);

      const activeVideoTrack = stream.getVideoTracks()[0];
      const activeVideoId = activeVideoTrack?.getSettings().deviceId;
      setSelectedVideoDevice(activeVideoId || cameras[0]?.deviceId || "");

      const activeAudioTrack = stream.getAudioTracks()[0];
      const activeAudioId = activeAudioTrack?.getSettings().deviceId;
      setSelectedAudioDevice(activeAudioId || microphones[0]?.deviceId || "");

      setPermissionState("granted");
    } catch (err: any) {
      console.error("[PreJoinCheck] Permission error:", err);
      setPermissionState("error");

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionState("denied");
        setErrorMessage(
          "Toegang tot camera/microfoon is geweigerd. Sta toegang toe in je browserinstellingen."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMessage(
          "Geen camera of microfoon gevonden. Controleer of je apparaten correct zijn aangesloten."
        );
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setErrorMessage(
          "Je camera of microfoon wordt al gebruikt door een andere applicatie."
        );
      } else if (err.name === "OverconstrainedError") {
        setErrorMessage(
          "Het geselecteerde apparaat is niet beschikbaar."
        );
      } else {
        setErrorMessage(
          `Er is een fout opgetreden: ${err.message || "Onbekende fout"}`
        );
      }
    }
  }, [stopCurrentStream, attachVideoToPreview, startAudioLevelMonitoring]);

  const switchVideoDevice = useCallback(async (newDeviceId: string) => {
    if (!newDeviceId || !streamRef.current) return;

    try {
      const oldVideoTracks = streamRef.current.getVideoTracks();
      oldVideoTracks.forEach(track => {
        streamRef.current?.removeTrack(track);
        track.stop();
      });

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: newDeviceId } },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack && streamRef.current) {
        streamRef.current.addTrack(newVideoTrack);
        attachVideoToPreview(streamRef.current);
      }
    } catch (err) {
      console.error("[PreJoinCheck] Failed to switch video device:", err);
    }
  }, [attachVideoToPreview]);

  const switchAudioDevice = useCallback(async (newDeviceId: string) => {
    if (!newDeviceId || !streamRef.current) return;

    try {
      stopAudioMonitoring();

      const oldAudioTracks = streamRef.current.getAudioTracks();
      oldAudioTracks.forEach(track => {
        streamRef.current?.removeTrack(track);
        track.stop();
      });

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { deviceId: { exact: newDeviceId } },
      });

      const newAudioTrack = newStream.getAudioTracks()[0];
      if (newAudioTrack && streamRef.current) {
        streamRef.current.addTrack(newAudioTrack);
        if (isMicOn) {
          startAudioLevelMonitoring(streamRef.current);
        }
      }
    } catch (err) {
      console.error("[PreJoinCheck] Failed to switch audio device:", err);
    }
  }, [stopAudioMonitoring, startAudioLevelMonitoring, isMicOn]);

  useEffect(() => {
    requestInitialMediaAccess();
    return () => {
      if (!isJoiningRef.current) {
        stopCurrentStream();
        stopAudioMonitoring();
      }
    };
  }, []);

  const handleVideoDeviceChange = useCallback((deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    switchVideoDevice(deviceId);
  }, [switchVideoDevice]);

  const handleAudioDeviceChange = useCallback((deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    switchAudioDevice(deviceId);
  }, [switchAudioDevice]);

  const handleToggleCamera = useCallback(async () => {
    const newState = !isCameraOn;
    setIsCameraOn(newState);

    if (!newState) {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsVideoReady(false);
    } else {
      if (streamRef.current) {
        const existingVideoTracks = streamRef.current.getVideoTracks();
        if (existingVideoTracks.length > 0) {
          existingVideoTracks.forEach((track) => {
            track.enabled = true;
          });
          attachVideoToPreview(streamRef.current);
        } else {
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: selectedVideoDevice
                ? { deviceId: { exact: selectedVideoDevice } }
                : true,
              audio: false,
            });
            const newVideoTrack = newStream.getVideoTracks()[0];
            if (newVideoTrack) {
              streamRef.current.addTrack(newVideoTrack);
              attachVideoToPreview(streamRef.current);
              const newDeviceId = newVideoTrack.getSettings().deviceId;
              if (newDeviceId) {
                setSelectedVideoDevice(newDeviceId);
              }
            }
          } catch (err) {
            console.error("[PreJoinCheck] Failed to restart camera:", err);
          }
        }
      }
    }
  }, [isCameraOn, selectedVideoDevice, attachVideoToPreview]);

  const handleToggleMic = useCallback(async () => {
    const newState = !isMicOn;
    setIsMicOn(newState);

    if (!newState) {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      stopAudioMonitoring();
    } else {
      if (streamRef.current) {
        const existingAudioTracks = streamRef.current.getAudioTracks();
        if (existingAudioTracks.length > 0) {
          existingAudioTracks.forEach((track) => {
            track.enabled = true;
          });
          startAudioLevelMonitoring(streamRef.current);
        } else {
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: selectedAudioDevice
                ? { deviceId: { exact: selectedAudioDevice } }
                : true,
            });
            const newAudioTrack = newStream.getAudioTracks()[0];
            if (newAudioTrack) {
              streamRef.current.addTrack(newAudioTrack);
              startAudioLevelMonitoring(streamRef.current);
              const newDeviceId = newAudioTrack.getSettings().deviceId;
              if (newDeviceId) {
                setSelectedAudioDevice(newDeviceId);
              }
            }
          } catch (err) {
            console.error("[PreJoinCheck] Failed to restart mic:", err);
          }
        }
      }
    }
  }, [isMicOn, selectedAudioDevice, stopAudioMonitoring, startAudioLevelMonitoring]);

  const handleJoin = () => {
    isJoiningRef.current = true;

    const videoDeviceId = selectedVideoDevice || videoDevices[0]?.deviceId;
    const audioDeviceId = selectedAudioDevice || audioDevices[0]?.deviceId;

    stopCurrentStream();
    stopAudioMonitoring();

    onJoin({
      videoDeviceId: isCameraOn ? videoDeviceId : undefined,
      audioDeviceId: isMicOn ? audioDeviceId : undefined,
      isCameraEnabled: isCameraOn,
      isMicEnabled: isMicOn,
      virtualBackground: 'none',
    });
  };

  const handleRetry = () => {
    hasInitializedRef.current = false;
    requestInitialMediaAccess();
  };

  return (
    <div className="flex flex-col h-full min-h-[70vh] bg-hh-ink relative">
      {/* Top bar — overlays the video */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--hh-ink) 80%, transparent) 0%, transparent 100%)" }}
      >
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug</span>
        </button>
        <div className="text-center flex-1 min-w-0 px-4">
          <span className="text-sm text-white/50">Deelnemen aan </span>
          <span className="text-sm font-medium text-white">{sessionTitle}</span>
        </div>
        <div className="w-16 flex-shrink-0" />
      </div>

      {/* Full-bleed video preview */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            isCameraOn && isVideoReady ? "opacity-100" : "opacity-0"
          )}
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Camera-off / loading / error state */}
        {(!isCameraOn || !isVideoReady) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-hh-ink via-hh-ink/90 to-hh-ink/70">
            {permissionState === "error" || permissionState === "denied" ? (
              <div className="text-center px-6 max-w-md">
                <div className="w-20 h-20 rounded-full bg-hh-error/15 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-9 h-9 text-hh-error" />
                </div>
                <p className="text-white/80 text-sm mb-4 leading-relaxed">{errorMessage}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-white/20 text-white hover:bg-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Opnieuw proberen
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-white/8 flex items-center justify-center mx-auto mb-4">
                  {permissionState === "requesting" ? (
                    <Loader2 className="w-10 h-10 text-white/50 animate-spin" />
                  ) : (
                    <VideoOff className="w-10 h-10 text-white/40" />
                  )}
                </div>
                <p className="text-white/50 text-sm">
                  {permissionState === "requesting"
                    ? "Camera wordt gestart..."
                    : "Camera staat uit"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="bg-hh-bg border-t border-hh-border flex-shrink-0">
        {/* Audio level — thin bar */}
        {isMicOn && permissionState === "granted" && (
          <div className="h-1 bg-hh-ui-200">
            <div
              className="h-full transition-all duration-100 bg-hh-success"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
        )}

        {/* Device selectors row — separate from controls */}
        <div className="hidden sm:flex items-center justify-center gap-3 px-4 pt-3 pb-1">
          <Select
            value={selectedVideoDevice}
            onValueChange={handleVideoDeviceChange}
            disabled={!isCameraOn || videoDevices.length === 0}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs border-hh-border">
              <SelectValue placeholder="Camera" />
            </SelectTrigger>
            <SelectContent>
              {videoDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedAudioDevice}
            onValueChange={handleAudioDeviceChange}
            disabled={!isMicOn || audioDevices.length === 0}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs border-hh-border">
              <SelectValue placeholder="Microfoon" />
            </SelectTrigger>
            <SelectContent>
              {audioDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isMicOn && audioLevel > 5 && (
            <div className="flex items-center gap-1 text-xs text-hh-success">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Geluid gedetecteerd</span>
            </div>
          )}
        </div>

        {/* Main controls row — stable layout */}
        <div className="flex items-center justify-center px-4 py-3 gap-3">
          <Button
            size="lg"
            variant={isCameraOn ? "secondary" : "destructive"}
            onClick={handleToggleCamera}
            className="w-12 h-12 rounded-full p-0"
            title={isCameraOn ? "Camera uit" : "Camera aan"}
          >
            {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
          <Button
            size="lg"
            variant={isMicOn ? "secondary" : "destructive"}
            onClick={handleToggleMic}
            className="w-12 h-12 rounded-full p-0"
            title={isMicOn ? "Microfoon uit" : "Microfoon aan"}
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>
          <div className="w-px h-8 bg-hh-border mx-2" />
          <Button
            onClick={handleJoin}
            className="h-11 gap-2 px-8 bg-hh-success hover:bg-hh-success/90 text-white font-medium rounded-full shadow-lg"
            disabled={permissionState === "requesting"}
          >
            {permissionState === "requesting" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Video className="w-4 h-4" />
            )}
            <span>Deelnemen</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
