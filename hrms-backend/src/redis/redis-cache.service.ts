import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis | null = null;
  private isConnected = false;

  /** In-memory fallback map when Redis is unavailable */
  private readonly memoryCache = new Map<string, CacheEntry<any>>();

  private readonly cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private configService: ConfigService) {
    try {
      const host = this.configService.get<string>('redis.host')!;
      const port = this.configService.get<number>('redis.port')!;
      const password = this.configService.get<string | undefined>('redis.password');

      if (host && port) {
        this.redis = new Redis({
          host,
          port,
          password,
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed after 3 retries — using in-memory cache fallback.');
              return null; // stop retrying
            }
            return Math.min(times * 200, 1000);
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        this.redis.on('connect', () => {
          this.isConnected = true;
          this.logger.log('Connected to Redis');
        });

        this.redis.on('error', (err) => {
          this.isConnected = false;
          this.logger.warn('Redis connection error: ' + err.message);
        });

        this.redis.on('close', () => {
          this.isConnected = false;
        });

        // Connect lazily
        this.redis.connect().catch((err) => {
          this.logger.warn('Redis connection failed: ' + err.message);
        });
      } else {
        this.logger.log('Redis not configured — using in-memory cache fallback.');
      }
    } catch (err) {
      this.logger.warn('Redis initialization failed — using in-memory cache fallback: ' + (err as Error).message);
    }

    // Periodic cleanup of expired in-memory cache entries (every 60s)
    this.cleanupTimer = setInterval(() => this.sweepExpiredEntries(), 60_000);
    // Allow the timer to not block process exit in tests
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      (this.cleanupTimer as any).unref();
    }
  }

  /**
   * Get a cached value by key. Returns null if not found or cache unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.redis && this.isConnected) {
      try {
        const value = await this.redis.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    // Fallback to in-memory cache
    return this.memoryGet<T>(key);
  }

  /**
   * Set a cached value with a TTL in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.redis && this.isConnected) {
      try {
        const serialized = JSON.stringify(value);
        await this.redis.setex(key, ttlSeconds, serialized);
        return;
      } catch {
        // silently fail — cache is best-effort
      }
    }
    // Fallback to in-memory cache
    this.memorySet(key, value, ttlSeconds);
  }

  /**
   * Get the remaining TTL of a key in seconds. Returns 0 if key doesn't exist.
   */
  async getTtl(key: string): Promise<number> {
    if (this.redis && this.isConnected) {
      try {
        return await this.redis.ttl(key);
      } catch {
        return 0;
      }
    }
    // In-memory fallback
    const entry = this.memoryCache.get(key);
    if (!entry) return 0;
    return Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000));
  }

  /**
   * Delete a key (for cache invalidation).
   */
  async del(key: string): Promise<void> {
    if (this.redis && this.isConnected) {
      try {
        await this.redis.del(key);
      } catch {
        // silently fail
      }
    }
    this.memoryCache.delete(key);
  }

  /**
   * Delete all keys matching a pattern (e.g. "analytics:*").
   * Pattern matching with * works for both Redis and in-memory cache.
   */
  async delPattern(pattern: string): Promise<void> {
    if (this.redis && this.isConnected) {
      try {
        const stream = this.redis.scanStream({ match: pattern, count: 100 });
        for await (const keys of stream) {
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      } catch {
        // silently fail
      }
    }
    // Also clear matching in-memory entries
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Helper: get from cache or compute and cache the result.
   * Returns a cached value if available, otherwise calls the factory function,
   * caches the result, and returns it.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Build a cache key for a service method.
   */
  static key(prefix: string, ...parts: (string | number | undefined)[]): string {
    const valid = parts.filter((p) => p !== undefined && p !== null);
    return `${prefix}:${valid.join(':')}`;
  }

  // ---- In-memory fallback methods ----

  private memoryGet<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private memorySet(key: string, value: unknown, ttlSeconds: number): void {
    // Cap in-memory cache at 500 entries to prevent memory leak
    if (this.memoryCache.size >= 500) {
      // Evict oldest entry
      const oldest = this.memoryCache.keys().next().value;
      if (oldest) this.memoryCache.delete(oldest);
    }
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Clear all in-memory cache entries (for testing).
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Periodically sweep and remove expired in-memory cache entries
   * to prevent memory bloat.
   */
  private sweepExpiredEntries(): void {
    const now = Date.now();
    let expired = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
        expired++;
      }
    }
    if (expired > 0) {
      this.logger.debug(`Swept ${expired} expired in-memory cache entries`);
    }
  }

  /**
   * Clean up the interval timer on shutdown.
   */
  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
