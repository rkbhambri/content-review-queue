import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Minimal TTL cache for hot read paths (available ticket lists, metrics).
 *
 * Deliberately dependency-free and in-process: it is the right tool for a
 * single-instance deployment and keeps the infra surface small. For multiple
 * backend replicas this would move to a shared store (see README roadmap).
 */
@Injectable()
export class InMemoryCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Read-through helper: returns the cached value or computes and stores it. */
  async wrap<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Invalidate a single key or every key sharing a prefix. */
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}
