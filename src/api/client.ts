import { getSession, notifyUnauthorized } from './session';

/**
 * In dev, requests are same-origin at the real path (e.g. `/api/products/...`) and the Vite dev server
 * forwards them to VITE_API_BASE_URL, which avoids CORS preflight (OPTIONS) requests.
 * In a production build they go straight to VITE_API_BASE_URL.
 */
const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the signed-in admin's bearer token. Defaults to true. */
  auth?: boolean;
  timeoutMs?: number;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  password: 'Password',
  profileCode: 'Profile',
};

/** Turns FastAPI / gateway error bodies into a readable message. */
function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const { detail, errorMessages, message } = body as Record<string, unknown>;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) => {
          if (!d || typeof d !== 'object') return String(d);
          const { msg, loc } = d as { msg?: string; loc?: unknown[] };
          const field = Array.isArray(loc) ? String(loc[loc.length - 1]) : '';
          return FIELD_LABELS[field] ? `${FIELD_LABELS[field]}: ${msg}` : msg;
        })
        .filter(Boolean);
      if (msgs.length) return msgs.join('. ');
    }
    if (Array.isArray(errorMessages) && errorMessages.length) return errorMessages.join('. ');
    if (typeof message === 'string') return message;
  }
  return `Request failed (${status})`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // FormData (file uploads) sets its own multipart Content-Type with the boundary.
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const session = getSession();
    if (!session) {
      notifyUnauthorized();
      throw new ApiError('Your session has expired. Please sign in again.', 401);
    }
    headers.Authorization = `Bearer ${session.bearerToken}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError('The server took too long to respond. Please try again.', 0);
    }
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) notifyUnauthorized();
    throw new ApiError(extractMessage(data, response.status), response.status);
  }

  return data as T;
}
