/**
 * Provisions the Mesurado Appwrite database:
 *   - database: mesurado
 *   - collections: api_keys, usage_logs, payments
 *   - storage bucket: payment_screenshots
 *
 * Run: node scripts/provision-appwrite.mjs
 */

const endpoint = process.env.APPWRITE_ENDPOINT ?? "https://mediatechliberia.online/v1";
const projectId = process.env.APPWRITE_PROJECT_ID ?? "mesurado01";
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? "mesurado";

if (!apiKey) {
  console.error("❌  APPWRITE_API_KEY is not set");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Key": apiKey,
  "X-Appwrite-Project": projectId,
};

async function api(method, path, body) {
  const res = await fetch(`${endpoint}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function label(ok, status, name, errorJson) {
  if (ok) return `  ✅  ${name}`;
  if (status === 409) return `  ⚠️   ${name} (already exists — skipped)`;
  return `  ❌  ${name}: ${errorJson?.message ?? JSON.stringify(errorJson)}`;
}

async function createCollection(id, name) {
  const r = await api("POST", `/databases/${databaseId}/collections`, {
    collectionId: id,
    name,
    permissions: [],
    documentSecurity: false,
  });
  console.log(label(r.ok, r.status, `collection '${id}'`, r.json));
}

async function attr(collId, type, payload) {
  const r = await api(
    "POST",
    `/databases/${databaseId}/collections/${collId}/attributes/${type}`,
    payload,
  );
  if (!r.ok && r.status !== 409) {
    console.log(`  ❌  attr ${payload.key}: ${r.json?.message ?? JSON.stringify(r.json)}`);
  }
}

async function waitForAttrs(collId) {
  process.stdout.write(`  ⏳  waiting for attributes on '${collId}'`);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await api("GET", `/databases/${databaseId}/collections/${collId}/attributes?limit=100`);
    if (!r.ok) { process.stdout.write("."); continue; }
    const notReady = (r.json.attributes ?? []).filter((a) => a.status !== "available");
    if (notReady.length === 0) { console.log(" ready ✅"); return; }
    process.stdout.write(".");
  }
  console.log(" timed out ⚠️");
}

async function createIndex(collId, key, type, attributes, orders) {
  const r = await api(
    "POST",
    `/databases/${databaseId}/collections/${collId}/indexes`,
    { key, type, attributes, orders },
  );
  if (!r.ok && r.status !== 409) {
    console.log(`  ❌  index ${key}: ${r.json?.message ?? JSON.stringify(r.json)}`);
  }
}

// ── database ─────────────────────────────────────────────────────────────────
console.log("\n── Database ─────────────────────────────────────────");
{
  const r = await api("POST", "/databases", { databaseId, name: "Mesurado" });
  console.log(label(r.ok, r.status, `database '${databaseId}'`, r.json));
}

// ── api_keys ──────────────────────────────────────────────────────────────────
console.log("\n── Collection: api_keys ────────────────────────────");
await createCollection("api_keys", "API Keys");
await attr("api_keys", "string",   { key: "user_id",    required: true,  size: 36 });
await attr("api_keys", "string",   { key: "key_hash",   required: true,  size: 128 });
await attr("api_keys", "string",   { key: "key_prefix", required: true,  size: 16 });
await attr("api_keys", "string",   { key: "label",      required: true,  size: 100 });
await attr("api_keys", "boolean",  { key: "is_active",  required: false, default: true });
await attr("api_keys", "datetime", { key: "created_at", required: true });
await waitForAttrs("api_keys");
await createIndex("api_keys", "idx_user_id",   "key",    ["user_id"],   ["DESC"]);
await createIndex("api_keys", "idx_key_hash",  "key",    ["key_hash"],  ["ASC"]);
await createIndex("api_keys", "idx_is_active", "key",    ["is_active"], ["ASC"]);
console.log("  ✅  indexes created");

// ── usage_logs ────────────────────────────────────────────────────────────────
console.log("\n── Collection: usage_logs ──────────────────────────");
await createCollection("usage_logs", "Usage Logs");
await attr("usage_logs", "string",   { key: "user_id",           required: true,  size: 36 });
await attr("usage_logs", "string",   { key: "key_id",            required: true,  size: 36 });
await attr("usage_logs", "string",   { key: "source",            required: true,  size: 20 });
await attr("usage_logs", "integer",  { key: "prompt_tokens",     required: true });
await attr("usage_logs", "integer",  { key: "completion_tokens", required: true });
await attr("usage_logs", "float",    { key: "cost_debit",        required: true });
await attr("usage_logs", "datetime", { key: "timestamp",         required: true });
await waitForAttrs("usage_logs");
await createIndex("usage_logs", "idx_user_id", "key", ["user_id"], ["DESC"]);
console.log("  ✅  indexes created");

// ── payments ──────────────────────────────────────────────────────────────────
console.log("\n── Collection: payments ────────────────────────────");
await createCollection("payments", "Payments");
await attr("payments", "string",   { key: "user_id",                  required: true,  size: 36 });
await attr("payments", "string",   { key: "user_email",               required: true,  size: 254 });
await attr("payments", "string",   { key: "unique_code",              required: true,  size: 16 });
await attr("payments", "float",    { key: "amount_usd",               required: true });
await attr("payments", "string",   { key: "ussd_code",                required: true,  size: 64 });
await attr("payments", "string",   { key: "status",                   required: true,  size: 20 });
await attr("payments", "boolean",  { key: "proof_submitted",          required: false, default: false });
await attr("payments", "string",   { key: "proof_transaction_id",     required: false, size: 64 });
await attr("payments", "string",   { key: "proof_phone_number",       required: false, size: 20 });
await attr("payments", "string",   { key: "proof_screenshot_url",     required: false, size: 512 });
await attr("payments", "string",   { key: "proof_screenshot_file_id", required: false, size: 36 });
await attr("payments", "datetime", { key: "expires_at",               required: true });
await attr("payments", "datetime", { key: "reviewed_at",              required: false });
await attr("payments", "string",   { key: "reviewed_by",              required: false, size: 36 });
await attr("payments", "string",   { key: "admin_note",               required: false, size: 500 });
await waitForAttrs("payments");
await createIndex("payments", "idx_user_id",    "key",    ["user_id"],     ["DESC"]);
await createIndex("payments", "idx_status",     "key",    ["status"],      ["ASC"]);
await createIndex("payments", "idx_expires_at", "key",    ["expires_at"],  ["ASC"]);
await createIndex("payments", "idx_unique_code","unique", ["unique_code"], ["ASC"]);
console.log("  ✅  indexes created");

// ── storage bucket ────────────────────────────────────────────────────────────
console.log("\n── Storage Bucket ──────────────────────────────────");
{
  const r = await api("POST", "/storage/buckets", {
    bucketId: "payment_screenshots",
    name: "Payment Screenshots",
    permissions: [],
    fileSecurity: false,
    enabled: true,
    maxFileSize: 5242880,
    allowedFileExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    compression: "none",
    encryption: false,
    antivirus: false,
  });
  console.log(label(r.ok, r.status, "bucket 'payment_screenshots'", r.json));
}

console.log("\n🎉  Appwrite provisioning complete\n");
