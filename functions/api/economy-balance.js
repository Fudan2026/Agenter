/**
 * GET /api/economy-balance — Supro gold + admin / floor metadata.
 * Prefers JWT ensure_my_economy (no service_role required).
 */

import { bearerToken, errText, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  rpcWithUserJwt,
  serviceKey,
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

  let row = null;
  let rpcErr = null;

  const mine = await rpcWithUserJwt(env, jwt, "ensure_my_economy", {});
  if (mine.ok && mine.data && typeof mine.data === "object") {
    row = mine.data;
  } else {
    rpcErr = mine.data;
    if (serviceKey(env)) {
      const ensured = await rpcWithServiceRole(env, "ensure_supro_economy", {
        p_user_id: String(user.id),
      });
      if (ensured.ok && ensured.data) {
        row = ensured.data;
        rpcErr = null;
      } else {
        rpcErr = ensured.data || mine.data;
      }
    }
  }

  if (!row) {
    return json(
      {
        ok: false,
        code: "economy_error",
        error: errText(rpcErr, "economy_error"),
        hint:
          "Run supabase/supro.sql (or supabase/supro_auth_rpc_patch.sql). Prefer JWT ensure_my_economy; service_role optional for balance.",
      },
      500,
    );
  }

  const email = String(user.email || "").toLowerCase();
  const isAdmin =
    Boolean(row.is_admin) ||
    email === ADMIN_EMAIL ||
    String(user.app_metadata?.role || "") === "admin";

  let usage = [];
  const usageMine = await rpcWithUserJwt(env, jwt, "list_my_fin_desk_usage", {
    p_limit: 20,
  });
  if (usageMine.ok && Array.isArray(usageMine.data)) {
    usage = usageMine.data;
  } else if (serviceKey(env)) {
    const usageRes = await rpcWithServiceRole(env, "list_fin_desk_usage", {
      p_user_id: String(user.id),
      p_limit: 20,
    });
    if (usageRes.ok && Array.isArray(usageRes.data)) usage = usageRes.data;
  }

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
