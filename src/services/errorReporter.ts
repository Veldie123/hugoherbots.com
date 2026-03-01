interface ErrorReport {
  message: string;
  stack?: string;
  source?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  componentStack?: string;
}

const ERROR_ENDPOINT = '/api/v2/errors';
const MAX_ERRORS_PER_MINUTE = 10;
let errorCount = 0;
let lastResetTime = Date.now();

function shouldThrottle(): boolean {
  const now = Date.now();
  if (now - lastResetTime > 60000) {
    errorCount = 0;
    lastResetTime = now;
  }
  errorCount++;
  return errorCount > MAX_ERRORS_PER_MINUTE;
}

export function reportError(error: Error | string, source?: string, componentStack?: string): void {
  if (shouldThrottle()) return;

  const report: ErrorReport = {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'string' ? undefined : error.stack,
    source: source || 'unknown',
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    componentStack,
  };

  console.error(`[ErrorReporter] ${report.source}: ${report.message}`);

  try {
    fetch(ERROR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }).catch(() => {});
  } catch {
  }
}

export function setupGlobalErrorHandlers(): void {
  window.onerror = (message, source, lineno, colno, error) => {
    reportError(
      error || String(message),
      `window.onerror [${source}:${lineno}:${colno}]`
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : String(event.reason);
    reportError(error, 'unhandledrejection');
  });
}
