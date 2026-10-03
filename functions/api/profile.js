/**
 * GET/POST /api/profile — nickname + avatar_url on Supro profiles.
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  rpcWithUserJwt,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";

export async function onRequestGet({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) return json({ ok: false, code: "unauthorized" }, 401);

  await rpcWithServiceRole(env, "ensure_supro_economy", {
    p_user_id: String(user.id),
  });
  const mine = await rpcWithUserJwt(env, jwt, "get_my_profile", {});
  if (!mine.ok) {
    return json({ ok: false, code: "profile_error", error: mine.data }, mine.status || 500);
  }
  return json({
    ok: true,
    profile: mine.data || {},
    email: user.email ?? null,
  });
}

export async function onRequestPost({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) return json({ ok: false, code: "unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }

  const nickname =
    body?.nickname == null ? null : String(body.nickname).trim().slice(0, 64);
  const avatar_url =
    body?.avatar_url == null
      ? null
      : String(body.avatar_url).trim().slice(0, 500);

  await rpcWithServiceRole(env, "ensure_supro_economy", {
    p_user_id: String(user.id),
  });
  const up = await rpcWithUserJwt(env, jwt, "upsert_my_profile", {
    p_nickname: nickname,
    p_avatar_url: avatar_url,
  });
  if (!up.ok) {
    return json({ ok: false, code: "profile_error", error: up.data }, up.status || 500);
  }
  return json({ ok: true, profile: up.data || {} });
}
