import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, RefreshCw, Check, X, ChevronDown, ChevronUp,
  Search, ExternalLink, AlertCircle,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  user_id: string;
  user_email: string;
  amount_usd: number;
  unique_code: string;
  ussd_code: string;
  status: string;
  proof_submitted: boolean;
  proof_transaction_id: string;
  proof_phone_number: string;
  proof_screenshot_url: string;
  expires_at: string;
  created_at: string;
  reviewed_at: string;
  reviewed_by: string;
  admin_note: string;
}

type FilterTab = 'paid' | 'approved' | 'rejected' | 'expired' | 'all';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'paid', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'expired', label: 'Expired' },
  { id: 'all', label: 'All' },
];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
    paid: { label: 'Pending Review', cls: 'bg-blue-50 text-blue-700' },
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
    expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ── Approve Modal ─────────────────────────────────────────────────────────────

function ApproveModal({
  payment,
  onClose,
  onDone,
}: {
  payment: Payment;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const tokens = Math.floor((payment.amount_usd / 0.75) * 1_000_000);

  async function handleApprove() {
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_id: payment.id, admin_note: note }),
      });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setError(data.error ?? 'Failed to approve'); return; }
      onDone();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'hsl(142 76% 45% / 0.15)' }}>
            <Check size={16} style={{ color: 'hsl(142 76% 38%)' }} />
          </div>
          <h3 className="font-bold text-foreground text-lg">Approve Payment</h3>
        </div>

        <div className="bg-muted/40 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">User</span><span className="font-semibold">{payment.user_email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold text-foreground">${payment.amount_usd} USD</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tokens to add</span><span className="font-bold" style={{ color: 'hsl(142 76% 38%)' }}>{tokens.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Unique code</span><span className="font-mono font-semibold">{payment.unique_code}</span></div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Admin Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Verified MTN transaction MP250101.1234"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={13} />{error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground hover:border-primary transition">Cancel</button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'hsl(142 76% 38%)' }}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? 'Approving…' : `Approve — +${tokens.toLocaleString()} tokens`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({
  payment,
  onClose,
  onDone,
}: {
  payment: Payment;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleReject() {
    if (!reason.trim()) { setError('Rejection reason is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/admin/payments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_id: payment.id, admin_note: reason.trim() }),
      });
      const data = await r.json() as { error?: string };
      if (!r.ok) { setError(data.error ?? 'Failed to reject'); return; }
      onDone();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-50">
            <X size={16} className="text-red-600" />
          </div>
          <h3 className="font-bold text-foreground text-lg">Reject Payment</h3>
        </div>

        <div className="bg-muted/40 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">User</span><span className="font-semibold">{payment.user_email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">${payment.amount_usd} USD</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-mono">{payment.proof_phone_number || '—'}</span></div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Transaction ID not found, amount mismatch, screenshot unclear…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={13} />{error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-border text-muted-foreground hover:border-primary transition">Cancel</button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
            {submitting ? 'Rejecting…' : 'Reject Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Expanded row ──────────────────────────────────────────────────────────────

function ExpandedRow({ payment }: { payment: Payment }) {
  return (
    <tr className="bg-muted/20">
      <td colSpan={9} className="px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">USSD Code</div>
            <code className="font-mono text-xs break-all">{payment.ussd_code}</code>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Phone Number</div>
            <div className="font-mono">{payment.proof_phone_number || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Transaction ID</div>
            <div className="font-mono text-xs break-all">{payment.proof_transaction_id || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Screenshot</div>
            {payment.proof_screenshot_url && payment.proof_screenshot_url !== 'upload_unavailable' ? (
              <a
                href={payment.proof_screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition"
              >
                <ExternalLink size={12} /> View Screenshot
              </a>
            ) : (
              <span className="text-muted-foreground">{payment.proof_screenshot_url === 'upload_unavailable' ? 'Upload unavailable' : '—'}</span>
            )}
          </div>
          {payment.admin_note && (
            <div className="col-span-2">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Admin Note</div>
              <div className="text-sm">{payment.admin_note}</div>
            </div>
          )}
          {payment.reviewed_at && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Reviewed</div>
              <div className="text-xs">{formatDateTime(payment.reviewed_at)}</div>
              <div className="text-xs text-muted-foreground">{payment.reviewed_by}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Expires At</div>
            <div className="text-xs">{formatDateTime(payment.expires_at)}</div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<FilterTab>('paid');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<Payment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: tab,
        page: String(page),
        limit: '25',
        ...(search ? { search } : {}),
      });
      const r = await fetch(`/api/admin/payments?${params}`, { credentials: 'include' });
      if (!r.ok) { setPayments([]); return; }
      const data = await r.json() as { payments: Payment[]; total: number };
      setPayments(data.payments ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [tab, page, search]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  function handleTabChange(t: FilterTab) {
    setTab(t);
    setPage(1);
    setExpandedId(null);
  }

  function handleModalDone() {
    setApproveTarget(null);
    setRejectTarget(null);
    fetchPayments();
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShieldCheck size={20} style={{ color: 'hsl(142 76% 38%)' }} />
            <h2 className="text-2xl font-extrabold text-foreground">Admin — Payments</h2>
          </div>
          <p className="text-muted-foreground text-sm">Review and process MTN Mobile Money payment submissions</p>
        </div>
        <button
          onClick={fetchPayments}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search + Filter tabs */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b border-border">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by email…"
              className="w-full pl-8 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={[
                'flex-shrink-0 px-5 py-3 text-sm font-semibold transition border-b-2 -mb-px',
                tab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Loading…
          </div>
        ) : payments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No payments found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Date', 'User Email', 'Amount', 'Code', 'Phone', 'Transaction ID', 'Status', 'Actions', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const isExpanded = expandedId === p.id;
                  const canApprove = p.status === 'paid';
                  const canReject = ['paid', 'pending'].includes(p.status);
                  return (
                    <>
                      <tr
                        key={p.id}
                        className="border-b border-border hover:bg-muted/20 transition cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[180px] truncate">{p.user_email}</td>
                        <td className="px-4 py-3 text-sm font-bold text-foreground">${p.amount_usd}</td>
                        <td className="px-4 py-3 text-sm font-mono tracking-widest text-foreground">{p.unique_code}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.proof_phone_number || '—'}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground max-w-[140px] truncate">{p.proof_transaction_id || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {canApprove && (
                              <button
                                onClick={() => setApproveTarget(p)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
                                style={{ background: 'hsl(142 76% 38%)' }}
                              >
                                <Check size={11} /> Approve
                              </button>
                            )}
                            {canReject && (
                              <button
                                onClick={() => setRejectTarget(p)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition"
                              >
                                <X size={11} /> Reject
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {isExpanded && <ExpandedRow key={`${p.id}-detail`} payment={p} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 25 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} total</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition">Prev</button>
              <span className="px-3 py-1">Page {page}</span>
              <button disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {approveTarget && (
        <ApproveModal payment={approveTarget} onClose={() => setApproveTarget(null)} onDone={handleModalDone} />
      )}
      {rejectTarget && (
        <RejectModal payment={rejectTarget} onClose={() => setRejectTarget(null)} onDone={handleModalDone} />
      )}
    </div>
  );
}
