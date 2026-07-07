/**
 * API key hashing utilities.
 * Keys are stored as HMAC-SHA256(SESSION_SECRET, key_string) — never plaintext.
 * The key prefix (first 24 chars) is stored separately for display purposes.
 */

export async function hashApiKey(keyString: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is required for API key hashing');

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(keyString),
  );
  return Buffer.from(sig).toString('hex');
}

/** First 24 chars of the key — safe to store and display */
export function keyPrefix(keyString: string): string {
  return keyString.slice(0, 24); // "mesurado_sk_live_" (17) + 7 hex chars
}

