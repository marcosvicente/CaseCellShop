import { Redis } from "ioredis";
import type { CacheStore } from "./cache.interface.js";

export type RedisClient = Redis;

export class RedisCache implements CacheStore {
  constructor(private readonly redis: RedisClient) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, "EX", ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson<T>(
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}

export function createRedisClient(url: string): RedisClient {
  return new Redis(url, { maxRetriesPerRequest: null });
}
