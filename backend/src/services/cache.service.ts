/**
 * Cache service — a small TTL cache behind a clean, async, Redis-shaped
 * interface.
 *
 * Two interchangeable backings implement the same `CacheStore` contract:
 *   • InMemoryCache — an in-process Map. Zero dependencies; perfect for dev and
 *     single-node deployments. This is the default.
 *   • RedisCache    — a shared Redis store so multiple app instances hit one
 *     cache. Selected automatically when REDIS_URL is set.
 *
 * `wrap()` implements the cache-aside pattern: return the cached value or run
 * the producer, cache its result, and return it. The Redis backing degrades to
 * a cache-miss on any Redis error, so an outage means "uncached", never a 500.
 */
import Redis from "ioredis";
import { CACHE_TTL, FEATURES } from "../config/constants";
import env from "../config/env";

interface CacheStats {
  size: number; // -1 when the backing cannot report it cheaply (Redis)
  hits: number;
  misses: number;
  hitRate: number;
}

interface CacheStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<T>;
  del(key: string): Promise<boolean>;
  /** Invalidate every key sharing a prefix, e.g. "policies:". */
  delByPrefix(prefix: string): Promise<number>;
  clear(): Promise<void>;
  /** Cache-aside: return cached value or produce, cache and return it. */
  wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T> | T): Promise<T>;
  stats(): CacheStats;
  /** Readiness probe: true when the backing is reachable. */
  health(): Promise<boolean>;
}

// Shared cache-aside so both backings behave identically at the wrap layer.
async function wrapWith<T>(
  store: Pick<CacheStore, "get" | "set">,
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T> | T
): Promise<T> {
  if (!FEATURES.RESPONSE_CACHE) return producer();
  const cached = await store.get<T>(key);
  if (cached !== undefined) return cached;
  const value = await producer();
  // Never cache null/undefined — avoids pinning transient failures.
  if (value !== null && value !== undefined) await store.set(key, value, ttlSeconds);
  return value;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class InMemoryCache implements CacheStore {
  private store: Map<string, CacheEntry> = new Map();
  private hits = 0;
  private misses = 0;
  private sweeper: NodeJS.Timeout;

  constructor() {
    // Periodic sweep of expired keys so the map cannot grow unbounded.
    this.sweeper = setInterval(() => this.sweep(), 60 * 1000);
    if (this.sweeper.unref) this.sweeper.unref();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = CACHE_TTL.DEFAULT): Promise<T> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return value;
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async delByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        n++;
      }
    }
    return n;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T> | T): Promise<T> {
    return wrapWith<T>(this, key, ttlSeconds, producer);
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? +(this.hits / total).toFixed(3) : 0,
    };
  }

  async health(): Promise<boolean> {
    return true; // in-process store is always available
  }
}

// All keys live under one namespace so delByPrefix/clear only ever touch this
// app's entries — never anything else sharing the Redis instance.
const NS = "aegis:cache:";

class RedisCache implements CacheStore {
  private redis: Redis;
  private hits = 0;
  private misses = 0;
  private errorLogged = false;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    this.redis.on("error", (err: Error) => {
      // Log once per outage rather than on every reconnect attempt.
      if (!this.errorLogged) {
        console.error("[cache] Redis unavailable — serving uncached:", err.message);
        this.errorLogged = true;
      }
    });
    this.redis.on("ready", () => {
      this.errorLogged = false;
      console.log("[cache] Redis connected.");
    });
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(NS + key);
      if (raw == null) {
        this.misses++;
        return undefined;
      }
      this.hits++;
      return JSON.parse(raw) as T;
    } catch {
      this.misses++;
      return undefined; // degrade to a miss — never surface a Redis error
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = CACHE_TTL.DEFAULT): Promise<T> {
    try {
      await this.redis.set(NS + key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      /* best-effort — a failed write just means the next read is a miss */
    }
    return value;
  }

  async del(key: string): Promise<boolean> {
    try {
      return (await this.redis.del(NS + key)) > 0;
    } catch {
      return false;
    }
  }

  async delByPrefix(prefix: string): Promise<number> {
    return this.scanDel(`${NS}${prefix}*`);
  }

  async clear(): Promise<void> {
    await this.scanDel(`${NS}*`);
  }

  // Non-blocking cursor scan + batched delete — never uses KEYS (which blocks
  // the Redis event loop) and only matches this app's namespace.
  private async scanDel(match: string): Promise<number> {
    let removed = 0;
    let cursor = "0";
    try {
      do {
        const [next, keys] = await this.redis.scan(cursor, "MATCH", match, "COUNT", 200);
        cursor = next;
        if (keys.length) {
          await this.redis.del(...keys);
          removed += keys.length;
        }
      } while (cursor !== "0");
    } catch {
      /* best-effort */
    }
    return removed;
  }

  wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T> | T): Promise<T> {
    return wrapWith<T>(this, key, ttlSeconds, producer);
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: -1, // reporting Redis size cheaply isn't possible; -1 = n/a
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? +(this.hits / total).toFixed(3) : 0,
    };
  }

  async health(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}

// Pick the backing once at boot. REDIS_URL present → shared Redis; else the
// in-process store. The rest of the app depends only on the CacheStore contract.
const cache: CacheStore = env.REDIS_URL ? new RedisCache(env.REDIS_URL) : new InMemoryCache();
if (env.REDIS_URL) console.log("[cache] Using Redis backing.");

export = cache;
