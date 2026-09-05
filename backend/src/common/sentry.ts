import * as Sentry from '@sentry/node';
import {
  scrubEvent,
  scrubBreadcrumb,
  IGNORE_ERRORS,
} from './sentry-scrub';

/**
 * Initialise Sentry only when a DSN is provided (set SENTRY_DSN in the Render
 * env). With no DSN, Sentry.captureException() is a safe no-op, so the rest of
 * the app can call it unconditionally. Returns whether tracking is active.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Error tracking only for now — no perf tracing overhead.
    tracesSampleRate: 0,
    // Never let the SDK attach IPs, cookies, headers or bodies on its own.
    sendDefaultPii: false,
    ignoreErrors: IGNORE_ERRORS,
    // Privacy Policy §6: reports carry no credentials, phone numbers, emails
    // or money/harvest values, and identify an account only by a hash.
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
  return true;
}

export { Sentry };
