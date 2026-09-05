/**
 * Crash reporting — on by default, and aggressively stripped.
 *
 * The Privacy Policy (src/legal/content.ts, section 6) is published copy, and
 * it promises that crash reports "carry no passwords or session tokens, no
 * phone numbers, no email addresses, and no financial values, harvest figures
 * or farm records" and that an account, where identified at all, is identified
 * "by an irreversible identifier, never your phone number". This file is what
 * makes those sentences true; `scrubEvent` below is the whole of it, and it is
 * exported so it can be tested without a network or a DSN.
 *
 * Shape copied from the backend's `initSentry()`: with no DSN configured this
 * is a total no-op and the app boots and runs normally. No DSN is hardcoded
 * here — it comes from `expo-constants` extra (EXPO_PUBLIC_SENTRY_DSN).
 *
 * Crash and error only: no performance tracing, no session replay, no
 * profiling. Those are the features that ship URLs, timings and screen
 * contents, and none of them are needed to fix a crash.
 */
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

const REDACTED = '[redacted]';

/**
 * Deep enough for the places this data actually hides (a breadcrumb's
 * `data.response.record.salary` is four levels in), shallow enough that a
 * pathological object cannot hang the reporter.
 */
const MAX_DEPTH = 10;

/** Whole-key matches. Deliberately exact: `name` as a fragment would eat
 *  `fileName`, `screenName` and `componentName` and destroy the stack trace. */
const EXACT_KEYS = new Set([
    'authorization',
    'proxy-authorization',
    'cookie',
    'cookies',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'apikey',
    'api_key',
    'api-key',
    'username',
    'user_name',
    'ip',
    'ip_address',
    'aadhaar',
    'upi',
]);

/** Substring matches on the lowercased key — secrets, identity, and the
 *  money/farm figures section 6 names. */
const KEY_FRAGMENTS = [
    // secrets
    'password',
    'passwd',
    'secret',
    'token',
    'otp',
    'credential',
    // identity
    'phone',
    'mobile',
    'msisdn',
    'email',
    // money
    'amount',
    'price',
    'cost',
    'revenue',
    'profit',
    'expense',
    'salary',
    'wage',
    'income',
    'payment',
    'balance',
    'invoice',
    // farm records
    'quantity',
    'biomass',
    'harvest',
    'yield',
    'stocking',
    'abw',
    'mbw',
    'fcr',
];

/** Request/response payloads, whatever the SDK happens to call them. */
const BODY_KEYS = new Set([
    'body',
    'input_body',
    'response_body',
    'requestbody',
    'responsebody',
    'payload',
    'form',
]);

const looksSensitiveKey = (key: string): boolean => {
    const k = key.toLowerCase();
    if (EXACT_KEYS.has(k)) return true;
    return KEY_FRAGMENTS.some((f) => k.includes(f));
};

/**
 * String-level scrubbing, for the data that arrives as free text: an error
 * message, a console line, a URL, a stack frame.
 *
 * ORDER MATTERS. Email runs before phone because this app mints internal
 * `<digits>@truecaller.temp` addresses for Truecaller sign-ins — those ARE
 * phone numbers wearing an email's clothes, and the email pass removes the
 * whole thing rather than leaving `[redacted]@truecaller.temp` behind.
 */
export function scrubString(input: string): string {
    let s = input;
    // JWTs (three base64url segments starting with the `{"alg"` header).
    s = s.replace(/eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g, REDACTED);
    // `Bearer <anything>` / `Basic <anything>`.
    s = s.replace(/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{6,}/gi, `$1 ${REDACTED}`);
    // Email addresses, including `9876543210@truecaller.temp`.
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED);
    // Indian mobile numbers: +91XXXXXXXXXX, 91XXXXXXXXXX, or a bare 10 digits
    // starting 6-9. The neighbour check is what stops a 13-digit epoch
    // millisecond timestamp or an id from being mistaken for a phone number.
    s = s.replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, (m, offset: number, whole: string) => {
        const before = whole[offset - 1] ?? '';
        const after = whole[offset + m.length] ?? '';
        if (/\d/.test(before) || /\d/.test(after)) return m;
        return REDACTED;
    });
    return s;
}

/** A URL with its query string and fragment removed — `/api/expenses?amount=…`
 *  is a leak in a breadcrumb, and the path alone is what makes it debuggable. */
