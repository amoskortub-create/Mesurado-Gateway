/**
 * Public OpenAI-compatible developer endpoint.
 * POST /v1/chat/completions
 * Authorization: Bearer mesurado_sk_live_…
 *
 * Protection layers (all server-side, all persisted in Appwrite):
 *   1. Bearer token auth → API key lookup
 *   2. Balance check (Appwrite user prefs)
 *   3. Per-key rate limit  (Appwrite rate_limits — deterministic doc ID, fail-open)
 *   4. Pre-charge balance
 *   5. Global concurrency check (Appwrite gatekeeper_slots — immediate reject, self-healing)
 *
 * Supports streaming (SSE, OpenAI format) and non-streaming (JSON).
 * AbortController propagates client disconnect to abort the upstream AI fetch.
 */

import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod/v4';
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite.js';
import { countTokens, calcCost } from '../lib/token-utils.js';
import { hashApiKey } from '../lib/key-hash.js';
import { resolveCoreUrl } from '../lib/core-url.js';
import { checkRateLimit, setRateLimitHeaders, RATE_LIMIT_FREE, RATE_LIMIT_PAID } from '../lib/appwrite-rate-limiter.js';
import { checkAndIncrementSlots, decrementSlots } from '../lib/appwrite-gatekeeper.js';

