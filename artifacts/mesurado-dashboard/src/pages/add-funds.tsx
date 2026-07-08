import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wallet, ChevronRight, Clock, Upload, X, AlertCircle,
  CheckCircle2, Phone, Receipt, ImageIcon, RefreshCw, History,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingPayment {
  payment_id: string;
  unique_code: string;
  ussd_code: string;
  amount_usd: number;
  expires_at: string;
}

interface HistoryPayment {
  id: string;
  amount_usd: number;
  unique_code: string;
  status: string;
  proof_submitted: boolean;
  expires_at: string;
  created_at: string;
  reviewed_at: string;
  admin_note: string;
}

type Step = 'select' | 'payment' | 'proof' | 'submitted';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];
const TOKENS_PER_USD = 1_000_000 / 0.75;

function calcTokens(usd: number): number {
  return Math.floor(usd * TOKENS_PER_USD);
}

function fmtTokens(n: number): string {
  return n.toLocaleString('en-US');
}

function useCountdown(expiresAt: string | undefined) {
  const [display, setDisplay] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setDisplay('Expired'); setExpired(true); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { display, expired };
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
    paid: { label: 'Under Review', cls: 'bg-blue-50 text-blue-700' },
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
    expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AddFundsPage() {
  const [step, setStep] = useState<Step>('select');
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [history, setHistory] = useState<HistoryPayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Proof form
  const [phone, setPhone] = useState('');
  const [txId, setTxId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [proofError, setProofError] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { display: countdown, expired: countdownExpired } = useCountdown(pending?.expires_at);

  const loadPayments = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const r = await fetch('/api/payments/my-payments', { credentials: 'include' });
      if (!r.ok) return;
      const data = await r.json() as { payments: HistoryPayment[] };
      setHistory(data.payments ?? []);

      // Check for active pending payment
      const activePending = data.payments.find(
        (p) => p.status === 'pending' && new Date(p.expires_at) > new Date(),
      );
      if (activePending) {
        setPending({
          payment_id: activePending.id,
          unique_code: activePending.unique_code,
          ussd_code: `*156*1*1*1*0889322188*2*${activePending.amount_usd}*${activePending.unique_code}#`,
          amount_usd: activePending.amount_usd,
          expires_at: activePending.expires_at,
        });
        setStep('payment');
      }
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  // Reset proof form when screenshot changes
  useEffect(() => {
    if (!screenshot) { setScreenshotPreview(''); return; }
    const url = URL.createObjectURL(screenshot);
    setScreenshotPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const effectiveAmount = amount ?? (customAmount ? parseInt(customAmount, 10) : null);

  async function handleGenerate() {
    if (!effectiveAmount || effectiveAmount < 5 || effectiveAmount > 500) return;
    setGenerating(true);
    setError('');
    try {
      const r = await fetch('/api/payments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount_usd: effectiveAmount }),
      });
      const data = await r.json() as { payment_id?: string; unique_code?: string; ussd_code?: string; amount_usd?: number; expires_at?: string; error?: string };
      if (!r.ok) { setError(data.error ?? 'Failed to generate payment'); return; }
      setPending({
        payment_id: data.payment_id!,
        unique_code: data.unique_code!,
        ussd_code: data.ussd_code!,
        amount_usd: data.amount_usd!,
        expires_at: data.expires_at!,
      });
      setStep('payment');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleProofSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProofError('');

    if (!phone.match(/^0(88|55)\d{7}$/)) {
      setProofError('Phone must be MTN (088XXXXXXX) or Lonestar (055XXXXXXX) — 10 digits');
      return;
    }
    if (!txId.trim()) {
      setProofError('Transaction ID is required');
      return;
    }
    if (!screenshot) {
      setProofError('Screenshot is required');
      return;
    }

    setSubmittingProof(true);
    try {
      const fd = new FormData();
      fd.append('payment_id', pending!.payment_id);
      fd.append('phone_number', phone);
      fd.append('transaction_id', txId.trim());
      fd.append('screenshot', screenshot);

      const r = await fetch('/api/payments/proof', {
        method: 'POST',
        body: fd,
        credentials: 'include',
        // NOTE: Do NOT set Content-Type — let browser set it with the boundary
      });
      const data = await r.json() as { success?: boolean; error?: string };
      if (!r.ok) { setProofError(data.error ?? 'Submission failed'); return; }

      setStep('submitted');
      loadPayments();
    } catch {
      setProofError('Network error. Please try again.');
    } finally {
      setSubmittingProof(false);
    }
  }

  function handleStartNew() {
    setPending(null);
    setAmount(null);
    setCustomAmount('');
    setStep('select');
    setError('');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Add Funds</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Pay via MTN Mobile Money — merchant: <span className="font-semibold text-foreground">Amos Kortu</span> · 0889322188
        </p>
      </div>

      {/* ── Step: Select Amount ─────────────────────────────────────────── */}
      {step === 'select' && (
        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-foreground mb-1">Select amount (USD)</h3>
            <p className="text-xs text-muted-foreground">All amounts in US Dollars. Rate: $0.75 = 1,000,000 tokens.</p>
          </div>

          {/* Preset buttons */}
          <div className="grid grid-cols-5 gap-2">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => { setAmount(a); setCustomAmount(''); }}
                className={[
                  'py-3 rounded-xl text-sm font-bold border-2 transition',
                  amount === a && !customAmount
                    ? 'text-white border-transparent'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
                ].join(' ')}
                style={amount === a && !customAmount ? { background: 'hsl(0 72% 51%)', borderColor: 'hsl(0 72% 51%)' } : {}}
              >
                ${a}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Custom amount ($5 – $500)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
              <input
                type="number"
                min={5}
                max={500}
                step={1}
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setAmount(null); }}
                placeholder="Enter amount"
                className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Token preview */}
          {effectiveAmount && effectiveAmount >= 5 && effectiveAmount <= 500 && (
            <div className="rounded-xl p-4 border" style={{ background: 'hsl(217 72% 47% / 0.06)', borderColor: 'hsl(217 72% 47% / 0.25)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">${effectiveAmount}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
                <span className="text-sm font-extrabold" style={{ color: 'hsl(217 72% 47%)' }}>
                  {fmtTokens(calcTokens(effectiveAmount))} tokens
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                = {fmtTokens(calcTokens(effectiveAmount))} tokens added to your balance
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!effectiveAmount || effectiveAmount < 5 || effectiveAmount > 500 || generating}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            {generating ? (
              <><RefreshCw size={16} className="animate-spin" /> Generating…</>
            ) : (
              <><Wallet size={16} /> Generate Payment Code</>
            )}
          </button>
        </div>
      )}

      {/* ── Step: Payment Details ───────────────────────────────────────── */}
      {step === 'payment' && pending && (
        <div className="space-y-4">
          {/* Expiry banner */}
          <div className={[
            'rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium',
            countdownExpired
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700',
          ].join(' ')}>
            <Clock size={14} className="flex-shrink-0" />
            {countdownExpired
              ? 'This payment has expired. Generate a new one.'
              : <><span className="font-bold">Expires in:</span> {countdown}</>}
          </div>

          {countdownExpired && (
            <button onClick={handleStartNew} className="w-full py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground hover:border-primary hover:text-primary transition">
              Generate New Payment
            </button>
          )}

          {!countdownExpired && (
            <>
              {/* Unique code */}
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Unique Code</div>
                <div className="text-4xl font-extrabold tracking-widest tabular-nums" style={{ color: 'hsl(0 72% 51%)' }}>
                  {pending.unique_code}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This code ties your payment to your account. It expires in 24 hours.
                </p>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Amount</div>
                  <div className="text-2xl font-extrabold text-foreground">
                    ${pending.amount_usd} USD
                    <span className="ml-3 text-sm font-medium text-muted-foreground">
                      → {fmtTokens(calcTokens(pending.amount_usd))} tokens
                    </span>
                  </div>
                </div>
              </div>

              {/* USSD code */}
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">USSD Code to Dial</div>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-lg md:text-xl font-mono font-bold text-foreground tracking-wider break-all">
                    {pending.ussd_code}
                  </code>
                  <a
                    href={`tel:${pending.ussd_code.replace(/\*/g, '%2A').replace(/#/g, '%23')}`}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border"
                    style={{ background: 'hsl(142 76% 45% / 0.1)', borderColor: 'hsl(142 76% 45%)', color: 'hsl(142 76% 38%)' }}
                  >
                    <Phone size={13} /> Dial
                  </a>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-foreground mb-4">How to Pay</h4>
                <ol className="space-y-3">
                  {[
                    { n: 1, text: 'Tap the green "Dial" button above — it opens your phone dialer with the code pre-filled. Just press call.' },
                    { n: 2, text: 'Follow the MTN Mobile Money prompts. The amount is in USD equivalent.' },
                    { n: 3, text: 'After payment, you will receive a confirmation SMS with a transaction ID.' },
                    { n: 4, text: 'Return to this page and click "I Have Paid" below.' },
                    { n: 5, text: 'Enter the phone number you paid from, the transaction ID from your SMS, and upload a screenshot.' },
                    { n: 6, text: 'Submit for verification. Tokens are added once our team approves.' },
                  ].map(({ n, text }) => (
                    <li key={n} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center text-white" style={{ background: 'hsl(0 72% 51%)' }}>{n}</span>
                      <span className="text-sm text-muted-foreground pt-0.5">{text}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <button
                onClick={() => setStep('proof')}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: 'hsl(217 72% 47%)' }}
              >
                <CheckCircle2 size={16} /> I Have Paid — Submit Proof
              </button>

              <button onClick={handleStartNew} className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition">
                Cancel and generate a new code
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Step: Proof Submission ──────────────────────────────────────── */}
      {step === 'proof' && pending && (
        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Receipt size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">Submit Payment Proof</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Unique code <span className="font-bold text-foreground">{pending.unique_code}</span> · ${pending.amount_usd} USD
          </p>

          <form onSubmit={handleProofSubmit} className="space-y-5">
            {/* Phone number */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                <Phone size={11} className="inline mr-1" />MTN Phone Number You Paid From
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0881234567 or 0551234567"
                maxLength={10}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Format: 088XXXXXXX (MTN) or 055XXXXXXX (Lonestar)</p>
            </div>

            {/* Transaction ID */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                <Receipt size={11} className="inline mr-1" />MTN Transaction ID
              </label>
              <input
                type="text"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                placeholder="e.g. MP250101.1234.A12345"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Copy the exact transaction ID from your MTN confirmation SMS.</p>
            </div>

            {/* Screenshot */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                <ImageIcon size={11} className="inline mr-1" />Screenshot of MTN Confirmation
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              />

              {screenshotPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={screenshotPreview} alt="Screenshot preview" className="w-full max-h-48 object-contain bg-muted" />
                  <button
                    type="button"
                    onClick={() => { setScreenshot(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition"
                >
                  <Upload size={24} />
                  <span className="text-sm font-medium">Click to upload screenshot</span>
                  <span className="text-xs">JPEG or PNG, max 5 MB</span>
                </button>
              )}
            </div>

            {proofError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                {proofError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setStep('payment'); setProofError(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground hover:border-primary hover:text-primary transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submittingProof}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'hsl(0 72% 51%)' }}
              >
                {submittingProof ? (
                  <><RefreshCw size={14} className="animate-spin" /> Submitting…</>
                ) : (
                  <>Submit Proof</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Step: Submitted Confirmation ────────────────────────────────── */}
      {step === 'submitted' && (
        <div className="bg-card border border-card-border rounded-2xl p-8 shadow-sm flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'hsl(142 76% 45% / 0.1)' }}>
            <CheckCircle2 size={32} style={{ color: 'hsl(142 76% 38%)' }} />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-foreground">Proof Submitted</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We received your payment proof. Our team will review it shortly and add your tokens once verified.
              You will receive an email confirmation.
            </p>
          </div>
          <button
            onClick={handleStartNew}
            className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground hover:border-primary hover:text-primary transition"
          >
            Back to Add Funds
          </button>
        </div>
      )}

      {/* ── Payment History ─────────────────────────────────────────────── */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-primary" />
            <h3 className="font-bold text-foreground">Payment History</h3>
          </div>
          <button onClick={loadPayments} className="text-muted-foreground hover:text-foreground transition">
            <RefreshCw size={14} />
          </button>
        </div>

        {loadingHistory ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : history.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No payment history yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Date', 'Amount', 'Unique Code', 'Status', 'Note'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-foreground">${p.amount_usd}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground tracking-widest">{p.unique_code}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{p.admin_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
