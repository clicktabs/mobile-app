import { API_BASE_URL } from '../config/env';
import type { ApiEnvelope } from '../types';

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
};

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const base = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  const url = new URL(`${base}/${cleanPath}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', token, body, query }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error. Check API URL and connection.', 0);
  }

  const text = await response.text();
  let json: ApiEnvelope<T> | T | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError('Invalid server response', response.status, text);
  }

  if (!response.ok) {
    const envelope = json as ApiEnvelope<T> | null;
    throw new ApiError(
      envelope?.message || `Request failed (${response.status})`,
      response.status,
      json,
    );
  }

  return json as T;
}
