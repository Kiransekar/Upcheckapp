import Redis from 'ioredis';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => {
  const ctor = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
  return { __esModule: true, default: ctor };
});

/** INFRA-1: warn loudly when Redis is absent in production. */
describe('RedisService — in-memory fallback warning (INFRA-1)', () => {
  const OLD_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  function makeService() {
    const service = new RedisService({ get: jest.fn() } as any);
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => {});
    return { service, warnSpy };
  }

  it('warns about per-instance scope when falling back in production', () => {
    process.env.NODE_ENV = 'production';
    const { service, warnSpy } = makeService();
    (service as any).enableMemoryFallback('Redis down');
    const all = warnSpy.mock.calls.flat().join(' ');
    expect(all).toMatch(/per-instance/i);
    expect(all).toMatch(/2FA|Truecaller/);
  });

  it('does not emit the production warning in dev', () => {
    process.env.NODE_ENV = 'development';
    const { service, warnSpy } = makeService();
    (service as any).enableMemoryFallback('Redis down');
    const all = warnSpy.mock.calls.flat().join(' ');
    expect(all).not.toMatch(/per-instance/i);
  });

  it('falls back to the memory store for get/set once enabled', async () => {
    const { service } = makeService();
    (service as any).enableMemoryFallback('Redis down');
    await service.set('k', 'v');
    expect(await service.get('k')).toBe('v');
  });

  it('clears the fallback flag once Redis recovers (AUDIT id 109)', () => {
    const { service } = makeService();
    (service as any).enableMemoryFallback('Redis down');
    expect(service.isMemoryFallback).toBe(true);
    // 'ready' event handler registered in onModuleInit calls this.
    (service as any).handleReconnect();
    expect(service.isMemoryFallback).toBe(false);
  });
});

/**
 * REDIS_URL is the variable render.yaml provisions; reading only
 * REDIS_HOST/REDIS_PORT meant production dialled localhost and ran on the
 * memory fallback forever.
 */
describe('RedisService — connection config', () => {
  const RedisCtor = Redis as unknown as jest.Mock;
  beforeEach(() => RedisCtor.mockClear());

  const serviceWith = (env: Record<string, unknown>) =>
    new RedisService({
      get: jest.fn((key: string, fallback?: unknown) =>
        key in env ? env[key] : fallback,
      ),
    } as any);

  it('dials REDIS_URL when it is set', async () => {
    const service = serviceWith({ REDIS_URL: 'rediss://user:pw@host:6380' });
    await service.onModuleInit();
    expect(RedisCtor).toHaveBeenCalledWith(
      'rediss://user:pw@host:6380',
      expect.objectContaining({ lazyConnect: true }),
    );
    await service.onModuleDestroy();
  });

  it('falls back to host/port when REDIS_URL is absent', async () => {
    const service = serviceWith({ REDIS_HOST: 'cache', REDIS_PORT: 6380 });
    await service.onModuleInit();
    expect(RedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'cache', port: 6380 }),
    );
    await service.onModuleDestroy();
  });
});

/** The memory fallback must expire keys on a timer, not only on read. */
describe('RedisService — memory fallback expiry sweep', () => {
  it('drops an expired key nobody ever reads', () => {
    jest.useFakeTimers();
    try {
      const service = new RedisService({ get: jest.fn() } as any);
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
      (service as any).enableMemoryFallback('Redis down');
      void service.set('nonce', 'v', 'EX', 1);
      expect((service as any).memoryStore.size).toBe(1);

      jest.advanceTimersByTime(61_000);
      expect((service as any).memoryStore.size).toBe(0);
      (service as any).stopMemorySweep();
    } finally {
      jest.useRealTimers();
    }
  });
});
