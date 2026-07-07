import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID } from '@/lib/appwrite-server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { hashApiKey, keyPrefix } from '@/lib/key-hash';

const schema = z.object({
  label: z.string().min(1, 'Label is required').max(100).trim(),
});

function generateKeyString(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `mesurado_sk_live_${hex}`;
}

export async function POST(req: NextRequest) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const keyString = generateKeyString();
    const keyHash = await hashApiKey(keyString);
    const prefix = keyPrefix(keyString);
    const { databases } = createAdminClient();

    await databases.createDocument(DATABASE_ID, COLLECTIONS.API_KEYS, ID.unique(), {
      user_id: session.userId,
      key_hash: keyHash,   // stored securely — never the plaintext
      key_prefix: prefix,  // first 24 chars, safe for display
      label: parsed.data.label,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    // Plaintext returned EXACTLY ONCE — not stored, not logged
    return NextResponse.json({ success: true, keyString });
  } catch (error: unknown) {
    console.error('[POST /api/keys/generate]', error);
    return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 });
  }
}
