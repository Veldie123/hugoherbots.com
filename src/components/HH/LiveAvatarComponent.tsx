/**
 * LiveAvatar React Component
 * 
 * Volledige frontend implementatie voor HeyGen LiveAvatar SDK.
 * GEEN iframe - dit gebruikt de officiële SDK.
 * 
 * Vereist:
 * - npm install @heygen/liveavatar-web-sdk
 * - Backend endpoint /api/liveavatar/session (zie liveavatar-backend.ts)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  LiveAvatarSession, 
  SessionState, 
  SessionEvent,
  AgentEventsEnum
} from "@heygen/liveavatar-web-sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, VideoOff, Mic, MicOff, Phone, PhoneOff } from "lucide-react";

interface LiveAvatarProps {
  v2SessionId?: string;
  onAvatarSpeech?: (text: string) => void;
  onUserSpeech?: (text: string) => void;
  language?: string;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "error" | "disconnected";

export function LiveAvatarComponent({ 
  v2SessionId,
  onAvatarSpeech,
  onUserSpeech,
  language = "nl"
}: LiveAvatarProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [transcript, setTranscript] = useState<Array<{
    role: "avatar" | "user";
    text: string;
    timestamp: Date;
  }>>([]);
  
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const startSession = useCallback(async () => {
    try {
      setStatus("connecting");
      setErrorMessage(null);
      
      const response = await fetch("/api/liveavatar/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to create session");
      }
      
      const { session_token } = await response.json();
      console.log("[LiveAvatar] Got session token");
      
      const session = new LiveAvatarSession(session_token, {
        voiceChat: true
      });
      
      sessionRef.current = session;
      
      session.on(SessionEvent.SESSION_STATE_CHANGED, (state: SessionState) => {
        console.log("[LiveAvatar] State changed:", state);
        if (state === SessionState.CONNECTED) {
          setStatus("connected");
        } else if (state === SessionState.DISCONNECTED) {
          setStatus("disconnected");
        }
      });
      
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        console.log("[LiveAvatar] Stream ready");
        if (videoRef.current) {
          session.attach(videoRef.current);
        }
      });
      
      session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
        console.log("[LiveAvatar] Disconnected:", reason);
        setStatus("disconnected");
      });
      
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        console.log("[LiveAvatar] Avatar started speaking");
        setIsAvatarTalking(true);
      });
      
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        console.log("[LiveAvatar] Avatar stopped speaking");
        setIsAvatarTalking(false);
      });
      
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
        console.log("[LiveAvatar] Avatar transcription:", event.text);
        setTranscript(prev => [...prev, {
          role: "avatar",
          text: event.text,
          timestamp: new Date()
        }]);
        onAvatarSpeech?.(event.text);
      });
      
      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
        console.log("[LiveAvatar] User started speaking");
        setIsUserTalking(true);
      });
      
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
        console.log("[LiveAvatar] User stopped speaking");
        setIsUserTalking(false);
      });
      
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
        console.log("[LiveAvatar] User transcription:", event.text);
        setTranscript(prev => [...prev, {
          role: "user",
          text: event.text,
          timestamp: new Date()
        }]);
        onUserSpeech?.(event.text);
      });
      
      await session.start();
      
      console.log("[LiveAvatar] Session started");
      setStatus("connected");
      
    } catch (error: any) {
      console.error("[LiveAvatar] Start error:", error);
      setStatus("error");
      setErrorMessage(error.message);
    }
  }, [language, onAvatarSpeech, onUserSpeech]);
  
  const stopSession = useCallback(async () => {
    try {
      if (sessionRef.current) {
        await sessionRef.current.stop();
        sessionRef.current = null;
      }
      setStatus("disconnected");
      setIsAvatarTalking(false);
      setIsUserTalking(false);
    } catch (error: any) {
      console.error("[LiveAvatar] Stop error:", error);
    }
  }, []);
  
  const speakText = useCallback(async (text: string) => {
    if (sessionRef.current && status === "connected") {
      try {
        sessionRef.current.message(text);
      } catch (error: any) {
        console.error("[LiveAvatar] Message error:", error);
      }
    }
  }, [status]);
  
  const interrupt = useCallback(() => {
    if (sessionRef.current && isAvatarTalking) {
      try {
        sessionRef.current.interrupt();
      } catch (error: any) {
        console.error("[LiveAvatar] Interrupt error:", error);
      }
    }
  }, [isAvatarTalking]);
  
  const toggleMute = useCallback(() => {
    if (sessionRef.current) {
      if (isMuted) {
        sessionRef.current.startListening();
      } else {
        sessionRef.current.stopListening();
      }
      setIsMuted(prev => !prev);
    }
  }, [isMuted]);
  
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop().catch(console.error);
      }
    };
  }, []);
  
  const getStatusColor = () => {
    switch (status) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };
  
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          LiveAvatar Video
        </CardTitle>
        <Badge className={getStatusColor()}>
          {status === "connecting" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {status}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {status === "connected" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {status === "connecting" ? (
                <Loader2 className="h-12 w-12 animate-spin text-white" />
              ) : (
                <VideoOff className="h-12 w-12 text-gray-500" />
              )}
            </div>
          )}
          
          {status === "connected" && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              {isAvatarTalking && (
                <Badge className="bg-blue-500 animate-pulse">
                  Avatar speaking...
                </Badge>
              )}
              {isUserTalking && (
                <Badge className="bg-green-500 animate-pulse">
                  You're speaking...
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {errorMessage && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}
        
        <div className="flex justify-center gap-3">
          {status === "idle" || status === "disconnected" || status === "error" ? (
            <Button 
              onClick={startSession}
              className="gap-2"
              data-testid="button-start-liveavatar"
            >
              <Phone className="h-4 w-4" />
              Start Video Call
            </Button>
          ) : status === "connecting" ? (
            <Button disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={toggleMute}
                className="gap-2"
                data-testid="button-toggle-mute"
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isMuted ? "Unmute" : "Mute"}
              </Button>
              
              {isAvatarTalking && (
                <Button
                  variant="outline"
                  onClick={interrupt}
                  data-testid="button-interrupt"
                >
                  Interrupt
                </Button>
              )}
              
              <Button
                variant="destructive"
                onClick={stopSession}
                className="gap-2"
                data-testid="button-stop-liveavatar"
              >
                <PhoneOff className="h-4 w-4" />
                End Call
              </Button>
            </>
          )}
        </div>
        
        {transcript.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto space-y-2 p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Transcript</h4>
            {transcript.map((entry, i) => (
              <div 
                key={i}
                className={`text-sm p-2 rounded ${
                  entry.role === "avatar" 
                    ? "bg-blue-100 dark:bg-blue-900/30" 
                    : "bg-green-100 dark:bg-green-900/30"
                }`}
              >
                <span className="font-medium">
                  {entry.role === "avatar" ? "Hugo" : "Jij"}:
                </span>{" "}
                {entry.text}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveAvatarComponent;
