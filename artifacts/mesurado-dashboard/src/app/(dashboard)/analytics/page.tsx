'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Loader2, BarChart3, TrendingUp } from 'lucide-react';
import { formatDateTime, formatCurrency } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  source: 'api' | 'playground';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costDebit: number;
  keyId: string;
}

const PIE_COLORS = ['hsl(0 72% 51%)', 'hsl(217 72% 47%)'];

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/usage')
      .then((r) => r.json())
      .then((d) => setLogs(d.recentLogs ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Derive chart data
  const apiTokens = logs.filter((l) => l.source === 'api').reduce((s, l) => s + l.totalTokens, 0);
  const playTokens = logs
    .filter((l) => l.source === 'playground')
    .reduce((s, l) => s + l.totalTokens, 0);
  const pieData = [
    { name: 'API', value: apiTokens },
    { name: 'Playground', value: playTokens },
  ].filter((d) => d.value > 0);

  const barData = logs
    .slice(0, 15)
    .reverse()
    .map((l, i) => ({
      label: `#${i + 1}`,
      tokens: l.totalTokens,
      source: l.source,
    }));

  const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
  const totalCost = logs.reduce((s, l) => s + l.costDebit, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Usage Analytics</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Detailed breakdown of your API and Playground consumption
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Requests', value: logs.length.toLocaleString() },
          { label: 'Total Tokens', value: totalTokens.toLocaleString() },
          { label: 'API Calls', value: logs.filter((l) => l.source === 'api').length.toLocaleString() },
          { label: 'Estimated Cost', value: formatCurrency(totalCost) },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="text-lg font-extrabold text-foreground tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie: API vs Playground */}
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-primary" />
            <h3 className="font-bold text-foreground">API vs Playground</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Token distribution by source</p>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Tokens']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: recent requests */}
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={16} className="text-primary" />
            <h3 className="font-bold text-foreground">Recent Requests</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Tokens per recent call</p>
          {barData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Tokens']} />
                <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
                  {barData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.source === 'api' ? 'hsl(0 72% 51%)' : 'hsl(217 72% 47%)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Logs table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={17} className="text-primary" />
            <h3 className="font-bold text-foreground">Recent Usage Logs</h3>
          </div>
          <span className="text-xs text-muted-foreground">{logs.length} entries</span>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">
              No logs yet. Make an API call or use the Playground to generate data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Timestamp', 'Source', 'Prompt Tokens', 'Completion', 'Total', 'Cost'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border last:border-0 hover:bg-muted/25 transition"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          log.source === 'api'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {log.source.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground tabular-nums">
                      {log.promptTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground tabular-nums">
                      {log.completionTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-foreground tabular-nums">
                      {log.totalTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground tabular-nums">
                      {formatCurrency(log.costDebit)}
                    </td>
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
