/**
 * Tavus Phoenix-4 CVI implementation of the AvatarProvider interface.
 *
 * Uses Daily.co WebRTC (already installed) under the hood.
 * Tavus conversations are created via our backend, then joined via Daily SDK.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { apiFetch } from "../services/apiFetch";
import type {
  AvatarConnectionStatus,
  AvatarTranscriptEntry,
  AvatarProviderResult,
  AvatarProviderOptions,
} from "./useAvatarProvider";

export function useTavusAvatar(
  options: AvatarProviderOptions = {}
): AvatarProviderResult {
  const { onAvatarSpeech, onUserSpeech } = options;

  const [status, setStatus] = useState<AvatarConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<AvatarTranscriptEntry[]>([]);

  const dailyRef = useRef<DailyCall | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Stable refs for callbacks
  const onAvatarSpeechRef = useRef(onAvatarSpeech);
  onAvatarSpeechRef.current = onAvatarSpeech;
  const onUserSpeechRef = useRef(onUserSpeech);
  onUserSpeechRef.current = onUserSpeech;

  const attachRemoteVideo = useCallback((daily: DailyCall) => {
    if (!videoRef.current) return;

    const participants = daily.participants();
    for (const [id, p] of Object.entries(participants)) {
      if (id === "local") continue;
      const videoTrack = p?.tracks?.video?.persistentTrack;
      if (videoTrack) {
        const stream = new MediaStream([videoTrack]);
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        break;
      }
    }
  }, []);

  const start = useCallback(async () => {
    if (dailyRef.current) return;

    try {
      setStatus("connecting");
      setErrorMessage(null);

      // Create Tavus conversation via our backend
      const response = await apiFetch("/api/tavus/session", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.details || error.error || "Failed to create Tavus session"
        );
      }

      const { conversation_url, conversation_id } = await response.json();
      conversationIdRef.current = conversation_id;

      // Create Daily call and join the Tavus conversation
      const daily = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      });
      dailyRef.current = daily;

      // Listen for remote participant video (the Tavus replica)
      daily.on("participant-joined", () => {
        attachRemoteVideo(daily);
      });

      daily.on("track-started", () => {
        attachRemoteVideo(daily);
      });

      // Listen for Tavus interaction events via app-message
      daily.on("app-message", (event: any) => {
        if (!event?.data) return;
        const { event_type, properties } = event.data;

        if (event_type === "conversation.started_speaking") {
          setIsAvatarTalking(true);
        } else if (event_type === "conversation.stopped_speaking") {
          setIsAvatarTalking(false);
        } else if (event_type === "conversation.utterance") {
          const speaker = properties?.speaker;
          const text = properties?.text;
          if (!text) return;

          const role = speaker === "replica" ? "avatar" : "user";
          setTranscript((prev) => [
            ...prev,
            { role, text, timestamp: new Date() },
          ]);

          if (role === "avatar") onAvatarSpeechRef.current?.(text);
          else onUserSpeechRef.current?.(text);
        } else if (event_type === "conversation.user_started_speaking") {
          setIsUserTalking(true);
        } else if (event_type === "conversation.user_stopped_speaking") {
          setIsUserTalking(false);
        }
      });

      daily.on("left-meeting", () => {
        setStatus("disconnected");
      });

      daily.on("error", (event: any) => {
        console.error("[TavusAvatar] Daily error:", event);
        setStatus("error");
        setErrorMessage(event?.errorMsg || "Connection error");
      });

      await daily.join({ url: conversation_url });
      setStatus("connected");
    } catch (error: any) {
      console.error("[TavusAvatar] Start error:", error);
      setStatus("error");
      setErrorMessage(error.message);
      if (dailyRef.current) {
        dailyRef.current.destroy();
        dailyRef.current = null;
      }
    }
  }, [attachRemoteVideo]);

  const stop = useCallback(async () => {
    try {
      if (dailyRef.current) {
        await dailyRef.current.leave();
        dailyRef.current.destroy();
        dailyRef.current = null;
      }
      conversationIdRef.current = null;
      setStatus("disconnected");
      setIsAvatarTalking(false);
      setIsUserTalking(false);
    } catch (error: any) {
      console.error("[TavusAvatar] Stop error:", error);
    }
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (!dailyRef.current || status !== "connected" || !conversationIdRef.current) return;

      try {
        // conversation.echo = avatar says exactly this text
        dailyRef.current.sendAppMessage({
          message_type: "conversation",
          event_type: "conversation.echo",
          conversation_id: conversationIdRef.current,
          properties: { text, modality: "text" },
        });
      } catch (error: any) {
        console.error("[TavusAvatar] Echo error:", error);
      }
    },
    [status]
  );

  const interrupt = useCallback(() => {
    if (!dailyRef.current || !isAvatarTalking || !conversationIdRef.current) return;

    try {
      dailyRef.current.sendAppMessage({
        message_type: "conversation",
        event_type: "conversation.interrupt",
        conversation_id: conversationIdRef.current,
      });
    } catch (error: any) {
      console.error("[TavusAvatar] Interrupt error:", error);
    }
  }, [isAvatarTalking]);

  const toggleMute = useCallback(() => {
    if (!dailyRef.current) return;

    const newMuted = !isMuted;
    dailyRef.current.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dailyRef.current) {
        dailyRef.current.leave().catch(() => {});
        dailyRef.current.destroy();
        dailyRef.current = null;
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
