import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';

/** How often the in-memory fallback drops keys whose TTL has passed. */
const MEMORY_SWEEP_INTERVAL_MS = 60_000;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private memoryStore: Map<string, { value: string; expiresAt: number }> =
    new Map();
  private memorySweep: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(RedisService.name);
  private useMemory = false;

  constructor(private configService: ConfigService) {}

  /**
   * True when Redis is unreachable and the service is running on the in-memory
   * fallback — shared 2FA temp-tokens / nonce replay-protection then hold only
   * per-instance (safe on Render's single free instance, degraded if scaled).
   * Surfaced in the health check so ops can see the degraded mode.
   */
  get isMemoryFallback(): boolean {
    return this.useMemory;
  }

  async onModuleInit() {
    // REDIS_URL is what render.yaml provisions and .env.example documents, so
    // it has to win. This service only ever read REDIS_HOST/REDIS_PORT, which
    // nothing sets — production therefore dialled localhost, failed, and ran
    // silently on the per-process memory fallback. Host/port stay as the
    // fallback for anyone whose local setup uses them.
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    const options: RedisOptions = {
      lazyConnect: true,
      // Keep retrying indefinitely (capped backoff) instead of giving up after
      // 3 tries — a transient outage should self-heal once Redis comes back
      // rather than pinning the process on the in-memory fallback forever.
      retryStrategy: (times) => {
        if (times > 3) {
          this.enableMemoryFallback(
            'Redis connection failed, switching to in-memory store.',
          );
        }
        return Math.min(times * 50, 5000);
      },
    };

    try {
      this.client = redisUrl
        ? new Redis(redisUrl, options)
        : new Redis({ ...options, host: redisHost, port: redisPort });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis client error: ${err.message}`);
      });
      this.client.on('ready', () => this.handleReconnect());

      await this.client.connect().catch(() => {
        this.enableMemoryFallback(
          'Initial Redis connection failed, using in-memory store.',
        );
      });
    } catch (e) {
      this.enableMemoryFallback(
        'Redis client initialization failed, utilizing in-memory store.',
      );
    }
  }

  /**
   * Switch to the in-memory store and, in production, warn loudly (INFRA-1):
   * the memory store is per-process, so 2FA temp tokens and Truecaller nonce
   * replay protection are scoped to a single instance. Safe on one instance;
   * BROKEN if the service is scaled horizontally (tokens/nonces minted on one
   * instance won't be seen by another).
   */
  private enableMemoryFallback(reason: string): void {
    if (this.useMemory) return; // warn once
    this.useMemory = true;
    this.startMemorySweep();
    this.logger.warn(reason);
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'Redis unavailable in PRODUCTION — using per-instance in-memory store. ' +
          '2FA temp tokens and Truecaller nonce replay protection are now per-instance: ' +
          'safe on a single instance, BROKEN if scaled to multiple instances. ' +
          'Provision Redis before scaling horizontally.',
      );
    }
  }

  /** Redis reconnected ('ready' event) — stop serving from the memory fallback. */
  private handleReconnect(): void {
    if (this.useMemory) {
      this.useMemory = false;
      this.stopMemorySweep();
      this.memoryStore.clear();
      this.logger.log('Redis reconnected — leaving in-memory fallback.');
    }
  }

  /**
   * Expire memory-store keys on a timer, not only when someone reads them.
   * `get` alone is not enough: a 2FA temp token or Truecaller nonce that is
   * minted and never read again would sit in the Map for the life of the
   * process, which on a 512MB instance is an unbounded leak.
   */
  private startMemorySweep(): void {
    if (this.memorySweep) return;
    this.memorySweep = setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.memoryStore) {
        if (item.expiresAt < now) this.memoryStore.delete(key);
      }
    }, MEMORY_SWEEP_INTERVAL_MS);
    // Don't hold the event loop open — this timer must never keep a process
    // (or a Jest worker) alive on its own.
    this.memorySweep.unref?.();
  }

  private stopMemorySweep(): void {
    if (!this.memorySweep) return;
    clearInterval(this.memorySweep);
    this.memorySweep = null;
  }

  async onModuleDestroy() {
    this.stopMemorySweep();
    await this.client?.quit().catch(() => undefined);
  }

  async set(
    key: string,
    value: string,
    mode?: 'EX',
    duration?: number,
  ): Promise<void> {
    if (this.useMemory || !this.client) {
      const expiresAt = duration ? Date.now() + duration * 1000 : Infinity;
      this.memoryStore.set(key, { value, expiresAt });
      return;
    }
    if (mode === 'EX' && duration) {
      await this.client.set(key, value, 'EX', duration);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.useMemory || !this.client) {
      const item = this.memoryStore.get(key);
      if (!item) return null;
      if (item.expiresAt < Date.now()) {
        this.memoryStore.delete(key);
        return null;
      }
      return item.value;
    }
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    if (this.useMemory || !this.client) {
      this.memoryStore.delete(key);
      return;
    }
    await this.client.del(key);
  }
}