const stripQuery = (url: string): string => scrubString(url.replace(/[?#].*$/, ''));

function scrubValue(
    value: unknown,
    key: string,
    parentKey: string,
    depth: number,
    seen: WeakSet<object>,
): unknown {
    if (depth > MAX_DEPTH) return REDACTED;

    if (typeof value === 'string') {
        if (key.toLowerCase() === 'url') return stripQuery(value);
        return scrubString(value);
    }
    if (value === null || typeof value !== 'object') return value;

    // Circular reference — a `beforeSend` that recurses forever loses the
    // error AND wedges the app, which is strictly worse than no reporting.
    if (seen.has(value as object)) return REDACTED;
    seen.add(value as object);

    if (Array.isArray(value)) {
        return value.map((v) => scrubValue(v, key, parentKey, depth + 1, seen));
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const lk = k.toLowerCase();
        if (looksSensitiveKey(k) || BODY_KEYS.has(lk)) {
            out[k] = REDACTED;
            continue;
        }
        // `request.data` / `response.data` are the bodies. A bare `data`
        // elsewhere (a breadcrumb's `{url, method, status_code}`) is useful
        // and survives, scrubbed.
        if (lk === 'data' && (parentKey === 'request' || parentKey === 'response')) {
            out[k] = REDACTED;
            continue;
        }
        out[k] = scrubValue(v, k, lk, depth + 1, seen);
    }
    return out;
}

export type SentryEventLike = Record<string, any>;

/**
 * The whole promise of section 6, in one pure function.
 *
 * Walks the event RECURSIVELY. A shallow pass over `event.extra` misses where
 * this data actually lives — inside `breadcrumbs[].data.response.record`,
 * inside `request.data`, inside an exception message.
 *
 * Fails CLOSED: if anything in here throws, the event is dropped rather than
 * sent unscrubbed. Losing one crash report is cheaper than shipping a farmer's
 * phone number to a third party after promising not to.
 */
export function scrubEvent(event: SentryEventLike | null): SentryEventLike | null {
    if (!event) return null;
    try {
        return scrubValue(event, '', '', 0, new WeakSet()) as SentryEventLike;
    } catch {
        return null;
    }
}

/**
 * Breadcrumbs are the main leak risk, not the exception itself.
 *
 * `console` breadcrumbs are DROPPED outright. A `console.log(record)` is
 * flattened to text before it ever reaches us, so `{ salary: 12000 }` arrives
 * as the string "salary: 12000" with no key left to match on — there is no
 * scrubber that reliably survives that, so the honest fix is not to carry
 * console output at all.
 */
export function scrubBreadcrumb(crumb: SentryEventLike | null): SentryEventLike | null {
    if (!crumb) return null;
    if (crumb.category === 'console') return null;
    return scrubEvent(crumb);
}

/** DSN from app config only. Never hardcoded — absent means "off". */
const getDsn = (): string =>
    ((Constants.expoConfig?.extra as any)?.sentryDsn as string | undefined)?.trim() || '';

let sentry: any = null;
let enabled = true;

/** Lazily required so a build with no DSN never even loads the native SDK. */
const loadSentry = () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    if (!sentry) sentry = require('@sentry/react-native');
    return sentry;
};

/**
 * Initialise Sentry only when a DSN is present. Returns whether crash
 * reporting is actually active; `false` is a normal, supported state and every
 * other function here stays a no-op in it.
 */
export function initSentry(): boolean {
    const dsn = getDsn();
    if (!dsn || sentry) return !!sentry;
    try {
        const S = loadSentry();
        S.init({
            dsn,
            // Explicit, not inherited: no IP address, no username, no cookies.
            sendDefaultPii: false,
            // Crash and error only — the approved posture.
            tracesSampleRate: 0,
            enableAutoPerformanceTracing: false,
            enableNativeFramesTracking: false,
            profilesSampleRate: 0,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 0,
            beforeSend: (event: SentryEventLike) => (enabled ? scrubEvent(event) : null),
            beforeBreadcrumb: (crumb: SentryEventLike) => (enabled ? scrubBreadcrumb(crumb) : null),
        });
        enabled = true;
        return true;
    } catch {
        sentry = null;
        return false;
    }
}

/**
 * The farmer's crash-reporting switch. Turning it off stops sending AND closes
 * the client — a flag alone is the "preference we quietly ignore" that section
 * 6 promises this is not.
 */
export function setCrashReportingEnabled(on: boolean): void {
    enabled = on;
    if (on) {
        initSentry();
        return;
    }
    try {
        sentry?.close?.();
    } catch {
        /* closing a client that never started is not an error worth surfacing */
    }
    sentry = null;
}

/**
 * Identify the account by an IRREVERSIBLE derived id, never the raw id, email,
 * username or phone number. SHA-256 truncated to 16 hex characters: enough to
 * tell "one farmer hitting this a hundred times" from "a hundred farmers",
 * and not enough to be anything else.
 */
export async function setSentryUser(rawId: string | null | undefined): Promise<void> {
    if (!sentry) return;
    if (!rawId) {
        sentry.setUser(null);
        return;
    }
    try {
        const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `upcheck:${rawId}`,
        );
        sentry.setUser({ id: digest.slice(0, 16) });
    } catch {
        sentry.setUser(null);
    }
}

/** True when a DSN is configured AND the farmer has not switched this off. */
export const isCrashReportingActive = (): boolean => !!sentry && enabled;

/**
 * Report an error the app CAUGHT itself.
 *
 * Sentry's own global handler only sees errors nobody caught. Everything the
 * app handles deliberately — a render crash stopped by ErrorBoundary above all
 * — never reaches it, so without this the reports we actually care about were
 * the exact ones being dropped. `reportError()` routes here.
 *
 * A no-op when crash reporting is off or unconfigured, like everything else in
 * this file, and it swallows its own failures: a reporter that can throw while
 * reporting an error turns one bug into two.
 */
export function captureError(
    error: unknown,
    context?: Record<string, unknown>,
): void {
    if (!sentry || !enabled) return;
    try {
        // Context goes through the SAME scrubber as everything else — a
        // componentStack is safe, but callers may pass anything, and `extra`
        // would otherwise bypass beforeSend's event-level walk.
        const extra = context
            ? (scrubEvent({ extra: context } as SentryEventLike)?.extra as
                  | Record<string, unknown>
                  | undefined)
            : undefined;
        sentry.captureException(
            error instanceof Error ? error : new Error(String(error)),
            extra ? { extra } : undefined,
        );
    } catch {
        /* reporting must never be able to break the thing it is reporting on */
    }
}
