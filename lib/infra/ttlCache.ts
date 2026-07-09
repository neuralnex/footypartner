import { LOAD_CONFIG } from './loadConfig';

interface Entry<T> {
  value: T;
  expiresAt: number;
  lastAccess: number;
}

class TtlCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) {
      hit.lastAccess = now;
      return hit.value as T;
    }

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = factory()
      .then((value) => {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs, lastAccess: Date.now() });
        this.inflight.delete(key);
        this.evictIfNeeded();
        return value;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise as Promise<T>;
  }

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= Date.now()) return undefined;
    hit.lastAccess = Date.now();
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, lastAccess: Date.now() });
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    const max = LOAD_CONFIG.cacheMaxEntries;
    if (this.store.size <= max) return;

    const victims = [...this.store.entries()]
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
      .slice(0, this.store.size - max);

    for (const [key] of victims) this.store.delete(key);
  }
}

declare global {

  var __fpTtlCache: TtlCache | undefined;
}

export const txlineCache = globalThis.__fpTtlCache ?? new TtlCache();
if (process.env.NODE_ENV !== 'production') globalThis.__fpTtlCache = txlineCache;
