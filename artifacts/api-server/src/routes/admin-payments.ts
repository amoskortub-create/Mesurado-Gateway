import express, { Router } from 'express';
import { z } from 'zod/v4';
import {
  createAdminClient, DATABASE_ID, COLLECTIONS, STORAGE_BUCKET_ID, ID, Query, isAdminUser,
} from '../lib/appwrite.js';
import { getSession, SESSION_COOKIE } from '../lib/auth.js';
import { emailPaymentApproved, emailPaymentRejected } from '../lib/email.js';

const router = Router();

// ── Admin middleware ───────────────────────────────────────────────────────────

interface AdminRequest extends express.Request {
  adminUserId: string;
  adminEmail: string;
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
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

  (req as AdminRequest).adminUserId = session.userId;
  (req as AdminRequest).adminEmail = session.email;
  next();
}

// ── GET /api/admin/payments ───────────────────────────────────────────────────

router.get('/payments', requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'paid';
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 25)));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  try {
    const { databases } = createAdminClient();

    const filters: Parameters<typeof databases.listDocuments>[2] = [];

    if (status !== 'all') {
      filters.push(Query.equal('status', status));
    }

    if (search) {
      // Appwrite doesn't support OR queries easily — we'll search by email
      filters.push(Query.search('user_email', search));
    }

    filters.push(Query.orderDesc('$createdAt'));
    filters.push(Query.limit(limit));
    filters.push(Query.offset(offset));

    const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENTS, filters);

    const payments = result.documents.map((d) => ({
      id: d.$id,
      user_id: d.user_id,
      user_email: d.user_email,
      amount_usd: d.amount_usd,
      unique_code: d.unique_code,
      ussd_code: d.ussd_code,
      status: d.status,
      proof_submitted: d.proof_submitted,
      proof_transaction_id: d.proof_transaction_id,
      proof_phone_number: d.proof_phone_number,
      // Serve screenshots through our own authenticated proxy instead of the
      // raw Appwrite storage URL — the bucket has no public/anonymous read
      // permission, so a direct link 401s ("user_unauthorized") for anyone
      // without an Appwrite Console session. The proxy uses the server's
      // admin API key, gated behind requireAdmin below.
      proof_screenshot_url: d.proof_screenshot_file_id
        ? `/api/admin/payments/screenshot/${d.proof_screenshot_file_id}`
        : d.proof_screenshot_url,
      expires_at: d.expires_at,
      created_at: d.$createdAt,
      reviewed_at: d.reviewed_at,
      reviewed_by: d.reviewed_by,
      admin_note: d.admin_note,
    }));

    res.json({ payments, total: result.total, page, limit });
  } catch (err) {
    req.log.error({ err }, '[GET /api/admin/payments]');
    res.status(500).json({ error: 'Failed to fetch admin payments' });
  }
});

// ── GET /api/admin/payments/screenshot/:fileId ────────────────────────────────
// Streams a payment-proof screenshot from the private Appwrite Storage
// bucket using the server's admin API key. Keeps the bucket non-public while
// still letting admins view proofs in the browser.

router.get('/payments/screenshot/:fileId', requireAdmin, async (req, res) => {
  const fileId = String(req.params.fileId);
  try {
    const { storage } = createAdminClient();
    const [buffer, file] = await Promise.all([
      storage.getFileView(STORAGE_BUCKET_ID, fileId),
      storage.getFile(STORAGE_BUCKET_ID, fileId),
    ]);
    res.setHeader('Content-Type', file.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(buffer as ArrayBuffer));
  } catch (err) {
    req.log.error({ err, fileId }, '[GET /api/admin/payments/screenshot/:fileId]');
    res.status(404).json({ error: 'Screenshot not found' });
  }
});

// ── GET /api/admin/payments/stats ─────────────────────────────────────────────
// Revenue totals (today / this week / this month) computed from approved
// payments, plus a live count of payments awaiting review (status: paid).
// The frontend re-polls this and also re-fetches on Appwrite realtime events
// for the payments collection, so numbers update without a manual refresh.

