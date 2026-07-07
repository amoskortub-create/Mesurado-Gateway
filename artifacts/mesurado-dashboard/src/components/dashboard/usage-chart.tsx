'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DayUsage {
  date: string;
  tokens: number;
}

interface UsageChartProps {
  data: DayUsage[];
}

function formatTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function UsageChart({ data }: UsageChartProps) {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-foreground">Daily Token Usage</h3>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
          Last 30 days
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-5">Tokens consumed per day across API and Playground</p>

      {data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'hsl(0 72% 51% / 0.1)' }}
            >
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">No usage yet</p>
            <p className="text-xs text-muted-foreground mt-1">Make your first API call to see data</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mesuradoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)', fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)', fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatTick}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid hsl(214 32% 91%)',
                borderRadius: '12px',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
              }}
              formatter={(v: number) => [v.toLocaleString(), 'Tokens']}
              labelFormatter={formatDate}
            />
            <Area
              type="monotone"
              dataKey="tokens"
              stroke="hsl(0 72% 51%)"
              strokeWidth={2.5}
              fill="url(#mesuradoGrad)"
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(0 72% 51%)', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
