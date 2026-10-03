/**
 * POST /api/signup — email/password register via shared Letus GoTrue.
 * Ensures shared user_economy row (no isolated Agenter wallet).
 * Body: { email, password }
 */

import { json } from "../_shared/http.js";
import {
  anonKey,
  rpcWithServiceRole,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";
import { rateLimit } from "../_shared/rateLimit.js";

const GOTRUE_HOST = "https://jrnabzfvdcmcoxyadmax.supabase.co";

export async function onRequestPost({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
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
  if (!email || password.length < 6) {
    return json({ ok: false, code: "invalid_credentials" }, 400);
  }

  const key = anonKey(env);
  const res = await fetch(`${GOTRUE_HOST}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ email, password }),
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
  if (userId) {
    await rpcWithServiceRole(env, "ensure_supro_economy", {
      p_user_id: String(userId),
    });
  }

  if (data?.access_token && data?.refresh_token) {
    return json({
      ok: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user,
      shared_wallet: true,
    });
  }

  return json({
    ok: true,
    user: data.user || { email },
    needs_confirm: true,
    shared_wallet: true,
  });
}
