/**
 * Hugo Engine API Service
 * Connects frontend to the V2 backend
 */
import { apiFetch } from './apiFetch';

const API_BASE = "/api";

// Backward-compatible re-export — use apiFetch directly in new code
export { apiFetch as fetchWithAuth } from './apiFetch';

export interface StartSessionRequest {
  techniqueId: string;
  mode?: "COACH_CHAT" | "ROLEPLAY";
  isExpert?: boolean;
  modality?: "chat" | "audio" | "video";
  viewMode?: "admin" | "user";
}

export interface StartSessionResponse {
  sessionId: string;
  phase: string;
  message: string;
  initialMessage?: string;
  type?: string;
  signal?: string;
  coachMode?: boolean;
  ragDocuments?: any[];
  contextLoaded?: boolean;
  richContent?: Array<{ type: string; data: Record<string, unknown> }>;
  onboardingStatus?: {
    technieken: { total: number; reviewed: number; pending: number };
    houdingen: { total: number; reviewed: number; pending: number };
    isComplete: boolean;
    nextItem: { module: string; key: string; name: string } | null;
  };
  debug?: {
    persona?: any;
    attitude?: string | null;
    signal?: string | null;
    context?: {
      sector?: string;
      product?: string;
      klant_type?: string;
      isComplete?: boolean;
      turnNumber?: number;
      phase?: string;
      techniqueId?: string;
    };
    attitudeConfig?: any;
    expectedMoves?: string[];
    promptUsed?: string;
    promptsUsed?: {
      systemPrompt?: string;
      userPrompt?: string;
    };
  };
  state?: any;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  isExpert?: boolean;
}

export interface LevelTransition {
  previousLevel: number;
  newLevel: number;
  reason: string;
  shouldCongratulate: boolean;
}

export interface SendMessageResponse {
  response: string;
  phase: string;
  contextData?: {
    sector?: string;
    product?: string;
    klant_type?: string;
    verkoopkanaal?: string;
  };
  levelTransition?: LevelTransition;
  richContent?: import("@/types/crossPlatform").RichContent[];
  debug?: {
    phase?: string;
    signal?: string;
    detectedTechniques?: string[];
    evaluation?: string;
    contextComplete?: boolean;
    gatheredFields?: string[];
    persona?: any;
    context?: any;
    customerDynamics?: any;
    aiDecision?: any;
    ragDocuments?: any[];
  };
  promptsUsed?: {
    systemPrompt?: string;
    userPrompt?: string;
  };
}

interface V3StreamEvent {
  type: "thinking" | "tool_start" | "tool_result" | "token" | "done" | "error";
  content?: string;
  name?: string;
  usage?: { inputTokens: number; outputTokens: number; thinkingTokens?: number };
  toolsUsed?: string[];
}

export interface Technique {
  nummer: string;
  naam: string;
  fase: string;
  parent?: string;
  description?: string;
}

export interface UserContext {
  sector?: string;
  product?: string;
  klantType?: string;
  verkoopkanaal?: string;
  ervaring?: string;
  naam?: string;
}

export interface EvaluationResult {
  overallScore: number;
  scores: {
    engagement: number;
    technical: number;
    contextGathering: number;
  };
  technique: string;
  recommendation: string;
  nextSteps: string[];
}

export type ThinkingMode = "fast" | "auto" | "deep";

class HugoApiService {
  private currentSessionId: string | null = null;
  private useV3 = false;
  private thinkingMode: ThinkingMode = "auto";

  setV3Mode(enabled: boolean): void {
    this.useV3 = enabled;
  }

  setThinkingMode(mode: ThinkingMode): void {
    this.thinkingMode = mode;
  }

