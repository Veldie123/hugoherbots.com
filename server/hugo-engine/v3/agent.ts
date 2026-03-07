/**
 * Hugo V3 Agent — Claude-powered intelligent agent
 *
 * Supports two modes:
 * - "coaching": Sales coaching agent (replaces V2 multi-engine system)
 * - "admin": Platform management agent (Hugo's personal assistant)
 *
 * The agentic loop is shared — only tools and system prompt differ per mode.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicClient,
  COACHING_MODEL,
} from "./anthropic-client";
import { buildV3SystemPrompt } from "./system-prompt";
import { buildAdminSystemPrompt } from "./system-prompt-admin";
import { type UserBriefing } from "./user-briefing";
import {
  knowledgeToolDefinitions,
  executeKnowledgeTool,
} from "./tools/knowledge";
import {
  methodologyToolDefinitions,
  executeMethodologyTool,
  METHODOLOGY_TOOLS,
} from "./tools/methodology";
import {
  roleplayToolDefinitions,
  executeRoleplayTool,
  ROLEPLAY_TOOLS,
  type RoleplayState,
} from "./tools/roleplay";
import {
  adminToolDefinitions,
  executeAdminTool,
  ADMIN_TOOLS,
} from "./tools/admin";
import { buildCompactedMessages } from "./compaction";

// ── Types ───────────────────────────────────────────────────────────────────

export type V3Mode = "coaching" | "admin";

export type V3ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export interface V3Message {
  role: "user" | "assistant";
  content: string | V3ContentBlock[];
}

export interface V3SessionState {
  sessionId: string;
  userId: string;
  mode: V3Mode;
  messages: V3Message[];
  userProfile?: {
    name?: string;
    sector?: string;
    product?: string;
    klantType?: string;
    ervaring?: string;
    bedrijfsnaam?: string;
  };
  briefing?: UserBriefing;
  engineVersion: "v3";
  roleplay?: RoleplayState;
  messageSummary?: string;
}

export interface V3Response {
  text: string;
  toolsUsed: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
}

export interface V3StreamEvent {
  type: "thinking" | "tool_start" | "tool_result" | "token" | "done" | "error";
  content?: string;
  name?: string;        // tool name
  usage?: { inputTokens: number; outputTokens: number };
  toolsUsed?: string[];
}

// ── Tool Definitions (mode-specific) ────────────────────────────────────────

function getAllToolDefinitions(mode: V3Mode): Anthropic.Tool[] {
  if (mode === "admin") {
    return adminToolDefinitions;
  }
  return [
    ...knowledgeToolDefinitions,
    ...methodologyToolDefinitions,
    ...roleplayToolDefinitions,
  ];
}

// ── Tool Router ─────────────────────────────────────────────────────────────

const KNOWLEDGE_TOOLS = new Set([
  "search_methodology",
  "search_training_materials",
  "get_user_profile",
  "suggest_video",
  "recall_memories",
  "save_insight",
]);

async function executeTool(
  name: string,
  input: Record<string, any>,
  session: V3SessionState
): Promise<string> {
  // Admin mode: route to admin tools
  if (session.mode === "admin" && ADMIN_TOOLS.has(name)) {
    return executeAdminTool(name, input);
  }
  // Coaching mode: route to coaching tools
  if (KNOWLEDGE_TOOLS.has(name)) {
    return executeKnowledgeTool(name, input);
  }
  if (METHODOLOGY_TOOLS.has(name)) {
    return executeMethodologyTool(name, input);
  }
  if (ROLEPLAY_TOOLS.has(name)) {
    return executeRoleplayTool(name, input, session);
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

// ── System Prompt (mode-specific) ───────────────────────────────────────────

function getSystemPrompt(session: V3SessionState): string {
  if (session.mode === "admin") {
    return buildAdminSystemPrompt();
  }
  return buildV3SystemPrompt(session.userProfile, session.briefing);
}

// ── Agent Core ──────────────────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

/**
 * Send a message to the Hugo V3 agent and get a response.
 *
 * The agent will use tools as needed. Tool calls happen
 * transparently — the caller just gets the final text response.
 *
 * In admin mode, extended thinking is enabled for deeper reasoning.
 */
