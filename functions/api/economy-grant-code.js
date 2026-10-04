/**
 * POST /api/economy-grant-code — redeem gold_codes into Supro wallet.
 * Prefers JWT redeem_my_gold_code; falls back to service_role redeem_gold_code.
 * Body: { code }
 */

import { bearerToken, errText, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  rpcWithUserJwt,
  serviceKey,
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

  let res = await rpcWithUserJwt(env, jwt, "redeem_my_gold_code", {
    p_code: code,
  });
  if (!res.ok && serviceKey(env)) {
    res = await rpcWithServiceRole(env, "redeem_gold_code", {
      p_user_id: String(user.id),
      p_code: code,
    });
  }
  if (res.ok) {
    return json({
      ok: true,
      gold: Number(res.data?.gold ?? 0),
      granted: Number(res.data?.granted ?? 0),
      via: "gold_codes",
    });
  }

  return json(
    {
      ok: false,
      code: "redeem_failed",
      error: errText(res.data, "redeem_failed"),
    },
    400,
  );
}
