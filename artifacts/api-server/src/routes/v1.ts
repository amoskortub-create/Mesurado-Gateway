/**
 * Public OpenAI-compatible developer endpoint.
 * POST /v1/chat/completions
 * Authorization: Bearer mesurado_sk_live_…
 *
 * Protection layers (all server-side):
 *   1. Bearer token auth → API key lookup in Appwrite
 *   2. Balance check (Appwrite)
 *   3. Per-key rate limit  (Redis / in-memory fallback; admin override by user_id)
 *   4. Global concurrency queue (shared with playground — max 3 in-flight)
 *   5. Per-request queue timeout (20 s default)
 *
 * Supports streaming (SSE, OpenAI format) and non-streaming (JSON).
 */

import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod/v4';
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite.js';
import { countTokens, calcCost } from '../lib/token-utils.js';
import { hashApiKey } from '../lib/key-hash.js';
import { resolveCoreUrl } from '../lib/core-url.js';
import { checkRateLimit, setRateLimitHeaders, RATE_LIMIT_FREE, RATE_LIMIT_PAID } from '../lib/rate-limiter.js';
import {
  gatekeeperQueue,
  QueueFullError,
  QueueTimeoutError,
  QueueClearedError,
} from '../lib/gatekeeper-queue.js';

// `Response` in this file refers to Express's Response.
// fetch() results use this separate alias to avoid the name clash.
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

// ─── Ollama SSE parser ────────────────────────────────────────────────────────

