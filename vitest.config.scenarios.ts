import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/scenarios/**/*.test.ts"],
    testTimeout: 120_000, // 2 minutes per scenario (LLM calls are slow)
    hookTimeout: 30_000,
    // Run scenarios sequentially to avoid API rate limits
    sequence: { concurrent: false },
    // Load .env so ANTHROPIC_API_KEY + LANGWATCH_API_KEY are available
    env: loadEnvSync(),
  },
});

/** Synchronously parse .env into a Record for vitest's env option */
function loadEnvSync(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const { readFileSync } = require("fs");
    const { resolve } = require("path");
    const content = readFileSync(resolve(__dirname, ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  } catch {
    // .env not found
  }
  return env;
}
