/**
 * Platform-agnostic avatar provider interface.
 *
 * Abstracts HeyGen LiveAvatar and Tavus Phoenix-4 behind a common API
 * so the UI layer doesn't know which platform is active.
 */

import { type RefObject } from "react";
import { useHeyGenAvatar } from "./useHeyGenAvatar";
import { useTavusAvatar } from "./useTavusAvatar";

export type AvatarPlatform = "heygen" | "tavus";

export type AvatarConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

export interface AvatarTranscriptEntry {
  role: "avatar" | "user";
  text: string;
  timestamp: Date;
}

export interface AvatarProviderResult {
  // State
  status: AvatarConnectionStatus;
  errorMessage: string | null;
  isAvatarTalking: boolean;
  isUserTalking: boolean;
  isMuted: boolean;
  transcript: AvatarTranscriptEntry[];
  // Ref — attach to a <video> element
  videoRef: RefObject<HTMLVideoElement | null>;
  // Actions
  start: () => Promise<void>;
  stop: () => Promise<void>;
  speakText: (text: string) => void;
  interrupt: () => void;
  toggleMute: () => void;
}

export interface AvatarProviderOptions {
  language?: string;
  onAvatarSpeech?: (text: string) => void;
  onUserSpeech?: (text: string) => void;
}

export function useAvatarProvider(
  platform: AvatarPlatform,
  options: AvatarProviderOptions = {}
): AvatarProviderResult {
  const heygen = useHeyGenAvatar(options);
  const tavus = useTavusAvatar(options);

  return platform === "tavus" ? tavus : heygen;
}
