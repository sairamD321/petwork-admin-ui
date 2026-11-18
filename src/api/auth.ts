import { apiRequest } from './client';
import type { Session } from './session';

interface LoginResponse {
  bearerToken: string;
  refreshToken: string;
  /** Token lifetime in seconds (sent as a string). */
  expiresIn: string;
}

interface UserResponse {
  message?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
}

/** POST /users/api/login — exchanges email + password for a bearer token. */
export async function login(email: string, password: string): Promise<Session> {
  const res = await apiRequest<LoginResponse>('/users/api/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });

  if (!res?.bearerToken) {
    throw new Error('Login failed: the server did not return a token.');
  }

  const seconds = Number(res.expiresIn);
  const lifetimeMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60 * 60 * 1000;

  return {
    email,
    bearerToken: res.bearerToken,
    refreshToken: res.refreshToken,
    expiresAt: Date.now() + lifetimeMs,
  };
}

/**
 * POST /users/api/CustomerRegister — public sign-up.
 * The server assigns the PET_OWNER profile automatically.
 */
export async function registerCustomer(payload: RegisterPayload): Promise<string> {
  const res = await apiRequest<UserResponse>('/users/api/CustomerRegister', {
    method: 'POST',
    body: payload,
    auth: false,
  });
  return res?.message ?? 'Account created successfully.';
}

/**
 * POST /users/api/register — creates a user with an explicit profile (e.g. VET, STAFF,
 * ADMIN_PROFILE). Requires a signed-in admin's token, so it is used inside the dashboard,
 * not on the public login page.
 */
export async function registerUser(
  payload: RegisterPayload & { profileCode: string },
): Promise<string> {
  const res = await apiRequest<UserResponse>('/users/api/register', {
    method: 'POST',
    body: payload,
  });
  return res?.message ?? 'User registered successfully.';
}
