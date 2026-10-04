/**
 * POST /api/signup — email/password register via Supro GoTrue.
 * Always requests emailRedirectTo → Supro site (confirm must not land on IELTS).
 * Body: { email, password, nickname?, redirectTo? }
 */

import { json } from "../_shared/http.js";
import {
  anonKey,
  cloudNotConfiguredBody,
  rpcWithServiceRole,
  supabaseAuthConfigured,
  supabaseUrl,
} from "../_shared/supabase.js";
import { rateLimit } from "../_shared/rateLimit.js";

const DEFAULT_REDIRECT = "https://supro.si/#/login";

function resolveRedirect(body, request) {
  const fromBody = String(body?.redirectTo || "").trim();
  if (fromBody.startsWith("https://supro.si") || fromBody.startsWith("https://www.supro.si")) {
    return fromBody;
  }
  try {
    const origin = new URL(request.url).origin;
    if (/supro\.si$/i.test(new URL(origin).host) || /pages\.dev$/i.test(new URL(origin).host)) {
      return `${origin}/#/login`;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_REDIRECT;
}

export async function onRequestPost({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json(cloudNotConfiguredBody(), 503);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "anon";
  const rl = rateLimit(`signup:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) return json({ ok: false, code: "rate_limited" }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }
  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");
  const nickname = String(body?.nickname || "").trim().slice(0, 64);
  if (!email || password.length < 6) {
    return json({ ok: false, code: "invalid_credentials" }, 400);
  }

  const key = anonKey(env);
  const host = supabaseUrl(env);
  const redirectTo = resolveRedirect(body, request);
  const url = `${host}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      email,
      password,
      data: nickname ? { nickname } : {},
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json(
      {
        ok: false,
        code: data?.error_code || data?.code || "signup_failed",
        error:
          data?.msg ||
          data?.error_description ||
          data?.message ||
          "signup_failed",
      },
      res.status >= 400 ? res.status : 400,
    );
  }

  const userId = data?.user?.id || data?.id;
  const confirmed = Boolean(data?.user?.email_confirmed_at || data?.user?.confirmed_at);

  // Do not open a session until email is confirmed (even if GoTrue returned tokens).
  if (data?.access_token && data?.refresh_token && confirmed) {
    if (userId) {
      await rpcWithServiceRole(env, "ensure_supro_economy", {
        p_user_id: String(userId),
      });
    }
    return json({
      ok: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user,
      needs_confirm: false,
    });
  }

  return json({
    ok: true,
    user: data.user || { email },
    needs_confirm: true,
    redirect_to: redirectTo,
  });
}
