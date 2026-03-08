// Live Analyse — Real-time in-call coaching types

export type TipType = "wedervraag" | "lock" | "waarschuwing" | "open" | "positief";

export type Speaker = "you" | "client";

export interface TranscriptEntry {
  speaker: Speaker;
  text: string;
  timestamp: string;
  isPartial?: boolean;
}

export interface CoachingTip {
  id: string;
  type: TipType;
  text: string;
  houding: string;        // e.g. "H3 — Schijninstemming"
  detectedTechnique?: string;
  recommendedTechnique?: string;
  phase: number;
  timestamp: string;
}

export interface PhaseTransition {
  from: number;
  to: number;
  timestamp: string;
}

export interface LiveAnalyseSession {
  id: string;
  userId: string;
  status: "active" | "completed";
  transcript: TranscriptEntry[];
  tips: CoachingTip[];
  phaseHistory: PhaseTransition[];
  finalPhase: number;
  durationSeconds: number;
  createdAt: string;
  completedAt?: string;
}

// WebSocket events: server → client
export interface WsSessionStarted {
  type: "la:session_started";
  sessionId: string;
}

export interface WsTip {
  type: "la:tip";
  tip: CoachingTip;
}

export interface WsPhaseUpdate {
  type: "la:phase_update";
  phase: number;
  previousPhase: number;
}

export interface WsTranscript {
  type: "committed_transcript" | "partial_transcript";
  text: string;
}

export interface WsError {
  type: "la:error";
  message: string;
}

export type WsServerEvent = WsSessionStarted | WsTip | WsPhaseUpdate | WsTranscript | WsError;

// WebSocket events: client → server
export interface WsSpeakerMark {
  type: "speaker_mark";
  speaker: Speaker;
}

export interface WsStopSession {
  type: "stop_session";
}

export type WsClientEvent = WsSpeakerMark | WsStopSession;
