import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, createPublicKey, type KeyObject } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { RedisService } from '../../redis/redis.service';

/**
 * Supabase's public signing keys, cached in process.
 *
 * WHY LOCAL VERIFICATION EXISTS
 *
 * Every request used to call `supabase.auth.getUser()`, a round trip to
 * Supabase Auth in Singapore from a backend in Oregon. Measured against
 * production: 0.5-1.3s PER REQUEST, before any of the farmer's data is read.
 * A screen makes four or five requests, so that alone was most of an 8-15s
 * page load.
 *
 * The Redis cache added earlier was supposed to absorb this and did not — a
 * live check found ZERO `authtok:` keys and no key with a TTL, while the logs
 * showed `verifying via supabase.auth.getUser()` on requests only ten seconds
 * apart, well inside the 30s window. Rather than keep chasing why the cache
 * misses, this removes the need for it: an ES256 signature check against the
 * project's published JWKS is local CPU work, microseconds, no network.
 *
 * THE TRADE-OFF, STATED PLAINLY
 *
 * `getUser()` asks Supabase whether the session is still valid, so it catches
 * a revoked session immediately. A signature check cannot: a token stays
 * accepted until its own `exp`. That widens the revocation window from ~0 to
 * the token's lifetime. It is a deliberate trade for an app that is otherwise
 * unusable, and it is bounded — `jwt.verify` enforces `exp` itself.
 *
 * Anything this cannot verify (unknown kid, non-ES256, malformed, expired)
 * falls through to `getUser()` unchanged, so no token is ever accepted here
 * that the old path would have rejected.
 */
let jwksCache: Map<string, KeyObject> | null = null;
let jwksFetchedAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function loadJwks(supabaseUrl: string, force = false): Promise<Map<string, KeyObject>> {
  const fresh = Date.now() - jwksFetchedAt < JWKS_TTL_MS;
  if (jwksCache && fresh && !force) return jwksCache;

  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  const body = (await res.json()) as { keys?: any[] };
  const map = new Map<string, KeyObject>();
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid) continue;
    try {
      map.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      // A key we cannot import is simply not usable locally; getUser() covers it.
    }
  }
  jwksCache = map;
  jwksFetchedAt = Date.now();
  return map;
}

/** Exported for tests — a fresh process must not inherit another test's keys. */
export function __resetJwksCacheForTests(): void {
  jwksCache = null;
  jwksFetchedAt = 0;
}

/**
 * How long a SUCCESSFUL token verification is trusted from cache.
 *
 * This is the revocation window: a session revoked on Supabase stays accepted
 * here for at most this long. Kept deliberately short — the win is already
 * enormous (a farmer opening one screen fires ~30 requests, and without this
 * every one of them pays a full round trip to Supabase Auth in Singapore from
 * a backend in Oregon; measured at ~200ms each).
 */
const AUTH_CACHE_TTL_S = 30;

/**
 * Seconds until the token's own `exp`, used ONLY to shorten the cache TTL.
 *
 * This reads the payload WITHOUT verifying the signature, which is safe here
 * precisely because it can only ever cache something for less time. It is
 * never used to decide whether a token is valid — `supabase.auth.getUser()`
 * remains the only authority for that, and it has already returned success by
 * the time this is called. An unreadable or absent `exp` yields the default.
 */
