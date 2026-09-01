import { adminConfig } from '../config';
import { getStoredToken, setStoredToken } from './token-store';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

type QueryValue = string | number | boolean | undefined | null;

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = adminConfig.apiBaseUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiSuccess<T> | ApiFailure;
  if (!body.success) {
    const err = body as ApiFailure;
    if (res.status === 401) setStoredToken(null);
    throw new ApiError(err.error.code, err.error.message, res.status, err.error.details);
  }
  return (body as ApiSuccess<T>).data;
}

export const http = {
  async get<T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal): Promise<T> {
    const token = getStoredToken();
    const res = await fetch(buildUrl(path, query), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
    return parseResponse<T>(res);
  },

  async post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const token = getStoredToken();
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    return parseResponse<T>(res);
  },

  async patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const token = getStoredToken();
    const res = await fetch(buildUrl(path), {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    return parseResponse<T>(res);
  },

  async delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    const token = getStoredToken();
    const res = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
    return parseResponse<T>(res);
  },
};
