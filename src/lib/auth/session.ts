/** Session + password-login / signup helpers. */

import { AUTH_CONFIG, authCloudConfigured } from "./config";

const SESSION_KEY = "agenter.auth.session.v1";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string | null };
}

let memory: AuthSession | null = null;

export function loadSession(): AuthSession | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    memory = JSON.parse(raw) as AuthSession;
    return memory;
  } catch {
    return null;
  }
}

export function saveSession(s: AuthSession | null): void {
  memory = s;
  try {
    if (!s) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  saveSession(null);
}

export function isLoggedIn(): boolean {
  const s = loadSession();
  return Boolean(s?.access_token && s?.user?.id);
}

export function accessToken(): string {
  return loadSession()?.access_token || "";
}

export async function passwordLogin(
  email: string,
  password: string,
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      user?: { id: string; email?: string };
      error?: string;
      code?: string;
    };
    if (!data.ok || !data.access_token || !data.refresh_token || !data.user?.id) {
      // Fallback: direct GoTrue when Functions unavailable (local vite)
      if (authCloudConfigured()) {
        return directGoTrueLogin(email, password);
      }
      return {
        ok: false,
        error: data.error || data.code || "login_failed",
      };
    }
    const session: AuthSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: { id: data.user.id, email: data.user.email ?? email },
    };
    saveSession(session);
    return { ok: true, session };
  } catch {
    if (authCloudConfigured()) return directGoTrueLogin(email, password);
    return { ok: false, error: "network_error" };
  }
}

async function directGoTrueLogin(
  email: string,
  password: string,
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${AUTH_CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: AUTH_CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${AUTH_CONFIG.supabaseAnonKey}`,
        },
        body: JSON.stringify({ email, password }),
      },
    );
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      user?: { id: string; email?: string };
      error_description?: string;
      msg?: string;
    };
    if (!res.ok || !data.access_token || !data.refresh_token || !data.user?.id) {
      return {
        ok: false,
        error: data.error_description || data.msg || "login_failed",
      };
    }
    const session: AuthSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: { id: data.user.id, email: data.user.email ?? email },
    };
    saveSession(session);
    return { ok: true, session };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<
  | { ok: true; session: AuthSession | null; needsConfirm?: boolean }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      access_token?: string;
      refresh_token?: string;
      user?: { id: string; email?: string };
      needs_confirm?: boolean;
      error?: string;
      code?: string;
    };
    if (!data.ok) {
      if (authCloudConfigured()) return directGoTrueSignUp(email, password);
      return { ok: false, error: data.error || data.code || "signup_failed" };
    }
    if (data.access_token && data.refresh_token && data.user?.id) {
      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: { id: data.user.id, email: data.user.email ?? email },
      };
      saveSession(session);
      return { ok: true, session };
    }
    return { ok: true, session: null, needsConfirm: true };
  } catch {
    if (authCloudConfigured()) return directGoTrueSignUp(email, password);
    return { ok: false, error: "network_error" };
  }
}

async function directGoTrueSignUp(
  email: string,
  password: string,
): Promise<
  | { ok: true; session: AuthSession | null; needsConfirm?: boolean }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${AUTH_CONFIG.supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: AUTH_CONFIG.supabaseAnonKey,
        Authorization: `Bearer ${AUTH_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      user?: { id: string; email?: string };
      error_description?: string;
      msg?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error_description || data.msg || "signup_failed",
      };
    }
    if (data.access_token && data.refresh_token && data.user?.id) {
      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: { id: data.user.id, email: data.user.email ?? email },
      };
      saveSession(session);
      return { ok: true, session };
    }
    return { ok: true, session: null, needsConfirm: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export function logout(): void {
  clearSession();
}

/** Routes that never require login. */
export const PUBLIC_ROUTES = new Set([
  "home",
  "compare",
  "learn",
  "handbook",
  "tools",
  "news",
  "quant",
  "paper",
  "sim",
  "asset",
  "login",
]);

export function requiresAuth(page: string): boolean {
  return page === "fin" || page === "account";
}
