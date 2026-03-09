import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/scenarios/**/*.test.ts"],
    testTimeout: 120_000, // 2 minutes per scenario (LLM calls are slow)
    hookTimeout: 30_000,
    // Run scenarios sequentially to avoid API rate limits
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
