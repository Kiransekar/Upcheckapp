import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

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
