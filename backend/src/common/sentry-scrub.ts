import { createHash } from 'crypto';

/**
 * Sentry payload scrubbing. The Privacy Policy (section 6) promises crash
 * reports carry no passwords or session tokens, no phone numbers, no email
 * addresses, and no financial/harvest/farm values, and that an account is
 * identified only by an irreversible identifier. This module makes that true;
 * it is deliberately free of Sentry imports so it can be tested standalone.
 */

export const REDACTED = '[redacted]';

/** Keys whose VALUE is dropped outright, whatever the type. */
const SECRET_KEY =
  /(pass|pwd|secret|token|auth|cookie|session|credential|apikey|api_key|x-api-key|otp|\bpin\b|signature|jwt|dsn|bearer|refresh|access_key|private)/i;
const MONEY_KEY =
  /(amount|price|cost|revenue|profit|expense|salary|wage|income|balance|payment|paid|payout|due|subtotal|total|currency|quantity|quantitykg|weight|biomass|harvest|yield|stocking|feed|fcr|abw|abc)/i;
const PII_KEY =
  /(phone|mobile|msisdn|email|whatsapp|contact|address|aadhaar|aadhar|\bpan\b|upi|ifsc|account_no|accountnumber|dob|latitude|longitude|(user|first|last|full|display|worker|farmer|owner)_?name)/i;

const REDACT_KEY = new RegExp(
  `${SECRET_KEY.source}|${MONEY_KEY.source}|${PII_KEY.source}`,
  'i',
);

/** Headers stripped from request/breadcrumb header bags. */
const SECRET_HEADER = /^(authorization|cookie|set-cookie|apikey|x-api-key)$/i;

/** Patterns redacted anywhere inside a string. Order matters: email before phone. */
const STRING_PATTERNS: RegExp[] = [
  // JWT (Supabase access tokens, our own app JWTs).
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  // Bearer / Basic credentials in a header-ish string.
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // Supabase publishable/secret keys, Brevo keys.
  /\bsb[a-z]?_[A-Za-z0-9_-]{10,}/g,
  /\bxkeysib-[A-Za-z0-9-]{10,}/g,
  // Emails — includes the internal <digits>@truecaller.temp form, which IS a
  // phone number, so this must run before the bare-10-digit rule below.
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // Indian phone numbers: +91XXXXXXXXXX, 91XXXXXXXXXX, bare 10-digit 6-9 start.
  /(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\d)/g,
];

export function scrubString(s: string): string {
  return STRING_PATTERNS.reduce((acc, re) => acc.replace(re, REDACTED), s);
}

const MAX_DEPTH = 12;

/**
 * Recursive scrub. Guards against cycles (WeakSet) and runaway depth so a
 * beforeSend can never hang or throw — losing the error entirely is worse.
 */
export function scrub<T>(value: T, seen = new WeakSet<object>(), depth = 0): T {
  if (typeof value === 'string') return scrubString(value) as unknown as T;
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[depth-limit]' as unknown as T;

  const obj = value as unknown as object;
  if (seen.has(obj)) return '[circular]' as unknown as T;
  seen.add(obj);

  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, seen, depth + 1)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_HEADER.test(k) || REDACT_KEY.test(k)) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = scrub(v, seen, depth + 1);
  }
  return out as unknown as T;
}

/** Irreversible account identifier — never the raw id, email, phone or name. */
export function hashUserId(id: unknown): string | undefined {
  if (id === undefined || id === null || id === '') return undefined;
  return createHash('sha256').update(String(id)).digest('hex').slice(0, 16);
}

type AnyEvent = Record<string, any>;

/**
 * beforeSend hook. Strips bodies, secret headers, query values, PII and money
 * from every corner of the event, and reduces the user to a hashed id.
 */
export function scrubEvent<T extends AnyEvent | null>(event: T): T {
  if (!event) return event;
  try {
    const req = event.request as AnyEvent | undefined;
    if (req) {
      // Bodies are never safe: signup bodies hold passwords, expense bodies
      // hold amounts. Drop them wholesale rather than trying to filter.
      delete req.data;
      delete req.cookies;
      if (req.query_string && typeof req.query_string === 'object') {
        // Keep keys, kill values — the shape of the query is the useful bit.
        for (const k of Object.keys(req.query_string)) {
          req.query_string[k] = REDACTED;
        }
      } else if (typeof req.query_string === 'string') {
        req.query_string = req.query_string.replace(
          /([^&=?]+)=([^&]*)/g,
          `$1=${REDACTED}`,
        );
      }
    }

    if (event.user) {
      const id = hashUserId(event.user.id ?? event.user.ip_address);
      event.user = id ? { id } : {};
    }

    const scrubbed = scrub(event) as T;
    // Never let Sentry attach the client IP.
    if (scrubbed && (scrubbed as AnyEvent).user) {
      delete (scrubbed as AnyEvent).user.ip_address;
    }
    return scrubbed;
  } catch {
    // A throwing beforeSend loses the event. Fail closed on the risky bits.
    return { message: '[scrub failed — event dropped]' } as unknown as T;
  }
}

/** beforeBreadcrumb hook — same walk, applied before the crumb is buffered. */
export function scrubBreadcrumb<T extends AnyEvent | null>(crumb: T): T {
  if (!crumb) return crumb;
  try {
    return scrub(crumb);
  } catch {
    return null as unknown as T;
  }
}

/** Network noise that is not a bug. Deliberately short — silencing a real
 *  error is worse than the noise. */
export const IGNORE_ERRORS = [
  'ECONNRESET',
  'EPIPE',
  'ECONNABORTED',
  'request aborted',
  'socket hang up',
];
