/**
 * GET /api/economy-balance — current gold for JWT user.
 * Ensures wallet row exists (welcome grant via RPC).
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";

export async function onRequestGet({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) return json({ ok: false, code: "unauthorized" }, 401);

  const ensured = await rpcWithServiceRole(env, "ensure_user_economy", {
    p_user_id: user.id,
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

  const row = ensured.data;
  return json({
    ok: true,
    gold: Number(row?.gold ?? 0),
    total_earned: Number(row?.total_earned ?? 0),
    user_id: user.id,
    email: user.email ?? null,
  });
}