  setCurrentSessionId(id: string | null): void {
    this.currentSessionId = id;
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /** Persist V3 session ID across navigation via sessionStorage */
  persistSessionId(id: string | null): void {
    this.currentSessionId = id;
    if (id) {
      sessionStorage.setItem('hh_active_v3_session', id);
    } else {
      sessionStorage.removeItem('hh_active_v3_session');
    }
  }

  /** Restore V3 session ID from sessionStorage */
  getPersistedSessionId(): string | null {
    return sessionStorage.getItem('hh_active_v3_session');
  }

  async startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    if (this.useV3) {
      return this.startSessionV3(request);
    }

    const response = await apiFetch(`${API_BASE}/v2/sessions`, {
      method: "POST",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to start session: ${response.statusText}`);
    }

    const data = await response.json();
    this.currentSessionId = data.sessionId;
    return data;
  }

  private async startSessionV3(request: StartSessionRequest): Promise<StartSessionResponse> {
    const response = await apiFetch(`${API_BASE}/v3/session`, {
      method: "POST",
      body: JSON.stringify({
        techniqueId: request.techniqueId,
        userProfile: {},
        mode: request.viewMode === "admin" ? "admin" : "coaching",
        thinkingMode: this.thinkingMode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `Failed to start V3 session: ${response.statusText}`);
    }

    const data = await response.json();
    this.persistSessionId(data.sessionId);

    // Map V3 response to V2 format expected by frontend
    return {
      sessionId: data.sessionId,
      phase: "COACH_CHAT",
      message: data.opening?.text || "",
      initialMessage: data.opening?.text || "",
    };
  }

  async startSessionStream(
    request: StartSessionRequest,
    onToken: (token: string) => void,
    onDone?: (meta?: { onboardingStatus?: any }) => void
  ): Promise<string> {
    if (this.useV3) {
      // V3 doesn't have streaming yet — simulate with non-streaming call
      const result = await this.startSessionV3(request);
      if (result.message) onToken(result.message);
      if (onDone) onDone();
      return result.sessionId;
    }

    const response = await apiFetch(`${API_BASE}/v2/sessions/stream`, {
      method: "POST",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to start streaming session: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let sessionId = "";
    let doneMeta: { onboardingStatus?: any } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "session") {
              sessionId = data.sessionId;
              this.currentSessionId = sessionId;
            } else if (data.type === "token" && data.content) {
              onToken(data.content);
            } else if (data.type === "done") {
              doneMeta = { onboardingStatus: data.onboardingStatus };
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) throw e;
            console.error("Failed to parse SSE data:", e);
          }
        }
      }
    }

    if (doneMeta && onDone) onDone(doneMeta);

    if (!sessionId) throw new Error("No session ID received");
    return sessionId;
  }

  async sendMessage(content: string, isExpert = false, systemContext?: string): Promise<SendMessageResponse> {
    if (!this.currentSessionId) {
      throw new Error("No active session. Call startSession first.");
    }

    if (this.useV3) {
      return this.sendMessageV3(content);
    }

    const body: Record<string, unknown> = {
      sessionId: this.currentSessionId,
      message: content,
      debug: true,
      expertMode: isExpert,
    };
    if (systemContext) {
      body.systemContext = systemContext;
    }

    const response = await apiFetch(`${API_BASE}/v2/session/message`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  private async sendMessageV3(content: string): Promise<SendMessageResponse> {
    const response = await apiFetch(`${API_BASE}/v3/session/${this.currentSessionId}/message`, {
      method: "POST",
      body: JSON.stringify({ message: content, thinkingMode: this.thinkingMode }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send V3 message: ${response.statusText}`);
    }

    const data = await response.json();

    // Map V3 response to V2 format expected by frontend
    return {
      response: data.response?.text || "",
      phase: "COACH_CHAT",
    };
  }

