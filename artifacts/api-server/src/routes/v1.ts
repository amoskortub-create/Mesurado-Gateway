/**
 * Public OpenAI-compatible developer endpoint.
 * POST /v1/chat/completions
 * Authorization: Bearer mesurado_sk_live_…
 */
import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod/v4';
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite.js';
import { countTokens, calcCost } from '../lib/token-utils.js';
import { hashApiKey } from '../lib/key-hash.js';
import { resolveCoreUrl } from '../lib/core-url.js';

const router: IRouter = Router();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

const bodySchema = z.object({
  model: z.string().optional(),
  messages: z.array(messageSchema).min(1, 'messages must not be empty'),
  temperature: z.number().min(0).max(2).optional().default(0.75),
  max_tokens: z.number().int().min(1).max(8192).optional().default(1024),
});

function generateChatId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `chatcmpl-${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function jsonError(res: Response, message: string, type: string, status: number) {
  return res.status(status).set(CORS_HEADERS).json({ error: { message, type, code: status } });
}

// OPTIONS for CORS preflight
router.options('/chat/completions', (_req: Request, res: Response) => {
  res.set(CORS_HEADERS).status(204).end();
});

// POST /v1/chat/completions
router.post('/chat/completions', async (req: Request, res: Response) => {
  // 1. Validate Authorization
  const authHeader = (req.headers.authorization as string) ?? '';
  const keyString = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!keyString || !keyString.startsWith('mesurado_sk_live_')) {
    jsonError(res, 'Missing or invalid Authorization header. Use: Bearer mesurado_sk_live_…', 'invalid_request_error', 401);
    return;
  }

  // 2. Parse body
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    jsonError(res, parsed.error.issues[0].message, 'invalid_request_error', 400);
    return;
  }

  const { messages, temperature, max_tokens } = parsed.data;

  try {
    const { databases, users } = createAdminClient();

    // 3. Look up API key by hash
    const keyHash = await hashApiKey(keyString);
    const keysResult = await databases.listDocuments(DATABASE_ID, COLLECTIONS.API_KEYS, [
      Query.equal('key_hash', keyHash),
      Query.equal('is_active', true),
      Query.limit(1),
    ]);

    if (keysResult.total === 0) {
      jsonError(res, 'Invalid or inactive API key', 'invalid_request_error', 401);
      return;
    }

    const keyDoc = keysResult.documents[0];
    const userId = String(keyDoc.user_id);

    // 4. Check and pre-charge balance
    const user = await users.get(userId);
    const prefs = (user.prefs ?? {}) as Record<string, number | string>;
    const tokensRemaining = Number(prefs.mesurado_tokens_remaining ?? 0);

    const promptTokens = countTokens(messages.map(m => m.content).join(' '));
    const maxEstimate = promptTokens + max_tokens;

    if (tokensRemaining < promptTokens) {
      jsonError(res, 'Token balance exhausted. Log in to your Mesurado dashboard to add funds.', 'insufficient_quota', 402);
      return;
    }

    const preChargedBalance = Math.max(0, tokensRemaining - maxEstimate);
    await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: preChargedBalance });

    // 5. Forward to Mesurado Engine Core
    const coreUrl = resolveCoreUrl();
    const masterToken = process.env.MESURADO_MASTER_TOKEN;

    if (!coreUrl || !masterToken) {
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
      jsonError(res, 'Mesurado engine is not configured on this gateway.', 'server_error', 503);
      return;
    }

    let aiContent: string;
    try {
      const aiRes = await fetch(`${coreUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mesurado-Auth': masterToken },
        body: JSON.stringify({ model: 'mesurado-llama3.2-3b', messages, temperature, max_tokens }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!aiRes.ok) {
        await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
        jsonError(res, 'Mesurado engine core is scaling or unreachable. Please retry.', 'server_error', 502);
        return;
      }

      const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] };
      aiContent = aiData.choices?.[0]?.message?.content ?? '';
    } catch {
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
      jsonError(res, 'Mesurado engine core is scaling or unreachable. Please retry.', 'server_error', 502);
      return;
    }

    // 6. Finalize token accounting
    const completionTokens = countTokens(aiContent);
    const actualTotal = promptTokens + completionTokens;
    const costDebit = calcCost(actualTotal);
    const refund = Math.max(0, maxEstimate - actualTotal);
    const finalBalance = Math.min(tokensRemaining, preChargedBalance + refund);
    const newTotalUsed = Number(prefs.mesurado_total_tokens_used ?? 0) + actualTotal;

    await Promise.all([
      users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: finalBalance, mesurado_total_tokens_used: newTotalUsed }),
      databases.createDocument(DATABASE_ID, COLLECTIONS.USAGE_LOGS, ID.unique(), {
        user_id: userId,
        key_id: keyDoc.$id,
        source: 'api',
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_debit: costDebit,
        timestamp: new Date().toISOString(),
      }),
    ]);

    // 7. Return OpenAI-compatible response
    res.set(CORS_HEADERS).json({
      id: generateChatId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'mesurado-llama3.2-3b',
      choices: [{ index: 0, message: { role: 'assistant', content: aiContent }, finish_reason: 'stop' }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: actualTotal },
    });
  } catch (err) {
    req.log.error({ err }, '[POST /v1/chat/completions]');
    jsonError(res, 'Internal server error', 'server_error', 500);
  }
});

export default router;