export async function chat(
  session: V3SessionState,
  userMessage: string | V3ContentBlock[]
): Promise<V3Response> {
  const client = getAnthropicClient();
  const tools = getAllToolDefinitions(session.mode);
  const systemPrompt = getSystemPrompt(session);
  const model = COACHING_MODEL;

  // Normalize user content for API and storage
  const userContent = typeof userMessage === "string" ? userMessage : userMessage;

  // Build message history with context compaction
  const allMessages = [...session.messages, { role: "user" as const, content: userContent }];
  const { messages: apiMessages, newSummary } = await buildCompactedMessages(
    allMessages,
    session.messageSummary
  );
  if (newSummary) session.messageSummary = newSummary;

  const toolsUsed: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalThinkingTokens = 0;

  const thinkingBudget = session.mode === "admin" ? 10000 : 5000;

  // Agentic loop: keep going until Claude produces a final text response
  let currentMessages = [...apiMessages];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const requestParams: Anthropic.MessageCreateParams = {
      model,
      max_tokens: session.mode === "admin" ? 16384 : 8192,
      system: systemPrompt,
      tools,
      messages: currentMessages,
      thinking: {
        type: "enabled",
        budget_tokens: thinkingBudget,
      },
    };

    const response = await client.messages.create(requestParams);

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
    totalThinkingTokens += (response.usage as any).thinking_tokens || 0;

    // Check if the response contains tool use
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      // No tool calls — extract text and return
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      const text = textBlocks.map((b) => b.text).join("");

      // Store messages in session
      session.messages.push({ role: "user", content: userContent });
      session.messages.push({ role: "assistant", content: text });

      return {
        text,
        toolsUsed,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        thinkingTokens: totalThinkingTokens,
      };
    }

    // Execute tool calls and continue
    // First, add the assistant message with tool use blocks
    currentMessages.push({ role: "assistant", content: response.content });

    // Then add tool results (each tool wrapped in try/catch so one failure doesn't crash the loop)
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      toolsUsed.push(toolUse.name);

      let result: string;
      try {
        result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, any>,
          session
        );
      } catch (err: any) {
        console.error(`[V3 Agent] Tool ${toolUse.name} threw:`, err.message);
        result = JSON.stringify({ error: `Tool ${toolUse.name} failed: ${err.message}` });
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    currentMessages.push({ role: "user", content: toolResults });
  }

  // Fallback if we hit max rounds
  return {
    text: session.mode === "admin"
      ? "Ik heb even te veel opgezocht. Kun je je vraag herhalen?"
      : "Ik heb even te veel informatie opgezocht. Kun je je vraag herhalen?",
    toolsUsed,
    model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    thinkingTokens: totalThinkingTokens,
  };
}

/**
 * Stream a message to the Hugo V3 agent, yielding events as they happen.
 *
 * Uses client.messages.stream() for streaming responses. Tool calls are
 * executed between rounds, and the final text is yielded as token events.
 */
export async function* chatStream(
  session: V3SessionState,
  userMessage: string | V3ContentBlock[]
): AsyncGenerator<V3StreamEvent> {
  const client = getAnthropicClient();
  const tools = getAllToolDefinitions(session.mode);
  const systemPrompt = getSystemPrompt(session);
  const model = COACHING_MODEL;

  // Normalize user content for API and storage
  const userContent = typeof userMessage === "string" ? userMessage : userMessage;

  // Build message history with context compaction
  const allMessages = [...session.messages, { role: "user" as const, content: userContent }];
  const { messages: apiMessages, newSummary } = await buildCompactedMessages(
    allMessages,
    session.messageSummary
  );
  if (newSummary) session.messageSummary = newSummary;

  const toolsUsed: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const thinkingBudget = session.mode === "admin" ? 10000 : 5000;

  let currentMessages = [...apiMessages];
  let allRoundText = ""; // Accumulate text across all rounds for session storage

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    yield { type: "thinking" };

    const stream = client.messages.stream({
      model,
      max_tokens: session.mode === "admin" ? 16384 : 8192,
      system: systemPrompt,
      tools,
      messages: currentMessages,
      thinking: {
        type: "enabled",
        budget_tokens: thinkingBudget,
      },
    });

    // Queue text tokens for real-time streaming
    const tokenQueue: string[] = [];
    stream.on("text", (text) => {
      tokenQueue.push(text);
    });

    const finalMessage = await stream.finalMessage();
    totalInputTokens += finalMessage.usage.input_tokens;
    totalOutputTokens += finalMessage.usage.output_tokens;

    // Always yield queued text tokens — even when tools are also present
    for (const token of tokenQueue) {
      yield { type: "token", content: token };
    }

    // Extract text for session storage
    const textBlocks = finalMessage.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const roundText = textBlocks.map((b) => b.text).join("");
    allRoundText += roundText;

    // Check for tool calls
    const toolUseBlocks = finalMessage.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // Final response — save and done
      session.messages.push({ role: "user", content: userContent });
      session.messages.push({ role: "assistant", content: allRoundText });

      yield {
        type: "done",
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        toolsUsed,
      };
      return;
    }

    // Tool execution round — push assistant response + tool results to context
    currentMessages.push({ role: "assistant", content: finalMessage.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      toolsUsed.push(toolUse.name);
      yield { type: "tool_start", name: toolUse.name };

      let result: string;
      try {
        result = await executeTool(toolUse.name, toolUse.input as Record<string, any>, session);
      } catch (err: any) {
        console.error(`[V3 Agent] Tool ${toolUse.name} threw:`, err.message);
        result = JSON.stringify({ error: `Tool ${toolUse.name} failed: ${err.message}` });
      }

      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
      yield { type: "tool_result", name: toolUse.name };
    }

    currentMessages.push({ role: "user", content: toolResults });
  }

  // Max rounds fallback — also save to session
  const fallback = session.mode === "admin"
    ? "Ik heb even te veel opgezocht. Kun je je vraag herhalen?"
    : "Ik heb even te veel informatie opgezocht. Kun je je vraag herhalen?";
  session.messages.push({ role: "user", content: userContent });
  session.messages.push({ role: "assistant", content: allRoundText || fallback });
  yield { type: "token", content: fallback };
  yield { type: "done", usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, toolsUsed };
}

/**
 * Create a new V3 session.
 */
export function createSession(
  sessionId: string,
  userId: string,
  mode: V3Mode = "coaching",
  userProfile?: V3SessionState["userProfile"],
  briefing?: UserBriefing
): V3SessionState {
  return {
    sessionId,
    userId,
    mode,
    messages: [],
    userProfile,
    briefing,
    engineVersion: "v3",
  };
}
