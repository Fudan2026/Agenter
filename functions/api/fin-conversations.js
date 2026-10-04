/**
 * GET  /api/fin-conversations — list recent conversations
 * GET  /api/fin-conversations?id=uuid — load one + messages
 * DELETE /api/fin-conversations?id=uuid — delete one
 */

import { bearerToken, errText, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithUserJwt,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";

async function authed(request, env) {
  if (!supabaseAuthConfigured(env)) {
    return { error: json({ ok: false, code: "cloud_not_configured" }, 503) };
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) {
    return { error: json({ ok: false, code: "unauthorized" }, 401) };
  }
  return { jwt, user };
}

export async function onRequestGet({ request, env }) {
  const a = await authed(request, env);
  if (a.error) return a.error;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const res = await rpcWithUserJwt(env, a.jwt, "get_my_fin_conversation", {
      p_id: id,
    });
    if (!res.ok) {
      return json(
        {
          ok: false,
          code: "conversation_error",
          error: errText(res.data, "conversation_error"),
          hint: "Run supabase/supro_conversations_patch.sql",
        },
        res.status || 500,
      );
    }
    return json(res.data || { ok: false });
  }
  const res = await rpcWithUserJwt(env, a.jwt, "list_my_fin_conversations", {
    p_limit: 20,
  });
  if (!res.ok) {
    return json(
      {
        ok: false,
        code: "conversation_error",
        error: errText(res.data, "conversation_error"),
        hint: "Run supabase/supro_conversations_patch.sql",
      },
      res.status || 500,
    );
  }
  return json({ ok: true, conversations: res.data || [] });
}

export async function onRequestDelete({ request, env }) {
  const a = await authed(request, env);
  if (a.error) return a.error;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ ok: false, code: "invalid_id" }, 400);
  const res = await rpcWithUserJwt(env, a.jwt, "delete_my_fin_conversation", {
    p_id: id,
  });
  if (!res.ok) {
    return json(
      {
        ok: false,
        code: "conversation_error",
        error: errText(res.data, "conversation_error"),
      },
      res.status || 500,
    );
  }
  return json(res.data || { ok: true });
}
