---
name: Mesurado rate-limit + queue system
description: Pure Appwrite rate limiter and gatekeeper — architecture, atomicity approach, and known limitations.
---

## Rate Limiter (`appwrite-rate-limiter.ts`)

**Strategy**: Fixed 60-second window; one Appwrite document per (userId, window).

**Atomicity**: Document IDs are deterministic — `sha1("${userId}|${windowStartISO}").slice(0,36)`.
- First request in a window calls `createDocument(docId, count=1)`.
- If 409 conflict (another request beat it), falls through to `getDocument(docId)` → increment.
- Worst-case drift: ±1 per concurrent pair on the read+increment path. Acceptable for throttling.
- Appwrite enforces document-ID uniqueness at storage level, preventing duplicate window docs.

**Fail-open**: Any Appwrite error allows the request through (users not locked out during outage).

**Overrides**: `rate_limit_overrides` collection lets admins set per-user custom limits.

**Rate limit keys**: playground uses `session.userId`; v1 API uses `key_${keyDoc.$id}`.

## Gatekeeper (`appwrite-gatekeeper.ts`)

**Strategy**: Single `gatekeeper_slots` document (`$id="global"`) with `active_count` integer.

**Atomicity limitation**: Appwrite has no CAS/transaction support. Read-modify-write can drift ±1 under heavy concurrency.

**Self-healing**: If `updated_at` is older than 270s (3× the 90s AI timeout), the counter is reset to 0 on the next acquire. This prevents crashed requests from permanently blocking capacity.

**Acquire**: If `active_count >= max_count` → immediate 429 (no queuing). Increments count then proceeds.

**Release**: Always in a `finally` block via `releaseSlot()` closure that prevents double-release with a boolean guard. Clamps to 0 on decrement.

**Fail-open**: Any Appwrite error allows the request through.

**Slot doc auto-create**: If the document doesn't exist (404), it's created automatically.

## AbortController (routes)

Both `playground.ts` and `v1.ts`:
- Create an `AbortController` per request.
- `req.on('close', () => { abortController.abort(); releaseSlot(); })` — cancels upstream AI fetch immediately on client disconnect.
- Fetch signal: `AbortSignal.any([AbortSignal.timeout(90_000), abortController.signal])`.
- `AbortError` from `abortController.signal` is caught silently (client already gone); `TimeoutError` → 504.
- Stream reads that throw `AbortError` → bail out silently; `finally` block releases slot and rolls back billing.

## Billing (both routes)

- Pre-charge applied before slot acquire (v1) or before AI fetch (playground).
- `reconciled` boolean guards rollback: if the `finally` block runs before billing completes, pre-charge is restored.
- Double-release guard: `slotReleased` boolean prevents `releaseSlot()` from decrementing twice.
- Slot is released _before_ the final billing call so next queued request can proceed immediately.

## Collection schema

- `rate_limits`: `user_id`, `window_start`, `request_count`, `window_expires` — doc ID is sha1 hash.
- `gatekeeper_slots`: `slot_id`, `active_count`, `max_count`, `updated_at` — single `global` doc.
- `rate_limit_overrides`: `user_id`, `override_limit`, `updated_at`.
- `request_queue`: present in schema (provisioned) but not used — reserved for future queue worker.
- `usage_logs`: extended with `total_tokens` column.

**Why:**
Previous design used in-memory semaphore + Redis write-through which didn't survive cold starts or multi-instance deployment. Pure Appwrite approach is durable at the cost of ±1 precision under concurrency, which is acceptable for rate limiting.
