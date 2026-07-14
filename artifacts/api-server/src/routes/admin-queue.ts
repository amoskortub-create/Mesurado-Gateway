/**
 * Admin endpoints for queue, slot, and rate-limit management.
 *
 * All routes require an Administrator-labelled Appwrite user.
 *
 * GET  /api/admin/queue-status            — concurrency slot state + rate limit config
 * POST /api/admin/clear-queue             — reset active_count to 0 (unstick on crash)
 * POST /api/admin/adjust-rate-limit       — set / clear per-user rate limit override
 * GET  /api/admin/rate-limit-override     — read current override for a user
 * GET  /api/admin/slots                   — live slot state from Appwrite
 * POST /api/admin/slots/reset             — hard-reset active_count to 0
 * GET  /api/admin/rate-limits             — paginated rate limit history
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod/v4';
import { isAdminUser } from '../lib/appwrite.js';
import { getSession, SESSION_COOKIE } from '../lib/auth.js';
import { getSlotsStatus, resetSlots, MAX_SLOTS } from '../lib/appwrite-gatekeeper.js';
import {
  setOverrideLimit,
  clearOverrideLimit,
  getOverrideLimit,
  listRateLimits,
  RATE_LIMIT_FREE,
  RATE_LIMIT_PAID,
} from '../lib/appwrite-rate-limiter.js';

const router = Router();

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

// ─── GET /api/admin/queue-status ─────────────────────────────────────────────

router.get('/queue-status', requireAdmin, async (_req: Request, res: Response) => {
  const slots = await getSlotsStatus();
  res.json({
    backend: 'appwrite',
    slots: {
      activeSlots:  slots.activeSlots,
      maxSlots:     slots.maxSlots,
      updatedAt:    slots.updatedAt,
    },
    rateLimits: {
      freeUsersPerMinute: RATE_LIMIT_FREE,
      paidUsersPerMinute: RATE_LIMIT_PAID,
      note: 'Per-user overrides stored in rate_limit_overrides Appwrite collection',
    },
  });
});

// ─── POST /api/admin/clear-queue ─────────────────────────────────────────────
// Resets active_count to 0 in case a server crash left it stuck.

router.post('/clear-queue', requireAdmin, async (req: Request, res: Response) => {
  try {
    const before = await getSlotsStatus();
    await resetSlots();
    req.log.warn({ before: before.activeSlots }, '[admin] gatekeeper slots reset by administrator');
    res.json({
      success: true,
      message: `Slot count reset from ${before.activeSlots} to 0.`,
    });
  } catch (err) {
    req.log.error({ err }, '[POST /api/admin/clear-queue]');
    res.status(500).json({ error: 'Failed to reset slots' });
  }
});

// ─── GET /api/admin/slots ─────────────────────────────────────────────────────

router.get('/slots', requireAdmin, async (_req: Request, res: Response) => {
  const slots = await getSlotsStatus();
  res.json({
    activeSlots: slots.activeSlots,
    maxSlots:    slots.maxSlots,
    updatedAt:   slots.updatedAt,
    configuredMax: MAX_SLOTS,
  });
});

// ─── POST /api/admin/slots/reset ─────────────────────────────────────────────

router.post('/slots/reset', requireAdmin, async (req: Request, res: Response) => {
  try {
    const before = await getSlotsStatus();
    await resetSlots();
    req.log.warn({ before: before.activeSlots }, '[admin] slots hard-reset by administrator');
    res.json({
      success: true,
      previousCount: before.activeSlots,
      message: 'active_count reset to 0.',
    });
  } catch (err) {
    req.log.error({ err }, '[POST /api/admin/slots/reset]');
    res.status(500).json({ error: 'Failed to reset slots' });
  }
});

// ─── GET /api/admin/rate-limits ──────────────────────────────────────────────

router.get('/rate-limits', requireAdmin, async (req: Request, res: Response) => {
  const userId   = typeof req.query.user_id === 'string' ? req.query.user_id : undefined;
  const page     = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));

  try {
    const result = await listRateLimits({ userId, page, pageSize });
    res.json({
      total:     result.total,
      page,
      pageSize,
      documents: result.documents,
    });
  } catch (err) {
    req.log.error({ err }, '[GET /api/admin/rate-limits]');
    res.status(500).json({ error: 'Failed to fetch rate limit history' });
  }
});

// ─── POST /api/admin/adjust-rate-limit ───────────────────────────────────────

const adjustSchema = z.object({
  user_id:   z.string().min(1),
  // new_limit is required when action='set', but optional (ignored) when action='clear'
  new_limit: z.number().int().min(0).max(10_000).optional(),
  action:    z.enum(['set', 'clear']).optional().default('set'),
}).refine(
  data => data.action === 'clear' || (data.new_limit !== undefined),
  { message: 'new_limit is required when action is "set"' },
);

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
      res.json({
        success: true,
        userId: user_id,
        message: 'Rate limit override cleared — user falls back to plan defaults.',
      });
    } else {
      // Zod's .refine() above guarantees new_limit is defined when action === 'set'.
      await setOverrideLimit(user_id, new_limit!);
      req.log.info({ userId: user_id, newLimit: new_limit }, '[admin] rate limit override set');
      res.json({
        success: true,
        userId:   user_id,
        newLimit: new_limit,
        message:  `Rate limit for user ${user_id} set to ${new_limit} req/min.`,
      });
    }
  } catch (err) {
    req.log.error({ err }, '[POST /api/admin/adjust-rate-limit]');
    res.status(500).json({ error: 'Failed to update rate limit override' });
  }
});

// ─── GET /api/admin/rate-limit-override ──────────────────────────────────────

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
