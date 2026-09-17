import { API_BASE_URL } from '../config/env';
import type { ApiEnvelope } from '../types';
import { reportNetworkFailure, reportSuccess } from '../utils/connectivity';

/**
 * How long to wait before calling a request dead.
 *
 * Without this the app can never notice it is offline: behind a captive portal fetch
 * does not reject, it hangs, so the failure path never runs and the UI spins forever.
 */
const REQUEST_TIMEOUT_MS = 10_000;

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  /** Override the default timeout. Uploads of queued work may legitimately take longer. */
  timeoutMs?: number;
  /**
   * Skip connectivity reporting. Used by the reachability probe itself, which must not
   * feed its own result back into the state it is deciding.
   */
  silent?: boolean;
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
  {
    method = 'GET',
    token,
    body,
    query,
    timeoutMs = REQUEST_TIMEOUT_MS,
    silent = false,
  }: RequestOptions = {},
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // Every call in the app comes through here, so this one line is what makes the
    // whole app connectivity-aware — including screens nobody has touched.
    if (!silent) reportNetworkFailure();
    throw new ApiError('Network error. Check API URL and connection.', 0);
  } finally {
    clearTimeout(timer);
  }

  // The server answered. A 422 or a 500 is a reachable server, not a lost network, so
  // everything below this point counts as proof we are online.
  if (!silent) reportSuccess();

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
