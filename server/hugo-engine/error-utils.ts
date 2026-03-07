/**
 * Shared error utilities for analysis services.
 * Converts raw API errors into user-friendly Dutch messages.
 */

export function sanitizeAnalysisError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status;

  // Rate limit (both Anthropic and OpenAI)
  if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("quota")) {
    return "API-limiet bereikt. Probeer het over enkele minuten opnieuw.";
  }
  // Auth errors
  if (status === 401 || status === 403) {
    return "Authenticatiefout bij AI-service. Neem contact op met support.";
  }
  // Server errors
  if (status >= 500) {
    return "AI-service tijdelijk niet beschikbaar. Probeer het later opnieuw.";
  }
  // File system
  if (msg.includes("ENOENT") || msg.includes("file not found")) {
    return "Audiobestand niet gevonden. Upload het gesprek opnieuw.";
  }
  // Already user-friendly — pass through
  if (msg.length < 120 && !msg.startsWith("{") && !msg.includes('{"type":')) {
    return msg;
  }
  return "Onbekende fout bij de analyse. Probeer het opnieuw.";
}
