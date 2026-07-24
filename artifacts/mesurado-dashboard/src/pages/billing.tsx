import { CreditCard, Zap, TrendingUp, CheckCircle2, XCircle, Globe, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { useUsage } from '@/hooks/use-usage';
import { formatNumber, COST_PER_TOKEN } from '@/lib/utils';

const FREE_FEATURES = [
  { label: '100,000 tokens (lifetime, non-renewable)', included: true },
  { label: 'Full API access via /v1/chat/completions', included: true },
  { label: 'Playground access for testing', included: true },
  { label: 'Usage analytics & logs', included: true },
  { label: '1 API key only', included: true },
  { label: 'OpenAI-compatible response format', included: true },
  { label: 'Multiple API key management', included: false },
  { label: 'Live web search', included: false },
];

const PAYG_FEATURES = [
  { label: 'Pay-as-you-go at $1.50 / 1M tokens', included: true },
  { label: 'No monthly commitment', included: true },
  { label: 'Full API access via /v1/chat/completions', included: true },
  { label: 'Playground access for testing', included: true },
  { label: 'Usage analytics & logs', included: true },
  { label: 'Multiple API key management', included: true },
  { label: 'OpenAI-compatible response format', included: true },
  { label: 'Live web search (50 searches/hour)', included: true },
];

export default function BillingPage() {
  const { tokensRemaining, totalTokensUsed, plan, loading, error, refetch } = useUsage();
  const isPaidUser = plan === 'payg';
  const total = isPaidUser ? (tokensRemaining + totalTokensUsed) : 100_000;
  const pct = total > 0 ? Math.min(100, (totalTokensUsed / total) * 100) : 0;
  const estimatedCost = totalTokensUsed * COST_PER_TOKEN;

  return (
    <div className="space-y-5 md:space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-foreground">Billing</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Your plan, usage, and cost estimation</p>
        </div>
        <button onClick={refetch} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-3 py-2 rounded-lg hover:bg-muted disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
          {error} — <button onClick={refetch} className="underline font-medium">Retry</button>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-card border border-card-border rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 mb-5">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0"
            style={{ background: isPaidUser ? 'hsl(217 72% 47%)' : 'hsl(0 72% 51%)' }}>
            <CreditCard size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base md:text-lg text-foreground">
              {loading ? '…' : isPaidUser ? 'Pay-As-You-Go' : 'Free Plan'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isPaidUser ? '$1.50 / 1M tokens — no commitment' : '100,000 tokens — non-renewable'}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 md:px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0">
            <CheckCircle2 size={11} />Active
          </span>
        </div>

        <div className="mb-2 flex justify-between text-xs font-medium">
          <span className="text-muted-foreground">{formatNumber(totalTokensUsed)} tokens used</span>
          <span className="text-muted-foreground">{formatNumber(tokensRemaining)} remaining</span>
        </div>
        <div className="w-full h-3.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${loading ? 0 : pct}%`, background: 'linear-gradient(90deg, hsl(217 72% 47%), hsl(0 72% 51%))' }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{loading ? '…' : `${pct.toFixed(1)}% of ${isPaidUser ? 'current balance' : 'free tier'} consumed`}</p>
      </div>

      {/* Pricing & Estimation */}
      <div className="bg-card border border-card-border rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={17} className="text-primary flex-shrink-0" />
          <h3 className="font-bold text-foreground">Pricing & Cost Estimate</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Rate', value: '$1.50 / 1M tokens' },
            { label: 'Tokens Used', value: loading ? '—' : formatNumber(totalTokensUsed) },
            { label: 'Est. Cost to Date', value: loading ? '—' : `$${estimatedCost.toFixed(4)}` },
            { label: 'Balance Remaining', value: loading ? '—' : formatNumber(tokensRemaining) },
          ].map(row => (
            <div key={row.label} className="rounded-xl border border-border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-0.5">{row.label}</div>
              <div className="font-bold text-foreground text-sm tabular-nums">{row.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            You&apos;ve spent approximately <span className="font-semibold text-foreground">${estimatedCost.toFixed(4)}</span> worth of tokens so far.
          </p>
        </div>
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Free */}
        <div className={`rounded-2xl border p-5 shadow-sm ${!isPaidUser ? 'ring-2 ring-primary' : ''} bg-card border-card-border`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-extrabold text-foreground">Free</h4>
            {!isPaidUser ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'hsl(0 72% 51%)' }}>Current</span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Downgrade</span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            {FREE_FEATURES.map(feat => (
              <div key={feat.label} className="flex items-start gap-2.5">
                {feat.included
                  ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <XCircle size={14} className="text-muted-foreground flex-shrink-0 mt-0.5 opacity-40" />}
                <span className={feat.included ? 'text-muted-foreground' : 'text-muted-foreground opacity-50'}>{feat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pay-As-You-Go */}
        <div className={`rounded-2xl border p-5 shadow-sm ${isPaidUser ? 'ring-2 ring-accent' : ''} bg-card border-card-border`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-extrabold text-foreground">Pay-As-You-Go</h4>
            {isPaidUser ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'hsl(217 72% 47%)' }}>Current</span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Upgrade</span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            {PAYG_FEATURES.map(feat => (
              <div key={feat.label} className="flex items-start gap-2.5">
                {feat.label.includes('Live web search') ? (
                  <Globe size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'hsl(142 76% 45%)' }} />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                )}
                <span className={feat.label.includes('Live web search') ? 'font-semibold' : 'text-muted-foreground'}
                  style={feat.label.includes('Live web search') ? { color: 'hsl(142 76% 38%)' } : {}}>
                  {feat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Funds / Upgrade CTA */}
      <div className="rounded-2xl p-4 md:p-5 border" style={{ background: 'hsl(217 72% 47% / 0.05)', borderColor: 'hsl(217 72% 47% / 0.25)' }}>
        <div className="flex items-center gap-2 mb-1">
          {isPaidUser ? <Plus size={15} style={{ color: 'hsl(217 72% 47%)' }} /> : <Globe size={15} style={{ color: 'hsl(217 72% 47%)' }} />}
          <p className="text-sm font-bold text-foreground">
            {isPaidUser ? 'Add Funds via MTN Mobile Money' : 'Upgrade to Pay-As-You-Go'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {isPaidUser
            ? 'Top up your token balance using MTN Mobile Money. $1.50 per 1,000,000 tokens. Amounts in USD.'
            : 'Upgrade to Pay-As-You-Go for real-time web results, multiple API keys, and unlimited token top-ups via MTN Mobile Money.'}
        </p>
        <Link href="/billing/add-funds">
          <button className="px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'hsl(217 72% 47%)' }}>
            {isPaidUser ? 'Add Funds' : 'Upgrade — Add Funds'}
          </button>
        </Link>
      </div>
    </div>
  );
}
