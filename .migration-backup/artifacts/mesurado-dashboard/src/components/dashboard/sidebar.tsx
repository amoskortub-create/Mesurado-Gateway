'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Terminal, Key, BarChart3, CreditCard, Zap, Activity } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/playground', label: 'Playground', icon: Terminal },
  { href: '/api-keys', label: 'API Keys', icon: Key },
  { href: '/analytics', label: 'Usage Analytics', icon: BarChart3 },
  { href: '/billing', label: 'Billing', icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r"
      style={{
        background: 'linear-gradient(180deg, hsl(222 47% 9%) 0%, hsl(222 47% 7%) 100%)',
        borderColor: 'hsl(var(--sidebar-border))',
      }}
    >
      {/* Logo / Brand */}
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: 'hsl(var(--sidebar-border))' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-lg text-white shadow-lg flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(0 72% 40%) 100%)',
            }}
          >
            M
          </div>
          <div className="min-w-0">
            <div className="text-white font-extrabold text-sm tracking-tight leading-tight">
              Mesurado AI
            </div>
            <div className="text-xs font-medium" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
              Developer Dashboard
            </div>
          </div>
        </div>

        {/* Live status dot */}
        <div className="flex items-center gap-1.5 mt-3">
          <Activity size={10} style={{ color: 'hsl(142 76% 45%)' }} />
          <span className="text-xs font-medium" style={{ color: 'hsl(142 76% 45%)' }}>
            API Operational
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'hsl(213 27% 55%)' }}
        >
          Main Menu
        </p>

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-nav-item group${isActive ? ' active' : ''}`}
              style={
                isActive
                  ? {
                      borderLeft: '3px solid hsl(var(--sidebar-primary))',
                      paddingLeft: 'calc(0.75rem - 3px)',
                      color: 'hsl(var(--sidebar-primary))',
                      background: 'hsl(var(--sidebar-accent))',
                    }
                  : {}
              }
            >
              <Icon
                size={17}
                className="flex-shrink-0 transition-colors"
                style={{ color: isActive ? 'hsl(var(--sidebar-primary))' : 'hsl(213 27% 70%)' }}
              />
              <span className={isActive ? 'font-semibold' : ''}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-4 border-t"
        style={{ borderColor: 'hsl(var(--sidebar-border))' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            <Zap size={10} className="text-white" />
          </div>
          <span className="text-xs font-medium" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
            Media Tech Liberia
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: 'hsl(213 27% 48%)' }}>
          Mesurado Engine v1
        </p>
      </div>
    </aside>
  );
}
