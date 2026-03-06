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

// ── Types ───────────────────────────────────────────────────────────────────

export type V3Mode = "coaching" | "admin";

export interface V3Message {
  role: "user" | "assistant";
  content: string;
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
}

export interface V3Response {
  text: string;
  toolsUsed: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
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
  userMessage: string
): Promise<V3Response> {
  const client = getAnthropicClient();
  const tools = getAllToolDefinitions(session.mode);
  const systemPrompt = getSystemPrompt(session);
  const model = COACHING_MODEL;

  // Build message history for Claude
  const messages: Anthropic.MessageParam[] = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Add the new user message
  messages.push({ role: "user", content: userMessage });

  const toolsUsed: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Agentic loop: keep going until Claude produces a final text response
  let currentMessages = [...messages];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const requestParams: Anthropic.MessageCreateParams = {
      model,
      max_tokens: session.mode === "admin" ? 4096 : 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    };

    const response = await client.messages.create(requestParams);

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

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
      session.messages.push({ role: "user", content: userMessage });
      session.messages.push({ role: "assistant", content: text });

      return {
        text,
        toolsUsed,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
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
  };
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
