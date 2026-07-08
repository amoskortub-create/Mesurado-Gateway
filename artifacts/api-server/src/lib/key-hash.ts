/** API key hashing utilities. Keys stored as HMAC-SHA256(SESSION_SECRET, key_string) */

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
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(keyString));
  return Buffer.from(sig).toString('hex');
}

export function keyPrefix(keyString: string): string {
  return keyString.slice(0, 24);
}
