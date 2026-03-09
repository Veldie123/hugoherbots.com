/**
 * @deprecated Use useAvatarProvider or useHeyGenAvatar directly.
 * This file re-exports for backward compatibility.
 */
export { useHeyGenAvatar as useLiveAvatar } from "./useHeyGenAvatar";
export type {
  AvatarConnectionStatus,
  AvatarTranscriptEntry as LiveAvatarTranscriptEntry,
} from "./useAvatarProvider";
