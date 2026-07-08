import { Router, type Request, type Response, type IRouter } from 'express';
import { createAdminClient, DATABASE_ID, COLLECTIONS, Query } from '../lib/appwrite.js';
import { getSession, SESSION_COOKIE } from '../lib/auth.js';

const router: IRouter = Router();

// GET /api/user/usage
router.get('/usage', async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = await getSession(token);
  if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const { users, databases } = createAdminClient();

    const user = await users.get(session.userId);
    const prefs = (user.prefs ?? {}) as Record<string, number | string>;
    const tokensRemaining = Number(prefs.mesurado_tokens_remaining ?? 1_000_000);
    const totalTokensUsed = Number(prefs.mesurado_total_tokens_used ?? 0);
    const plan = (String(prefs.mesurado_plan ?? 'free')) as 'free' | 'payg';

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USAGE_LOGS, [
      Query.equal('user_id', session.userId),
      Query.greaterThanEqual('timestamp', thirtyDaysAgo.toISOString()),
      Query.orderDesc('timestamp'),
      Query.limit(500),
    ]);

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

    const recentLogs = logs.documents.slice(0, 50).map(doc => ({
      id: doc.$id,
      timestamp: doc.timestamp,
      source: doc.source,
      promptTokens: Number(doc.prompt_tokens),
      completionTokens: Number(doc.completion_tokens),
      totalTokens: Number(doc.prompt_tokens) + Number(doc.completion_tokens),
      costDebit: Number(doc.cost_debit),
      keyId: doc.key_id ?? '',
    }));

    res.json({ tokensRemaining, totalTokensUsed, plan, dailyUsage, recentLogs });
  } catch (err) {
    req.log.error({ err }, '[GET /api/user/usage]');
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

export default router;
