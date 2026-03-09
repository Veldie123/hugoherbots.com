/**
 * LangWatch Observability — OpenTelemetry auto-instrumentation for V3 agent.
 *
 * Captures all Anthropic Claude API calls (tokens, latency, cache hits)
 * and sends traces to LangWatch SaaS dashboard.
 *
 * MUST be called before any Anthropic SDK usage (i.e., at server startup).
 */
import { attributes } from "langwatch";

// Re-export for use in routes.ts metadata enrichment
export { attributes };

let observabilityHandle: { shutdown: () => Promise<void> } | null = null;

export async function initObservability(): Promise<void> {
  const apiKey = process.env.LANGWATCH_API_KEY;
  if (!apiKey) {
    console.warn("[LangWatch] LANGWATCH_API_KEY not set — tracing disabled.");
    return;
  }

  try {
    // Dynamic import to avoid issues when LANGWATCH_API_KEY is not set
    const { setupObservability } = await import("langwatch/observability/node");

    observabilityHandle = setupObservability({
      serviceName: "hugoclaw-v3",
      langwatch: {
        apiKey,
      },
      attributes: {
        "deployment.environment": process.env.NODE_ENV || "development",
        "service.version": "3.0",
      },
    });

    console.log("[LangWatch] Observability initialized — tracing active.");
  } catch (err: any) {
    console.error("[LangWatch] Failed to initialize:", err.message);
  }
}

export async function shutdownObservability(): Promise<void> {
  if (observabilityHandle) {
    await observabilityHandle.shutdown();
    console.log("[LangWatch] Observability shut down.");
  }
}
