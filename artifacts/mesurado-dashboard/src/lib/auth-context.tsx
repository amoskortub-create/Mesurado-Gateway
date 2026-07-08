import { createContext, useContext, useState, type ReactNode } from 'react';
import { MOCK_USER } from './mock';
import { recordLogin } from './device-store';

interface AuthState {
  isLoggedIn: boolean;
  email: string;
  name: string;
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
    if (raw) return JSON.parse(raw) as AuthState;
  } catch { /* ignore */ }
  return { isLoggedIn: false, email: '', name: '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);

  function login(email: string, name?: string) {
    // Only pass name when explicitly provided — never fall back to MOCK_USER.name
    // so existing stored account names are not overwritten on plain sign-in.
    const account = recordLogin(email, name ?? '');
    const next: AuthState = {
      isLoggedIn: true,
      email: email || MOCK_USER.email,
      name: account.name || MOCK_USER.name,
    };
    setState(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function logout() {
    setState({ isLoggedIn: false, email: '', name: '' });
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ ...state, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
