/** Session + password-login / signup helpers. Email confirm required. */

import {
  AUTH_CONFIG,
  authCloudConfigured,
  signupRedirectTo,
} from "./config";

const SESSION_KEY = "supro.auth.session.v1";
const LEGACY_SESSION_KEY = "agenter.auth.session.v1";

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
    let raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_SESSION_KEY);
      if (raw) {
        localStorage.setItem(SESSION_KEY, raw);
        localStorage.removeItem(LEGACY_SESSION_KEY);
      }
    }
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

/**
 * Consume Supabase confirm / magic-link tokens from URL hash or query.
 * Call once on app boot. Strips tokens from the address bar afterward.
 */
export function consumeAuthCallbackFromUrl(): boolean {
  try {
    const hash = (location.hash || "").replace(/^#/, "");
    // Forms: /#/login#access_token=... OR #access_token=...&type=signup
    // Also: /#access_token=... when Site URL has no path
    const candidates = [hash, location.search.replace(/^\?/, "")];
    let params: URLSearchParams | null = null;
    for (const raw of candidates) {
      if (!raw) continue;
      const amp = raw.includes("access_token=")
        ? raw.slice(raw.indexOf("access_token="))
        : raw.includes("refresh_token=")
          ? raw.slice(raw.indexOf("refresh_token="))
          : "";
      const tryStr = amp || (raw.includes("=") && !raw.startsWith("/") ? raw : "");
      if (!tryStr.includes("access_token=")) continue;
      params = new URLSearchParams(tryStr.replace(/^#/, ""));
      break;
    }
    // Nested: #/login&access_token= rare; also check full href fragment parts
    if (!params) {
      const full = location.href;
      const idx = full.indexOf("access_token=");
      if (idx >= 0) {
        params = new URLSearchParams(full.slice(idx).split("#")[0]);
      }
    }
    if (!params) return false;
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    if (!access || !refresh) return false;
    const exp = Number(params.get("expires_at") || params.get("expires_in") || 0);
    saveSession({
      access_token: access,
      refresh_token: refresh,
      expires_at: Number.isFinite(exp) && exp > 1e9 ? exp : undefined,
      user: { id: "pending", email: null },
    });
    // Hydrate user id from /auth/v1/user
    void hydrateUserFromAccess(access);
    // Clean URL → #/account
    history.replaceState(null, "", `${location.pathname}${location.search}#/account`);
    return true;
  } catch {
    return false;
  }
}

async function hydrateUserFromAccess(access: string): Promise<void> {
  if (!authCloudConfigured()) return;
  try {
    const res = await fetch(`${AUTH_CONFIG.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: AUTH_CONFIG.supabaseAnonKey,
        Authorization: `Bearer ${access}`,
      },
    });
    const user = (await res.json()) as { id?: string; email?: string };
    if (!res.ok || !user?.id) return;
    const cur = loadSession();
    if (!cur) return;
    saveSession({
      ...cur,
      user: { id: user.id, email: user.email ?? null },
    });
  } catch {
    /* ignore */
  }
}

export async function passwordLogin(
  email: string,
  password: string,
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string; code?: string }> {
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
      if (authCloudConfigured()) {
        return directGoTrueLogin(email, password);
      }
      return {
        ok: false,
        error: data.error || data.code || "login_failed",
        code: data.code,
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
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string; code?: string }> {
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
      error_code?: string;
      msg?: string;
    };
    if (!res.ok || !data.access_token || !data.refresh_token || !data.user?.id) {
      const code = String(data.error_code || "");
      return {
        ok: false,
        error: data.error_description || data.msg || "login_failed",
        code: code || undefined,
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
  nickname?: string,
): Promise<
  | { ok: true; session: AuthSession | null; needsConfirm?: boolean }
  | { ok: false; error: string }
> {
  const redirectTo = signupRedirectTo();
  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, nickname, redirectTo }),
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
      if (authCloudConfigured()) return directGoTrueSignUp(email, password, nickname);
      return { ok: false, error: data.error || data.code || "signup_failed" };
    }
    if (
      data.access_token &&
      data.refresh_token &&
      data.user?.id &&
      !data.needs_confirm
    ) {
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
    if (authCloudConfigured()) return directGoTrueSignUp(email, password, nickname);
    return { ok: false, error: "network_error" };
  }
}

async function directGoTrueSignUp(
  email: string,
  password: string,
  nickname?: string,
): Promise<
  | { ok: true; session: AuthSession | null; needsConfirm?: boolean }
  | { ok: false; error: string }
> {
  try {
    const redirectTo = signupRedirectTo();
    const res = await fetch(
      `${AUTH_CONFIG.supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: AUTH_CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${AUTH_CONFIG.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email,
          password,
          data: nickname ? { nickname } : {},
        }),
      },
    );
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      user?: { id: string; email?: string; email_confirmed_at?: string };
      error_description?: string;
      msg?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error_description || data.msg || "signup_failed",
      };
    }
    const confirmed = Boolean(data.user?.email_confirmed_at);
    if (
      data.access_token &&
      data.refresh_token &&
      data.user?.id &&
      confirmed
    ) {
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
  return page === "fin" || page === "account" || page === "admin";
}
