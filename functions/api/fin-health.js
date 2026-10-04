/**
 * GET /api/fin-health — diagnostic (no secrets). Is DeepSeek wired for Supro Model?
 */

import { json } from "../_shared/http.js";
import {
  allowFinOffline,
  llmBackend,
  llmConfigured,
  llmModel,
} from "../_shared/llm.js";
import {
  serviceKey,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";

export async function onRequestGet({ env }) {
  const configured = llmConfigured(env);
  return json({
    ok: true,
    llm_configured: configured,
    backend: llmBackend(env),
    model: llmModel(env),
    allow_offline: allowFinOffline(env),
    supabase_auth: supabaseAuthConfigured(env),
    service_role: Boolean(serviceKey(env)),
    hint: configured
      ? "LLM key present — Fin Desk should call DeepSeek (not offline drafts)."
      : "Missing LLM_API_KEY (or DEEPSEEK_API_KEY) on Cloudflare Pages Production. Set it, redeploy, then re-ask.",
  });
}
