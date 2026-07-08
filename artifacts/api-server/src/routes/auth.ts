import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod/v4';
import { createAdminClient, createAuthClient, DEFAULT_PREFS } from '../lib/appwrite.js';
import { signToken, getSession, SESSION_COOKIE } from '../lib/auth.js';
import { ID } from 'node-appwrite';

const router: IRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30 * 1000, // 30 days in ms
  path: '/',
};

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const { account } = createAuthClient();
    let session;
    try {
      session = await account.createEmailPasswordSession(email, password);
    } catch {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const userId = session.userId;
    const token = await signToken(userId, email);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS);

    const { users } = createAdminClient();
    const user = await users.get(userId);
    res.json({ success: true, userId, email, name: user.name });
  } catch (err) {
    req.log.error({ err }, '[POST /api/auth/login]');
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password, name } = parsed.data;

  try {
    const { users } = createAdminClient();
    let user;
    try {
      user = await users.create(ID.unique(), email, undefined, password, name);
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err);
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('conflict')) {
        res.status(409).json({ error: 'An account with this email already exists' });
        return;
      }
      throw err;
    }

    await users.updatePrefs(user.$id, DEFAULT_PREFS);
    const token = await signToken(user.$id, email);
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTS);
    res.json({ success: true, userId: user.$id, email: user.email, name: user.name });
  } catch (err) {
    req.log.error({ err }, '[POST /api/auth/signup]');
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = await getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ userId: session.userId, email: session.email });
});

export default router;
