/**
 * GET /api/economy-balance — Supro gold + admin / floor metadata.
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  rpcWithUserJwt,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";

const GOLD_PER_USD = 100;
const MIN_GOLD_FLOOR = 20;
const ADMIN_EMAIL = "seanfudan@163.com";

export async function onRequestGet({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) return json({ ok: false, code: "unauthorized" }, 401);

  await rpcWithUserJwt(env, jwt, "ensure_my_economy", {});
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

  const row = ensured.data || {};
  const email = String(user.email || "").toLowerCase();
  const isAdmin =
    Boolean(row.is_admin) ||
    email === ADMIN_EMAIL ||
    String(user.app_metadata?.role || "") === "admin";

  let usage = [];
  const usageRes = await rpcWithServiceRole(env, "list_fin_desk_usage", {
    p_user_id: String(user.id),
    p_limit: 20,
  });
  if (usageRes.ok && Array.isArray(usageRes.data)) usage = usageRes.data;

  return json({
    ok: true,
    gold: Number(row?.gold ?? 0),
    total_earned: Number(row?.total_earned ?? 0),
    gold_per_usd: GOLD_PER_USD,
    min_gold_floor: MIN_GOLD_FLOOR,
    is_admin: isAdmin,
    user_id: user.id,
    email: user.email ?? null,
    shared_wallet: false,
    standalone_supro: true,
    usage,
  });
}
