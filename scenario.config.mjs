/**
 * LangWatch Scenario config — provides the default model for
 * userSimulatorAgent and judgeAgent (both run via Vercel AI SDK).
 */
import { anthropic } from "@ai-sdk/anthropic";

export default {
  defaultModel: {
    model: anthropic("claude-haiku-4-5-20251001"),
    temperature: 0,
    maxTokens: 1024,
  },
};
