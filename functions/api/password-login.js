/**
 * Same-origin password login → GoTrue password grant.
 * POST { email, password }
 * → { ok, access_token, refresh_token, user, gate: "password-login" }
 */

import { json } from "../_shared/http.js";
import {
  anonKey,
  serviceKey,
  supabaseAuthConfigured,
  supabaseUrl,
} from "../_shared/supabase.js";
import { rateLimit } from "../_shared/rateLimit.js";

const GATE = "password-login";

function withGate(payload) {
  return { ...payload, gate: GATE };
}

async function passwordGrant(env, email, password) {
  const base = supabaseUrl(env);
  const key = anonKey(env);
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function grantError(body, status) {
  const code =
    body?.error_code ||
    body?.code ||
    (status === 429 ? "over_request_rate_limit" : "auth_error");
  const error =
    body?.msg ||
    body?.error_description ||
    body?.message ||
    "auth_error";
  return withGate({
    ok: false,
    code: String(code),
    error: String(error),
    status,
  });
}

function grantOk(body, extra = {}) {
  return withGate({
    ok: true,
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    token_type: body.token_type || "bearer",
    expires_in: body.expires_in,
    expires_at: body.expires_at,
    user: body.user,
    ...extra,
  });
}

async function findUserIdByEmail(env, email) {
  const key = serviceKey(env);
  const base = supabaseUrl(env);
  if (!key || !base) return null;
  const res = await fetch(
    `${base}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const users = Array.isArray(data?.users) ? data.users : [];
  const match = users.find(
    (u) => String(u?.email || "").toLowerCase() === email.toLowerCase(),
  );
  return match?.id || users[0]?.id || null;
}

async function autoConfirmEmail(env, userId) {
  const key = serviceKey(env);
  const base = supabaseUrl(env);
  if (!key || !userId || !base) return false;
  const res = await fetch(
    `${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_confirm: true }),
    },
  );
  return res.ok;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!supabaseAuthConfigured(env)) {
      return json(
        withGate({
          ok: false,
          code: "cloud_not_configured",
          error: "cloud_not_configured",
        }),
        503,
      );
    }

    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const rl = rateLimit(`login:${ip}`, { limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return json(
        withGate({ ok: false, code: "rate_limited", error: "rate_limited" }),
        429,
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(
        withGate({ ok: false, code: "invalid_json", error: "invalid_json" }),
        400,
      );
    }

    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");
    if (!email || !password) {
      return json(
        withGate({
          ok: false,
          code: "invalid_credentials",
          error: "Invalid login credentials",
        }),
        400,
      );
    }

    const first = await passwordGrant(env, email, password);
    if (
      first.ok &&
      first.body?.access_token &&
      first.body?.refresh_token &&
      first.body?.user?.id
    ) {
      return json(grantOk(first.body));
    }

    const err = grantError(first.body, first.status);
    const code = String(err.code || "").toLowerCase();

    if (code === "email_not_confirmed" && serviceKey(env)) {
      const userId =
        first.body?.user?.id || (await findUserIdByEmail(env, email));
      if (userId) {
        const confirmed = await autoConfirmEmail(env, userId);
        if (confirmed) {
          const second = await passwordGrant(env, email, password);
          if (
            second.ok &&
            second.body?.access_token &&
            second.body?.refresh_token &&
            second.body?.user?.id
          ) {
            return json(grantOk(second.body, { auto_confirmed: true }));
          }
        }
      }
    }

    const status =
      first.status >= 400 && first.status < 600 ? first.status : 400;
    return json(err, status);
  } catch (e) {
    return json(
      withGate({
        ok: false,
        code: "network_error",
        error: e?.message || "Failed to fetch",
      }),
      502,
    );
  }
}