  async sendMessageStream(
    content: string,
    isExpert = false,
    onToken: (token: string) => void,
    onDone?: (debug?: any) => void,
    files?: File[]
  ): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error("No active session. Call startSession first.");
    }

    if (this.useV3) {
      let body: FormData | string;

      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append("message", content);
        formData.append("thinkingMode", this.thinkingMode);
        for (const file of files) {
          formData.append("files", file);
        }
        body = formData;
      } else {
        body = JSON.stringify({ message: content, thinkingMode: this.thinkingMode });
      }

      // apiFetch auto-detects FormData and skips Content-Type
      const response = await apiFetch(`${API_BASE}/v3/session/${this.currentSessionId}/stream`, {
        method: "POST",
        body,
      });

      if (!response.ok) {
        throw new Error(`Failed to stream V3 message: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: V3StreamEvent = JSON.parse(line.slice(6));
              if (event.type === "token" && event.content) {
                onToken(event.content);
              } else if (event.type === "tool_start" && event.name) {
                onToken(`\n⚡ ${event.name}...\n`);
              } else if (event.type === "done") {
                if (onDone) onDone(event);
              } else if (event.type === "error") {
                throw new Error(event.content || "Stream error");
              }
            } catch (e: any) {
              if (e.message && !e.message.includes("JSON")) throw e;
            }
          }
        }
      }
      return;
    }

    const response = await apiFetch(`${API_BASE}/session/${this.currentSessionId}/message/stream`, {
      method: "POST",
      body: JSON.stringify({ content, isExpert }),
    });

    if (!response.ok) {
      throw new Error(`Failed to stream message: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    let receivedDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              onToken(data.token);
            }
            if (data.done && onDone) {
              receivedDone = true;
              onDone(data.debug);
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", e);
          }
        }
      }
    }

    if (!receivedDone && onDone) {
      onDone();
    }
  }

  async getTechnieken(): Promise<Technique[]> {
    const response = await apiFetch(`${API_BASE}/technieken`);
    if (!response.ok) {
      throw new Error(`Failed to load techniques: ${response.statusText}`);
    }
    return response.json();
  }

  async getUserContext(userId?: string): Promise<UserContext> {
    const url = userId
      ? `${API_BASE}/user/context?userId=${userId}`
      : `${API_BASE}/user/context`;
    const response = await apiFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to get user context: ${response.statusText}`);
    }
    const data = await response.json();
    return data.context;
  }

  async saveUserContext(context: UserContext, userId?: string): Promise<UserContext> {
    const response = await apiFetch(`${API_BASE}/user/context`, {
      method: "POST",
      body: JSON.stringify({ userId, context }),
    });
    if (!response.ok) {
      throw new Error(`Failed to save user context: ${response.statusText}`);
    }
    const data = await response.json();
    return data.context;
  }

  async startRoleplay(): Promise<{ message: string; phase: string }> {
    if (!this.currentSessionId) {
      throw new Error("No active session.");
    }
    const response = await apiFetch(`${API_BASE}/session/${this.currentSessionId}/start-roleplay`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to start roleplay: ${response.statusText}`);
    }
    return response.json();
  }

  async requestFeedback(): Promise<{ feedback: string; stats: any }> {
    if (!this.currentSessionId) {
      throw new Error("No active session.");
    }
    const response = await apiFetch(`${API_BASE}/session/${this.currentSessionId}/feedback`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to get feedback: ${response.statusText}`);
    }
    return response.json();
  }

  async evaluate(): Promise<EvaluationResult> {
    if (!this.currentSessionId) {
      throw new Error("No active session.");
    }
    const response = await apiFetch(`${API_BASE}/session/${this.currentSessionId}/evaluate`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to evaluate: ${response.statusText}`);
    }
    const data = await response.json();
    return data.evaluation;
  }

  async resetContext(): Promise<{ message: string }> {
    if (!this.currentSessionId) {
      throw new Error("No active session.");
    }
    const response = await apiFetch(`${API_BASE}/session/${this.currentSessionId}/reset-context`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to reset context: ${response.statusText}`);
    }
    return response.json();
  }

  async getSessionTurns(): Promise<{ turns: any[]; total: number }> {
    if (!this.currentSessionId) {
      throw new Error("No active session.");
    }
    const response = await apiFetch(`${API_BASE}/session/${this.currentSessionId}/turns`);
    if (!response.ok) {
      throw new Error(`Failed to get turns: ${response.statusText}`);
    }
    return response.json();
  }

  async checkV3Access(): Promise<{ admin_v3: boolean; coaching_v3: boolean }> {
    try {
      const response = await apiFetch(`${API_BASE}/v3/access`);
      if (!response.ok) return { admin_v3: false, coaching_v3: false };
      return response.json();
    } catch {
      return { admin_v3: false, coaching_v3: false };
    }
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  clearSession(): void {
    this.currentSessionId = null;
  }

  // =====================
  // PERFORMANCE TRACKER API
  // =====================

  /**
   * Get current competence level and assistance config
   */
  async getUserLevel(userId: string = "demo-user"): Promise<UserLevelResponse> {
    const response = await apiFetch(`${API_BASE}/v2/user/level?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error(`Failed to get user level: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Record performance after a roleplay and check for level transitions
   */
  async recordPerformance(data: RecordPerformanceRequest): Promise<RecordPerformanceResponse> {
    const response = await apiFetch(`${API_BASE}/v2/user/performance`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to record performance: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get technique mastery summary for user
   */
  async getUserMastery(userId: string = "demo-user"): Promise<UserMasteryResponse> {
    const response = await apiFetch(`${API_BASE}/v2/user/mastery?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error(`Failed to get user mastery: ${response.statusText}`);
    }
    return response.json();
  }
}

// Performance Tracker Types
export interface AssistanceConfig {
  showHouding: boolean;
  showExpectedTechnique: boolean;
  showStepIndicators: boolean;
  showTipButton: boolean;
  showExamples: boolean;
  blindPlay: boolean;
}

export interface UserLevelResponse {
  userId: string;
  level: number;
  levelName: string;
  assistance: AssistanceConfig;
}

export interface RecordPerformanceRequest {
  userId?: string;
  techniqueId: string;
  techniqueName?: string;
  score: number;
  struggleSignals?: string[];
}

export interface LevelTransition {
  previousLevel: number;
  newLevel: number;
  reason: string;
  shouldCongratulate: boolean;
  congratulationMessage?: string | null;
}

export interface RecordPerformanceResponse {
  recorded: boolean;
  currentLevel: number;
  levelName: string;
  assistance: AssistanceConfig;
  transition: LevelTransition | null;
}

export interface TechniqueMasterySummary {
  techniqueId: string;
  techniqueName: string;
  attemptCount: number;
  successRate: number;
  averageScore: number;
  masteryLevel: "beginner" | "intermediate" | "advanced" | "master";
  lastPracticed: string | null;
}

export interface UserMasteryResponse {
  userId: string;
  currentLevel: number;
  levelName: string;
  techniques: TechniqueMasterySummary[];
}

export const hugoApi = new HugoApiService();
