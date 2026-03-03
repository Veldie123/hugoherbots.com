/**
 * Hugo V3 Agent — Claude-powered sales coaching agent
 *
 * Single intelligent agent that replaces the V2 multi-engine system.
 * Uses tools for knowledge lookup and methodology enforcement.
 * No rigid modes — the agent naturally shifts between coaching,
 * roleplay, feedback, and context gathering.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicClient,
  COACHING_MODEL,
} from "./anthropic-client";
import { buildV3SystemPrompt } from "./system-prompt";
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

// ── Types ───────────────────────────────────────────────────────────────────

export interface V3Message {
  role: "user" | "assistant";
  content: string;
}

export interface V3SessionState {
  sessionId: string;
  userId: string;
  messages: V3Message[];
  userProfile?: {
    name?: string;
    sector?: string;
    product?: string;
    klantType?: string;
    ervaring?: string;
    bedrijfsnaam?: string;
  };
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

// ── All available tools ─────────────────────────────────────────────────────

function getAllToolDefinitions(): Anthropic.Tool[] {
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

// ── Agent Core ──────────────────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

/**
 * Send a message to the Hugo V3 agent and get a response.
 *
 * The agent will use tools as needed to look up methodology,
 * training materials, user profiles, etc. Tool calls happen
 * transparently — the caller just gets the final text response.
 */
export async function chat(
  session: V3SessionState,
  userMessage: string
): Promise<V3Response> {
  const client = getAnthropicClient();
  const tools = getAllToolDefinitions();
  const systemPrompt = buildV3SystemPrompt(session.userProfile);

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
    const response = await client.messages.create({
      model: COACHING_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

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
        model: COACHING_MODEL,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }

    // Execute tool calls and continue
    // First, add the assistant message with tool use blocks
    currentMessages.push({ role: "assistant", content: response.content });

    // Then add tool results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      console.log(`[V3 Agent] Tool call: ${toolUse.name}`, toolUse.input);
      toolsUsed.push(toolUse.name);

      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, any>,
        session
      );
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
    text: "Ik heb even te veel informatie opgezocht. Kun je je vraag herhalen?",
    toolsUsed,
    model: COACHING_MODEL,
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
  userProfile?: V3SessionState["userProfile"]
): V3SessionState {
  return {
    sessionId,
    userId,
    messages: [],
    userProfile,
    engineVersion: "v3",
  };
}
