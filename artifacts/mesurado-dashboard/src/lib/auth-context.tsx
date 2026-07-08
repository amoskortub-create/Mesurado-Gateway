import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { account } from './appwrite';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthState {
  isLoggedIn: boolean;
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

interface AuthCtx extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_KEY = 'mesurado_auth';
const LOGGED_OUT: AuthState = { isLoggedIn: false, userId: '', email: '', name: '', isAdmin: false };

function save(s: AuthState) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
function clear() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
function load(): AuthState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch { /* ignore */ }
  return LOGGED_OUT;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(load);

  // On mount: always probe /api/auth/me — hydrate or clear state from server truth
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { userId: string; email: string } | null) => {
        if (data) {
          // Cookie valid — hydrate from sessionStorage (which has name + isAdmin)
          const stored = load();
          if (stored.isLoggedIn && stored.userId === data.userId) return; // already correct
          // Cookie valid but storage empty/stale — rebuild from server response
          const next: AuthState = {
            isLoggedIn: true,
            userId: data.userId,
            email: data.email,
            name: stored.name || data.email,
            isAdmin: stored.isAdmin,
          };
          save(next);
          setState(next);
        } else {
          // Cookie missing or expired — clear everything
          clear();
          setState(LOGGED_OUT);
        }
      })
      .catch(() => { /* network error — keep cached state */ });
  }, []);

  // Keep admin flag fresh whenever login state changes
  useEffect(() => {
    if (!state.isLoggedIn) return;
    fetch('/api/auth/role', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { role?: string } | null) => {
        const isAdmin = data?.role === 'Administrator';
        setState(prev => {
          if (prev.isAdmin === isAdmin) return prev;
          const next = { ...prev, isAdmin };
          save(next);
          return next;
        });
      })
      .catch(() => { /* keep existing */ });
  }, [state.isLoggedIn]);

  const login = useCallback(async (email: string, password: string) => {
    // 1. Server-side: validate creds, set HMAC cookie
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as { success?: boolean; userId?: string; name?: string; role?: string; error?: string };
    if (!res.ok || !data.success) throw new Error(data.error ?? 'Login failed');

    // 2. Browser-side Appwrite session (for real-time subscriptions)
    try {
      await account.createEmailPasswordSession(email, password);
    } catch { /* non-fatal — real-time degrades gracefully */ }

    const next: AuthState = {
      isLoggedIn: true,
      userId: data.userId ?? '',
      email,
      name: data.name ?? '',
      isAdmin: data.role === 'Administrator',
    };
    save(next);
    setState(next);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json() as { success?: boolean; userId?: string; name?: string; error?: string };
    if (!res.ok || !data.success) throw new Error(data.error ?? 'Signup failed');

    // Browser session
    try {
      await account.createEmailPasswordSession(email, password);
    } catch { /* non-fatal */ }

    const next: AuthState = {
      isLoggedIn: true,
      userId: data.userId ?? '',
      email,
      name: data.name ?? name,
      isAdmin: false,
    };
    save(next);
    setState(next);
  }, []);

  const logout = useCallback(async () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    try { await account.deleteSession('current'); } catch { /* ignore */ }
    clear();
    setState(LOGGED_OUT);
  }, []);

  return (
    <Ctx.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
