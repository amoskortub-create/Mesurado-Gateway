/**
 * Pure Appwrite-backed concurrency gate.
 *
 * One document in `gatekeeper_slots` with $id = "global" tracks how many
 * AI requests are currently in-flight. Max is MAX_CONCURRENT_GATEKEEPER (default 3).
 *
 * Before forwarding to AI:
 *   const { acquired } = await checkAndIncrementSlots();
 *   if (!acquired) return 429;
 *
 * After response (success or error):
 *   await decrementSlots();
 *
 * Immediate-reject strategy — no queuing, no held connections.
 * The client handles retry with exponential backoff.
 *
 * Atomicity note: Appwrite has no CAS operation, so acquire and release are
 * each a read-then-write. To prevent stuck counts from crashed requests:
 *   - Any read that finds `updated_at` older than STALE_THRESHOLD_MS resets
 *     the counter to 0 first. Since all AI requests timeout at 90s, any slot
 *     not updated in 3× that time (270s) is definitely abandoned.
 *   - Decrements clamp to 0 so they never go negative.
 *   - All slot manipulations use `getDocument` (by stable ID) to avoid
 *     list-query races.
 */

import { createAdminClient, DATABASE_ID } from './appwrite.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const GATEKEEPER_COL  = 'gatekeeper_slots';
const GLOBAL_DOC_ID   = 'global';

/** If the slot doc hasn't been updated in this long, the count is stale. */
const STALE_THRESHOLD_MS = 270_000; // 4.5 minutes (3× the 90s AI timeout)

export const MAX_SLOTS = Number(process.env.MAX_CONCURRENT_GATEKEEPER ?? 3);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlotsStatus {
  activeSlots: number;
  maxSlots:    number;
  updatedAt:   string;
  staleReset?: boolean;
}

interface SlotDoc {
  $id:          string;
  slot_id:      string;
  active_count: number;
  max_count:    number;
  updated_at:   string;
}

// ─── Internal: read global slot document ─────────────────────────────────────

async function readSlotDoc(): Promise<SlotDoc> {
  const { databases } = createAdminClient();
  try {
    return await databases.getDocument(
      DATABASE_ID, GATEKEEPER_COL, GLOBAL_DOC_ID,
    ) as unknown as SlotDoc;
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e?.code !== 404) throw err;
    // Auto-create if provision hasn't run yet
    return await databases.createDocument(DATABASE_ID, GATEKEEPER_COL, GLOBAL_DOC_ID, {
      slot_id:      'global',
      active_count: 0,
      max_count:    MAX_SLOTS,
      updated_at:   new Date().toISOString(),
    }) as unknown as SlotDoc;
  }
}

// ─── Stale detection ─────────────────────────────────────────────────────────

function isStale(doc: SlotDoc): boolean {
  if (doc.active_count <= 0) return false;
  const lastUpdate = new Date(doc.updated_at).getTime();
  return Date.now() - lastUpdate > STALE_THRESHOLD_MS;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Try to acquire a concurrency slot.
 * Returns immediately — never blocks, never queues.
 *
 * If acquired=true the caller MUST call decrementSlots() when done (in a
 * finally block). If acquired=false return 429; do NOT call decrementSlots().
 *
 * Self-healing: if the counter is stale (not updated in STALE_THRESHOLD_MS),
 * it is reset to 0 before the acquire check so crashed requests don't block
 * all future traffic indefinitely.
 */
export async function checkAndIncrementSlots(): Promise<{
  acquired:    boolean;
  activeSlots: number;
  maxSlots:    number;
  staleCleaned?: boolean;
}> {
  try {
    const { databases } = createAdminClient();
    let doc      = await readSlotDoc();
    const maxSlots = doc.max_count ?? MAX_SLOTS;
    let staleCleaned = false;

    // ── Self-heal: reset stale counter ────────────────────────────────────
    if (isStale(doc)) {
      console.warn(`[gatekeeper] stale active_count=${doc.active_count} (last updated ${doc.updated_at}), resetting to 0`);
      await databases.updateDocument(DATABASE_ID, GATEKEEPER_COL, doc.$id, {
        active_count: 0,
        updated_at:   new Date().toISOString(),
      });
      doc = { ...doc, active_count: 0 };
      staleCleaned = true;
    }

    if (doc.active_count >= maxSlots) {
      return { acquired: false, activeSlots: doc.active_count, maxSlots };
    }

    const newCount = doc.active_count + 1;
    await databases.updateDocument(DATABASE_ID, GATEKEEPER_COL, doc.$id, {
      active_count: newCount,
      updated_at:   new Date().toISOString(),
    });

    return { acquired: true, activeSlots: newCount, maxSlots, staleCleaned };

  } catch (err) {
    // Appwrite unavailable — fail open so users aren't completely blocked
    console.error('[gatekeeper] Appwrite error on acquire, failing open:', err);
    return { acquired: true, activeSlots: 0, maxSlots: MAX_SLOTS };
  }
}

/**
 * Release a previously acquired slot.
 * Always call in a finally block — never skip, even on error.
 * Clamps to 0 so concurrent decrements don't go negative.
 */
export async function decrementSlots(): Promise<void> {
  try {
    const { databases } = createAdminClient();
    const doc      = await readSlotDoc();
    const newCount = Math.max(0, doc.active_count - 1);
    await databases.updateDocument(DATABASE_ID, GATEKEEPER_COL, doc.$id, {
      active_count: newCount,
      updated_at:   new Date().toISOString(),
    });
  } catch (err) {
    console.error('[gatekeeper] decrementSlots failed:', err);
    // Non-fatal — next acquire will self-heal if count drifts too high
  }
}

/** Read current slot state for admin/monitoring. */
export async function getSlotsStatus(): Promise<SlotsStatus> {
  try {
    const doc = await readSlotDoc();
    return {
      activeSlots: doc.active_count,
      maxSlots:    doc.max_count ?? MAX_SLOTS,
      updatedAt:   doc.updated_at,
      staleReset:  isStale(doc),
    };
  } catch {
    return { activeSlots: 0, maxSlots: MAX_SLOTS, updatedAt: new Date().toISOString() };
  }
}

/**
 * Administratively reset active_count to 0.
 * Use when a server crash leaves the counter stuck.
 */
export async function resetSlots(): Promise<void> {
  const { databases } = createAdminClient();
  const doc = await readSlotDoc();
  await databases.updateDocument(DATABASE_ID, GATEKEEPER_COL, doc.$id, {
    active_count: 0,
    updated_at:   new Date().toISOString(),
  });
}
