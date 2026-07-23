import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, TrendingUp, RefreshCw, ShieldX } from 'lucide-react';
import { useUsage } from '@/hooks/use-usage';
import { formatDateTime, formatCurrency } from '@/lib/utils';

const PIE_COLORS = ['hsl(0 72% 51%)', 'hsl(217 72% 47%)'];

const ERROR_LABELS: Record<number, string> = {
  402: 'No funds',
  429: 'Rate limit / Capacity',
  503: 'Engine error',
};

export default function AnalyticsPage() {
  const { recentLogs, rejectedLogs, loading, error, refetch } = useUsage();

  const apiTokens   = recentLogs.filter(l => l.source === 'api').reduce((s, l) => s + l.totalTokens, 0);
  const playTokens  = recentLogs.filter(l => l.source === 'playground').reduce((s, l) => s + l.totalTokens, 0);
  const pieData = [{ name: 'API', value: apiTokens }, { name: 'Playground', value: playTokens }];
  const barData = [...recentLogs].slice(0, 15).reverse().map((l, i) => ({
    label: `#${i + 1}`, tokens: l.totalTokens, source: l.source,
  }));
  const totalTokens = recentLogs.reduce((s, l) => s + l.totalTokens, 0);
  const totalCost   = recentLogs.reduce((s, l) => s + l.costDebit, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">Usage Analytics</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Detailed breakdown of your API and Playground consumption</p>
        </div>
        <button onClick={refetch} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-3 py-2 rounded-lg hover:bg-muted disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Updating…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
          {error} — <button onClick={refetch} className="underline font-medium">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Requests',   value: loading ? '—' : recentLogs.length.toLocaleString() },
          { label: 'Total Tokens',     value: loading ? '—' : totalTokens.toLocaleString() },
          { label: 'API Calls',        value: loading ? '—' : recentLogs.filter(l => l.source === 'api').length.toLocaleString() },
          { label: 'Estimated Cost',   value: loading ? '—' : `$${totalCost.toFixed(4)}` },
        ].map(s => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="text-lg font-extrabold text-foreground tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {!loading && recentLogs.length === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-12 text-center shadow-sm">
          <BarChart3 size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm font-medium text-muted-foreground">No usage logs yet</p>
          <p className="text-xs text-muted-foreground mt-1">Make your first API call or try the Playground to see analytics here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-primary" />
                <h3 className="font-bold text-foreground">API vs Playground</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Token distribution by source</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={72} dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Tokens']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={16} className="text-primary" />
                <h3 className="font-bold text-foreground">Recent Requests</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Tokens per recent call</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Tokens']} />
                  <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
                    {barData.map((d, i) => (
                      <Cell key={i} fill={d.source === 'api' ? 'hsl(0 72% 51%)' : 'hsl(217 72% 47%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Successful usage logs ───────────────────────────────────────────── */}
          <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={17} className="text-primary" />
                <h3 className="font-bold text-foreground">Recent Usage Logs</h3>
              </div>
              <span className="text-xs text-muted-foreground">{recentLogs.length} entries · live</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Timestamp', 'Source', 'Prompt Tokens', 'Completion', 'Total', 'Cost'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map(log => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/25 transition">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${log.source === 'api' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          {log.source.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground tabular-nums">{log.promptTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground tabular-nums">{log.completionTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-bold text-foreground tabular-nums">{log.totalTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground tabular-nums">{formatCurrency(log.costDebit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Rejected requests ───────────────────────────────────────────────── */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldX size={17} className="text-red-500" />
            <h3 className="font-bold text-foreground">Rejected Requests</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {loading ? '—' : `${rejectedLogs.length} in last 30 days`}
          </span>
        </div>

        {!loading && rejectedLogs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ShieldX size={24} className="mx-auto text-muted-foreground opacity-30 mb-2" />
            <p className="text-xs text-muted-foreground">No rejected requests — all clear.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Timestamp', 'Source', 'Reason', 'Code'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rejectedLogs.map(log => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/25 transition">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${log.source === 'api' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                        {log.source.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{log.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                        log.errorCode === 429 ? 'bg-orange-50 text-orange-700'
                        : log.errorCode === 402 ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-red-50 text-red-700'
                      }`}>
                        {log.errorCode} {ERROR_LABELS[log.errorCode] ?? ''}
                      </span>
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
