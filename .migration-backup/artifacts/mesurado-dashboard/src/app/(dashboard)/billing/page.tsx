'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Zap, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { formatNumber, formatCurrency, COST_PER_TOKEN } from '@/lib/utils';

interface UsageData {
  tokensRemaining: number;
  totalTokensUsed: number;
  plan: 'free' | 'payg';
}

export default function BillingPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/usage')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = 1_000_000;
  const used = data?.totalTokensUsed ?? 0;
  const remaining = data?.tokensRemaining ?? total;
  const pct = Math.min(100, (used / total) * 100);
  const estimatedCost = used * COST_PER_TOKEN;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Billing</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Your plan, usage, and cost estimation</p>
      </div>

      {/* Plan card */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            <CreditCard size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground">Free Plan</h3>
            <p className="text-sm text-muted-foreground">1,000,000 tokens — non-renewable</p>
          </div>
          <span
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
              remaining > 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {remaining > 0 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {remaining > 0 ? 'Active' : 'Exhausted'}
          </span>
        </div>

        {/* Token usage bar */}
        <div className="mb-2 flex justify-between text-xs font-medium">
          <span className="text-muted-foreground">{formatNumber(used)} tokens used</span>
          <span className="text-muted-foreground">{formatNumber(remaining)} remaining</span>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
          {loading ? (
            <div className="h-full w-1/3 bg-muted-foreground/30 rounded-full animate-pulse" />
          ) : (
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background:
                  pct >= 100
                    ? 'hsl(0 72% 51%)'
                    : pct > 70
                    ? 'linear-gradient(90deg, hsl(40 96% 50%), hsl(0 72% 51%))'
                    : 'linear-gradient(90deg, hsl(217 72% 47%), hsl(0 72% 51%))',
              }}
            />
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {pct.toFixed(1)}% of free tier consumed
        </p>
      </div>

      {/* Pricing breakdown */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">Pricing & Estimation</h3>
        </div>

        <div className="space-y-3 text-sm">
          {[
            { label: 'Metered rate', value: '$0.75 / 1,000,000 tokens' },
            { label: 'Free allocation', value: '1,000,000 tokens (one-time)' },
            { label: 'Tokens used', value: formatNumber(used) },
            { label: 'Tokens remaining', value: formatNumber(remaining) },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold text-foreground">{row.value}</span>
            </div>
          ))}

          <div className="flex justify-between items-center pt-3 mt-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-muted-foreground" />
              <span className="font-bold text-foreground">Estimated cost of usage</span>
            </div>
            <span className="text-xl font-extrabold text-foreground tabular-nums">
              {formatCurrency(estimatedCost)}
            </span>
          </div>
        </div>
      </div>

      {/* Plan features */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-foreground mb-4">Free Plan Includes</h3>
        <div className="space-y-2.5 text-sm">
          {[
            '1,000,000 tokens (lifetime, non-renewable)',
            'Full API access via /v1/chat/completions',
            'Playground access for testing',
            'Usage analytics & logs',
            'Multiple API key management',
            'OpenAI-compatible response format',
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
              <span className="text-muted-foreground">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add funds CTA (when exhausted) */}
      {remaining === 0 && (
        <div
          className="rounded-2xl p-5 border flex items-center gap-4"
          style={{ background: 'hsl(0 72% 51% / 0.06)', borderColor: 'hsl(0 72% 51% / 0.3)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            <CreditCard size={20} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-800">Free tier exhausted</p>
            <p className="text-sm text-red-600 mt-0.5">
              All API requests return 402 Payment Required. Upgrade to continue.
            </p>
          </div>
          <button
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0 transition hover:opacity-90"
            style={{ background: 'hsl(0 72% 51%)' }}
            onClick={() => alert('Payment integration coming soon. Contact support@mediatechliberia.com')}
          >
            Add Funds
          </button>
        </div>
      )}
    </div>
  );
}
