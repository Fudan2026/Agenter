/**
 * POST /api/economy-grant-code — redeem into shared Letus gold.
 * Tries additive gold_codes first; falls back to Letus redeem_vip_code (JWT).
 * Body: { code }
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  rpcWithUserJwt,
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

  // Additive Supro gold_codes → shared user_economy.gold
  const res = await rpcWithServiceRole(env, "redeem_gold_code", {
    p_user_id: String(user.id),
    p_code: code,
  });
  if (res.ok) {
    return json({
      ok: true,
      gold: Number(res.data?.gold ?? 0),
      granted: Number(res.data?.granted ?? 0),
      via: "gold_codes",
    });
  }

  // Fall back to Letus VIP/gold codes (JWT-scoped)
  const vip = await rpcWithUserJwt(env, jwt, "redeem_vip_code", {
    p_code: code,
  });
  if (vip.ok && (vip.data?.ok === true || vip.data?.ok === undefined)) {
    const granted =
      Number(vip.data?.granted ?? vip.data?.gold_granted ?? 0) ||
      (vip.data?.type === "gold" ? Number(vip.data?.gold ?? 0) : 0);
    // After vip redeem, re-read balance
    const bal = await rpcWithServiceRole(env, "ensure_supro_economy", {
      p_user_id: String(user.id),
    });
    return json({
      ok: true,
      gold: Number(bal.data?.gold ?? vip.data?.gold ?? 0),
      granted,
      via: "vip_codes",
      vip: vip.data,
    });
  }

  return json(
    {
      ok: false,
      code: "redeem_failed",
      error:
        res.data?.message ||
        vip.data?.reason ||
        res.data ||
        vip.data ||
        "redeem_failed",
    },
    400,
  );
}
