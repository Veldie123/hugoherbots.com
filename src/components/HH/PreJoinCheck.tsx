import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  HelpCircle,
  ChevronDown,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ImageIcon,
  Sun,
  Sunset,
  Moon,
  Cloud,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/components/ui/utils";

type VirtualBgOption = 'none' | 'blur' | 'ochtend' | 'golden-hour' | 'avond' | 'bewolkt' | 'auto';

const VIRTUAL_BACKGROUNDS: Record<string, { label: string; image: string; icon: typeof Sun }> = {
  ochtend: { label: 'Ochtend', image: '/images/backgrounds/kantoor-ochtend.png', icon: Sun },
  'golden-hour': { label: 'Golden Hour', image: '/images/backgrounds/kantoor-golden-hour.png', icon: Sunset },
  avond: { label: 'Avond', image: '/images/backgrounds/kantoor-avond.png', icon: Moon },
  bewolkt: { label: 'Bewolkt', image: '/images/backgrounds/kantoor-bewolkt.png', icon: Cloud },
};

function getTimeBasedBackground(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'ochtend';
  if (hour >= 12 && hour < 17) return 'golden-hour';
  if (hour >= 17 && hour < 21) return 'avond';
  if (hour >= 21 || hour < 6) return 'avond';
  return 'ochtend';
}

