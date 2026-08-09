import {
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

/**
 * RSA public key entry returned by `https://api4.truecaller.com/v1/key`.
 *
 * The Truecaller cloud rotates these keys; the {@link TruecallerService}
 * iterates through every key in the cache and accepts the signature if any
 * one of them verifies (Requirement 9.1).
 */
export interface TruecallerPublicKey {
  keyName: string;
  key: string;
}

/**
 * Shape of the base64-decoded JSON inside the One-Tap `payload`. Truecaller
 * documents the canonical fields below; additional fields may appear and are
 * passed through unmodified.
 */
interface DecodedPayload {
  requestNonce: string;
  requestTime: number;
  verifier?: string;
  phoneNumberHash?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  avatarUrl?: string;
  countryCode?: string;
  city?: string;
  isTrueName?: boolean;
}

export interface VerifySignedPayloadInput {
  /** Base64-encoded JSON profile blob signed by Truecaller. */
  payload: string;
  /** Base64 RSA signature over `payload`. */
  signature: string;
  /** SDK-declared algorithm: `SHA512withRSA` or `SHA256withRSA`. */
  signatureAlgorithm: string;
  /** Per-request nonce reported by the SDK; cross-checked against the
   *  embedded nonce inside `payload`. */
  requestNonce: string;
}

export interface VerifiedTruecallerProfile {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Pluggable seam for the Truecaller RSA public-key cache.
 *
 * Task 7.2 refines this with TTL-aware eviction and a background refresh.
 * The {@link TruecallerService} treats the cache as an opaque source of
 * keys and iterates through every key returned per verification attempt.
 */
export interface TruecallerKeyCache {
  /** Returns the active set of public keys, refreshing if stale. */
  getKeys(): Promise<TruecallerPublicKey[]>;
}

/**
 * Pluggable seam for the nonce replay store.
 *
 * Production deployments can swap the default {@link InMemoryNonceReplayStore}
 * for a Redis-backed implementation that uses `SET NX EX` for atomic
 * "reserve-or-fail" semantics across multiple backend instances. The
 * {@link TruecallerService} treats the store as opaque so the public method
 * signatures (`verifySignedPayload`) do not change when the backing store
 * changes.
 */
export interface NonceReplayStore {
  /** Throws {@link UnauthorizedException} with message `Nonce already used`
   *  when the nonce is present and unexpired. */
  assertUnused(nonce: string): Promise<void>;
  /** Records the nonce so any later call within the TTL window is rejected. */
  markUsed(nonce: string): Promise<void>;
}

/**
 * Minimum public-key cache TTL mandated by Requirement 9.2 (≥1 h).
 * Configured values lower than this are coerced up to 3600 s and a
 * warning is logged.
 */
export const TRUECALLER_PUBLIC_KEY_MIN_TTL_SECONDS = 60 * 60;
/**
 * Maximum public-key cache TTL mandated by Requirement 9.2 (≤24 h).
 * Configured values higher than this are coerced down to 86400 s and a
 * warning is logged.
 */
export const TRUECALLER_PUBLIC_KEY_MAX_TTL_SECONDS = 24 * 60 * 60;
/**
 * Default public-key cache TTL when the env var is absent or unparseable.
 * Equal to the lower bound (1 h) per Requirement 9.2 — operators must
 * explicitly opt into a longer cache window.
 */
export const TRUECALLER_PUBLIC_KEY_DEFAULT_TTL_SECONDS =
  TRUECALLER_PUBLIC_KEY_MIN_TTL_SECONDS;

/**
 * Resolve the public-key cache TTL from an env var with the Requirement
 * 9.2 window of [1 h, 24 h]. Returns the default (1 h) when the value is
 * missing or unparseable; clamps and warns when it lies outside the
 * window. Operators get a single canonical place to configure this so a
 * misconfigured env var cannot relax the cache window beyond the spec.
 */
export function resolvePublicKeyTtlSeconds(
  raw: string | undefined,
  logger?: Pick<Logger, 'warn'>,
): number {
  const min = TRUECALLER_PUBLIC_KEY_MIN_TTL_SECONDS;
  const max = TRUECALLER_PUBLIC_KEY_MAX_TTL_SECONDS;
  const def = TRUECALLER_PUBLIC_KEY_DEFAULT_TTL_SECONDS;
  if (raw === undefined || raw === null || raw === '') return def;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger?.warn(
      `TRUECALLER_PUBLIC_KEY_TTL_SECONDS="${raw}" is invalid; using default ${def}s`,
    );
    return def;
  }
  if (parsed < min) {
    logger?.warn(
      `TRUECALLER_PUBLIC_KEY_TTL_SECONDS=${parsed} is below the ${min}s minimum required by Requirement 9.2; clamping to ${min}s`,
    );
    return min;
  }
  if (parsed > max) {
    logger?.warn(
      `TRUECALLER_PUBLIC_KEY_TTL_SECONDS=${parsed} exceeds the ${max}s maximum required by Requirement 9.2; clamping to ${max}s`,
    );
    return max;
  }
  return parsed;
}

/**
 * Default URL of the Truecaller public-key endpoint. Operators can
 * override via `TRUECALLER_KEYS_API_URL` for staging or replay tests.
 */
export const TRUECALLER_DEFAULT_KEYS_API_URL =
  'https://api4.truecaller.com/v1/key';

/**
 * Normalize the response body from the Truecaller public-key endpoint
 * into a flat array of usable {@link TruecallerPublicKey} entries.
 *
 * Truecaller has historically returned either a bare array
 * `[{ keyName, key }, ...]` or an object wrapping the array
 * `{ keys: [{ keyName, key }, ...] }`; this helper accepts both shapes
 * and silently discards anything that lacks a non-empty `key` string so
 * a partially-malformed response does not poison the cache. (Requirement
 * 9.1 demands "use one of the public keys" — a key without a base64 body
 * is not a usable key and would otherwise inflate the verification loop
 * with guaranteed-false attempts.)
 */
export function extractTruecallerPublicKeys(
  raw: unknown,
): TruecallerPublicKey[] {
  const candidates: unknown[] = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === 'object' &&
        Array.isArray((raw as { keys?: unknown[] }).keys)
      ? (raw as { keys: unknown[] }).keys
      : [];
  const out: TruecallerPublicKey[] = [];
  for (const entry of candidates) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { key?: unknown; keyName?: unknown };
    if (typeof e.key !== 'string' || e.key.length === 0) continue;
    out.push({
      keyName: typeof e.keyName === 'string' ? e.keyName : '',
      key: e.key,
    });
  }
  return out;
}

