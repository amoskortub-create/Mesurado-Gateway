import { Coins, TrendingUp, Star, Globe } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { UsageChart } from '@/components/dashboard/usage-chart';
import { MOCK_USAGE, MOCK_DAILY_USAGE } from '@/lib/mock';
import { formatNumber } from '@/lib/utils';

const { tokensRemaining, totalTokensUsed, plan, searchesUsedThisMonth } = MOCK_USAGE;
const isPaidUser = plan === 'payg';

export default function OverviewPage() {
  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl">
      <div>
        <h2 className="text-xl md:text-2xl font-extrabold text-foreground">Overview</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Your token balance and API usage at a glance</p>
      </div>

      <div className={`grid grid-cols-2 ${isPaidUser ? 'lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 md:gap-4`}>
        <MetricCard
          title="Token Balance"
          value={formatNumber(tokensRemaining)}
          subtitle={isPaidUser ? 'Pay-As-You-Go balance' : 'Free tier remaining'}
          variant="red"
          icon={<Coins size={20} />}
        />
        <MetricCard
          title="Total Tokens Used"
          value={formatNumber(totalTokensUsed)}
          subtitle="Cumulative across all calls"
          variant="blue"
          icon={<TrendingUp size={20} />}
          badge="+12.4% vs last week"
        />
        <MetricCard
          title="Current Plan"
          value={isPaidUser ? 'Pay-As-You-Go' : 'Free'}
          subtitle={isPaidUser ? '$0.75 / 1M tokens' : '1M tokens included'}
          variant="navy"
          icon={<Star size={20} />}
          badge={isPaidUser ? 'Live Search ✓' : 'Free Tier'}
        />
        {isPaidUser && (
          <MetricCard
            title="Searches This Month"
            value={searchesUsedThisMonth.toString()}
            subtitle="Live web searches used"
            variant="blue"
            icon={<Globe size={20} />}
            badge="Included"
          />
        )}
      </div>

      <UsageChart data={MOCK_DAILY_USAGE} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: isPaidUser ? 'Plan' : 'Free Allocation', value: isPaidUser ? 'Pay-As-You-Go' : '1,000,000' },
          { label: 'Rate', value: '$0.75 / 1M tokens' },
          { label: 'Pct. Used', value: `${((totalTokensUsed / 1_000_000) * 100).toFixed(1)}%` },
          { label: 'Est. Value Used', value: `$${(totalTokensUsed * 0.75 / 1_000_000).toFixed(4)}` },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-card-border rounded-xl p-3 md:p-4 shadow-sm">
            <div className="text-base md:text-lg font-bold text-foreground tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
