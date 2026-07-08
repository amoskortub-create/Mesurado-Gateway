/**
 * In-memory key/value store with TTL support.
 *
 * Provides the same interface used by rate-limiter.ts and admin-queue.ts.
 * State resets on process restart — suitable for a single-instance deployment.
 * No external dependencies, no environment variables required.
 */

interface MemEntry {
  value: string;
  expiresAt?: number;
}

const store = new Map<string, MemEntry>();

function get(key: string): string | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt && Date.now() > e.expiresAt) { store.delete(key); return null; }
  return e.value;
}

function set(key: string, value: string, exSeconds?: number): void {
  store.set(key, {
    value,
    expiresAt: exSeconds ? Date.now() + exSeconds * 1_000 : undefined,
  });
}

function del(key: string): void {
  store.delete(key);
}

function incr(key: string): number {
  const cur = parseInt(get(key) ?? '0', 10);
  const next = cur + 1;
  const existing = store.get(key);
  store.set(key, { value: String(next), expiresAt: existing?.expiresAt });
  return next;
}

function expire(key: string, seconds: number): void {
  const e = store.get(key);
  if (e) e.expiresAt = Date.now() + seconds * 1_000;
}

function ttl(key: string): number {
  const e = store.get(key);
  if (!e || !e.expiresAt) return -1;
  return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1_000));
}

// Sweep expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of store) {
    if (e.expiresAt && now > e.expiresAt) store.delete(k);
  }
}, 120_000).unref();

export const redis = {
  async get(key: string) { return get(key); },
  async set(key: string, value: string, exSeconds?: number) { set(key, value, exSeconds); },
  async del(key: string) { del(key); },
  async incr(key: string) { return incr(key); },
  async expire(key: string, seconds: number) { expire(key, seconds); },
  async ttl(key: string) { return ttl(key); },
};

export const REDIS_AVAILABLE = true; // always available — in-memory
