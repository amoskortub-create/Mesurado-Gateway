import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite-server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { users, databases } = createAdminClient();

    // User prefs
    const user = await users.get(session.userId);
    const prefs = (user.prefs ?? {}) as Record<string, number | string>;
    const tokensRemaining = Number(prefs.mesurado_tokens_remaining ?? 1_000_000);
    const totalTokensUsed = Number(prefs.mesurado_total_tokens_used ?? 0);
    const plan = (String(prefs.mesurado_plan ?? 'free')) as 'free' | 'payg';

    // Last 30 days usage logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USAGE_LOGS, [
      Query.equal('user_id', session.userId),
      Query.greaterThanEqual('timestamp', thirtyDaysAgo.toISOString()),
      Query.orderDesc('timestamp'),
      Query.limit(500),
    ]);

    // Daily usage map (pre-fill 30 days)
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const doc of logs.documents) {
      const day = String(doc.timestamp).slice(0, 10);
      if (Object.prototype.hasOwnProperty.call(dailyMap, day)) {
        dailyMap[day] += Number(doc.prompt_tokens) + Number(doc.completion_tokens);
      }
    }
    const dailyUsage = Object.entries(dailyMap).map(([date, tokens]) => ({ date, tokens }));

    // Recent logs for analytics table
    const recentLogs = logs.documents.slice(0, 50).map((doc) => ({
      id: doc.$id,
      timestamp: doc.timestamp,
      source: doc.source,
      promptTokens: Number(doc.prompt_tokens),
      completionTokens: Number(doc.completion_tokens),
      totalTokens: Number(doc.prompt_tokens) + Number(doc.completion_tokens),
      costDebit: Number(doc.cost_debit),
      keyId: doc.key_id ?? '',
    }));

    return NextResponse.json({
      tokensRemaining,
      totalTokensUsed,
      plan,
      dailyUsage,
      recentLogs,
    });
  } catch (error: unknown) {
    console.error('[GET /api/user/usage]', error);
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }
}
