/**
 * Admin endpoints for queue and rate-limit management.
 *
 * All routes require an Administrator-labelled Appwrite user.
 *
 * GET  /api/admin/queue-status        — snapshot of queue + slot state
 * POST /api/admin/clear-queue         — drain queue, send 503 to waiting clients
 * POST /api/admin/adjust-rate-limit   — set a per-user rate limit override
 */

import { Router, type Request, type Response, type NextFunction, type IRouter } from 'express';
import { z } from 'zod/v4';
import { isAdminUser } from '../lib/appwrite.js';
import { getSession, SESSION_COOKIE } from '../lib/auth.js';
import { gatekeeperQueue } from '../lib/gatekeeper-queue.js';
import {
  setOverrideLimit,
  clearOverrideLimit,
  getOverrideLimit,
  RATE_LIMIT_FREE,
  RATE_LIMIT_PAID,
} from '../lib/rate-limiter.js';
import { REDIS_AVAILABLE } from '../lib/redis.js';

const router: IRouter = Router();

// ─── Admin middleware ─────────────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = await getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const admin = await isAdminUser(session.userId);
  if (!admin) {
    res.status(403).json({ error: 'Forbidden — Administrator role required' });
    return;
  }
  next();
}

// ─── GET /api/admin/queue-status ──────────────────────────────────────────────

router.get('/queue-status', requireAdmin, (_req: Request, res: Response) => {
  const status = gatekeeperQueue.status();
  res.json({
    redisBackend: REDIS_AVAILABLE,
    queue: status,
    rateLimits: {
      freeUsersPerMinute: RATE_LIMIT_FREE,
      paidUsersPerMinute: RATE_LIMIT_PAID,
      note: 'Per-user overrides stored in Redis at rate_limit_override:{userId}',
    },
  });
});

// ─── POST /api/admin/clear-queue ─────────────────────────────────────────────

router.post('/clear-queue', requireAdmin, (req: Request, res: Response) => {
  const dropped = gatekeeperQueue.clearQueue();
  req.log.warn({ dropped }, '[admin] queue cleared by administrator');
  res.json({
    success: true,
    droppedRequests: dropped,
    message: `${dropped} queued request(s) rejected with 503.`,
  });
});

// ─── POST /api/admin/adjust-rate-limit ───────────────────────────────────────

const adjustSchema = z.object({
  user_id: z.string().min(1),
  new_limit: z.number().int().min(0).max(10_000),
  action: z.enum(['set', 'clear']).optional().default('set'),
});

router.post('/adjust-rate-limit', requireAdmin, async (req: Request, res: Response) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { user_id, new_limit, action } = parsed.data;

  try {
    if (action === 'clear') {
      await clearOverrideLimit(user_id);
      req.log.info({ userId: user_id }, '[admin] rate limit override cleared');
      res.json({ success: true, userId: user_id, message: 'Rate limit override cleared — user falls back to plan defaults.' });
    } else {
      await setOverrideLimit(user_id, new_limit);
      req.log.info({ userId: user_id, newLimit: new_limit }, '[admin] rate limit override set');
      res.json({
        success: true,
        userId: user_id,
        newLimit: new_limit,
        message: `Rate limit for user ${user_id} set to ${new_limit} req/min.`,
      });
    }
  } catch (err) {
    req.log.error({ err }, '[POST /api/admin/adjust-rate-limit]');
    res.status(500).json({ error: 'Failed to update rate limit override' });
  }
});

// ─── GET /api/admin/rate-limit-override (helper) ─────────────────────────────

router.get('/rate-limit-override', requireAdmin, async (req: Request, res: Response) => {
  const userId = typeof req.query.user_id === 'string' ? req.query.user_id : null;
  if (!userId) {
    res.status(400).json({ error: 'user_id query param required' });
    return;
  }

  try {
    const override = await getOverrideLimit(userId);
    res.json({
      userId,
      override,
      effectiveLimit: override ?? null,
      note: override === null ? 'No override set — plan defaults apply' : 'Override active',
    });
  } catch (err) {
    req.log.error({ err }, '[GET /api/admin/rate-limit-override]');
    res.status(500).json({ error: 'Failed to fetch override' });
  }
});

export default router;
