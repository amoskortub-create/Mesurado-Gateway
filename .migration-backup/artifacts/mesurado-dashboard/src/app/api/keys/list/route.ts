import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite-server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.API_KEYS, [
      Query.equal('user_id', session.userId),
      Query.orderDesc('created_at'),
      Query.limit(100),
    ]);

    // Strip key_hash from the response — the client never needs it
    const keys = result.documents.map((doc) => ({
      $id: doc.$id,
      label: doc.label,
      key_prefix: doc.key_prefix ?? '',
      is_active: doc.is_active,
      created_at: doc.created_at,
    }));

    return NextResponse.json({ keys });
  } catch (error: unknown) {
    console.error('[GET /api/keys/list]', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}
