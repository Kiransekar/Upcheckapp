/**
 * Single choke-point for reporting a caught/fatal error.
 *
 * This used to be console-only, with a `ponytail:` note saying to wire a crash
 * reporter here "when a DSN exists". A DSN exists now, and the note was load
 * bearing: Sentry's global handler only ever sees errors NOBODY caught, so
 * everything the app catches on purpose — every render crash stopped by
 * ErrorBoundary, which is the whole reason that component exists — was being
 * logged to a console no farmer will ever read and dropped on the floor. The
 * first build with Sentry in it reported zero issues, and this was why.
 *
 * `captureError` is a no-op when crash reporting is unconfigured or the farmer
 * switched it off, so the console line stays unconditional: on a device with
 * reporting disabled it is the only record there is, and in development it is
 * the faster one.
 */
import { captureError } from './sentry';

export function reportError(error: unknown, context?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.error('[reportError]', error, context ?? '');
    captureError(error, context);
}
