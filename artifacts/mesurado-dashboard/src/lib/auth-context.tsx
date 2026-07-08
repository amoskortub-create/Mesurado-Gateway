import { createContext, useContext, useState, type ReactNode } from 'react';
import { MOCK_USER } from './mock';

interface AuthState {
  isLoggedIn: boolean;
  email: string;
  name: string;
}

interface AuthCtx extends AuthState {
  login: (email: string) => void;
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

  function login(email: string) {
    const next: AuthState = { isLoggedIn: true, email: email || MOCK_USER.email, name: MOCK_USER.name };
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
