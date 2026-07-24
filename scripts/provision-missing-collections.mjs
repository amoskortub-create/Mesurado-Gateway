/**
 * Provisions the two Appwrite collections missing from earlier scripts:
 *   - playground_conversations  (per-user chat history)
 *   - rejected_logs             (accepted/rejected request audit trail)
 *
 * Safe to run multiple times — 409 "already exists" errors are silently ignored.
 * Run: node scripts/provision-missing-collections.mjs
 */

const endpoint  = process.env.APPWRITE_ENDPOINT  ?? 'https://mediatechliberia.online/v1';
const projectId = process.env.APPWRITE_PROJECT_ID ?? 'mesurado01';
const apiKey    = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? 'mesurado';

if (!apiKey) { console.error('❌  APPWRITE_API_KEY is not set'); process.exit(1); }

const headers = {
  'Content-Type': 'application/json',
  'X-Appwrite-Key': apiKey,
  'X-Appwrite-Project': projectId,
};

async function api(method, path, body) {
  const res = await fetch(`${endpoint}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function label(ok, status, name, errorJson) {
  if (ok)           return `  ✅  ${name}`;
  if (status === 409) return `  ⚠️   ${name} (already exists — skipped)`;
  return `  ❌  ${name}: ${errorJson?.message ?? JSON.stringify(errorJson)}`;
}

async function createCollection(id, name) {
  const r = await api('POST', `/databases/${databaseId}/collections`, {
    collectionId: id, name, permissions: [], documentSecurity: false,
  });
  console.log(label(r.ok, r.status, `collection '${id}'`, r.json));
}

async function attr(collId, type, payload) {
  const r = await api('POST', `/databases/${databaseId}/collections/${collId}/attributes/${type}`, payload);
  if (!r.ok && r.status !== 409)
    console.log(`  ❌  attr ${payload.key}: ${r.json?.message ?? JSON.stringify(r.json)}`);
  else if (r.ok)
    console.log(`  ✅  attr: ${payload.key}`);
}

async function waitForAttrs(collId) {
  process.stdout.write(`  ⏳  waiting for attributes on '${collId}'`);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await api('GET', `/databases/${databaseId}/collections/${collId}/attributes?limit=100`);
    if (!r.ok) { process.stdout.write('.'); continue; }
    const notReady = (r.json.attributes ?? []).filter(a => a.status !== 'available');
    if (notReady.length === 0) { console.log(' ready ✅'); return; }
    process.stdout.write('.');
  }
  console.log(' timed out ⚠️');
}

async function createIndex(collId, key, type, attributes, orders) {
  const r = await api('POST', `/databases/${databaseId}/collections/${collId}/indexes`, { key, type, attributes, orders });
  if (!r.ok && r.status !== 409)
    console.log(`  ❌  index ${key}: ${r.json?.message ?? JSON.stringify(r.json)}`);
  else if (r.ok)
    console.log(`  ✅  index: ${key}`);
}

// ── playground_conversations ──────────────────────────────────────────────────
console.log('\n── Collection: playground_conversations ────────────');
await createCollection('playground_conversations', 'Playground Conversations');
await attr('playground_conversations', 'string',   { key: 'user_id',    required: true,  size: 36 });
await attr('playground_conversations', 'string',   { key: 'title',      required: true,  size: 200 });
await attr('playground_conversations', 'string',   { key: 'messages',   required: true,  size: 32000 });
await attr('playground_conversations', 'string',   { key: 'created_at', required: true,  size: 30 });
await attr('playground_conversations', 'string',   { key: 'updated_at', required: true,  size: 30 });
await waitForAttrs('playground_conversations');
await createIndex('playground_conversations', 'idx_user_id',    'key', ['user_id'],    ['DESC']);
await createIndex('playground_conversations', 'idx_updated_at', 'key', ['updated_at'], ['DESC']);
console.log('  ✅  playground_conversations done');

// ── rejected_logs ─────────────────────────────────────────────────────────────
console.log('\n── Collection: rejected_logs ───────────────────────');
await createCollection('rejected_logs', 'Rejected Request Logs');
await attr('rejected_logs', 'string',  { key: 'user_id',    required: true,  size: 36 });
await attr('rejected_logs', 'string',  { key: 'source',     required: true,  size: 20 });
await attr('rejected_logs', 'string',  { key: 'reason',     required: true,  size: 500 });
await attr('rejected_logs', 'integer', { key: 'error_code', required: true });
await attr('rejected_logs', 'string',  { key: 'timestamp',  required: true,  size: 30 });
await waitForAttrs('rejected_logs');
await createIndex('rejected_logs', 'idx_user_id',  'key', ['user_id'],  ['DESC']);
await createIndex('rejected_logs', 'idx_timestamp', 'key', ['timestamp'], ['DESC']);
console.log('  ✅  rejected_logs done');

// ── usage_logs: ensure total_tokens exists ────────────────────────────────────
console.log('\n── Collection: usage_logs (ensure total_tokens) ────');
await attr('usage_logs', 'integer', { key: 'total_tokens', required: false, default: 0 });
console.log('  ✅  usage_logs check done');

console.log('\n🎉  Missing collections provisioned\n');
