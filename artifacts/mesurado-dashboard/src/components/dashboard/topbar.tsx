import { useState } from 'react';
import { useLocation } from 'wouter';
import { LogOut, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/playground': 'Playground',
  '/api-keys': 'API Keys',
  '/analytics': 'Usage Analytics',
  '/billing': 'Billing',
};

export function TopBar() {
  const [pathname, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { email, name, logout } = useAuth();

  const title = PAGE_TITLES[pathname] ?? 'Dashboard';
  const initials = (name || email).slice(0, 2).toUpperCase();

  function handleLogout() {
    logout();
    setLocation('/login');
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          ⚡ Mock Mode
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition">
          <Bell size={17} />
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-muted transition text-sm"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-extrabold shadow-sm"
              style={{ background: 'hsl(0 72% 51%)' }}
            >
              {initials}
            </div>
            <span className="text-foreground font-medium max-w-[160px] truncate hidden sm:block">{email}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-12 z-30 w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b border-border">
                  <p className="text-xs text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">{email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-destructive hover:bg-red-50 transition font-medium"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
