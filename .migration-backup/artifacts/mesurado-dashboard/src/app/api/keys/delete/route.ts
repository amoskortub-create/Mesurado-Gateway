import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createAdminClient, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';

const schema = z.object({ key_id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
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
    return NextResponse.json({ error: 'key_id is required' }, { status: 400 });
  }

  try {
    const { databases } = createAdminClient();
    let doc;
    try {
      doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.API_KEYS, parsed.data.key_id);
    } catch {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    if (String(doc.user_id) !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!doc.is_active) {
      return NextResponse.json({ error: 'API key is already deactivated' }, { status: 409 });
    }

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.API_KEYS, parsed.data.key_id, {
      is_active: false,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[DELETE /api/keys/delete]', error);
    return NextResponse.json({ error: 'Failed to deactivate key' }, { status: 500 });
  }
}
