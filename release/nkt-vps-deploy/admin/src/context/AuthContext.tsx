import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { adminAuth } from '../services/admin-auth';
import type { AdminUser } from '../services/platform-api';

export type AdminRole = AdminUser['role'];

interface AuthContextValue {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: AdminRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const session = await adminAuth.getSession();
      if (session) {
        setAdmin(session.admin as AdminUser);
        setToken(session.token);
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminAuth.login(email, password);
    setAdmin(result.admin as AdminUser);
    setToken(result.session.token);
  }, []);

  const logout = useCallback(async () => {
    await adminAuth.logout();
    setAdmin(null);
    setToken(null);
  }, []);

  const hasRole = useCallback((...roles: AdminRole[]) => {
    return admin ? roles.includes(admin.role) : false;
  }, [admin]);

  return (
    <AuthContext.Provider value={{ admin, token, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
