#!/usr/bin/env tsx
/**
 * Provision Appwrite collections for the Mesurado rate-limiting system.
 *
 * Creates (idempotently):
 *   - rate_limits          (per-user, per-window request counters)
 *   - gatekeeper_slots     (single "global" concurrency document)
 *   - request_queue        (reserved for future async-queue support)
 *   - rate_limit_overrides (per-user admin-set limits)
 *   - rate_limit_store     (existing — ensures it exists, no-op if present)
 *
 * Also adds the `total_tokens` attribute to existing `usage_logs`.
 *
 * Safe to run multiple times — 409 "already exists" errors are silently ignored.
 *
 * Run:
 *   pnpm --filter @workspace/api-server exec tsx ../../scripts/provision-appwrite-collections.ts
 */

import { Client, Databases, ID, Query } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://mediatechliberia.online/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID ?? 'mesurado01';
const API_KEY  = process.env.APPWRITE_API_KEY;
const DB_ID    = process.env.APPWRITE_DATABASE_ID ?? 'mesurado';

if (!API_KEY) {
  console.error('APPWRITE_API_KEY env var is not set');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const db = new Databases(client);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeCreate<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn();
    console.log(`  ✓ ${label}`);
    return result;
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 409) {
      console.log(`  ↷ ${label} (already exists)`);
      return null;
    }
    if (e?.code === 404) {
      console.log(`  ↷ ${label} (not found — skipping)`);
      return null;
    }
    console.warn(`  ✗ ${label}: ${e?.message ?? String(err)}`);
    return null;
  }
}

async function waitForAttributes(collectionId: string, attrCount: number, maxWaitMs = 15_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const list = await db.listAttributes(DB_ID, collectionId);
      const ready = list.attributes.filter((a: { status?: string }) => a.status === 'available').length;
      if (ready >= attrCount) return;
      console.log(`    waiting for attributes (${ready}/${attrCount} ready)…`);
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.warn(`    timed out waiting for attributes on ${collectionId}`);
}

// ─── 1. rate_limits ───────────────────────────────────────────────────────────

console.log('\n[1/5] rate_limits');

await safeCreate('collection', () =>
  db.createCollection(DB_ID, 'rate_limits', 'Rate Limits')
);

await safeCreate('attr: user_id', () =>
  db.createStringAttribute(DB_ID, 'rate_limits', 'user_id', 255, true)
);
await safeCreate('attr: window_start', () =>
  db.createStringAttribute(DB_ID, 'rate_limits', 'window_start', 30, true)
);
await safeCreate('attr: request_count', () =>
  db.createIntegerAttribute(DB_ID, 'rate_limits', 'request_count', true)
);
await safeCreate('attr: window_expires', () =>
  db.createStringAttribute(DB_ID, 'rate_limits', 'window_expires', 30, true)
);

await waitForAttributes('rate_limits', 4);

await safeCreate('index: user_window_idx', () =>
  db.createIndex(DB_ID, 'rate_limits', 'user_window_idx', 'key', ['user_id', 'window_start'])
);
await safeCreate('index: user_id_idx', () =>
  db.createIndex(DB_ID, 'rate_limits', 'user_id_idx', 'key', ['user_id'])
);
await safeCreate('index: window_expires_idx', () =>
  db.createIndex(DB_ID, 'rate_limits', 'window_expires_idx', 'key', ['window_expires'])
);

// ─── 2. gatekeeper_slots ─────────────────────────────────────────────────────

console.log('\n[2/5] gatekeeper_slots');

await safeCreate('collection', () =>
  db.createCollection(DB_ID, 'gatekeeper_slots', 'Gatekeeper Slots')
);

await safeCreate('attr: slot_id', () =>
  db.createStringAttribute(DB_ID, 'gatekeeper_slots', 'slot_id', 255, true)
);
await safeCreate('attr: active_count', () =>
  db.createIntegerAttribute(DB_ID, 'gatekeeper_slots', 'active_count', true, 0)
);
await safeCreate('attr: max_count', () =>
  db.createIntegerAttribute(DB_ID, 'gatekeeper_slots', 'max_count', true, 0)
);
await safeCreate('attr: updated_at', () =>
  db.createStringAttribute(DB_ID, 'gatekeeper_slots', 'updated_at', 30, true)
);

await waitForAttributes('gatekeeper_slots', 4);

