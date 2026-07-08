/**
 * In-memory per-user/per-key rate limiter.
 *
 * Uses INCR + EXPIRE on the in-memory store (redis.ts).
 * No external services required.
 *
 * Admin overrides: stored at `rate_limit_override:{userId}` in the in-memory store.
 * When set, the override replaces the plan-based default for that user.
 */
import { redis } from './redis.js';

const WINDOW_SEC = 60; // 1-minute window

export const RATE_LIMIT_FREE = Number(process.env.RATE_LIMIT_FREE_PER_MINUTE ?? 10);
export const RATE_LIMIT_PAID = Number(process.env.RATE_LIMIT_PAID_PER_MINUTE ?? 60);

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;     // Unix timestamp (seconds) when window resets
  retryAfter?: number; // seconds until next request allowed (only on 429)
}

// ─── Core check ───────────────────────────────────────────────────────────────

async function check(key: string, limit: number): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const count = await redis.incr(key);
  if (count === 1) {
    // First hit in this window — set the expiry
    await redis.expire(key, WINDOW_SEC);
  }
  const ttl = await redis.ttl(key);
  const resetAt = nowSec + Math.max(ttl, 0);
  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;
  const retryAfter = allowed ? undefined : Math.max(1, ttl);
  return { allowed, limit, remaining, resetAt, retryAfter };
}

// ─── Override CRUD ────────────────────────────────────────────────────────────

export async function getOverrideLimit(userId: string): Promise<number | null> {
  const val = await redis.get(`rate_limit_override:${userId}`);
  if (val === null) return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function setOverrideLimit(userId: string, limit: number): Promise<void> {
  // 365-day TTL — effectively permanent until explicitly cleared
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
  let limit = defaultLimit;
  if (userId) {
    const override = await getOverrideLimit(userId);
    if (override !== null) limit = override;
  }
  return check(`rate_limit:${identifier}`, limit);
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
