/**
 * Hugo Engine API Service
 * Connects frontend to the V2 backend
 */

const API_BASE = "/api";

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

class HugoApiService {
  private currentSessionId: string | null = null;

  async startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    const response = await fetch(`${API_BASE}/v2/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to start session: ${response.statusText}`);
    }

    const data = await response.json();
    this.currentSessionId = data.sessionId;
    return data;
  }

  async startSessionStream(
    request: StartSessionRequest,
    onToken: (token: string) => void,
    onDone?: (meta?: { onboardingStatus?: any }) => void
  ): Promise<string> {
    const response = await fetch(`${API_BASE}/v2/sessions/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const pendingTokens: string[] = [];
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
              pendingTokens.push(data.content);
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

    if (pendingTokens.length > 0) {
      const TOKEN_DELAY = 15;
      for (let i = 0; i < pendingTokens.length; i++) {
        onToken(pendingTokens[i]);
        if (i % 3 === 0 && i > 0) {
          await new Promise(r => setTimeout(r, TOKEN_DELAY));
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

    const body: Record<string, unknown> = {
      sessionId: this.currentSessionId,
      message: content,
      debug: true,
      expertMode: isExpert,
    };
    if (systemContext) {
      body.systemContext = systemContext;
    }

    const response = await fetch(`${API_BASE}/v2/session/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  async sendMessageStream(
    content: string, 
    isExpert = false,
    onToken: (token: string) => void,
    onDone?: (debug?: any) => void
  ): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error("No active session. Call startSession first.");
    }

    const response = await fetch(`${API_BASE}/session/${this.currentSessionId}/message/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE}/technieken`);
    if (!response.ok) {
      throw new Error(`Failed to load techniques: ${response.statusText}`);
    }
    return response.json();
  }

  async getUserContext(userId?: string): Promise<UserContext> {
    const url = userId 
      ? `${API_BASE}/user/context?userId=${userId}`
      : `${API_BASE}/user/context`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to get user context: ${response.statusText}`);
    }
    const data = await response.json();
    return data.context;
  }

  async saveUserContext(context: UserContext, userId?: string): Promise<UserContext> {
    const response = await fetch(`${API_BASE}/user/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE}/session/${this.currentSessionId}/start-roleplay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE}/session/${this.currentSessionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE}/session/${this.currentSessionId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE}/session/${this.currentSessionId}/reset-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE}/session/${this.currentSessionId}/turns`);
    if (!response.ok) {
      throw new Error(`Failed to get turns: ${response.statusText}`);
    }
    return response.json();
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
    const response = await fetch(`${API_BASE}/v2/user/level?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error(`Failed to get user level: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Record performance after a roleplay and check for level transitions
   */
  async recordPerformance(data: RecordPerformanceRequest): Promise<RecordPerformanceResponse> {
    const response = await fetch(`${API_BASE}/v2/user/performance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE}/v2/user/mastery?userId=${encodeURIComponent(userId)}`);
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
