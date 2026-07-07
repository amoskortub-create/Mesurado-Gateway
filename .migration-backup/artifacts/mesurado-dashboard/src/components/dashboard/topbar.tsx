'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, ChevronDown, Bell } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/playground': 'Playground',
  '/api-keys': 'API Keys',
  '/analytics': 'Usage Analytics',
  '/billing': 'Billing',
};

interface TopBarProps {
  email: string;
}

export function TopBar({ email }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const title = PAGE_TITLES[pathname] ?? 'Dashboard';
  const initials = email.split('@')[0].slice(0, 2).toUpperCase();

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20 backdrop-blur-sm">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell (decorative) */}
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition">
          <Bell size={17} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-muted transition text-sm group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-extrabold shadow-sm"
              style={{ background: 'hsl(0 72% 51%)' }}
            >
              {initials}
            </div>
            <span className="text-foreground font-medium max-w-[160px] truncate hidden sm:block">
              {email}
            </span>
            <ChevronDown
              size={14}
              className="text-muted-foreground transition-transform group-aria-expanded:rotate-180"
            />
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
                    disabled={signingOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-destructive hover:bg-red-50 transition disabled:opacity-50 font-medium"
                  >
                    <LogOut size={14} />
                    {signingOut ? 'Signing out…' : 'Sign out'}
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
