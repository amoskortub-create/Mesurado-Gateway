/**
 * Playground conversation persistence.
 *
 * GET  /api/playground/conversations          — list (summary only, no messages)
 * GET  /api/playground/conversations/:id      — get full conversation
 * POST /api/playground/conversations          — create new conversation
 * PUT  /api/playground/conversations/:id      — update messages / title
 * DELETE /api/playground/conversations/:id    — delete conversation
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite.js';
import { getSession, SESSION_COOKIE } from '../lib/auth.js';

const router = Router();

const createSchema = z.object({
  title:    z.string().min(1).max(200),
  messages: z.string().min(2), // JSON string
});

const updateSchema = z.object({
  messages: z.string().min(2),
  title:    z.string().min(1).max(200).optional(),
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function requireSession(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = await getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return session;
}

// ── GET /conversations ────────────────────────────────────────────────────────

router.get('/conversations', async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PLAYGROUND_CONVERSATIONS, [
      Query.equal('user_id', session.userId),
      Query.orderDesc('updated_at'),
      Query.limit(50),
      Query.select(['$id', 'title', 'created_at', 'updated_at']),
    ]);

    res.json({
      conversations: result.documents.map(d => ({
        id:         d.$id,
        title:      d.title,
        createdAt:  d.created_at,
        updatedAt:  d.updated_at,
      })),
    });
  } catch (err) {
    req.log.error({ err }, '[GET /playground/conversations]');
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// ── GET /conversations/:id ────────────────────────────────────────────────────

router.get('/conversations/:id', async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { databases } = createAdminClient();
    const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.PLAYGROUND_CONVERSATIONS, req.params.id);

    if (doc.user_id !== session.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json({
      id:        doc.$id,
      title:     doc.title,
      messages:  JSON.parse(doc.messages as string),
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e?.code === 404) { res.status(404).json({ error: 'Conversation not found' }); return; }
    req.log.error({ err }, '[GET /playground/conversations/:id]');
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// ── POST /conversations ───────────────────────────────────────────────────────

router.post('/conversations', async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  try {
    const { databases } = createAdminClient();
    const now = new Date().toISOString();
    const doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.PLAYGROUND_CONVERSATIONS, ID.unique(), {
      user_id:    session.userId,
      title:      parsed.data.title,
      messages:   parsed.data.messages,
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({ id: doc.$id });
  } catch (err) {
    req.log.error({ err }, '[POST /playground/conversations]');
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// ── PUT /conversations/:id ────────────────────────────────────────────────────

router.put('/conversations/:id', async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  try {
    const { databases } = createAdminClient();

    // Verify ownership before updating
    const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.PLAYGROUND_CONVERSATIONS, req.params.id);
    if (existing.user_id !== session.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updates: Record<string, string> = {
      messages:   parsed.data.messages,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.title) updates.title = parsed.data.title;

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.PLAYGROUND_CONVERSATIONS, req.params.id, updates);
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e?.code === 404) { res.status(404).json({ error: 'Conversation not found' }); return; }
    req.log.error({ err }, '[PUT /playground/conversations/:id]');
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// ── DELETE /conversations/:id ─────────────────────────────────────────────────

router.delete('/conversations/:id', async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { databases } = createAdminClient();
    const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.PLAYGROUND_CONVERSATIONS, req.params.id);
    if (existing.user_id !== session.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PLAYGROUND_CONVERSATIONS, req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e?.code === 404) { res.status(404).json({ error: 'Conversation not found' }); return; }
    req.log.error({ err }, '[DELETE /playground/conversations/:id]');
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
