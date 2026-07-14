import { Router, type Request, type Response, type IRouter } from 'express';
import multer from 'multer';
import { z } from 'zod/v4';
import {
  createAdminClient, DATABASE_ID, COLLECTIONS, STORAGE_BUCKET_ID, ID, Query,
  APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
} from '../lib/appwrite.js';
import { getSession, SESSION_COOKIE } from '../lib/auth.js';
import { checkRateLimit, retryAfterSeconds } from '../lib/rate-limit.js';
import { emailPaymentGenerated, emailProofReceived, sendEmail } from '../lib/email.js';

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireSession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = await getSession(token);
  if (!session) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return session;
}

function generateUniqueCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return ((buf[0] % 900_000) + 100_000).toString(); // 100000–999999
}

async function collisionFreeCode(databases: ReturnType<typeof createAdminClient>['databases']): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateUniqueCode();
    const hit = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENTS, [
      Query.equal('unique_code', code),
      Query.equal('status', 'pending'),
      Query.limit(1),
    ]);
    if (hit.total === 0) return code;
  }
  throw new Error('Could not generate a collision-free unique code');
}

function buildUssd(amountUsd: number, uniqueCode: string): string {
  return `*156*1*1*1*0889322188*2*${amountUsd}*${uniqueCode}#`;
}

// Multer: memory storage, images only, max 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { cb(null, true); return; }
    cb(new Error('Screenshot must be an image file (JPEG, PNG, etc.)'));
  },
});

// ── POST /api/payments/generate ───────────────────────────────────────────────

router.post('/generate', async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) return;

  if (!await checkRateLimit('payment_generate', session.userId, 5, 60 * 60 * 1000)) {
    const secs = await retryAfterSeconds('payment_generate', session.userId);
    res.status(429).json({
      error: `Too many payment requests. Try again in ${Math.ceil(secs / 60)} minute(s).`,
    });
    return;
  }

  const bodySchema = z.object({ amount_usd: z.number().int().min(5).max(500) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Amount must be a whole-dollar number between $5 and $500' });
    return;
  }
  const { amount_usd } = parsed.data;

  try {
    const { databases } = createAdminClient();
    const now = new Date().toISOString();

    // Return existing active pending payment if one exists
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENTS, [
      Query.equal('user_id', session.userId),
      Query.equal('status', 'pending'),
      Query.greaterThan('expires_at', now),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      const p = existing.documents[0];
      res.json({
        payment_id: p.$id,
        unique_code: p.unique_code,
        ussd_code: p.ussd_code,
        amount_usd: p.amount_usd,
        expires_at: p.expires_at,
        already_exists: true,
      });
      return;
    }

    const uniqueCode = await collisionFreeCode(databases);
    const ussdCode = buildUssd(amount_usd, uniqueCode);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, ID.unique(), {
      user_id: session.userId,
      user_email: session.email,
      unique_code: uniqueCode,
      amount_usd,
      ussd_code: ussdCode,
      status: 'pending',
      proof_submitted: false,
      proof_transaction_id: '',
      proof_phone_number: '',
      proof_screenshot_url: '',
      proof_screenshot_file_id: '',
      expires_at: expiresAt,
      reviewed_at: '',
      reviewed_by: '',
      admin_note: '',
    });

    emailPaymentGenerated(session.email, amount_usd, uniqueCode, ussdCode).catch(() => {});

    res.json({
      payment_id: doc.$id,
      unique_code: uniqueCode,
      ussd_code: ussdCode,
      amount_usd,
      expires_at: expiresAt,
    });
  } catch (err) {
    req.log.error({ err }, '[POST /api/payments/generate]');
    res.status(500).json({ error: 'Failed to create payment request' });
  }
});

// ── POST /api/payments/proof ──────────────────────────────────────────────────