async function* parseOllamaStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ content: string; rawLine: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let leftover = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = leftover + decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const raw = trimmed.slice(6);
        if (raw === '[DONE]') return;
        try {
          const chunk = JSON.parse(raw) as { choices?: { delta?: { content?: string } }[] };
          const content = chunk?.choices?.[0]?.delta?.content ?? '';
          yield { content, rawLine: trimmed + '\n' };
        } catch { /* malformed chunk */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

router.options('/chat/completions', (_req: Request, res: Response) => {
  res.set(CORS_HEADERS).status(204).end();
});

// ─── POST /v1/chat/completions ────────────────────────────────────────────────

router.post('/chat/completions', async (req: Request, res: Response) => {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const authHeader = (req.headers.authorization as string) ?? '';
  const keyString = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
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

    // ── 4. Get user prefs ──────────────────────────────────────────────────
    let user: Awaited<ReturnType<typeof users.get>>;
    try {
      user = await users.get(userId);
    } catch {
      res.set(CORS_HEADERS);
      jsonError(res, 'Service temporarily unavailable. Please retry.', 'server_error', 503);
      return;
    }

    const prefs = (user.prefs ?? {}) as Record<string, number | string>;
    const tokensRemaining = Number(prefs.mesurado_tokens_remaining ?? 0);
    const isPaidPlan = (prefs.mesurado_plan ?? 'free') !== 'free';

    // ── 5. Balance check ───────────────────────────────────────────────────
    const promptTokens = countTokens(messages.map(m => m.content).join(' '));
    const maxEstimate = promptTokens + max_tokens;

    if (tokensRemaining < promptTokens) {
      jsonError(res, 'Token balance exhausted. Log in to your Mesurado dashboard to add funds.', 'insufficient_quota', 402);
      return;
    }

    // ── 6. Rate limit ──────────────────────────────────────────────────────
    const defaultLimit = isPaidPlan ? RATE_LIMIT_PAID : RATE_LIMIT_FREE;
    const rateResult = await checkRateLimit(`key:${keyDoc.$id}`, defaultLimit, userId);

    res.set(CORS_HEADERS);
    setRateLimitHeaders(res, rateResult);

    if (!rateResult.allowed) {
      jsonError(res, `Rate limit exceeded. You may make ${rateResult.limit} requests per minute.`, 'rate_limit_error', 429);
      return;
    }

    // ── 7. Engine config ───────────────────────────────────────────────────
    const coreUrl = resolveCoreUrl();
    const masterToken = process.env.MESURADO_MASTER_TOKEN;
    if (!coreUrl || !masterToken) {
      jsonError(res, 'Mesurado engine is not configured on this gateway.', 'server_error', 503);
      return;
    }

    // ── 8. Pre-charge ──────────────────────────────────────────────────────
    const preChargedBalance = Math.max(0, tokensRemaining - maxEstimate);
    let preChargeApplied = false;
    let reconciled = false;

    try {
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: preChargedBalance });
      preChargeApplied = true;
    } catch {
      jsonError(res, 'Service temporarily unavailable. Please retry.', 'server_error', 503);
      return;
    }

    // Helper: restore pre-charge on explicit error paths
    async function restorePrecharge(): Promise<void> {
      reconciled = true; // Treat explicit rollback as "resolved" — no double-restore
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining }).catch(() => {});
    }

    // ── 9. Acquire concurrency slot ────────────────────────────────────────
    let release: (() => void) | null = null;
    req.on('close', () => { release?.(); release = null; });

    try {
      release = await gatekeeperQueue.acquire();
    } catch (err) {
      await restorePrecharge();
      if (err instanceof QueueFullError) {
        jsonError(res, 'Mesurado is at capacity. Please retry in a few seconds.', 'rate_limit_error', 429);
      } else if (err instanceof QueueTimeoutError || err instanceof QueueClearedError) {
        jsonError(res, 'Mesurado engine is scaling or unreachable.', 'server_error', 503);
      } else {
        jsonError(res, 'Internal server error', 'server_error', 500);
      }
      return;
    }

    // Slot acquired. Everything from here is wrapped in try/finally to guarantee release.
    try {
      // ── 10. Call Gatekeeper ──────────────────────────────────────────────
      let aiRes: FetchResponse;
      try {
        aiRes = await fetch(`${coreUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Mesurado-Auth': masterToken },
          body: JSON.stringify({
            model: 'mesurado-llama3.2-3b',
            messages,
            temperature,
            max_tokens,
            stream,
          }),
          signal: AbortSignal.timeout(90_000),
        });
      } catch {
        await restorePrecharge();
        jsonError(res, 'Mesurado engine is scaling or unreachable.', 'server_error', 502);
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

      const contentType = aiRes.headers.get('content-type') ?? '';

      // ── 11a. Streaming response ────────────────────────────────────────────
      if (stream) {
        res.set({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();

        let completionText = '';

        // Stream and buffer simultaneously. Release slot before billing.
        if (contentType.includes('text/event-stream') && aiRes.body) {
          for await (const { content, rawLine } of parseOllamaStream(aiRes.body as ReadableStream<Uint8Array>)) {
            completionText += content;
            if (!res.destroyed) res.write(rawLine + '\n');
            if (res.destroyed) break;
          }
        } else {
          // Gatekeeper returned JSON even though we asked for SSE — synthesise one chunk
          const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] };
          completionText = aiData.choices?.[0]?.message?.content ?? '';
          if (completionText) {
            const chunk = JSON.stringify({
              id: generateChatId(),
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'mesurado-llama3.2-3b',
              choices: [{ index: 0, delta: { content: completionText }, finish_reason: null }],
            });
            if (!res.destroyed) res.write(`data: ${chunk}\n\n`);
          }
        }

        // Release slot before billing so queue drains as quickly as possible
        release();
        release = null;

        // Billing — do not fail the response on billing error
        const completionTokens = countTokens(completionText);
        const actualTotal = promptTokens + completionTokens;
        const costDebit = calcCost(actualTotal);
        const refund = Math.max(0, maxEstimate - actualTotal);
        const finalBalance = Math.min(tokensRemaining, preChargedBalance + refund);
        const newTotalUsed = Number(prefs.mesurado_total_tokens_used ?? 0) + actualTotal;

        try {
          await Promise.all([
            users.updatePrefs(userId, {
              ...prefs,
              mesurado_tokens_remaining: finalBalance,
              mesurado_total_tokens_used: newTotalUsed,
            }),
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
        } catch (billingErr) {
          req.log.error({ err: billingErr, userId },
            '[billing] token deduction failed after stream — manual review needed');
        }
        reconciled = true; // billing phase complete (success or logged error)

        if (!res.destroyed) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
        return;
      }

      // ── 11b. Non-streaming response ────────────────────────────────────────
      let aiContent: string;
      if (contentType.includes('text/event-stream') && aiRes.body) {
        // Gatekeeper streamed even though we didn't request it — buffer it all
        let buffered = '';
        for await (const { content } of parseOllamaStream(aiRes.body as ReadableStream<Uint8Array>)) {
          buffered += content;
        }
        aiContent = buffered;
      } else {
        const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] };
        aiContent = aiData.choices?.[0]?.message?.content ?? '';
      }

      // Release slot — we have the full response in memory now
      release();
      release = null;

      // Finalize token accounting
      const completionTokens = countTokens(aiContent);
      const actualTotal = promptTokens + completionTokens;
      const costDebit = calcCost(actualTotal);
      const refund = Math.max(0, maxEstimate - actualTotal);
      const finalBalance = Math.min(tokensRemaining, preChargedBalance + refund);
      const newTotalUsed = Number(prefs.mesurado_total_tokens_used ?? 0) + actualTotal;

      try {
        await Promise.all([
          users.updatePrefs(userId, {
            ...prefs,
            mesurado_tokens_remaining: finalBalance,
            mesurado_total_tokens_used: newTotalUsed,
          }),
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
      } catch (billingErr) {
        req.log.error({ err: billingErr, userId },
          '[billing] token deduction failed — manual review needed');
      }
      reconciled = true; // billing phase complete (success or logged error)

      res.json({
        id: generateChatId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'mesurado-llama3.2-3b',
        choices: [
          { index: 0, message: { role: 'assistant', content: aiContent }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: actualTotal },
      });
    } finally {
      // Always release the concurrency slot, even on unexpected exceptions.
      // The slot's release function is one-shot (safe to call multiple times).
      release?.();
      release = null;
      // If pre-charge was applied but billing was never reconciled (unexpected throw),
      // restore the user's original balance so they are not over-debited.
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
