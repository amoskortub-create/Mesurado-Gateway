/**
 * Public OpenAI-compatible developer endpoint.
 * POST /v1/chat/completions
 * Authorization: Bearer mesurado_sk_live_…
 *
 * Security: API keys are validated by hash — plaintext keys never touch the DB.
 * Quota: pre-charge pattern prevents overdraft on concurrent requests.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createAdminClient,
  DATABASE_ID,
  COLLECTIONS,
  Query,
  ID,
} from '@/lib/appwrite-server';
import { countTokens, calcCost } from '@/lib/utils';
import { hashApiKey } from '@/lib/key-hash';

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

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

function generateChatId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `chatcmpl-${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

function jsonError(message: string, type: string, status: number) {
  return NextResponse.json(
    { error: { message, type, code: status } },
    { status, headers: CORS_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Validate Authorization header ──────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const keyString = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!keyString || !keyString.startsWith('mesurado_sk_live_')) {
    return jsonError(
      'Missing or invalid Authorization header. Use: Bearer mesurado_sk_live_…',
      'invalid_request_error',
      401,
    );
  }

  // ── 2. Parse and validate request body ────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 'invalid_request_error', 400);
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0].message, 'invalid_request_error', 400);
  }

  const { messages, temperature, max_tokens } = parsed.data;

  try {
    const { databases, users } = createAdminClient();

    // ── 3. Look up API key by hash (never by plaintext) ───────────────────
    const keyHash = await hashApiKey(keyString);
    const keysResult = await databases.listDocuments(DATABASE_ID, COLLECTIONS.API_KEYS, [
      Query.equal('key_hash', keyHash),
      Query.equal('is_active', true),
      Query.limit(1),
    ]);

    if (keysResult.total === 0) {
      return jsonError('Invalid or inactive API key', 'invalid_request_error', 401);
    }

    const keyDoc = keysResult.documents[0];
    const userId = String(keyDoc.user_id);

    // ── 4. Check and pre-charge user balance ──────────────────────────────
    const user = await users.get(userId);
    const prefs = (user.prefs ?? {}) as Record<string, number | string>;
    const tokensRemaining = Number(prefs.mesurado_tokens_remaining ?? 0);

    const promptTokens = countTokens(messages.map((m) => m.content).join(' '));
    const maxEstimate = promptTokens + max_tokens;

    if (tokensRemaining < promptTokens) {
      return jsonError(
        'Token balance exhausted. Log in to your Mesurado dashboard to add funds.',
        'insufficient_quota',
        402,
      );
    }

    // Pre-charge to prevent overdraft on concurrent requests
    const preChargedBalance = Math.max(0, tokensRemaining - maxEstimate);
    await users.updatePrefs(userId, {
      ...prefs,
      mesurado_tokens_remaining: preChargedBalance,
    });

    // ── 5. Forward to Mesurado Engine Core ────────────────────────────────
    const coreUrl = process.env.MESURADO_CORE_URL;
    const masterToken = process.env.MESURADO_MASTER_TOKEN;

    if (!coreUrl || !masterToken) {
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
      return jsonError('Mesurado engine is not configured on this gateway.', 'server_error', 503);
    }

    let aiContent: string;
    try {
      const aiRes = await fetch(`${coreUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mesurado-Auth': masterToken,
        },
        body: JSON.stringify({
          model: 'mesurado-llama3.2-3b',
          messages,
          temperature,
          max_tokens,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!aiRes.ok) {
        await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
        return jsonError(
          'Mesurado engine core is scaling or unreachable. Please retry.',
          'server_error',
          502,
        );
      }

      const aiData = (await aiRes.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      aiContent = aiData.choices?.[0]?.message?.content ?? '';
    } catch {
      await users.updatePrefs(userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
      return jsonError(
        'Mesurado engine core is scaling or unreachable. Please retry.',
        'server_error',
        502,
      );
    }

    // ── 6. Finalize token accounting (refund unused pre-charge) ───────────
    const completionTokens = countTokens(aiContent);
    const actualTotal = promptTokens + completionTokens;
    const costDebit = calcCost(actualTotal);
    const refund = Math.max(0, maxEstimate - actualTotal);
    const finalBalance = Math.min(tokensRemaining, preChargedBalance + refund);
    const newTotalUsed = Number(prefs.mesurado_total_tokens_used ?? 0) + actualTotal;

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

    // ── 7. Return OpenAI-compatible response ──────────────────────────────
    return NextResponse.json(
      {
        id: generateChatId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'mesurado-llama3.2-3b',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: aiContent },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: actualTotal,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: unknown) {
    console.error('[POST /v1/chat/completions]', error);
    return jsonError('Internal server error', 'server_error', 500);
  }
}
