/**
 * Agent adapter for LangWatch Scenario tests.
 *
 * Wraps the HugoClawV3 API (HTTP) so the Scenario framework can interact
 * with the full agent stack including tools, system prompts, and context compaction.
 *
 * Requires:
 * - V3 server running on BASE_URL (default: http://localhost:5001)
 * - Valid auth token (SCENARIO_AUTH_TOKEN env var)
 */
import { type AgentAdapter, AgentRole } from "@langwatch/scenario";

const BASE_URL = process.env.SCENARIO_BASE_URL || "http://localhost:5001";
const AUTH_TOKEN = process.env.SCENARIO_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  throw new Error("SCENARIO_AUTH_TOKEN env var required for scenario tests");
}

/** Create a new V3 coaching session and return the sessionId + opening text */
async function createSession(): Promise<{ sessionId: string; openingText: string }> {
  const res = await fetch(`${BASE_URL}/api/v3/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      mode: "coaching",
      thinkingMode: "fast", // fast for speed in tests
    }),
  });

  if (!res.ok) {
    throw new Error(`Session creation failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    sessionId: data.sessionId,
    openingText: data.opening.text,
  };
}

/** Send a message to V3 via SSE streaming endpoint, collect full response */
async function sendMessage(sessionId: string, message: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v3/session/${sessionId}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      message,
      thinkingMode: "fast",
    }),
  });

  if (!res.ok) {
    throw new Error(`Stream failed: ${res.status} ${await res.text()}`);
  }

  // Parse SSE stream to collect all text tokens
  const text = await res.text();
  const lines = text.split("\n");
  let fullResponse = "";

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === "token" && event.content) {
        fullResponse += event.content;
      }
      if (event.type === "error") {
        throw new Error(`Agent error: ${event.content}`);
      }
    } catch (e) {
      // Skip malformed SSE lines
    }
  }

  return fullResponse;
}

/** Create a HugoClawV3 agent adapter for Scenario tests */
export function createHugoAgent(): AgentAdapter & { sessionId?: string } {
  let sessionId: string | undefined;

  return {
    role: AgentRole.AGENT,

    async call(input) {
      // First call: create session, ignore Scenario's first message (use Hugo's opening)
      if (!sessionId) {
        const session = await createSession();
        sessionId = session.sessionId;

        // If there are already messages from the user simulator, send the latest
        const userMessages = input.messages.filter((m) => m.role === "user");
        if (userMessages.length > 0) {
          const lastUserMsg = userMessages[userMessages.length - 1];
          const msgText = typeof lastUserMsg.content === "string"
            ? lastUserMsg.content
            : lastUserMsg.content.map((c: any) => c.text || "").join("");
          return await sendMessage(sessionId, msgText);
        }

        return session.openingText;
      }

      // Subsequent calls: send the latest user message
      const userMessages = input.messages.filter((m) => m.role === "user");
      const lastUserMsg = userMessages[userMessages.length - 1];
      if (!lastUserMsg) return "Ik luister.";

      const msgText = typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : lastUserMsg.content.map((c: any) => c.text || "").join("");

      return await sendMessage(sessionId, msgText);
    },
  };
}