function secondsUntilExpiry(token: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    if (typeof payload?.exp !== 'number') return AUTH_CACHE_TTL_S;
    return Math.floor(payload.exp - Date.now() / 1000);
  } catch {
    return AUTH_CACHE_TTL_S;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly supabase: SupabaseClient;
  /** Kept for the JWKS endpoint — see loadJwks / verifyLocally. */
  private readonly supabaseUrl: string;

  constructor(
    private reflector: Reflector,
    configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    // Build a self-contained Supabase admin client.
    // ConfigService is globally available — no circular-dependency risk.
    const url = configService.get<string>('SUPABASE_URL') ?? '';
    const key = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    this.supabaseUrl = url;
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Verify the token's ES256 signature against the project's JWKS.
   *
   * Returns null — never throws, and never a partial user — for ANYTHING it
   * cannot fully verify. The caller then falls through to
   * `supabase.auth.getUser()`, so this can only ever make an accepted token
   * faster, never make a rejected one accepted.
   */
  private async verifyLocally(
    token: string,
  ): Promise<{ id: string; email?: string } | null> {
    try {
      const decoded = jwt.decode(token, { complete: true });
      const kid = decoded?.header?.kid;
      // Only the asymmetric algorithm this project actually signs with. An
      // `alg` we do not expect is refused outright rather than trusted.
      if (!kid || decoded?.header?.alg !== 'ES256') return null;

      const url = this.supabaseUrl;
      if (!url) return null;

      let keys = await loadJwks(url);
      let key = keys.get(kid);
      if (!key) {
        // Unknown kid usually means Supabase rotated its signing key; refetch
        // once before giving up so a rotation does not fail every request.
        keys = await loadJwks(url, true);
        key = keys.get(kid);
      }
      if (!key) return null;

      // Verifies the signature AND `exp` — an expired token throws here.
      const payload = jwt.verify(token, key, {
        algorithms: ['ES256'],
      }) as jwt.JwtPayload;

      if (!payload?.sub) return null;
      return { id: payload.sub, email: payload.email as string | undefined };
    } catch {
      return null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;

    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.log(`[PUBLIC] ${method} ${url} — skipping auth`);
      return true;
    }

    const authHeader: string | undefined = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        `[NO AUTH HEADER] ${method} ${url} — missing Authorization header`,
      );
      throw new UnauthorizedException('No bearer token provided');
    }

    const token = authHeader.substring(7);

    // Cache the VERIFICATION RESULT, never the token itself: the key is a
    // SHA-256 of the token so nothing that reaches Redis can be replayed as a
    // credential if the cache is ever exposed.
    const cacheKey = `authtok:${createHash('sha256').update(token).digest('hex')}`;

    // Fastest path: verify the signature ourselves. No network at all.
    const local = await this.verifyLocally(token);
    if (local) {
      req.user = local;
      return true;
    }

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        req.user = JSON.parse(cached);
        return true;
      } catch {
        // Corrupt entry — fall through and verify for real rather than
        // letting a malformed cache decide an auth outcome either way.
      }
    }

    // Hot-path: keep verification quiet by default. No email (PII) in logs
    // and no per-request "[AUTH OK]" spam — only the user id, at debug level.
    this.logger.debug(
      `[GUARD] ${method} ${url} — verifying via supabase.auth.getUser() (alg-agnostic)`,
    );

    try {
      // supabase.auth.getUser() validates the JWT on Supabase's servers.
      // Works for both HS256 (legacy) and ES256 (new projects) automatically.
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data.user) {
        throw new UnauthorizedException(
          error?.message ?? 'Invalid or expired token',
        );
      }

      const supabaseUser = data.user;
      this.logger.debug(`[GUARD] token valid — sub: ${supabaseUser.id}`);

      // `accountType` is deliberately NOT attached. It used to be read off
      // client-mutable Supabase user_metadata and gated exactly one endpoint
      // (farm creation). Leaving it off `req.user` means nothing can
      // accidentally authorize on it later — per-farm role via
      // FarmAccessService is the only authority.
      req.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
      };

      // Only SUCCESSFUL verifications are cached — a rejection must always be
      // re-checked, so a token cannot be denied from a stale entry.
      //
      // The TTL never outlives the token: a token expiring in 5s is cached for
      // 5s, so the cache can't keep a dead token alive past its own `exp`.
      const ttl = Math.min(AUTH_CACHE_TTL_S, secondsUntilExpiry(token));
      if (ttl > 0) {
        await this.redis
          .set(cacheKey, JSON.stringify(req.user), 'EX', ttl)
          .catch(() => undefined); // a cache write failure must never fail auth
      }
      return true;
    } catch (err: any) {
      this.logger.error(`[UNAUTHORIZED] ${method} ${url} — ${err.message}`);
      throw new UnauthorizedException(
        err.message || 'Invalid or expired token',
      );
    }
  }
}
