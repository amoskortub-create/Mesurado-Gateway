import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod/v4';
import { createAdminClient, DATABASE_ID, COLLECTIONS, ID, Query } from '../lib/appwrite.js';
import { getSession, SESSION_COOKIE } from '../lib/auth.js';
import { hashApiKey, keyPrefix } from '../lib/key-hash.js';

const router: IRouter = Router();

async function requireSession(req: Request, res: Response): Promise<{ userId: string; email: string } | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = await getSession(token);
  if (!session) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return session;
}

function generateKeyString(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `mesurado_sk_live_${hex}`;
}

// GET /api/keys/list
router.get('/list', async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { databases } = createAdminClient();
    const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.API_KEYS, [
      Query.equal('user_id', session.userId),
      Query.orderDesc('created_at'),
      Query.limit(100),
    ]);

    const keys = result.documents.map(doc => ({
      $id: doc.$id,
      label: doc.label,
      key_prefix: doc.key_prefix ?? '',
      is_active: doc.is_active,
      created_at: doc.created_at,
    }));

    res.json({ keys });
  } catch (err) {
    req.log.error({ err }, '[GET /api/keys/list]');
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// POST /api/keys/generate
router.post('/generate', async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const schema = z.object({ label: z.string().min(1, 'Label is required').max(100).trim() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  try {
    const keyString = generateKeyString();
    const keyHash = await hashApiKey(keyString);
    const prefix = keyPrefix(keyString);
    const { databases } = createAdminClient();

    await databases.createDocument(DATABASE_ID, COLLECTIONS.API_KEYS, ID.unique(), {
      user_id: session.userId,
      key_hash: keyHash,
      key_prefix: prefix,
      label: parsed.data.label,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, keyString });
  } catch (err) {
    req.log.error({ err }, '[POST /api/keys/generate]');
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// DELETE /api/keys/delete
router.delete('/delete', async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const schema = z.object({ key_id: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'key_id is required' });
    return;
  }

  try {
    const { databases } = createAdminClient();
    let doc;
    try {
      doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.API_KEYS, parsed.data.key_id);
    } catch {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    if (String(doc.user_id) !== session.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!doc.is_active) {
      res.status(409).json({ error: 'API key is already deactivated' });
      return;
    }

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.API_KEYS, parsed.data.key_id, { is_active: false });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, '[DELETE /api/keys/delete]');
    res.status(500).json({ error: 'Failed to deactivate key' });
  }
});

export default router;