// Create the single "global" document (idempotent via custom document ID)
const MAX_SLOTS = Number(process.env.MAX_CONCURRENT_GATEKEEPER ?? 3);
await safeCreate('global slot document', () =>
  db.createDocument(DB_ID, 'gatekeeper_slots', 'global', {
    slot_id: 'global',
    active_count: 0,
    max_count: MAX_SLOTS,
    updated_at: new Date().toISOString(),
  })
);

// ─── 3. request_queue ─────────────────────────────────────────────────────────

console.log('\n[3/5] request_queue');

await safeCreate('collection', () =>
  db.createCollection(DB_ID, 'request_queue', 'Request Queue')
);

await safeCreate('attr: request_id', () =>
  db.createStringAttribute(DB_ID, 'request_queue', 'request_id', 255, true)
);
await safeCreate('attr: user_id', () =>
  db.createStringAttribute(DB_ID, 'request_queue', 'user_id', 255, true)
);
await safeCreate('attr: status', () =>
  db.createStringAttribute(DB_ID, 'request_queue', 'status', 50, true)
);
await safeCreate('attr: payload', () =>
  db.createStringAttribute(DB_ID, 'request_queue', 'payload', 65535, true)
);
await safeCreate('attr: created_at', () =>
  db.createStringAttribute(DB_ID, 'request_queue', 'created_at', 30, true)
);
await safeCreate('attr: expires_at', () =>
  db.createStringAttribute(DB_ID, 'request_queue', 'expires_at', 30, true)
);
await safeCreate('attr: processed_at', () =>
  db.createStringAttribute(DB_ID, 'request_queue', 'processed_at', 30, false)
);

await waitForAttributes('request_queue', 7);

await safeCreate('index: user_id_idx', () =>
  db.createIndex(DB_ID, 'request_queue', 'user_id_idx', 'key', ['user_id'])
);
await safeCreate('index: status_idx', () =>
  db.createIndex(DB_ID, 'request_queue', 'status_idx', 'key', ['status'])
);
await safeCreate('index: created_at_idx', () =>
  db.createIndex(DB_ID, 'request_queue', 'created_at_idx', 'key', ['created_at'])
);

// ─── 4. rate_limit_overrides ──────────────────────────────────────────────────

console.log('\n[4/5] rate_limit_overrides');

await safeCreate('collection', () =>
  db.createCollection(DB_ID, 'rate_limit_overrides', 'Rate Limit Overrides')
);

await safeCreate('attr: user_id', () =>
  db.createStringAttribute(DB_ID, 'rate_limit_overrides', 'user_id', 255, true)
);
await safeCreate('attr: override_limit', () =>
  db.createIntegerAttribute(DB_ID, 'rate_limit_overrides', 'override_limit', true, 0)
);
await safeCreate('attr: updated_at', () =>
  db.createStringAttribute(DB_ID, 'rate_limit_overrides', 'updated_at', 30, true)
);

await waitForAttributes('rate_limit_overrides', 3);

await safeCreate('index: user_id_unique', () =>
  db.createIndex(DB_ID, 'rate_limit_overrides', 'user_id_unique', 'unique', ['user_id'])
);

// ─── 5. usage_logs — add total_tokens if missing ──────────────────────────────

console.log('\n[5/5] usage_logs (adding total_tokens)');

await safeCreate('attr: total_tokens', () =>
  db.createIntegerAttribute(DB_ID, 'usage_logs', 'total_tokens', false, 0)
);

// ─── 6. admins ────────────────────────────────────────────────────────────────
//
// Manually grant admin access by adding a document here:
//   Database → mesurado → admins → Create document
//   Fields: user_id (Appwrite user $id), email (display only), granted_at (ISO date)
//
// The isAdminUser() function checks this collection first, then falls back
// to the Appwrite user label 'Administrator'.

console.log('\n[6/6] admins');

await safeCreate('collection', () =>
  db.createCollection(DB_ID, 'admins', 'Administrators')
);

await safeCreate('attr: user_id', () =>
  db.createStringAttribute(DB_ID, 'admins', 'user_id', 255, true)
);
await safeCreate('attr: email', () =>
  db.createStringAttribute(DB_ID, 'admins', 'email', 320, false)
);
await safeCreate('attr: granted_at', () =>
  db.createStringAttribute(DB_ID, 'admins', 'granted_at', 30, true)
);

await waitForAttributes('admins', 3);

// Unique index so each user can only appear once
await safeCreate('index: user_id_unique', () =>
  db.createIndex(DB_ID, 'admins', 'user_id_unique', 'unique', ['user_id'])
);

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\n✅ Provisioning complete.\n');
