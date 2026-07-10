/**
 * Pure Appwrite-backed rate limiter.
 *
 * All state lives in the `rate_limits` Appwrite collection — no in-memory cache.
 * Survives cold starts, process restarts, and multiple instances.
 *
 * Strategy: fixed 60-second window with deterministic document IDs.
 *
 * Each (userId, window) maps to a single document whose ID is derived from
 * sha1(userId|windowStart). This makes createDocument the atomic "first hit"
 * operation: if it succeeds the caller is first in this window (count=1);
 * if it fails with 409 the document already exists and we read + increment.
 *
 * Worst-case race: two concurrent callers both see the 409 path and both do
 * read-then-update, allowing count to drift by ≤1 per racing pair. This is
 * acceptable for rate-limiting purposes and far better than the alternative
 * of creating duplicate window documents.
 */

import { createHash } from 'node:crypto';
import { createAdminClient, DATABASE_ID, ID, Query } from './appwrite.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_SEC               = 60;
const RATE_LIMITS_COL          = 'rate_limits';
const RATE_LIMIT_OVERRIDES_COL = 'rate_limit_overrides';

export const RATE_LIMIT_FREE = Number(process.env.RATE_LIMIT_FREE_PER_MINUTE ?? 10);
export const RATE_LIMIT_PAID = Number(process.env.RATE_LIMIT_PAID_PER_MINUTE ?? 60);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;      // Unix timestamp (seconds) when window resets
  retryAfter?: number;  // seconds until allowed (only when allowed=false)
}

interface RateLimitDoc {
  $id: string;
  request_count: number;
}

// ─── Window helpers ───────────────────────────────────────────────────────────

function currentWindowStart(): Date {
  const nowSec = Math.floor(Date.now() / 1000);
  return new Date(Math.floor(nowSec / WINDOW_SEC) * WINDOW_SEC * 1000);
}

/**
 * Deterministic document ID for a (userId, windowStart) bucket.
 * sha1 hex is 40 chars; Appwrite allows IDs up to 36 chars, so we truncate.
 */
function windowDocId(userId: string, windowStartISO: string): string {
  return createHash('sha1')
    .update(`${userId}|${windowStartISO}`)
    .digest('hex')
    .slice(0, 36);
}

// ─── Override CRUD ────────────────────────────────────────────────────────────

export async function getOverrideLimit(userId: string): Promise<number | null> {
  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, RATE_LIMIT_OVERRIDES_COL, [
      Query.equal('user_id', userId),
      Query.limit(1),
    ]);
    if (result.total === 0) return null;
    const doc = result.documents[0] as unknown as { override_limit: number };
    return doc.override_limit > 0 ? doc.override_limit : null;
  } catch {
    return null;
  }
}

export async function setOverrideLimit(userId: string, limit: number): Promise<void> {
  const { databases } = createAdminClient();
  const existing = await databases.listDocuments(DATABASE_ID, RATE_LIMIT_OVERRIDES_COL, [
    Query.equal('user_id', userId),
    Query.limit(1),
  ]);
  const now = new Date().toISOString();
  if (existing.total > 0) {
    await databases.updateDocument(DATABASE_ID, RATE_LIMIT_OVERRIDES_COL, existing.documents[0].$id, {
      override_limit: limit,
      updated_at: now,
    });
  } else {
    await databases.createDocument(DATABASE_ID, RATE_LIMIT_OVERRIDES_COL, ID.unique(), {
      user_id: userId,
      override_limit: limit,
      updated_at: now,
    });
  }
}

export async function clearOverrideLimit(userId: string): Promise<void> {
  const { databases } = createAdminClient();
  const existing = await databases.listDocuments(DATABASE_ID, RATE_LIMIT_OVERRIDES_COL, [
    Query.equal('user_id', userId),
    Query.limit(1),
  ]);
  if (existing.total > 0) {
    await databases.deleteDocument(DATABASE_ID, RATE_LIMIT_OVERRIDES_COL, existing.documents[0].$id);
  }
}

// ─── Effective limit ──────────────────────────────────────────────────────────

