import { Coins, TrendingUp, Star, Globe, RefreshCw } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { UsageChart } from '@/components/dashboard/usage-chart';
import { useUsage } from '@/hooks/use-usage';
import { formatNumber } from '@/lib/utils';

export default function OverviewPage() {
  const { tokensRemaining, totalTokensUsed, plan, dailyUsage, loading, error, refetch } = useUsage();
  const isPaidUser = plan === 'payg';

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-foreground">Overview</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Your token balance and API usage at a glance</p>
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

      <div className={`grid grid-cols-2 ${isPaidUser ? 'lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 md:gap-4`}>
        <MetricCard
          title="Token Balance"
          value={loading ? '—' : formatNumber(tokensRemaining)}
          subtitle={isPaidUser ? 'Pay-As-You-Go balance' : 'Free tier remaining'}
          variant="red"
          icon={<Coins size={20} />}
        />
        <MetricCard
          title="Total Tokens Used"
          value={loading ? '—' : formatNumber(totalTokensUsed)}
          subtitle="Cumulative across all calls"
          variant="blue"
          icon={<TrendingUp size={20} />}
        />
        <MetricCard
          title="Current Plan"
          value={isPaidUser ? 'Pay-As-You-Go' : 'Free'}
          subtitle={isPaidUser ? '$1.50 / 1M tokens' : '100K tokens included'}
          variant="navy"
          icon={<Star size={20} />}
          badge={isPaidUser ? 'Live Search ✓' : 'Free Tier'}
        />
        {isPaidUser && (
          <MetricCard
            title="Plan"
            value="Active"
            subtitle="Pay-as-you-go · No commitment"
            variant="blue"
            icon={<Globe size={20} />}
            badge="Included"
          />
        )}
      </div>

      <UsageChart data={dailyUsage} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: isPaidUser ? 'Plan' : 'Free Allocation', value: isPaidUser ? 'Pay-As-You-Go' : '100,000' },
          { label: 'Rate', value: '$1.50 / 1M tokens' },
          { label: 'Pct. Used', value: totalTokensUsed > 0 ? `${((totalTokensUsed / (totalTokensUsed + tokensRemaining)) * 100).toFixed(1)}%` : '0.0%' },
          { label: 'Est. Value Used', value: `$${(totalTokensUsed * 1.50 / 1_000_000).toFixed(4)}` },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-card-border rounded-xl p-3 md:p-4 shadow-sm">
            <div className="text-base md:text-lg font-bold text-foreground tabular-nums">{loading ? '—' : stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