/**
 * In-memory implementation of {@link TruecallerKeyCache}.
 *
 * Implements Requirement 9.2 (TTL between 1 h and 24 h, refresh on miss).
 * The TTL window is enforced upstream by {@link resolvePublicKeyTtlSeconds};
 * this class merely honors whatever `ttlMs` it receives.
 *
 * Concurrency: a single in-flight promise coalesces simultaneous misses
 * so a thundering herd of login requests during a cold start (or the
 * tick after expiry) does not translate into a thundering herd of
 * outbound `GET /v1/key` requests. Once the in-flight fetch resolves,
 * every awaiter sees the same key list; if it rejects, every awaiter
 * sees the same error and the next caller starts a fresh fetch.
 *
 * Failure mode: a fetch that throws or returns zero usable keys raises
 * `UnauthorizedException("Public key fetch failed")`. This is distinct
 * from `Invalid signature` (Requirement 9.3) so operations can tell a
 * Truecaller outage apart from a forged payload.
 */
export class InMemoryTruecallerKeyCache implements TruecallerKeyCache {
  private cache: { keys: TruecallerPublicKey[]; fetchedAt: number } | null =
    null;
  private inflight: Promise<TruecallerPublicKey[]> | null = null;

  constructor(
    private readonly url: string,
    private readonly ttlMs: number,
    private readonly logger?: Pick<Logger, 'warn' | 'error' | 'log'>,
    private readonly now: () => number = Date.now,
    private readonly fetcher: (url: string) => Promise<{ data: unknown }> = (
      u,
    ) => axios.get(u),
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error(
        `InMemoryTruecallerKeyCache: ttlMs must be a positive finite number (got ${ttlMs})`,
      );
    }
  }

  async getKeys(): Promise<TruecallerPublicKey[]> {
    const now = this.now();
    if (this.cache && now - this.cache.fetchedAt < this.ttlMs) {
      return this.cache.keys;
    }
    // Singleflight: coalesce concurrent misses onto one HTTP request.
    if (this.inflight) return this.inflight;
    const fetchPromise = this.fetchAndStore();
    this.inflight = fetchPromise;
    try {
      return await fetchPromise;
    } finally {
      // Clear inflight only if it still references this attempt; a later
      // call may have already swapped in a new fetch.
      if (this.inflight === fetchPromise) this.inflight = null;
    }
  }

  private async fetchAndStore(): Promise<TruecallerPublicKey[]> {
    let raw: unknown;
    try {
      const res = await this.fetcher(this.url);
      raw = res?.data;
    } catch (err) {
      this.logger?.error?.(
        `Truecaller key fetch failed: ${(err as Error).message}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Public key fetch failed',
      });
    }
    const keys = extractTruecallerPublicKeys(raw);
    if (!keys.length) {
      this.logger?.error?.('Truecaller key fetch returned zero usable keys');
      throw new UnauthorizedException({
        success: false,
        message: 'Public key fetch failed',
      });
    }
    this.cache = { keys, fetchedAt: this.now() };
    return keys;
  }
}

/**
 * Minimum nonce TTL mandated by Requirement 9.7. Configured values lower
 * than this are coerced up to 600 s and a warning is logged.
 */
export const TRUECALLER_NONCE_MIN_TTL_SECONDS = 600;

/**
 * Resolve the nonce TTL from an env var with the Requirement 9.7 floor of
 * 600 seconds. Returns the floor when the value is missing, non-numeric,
 * non-positive, or below the floor; emits a warning to {@link logger} when
 * a configured value is clamped up so operators can correct the
 * misconfiguration.
 *
 * No upper bound is enforced; operators may align the nonce TTL with the
 * public-key cache TTL (up to 24 h) per design.md "Nonce store invariants".
 */
export function resolveNonceTtlSeconds(
  raw: string | undefined,
  logger?: Pick<Logger, 'warn'>,
): number {
  const floor = TRUECALLER_NONCE_MIN_TTL_SECONDS;
  if (raw === undefined || raw === null || raw === '') return floor;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger?.warn(
      `TRUECALLER_NONCE_TTL_SECONDS="${raw}" is invalid; using ${floor}s minimum`,
    );
    return floor;
  }
  if (parsed < floor) {
    logger?.warn(
      `TRUECALLER_NONCE_TTL_SECONDS=${parsed} is below the ${floor}s minimum required by Requirement 9.7; clamping to ${floor}s`,
    );
    return floor;
  }
  return parsed;
}

/**
 * Default in-memory implementation of {@link NonceReplayStore}.
 *
 * Eviction strategy: lazy. `assertUnused` sweeps expired entries before
 * checking the candidate nonce, so an entry never blocks reuse beyond its
 * `expiresAt`. This avoids the complexity (and process-exit footguns) of a
 * background `setInterval`, and matches the strategy documented in
 * design.md "Nonce store invariants" → "Eviction is lazy". The sweep is
 * O(n) in the number of currently-stored nonces; given the 600s TTL and
 * the rate at which login requests arrive in practice, this is bounded by
 * the per-instance traffic for a 10-minute window.
 *
 * Production deployments running multiple backend instances should
 * substitute a Redis-backed {@link NonceReplayStore} (e.g. `SET NX EX 600`)
 * so a replay attempted on a different instance is still rejected.
 */
export class InMemoryNonceReplayStore implements NonceReplayStore {
  private readonly store = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error(
        `InMemoryNonceReplayStore: ttlMs must be a positive finite number (got ${ttlMs})`,
      );
    }
  }

  /** Visible-for-test: number of entries currently held (including expired
   *  entries that have not yet been swept). */
  size(): number {
    return this.store.size;
  }

  async assertUnused(nonce: string): Promise<void> {
    this.evictExpired();
    const expiresAt = this.store.get(nonce);
    if (expiresAt !== undefined && expiresAt > this.now()) {
      throw new UnauthorizedException({
        success: false,
        message: 'Nonce already used',
      });
    }
  }

  async markUsed(nonce: string): Promise<void> {
    this.store.set(nonce, this.now() + this.ttlMs);
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [nonce, expiresAt] of this.store.entries()) {
      if (expiresAt <= now) this.store.delete(nonce);
    }
  }
}

/**
 * Redis-backed {@link NonceReplayStore} for multi-instance deployments.
 *
 * A nonce is stored under `truecaller:nonce:<nonce>` with a TTL equal to the
 * configured nonce window, so a replay attempted on any instance sharing the
 * same Redis is rejected (the documented `SET … EX` strategy). When Redis is
 * unavailable, {@link RedisService} transparently falls back to its own
 * per-process in-memory map — i.e. behaviour degrades to the single-process
 * guarantee rather than failing closed.
 */
export class RedisNonceReplayStore implements NonceReplayStore {
  private static readonly PREFIX = 'truecaller:nonce:';

  constructor(
    private readonly redis: {
      get(key: string): Promise<string | null>;
      set(
        key: string,
        value: string,
        mode?: 'EX',
        duration?: number,
      ): Promise<void>;
    },
    private readonly ttlMs: number,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error(
        `RedisNonceReplayStore: ttlMs must be a positive finite number (got ${ttlMs})`,
      );
    }
  }

  private key(nonce: string): string {
    return `${RedisNonceReplayStore.PREFIX}${nonce}`;
  }

  async assertUnused(nonce: string): Promise<void> {
    const existing = await this.redis.get(this.key(nonce));
    if (existing !== null) {
      throw new UnauthorizedException({
        success: false,
        message: 'Nonce already used',
      });
    }
  }

  async markUsed(nonce: string): Promise<void> {
    await this.redis.set(
      this.key(nonce),
      '1',
      'EX',
      Math.ceil(this.ttlMs / 1000),
    );
  }
}

/**
 * Server-side verifier for Truecaller One-Tap signed payloads (Flow A) and
 * OTP / missed-call access tokens (Flow B).
 *
 * Implements Requirements 9.1, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 13.2,
 * 13.3. The replay-protection store and the public-key cache are pluggable
 * via {@link TruecallerKeyCache} and {@link NonceReplayStore} so tasks 7.2
 * and 7.3 can swap implementations without changing the public surface.
 */
@Injectable()
export class TruecallerService {
  private readonly logger = new Logger(TruecallerService.name);

  private readonly keysApiUrl: string;
  private readonly otpVerifyUrl: string;
  private readonly publicKeyTtlMs: number;
  private readonly nonceTtlMs: number;

  // OAuth 2.0 (Truecaller "Sign in with Truecaller" / Account SDK) — used by
  // the @dhana-cs/react-native-truecaller One-Tap flow, which returns an
  // authorization code + PKCE code_verifier that must be exchanged
  // server-to-server for an access token and then a userinfo profile.
  private readonly oauthClientId: string;
  private readonly oauthTokenUrl: string;
  private readonly oauthUserInfoUrl: string;

  // In-memory cache implementations. Tasks 7.2 / 7.3 refine these.
  private readonly keyCache: TruecallerKeyCache;
  private readonly nonceStore: NonceReplayStore;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
  ) {
    this.keysApiUrl =
      this.configService.get<string>('TRUECALLER_KEYS_API_URL') ||
      TRUECALLER_DEFAULT_KEYS_API_URL;
    // Missed-call / OTP (non-Truecaller user) access-token validation endpoint.
    // The SDK hands the app an opaque access token after a drop-call/OTP
    // verification; we validate it server-to-server here. Per the official
    // 3.x docs this is a `GET .../phoneNumberDetail/{accessToken}` with the
    // `clientId` sent as a HEADER (NOT an OAuth Bearer token — that was the
    // earlier bug that pointed at api5's profile endpoint). The token is
    // appended to this base URL as a path segment. Non-EU host by default;
    // EU deployments override via env.
    this.otpVerifyUrl =
      this.configService.get<string>('TRUECALLER_OTP_VERIFY_URL') ||
      'https://sdk-otp-verification-noneu.truecaller.com/v1/otp/client/installation/phoneNumberDetail';

    // OAuth endpoints default to the non-EU Truecaller account host (India and
    // most non-EU regions). EU deployments override these via env. The client
    // id must match the one the mobile SDK was initialized with — it is the
    // public PKCE client identifier, NOT a secret, so the same value the app
    // ships (app.config.ts `truecallerAndroidClientId`) is correct here.
    const oauthBase =
      this.configService.get<string>('TRUECALLER_OAUTH_BASE_URL') ||
      'https://oauth-account-noneu.truecaller.com';
    this.oauthClientId =
      this.configService.get<string>('TRUECALLER_OAUTH_CLIENT_ID') ||
      'e98dcupeqtmcocbxr7qb4g7b4sub8blazhxrt-1ikmw';
    this.oauthTokenUrl =
      this.configService.get<string>('TRUECALLER_OAUTH_TOKEN_URL') ||
      `${oauthBase}/v1/token`;
    this.oauthUserInfoUrl =
      this.configService.get<string>('TRUECALLER_OAUTH_USERINFO_URL') ||
      `${oauthBase}/v1/userinfo`;

    // Defaults: 1h key cache, clamped to [1h, 24h] per Requirement 9.2.
    const keyTtlSec = resolvePublicKeyTtlSeconds(
      this.configService.get<string>('TRUECALLER_PUBLIC_KEY_TTL_SECONDS'),
      this.logger,
    );
    const nonceTtlSec = resolveNonceTtlSeconds(
      this.configService.get<string>('TRUECALLER_NONCE_TTL_SECONDS'),
      this.logger,
    );
    this.publicKeyTtlMs = keyTtlSec * 1000;
    this.nonceTtlMs = nonceTtlSec * 1000;

    this.keyCache = this.buildInMemoryKeyCache();
    // Prefer a Redis-backed replay store so replay rejection holds across
    // multiple backend instances; fall back to in-memory when Redis is not
    // wired in (e.g. unit tests constructing the service directly).
    this.nonceStore = this.redisService
      ? new RedisNonceReplayStore(this.redisService, this.nonceTtlMs)
      : this.buildInMemoryNonceStore();
  }

  // ──────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────

  /**
   * Verify a One-Tap signed payload from the Truecaller SDK and return the
   * embedded profile.
   *
   * Failure modes (each throws `UnauthorizedException` with the exact
   * message required by Requirement 9):
   * - `Invalid signature` — no cached key verifies the RSA signature.
   * - `Invalid payload` — payload is not base64-encoded JSON.
   * - `Nonce mismatch` — embedded nonce differs from request body nonce.
   * - `Payload expired` — `requestTime` is older than 600,000 ms.
   * - `Nonce already used` — replay of a previously verified nonce.
   */
  async verifySignedPayload(
    input: VerifySignedPayloadInput,
  ): Promise<VerifiedTruecallerProfile> {
    const { payload, signature, signatureAlgorithm, requestNonce } = input;

    // 1. Replay-protection upfront so a stolen nonce cannot burn key
    // verification attempts on every replay.
    await this.nonceStore.assertUnused(requestNonce);

    // 2. RSA verify against every cached key. The algorithm is dictated by
    // the SDK-declared `signatureAlgorithm`; anything other than
    // SHA512withRSA falls back to SHA256withRSA per Requirement 9.1.
    const algo = signatureAlgorithm.includes('512')
      ? 'RSA-SHA512'
      : 'RSA-SHA256';
    const keys = await this.keyCache.getKeys();

    const verified = keys.some(({ key }) => {
      try {
        const verifier = crypto.createVerify(algo);
        verifier.update(payload);
        const pem = this.toPem(key);
        return verifier.verify(pem, signature, 'base64');
      } catch {
        return false;
      }
    });

    if (!verified) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid signature',
      });
    }

    // 3. Decode payload and check nonce + freshness.
    let decoded: DecodedPayload;
    try {
      decoded = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf-8'),
      ) as DecodedPayload;
    } catch {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid payload',
      });
    }

    if (decoded.requestNonce !== requestNonce) {
      throw new UnauthorizedException({
        success: false,
        message: 'Nonce mismatch',
      });
    }

    if (
      typeof decoded.requestTime !== 'number' ||
      Date.now() - decoded.requestTime > 600_000
    ) {
      throw new UnauthorizedException({
        success: false,
        message: 'Payload expired',
      });
    }

    // 4. Persist nonce so a replay within the TTL window is rejected.
    await this.nonceStore.markUsed(requestNonce);

    if (decoded.phoneNumber) {
      this.logger.log(
        `Truecaller signed payload verified for ${this.maskPhone(decoded.phoneNumber)}`,
      );
    }

    return {
      phoneNumber: decoded.phoneNumber ?? '',
      firstName: decoded.firstName ?? 'User',
      lastName: decoded.lastName,
      email: decoded.email,
      avatarUrl: decoded.avatarUrl,
    };
  }

  /**
   * Verify an OTP / missed-call access token by exchanging it server-to-
   * server with the Truecaller profile API. Implements Requirement 10.
   *
   * Failure modes (each throws `UnauthorizedException` with the exact
   * message required by Requirement 10):
   * - `Invalid access token` — non-2xx response or transport error.
   * - `Invalid Truecaller profile` — response body lacks a non-empty
   *   `phoneNumber`.
   * - `Phone number mismatch` — normalized profile phone differs from the
   *   normalized request phone.
   */
  async verifyAccessToken(
    accessToken: string,
    expectedPhoneNumber: string,
  ): Promise<VerifiedTruecallerProfile> {
    // The access token is appended as a path segment; the client id travels
    // as a header. `encodeURIComponent` guards against a token containing a
    // `/` or `?` from breaking out of the path.
    const url = `${this.otpVerifyUrl}/${encodeURIComponent(accessToken)}`;
    let res;
    try {
      res = await axios.get(url, {
        headers: { clientId: this.oauthClientId },
        // Treat all statuses as resolved so we can map them ourselves.
        validateStatus: () => true,
      });
    } catch (err) {
      // Network / transport failure — never leak the access token.
      this.logger.warn(
        `Truecaller OTP verify request failed for ${this.maskPhone(expectedPhoneNumber)}: ${(err as Error).message}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid access token',
      });
    }

    if (res.status < 200 || res.status >= 300) {
      // 404 {code:1404} = invalid access token; 404 {code:404} = invalid
      // partner credentials; anything else = server error. All collapse to
      // the same 10.2 envelope so no implementation detail leaks.
      this.logger.warn(
        `Truecaller OTP verify returned ${res.status} for ${this.maskPhone(expectedPhoneNumber)}: ${JSON.stringify(res.data)?.slice(0, 200)}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid access token',
      });
    }

    // The phoneNumberDetail endpoint returns `{ phoneNumber, countryCode }`.
    // `phoneNumber` may arrive as a JSON number (e.g. 919876543210) rather
    // than a string, so coerce defensively before validating.
    const data = res.data;
    const rawPhone =
      data != null &&
      (typeof data.phoneNumber === 'string' ||
        typeof data.phoneNumber === 'number')
        ? String(data.phoneNumber)
        : '';
    if (rawPhone.length === 0) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid Truecaller profile',
      });
    }

    const countryCode =
      typeof data.countryCode === 'string' ? data.countryCode : undefined;
    // Canonicalize to E.164 so a missed-call login and a one-tap OAuth login
    // for the same person resolve to the SAME stored `phone` value (the
    // account-linking key). The OTP endpoint returns bare national digits,
    // whereas OAuth userinfo returns a `+`-prefixed E.164 string; without
    // this both would create separate `users` rows for one human.
    const e164 = this.toE164(rawPhone, countryCode);

    if (
      this.normalizePhone(e164) !== this.normalizePhone(expectedPhoneNumber)
    ) {
      this.logger.warn(
        `Truecaller OTP phone mismatch: profile=${this.maskPhone(e164)} expected=${this.maskPhone(expectedPhoneNumber)}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Phone number mismatch',
      });
    }

    this.logger.log(
      `Truecaller access token verified for ${this.maskPhone(e164)}`,
    );

    // This endpoint returns only the phone number (no name/email/avatar).
    // The caller supplies the user-entered display name for missed-call
    // sign-ups; the phone number here is the only server-verified identity.
    return { phoneNumber: e164, firstName: 'User' };
  }

  /**
   * Verify a Truecaller OAuth 2.0 authorization code (One-Tap flow from
   * `@dhana-cs/react-native-truecaller`) by completing the PKCE exchange
   * server-to-server and reading the userinfo profile.
   *
   * Two server-side calls:
   *   1. POST {tokenUrl} (form-urlencoded) with
   *      `grant_type=authorization_code`, `client_id`, `code`, `code_verifier`
   *      → `{ access_token }`.
   *   2. GET {userInfoUrl} with `Authorization: Bearer <access_token>`
   *      → OIDC-style profile (`phone_number`, `given_name`, ...).
   *
   * Failure modes (all throw `UnauthorizedException`, never leaking the code
   * or token):
   * - `Invalid authorization code` — token endpoint returned non-2xx / no
   *   access_token, or a transport error occurred.
   * - `Invalid Truecaller profile` — userinfo lacked a usable phone number.
   */
  async verifyOAuthCode(
    authorizationCode: string,
    codeVerifier: string,
  ): Promise<VerifiedTruecallerProfile> {
    // 1. Exchange the authorization code + PKCE verifier for an access token.
    let tokenRes;
    try {
      const form = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.oauthClientId,
        code: authorizationCode,
        code_verifier: codeVerifier,
      });
      tokenRes = await axios.post(this.oauthTokenUrl, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true,
      });
    } catch (err) {
      this.logger.warn(
        `Truecaller OAuth token exchange transport error: ${(err as Error).message}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid authorization code',
      });
    }

    if (tokenRes.status < 200 || tokenRes.status >= 300) {
      // Surface Truecaller's actual error (e.g. invalid_client / invalid_grant /
      // unauthorized_client) so a portal/client-id misconfig is diagnosable from
      // the logs instead of hiding behind a generic 401.
      this.logger.warn(
        `Truecaller OAuth token endpoint returned ${tokenRes.status}: ${JSON.stringify(tokenRes.data)?.slice(0, 500)}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid authorization code',
      });
    }

    const accessToken =
      tokenRes.data && typeof tokenRes.data.access_token === 'string'
        ? tokenRes.data.access_token
        : '';
    if (!accessToken) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid authorization code',
      });
    }

    // 2. Fetch the userinfo profile with the access token.
    let infoRes;
    try {
      infoRes = await axios.get(this.oauthUserInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true,
      });
    } catch (err) {
      this.logger.warn(
        `Truecaller OAuth userinfo transport error: ${(err as Error).message}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid authorization code',
      });
    }

    if (infoRes.status < 200 || infoRes.status >= 300) {
      this.logger.warn(
        `Truecaller OAuth userinfo returned ${infoRes.status}: ${JSON.stringify(infoRes.data)?.slice(0, 500)}`,
      );
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid authorization code',
      });
    }

    const profile = infoRes.data ?? {};
    // Truecaller's OIDC userinfo uses `phone_number` (E.164) and
    // `given_name` / `family_name`; fall back to legacy camelCase fields
    // defensively in case the host returns the SDK-style shape.
    const rawPhone =
      typeof profile.phone_number === 'string'
        ? profile.phone_number
        : typeof profile.phoneNumber === 'string'
          ? profile.phoneNumber
          : '';
    if (!rawPhone) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid Truecaller profile',
      });
    }

    const firstName =
      (typeof profile.given_name === 'string' && profile.given_name) ||
      (typeof profile.firstName === 'string' && profile.firstName) ||
      'User';
    const lastName =
      (typeof profile.family_name === 'string' && profile.family_name) ||
      (typeof profile.lastName === 'string' && profile.lastName) ||
      undefined;
    const email =
      (typeof profile.email === 'string' && profile.email) || undefined;
    const avatarUrl =
      (typeof profile.picture === 'string' && profile.picture) ||
      (typeof profile.avatarUrl === 'string' && profile.avatarUrl) ||
      undefined;

    this.logger.log(
      `Truecaller OAuth code verified for ${this.maskPhone(rawPhone)}`,
    );

    return { phoneNumber: rawPhone, firstName, lastName, email, avatarUrl };
  }

  /**
   * Strip a leading `+91`/`91` country code and any non-digit characters
   * (Requirement 10.4). Used both for cross-checking the profile API
   * response and for canonicalizing values before comparing them.
   *
   * Order and length-guarding matter:
   *   1. Strip non-digits first so any non-digit characters surrounding
   *      or preceding the country code (e.g. `(+917627092985`,
   *      `+91 (98765) 43210`) cannot block the country-code strip.
   *   2. Only remove a leading `91` when the digit string is exactly 12
   *      digits long (`+91` + 10-digit local). This preserves valid
   *      10-digit local numbers that happen to start with `91` (e.g.
   *      `9100000000` is a valid `^[6-9]\d{9}$` mobile and must NOT
   *      collapse to `00000000`).
   *
   * Property 10 (PBT 10.10) covers the canonical/idempotence invariants
   * this enforces.
   */
  normalizePhone(input: string | null | undefined): string {
    if (typeof input !== 'string') return '';
    const digits = input.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return digits;
  }

  /**
   * Canonicalize a phone number to E.164 (`+<cc><national>`) so every
   * Truecaller flow (OAuth one-tap / signed payload / missed-call OTP)
   * stores the SAME `phone` value for one human — the account-linking key.
   *
   * - A value already in `+`-prefixed form is assumed to be E.164 and only
   *   has interior whitespace stripped (OAuth userinfo / signed payloads).
   * - Otherwise the value is reduced to digits and prefixed with the dialing
   *   code for `countryCode` (default `IN` → `+91`). A 12-digit `91…`
   *   string is treated as already carrying the country code. This app is
   *   India-first and Truecaller's non-TC verification is India-only, so a
   *   `+91` default is safe; other country codes can be added here later.
   */
  toE164(
    input: string | null | undefined,
    countryCode?: string | null,
  ): string {
    if (typeof input !== 'string') return '';
    const trimmed = input.trim();
    if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '');
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 0) return '';
    // Map the ISO country code to its dialing code. Only `IN` is needed
    // today; unknown codes fall back to India rather than emitting a
    // country-less number that could never link.
    const dialByCountry: Record<string, string> = { IN: '91' };
    const dial = dialByCountry[(countryCode ?? 'IN').toUpperCase()] ?? '91';
    if (digits.startsWith(dial) && digits.length === dial.length + 10) {
      return '+' + digits;
    }
    if (digits.length === 10) return `+${dial}${digits}`;
    // Fall back to prefixing a `+` on whatever digits we have so the value
    // is at least well-formed; callers cross-check against the expected
    // number, so a wrong guess here fails closed as a mismatch.
    return '+' + digits;
  }

  /**
   * Mask a phone number for diagnostic logs so only the last 4 digits
   * remain visible (Requirement 13.3). Returns a fully masked placeholder
   * if fewer than 4 digits are present.
   */
  maskPhone(input: string | null | undefined): string {
    const digits = this.normalizePhone(input);
    if (digits.length < 4) return '+91XXXXXXXXXX';
    return `+91XXXXXX${digits.slice(-4)}`;
  }

  // ──────────────────────────────────────────────────────────────────
  // Pluggable seams (refined by tasks 7.2 / 7.3)
  // ──────────────────────────────────────────────────────────────────

  /**
   * In-memory key cache with TTL clamped to [1 h, 24 h] (Requirement 9.2)
   * and singleflight refresh-on-miss. Production deployments can swap in
   * a Redis-backed cache (or an HSM-fronted key store) by replacing this
   * builder; the {@link TruecallerKeyCache} interface stays the same.
   */
  private buildInMemoryKeyCache(): TruecallerKeyCache {
    return new InMemoryTruecallerKeyCache(
      this.keysApiUrl,
      this.publicKeyTtlMs,
      this.logger,
    );
  }

  /**
   * Default in-memory nonce replay store. Production deployments swap this
   * for a Redis-backed {@link NonceReplayStore} via dependency injection
   * (the public {@link NonceReplayStore} interface stays the same so
   * {@link verifySignedPayload} does not change). See
   * {@link InMemoryNonceReplayStore} for the eviction-strategy rationale.
   */
  private buildInMemoryNonceStore(): NonceReplayStore {
    return new InMemoryNonceReplayStore(this.nonceTtlMs);
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────

  /**
   * Wrap a base64-encoded DER public key in PEM headers. Truecaller serves
   * keys in either bare base64 form or already-PEM form; this helper is
   * idempotent for the latter.
   */
  private toPem(key: string): string {
    if (key.includes('-----BEGIN')) return key;
    return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
  }
}