// Keep these exports so any future code referencing these constants still compiles.
export { RATE_LIMIT_FREE, RATE_LIMIT_PAID };

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

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
  stream: z.boolean().optional().default(false),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateChatId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `chatcmpl-${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function jsonError(res: Response, message: string, type: string, status: number) {
  return res.status(status).set(CORS_HEADERS).json({ error: { message, type, code: status } });
}

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

router.options('/chat/completions', (_req: Request, res: Response) => {
  res.set(CORS_HEADERS).status(204).end();
});

// ─── POST /v1/chat/completions ────────────────────────────────────────────────

router.post('/chat/completions', async (req: Request, res: Response) => {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const authHeader = (req.headers.authorization as string) ?? '';
  const keyString  = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!keyString || !keyString.startsWith('mesurado_sk_live_')) {
    jsonError(res, 'Missing or invalid Authorization header. Use: Bearer mesurado_sk_live_…', 'invalid_request_error', 401);
    return;
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    jsonError(res, parsed.error.issues[0].message, 'invalid_request_error', 400);
    return;
  }
  const { messages, temperature, max_tokens, stream } = parsed.data;

  try {
    const { databases, users } = createAdminClient();

    // ── 3. Look up API key ─────────────────────────────────────────────────
    const keyHash    = await hashApiKey(keyString);
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

    // ── 4. Get user prefs ──────────────────────────────────────────────────
    let user: Awaited<ReturnType<typeof users.get>>;
    try {
      user = await users.get(userId);
    } catch {
      res.set(CORS_HEADERS);
      jsonError(res, 'Service temporarily unavailable. Please retry.', 'server_error', 503);
      return;
    }

    const prefs           = (user.prefs ?? {}) as Record<string, number | string>;
    const tokensRemaining = Number(prefs.mesurado_tokens_remaining ?? 0);
    const isPaidPlan      = (prefs.mesurado_plan ?? 'free') !== 'free';

    // ── 5. Balance check ───────────────────────────────────────────────────
    const promptTokens = countTokens(messages.map(m => m.content).join(' '));

    if (tokensRemaining < promptTokens) {
      jsonError(res, 'Token balance exhausted. Log in to your Mesurado dashboard to add funds.', 'insufficient_quota', 402);
      return;
    }

    // ── 6. Rate limit (Appwrite, keyed per API key) ────────────────────────
    // Each API key gets its own rate-limit bucket (keyDoc.$id as identifier).
    const rateResult = await checkRateLimit(`key_${keyDoc.$id}`, isPaidPlan);

    res.set(CORS_HEADERS);
    setRateLimitHeaders(res, rateResult);

    if (!rateResult.allowed) {
      jsonError(res, `Rate limit exceeded. You may make ${rateResult.limit} requests per minute.`, 'rate_limit_error', 429);
      return;
    }

    // ── 7. Engine config ───────────────────────────────────────────────────
    const coreUrl     = resolveCoreUrl();
    const masterToken = process.env.MESURADO_MASTER_TOKEN;
    if (!coreUrl || !masterToken) {
      jsonError(res, 'Mesurado engine is not configured on this gateway.', 'server_error', 503);
      return;
    }

    // ── 8. Pre-charge balance ──────────────────────────────────────────────
    const maxEstimate       = promptTokens + max_tokens;
    const preChargedBalance = Math.max(0, tokensRemaining - maxEstimate);
    let preChargeApplied = false;
    let reconciled       = false;

    try {
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: preChargedBalance });
      preChargeApplied = true;
    } catch {
      jsonError(res, 'Service temporarily unavailable. Please retry.', 'server_error', 503);
      return;
    }

    async function restorePrecharge(): Promise<void> {
      reconciled = true;
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining }).catch(() => {});
    }

    // ── 9. Concurrency slot check (Appwrite — immediate reject) ────────────
    const slotResult = await checkAndIncrementSlots();
    if (!slotResult.acquired) {
      await restorePrecharge();
      jsonError(res, 'Mesurado is at capacity. Please retry in a few seconds.', 'rate_limit_error', 429);
      return;
    }

    let slotReleased = false;
    async function releaseSlot(): Promise<void> {
      if (slotReleased) return;
      slotReleased = true;
      await decrementSlots();
    }

    // AbortController to cancel upstream AI fetch on client disconnect.
    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort('client_disconnect');
      releaseSlot().catch(() => {});
    });

    try {
      // ── 10. Build flat prompt ────────────────────────────────────────────
      const promptParts: string[] = [];
      for (const m of messages) {
        if (m.role === 'system')    promptParts.push(`System: ${m.content}`);
        else if (m.role === 'user') promptParts.push(`User: ${m.content}`);
        else                        promptParts.push(`Assistant: ${m.content}`);
      }
      const prompt = promptParts.join('\n\n');

      // ── 11. Call engine (with client-disconnect abort) ───────────────────
      const fetchSignal = AbortSignal.any([
        AbortSignal.timeout(90_000),
        abortController.signal,
      ]);

      let aiRes: FetchResponse;
      try {
        aiRes = await fetch(`${coreUrl}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Mesurado-Auth': masterToken,
            'X-Mesurado-Origin': process.env.MESURADO_DOMAIN ?? 'mesurado.mediatechliberia.online',
          },
          body: JSON.stringify({ prompt, temperature }),
          signal: fetchSignal,
        });
      } catch (fetchErr: unknown) {
        const e = fetchErr as { name?: string };
        await restorePrecharge();
        if (e?.name === 'AbortError' && abortController.signal.aborted) {
          // Client disconnected — no response needed
          return;
        }
        const msg = e?.name === 'TimeoutError'
          ? 'Mesurado engine timed out. Please retry.'
          : 'Mesurado engine is scaling or unreachable.';
        const code = e?.name === 'TimeoutError' ? 504 : 502;
        jsonError(res, msg, 'server_error', code);
        return;
      }

      if (!aiRes.ok) {
        await restorePrecharge();
        if (aiRes.status === 429) {
          jsonError(res, 'Mesurado is at capacity. Please retry in a few seconds.', 'rate_limit_error', 429);
        } else {
          jsonError(res, 'Mesurado engine is scaling or unreachable.', 'server_error', 502);
        }
        return;
      }

      // ── 12. Read / stream response ───────────────────────────────────────
      let aiContent   = '';
      const chatId    = generateChatId();
      const createdAt = Math.floor(Date.now() / 1000);

      if (stream) {
        res.set({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();
      }

      if (aiRes.body) {
        const reader  = (aiRes.body as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) {
              aiContent += text;
              if (stream && !res.destroyed) {
                const sseChunk = JSON.stringify({
                  id: chatId, object: 'chat.completion.chunk', created: createdAt,
                  model: 'mesurado-1.0-lite',
                  choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                });
                res.write(`data: ${sseChunk}\n\n`);
              }
            }
          }
          const tail = decoder.decode();
          if (tail) {
            aiContent += tail;
            if (stream && !res.destroyed) {
              const sseChunk = JSON.stringify({
                id: chatId, object: 'chat.completion.chunk', created: createdAt,
                model: 'mesurado-1.0-lite',
                choices: [{ index: 0, delta: { content: tail }, finish_reason: null }],
              });
              res.write(`data: ${sseChunk}\n\n`);
            }
          }
        } catch (readErr: unknown) {
          // AbortError during stream read = client disconnected mid-stream
          const e = readErr as { name?: string };
          if (e?.name !== 'AbortError') throw readErr;
          // Client gone — do not send a response; finally handles cleanup
          return;
        } finally {
          reader.releaseLock();
        }
      }

      // Release slot before billing
      await releaseSlot();

      // ── 13. Reconcile billing ────────────────────────────────────────────
      const completionTokens = countTokens(aiContent);
      const actualTotal      = promptTokens + completionTokens;
      const costDebit        = calcCost(actualTotal);
      const finalBalance     = Math.max(0, tokensRemaining - actualTotal);
      const newTotalUsed     = Number(prefs.mesurado_total_tokens_used ?? 0) + actualTotal;

      try {
        await Promise.all([
          users.updatePrefs(userId, {
            ...prefs,
            mesurado_tokens_remaining:  finalBalance,
            mesurado_total_tokens_used: newTotalUsed,
          }),
          databases.createDocument(DATABASE_ID, COLLECTIONS.USAGE_LOGS, ID.unique(), {
            user_id:           userId,
            key_id:            keyDoc.$id,
            source:            'api',
            prompt_tokens:     promptTokens,
            completion_tokens: completionTokens,
            total_tokens:      actualTotal,
            cost_debit:        costDebit,
            timestamp:         new Date().toISOString(),
          }),
        ]);
      } catch (billingErr) {
        req.log.error({ err: billingErr, userId },
          '[billing] token deduction failed — manual review needed');
      }
      reconciled = true;

      if (stream) {
        if (!res.destroyed) { res.write('data: [DONE]\n\n'); res.end(); }
        return;
      }

      res.json({
        id: generateChatId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'mesurado-1.0-lite',
        choices: [
          { index: 0, message: { role: 'assistant', content: aiContent }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: actualTotal },
      });

    } finally {
      await releaseSlot();
      if (preChargeApplied && !reconciled) {
        await users.updatePrefs(userId, {
          ...prefs,
          mesurado_tokens_remaining: tokensRemaining,
        }).catch(e => req.log.error({ err: e }, '[billing] pre-charge rollback failed'));
      }
    }

  } catch (err) {
    req.log.error({ err }, '[POST /v1/chat/completions]');
    if (!res.headersSent) {
      jsonError(res, 'Internal server error', 'server_error', 500);
    }
  }
});

export default router;
