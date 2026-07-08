import { CreditCard, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';
import { MOCK_USAGE } from '@/lib/mock';
import { formatNumber, COST_PER_TOKEN } from '@/lib/utils';

const { tokensRemaining, totalTokensUsed } = MOCK_USAGE;
const total = 1_000_000;
const pct = Math.min(100, (totalTokensUsed / total) * 100);
const estimatedCost = totalTokensUsed * COST_PER_TOKEN;

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Billing</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Your plan, usage, and cost estimation</p>
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: 'hsl(0 72% 51%)' }}>
            <CreditCard size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground">Free Plan</h3>
            <p className="text-sm text-muted-foreground">1,000,000 tokens — non-renewable</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={12} />Active
          </span>
        </div>

        <div className="mb-2 flex justify-between text-xs font-medium">
          <span className="text-muted-foreground">{formatNumber(totalTokensUsed)} tokens used</span>
          <span className="text-muted-foreground">{formatNumber(tokensRemaining)} remaining</span>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, hsl(217 72% 47%), hsl(0 72% 51%))' }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{pct.toFixed(1)}% of free tier consumed</p>
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">Pricing &amp; Estimation</h3>
        </div>
        <div className="space-y-3 text-sm">
          {[
            { label: 'Metered rate', value: '$0.75 / 1,000,000 tokens' },
            { label: 'Free allocation', value: '1,000,000 tokens (one-time)' },
            { label: 'Tokens used', value: formatNumber(totalTokensUsed) },
            { label: 'Tokens remaining', value: formatNumber(tokensRemaining) },
          ].map(row => (
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
            <span className="text-xl font-extrabold text-foreground tabular-nums">${estimatedCost.toFixed(4)}</span>
          </div>
        </div>
      </div>

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
          ].map(feat => (
            <div key={feat} className="flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
              <span className="text-muted-foreground">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-5 border" style={{ background: 'hsl(217 72% 47% / 0.05)', borderColor: 'hsl(217 72% 47% / 0.25)' }}>
        <p className="text-sm font-bold text-foreground mb-1">Need more tokens?</p>
        <p className="text-xs text-muted-foreground mb-3">Pay-as-you-go billing at $0.75 / 1M tokens. No monthly commitment.</p>
        <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: 'hsl(217 72% 47%)' }}
          onClick={() => alert('Payment integration coming in the real build — this is a prototype.')}>
          Add Funds (coming soon)
        </button>
      </div>
    </div>
  );
}