interface PreJoinCheckProps {
  sessionTitle: string;
  onJoin: (selectedDevices: { 
    videoDeviceId?: string; 
    audioDeviceId?: string;
    isCameraEnabled: boolean;
    isMicEnabled: boolean;
    virtualBackground?: VirtualBgOption;
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [selectedBg, setSelectedBg] = useState<VirtualBgOption>('auto');
  const [showBgPicker, setShowBgPicker] = useState(false);

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
      virtualBackground: selectedBg,
    });
  };

  const handleRetry = () => {
    hasInitializedRef.current = false;
    requestInitialMediaAccess();
  };

  return (
    <Card className="rounded-[16px] shadow-hh-md border-hh-border overflow-hidden bg-hh-bg max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="px-4 py-3 border-b border-hh-border flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-sm text-hh-muted hover:text-hh-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug</span>
        </button>
        <div className="text-center flex-1">
          <span className="text-sm text-hh-muted">Deelnemen aan </span>
          <span className="text-sm font-medium text-hh-primary">{sessionTitle}</span>
        </div>
        <div className="w-16" />
      </div>

      <div className="p-4 space-y-4">
        {/* Camera Preview - Compact */}
        <div className="relative bg-hh-ink rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", maxHeight: "280px" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
              isCameraOn && isVideoReady ? "opacity-100" : "opacity-0"
            )}
            style={{ transform: "scaleX(-1)" }}
          />

          {(!isCameraOn || !isVideoReady) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-hh-ink to-hh-text">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                  {permissionState === "requesting" ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : !isCameraOn ? (
                    <VideoOff className="w-8 h-8 text-white" />
                  ) : (
                    <Video className="w-8 h-8 text-white" />
                  )}
                </div>
                <p className="text-white text-sm">
                  {permissionState === "requesting"
                    ? "Camera wordt gestart..."
                    : !isCameraOn
                    ? "Camera uit"
                    : "Laden..."}
                </p>
              </div>
            </div>
          )}

          {/* Camera/Mic/Background toggles overlay */}
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
            <button
              onClick={handleToggleCamera}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isCameraOn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 text-white"
              )}
              title={isCameraOn ? "Camera uit" : "Camera aan"}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={handleToggleMic}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isMicOn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 text-white"
              )}
              title={isMicOn ? "Microfoon uit" : "Microfoon aan"}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowBgPicker(!showBgPicker)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  selectedBg !== 'none' ? "bg-hh-primary text-white" : "bg-white/20 hover:bg-white/30 text-white"
                )}
                title="Virtuele achtergrond"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {showBgPicker && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-hh-bg rounded-xl shadow-2xl border border-hh-border p-3 w-[260px] z-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-semibold text-hh-text">Hugo's Kantoor</p>
                    <button onClick={() => setShowBgPicker(false)} className="p-0.5 rounded hover:bg-hh-ui-50">
                      <X className="w-3.5 h-3.5 text-hh-muted" />
                    </button>
                  </div>

                  <button
                    onClick={() => { setSelectedBg('auto'); setShowBgPicker(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors mb-1",
                      selectedBg === 'auto' ? "bg-hh-primary/10 text-hh-primary" : "hover:bg-hh-ui-50 text-hh-text"
                    )}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Automatisch (tijdsgebonden)
                    {selectedBg === 'auto' && <Check className="w-3 h-3 ml-auto text-hh-primary" />}
                  </button>

                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    {Object.entries(VIRTUAL_BACKGROUNDS).map(([key, bg]) => {
                      const Icon = bg.icon;
                      const isActive = selectedBg === key;
                      return (
                        <button
                          key={key}
                          onClick={() => { setSelectedBg(key as VirtualBgOption); setShowBgPicker(false); }}
                          className={cn(
                            "relative rounded-lg overflow-hidden border-2 transition-all aspect-video",
                            isActive ? "border-hh-primary ring-2 ring-hh-primary/30" : "border-transparent hover:border-hh-primary/50"
                          )}
                        >
                          <img src={bg.image} alt={bg.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-1 flex items-center gap-0.5">
                            <Icon className="w-2.5 h-2.5 text-white" />
                            <span className="text-[9px] text-white font-medium">{bg.label}</span>
                          </div>
                          {isActive && (
                            <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-hh-primary rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-hh-border pt-1.5 space-y-0.5">
                    <button
                      onClick={() => { setSelectedBg('blur'); setShowBgPicker(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                        selectedBg === 'blur' ? "bg-hh-primary/10 text-hh-primary" : "hover:bg-hh-ui-50 text-hh-text"
                      )}
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 blur-[1px]" />
                      Achtergrond vervagen
                      {selectedBg === 'blur' && <Check className="w-3 h-3 ml-auto text-hh-primary" />}
                    </button>
                    <button
                      onClick={() => { setSelectedBg('none'); setShowBgPicker(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                        selectedBg === 'none' ? "bg-hh-primary/10 text-hh-primary" : "hover:bg-hh-ui-50 text-hh-text"
                      )}
                    >
                      <VideoOff className="w-3.5 h-3.5" />
                      Geen achtergrond
                      {selectedBg === 'none' && <Check className="w-3 h-3 ml-auto text-hh-primary" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {permissionState === "error" || permissionState === "denied" ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700 text-sm mb-2">{errorMessage}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="gap-1 border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="w-3 h-3" />
                  Opnieuw
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Mic Level - Compact */}
            <div className="flex items-center gap-3 bg-hh-ui-50 rounded-lg px-3 py-2">
              <Mic className="w-4 h-4 text-hh-muted flex-shrink-0" />
              <div className="flex-1">
                <div className="h-2 bg-hh-ui-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-100 rounded-full bg-hh-primary"
                    style={{ width: `${isMicOn ? audioLevel : 0}%` }}
                  />
                </div>
              </div>
              {isMicOn && audioLevel > 5 && (
                <div className="flex items-center gap-1 text-xs text-hh-primary">
                  <CheckCircle className="w-3 h-3" />
                  <span>Geluid gedetecteerd</span>
                </div>
              )}
            </div>

            {/* Device Selectors - Compact Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-hh-muted mb-1">Camera</label>
                <Select
                  value={selectedVideoDevice}
                  onValueChange={handleVideoDeviceChange}
                  disabled={!isCameraOn || videoDevices.length === 0}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Selecteer camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-hh-muted mb-1">Microfoon</label>
                <Select
                  value={selectedAudioDevice}
                  onValueChange={handleAudioDeviceChange}
                  disabled={!isMicOn || audioDevices.length === 0}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Selecteer microfoon" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons - Normal size */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleJoin}
                className="flex-1 h-10 gap-2 bg-hh-primary hover:bg-hh-primary/90 text-white"
                disabled={permissionState === "requesting"}
              >
                {permissionState === "requesting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
                Deelnemen
              </Button>
              <Button
                variant="outline"
                onClick={onCancel}
                className="h-10 px-6"
              >
                Annuleren
              </Button>
            </div>
          </>
        )}

        {/* Help Section - Collapsible */}
        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between text-hh-muted hover:text-hh-text text-sm py-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                <span>Hulp nodig?</span>
              </div>
              <ChevronDown className={cn("w-4 h-4 transition-transform", helpOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-hh-ui-50 border border-hh-border rounded-lg p-4 mt-2 space-y-3 text-sm">
              <div>
                <h4 className="font-medium text-hh-text mb-1">Camera werkt niet?</h4>
                <ul className="text-hh-muted space-y-1 list-disc list-inside">
                  <li>Controleer of je browser toegang heeft tot de camera</li>
                  <li>Sluit andere apps die de camera gebruiken</li>
                  <li>Probeer een andere camera te selecteren</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-hh-text mb-1">Microfoon werkt niet?</h4>
                <ul className="text-hh-muted space-y-1 list-disc list-inside">
                  <li>Controleer of je browser toegang heeft tot de microfoon</li>
                  <li>Zorg dat je microfoon niet gedempt is</li>
                  <li>Probeer een andere microfoon te selecteren</li>
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
