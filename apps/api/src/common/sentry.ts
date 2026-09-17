import { Logger } from '@nestjs/common';

const logger = new Logger('SentryService');

let sentryInitialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.log('Sentry DSN not provided. Sentry telemetry disabled in this environment.');
    return;
  }

  try {
    // Dynamic import to support environments without optional sentry bundle
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 1.0,
    });
    sentryInitialized = true;
    logger.log('Sentry monitoring initialized successfully for NEXUS WAYS API.');
  } catch (err: any) {
    logger.warn(`Could not initialize @sentry/node: ${err.message}`);
  }
}

export function captureException(error: any, context?: Record<string, any>): string | null {
  if (!sentryInitialized) {
    return null;
  }
  try {
    const Sentry = require('@sentry/node');
    return Sentry.captureException(error, { extra: context });
  } catch {
    return null;
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): string | null {
  if (!sentryInitialized) {
    return null;
  }
  try {
    const Sentry = require('@sentry/node');
    return Sentry.captureMessage(message, level);
  } catch {
    return null;
  }
}
