/** Signed-in admin session, persisted in browser storage. */
export interface Session {
  email: string;
  bearerToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the bearer token expires. */
  expiresAt: number;
}

const SESSION_KEY = 'petwork-admin-session';
const UNAUTHORIZED_EVENT = 'petwork:unauthorized';

function safeGet(storage: Storage): string | null {
  try {
    return storage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const raw = safeGet(localStorage) ?? safeGet(sessionStorage);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.bearerToken || Date.now() >= session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

/** `remember` keeps the session after the browser closes; otherwise it lasts for the tab. */
export function saveSession(session: Session, remember: boolean) {
  clearSession();
  try {
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (e.g. private mode).
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Fired when the backend rejects the token, so the app can return to the login page. */
export function notifyUnauthorized() {
  clearSession();
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export function onUnauthorized(handler: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}
