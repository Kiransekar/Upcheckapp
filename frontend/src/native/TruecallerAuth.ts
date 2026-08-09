/**
 * TruecallerAuth — typed JS bridge to the custom native Truecaller module.
 *
 * This replaces the `@dhana-cs/react-native-truecaller` wrapper (which only
 * exposed one-tap OAuth). Our own `TruecallerAuth` native module (Kotlin,
 * `android/app/src/main/java/com/upcheck/app/truecaller/`) wraps the official
 * Truecaller OAuth SDK 3.3.0 and exposes BOTH user journeys:
 *
 *   1. One-Tap OAuth (users WITH the Truecaller app) — `getAuthorizationCode()`
 *      drives `TcSdk.getInstance().getAuthorizationCode(...)` and resolves with
 *      an `authorizationCode` + PKCE `codeVerifier` + `state`. None of these
 *      authorize the user on their own — they are forwarded to the backend
 *      (`POST /auth/supabase/oauth/truecaller/exchange`) which completes the
 *      server-to-server token exchange and mints the session.
 *
 *   2. Missed-call / OTP verification (users WITHOUT the Truecaller app; India +
 *      Android only) — `requestVerification(phone)` triggers a silent drop-call
 *      (or Truecaller-IM OTP); progress arrives as `TruecallerVerification`
 *      events. Once the call is auto-detected (or the OTP is entered) the app
 *      calls `verifyMissedCall()` / `verifyOtp()` and receives an `accessToken`
 *      which the backend validates (`POST /auth/supabase/oauth/truecaller` with
 *      `{ accessToken, phoneNumber, firstName, lastName }`).
 *
 * Android only: on iOS / web every method degrades to a platform-unsupported
 * result / no-op so callers can fall back to email login without crashing, and
 * so the JS test suite runs with no native module present.
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

// ──────────────────────────────────────────────────────────────────────────────
// Native module handle (may be absent: iOS, web, Jest, or a build predating the
// native module). Every public method guards on `isSupported()`.
// ──────────────────────────────────────────────────────────────────────────────

interface NativeTruecallerModule {
  /** Init the SDK with OPTION_VERIFY_ALL_USERS; resolves `isOAuthFlowUsable`. */
  initialize(): Promise<boolean>;
  /** Whether one-tap OAuth can run (Truecaller app present + signed in). */
  isOAuthUsable(): Promise<boolean>;
  /**
   * Launch the one-tap consent screen. Resolves with a discriminated result
   * (see {@link OneTapOutcome}) rather than rejecting on user cancel /
   * fallback, so those are handled as ordinary control flow.
   */
  getAuthorizationCode(): Promise<RawOneTapResult>;
  /** Begin non-TC verification for a 10-digit national number (country "IN"). */
  requestVerification(phoneNational: string): Promise<void>;
  /** Complete a drop-call verification with the user-entered name. */
  verifyMissedCall(firstName: string, lastName: string): Promise<void>;
  /** Complete an OTP (Truecaller-IM) verification with name + code. */
  verifyOtp(firstName: string, lastName: string, otp: string): Promise<void>;
  /** Tear down the current SDK instance (called on sign-out / screen unmount). */
  clear(): void;
  // NativeEventEmitter housekeeping (no-ops in native, required by RN ≥0.65).
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const native: NativeTruecallerModule | undefined =
  Platform.OS === 'android'
    ? (NativeModules.TruecallerAuth as NativeTruecallerModule | undefined)
    : undefined;

const emitter = native ? new NativeEventEmitter(NativeModules.TruecallerAuth) : null;

// ──────────────────────────────────────────────────────────────────────────────
// Result / event types
// ──────────────────────────────────────────────────────────────────────────────

export type TruecallerErrorCode =
  | 'ERROR_USER_CANCELLED'
  | 'ERROR_TC_NOT_USABLE'
  | 'ERROR_SDK_NOT_INITIALIZED'
  | 'ERROR_PLATFORM_UNSUPPORTED'
  | 'ERROR_NETWORK'
  | 'ERROR_UNKNOWN';

