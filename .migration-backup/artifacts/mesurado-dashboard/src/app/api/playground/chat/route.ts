import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID } from '@/lib/appwrite-server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { countTokens, calcCost } from '@/lib/utils';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
  temperature: z.number().min(0).max(2).optional().default(0.75),
  system_prompt: z.string().max(4000).optional().default(''),
  max_tokens: z.number().int().min(1).max(4096).optional().default(500),
});

export async function POST(req: NextRequest) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { messages, temperature, system_prompt, max_tokens } = parsed.data;

  try {
    const { users, databases } = createAdminClient();
    const user = await users.get(session.userId);
    const prefs = (user.prefs ?? {}) as Record<string, number | string>;
    const tokensRemaining = Number(prefs.mesurado_tokens_remaining ?? 0);

    // Count prompt tokens
    const promptText = [system_prompt, ...messages.map((m) => m.content)].join(' ');
    const promptTokens = countTokens(promptText);

    // Pre-charge: reserve worst-case tokens to prevent overdraft
    const maxEstimate = promptTokens + max_tokens;
    if (tokensRemaining < promptTokens) {
      return NextResponse.json(
        { error: 'Token balance exhausted. Add funds to continue.' },
        { status: 402 },
      );
    }
    const preChargedBalance = Math.max(0, tokensRemaining - maxEstimate);

    // Lock balance before calling AI (prevents overdraft on concurrent requests)
    await users.updatePrefs(session.userId, {
      ...prefs,
      mesurado_tokens_remaining: preChargedBalance,
    });

    // Call AI server
    const coreUrl = process.env.MESURADO_CORE_URL;
    const masterToken = process.env.MESURADO_MASTER_TOKEN;
    if (!coreUrl || !masterToken) {
      // Refund pre-charge on config error
      await users.updatePrefs(session.userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
      return NextResponse.json(
        { error: 'AI server not configured. Set MESURADO_CORE_URL and MESURADO_MASTER_TOKEN.' },
        { status: 503 },
      );
    }

    let aiContent: string;
    try {
      const aiMessages = system_prompt
        ? [{ role: 'system', content: system_prompt }, ...messages]
        : messages;

      const aiRes = await fetch(`${coreUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mesurado-Auth': masterToken,
        },
        body: JSON.stringify({
          model: 'mesurado-llama3.2-3b',
          messages: aiMessages,
          temperature,
          max_tokens,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!aiRes.ok) {
        // Refund pre-charge on upstream error
        await users.updatePrefs(session.userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
        return NextResponse.json(
          { error: 'Mesurado engine core is scaling or unreachable. Please retry.' },
          { status: 502 },
        );
      }

      const aiData = (await aiRes.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      aiContent = aiData.choices?.[0]?.message?.content ?? '';
    } catch {
      // Refund pre-charge on network error
      await users.updatePrefs(session.userId, { ...prefs, mesurado_tokens_remaining: tokensRemaining });
      return NextResponse.json(
        { error: 'Mesurado engine core is scaling or unreachable. Please retry.' },
        { status: 502 },
      );
    }

    // Finalize accounting: refund unused tokens from the pre-charge
    const completionTokens = countTokens(aiContent);
    const actualTotal = promptTokens + completionTokens;
    const costDebit = calcCost(actualTotal);
    const refund = Math.max(0, maxEstimate - actualTotal);
    const finalBalance = Math.min(tokensRemaining, preChargedBalance + refund);
    const newTotalUsed = Number(prefs.mesurado_total_tokens_used ?? 0) + actualTotal;

    await Promise.all([
      users.updatePrefs(session.userId, {
        ...prefs,
        mesurado_tokens_remaining: finalBalance,
        mesurado_total_tokens_used: newTotalUsed,
      }),
      databases.createDocument(DATABASE_ID, COLLECTIONS.USAGE_LOGS, ID.unique(), {
        user_id: session.userId,
        key_id: '',
        source: 'playground',
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_debit: costDebit,
        timestamp: new Date().toISOString(),
      }),
    ]);

    return NextResponse.json({
      content: aiContent,
      promptTokens,
      completionTokens,
      totalTokens: actualTotal,
      costDebit,
      tokensRemaining: finalBalance,
    });
  } catch (error: unknown) {
    console.error('[POST /api/playground/chat]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
