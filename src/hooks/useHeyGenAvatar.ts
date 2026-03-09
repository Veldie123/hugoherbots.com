/**
 * HeyGen LiveAvatar implementation of the AvatarProvider interface.
 *
 * Manages HeyGen session lifecycle, event listeners, speak/interrupt/mute.
 * Used via useAvatarProvider("heygen", options).
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  LiveAvatarSession,
  SessionState,
  SessionEvent,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";
import { apiFetch } from "../services/apiFetch";
import type {
  AvatarConnectionStatus,
  AvatarTranscriptEntry,
  AvatarProviderResult,
  AvatarProviderOptions,
} from "./useAvatarProvider";

export function useHeyGenAvatar(
  options: AvatarProviderOptions = {}
): AvatarProviderResult {
  const { language = "nl", onAvatarSpeech, onUserSpeech } = options;

  const [status, setStatus] = useState<AvatarConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<AvatarTranscriptEntry[]>([]);

  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stable refs for callbacks (avoid re-creating session on callback change)
  const onAvatarSpeechRef = useRef(onAvatarSpeech);
  onAvatarSpeechRef.current = onAvatarSpeech;
  const onUserSpeechRef = useRef(onUserSpeech);
  onUserSpeechRef.current = onUserSpeech;

  const start = useCallback(async () => {
    if (sessionRef.current) return;

    try {
      setStatus("connecting");
      setErrorMessage(null);

      const response = await apiFetch("/api/liveavatar/session", {
        method: "POST",
        body: JSON.stringify({ language }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.details || error.error || "Failed to create session"
        );
      }

      const { session_token } = await response.json();

      const session = new LiveAvatarSession(session_token, {
        voiceChat: true,
      });
      sessionRef.current = session;

      session.on(
        SessionEvent.SESSION_STATE_CHANGED,
        (state: SessionState) => {
          if (state === SessionState.CONNECTED) setStatus("connected");
          else if (state === SessionState.DISCONNECTED)
            setStatus("disconnected");
        }
      );

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) {
          session.attach(videoRef.current);
        }
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        setStatus("disconnected");
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () =>
        setIsAvatarTalking(true)
      );
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () =>
        setIsAvatarTalking(false)
      );

      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
        setTranscript((prev) => [
          ...prev,
          { role: "avatar", text: event.text, timestamp: new Date() },
        ]);
        onAvatarSpeechRef.current?.(event.text);
      });

      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () =>
        setIsUserTalking(true)
      );
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () =>
        setIsUserTalking(false)
      );

      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
        setTranscript((prev) => [
          ...prev,
          { role: "user", text: event.text, timestamp: new Date() },
        ]);
        onUserSpeechRef.current?.(event.text);
      });

      await session.start();
      setStatus("connected");
    } catch (error: any) {
      console.error("[HeyGenAvatar] Start error:", error);
      setStatus("error");
      setErrorMessage(error.message);
    }
  }, [language]);

  const stop = useCallback(async () => {
    try {
      if (sessionRef.current) {
        await sessionRef.current.stop();
        sessionRef.current = null;
      }
      setStatus("disconnected");
      setIsAvatarTalking(false);
      setIsUserTalking(false);
    } catch (error: any) {
      console.error("[HeyGenAvatar] Stop error:", error);
    }
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (sessionRef.current && status === "connected") {
        try {
          sessionRef.current.message(text);
        } catch (error: any) {
          console.error("[HeyGenAvatar] Message error:", error);
        }
      }
    },
    [status]
  );

  const interrupt = useCallback(() => {
    if (sessionRef.current && isAvatarTalking) {
      try {
        sessionRef.current.interrupt();
      } catch (error: any) {
        console.error("[HeyGenAvatar] Interrupt error:", error);
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
      setIsMuted((prev) => !prev);
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop().catch(console.error);
        sessionRef.current = null;
      }
    };
  }, []);

  return {
    status,
    errorMessage,
    isAvatarTalking,
    isUserTalking,
    isMuted,
    transcript,
    videoRef,
    start,
    stop,
    speakText,
    interrupt,
    toggleMute,
  };
}