router.get('/payments/stats', requireAdmin, async (req, res) => {
  try {
    const { databases } = createAdminClient();

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    const dow = startOfWeek.getDay(); // 0 = Sunday
    startOfWeek.setDate(startOfWeek.getDate() - dow);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Approved payments this month cover today/week/month once bucketed —
    // fetch once from the earliest boundary we need.
    const approvedDocs: Record<string, unknown>[] = [];
    let offset = 0;
    for (;;) {
      const page = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENTS, [
        Query.equal('status', 'approved'),
        Query.greaterThanEqual('reviewed_at', startOfMonth.toISOString()),
        Query.orderDesc('reviewed_at'),
        Query.limit(100),
        Query.offset(offset),
      ]);
      approvedDocs.push(...(page.documents as unknown as Record<string, unknown>[]));
      if (page.documents.length < 100) break;
      offset += 100;
      if (offset > 5000) break; // safety cap
    }

    let today = 0, week = 0, month = 0;
    for (const d of approvedDocs) {
      const amount = Number(d.amount_usd ?? 0);
      const reviewedAt = new Date(String(d.reviewed_at));
      month += amount;
      if (reviewedAt >= startOfWeek) week += amount;
      if (reviewedAt >= startOfToday) today += amount;
    }

    const pending = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENTS, [
      Query.equal('status', 'paid'),
      Query.limit(1),
    ]);

    res.json({
      revenue: {
        today: Math.round(today * 100) / 100,
        week: Math.round(week * 100) / 100,
        month: Math.round(month * 100) / 100,
      },
      pendingCount: pending.total,
      asOf: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, '[GET /api/admin/payments/stats]');
    res.status(500).json({ error: 'Failed to compute payment stats' });
  }
});

// ── POST /api/admin/payments/approve ─────────────────────────────────────────

router.post('/payments/approve', requireAdmin, async (req, res) => {
  const schema = z.object({
    payment_id: z.string().min(1),
    admin_note: z.string().max(1000).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'payment_id is required' });
    return;
  }
  const { payment_id, admin_note } = parsed.data;
  const adminId = (req as AdminRequest).adminUserId;
  const adminEmail = (req as AdminRequest).adminEmail;

  try {
    const { databases, users } = createAdminClient();

    let doc: Record<string, unknown>;
    try {
      doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, payment_id) as Record<string, unknown>;
    } catch {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    if (doc.status !== 'paid') {
      res.status(409).json({ error: `Cannot approve a payment with status "${doc.status}" — only proof-submitted payments (status: paid) can be approved` });
      return;
    }

    const amountUsd = Number(doc.amount_usd);
    const tokensToAdd = Math.floor((amountUsd / 0.75) * 1_000_000);
    const userId = String(doc.user_id);
    const userEmail = String(doc.user_email);

    // ── CRITICAL: update payment status FIRST before any token credit ────────
    // This prevents double-crediting in concurrent approval requests.
    // Any subsequent approval request will find status='approved' and fail the
    // status check above before reaching the balance update.
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, payment_id, {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminEmail,
      admin_note: admin_note || '',
    });

    // Now credit tokens — payment is already locked to 'approved'
    const user = await users.get(userId);
    const prefs = (user.prefs ?? {}) as Record<string, number | string>;
    const currentTokens = Number(prefs.mesurado_tokens_remaining ?? 0);
    const currentPurchased = Number(prefs.mesurado_total_purchased ?? 0);

    const newPrefs = {
      ...prefs,
      mesurado_tokens_remaining: currentTokens + tokensToAdd,
      // Any approved payment makes the user a paying (payg) customer —
      // always force this to 'payg' rather than conditionally converting from
      // 'free' only. A stale/legacy plan value (e.g. a manually-set string
      // that isn't exactly 'free') must not survive an approval untouched.
      mesurado_plan: 'payg',
      mesurado_total_purchased: currentPurchased + tokensToAdd,
    };

    await users.updatePrefs(userId, newPrefs);

    // Create purchase usage log entry
    await databases.createDocument(DATABASE_ID, COLLECTIONS.USAGE_LOGS, ID.unique(), {
      user_id: userId,
      key_id: 'purchase',
      source: 'purchase',
      prompt_tokens: 0,
      completion_tokens: tokensToAdd,
      cost_debit: -amountUsd,
      timestamp: new Date().toISOString(),
    });

    emailPaymentApproved(userEmail, amountUsd, tokensToAdd).catch(() => {});

    res.json({
      success: true,
      tokens_added: tokensToAdd,
      new_balance: currentTokens + tokensToAdd,
    });
  } catch (err) {
    req.log.error({ err }, '[POST /api/admin/payments/approve]');
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// ── POST /api/admin/payments/reject ──────────────────────────────────────────

router.post('/payments/reject', requireAdmin, async (req, res) => {
  const schema = z.object({
    payment_id: z.string().min(1),
    admin_note: z.string().min(1, 'Rejection reason is required').max(1000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { payment_id, admin_note } = parsed.data;
  const adminEmail = (req as AdminRequest).adminEmail;

  try {
    const { databases } = createAdminClient();

    let doc: Record<string, unknown>;
    try {
      doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, payment_id) as Record<string, unknown>;
    } catch {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    if (doc.status !== 'paid') {
      res.status(409).json({ error: `Cannot reject a payment with status "${doc.status}" — only proof-submitted payments (status: paid) can be rejected` });
      return;
    }

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, payment_id, {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminEmail,
      admin_note,
    });

    emailPaymentRejected(
      String(doc.user_email),
      Number(doc.amount_usd),
      admin_note,
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, '[POST /api/admin/payments/reject]');
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

export default router;
