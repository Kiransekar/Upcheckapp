import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, __resetJwksCacheForTests } from './jwt-auth.guard';

/** Minimal RedisService stub — a miss by default. */
const makeRedis = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

/** A JWT whose payload carries `exp`; only the payload segment is ever read. */
const tokenExpiringIn = (seconds: number): string => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }),
  ).toString('base64url');
  return `header.${payload}.signature`;
};

const ctxFor = (token: string): any => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: `Bearer ${token}` },
    }),
  }),
  getHandler: () => () => {},
  getClass: () => class {},
});

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    const reflector = new Reflector();
    redis = makeRedis();
    guard = new JwtAuthGuard(
      reflector,
      { get: jest.fn().mockReturnValue('http://dummy.com') } as any,
      redis as any,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('AUTH-3: does not log the user email at log/warn on the auth hot path', async () => {
    const EMAIL = 'farmer.secret@example.com';
    (guard as any).supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: EMAIL } },
          error: null,
        }),
      },
    };

    const logger = (guard as any).logger;
    const logSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/ping',
          headers: { authorization: 'Bearer tok' },
        }),
      }),
      getHandler: () => () => {},
      getClass: () => class {},
    };

    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);

    const nonDebugArgs = [...logSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .join(' ');
    expect(nonDebugArgs).not.toContain(EMAIL);
    expect(nonDebugArgs).not.toContain('@');
    // Per-request "[AUTH OK]" spam is gone from log level.
    expect(nonDebugArgs).not.toContain('[AUTH OK]');
  });

  // Opening one screen fires ~30 requests. Without this cache every one paid a
  // full round trip to Supabase Auth in Singapore from a backend in Oregon.
  describe('verification cache', () => {
    const stubGetUser = (result: any) => {
      const getUser = jest.fn().mockResolvedValue(result);
      (guard as any).supabase = { auth: { getUser } };
      return getUser;
    };
    const ok = {
      data: { user: { id: 'u1', email: 'f@example.com' } },
      error: null,
    };

    beforeEach(() => {
      const logger = (guard as any).logger;
      jest.spyOn(logger, 'debug').mockImplementation(() => {});
      jest.spyOn(logger, 'error').mockImplementation(() => {});
    });

    it('serves a cache hit without calling Supabase at all', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ id: 'u1', email: 'f@x.com' }));
      const getUser = stubGetUser(ok);

      const ctx = ctxFor(tokenExpiringIn(3600));
      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      expect(getUser).not.toHaveBeenCalled();
    });

    it('keys the cache on a HASH, never on the token itself', async () => {
      stubGetUser(ok);
      const token = tokenExpiringIn(3600);

      await guard.canActivate(ctxFor(token));

      const key = redis.set.mock.calls[0][0];
      // A token reaching Redis verbatim would be a replayable credential.
      expect(key).not.toContain(token);
      expect(key).toMatch(/^authtok:[0-9a-f]{64}$/);
    });

    it('never caches a REJECTION, so a bad token is always re-checked', async () => {
      stubGetUser({ data: { user: null }, error: { message: 'bad token' } });

      await expect(guard.canActivate(ctxFor(tokenExpiringIn(3600)))).rejects.toThrow();

      expect(redis.set).not.toHaveBeenCalled();
    });

    // The cache must not be able to keep a dead token alive past its own exp.
    it('caps the TTL at the token expiry when that is sooner', async () => {
      stubGetUser(ok);

      await guard.canActivate(ctxFor(tokenExpiringIn(5)));

      const [, , mode, ttl] = redis.set.mock.calls[0];
      expect(mode).toBe('EX');
      expect(ttl).toBeLessThanOrEqual(5);
      expect(ttl).toBeGreaterThan(0);
    });

    it('uses the default TTL for a long-lived token', async () => {
      stubGetUser(ok);

      await guard.canActivate(ctxFor(tokenExpiringIn(3600)));

      expect(redis.set.mock.calls[0][3]).toBe(30);
    });

    it('falls through to real verification on a corrupt cache entry', async () => {
      redis.get.mockResolvedValue('{not json');
      const getUser = stubGetUser(ok);

      await expect(guard.canActivate(ctxFor(tokenExpiringIn(3600)))).resolves.toBe(true);

      expect(getUser).toHaveBeenCalled();
    });

    // Redis is an optimisation. If it is down, auth must still work.
    it('still authenticates when Redis is unavailable', async () => {
      redis.get.mockRejectedValue(new Error('redis down'));
      redis.set.mockRejectedValue(new Error('redis down'));
      stubGetUser(ok);

      await expect(guard.canActivate(ctxFor(tokenExpiringIn(3600)))).resolves.toBe(true);
    });
  });
});

/**
 * Local ES256 verification — the fix for 8-15s page loads.
 *
 * Every request used to call supabase.auth.getUser(), a round trip to
 * Singapore from Oregon measured at 0.5-1.3s. A screen makes four or five
 * requests, so that alone was most of the wait. Verifying the signature
 * against the project's JWKS is local CPU work instead.
 *
 * The security contract these lock in: local verification can only make an
 * ALREADY-VALID token faster. Anything it cannot fully verify must return
 * null and fall through to getUser(), which stays the authority.
 */
