/**
 * Appwrite-backed rate limiter for payment routes.
 *
 * Delegates to redis.ts (which persists to Appwrite) so state
 * survives process restarts. The interface is async to match.
 */
import { redis } from './redis.js';

/**
 * Returns true if the action is allowed, false if rate-limited.
 * @param namespace   Separate counter buckets (e.g. 'payment_generate')
 * @param key         Per-entity key (e.g. userId)
 * @param limit       Max allowed calls in the window
 * @param windowMs    Window size in milliseconds
 */
export async function checkRateLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const windowSec = Math.ceil(windowMs / 1000);
  const storeKey = `rl:${namespace}:${key}`;
  const count = await redis.incr(storeKey);
  if (count === 1) await redis.expire(storeKey, windowSec);
  return count <= limit;
}

/** How many seconds until the current window resets for a key */
export async function retryAfterSeconds(namespace: string, key: string): Promise<number> {
  const ttl = await redis.ttl(`rl:${namespace}:${key}`);
  return Math.max(0, ttl);
}
