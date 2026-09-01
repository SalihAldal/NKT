import { adminConfig } from '../config';
import { platformApi } from './platform-api';
import { getStoredToken, setStoredToken } from './token-store';

export { getStoredToken, setStoredToken };

export const adminAuth = {
  async login(email: string, password: string) {
    if (adminConfig.useMock) {
      throw new Error('Mock admin API is disabled in this build');
    }
    const result = await platformApi.login(email, password);
    setStoredToken(result.token);
    return { session: { token: result.token }, admin: result.admin };
  },

  async logout() {
    if (!adminConfig.useMock) {
      await platformApi.logout();
    }
    setStoredToken(null);
  },

  async getSession() {
    const token = getStoredToken();
    if (!token) return null;
    try {
      if (adminConfig.useMock) {
        return null;
      }
      const admin = await platformApi.me();
      return { token, admin };
    } catch {
      setStoredToken(null);
      return null;
    }
  },
};

export async function withAuth<T>(fn: (token: string) => Promise<T> | T): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');
  return fn(token);
}

export { platformApi };
