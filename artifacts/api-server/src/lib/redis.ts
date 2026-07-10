/**
 * Appwrite-backed key/value store with TTL support.
 *
 * An in-memory write-through cache is the hot path (fast, atomic for
 * single-instance deployments). All mutations are also persisted to the
 * Appwrite collection 'rate_limit_store' so state survives process restarts.
 *
 * On startup the cache is populated from Appwrite — no state is lost
 * across deploys or Replit VM restarts.
 */
import { DatabasesIndexType } from 'node-appwrite';
import { createAdminClient, DATABASE_ID, ID, Query } from './appwrite.js';

const COLLECTION_ID = 'rate_limit_store';

interface MemEntry {
  value: string;
  expiresAt?: number; // Date.now() ms
}

// ─── In-memory hot cache ──────────────────────────────────────────────────────

const store = new Map<string, MemEntry>();

function memGet(key: string): string | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt && Date.now() > e.expiresAt) { store.delete(key); return null; }
  return e.value;
}

function memSet(key: string, value: string, exSeconds?: number): void {
  store.set(key, {
    value,
    expiresAt: exSeconds ? Date.now() + exSeconds * 1_000 : undefined,
  });
}

function memDel(key: string): void { store.delete(key); }

function memIncr(key: string): number {
  const cur = parseInt(memGet(key) ?? '0', 10);
  const next = cur + 1;
  const existing = store.get(key);
  store.set(key, { value: String(next), expiresAt: existing?.expiresAt });
  return next;
}

function memExpire(key: string, seconds: number): void {
  const e = store.get(key);
  if (e) e.expiresAt = Date.now() + seconds * 1_000;
}

function memTtl(key: string): number {
  const e = store.get(key);
  if (!e || !e.expiresAt) return -1;
  return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1_000));
}

// ─── Appwrite persistence (fire-and-forget) ───────────────────────────────────

async function awUpsert(key: string, value: string, expiresAt?: number): Promise<void> {
  try {
    const { databases } = createAdminClient();
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal('key', key),
      Query.limit(1),
    ]);
    const data: Record<string, unknown> = { value };
    if (expiresAt !== undefined) data.expires_at = new Date(expiresAt).toISOString();

    if (existing.total > 0) {
      await databases.updateDocument(DATABASE_ID, COLLECTION_ID, existing.documents[0].$id, data);
    } else {
      await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
        key,
        ...data,
      });
    }
  } catch { /* best-effort — in-memory state is the source of truth */ }
}

async function awDelete(key: string): Promise<void> {
  try {
    const { databases } = createAdminClient();
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal('key', key),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, existing.documents[0].$id);
    }
  } catch { /* best-effort */ }
}

// ─── Startup: create collection if needed + populate cache ───────────────────

async function ensureCollection(): Promise<void> {
  try {
    const { databases } = createAdminClient();
    // Try to list documents — if collection exists this succeeds
    await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [Query.limit(1)]);
  } catch (err: unknown) {
    // Collection doesn't exist — create it
    const appwriteErr = err as { code?: number };
    if (appwriteErr?.code === 404) {
      try {
        const { databases } = createAdminClient();
        await databases.createCollection(DATABASE_ID, COLLECTION_ID, 'Rate Limit Store');
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'key', 255, true);
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'value', 2048, true);
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'expires_at', 30, false);
        // Brief pause for attributes to be ready
        await new Promise(r => setTimeout(r, 1500));
        await databases.createIndex(DATABASE_ID, COLLECTION_ID, 'key_idx', DatabasesIndexType.Unique, ['key']);
        console.log('[redis] Created rate_limit_store collection in Appwrite');
      } catch (createErr) {
        console.warn('[redis] Could not create rate_limit_store collection:', createErr);
      }
    }
  }
}

async function loadFromAppwrite(): Promise<void> {
  try {
    const { databases } = createAdminClient();
    const now = new Date().toISOString();
    let loaded = 0;
    let cursor: string | undefined;

    // Paginate through all documents
    while (true) {
      const queries = cursor
        ? [Query.limit(100), Query.cursorAfter(cursor)]
        : [Query.limit(100)];
      const result = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, queries);

      for (const doc of result.documents) {
        const d = doc as unknown as { key: string; value: string; expires_at?: string };
        if (d.expires_at && d.expires_at < now) continue; // already expired
        const expiresAt = d.expires_at ? new Date(d.expires_at).getTime() : undefined;
        store.set(d.key, { value: d.value, expiresAt });
        loaded++;
      }

      if (result.documents.length < 100) break; // last page
      cursor = result.documents[result.documents.length - 1].$id;
    }

    if (loaded > 0) console.log(`[redis] Restored ${loaded} entries from Appwrite`);
  } catch (err) {
    console.warn('[redis] Could not load from Appwrite, starting with empty cache:', err);
  }
}

// ─── Sweep expired entries every 2 minutes ────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of store) {
    if (e.expiresAt && now > e.expiresAt) store.delete(k);
  }
}, 120_000).unref();

// ─── Public interface ─────────────────────────────────────────────────────────

export const redis = {
  async get(key: string) { return memGet(key); },

  async set(key: string, value: string, exSeconds?: number) {
    memSet(key, value, exSeconds);
    const expiresAt = exSeconds ? Date.now() + exSeconds * 1_000 : undefined;
    awUpsert(key, value, expiresAt); // fire-and-forget
  },

  async del(key: string) {
    memDel(key);
    awDelete(key); // fire-and-forget
  },

  async incr(key: string) {
    const val = memIncr(key);
    const e = store.get(key);
    awUpsert(key, String(val), e?.expiresAt); // fire-and-forget
    return val;
  },

  async expire(key: string, seconds: number) {
    memExpire(key, seconds);
    const e = store.get(key);
    if (e) awUpsert(key, e.value, e.expiresAt); // fire-and-forget
  },

  async ttl(key: string) { return memTtl(key); },
};

export const REDIS_AVAILABLE = true;

// Kick off startup: ensure collection exists, then load state
(async () => {
  await ensureCollection();
  await loadFromAppwrite();
})().catch(() => {});
