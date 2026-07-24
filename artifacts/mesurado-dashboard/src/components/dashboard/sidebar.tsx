import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Terminal, Key, BarChart3, CreditCard, Zap, Activity, X, Wallet, ShieldCheck, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useAdminStats } from '@/hooks/use-admin-stats';

const BASE_NAV_ITEMS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/playground', label: 'Playground', icon: Terminal },
  { href: '/api-keys', label: 'API Keys', icon: Key },
  { href: '/docs', label: 'API Reference', icon: BookOpen },
  { href: '/analytics', label: 'Usage Analytics', icon: BarChart3 },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/billing/add-funds', label: 'Add Funds', icon: Wallet },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [pathname] = useLocation();
  const { isAdmin } = useAuth();
  const { pendingCount } = useAdminStats(isAdmin);

  const navItems = isAdmin
    ? [...BASE_NAV_ITEMS, { href: '/admin/payments', label: 'Admin', icon: ShieldCheck }]
    : BASE_NAV_ITEMS;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 flex flex-col h-screen border-r',
          'transition-transform duration-300 ease-in-out',
          'md:relative md:translate-x-0 md:z-auto',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        style={{
          background: 'linear-gradient(180deg, hsl(222 47% 9%) 0%, hsl(222 47% 7%) 100%)',
          borderColor: 'hsl(var(--sidebar-border))',
        }}
      >
        {/* Logo / Brand */}
        <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.svg" alt="Mesurado AI" className="w-9 h-9 rounded-xl flex-shrink-0 shadow-lg" />
            <div className="min-w-0">
              <div className="text-white font-extrabold text-sm tracking-tight leading-tight">Mesurado AI</div>
              <div className="text-xs font-medium" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
                Developer Dashboard
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition"
            style={{ color: 'hsl(213 27% 70%)' }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <Activity size={10} style={{ color: 'hsl(142 76% 45%)' }} />
            <span className="text-xs font-medium" style={{ color: 'hsl(142 76% 45%)' }}>
              API Operational
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'hsl(213 27% 55%)' }}>
            Main Menu
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            const isAdminItem = href === '/admin/payments';
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-nav-item group${isActive ? ' active' : ''}`}
                style={
                  isActive
                    ? {
                        borderLeft: `3px solid ${isAdminItem ? 'hsl(142 76% 45%)' : 'hsl(var(--sidebar-primary))'}`,
                        paddingLeft: 'calc(0.75rem - 3px)',
                        color: isAdminItem ? 'hsl(142 76% 45%)' : 'hsl(var(--sidebar-primary))',
                        background: 'hsl(var(--sidebar-accent))',
                      }
                    : {}
                }
              >
                <Icon
                  size={17}
                  className="nav-icon flex-shrink-0 transition-colors"
                  style={{
                    color: isActive
                      ? (isAdminItem ? 'hsl(142 76% 45%)' : 'hsl(var(--sidebar-primary))')
                      : (isAdminItem ? 'hsl(142 76% 55%)' : 'hsl(213 27% 70%)'),
                  }}
                />
                <span className={isActive ? 'font-semibold' : ''}>{label}</span>
                {isAdminItem && pendingCount > 0 && (
                  <span
                    className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold text-white min-w-[20px] text-center"
                    style={{ background: 'hsl(0 72% 51%)' }}
                    title={`${pendingCount} payment${pendingCount === 1 ? '' : 's'} awaiting review`}
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
                {isAdminItem && pendingCount === 0 && !isActive && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'hsl(142 76% 45% / 0.15)', color: 'hsl(142 76% 40%)' }}>
                    Admin
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'hsl(0 72% 51%)' }}>
              <Zap size={10} className="text-white" />
            </div>
            <span className="text-xs font-medium" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
              Media Tech Liberia
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'hsl(213 27% 48%)' }}>Mesurado Engine v1</p>
        </div>
      </aside>
    </>
  );
}
