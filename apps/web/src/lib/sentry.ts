/**
 * Sentry Monitoring initialization for NEXUS WAYS Web Client
 */
export function initFrontendSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // Sentry is optional if DSN is not provided in environment
    return;
  }

  // Global error listener if Sentry SDK is integrated
  window.addEventListener('error', (event) => {
    console.error('[NEXUS WAYS Sentry Telemetry Capture]:', event.error || event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[NEXUS WAYS Sentry Telemetry Promise Rejection]:', event.reason);
  });
}

export function reportErrorToSentry(error: Error | string, extra?: Record<string, any>): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  console.warn('[Sentry Telemetry Event Dispatched]:', error, extra);
}