/** Raw shape the native one-tap call resolves with. */
interface RawOneTapResult {
  type: 'oauth' | 'verificationRequired' | 'cancelled' | 'unavailable' | 'error';
  authorizationCode?: string;
  codeVerifier?: string;
  state?: string;
  scopesGranted?: string[];
  errorCode?: TruecallerErrorCode;
  message?: string;
}

/** One-tap succeeded — forward these verbatim to the backend exchange. */
export interface OneTapSuccess {
  type: 'oauth';
  authorizationCode: string;
  codeVerifier: string;
  state: string;
  scopesGranted: string[];
}

/**
 * The user has no usable Truecaller profile (app missing, not signed in, or
 * they tapped "use another number"). Callers should route to the missed-call
 * phone-entry flow.
 */
export interface OneTapVerificationRequired {
  type: 'verificationRequired';
}

/** User dismissed the consent screen. Treat as a silent no-op. */
export interface OneTapCancelled {
  type: 'cancelled';
}

/** One-tap can't run here (off-Android, no native module). */
export interface OneTapUnavailable {
  type: 'unavailable';
}

/** A genuine failure worth surfacing (network, SDK, unknown). */
export interface OneTapError {
  type: 'error';
  error: TruecallerErrorCode;
  message?: string;
}

export type OneTapOutcome =
  | OneTapSuccess
  | OneTapVerificationRequired
  | OneTapCancelled
  | OneTapUnavailable
  | OneTapError;

/**
 * Progress of a missed-call / OTP verification. Mirrors the native
 * `VerificationCallback.TYPE_*` constants.
 * - `MISSED_CALL_INITIATED` — drop-call placed; `ttl` seconds to complete.
 * - `MISSED_CALL_RECEIVED` — call auto-detected; app should call
 *   `verifyMissedCall(firstName, lastName)`.
 * - `OTP_INITIATED` / `OTP_RECEIVED` — Truecaller-IM OTP fallback; `otp` is
 *   pre-filled when auto-read.
 * - `VERIFICATION_COMPLETE` / `PROFILE_VERIFIED_BEFORE` — done; `accessToken`
 *   is present and must be sent to the backend for validation.
 * - `ERROR` — verification failed; `message` describes it.
 */
export type TruecallerVerificationStatus =
  | 'MISSED_CALL_INITIATED'
  | 'MISSED_CALL_RECEIVED'
  | 'OTP_INITIATED'
  | 'OTP_RECEIVED'
  | 'VERIFICATION_COMPLETE'
  | 'PROFILE_VERIFIED_BEFORE'
  | 'ERROR';

export interface TruecallerVerificationEvent {
  status: TruecallerVerificationStatus;
  /** Seconds remaining to complete verification (MISSED_CALL_INITIATED / OTP_INITIATED). */
  ttl?: number;
  /** Per-request nonce, echoed for correlation/logging. */
  requestNonce?: string;
  /** Auto-read OTP to pre-fill the input (OTP_RECEIVED). */
  otp?: string;
  /** Opaque access token to validate server-side (VERIFICATION_COMPLETE / PROFILE_VERIFIED_BEFORE). */
  accessToken?: string;
  /** Name Truecaller already had on file for a repeat user (PROFILE_VERIFIED_BEFORE). */
  firstName?: string;
  lastName?: string;
  /** Failure detail (ERROR). */
  message?: string;
}

export interface TruecallerSubscription {
  remove(): void;
}

const EVENT_NAME = 'TruecallerVerification';

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

