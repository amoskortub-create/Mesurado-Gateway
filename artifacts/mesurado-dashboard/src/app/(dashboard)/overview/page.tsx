'use client';

import { useEffect, useState } from 'react';
import { Coins, TrendingUp, Star } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { UsageChart } from '@/components/dashboard/usage-chart';
import { formatNumber } from '@/lib/utils';

interface UsageData {
  tokensRemaining: number;
  totalTokensUsed: number;
  plan: 'free' | 'payg';
  dailyUsage: { date: string; tokens: number }[];
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className ?? ''}`} />;
}

export default function OverviewPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/usage')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const tokensRemaining = data?.tokensRemaining ?? 0;
  const totalUsed = data?.totalTokensUsed ?? 0;
  const plan = data?.plan ?? 'free';

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Overview</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Your token balance and API usage at a glance
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Token Balance"
          value={formatNumber(tokensRemaining)}
          subtitle="Free tier remaining"
          variant="red"
          icon={<Coins size={20} />}
          badge={tokensRemaining === 0 ? 'Exhausted' : undefined}
        />
        <MetricCard
          title="Total Tokens Used"
          value={formatNumber(totalUsed)}
          subtitle="Cumulative across all calls"
          variant="blue"
          icon={<TrendingUp size={20} />}
        />
        <MetricCard
          title="Current Plan"
          value={plan === 'free' ? 'Free' : 'Pay-As-You-Go'}
          subtitle={plan === 'free' ? '1M tokens included' : 'Billed per token'}
          variant="navy"
          icon={<Star size={20} />}
          badge={plan === 'free' ? 'Free Tier' : 'PAYG'}
        />
      </div>

      {/* Alert if balance 0 */}
      {tokensRemaining === 0 && (
        <div className="flex items-center gap-4 p-4 rounded-2xl border border-red-200 bg-red-50">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            ⚠
          </div>
          <div>
            <p className="font-bold text-red-800">Free tier exhausted</p>
            <p className="text-sm text-red-600 mt-0.5">
              All API requests are now blocked with HTTP 402. Visit Billing to add funds.
            </p>
          </div>
        </div>
      )}

      {/* Usage chart */}
      <UsageChart data={data?.dailyUsage ?? []} />

      {/* Quick stats footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Free Allocation', value: '1,000,000' },
          { label: 'Rate', value: '$0.75 / 1M tokens' },
          { label: 'Pct. Used', value: `${Math.min(100, (totalUsed / 1_000_000) * 100).toFixed(1)}%` },
          { label: 'Est. Value Used', value: `$${(totalUsed * 0.75 / 1_000_000).toFixed(4)}` },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="text-lg font-bold text-foreground tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
