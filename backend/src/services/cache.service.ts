/**
 * Cache service — a small, dependency-free TTL cache behind a clean interface.
 *
 * Today it is an in-process Map (perfect for a single node and for development).
 * The interface (`get`/`set`/`del`/`wrap`/`clear`/`delByPrefix`) is deliberately
 * Redis-shaped, so swapping the backing store for Redis/Memcached at scale is a
 * one-file change with no call-site edits.
 *
 * `wrap()` implements the cache-aside pattern: return the cached value or run the
 * producer, cache its result, and return it — eliminating duplicated processing
 * and repeated DB/AI work for hot, rarely-changing data.
 */
import { CACHE_TTL, FEATURES } from "../config/constants";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class InMemoryCache {
  private store: Map<string, CacheEntry>;
  private hits: number;
  private misses: number;
  private _sweeper: NodeJS.Timeout;

  constructor() {
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
    // Periodic sweep of expired keys so the map cannot grow unbounded.
    this._sweeper = setInterval(() => this._sweep(), 60 * 1000);
    if (this._sweeper.unref) this._sweeper.unref();
  }

  private _sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  get(key: string): unknown {
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
    return entry.value;
  }

  set<T>(key: string, value: T, ttlSeconds = CACHE_TTL.DEFAULT): T {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return value;
  }

  del(key: string): boolean {
    return this.store.delete(key);
  }

  /** Invalidate every key sharing a prefix, e.g. "policies:". */
  delByPrefix(prefix: string): number {
    let n = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        n++;
      }
    }
    return n;
  }

  clear(): void {
    this.store.clear();
  }

  /** Cache-aside: return cached value or produce, cache and return it. */
  async wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T> | T): Promise<T> {
    if (!FEATURES.RESPONSE_CACHE) return producer();
    const cached = this.get(key);
    if (cached !== undefined) return cached as T;
    const value = await producer();
    // Never cache null/undefined — avoids pinning transient failures.
    if (value !== null && value !== undefined) this.set(key, value, ttlSeconds);
    return value;
  }

  stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? +(this.hits / total).toFixed(3) : 0,
    };
  }
}

export = new InMemoryCache();
