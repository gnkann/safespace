import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { authApi } from '../api/services';
import { tokenStore } from '../api/http';
import type { Role } from '../api/types';

interface AuthState {
  user: { id: string; role: Role } | null;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthState | null>(null);
const USER_KEY = 'safespace_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(() => {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw && tokenStore.get() ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await authApi.login(email, password);
    tokenStore.set(token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth має використовуватись всередині AuthProvider');
  return ctx;
}
