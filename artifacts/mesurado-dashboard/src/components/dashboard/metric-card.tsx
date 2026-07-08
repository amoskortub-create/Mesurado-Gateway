import { type ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: 'red' | 'blue' | 'navy';
  badge?: string;
}

const VARIANT_STYLES = {
  red:  { iconBg: 'hsl(0 72% 51%)',   badgeBg: 'hsl(0 72% 51% / 0.1)',   badgeText: 'hsl(0 72% 40%)' },
  blue: { iconBg: 'hsl(217 72% 47%)', badgeBg: 'hsl(217 72% 47% / 0.1)', badgeText: 'hsl(217 72% 35%)' },
  navy: { iconBg: 'hsl(222 47% 20%)', badgeBg: 'hsl(222 47% 20% / 0.1)', badgeText: 'hsl(222 47% 20%)' },
};

export function MetricCard({ title, value, subtitle, icon, variant = 'red', badge }: MetricCardProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-200"
          style={{ background: s.iconBg }}
        >
          {icon}
        </div>
        {badge && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.badgeBg, color: s.badgeText }}>
            {badge}
          </span>
        )}
      </div>
      <div className="text-3xl font-extrabold tracking-tight mb-1.5 tabular-nums text-foreground">
        {typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </div>
      <div className="text-sm font-semibold text-foreground mb-0.5">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}