export const TruecallerAuth = {
  /** True when the native module is present and we're on Android. */
  isSupported(): boolean {
    return !!native;
  },

  /**
   * Initialize the SDK (idempotent on the native side). Resolves whether the
   * one-tap OAuth flow is usable right now; `false` still allows the
   * missed-call flow (OPTION_VERIFY_ALL_USERS).
   */
  async initialize(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.initialize();
    } catch {
      return false;
    }
  },

  /** Re-check one-tap usability (Truecaller app installed + signed in). */
  async isOAuthUsable(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.isOAuthUsable();
    } catch {
      return false;
    }
  },

  /**
   * Run the Truecaller one-tap OAuth flow. Never rejects for expected
   * outcomes — inspect {@link OneTapOutcome.type}.
   */
  async getAuthorizationCode(): Promise<OneTapOutcome> {
    if (!native) return { type: 'unavailable' };
    let raw: RawOneTapResult;
    try {
      raw = await native.getAuthorizationCode();
    } catch (e: unknown) {
      return classifyError(e);
    }
    switch (raw.type) {
      case 'oauth':
        if (raw.authorizationCode && raw.codeVerifier) {
          return {
            type: 'oauth',
            authorizationCode: raw.authorizationCode,
            codeVerifier: raw.codeVerifier,
            state: raw.state ?? '',
            scopesGranted: raw.scopesGranted ?? [],
          };
        }
        return { type: 'error', error: 'ERROR_UNKNOWN' };
      case 'verificationRequired':
        return { type: 'verificationRequired' };
      case 'cancelled':
        return { type: 'cancelled' };
      case 'unavailable':
        return { type: 'unavailable' };
      default:
        return {
          type: 'error',
          error: raw.errorCode ?? 'ERROR_UNKNOWN',
          message: raw.message,
        };
    }
  },

  /**
   * Start non-Truecaller verification for a 10-digit Indian national number.
   * Progress arrives via {@link addVerificationListener}. Rejects only if the
   * SDK throws synchronously (e.g. malformed number).
   */
  async requestVerification(phoneNational: string): Promise<void> {
    if (!native) throw new Error('ERROR_PLATFORM_UNSUPPORTED');
    await native.requestVerification(phoneNational);
  },

  /** Complete a drop-call verification once `MISSED_CALL_RECEIVED` fires. */
  async verifyMissedCall(firstName: string, lastName: string): Promise<void> {
    if (!native) throw new Error('ERROR_PLATFORM_UNSUPPORTED');
    await native.verifyMissedCall(firstName, lastName);
  },

  /** Complete an OTP verification once `OTP_RECEIVED` fires (or manual entry). */
  async verifyOtp(
    firstName: string,
    lastName: string,
    otp: string,
  ): Promise<void> {
    if (!native) throw new Error('ERROR_PLATFORM_UNSUPPORTED');
    await native.verifyOtp(firstName, lastName, otp);
  },

  /** Subscribe to missed-call / OTP verification progress. */
  addVerificationListener(
    cb: (event: TruecallerVerificationEvent) => void,
  ): TruecallerSubscription {
    if (!emitter) return { remove() {} };
    const sub = emitter.addListener(EVENT_NAME, cb);
    return { remove: () => sub.remove() };
  },

  /** Tear down the SDK instance. Safe to call repeatedly / when unsupported. */
  clear(): void {
    if (!native) return;
    try {
      native.clear();
    } catch {
      // best-effort
    }
  },
};

/** Map a thrown native error to a coarse, typed one-tap failure. */
function classifyError(e: unknown): OneTapError {
  const message =
    (e as { message?: string })?.message ??
    (typeof e === 'string' ? e : undefined);
  const haystack = (message ?? '').toLowerCase();
  let error: TruecallerErrorCode = 'ERROR_UNKNOWN';
  if (haystack.includes('cancel') || haystack.includes('denied')) {
    error = 'ERROR_USER_CANCELLED';
  } else if (haystack.includes('network')) {
    error = 'ERROR_NETWORK';
  } else if (haystack.includes('usable') || haystack.includes('not installed')) {
    error = 'ERROR_TC_NOT_USABLE';
  } else if (haystack.includes('initiali')) {
    error = 'ERROR_SDK_NOT_INITIALIZED';
  }
  return { type: 'error', error, message };
}

export default TruecallerAuth;
