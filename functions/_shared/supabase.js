/**
 * Supabase helpers for Cloudflare Pages Functions.
 * service_role stays in env — never ship to the browser.
 *
 * Accepts both Production names (SUPABASE_*) and accidental VITE_* copies
 * that station masters sometimes paste into the Pages dashboard.
 */

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

export function supabaseUrl(env) {
  let u = firstNonEmpty(
    env?.SUPABASE_URL,
    env?.VITE_SUPABASE_URL,
    env?.PUBLIC_SUPABASE_URL,
  ).replace(/\/$/, "");
  u = u.replace(/\/rest\/v1$/i, "").replace(/\/auth\/v1$/i, "");
  return /^https?:\/\//i.test(u) ? u : "";
}

export function anonKey(env) {
  return firstNonEmpty(
    env?.SUPABASE_ANON_KEY,
    env?.VITE_SUPABASE_ANON_KEY,
    env?.PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function serviceKey(env) {
  return firstNonEmpty(
    env?.SUPABASE_SERVICE_ROLE_KEY,
    env?.SERVICE_ROLE_KEY,
  );
}

export function supabaseAuthConfigured(env) {
  return Boolean(supabaseUrl(env) && anonKey(env));
}

export function supabaseConfigured(env) {
  return Boolean(supabaseUrl(env) && anonKey(env) && serviceKey(env));
}

/** Diagnostic payload when Auth is not wired (no secret values). */
export function cloudNotConfiguredBody() {
  return {
    ok: false,
    code: "cloud_not_configured",
    error: "cloud_not_configured",
    hint:
      "Cloudflare Pages project `supro` (Production) needs env SUPABASE_URL + SUPABASE_ANON_KEY, then redeploy. GitHub VITE_* alone is not enough for /api/* Functions.",
    need: ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
  };
}

export async function getUserFromJwt(env, jwt) {
  if (!jwt || !supabaseAuthConfigured(env)) return null;
  const res = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
    headers: {
      apikey: anonKey(env),
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function rpcWithServiceRole(env, fnName, args) {
  const key = serviceKey(env);
  if (!key || !supabaseUrl(env)) {
    return { ok: false, status: 503, data: { error: "service_not_configured" } };
  }
  const res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function rpcWithUserJwt(env, jwt, fnName, args) {
  if (!jwt || !supabaseAuthConfigured(env)) {
    return { ok: false, status: 401, data: { error: "unauthorized" } };
  }
  const res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: anonKey(env),
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function restService(env, path, opts = {}) {
  const key = serviceKey(env);
  if (!key || !supabaseUrl(env)) {
    return { ok: false, status: 503, data: null };
  }
  const res = await fetch(`${supabaseUrl(env)}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