describe('JwtAuthGuard — local ES256 verification', () => {
    const { generateKeyPairSync } = require('crypto');
    const realJwt = require('jsonwebtoken');

    let guard: JwtAuthGuard;
    let redis: ReturnType<typeof makeRedis>;
    let priv: any;
    let jwk: any;
    const KID = 'test-kid-1';

    beforeAll(() => {
        const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
        priv = pair.privateKey;
        jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256' };
    });

    beforeEach(() => {
        __resetJwksCacheForTests();
        redis = makeRedis();
        guard = new JwtAuthGuard(
            new Reflector(),
            { get: jest.fn().mockReturnValue('https://project.supabase.co') } as any,
            redis as any,
        );
        const logger = (guard as any).logger;
        jest.spyOn(logger, 'debug').mockImplementation(() => {});
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ keys: [jwk] }) }) as any;
    });

    const sign = (payload: any, opts: any = {}) =>
        realJwt.sign(payload, priv, { algorithm: 'ES256', keyid: KID, expiresIn: '1h', ...opts });

    const ctxFor = (token: string): any => ({
        switchToHttp: () => ({
            getRequest: () => ({ method: 'GET', url: '/api/farms', headers: { authorization: `Bearer ${token}` } }),
        }),
        getHandler: () => () => {},
        getClass: () => class {},
    });

    it('accepts a validly signed token WITHOUT calling Supabase at all', async () => {
        const getUser = jest.fn();
        (guard as any).supabase = { auth: { getUser } };

        const ctx = ctxFor(sign({ sub: 'u1', email: 'f@x.com' }));
        await expect(guard.canActivate(ctx)).resolves.toBe(true);

        // The whole point: no network round trip on the hot path.
        expect(getUser).not.toHaveBeenCalled();
        expect(redis.get).not.toHaveBeenCalled();
    });

    it('populates req.user from the token claims', async () => {
        (guard as any).supabase = { auth: { getUser: jest.fn() } };
        const req: any = { method: 'GET', url: '/api/farms', headers: { authorization: `Bearer ${sign({ sub: 'u9', email: 'a@b.c' })}` } };

        await guard.canActivate({
            switchToHttp: () => ({ getRequest: () => req }),
            getHandler: () => () => {}, getClass: () => class {},
        } as any);

        expect(req.user).toEqual({ id: 'u9', email: 'a@b.c' });
    });

    // A forged token must NOT be accepted locally. It falls through to
    // getUser(), which is still the authority and still rejects it.
    it('refuses a token signed by the wrong key', async () => {
        const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
        const forged = realJwt.sign({ sub: 'attacker' }, other.privateKey, {
            algorithm: 'ES256', keyid: KID, expiresIn: '1h',
        });
        const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
        (guard as any).supabase = { auth: { getUser } };

        await expect(guard.canActivate(ctxFor(forged))).rejects.toThrow();
        // It reached the authority rather than being waved through.
        expect(getUser).toHaveBeenCalled();
    });

    it('refuses an expired token', async () => {
        const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
        (guard as any).supabase = { auth: { getUser } };

        await expect(
            guard.canActivate(ctxFor(sign({ sub: 'u1' }, { expiresIn: '-1h' }))),
        ).rejects.toThrow();
        expect(getUser).toHaveBeenCalled();
    });

    // `alg: none` and HS256-substitution are the classic JWT attacks. Only the
    // algorithm this project actually signs with is honoured locally.
    it('refuses a token whose alg is not ES256', async () => {
        const hs = realJwt.sign({ sub: 'u1' }, 'a-shared-secret', { algorithm: 'HS256', keyid: KID });
        const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
        (guard as any).supabase = { auth: { getUser } };

        await expect(guard.canActivate(ctxFor(hs))).rejects.toThrow();
        expect(getUser).toHaveBeenCalled();
    });

    it('falls back to Supabase when the JWKS cannot be fetched', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;
        const getUser = jest.fn().mockResolvedValue({
            data: { user: { id: 'u1', email: 'f@x.com' } }, error: null,
        });
        (guard as any).supabase = { auth: { getUser } };

        await expect(guard.canActivate(ctxFor(sign({ sub: 'u1' })))).resolves.toBe(true);
        expect(getUser).toHaveBeenCalled();
    });

    // Supabase rotates signing keys; an unknown kid must refetch once rather
    // than fail every request until the process restarts.
    it('refetches the JWKS once when the kid is unknown', async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce({ json: async () => ({ keys: [] }) })
            .mockResolvedValueOnce({ json: async () => ({ keys: [jwk] }) });
        global.fetch = fetchMock as any;
        (guard as any).supabase = { auth: { getUser: jest.fn() } };

        await expect(guard.canActivate(ctxFor(sign({ sub: 'u1' })))).resolves.toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
