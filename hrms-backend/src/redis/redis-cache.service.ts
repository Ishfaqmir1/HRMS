import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis | null = null;
  private isConnected = false;

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
              this.logger.warn('Redis connection failed after 3 retries — caching disabled.');
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
      }
    } catch (err) {
      this.logger.warn('Redis initialization failed — caching disabled: ' + (err as Error).message);
    }
  }

  /**
   * Get a cached value by key. Returns null if not found or Redis unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis || !this.isConnected) return null;
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a cached value with a TTL in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis || !this.isConnected) return;
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
    } catch {
      // silently fail — cache is best-effort
    }
  }

  /**
   * Get the remaining TTL of a key in seconds. Returns 0 if key doesn't exist.
   */
  async getTtl(key: string): Promise<number> {
    if (!this.redis || !this.isConnected) return 0;
    try {
      return await this.redis.ttl(key);
    } catch {
      return 0;
    }
  }

  /**
   * Delete a key (for cache invalidation).
   */
  async del(key: string): Promise<void> {
    if (!this.redis || !this.isConnected) return;
    try {
      await this.redis.del(key);
    } catch {
      // silently fail
    }
  }

  /**
   * Delete all keys matching a pattern (e.g. "analytics:*").
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.redis || !this.isConnected) return;
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
}
