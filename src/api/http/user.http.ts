import type { UserApi } from '../contracts/user.api';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpUserApi(request: RequestFn): UserApi {
  return {
    getProfile: (userId) => request(`/api/v1/users/${userId}`),
    updateProfile: (userId, data) => request('/api/v1/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    deleteAccount: (userId) => request('/api/v1/users/me', { method: 'DELETE' }),
    search: (query) => request(`/api/v1/friends/search?q=${encodeURIComponent(query)}`),
  };
}
