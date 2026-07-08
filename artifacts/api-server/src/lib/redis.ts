/**
 * Upstash Redis REST client with in-memory fallback.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, all
 * operations hit Redis — safe for multi-instance deployments.
 *
 * When those vars are absent (or Redis is unreachable), falls back to an
 * in-memory Map. Rate-limit state resets on process restart and is not
 * shared across instances. Document this limitation to operators.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const REDIS_AVAILABLE = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

if (!REDIS_AVAILABLE) {
  console.warn(
    '[redis] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory fallback. ' +
    'Rate limits and queue state will reset on process restart and are not ' +
    'shared across instances. Set Upstash credentials for production reliability.',
  );
}

// ─── Upstash REST helper ─────────────────────────────────────────────────────

async function upstashCmd(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(4_000),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const json = (await res.json()) as { result: unknown; error?: string };
  if (json.error) throw new Error(`Upstash error: ${json.error}`);
  return json.result;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

interface MemEntry {
  value: string;
  expiresAt?: number;
}

const memStore = new Map<string, MemEntry>();

function memClean() {
  const now = Date.now();
  for (const [k, e] of memStore) {
    if (e.expiresAt && now > e.expiresAt) memStore.delete(k);
  }
}

function memGet(key: string): string | null {
  const e = memStore.get(key);
  if (!e) return null;
  if (e.expiresAt && Date.now() > e.expiresAt) { memStore.delete(key); return null; }
  return e.value;
}

function memSet(key: string, value: string, exSeconds?: number): void {
  memStore.set(key, {
    value,
    expiresAt: exSeconds ? Date.now() + exSeconds * 1_000 : undefined,
  });
}

function memIncr(key: string): number {
  const cur = parseInt(memGet(key) ?? '0', 10);
  const next = cur + 1;
  const existing = memStore.get(key);
  memStore.set(key, { value: String(next), expiresAt: existing?.expiresAt });
  return next;
}

function memDecr(key: string): number {
  const cur = parseInt(memGet(key) ?? '0', 10);
  const next = Math.max(0, cur - 1);
  const existing = memStore.get(key);
  memStore.set(key, { value: String(next), expiresAt: existing?.expiresAt });
  return next;
}

function memExpire(key: string, seconds: number): void {
  const e = memStore.get(key);
  if (e) e.expiresAt = Date.now() + seconds * 1_000;
}

function memTtl(key: string): number {
  const e = memStore.get(key);
  if (!e || !e.expiresAt) return -1;
  const remaining = Math.ceil((e.expiresAt - Date.now()) / 1_000);
  return Math.max(0, remaining);
}

// Run cleanup every 2 minutes
setInterval(memClean, 120_000).unref();

// ─── Unified interface ───────────────────────────────────────────────────────

export const redis = {
  async get(key: string): Promise<string | null> {
    if (!REDIS_AVAILABLE) return memGet(key);
    try { return (await upstashCmd(['GET', key])) as string | null; }
    catch { return memGet(key); }
  },

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (!REDIS_AVAILABLE) { memSet(key, value, exSeconds); return; }
    try {
      if (exSeconds) await upstashCmd(['SET', key, value, 'EX', exSeconds]);
      else await upstashCmd(['SET', key, value]);
    } catch { memSet(key, value, exSeconds); }
  },

  async del(key: string): Promise<void> {
    if (!REDIS_AVAILABLE) { memStore.delete(key); return; }
    try { await upstashCmd(['DEL', key]); }
    catch { memStore.delete(key); }
  },

  async incr(key: string): Promise<number> {
    if (!REDIS_AVAILABLE) return memIncr(key);
    try { return (await upstashCmd(['INCR', key])) as number; }
    catch { return memIncr(key); }
  },

  async decr(key: string): Promise<number> {
    if (!REDIS_AVAILABLE) return memDecr(key);
    try { return (await upstashCmd(['DECR', key])) as number; }
    catch { return memDecr(key); }
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (!REDIS_AVAILABLE) { memExpire(key, seconds); return; }
    try { await upstashCmd(['EXPIRE', key, seconds]); }
    catch { memExpire(key, seconds); }
  },

  async ttl(key: string): Promise<number> {
    if (!REDIS_AVAILABLE) return memTtl(key);
    try { return (await upstashCmd(['TTL', key])) as number; }
    catch { return memTtl(key); }
  },
};