router.post('/proof', upload.single('screenshot'), async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const bodySchema = z.object({
    payment_id: z.string().min(1),
    phone_number: z
      .string()
      .regex(/^0(88|55)\d{7}$/, 'Phone must be MTN (088XXXXXXX) or Lonestar (055XXXXXXX) format'),
    transaction_id: z.string().min(1, 'Transaction ID is required').max(100),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { payment_id, phone_number, transaction_id } = parsed.data;

  if (!req.file) {
    res.status(400).json({ error: 'Screenshot is required' });
    return;
  }

  try {
    const { databases, storage } = createAdminClient();

    let doc: Record<string, unknown>;
    try {
      doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, payment_id) as Record<string, unknown>;
    } catch {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    if (String(doc.user_id) !== session.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (doc.status !== 'pending') {
      res.status(409).json({ error: `This payment is already ${doc.status}` });
      return;
    }
    if (new Date(String(doc.expires_at)) < new Date()) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, payment_id, { status: 'expired' });
      res.status(410).json({ error: 'Payment has expired. Please generate a new one.' });
      return;
    }
    if (doc.proof_submitted) {
      res.status(409).json({ error: 'Proof has already been submitted for this payment' });
      return;
    }

    // Upload screenshot to Appwrite Storage — mandatory; proof is invalid without it
    let screenshotUrl = '';
    let screenshotFileId = '';
    try {
      const { InputFile } = await import('node-appwrite/file' as string) as {
        InputFile: { fromBuffer(buf: Buffer, name: string): unknown };
      };
      const inputFile = InputFile.fromBuffer(req.file.buffer, req.file.originalname || 'screenshot.jpg');
      const uploaded = await storage.createFile(
        STORAGE_BUCKET_ID,
        ID.unique(),
        inputFile as Parameters<typeof storage.createFile>[2],
      );
      screenshotFileId = uploaded.$id;
      screenshotUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files/${uploaded.$id}/view?project=${APPWRITE_PROJECT_ID}`;
    } catch (uploadErr) {
      req.log.error({ uploadErr }, '[payments/proof] screenshot upload failed');
      res.status(503).json({
        error: 'Screenshot upload failed. Please check that Appwrite Storage is configured and the payment_screenshots bucket exists.',
      });
      return;
    }

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, payment_id, {
      status: 'paid',
      proof_submitted: true,
      proof_transaction_id: transaction_id,
      proof_phone_number: phone_number,
      proof_screenshot_url: screenshotUrl,
      proof_screenshot_file_id: screenshotFileId,
    });

    emailProofReceived(session.email, Number(doc.amount_usd)).catch(() => {});

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: 'Mesurado AI — New Payment Proof Submitted',
        text: [
          `New proof submitted for review.`,
          `User: ${session.email}`,
          `Amount: $${doc.amount_usd} USD`,
          `Unique code: ${doc.unique_code}`,
          `Phone: ${phone_number}`,
          `Transaction ID: ${transaction_id}`,
          `\nLog in to the admin panel to approve or reject.`,
        ].join('\n'),
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, '[POST /api/payments/proof]');
    res.status(500).json({ error: 'Failed to submit payment proof' });
  }
});

// ── GET /api/payments/my-payments ─────────────────────────────────────────────

router.get('/my-payments', async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { databases } = createAdminClient();
    const nowIso = new Date().toISOString();

    // Expire stale pending payments lazily
    const stale = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENTS, [
      Query.equal('user_id', session.userId),
      Query.equal('status', 'pending'),
      Query.lessThan('expires_at', nowIso),
      Query.limit(20),
    ]);
    for (const d of stale.documents) {
      databases.updateDocument(DATABASE_ID, COLLECTIONS.PAYMENTS, d.$id, { status: 'expired' }).catch(() => {});
    }

    const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENTS, [
      Query.equal('user_id', session.userId),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]);

    const payments = result.documents.map((d) => ({
      id: d.$id,
      amount_usd: d.amount_usd,
      unique_code: d.unique_code,
      ussd_code: d.ussd_code,
      status: d.status,
      proof_submitted: d.proof_submitted,
      expires_at: d.expires_at,
      created_at: d.$createdAt,
      reviewed_at: d.reviewed_at,
      admin_note: d.admin_note,
    }));

    res.json({ payments });
  } catch (err) {
    req.log.error({ err }, '[GET /api/payments/my-payments]');
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

export default router;
