import { useEffect, useCallback, useState, useRef } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PhoneOff,
  X,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { activityService } from "@/services/activityService";

interface LiveSessionCallProps {
  roomUrl: string;
  token: string;
  sessionId: string;
  sessionTitle: string;
  isHost: boolean;
  onLeave: () => void;
  onEndSession?: () => void;
}

export function LiveSessionCall({
  roomUrl,
  token,
  sessionId,
  sessionTitle,
  isHost,
  onLeave,
  onEndSession,
}: LiveSessionCallProps) {
  const [callFrame, setCallFrame] = useState<DailyCall | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<DailyCall | null>(null);
  const hasLoggedWebinarAttend = useRef(false);

  const destroyFrame = useCallback(() => {
    if (frameRef.current) {
      try {
        frameRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying Daily frame:", e);
      }
      frameRef.current = null;
    }
  }, []);

  const initializeCall = useCallback(async () => {
    if (!roomUrl || !token || !containerRef.current) return;
    
    destroyFrame();
    setError(null);
    setIsRetrying(false);

    try {
      const frame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        showFullscreenButton: true,
        iframeStyle: {
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          border: "0",
        },
      });

      frameRef.current = frame;

      frame.on("joined-meeting", async () => {
        setIsJoined(true);
        console.log("Joined Daily meeting");
        if (!hasLoggedWebinarAttend.current) {
          hasLoggedWebinarAttend.current = true;
          await activityService.logWebinarAttend(sessionId, sessionTitle);
        }
      });

      frame.on("left-meeting", () => {
        setIsJoined(false);
        destroyFrame();
        onLeave();
      });

      frame.on("error", (event) => {
        console.error("Daily error:", event);
        setError(event?.errorMsg || "Connection error");
      });

      await frame.join({ url: roomUrl, token });
      setCallFrame(frame);
      console.log("Daily frame joined successfully");
    } catch (err: any) {
      console.error("Failed to join Daily room:", err);
      destroyFrame();
      const errorMessage = err?.message || err?.error || JSON.stringify(err) || "Onbekende fout";
      if (errorMessage.includes("expired") || errorMessage.includes("not found") || errorMessage === "{}") {
        setError("Deze sessie is verlopen of niet meer beschikbaar. Beëindig de sessie en start een nieuwe.");
      } else {
        setError(`Kon niet verbinden: ${errorMessage}`);
      }
    }
  }, [roomUrl, token, destroyFrame, onLeave]);

  useEffect(() => {
    initializeCall();

    return () => {
      destroyFrame();
    };
  }, [roomUrl, token]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await initializeCall();
  };

  const handleLeave = useCallback(() => {
    if (callFrame) {
      callFrame.leave().then(() => {
        destroyFrame();
        onLeave();
      }).catch(() => {
        destroyFrame();
        onLeave();
      });
    } else {
      onLeave();
    }
  }, [callFrame, destroyFrame, onLeave]);

  const handleEndSession = useCallback(() => {
    if (callFrame) {
      callFrame.leave().then(() => {
        destroyFrame();
        onEndSession?.();
      }).catch(() => {
        destroyFrame();
        onEndSession?.();
      });
    } else {
      onEndSession?.();
    }
  }, [callFrame, destroyFrame, onEndSession]);

  if (error) {
    return (
      <Card className="p-6 bg-red-50 border-red-200">
        <div className="text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">
            Verbindingsfout
          </h3>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="default" 
              onClick={handleRetry}
              disabled={isRetrying}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
              Opnieuw proberen
            </Button>
            <Button variant="outline" onClick={onLeave}>
              Terug
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLeave}
            className="text-gray-300 hover:text-white hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Terug naar overzicht
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white font-medium text-sm">{sessionTitle}</span>
          {isHost && (
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded">
              HOST
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isHost && onEndSession && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleEndSession}
              className="gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              Beëindig Sessie
            </Button>
          )}
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative bg-black"
        style={{ minHeight: "calc(100vh - 200px)" }}
      >
        {!callFrame && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center text-white">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
              <p>Verbinden met sessie...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
