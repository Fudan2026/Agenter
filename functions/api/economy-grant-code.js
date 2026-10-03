/**
 * POST /api/economy-grant-code — redeem gold code.
 * Body: { code }
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";
import { rateLimit } from "../_shared/rateLimit.js";

export async function onRequestPost({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) return json({ ok: false, code: "unauthorized" }, 401);

  const ip = request.headers.get("CF-Connecting-IP") || user.id;
  const rl = rateLimit(`redeem:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) return json({ ok: false, code: "rate_limited" }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }
  const code = String(body?.code || "")
    .trim()
    .toUpperCase();
  if (!code) return json({ ok: false, code: "invalid_code" }, 400);

  const res = await rpcWithServiceRole(env, "redeem_gold_code", {
    p_user_id: user.id,
    p_code: code,
  });
  if (!res.ok) {
    return json(
      {
        ok: false,
        code: "redeem_failed",
        error: res.data?.message || res.data || "redeem_failed",
      },
      res.status >= 400 ? res.status : 400,
    );
  }
  return json({
    ok: true,
    gold: Number(res.data?.gold ?? 0),
    granted: Number(res.data?.granted ?? 0),
  });
}
