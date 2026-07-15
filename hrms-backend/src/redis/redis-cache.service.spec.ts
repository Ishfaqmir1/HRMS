import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';

const DEFAULT_TTL = 3600;

// Mock ioredis module — the service calls `new Redis({...})` in its constructor
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    scanStream: jest.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield [];
      },
    }),
    quit: jest.fn(),
    status: 'ready',
  }));
});

describe('RedisCacheService', () => {
  let cacheService: RedisCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                'redis.host': 'localhost',
                'redis.port': 6379,
                'redis.password': undefined,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    cacheService = module.get<RedisCacheService>(RedisCacheService);
  });

  it('should be defined', () => {
    expect(cacheService).toBeDefined();
  });

  describe('get', () => {
    it('should return null when key does not exist', async () => {
      // With mock Redis, get() returns null/undefined — service falls to in-memory cache
      const result = await cacheService.get('nonexistent-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store and retrieve data with TTL', async () => {
      const testData = { id: '1', name: 'test' };

      await cacheService.set('test-key', testData, DEFAULT_TTL);

      // Since mock Redis is connected, it calls this.redis.setex internally
      // We can verify by retrieving the value from in-memory cache
      const result = await cacheService.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should store complex nested objects', async () => {
      const complexData = {
        user: { name: 'John', roles: ['admin', 'manager'] },
        metadata: { version: 2, tags: ['a', 'b'] },
      };

      await cacheService.set('complex-key', complexData, DEFAULT_TTL);

      const result = await cacheService.get('complex-key');
      expect(result).toEqual(complexData);
    });

    it('should store and retrieve null values', async () => {
      await cacheService.set('null-key', null, DEFAULT_TTL);

      const result = await cacheService.get('null-key');
      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      // First set a value
      await cacheService.set('delete-key', 'test-value', DEFAULT_TTL);
      let result = await cacheService.get('delete-key');
      expect(result).toBe('test-value');

      // Then delete it
      await cacheService.del('delete-key');
      result = await cacheService.get('delete-key');
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(cacheService.del('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('delPattern', () => {
    it('should delete all keys matching a pattern', async () => {
      await cacheService.set('user:1', 'data1', DEFAULT_TTL);
      await cacheService.set('user:2', 'data2', DEFAULT_TTL);
      await cacheService.set('other:1', 'data3', DEFAULT_TTL);

      await cacheService.delPattern('user:*');

      const result1 = await cacheService.get('user:1');
      const result2 = await cacheService.get('user:2');
      const result3 = await cacheService.get('other:1');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe('data3');
    });

    it('should handle no matching keys', async () => {
      await expect(cacheService.delPattern('nonexistent:*')).resolves.not.toThrow();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value when available', async () => {
      await cacheService.set('cached-key', 'cached-value', DEFAULT_TTL);
      const factory = jest.fn().mockResolvedValue('new-value');

      const result = await cacheService.getOrSet('cached-key', DEFAULT_TTL, factory);

      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should compute and cache value when not in cache', async () => {
      const factory = jest.fn().mockResolvedValue('computed-value');

      const result = await cacheService.getOrSet('new-key', DEFAULT_TTL, factory);

      expect(result).toBe('computed-value');
      expect(factory).toHaveBeenCalledTimes(1);

      // Second call should return cached value
      const result2 = await cacheService.getOrSet('new-key', DEFAULT_TTL, factory);
      expect(result2).toBe('computed-value');
      expect(factory).toHaveBeenCalledTimes(1); // factory not called again
    });
  });

  describe('getTtl', () => {
    it('should return 0 for non-existent key', async () => {
      const ttl = await cacheService.getTtl('nonexistent');
      expect(ttl).toBe(0);
    });

    it('should return remaining TTL for existing key', async () => {
      await cacheService.set('ttl-key', 'value', 3600);

      const ttl = await cacheService.getTtl('ttl-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe('clearMemoryCache', () => {
    it('should clear all in-memory entries', async () => {
      await cacheService.set('key1', 'val1', DEFAULT_TTL);
      await cacheService.set('key2', 'val2', DEFAULT_TTL);

      cacheService.clearMemoryCache();

      const result1 = await cacheService.get('key1');
      const result2 = await cacheService.get('key2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });
});
