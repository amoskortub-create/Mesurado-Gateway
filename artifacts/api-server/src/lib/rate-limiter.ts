/**
 * Redis-backed per-user/per-key rate limiter.
 *
 * Uses the INCR + EXPIRE pattern for atomic window counting.
 * Falls back to an in-memory Map if Redis is unavailable.
 *
 * Admin overrides: stored at `rate_limit_override:{userId}` in Redis.
 * When set, the override replaces the plan-based default for that user.
 */
import { redis } from './redis.js';

const WINDOW_MS = 60_000; // 1 minute sliding window
const WINDOW_SEC = 60;

export const RATE_LIMIT_FREE = Number(process.env.RATE_LIMIT_FREE_PER_MINUTE ?? 10);
export const RATE_LIMIT_PAID = Number(process.env.RATE_LIMIT_PAID_PER_MINUTE ?? 60);

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;      // Unix timestamp (seconds) when window resets
  retryAfter?: number;  // seconds until next request allowed (only on 429)
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface MemEntry { count: number; resetAt: number }
const memStore = new Map<string, MemEntry>();

function memCheck(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, limit, remaining: limit - 1, resetAt: nowSec + WINDOW_SEC };
  }

  entry.count += 1;
  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const resetAt = Math.floor(entry.resetAt / 1000);
  const retryAfter = allowed ? undefined : Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { allowed, limit, remaining, resetAt, retryAfter };
}

// ─── Redis-backed check ───────────────────────────────────────────────────────

async function redisCheck(key: string, limit: number): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const count = await redis.incr(key);
  if (count === 1) {
    // First hit in this window — set expiry
    await redis.expire(key, WINDOW_SEC);
  }
  const ttl = await redis.ttl(key);
  const resetAt = nowSec + Math.max(ttl, 0);
  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;
  const retryAfter = allowed ? undefined : Math.max(1, ttl);
  return { allowed, limit, remaining, resetAt, retryAfter };
}

// ─── Override lookup ──────────────────────────────────────────────────────────

/**
 * Returns the admin-configured rate limit override for a user, or null if
 * none exists. Stored in Redis at `rate_limit_override:{userId}`.
 */
export async function getOverrideLimit(userId: string): Promise<number | null> {
  try {
    const val = await redis.get(`rate_limit_override:${userId}`);
    if (val === null) return null;
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function setOverrideLimit(userId: string, limit: number): Promise<void> {
  // Stored permanently (very long TTL) until cleared or updated
  await redis.set(`rate_limit_override:${userId}`, String(limit), 365 * 24 * 3600);
}

export async function clearOverrideLimit(userId: string): Promise<void> {
  await redis.del(`rate_limit_override:${userId}`);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Check and increment the rate limit counter for `identifier`.
 *
 * @param identifier  Rate-limit bucket key suffix (e.g. `user:abc`, `key:xyz`)
 * @param defaultLimit  Requests per minute based on user plan
 * @param userId  If provided, checks for an admin override against this userId
 */
export async function checkRateLimit(
  identifier: string,
  defaultLimit: number,
  userId?: string,
): Promise<RateLimitResult> {
  // Check for admin override
  let limit = defaultLimit;
  if (userId) {
    const override = await getOverrideLimit(userId);
    if (override !== null) limit = override;
  }

  const key = `rate_limit:${identifier}`;

  try {
    return await redisCheck(key, limit);
  } catch {
    // Redis unavailable — use in-memory fallback
    return memCheck(key, limit);
  }
}

/** Attach rate limit headers to any Express response */
export function setRateLimitHeaders(
  res: { set: (headers: Record<string, string>) => void },
  result: RateLimitResult,
): void {
  res.set({
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
    ...(result.retryAfter !== undefined
      ? { 'Retry-After': String(result.retryAfter) }
      : {}),
  });
}
