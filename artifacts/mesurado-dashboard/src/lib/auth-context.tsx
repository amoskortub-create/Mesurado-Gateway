import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { MOCK_USER } from './mock';
import { recordLogin } from './device-store';

interface AuthState {
  isLoggedIn: boolean;
  email: string;
  name: string;
  isAdmin: boolean;
}

interface AuthCtx extends AuthState {
  login: (email: string, name?: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_KEY = 'mesurado_mock_auth';

function loadStored(): AuthState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthState;
      return { ...parsed, isAdmin: parsed.isAdmin ?? false };
    }
  } catch { /* ignore */ }
  return { isLoggedIn: false, email: '', name: '', isAdmin: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);

  // Check admin role from server-side session on mount and after login changes
  useEffect(() => {
    if (!state.isLoggedIn) return;
    fetch('/api/auth/role', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { role?: string } | null) => {
        const isAdmin = data?.role === 'Administrator';
        setState(prev => {
          if (prev.isAdmin === isAdmin) return prev;
          const next = { ...prev, isAdmin };
          try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
      })
      .catch(() => { /* no-op — admin stays false if check fails */ });
  }, [state.isLoggedIn]);

  function login(email: string, name?: string) {
    const account = recordLogin(email, name ?? '');
    const next: AuthState = {
      isLoggedIn: true,
      email: email || MOCK_USER.email,
      name: account.name || MOCK_USER.name,
      isAdmin: false, // will be updated by the role check effect
    };
    setState(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setState({ isLoggedIn: false, email: '', name: '', isAdmin: false });
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ ...state, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
