/**
 * Standalone Claude API client for SSOT audit scripts.
 * Does NOT import from server/ — self-contained for use in scripts/.
 */
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("[ssot-audit] ANTHROPIC_API_KEY not configured. Set it in .env.");
  }

  client = new Anthropic({ apiKey, maxRetries: 0 }); // We handle retries ourselves
  return client;
}

export const AUDIT_MODEL = "claude-sonnet-4-20250514";

/**
 * Calls Claude with a system prompt and user prompt, returns the text response.
 */
export async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: AUDIT_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  if (response.stop_reason === "max_tokens") {
    process.stderr.write(`[ssot-audit] Warning: Claude response truncated (hit max_tokens). Output may be incomplete.\n`);
  }

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new Error("[ssot-audit] Unexpected response from Claude: no text block in response");
  }

  // Strip markdown code fences if Claude wraps output
  const cleaned = firstBlock.text
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  return cleaned;
}
