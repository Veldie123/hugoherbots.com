/** Base delay between consecutive API calls (ms) */
export const BASE_DELAY_MS = 500;

/** Simple delay helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async function with exponential backoff retry logic.
 * - Retries up to maxRetries times on 429 (rate limit) errors
 * - Delays: 1s, 2s, 4s (2^attempt * 1000ms)
 * - Throws immediately on non-429 errors
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      const isRateLimit =
        err !== null &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 429;

      if (!isRateLimit) {
        throw err;
      }

      if (attempt >= maxRetries) {
        break;
      }

      const delayMs = Math.pow(2, attempt) * 1000;
      process.stderr.write(`[rate-limiter] 429 received, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})\n`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