export async function getEffectiveLimit(userId: string, isPaidPlan: boolean): Promise<number> {
  const override = await getOverrideLimit(userId);
  if (override !== null) return override;
  return isPaidPlan ? RATE_LIMIT_PAID : RATE_LIMIT_FREE;
}

// ─── Main check + increment ───────────────────────────────────────────────────

/**
 * Check rate limit and increment the counter if allowed.
 *
 * Uses a deterministic document ID so the first `createDocument` call acts as
 * an atomic "first-in-window" operation. A 409 conflict means another request
 * beat us; we fall through to a read+increment path.
 */
export async function checkRateLimit(
  userId: string,
  isPaidPlan: boolean,
): Promise<RateLimitResult> {
  const now           = new Date();
  const windowStart   = currentWindowStart();
  const windowExpires = new Date(windowStart.getTime() + WINDOW_SEC * 1000);
  const windowStartISO   = windowStart.toISOString();
  const windowExpiresISO = windowExpires.toISOString();
  const resetAt          = Math.floor(windowExpires.getTime() / 1000);

  const limit = await getEffectiveLimit(userId, isPaidPlan);
  const docId = windowDocId(userId, windowStartISO);

  try {
    const { databases } = createAdminClient();

    // ── Try to create the window counter (atomic first-hit) ────────────────
    try {
      await databases.createDocument(DATABASE_ID, RATE_LIMITS_COL, docId, {
        user_id:        userId,
        window_start:   windowStartISO,
        request_count:  1,
        window_expires: windowExpiresISO,
      });
      // We're the first request in this window.
      return { allowed: true, limit, remaining: limit - 1, resetAt };
    } catch (createErr: unknown) {
      const e = createErr as { code?: number };
      if (e?.code !== 409) throw createErr; // unexpected — rethrow
      // 409: window document already exists — fall through to read+increment
    }

    // ── Window already in progress: read current count ─────────────────────
    let doc: RateLimitDoc;
    try {
      doc = await databases.getDocument(DATABASE_ID, RATE_LIMITS_COL, docId) as unknown as RateLimitDoc;
    } catch {
      // Fallback to list query if getDocument isn't available
      const result = await databases.listDocuments(DATABASE_ID, RATE_LIMITS_COL, [
        Query.equal('user_id', userId),
        Query.equal('window_start', windowStartISO),
        Query.limit(1),
      ]);
      if (result.total === 0) {
        // Race: doc was just deleted or expired — treat as first hit
        return { allowed: true, limit, remaining: limit - 1, resetAt };
      }
      doc = result.documents[0] as unknown as RateLimitDoc;
    }

    const count = doc.request_count;

    if (count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((windowExpires.getTime() - now.getTime()) / 1000));
      return { allowed: false, limit, remaining: 0, resetAt, retryAfter };
    }

    // Under limit — increment
    const newCount = count + 1;
    await databases.updateDocument(DATABASE_ID, RATE_LIMITS_COL, docId, {
      request_count: newCount,
    });

    return { allowed: true, limit, remaining: Math.max(0, limit - newCount), resetAt };

  } catch (err) {
    // Appwrite unavailable — fail open so users are not locked out
    console.error('[rate-limit] Appwrite error, failing open:', err);
    return { allowed: true, limit, remaining: 0, resetAt };
  }
}

/** Set standard rate-limit response headers. */
export function setRateLimitHeaders(
  res: { set: (headers: Record<string, string>) => void },
  result: RateLimitResult,
): void {
  res.set({
    'X-RateLimit-Limit':     String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset':     String(result.resetAt),
    ...(result.retryAfter !== undefined
      ? { 'Retry-After': String(result.retryAfter) }
      : {}),
  });
}

/** Admin: list recent rate limit records. */
export async function listRateLimits(options: {
  userId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ documents: unknown[]; total: number }> {
  const { databases } = createAdminClient();
  const { userId, page = 1, pageSize = 50 } = options;
  const offset = (page - 1) * pageSize;

  const queries: string[] = [
    Query.limit(pageSize),
    Query.offset(offset),
    Query.orderDesc('window_start'),
  ];
  if (userId) queries.push(Query.equal('user_id', userId));

  const result = await databases.listDocuments(DATABASE_ID, RATE_LIMITS_COL, queries);
  return { documents: result.documents, total: result.total };
}
