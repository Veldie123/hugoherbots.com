/**
 * V3 Context Compaction
 *
 * When conversation history exceeds token limits, summarize earlier messages
 * into a compact summary. Keep recent messages intact for conversational coherence.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, COACHING_MODEL } from "./anthropic-client";
import type { V3Message } from "./agent";

const COMPACTION_TOKEN_THRESHOLD = 80_000;
const KEEP_RECENT_MESSAGES = 10;
const CHARS_PER_TOKEN = 4;

/** Estimate token count for a message */
export function estimateTokens(content: string | any[]): number {
  if (typeof content === "string") {
    return Math.ceil(content.length / CHARS_PER_TOKEN);
  }
  // For content blocks, estimate from stringified representation
  let total = 0;
  for (const block of content) {
    if (block.type === "text") {
      total += Math.ceil((block.text?.length || 0) / CHARS_PER_TOKEN);
    } else if (block.type === "image") {
      total += 1600; // ~1600 tokens per image (Anthropic approximation)
    } else if (block.type === "document") {
      total += Math.ceil((block.source?.data?.length || 0) / 6);
    } else {
      total += Math.ceil(JSON.stringify(block).length / CHARS_PER_TOKEN);
    }
  }
  return total;
}

/** Estimate total tokens for all messages */
export function estimateTotalTokens(messages: V3Message[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

/** Check if compaction is needed */
export function needsCompaction(messages: V3Message[]): boolean {
  return estimateTotalTokens(messages) > COMPACTION_TOKEN_THRESHOLD;
}

/** Compact old messages into a summary using a fast Claude call */
async function compactMessages(
  messagesToSummarize: V3Message[],
  existingSummary?: string
): Promise<string> {
  const client = getAnthropicClient();

  const transcript = messagesToSummarize
    .map((m) => {
      const role = m.role === "user" ? "Seller" : "Hugo";
      const content =
        typeof m.content === "string" ? m.content : "[multimodal content]";
      return `${role}: ${content}`;
    })
    .join("\n\n");

  const prompt = existingSummary
    ? `Hier is een eerdere samenvatting van het gesprek:\n\n${existingSummary}\n\nHier zijn nieuwe berichten die ook samengevat moeten worden:\n\n${transcript}\n\nMaak een bijgewerkte, beknopte samenvatting van het hele gesprek tot nu toe. Focus op: (1) belangrijke coaching-inzichten, (2) seller context en problemen, (3) welke technieken besproken/geoefend zijn, (4) afspraken of volgende stappen. Max 500 woorden.`
    : `Vat het volgende coaching-gesprek beknopt samen. Focus op: (1) belangrijke coaching-inzichten, (2) seller context en problemen, (3) welke technieken besproken/geoefend zijn, (4) afspraken of volgende stappen. Max 500 woorden.\n\n${transcript}`;

  const response = await client.messages.create({
    model: COACHING_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return textBlocks.map((b) => b.text).join("");
}

/**
 * Build a compacted message array for the API call.
 *
 * If compaction is needed:
 * 1. Summarize old messages (everything except the last KEEP_RECENT_MESSAGES)
 * 2. Return: [summary_as_context, ...recent_messages]
 *
 * If not needed, return messages as-is.
 */
export async function buildCompactedMessages(
  messages: V3Message[],
  existingSummary?: string
): Promise<{ messages: Anthropic.MessageParam[]; newSummary?: string }> {
  if (!needsCompaction(messages)) {
    return {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content as any,
      })),
    };
  }

  console.log(
    `[V3 Compaction] Triggered: ${messages.length} messages, ~${estimateTotalTokens(messages)} tokens`
  );

  const splitIndex = Math.max(0, messages.length - KEEP_RECENT_MESSAGES);
  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);

  const newSummary = await compactMessages(oldMessages, existingSummary);

  const compactedMessages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `[CONTEXT — Samenvatting van eerder gesprek]\n\n${newSummary}\n\n[Verder met het huidige gesprek:]`,
    },
    {
      role: "assistant",
      content:
        "Begrepen, ik heb de context van ons eerdere gesprek. Ga verder.",
    },
    ...recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as any,
    })),
  ];

  console.log(
    `[V3 Compaction] Done: ${oldMessages.length} messages summarized, ${recentMessages.length} kept`
  );

  return { messages: compactedMessages, newSummary };
}
