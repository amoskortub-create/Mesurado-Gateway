/** Cookie-based auth using HMAC-signed tokens (Web Crypto API, Node.js 18+) */

const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = 'mesurado_session';

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET environment variable is not set');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Generate a cryptographically random 16-byte token ID (jti). */
function generateJti(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

export async function signToken(userId: string, email: string): Promise<string> {
  const key = await getHmacKey();
  // jti (JWT ID) makes every token unique, enabling future per-token revocation
  const payload = JSON.stringify({ userId, email, iat: Date.now(), jti: generateJti() });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${Buffer.from(sig).toString('base64url')}`;
}

export async function verifyToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);
    const key = await getHmacKey();
    const sigBytes = Buffer.from(sigB64, 'base64url');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (Date.now() - payload.iat > TOKEN_MAX_AGE_MS) return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function getSession(
  cookieValue: string | undefined,
): Promise<{ userId: string; email: string } | null> {
  if (!cookieValue) return null;
  return verifyToken(cookieValue);
}
