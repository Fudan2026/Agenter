/**
 * GET /api/economy-balance — shared Letus user_economy.gold for JWT user.
 * Ensures wallet row via ensure_supro_economy (additive on Letus schema).
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  rpcWithUserJwt,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";

const GOLD_PER_USD = 100;

export async function onRequestGet({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) return json({ ok: false, code: "unauthorized" }, 401);

  // Prefer Letus JWT-scoped ensure (admin bootstrap); fall back to service path.
  let row = null;
  const mine = await rpcWithUserJwt(env, jwt, "ensure_my_economy", {});
  if (mine.ok && mine.data) {
    row = mine.data;
  } else {
    const ensured = await rpcWithServiceRole(env, "ensure_supro_economy", {
      p_user_id: String(user.id),
    });
    if (!ensured.ok) {
      return json(
        {
          ok: false,
          code: "economy_error",
          error: ensured.data,
        },
        ensured.status || 500,
      );
    }
    row = ensured.data;
  }

  return json({
    ok: true,
    gold: Number(row?.gold ?? 0),
    total_earned: Number(row?.total_earned ?? 0),
    gold_per_usd: GOLD_PER_USD,
    user_id: user.id,
    email: user.email ?? null,
    shared_wallet: true,
  });
}
