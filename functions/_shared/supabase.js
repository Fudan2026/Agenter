/**
 * Supabase helpers for Cloudflare Pages Functions.
 * service_role stays in env — never ship to the browser.
 */

export function supabaseUrl(env) {
  let u = String(env?.SUPABASE_URL || "").trim().replace(/\/$/, "");
  u = u.replace(/\/rest\/v1$/i, "").replace(/\/auth\/v1$/i, "");
  return /^https?:\/\//i.test(u) ? u : "";
}

export function anonKey(env) {
  return String(env?.SUPABASE_ANON_KEY || "").trim();
}

export function serviceKey(env) {
  return String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function supabaseAuthConfigured(env) {
  return Boolean(supabaseUrl(env) && anonKey(env));
}

export function supabaseConfigured(env) {
  return Boolean(supabaseUrl(env) && anonKey(env) && serviceKey(env));
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
