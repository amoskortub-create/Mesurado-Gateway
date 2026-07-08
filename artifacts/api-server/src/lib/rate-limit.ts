/** Simple in-memory rate limiter. Resets when the window expires. */

interface Entry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, Entry>>();

function getStore(namespace: string): Map<string, Entry> {
  let s = stores.get(namespace);
  if (!s) { s = new Map(); stores.set(namespace, s); }
  return s;
}

/**
 * Returns true if the action is allowed, false if rate-limited.
 * @param namespace   Separate counter buckets (e.g. 'payment_generate')
 * @param key         Per-entity key (e.g. userId)
 * @param limit       Max allowed calls in the window
 * @param windowMs    Window size in milliseconds
 */
export function checkRateLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const store = getStore(namespace);
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

/** How many seconds until the current window resets for a key */
export function retryAfterSeconds(namespace: string, key: string): number {
  const entry = getStore(namespace).get(key);
  if (!entry) return 0;
  return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000));
}
