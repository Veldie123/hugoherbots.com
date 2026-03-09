/**
 * Anthropic Claude client for Hugo V3 Agent
 */
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[V3] ANTHROPIC_API_KEY not configured. Set it in .env to enable the Hugo V3 agent."
    );
  }

  client = new Anthropic({ apiKey, maxRetries: 5 });
  return client;
}

export function isV3Available(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Default model for coaching conversations */
export const COACHING_MODEL = "claude-sonnet-4-20250514";

/** Model for complex evaluations requiring deeper reasoning */
export const EVALUATION_MODEL = "claude-opus-4-20250514";

/** Lightweight model for hero text generation (cost-efficient) */
export const HERO_MODEL = "claude-haiku-4-5-20251001";
