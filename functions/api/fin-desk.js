/**
 * POST /api/fin-desk — 苏坡大模型 / Supro Model (DeepSeek).
 * Preflight gold >= 20 (non-admin) → call LLM → debit AFTER actual tokens.
 * Structured JSON pillars: multifactor / e2e / transformer / report / allocate.
 *
 * Offline drafts are opt-in only (ALLOW_FIN_OFFLINE=true). Otherwise missing
 * LLM_API_KEY / DeepSeek errors return clearly — never fake Token counts.
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
import {
  MODES,
  extractJsonObject,
  offlineStructured,
  systemPrompt,
} from "../_shared/fin-prompts.js";
import {
  allowFinOffline,
  callLlm,
  goldCost,
  llmBackend,
  llmConfigured,
  llmModel,
} from "../_shared/llm.js";

const MIN_FLOOR = 20;
const ADMIN_EMAIL = "seanfudan@163.com";

function isAdminUser(user, preflight) {
  const email = String(user?.email || "").toLowerCase();
  return (
    Boolean(preflight?.is_admin) ||
    email === ADMIN_EMAIL ||
    String(user?.app_metadata?.role || "") === "admin"
  );
}

export async function onRequestPost({ request, env }) {
  if (!supabaseAuthConfigured(env)) {
    return json({ ok: false, code: "cloud_not_configured" }, 503);
  }
  const jwt = bearerToken(request);
  const user = await getUserFromJwt(env, jwt);
  if (!user?.id) return json({ ok: false, code: "unauthorized" }, 401);

  // Confirmed emails only (GoTrue sets email_confirmed_at)
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return json({ ok: false, code: "email_not_confirmed" }, 403);
  }

  const rl = rateLimit(`fin:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return json({ ok: false, code: "rate_limited" }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }

  const mode = String(body?.mode || "review");
  if (!MODES.has(mode)) {
    return json({ ok: false, code: "invalid_mode" }, 400);
  }
  const prompt = String(body?.prompt || "").trim();
  if (!prompt || prompt.length > 4000) {
    return json({ ok: false, code: "invalid_prompt" }, 400);
  }
  const locale = body?.locale === "zh" ? "zh" : "en";
  const context = String(body?.context || "").slice(0, 14000);

  let pre = await rpcWithUserJwt(env, jwt, "preflight_my_fin_desk", {});
  if (!pre.ok && serviceKey(env)) {
    pre = await rpcWithServiceRole(env, "preflight_fin_desk", {
      p_user_id: String(user.id),
    });
  }
  if (!pre.ok) {
    return json(
      {
        ok: false,
        code: "economy_error",
        error: errText(pre.data, "economy_error"),
        hint:
          "Apply supabase/supro_auth_rpc_patch.sql on the Supro project (JWT RPCs). Also set SUPABASE_SERVICE_ROLE_KEY on Pages if preferred.",
      },
      pre.status || 500,
    );
  }
  const preflight = pre.data || {};
  const admin = isAdminUser(user, preflight);
  if (!admin && preflight.ok === false) {
    return json(
      {
        ok: false,
        code: "insufficient_gold_floor",
        gold: Number(preflight.gold ?? 0),
        min_gold_floor: MIN_FLOOR,
        error: "insufficient_gold_floor",
      },
      402,
    );
  }
  if (!admin && Number(preflight.gold ?? 0) < MIN_FLOOR) {
    return json(
      {
        ok: false,
        code: "insufficient_gold_floor",
        gold: Number(preflight.gold ?? 0),
        min_gold_floor: MIN_FLOOR,
      },
      402,
    );
  }

  const messages = [
    { role: "system", content: systemPrompt(mode, locale) },
    {
      role: "user",
      content: context
        ? `Context:\n${context}\n\nUser:\n${prompt}`
        : prompt,
    },
  ];

  try {
    const origin = new URL(request.url).origin;
    const files = ["fin-corpus.json", "factors-ic.json", "screens.json"];
    for (const f of files) {
      try {
        const corpRes = await fetch(`${origin}/data/${f}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (!corpRes.ok) continue;
        const corp = await corpRes.json();
        if (f === "fin-corpus.json") {
          const extra = (corp.chunks || [])
            .slice(0, 10)
            .map((c) => `- ${c.title}: ${c.text}`)
            .join("\n");
          if (extra) {
            messages[1].content = `Corpus:\n${extra}\n\n${messages[1].content}`;
          }
        } else if (f === "factors-ic.json" && Array.isArray(corp.rows)) {
          const extra = corp.rows
            .slice(0, 12)
            .map(
              (r) =>
                `- ${r.factor}: IC=${r.icMean ?? "—"} IR=${r.ir ?? "—"}`,
            )
            .join("\n");
          if (extra) {
            messages[1].content = `FactorIC:\n${extra}\n\n${messages[1].content}`;
          }
        } else if (f === "screens.json" && Array.isArray(corp.screens)) {
          const extra = corp.screens
            .slice(0, 8)
            .map((s) => `- ${s.id}: ${s.nameEn || s.nameZh} n=${s.codeCount}`)
            .join("\n");
          if (extra) {
            messages[1].content = `Screens:\n${extra}\n\n${messages[1].content}`;
          }
        }
      } catch {
        /* ignore per file */
      }
    }
  } catch {
    /* ignore */
  }

  if (!llmConfigured(env) && !allowFinOffline(env)) {
    return json(
      {
        ok: false,
        code: "llm_not_configured",
        error: "llm_not_configured",
        hint:
          "Set Cloudflare Pages Production secret LLM_API_KEY (DeepSeek) and/or GitHub Actions secret LLM_API_KEY so deploy can sync it. Redeploy after setting. Optional alias: DEEPSEEK_API_KEY.",
        need: ["LLM_API_KEY"],
        backend: llmBackend(env),
        model: llmModel(env),
      },
      503,
    );
  }

  const llm = await callLlm(env, messages, mode);
  let structured = null;
  let answerText = "";
  let llmMeta = {
    backend: llmBackend(env),
    model: llmModel(env),
    offline: false,
  };
  let tokensUsed = 0;

  if (!llm.ok) {
    if (!allowFinOffline(env)) {
      return json(
        {
          ok: false,
          code: llm.code || "llm_error",
          error: errText(llm.error || llm.code, "llm_error"),
          hint:
            llm.code === "llm_not_configured"
              ? "Set Pages Production secret LLM_API_KEY (DeepSeek), then redeploy."
              : "DeepSeek/LLM call failed. Check LLM_API_KEY, LLM_MODEL=deepseek-chat, and LLM_BASE_URL.",
          backend: llmBackend(env),
          model: llmModel(env),
        },
        llm.code === "llm_not_configured" ? 503 : 502,
      );
    }
    // Explicit offline opt-in only — never invent billed tokens
    structured = offlineStructured(mode, prompt, locale);
    answerText = JSON.stringify(structured);
    llmMeta = { ...llmMeta, offline: true, code: llm.code };
    tokensUsed = 0;
  } else {
    structured = extractJsonObject(llm.text);
    if (!structured) {
      structured = {
        ...offlineStructured(mode, prompt, locale),
        narrative: llm.text,
        reasoning_chain: [
          ...(offlineStructured(mode, prompt, locale).reasoning_chain || []),
          "Model returned non-JSON; narrative preserved",
        ],
      };
      // Clear offline-looking narrative if we have real model text
      if (llm.text) {
        structured.narrative = llm.text;
        structured.reasoning_chain = [
          "DeepSeek response parsed as narrative (non-JSON)",
        ];
      }
      answerText = JSON.stringify(structured);
    } else {
      answerText = JSON.stringify(structured);
    }
    const inn = Number(llm.usage?.input);
    const out = Number(llm.usage?.output);
    if (Number.isFinite(inn) || Number.isFinite(out)) {
      tokensUsed = Math.max(
        1,
        (Number.isFinite(inn) ? inn : 0) + (Number.isFinite(out) ? out : 0),
      );
    } else {
      // Real call succeeded but provider omitted usage — bill a minimal floor
      tokensUsed = 1;
    }
    llmMeta = { ...llmMeta, usage: llm.usage };
  }

  const cost = goldCost(tokensUsed);
  // Admin steward: log tokens, spent=0. Offline: tokens=0 → cost=0.
  const billGold = admin || tokensUsed <= 0 ? 0 : cost;

  let spend = await rpcWithUserJwt(env, jwt, "spend_my_gold_for_usage", {
    p_tokens: tokensUsed,
    p_feature: `fin_desk_${mode}`,
    p_gold: billGold,
  });
  if (!spend.ok && serviceKey(env)) {
    spend = await rpcWithServiceRole(env, "spend_gold_for_usage", {
      p_user_id: String(user.id),
      p_tokens: tokensUsed,
      p_feature: `fin_desk_${mode}`,
      p_gold: billGold,
    });
  }
  if (!spend.ok) {
    const msg = errText(spend.data, "spend_failed");
    const insufficient =
      msg.includes("insufficient") || spend.status === 402;
    return json(
      {
        ok: false,
        code: insufficient ? "insufficient_gold" : "spend_failed",
        error: msg,
        gold_needed: cost,
      },
      insufficient ? 402 : spend.status || 500,
    );
  }

  const spent = Number(spend.data?.spent ?? billGold);
  const offline = Boolean(llmMeta.offline);
  let stamp;
  if (offline) {
    stamp =
      locale === "zh"
        ? `\n\n— 离线草稿 · 未调用 DeepSeek · Token 0 · 已扣 0 金币`
        : `\n\n— Offline draft · DeepSeek not called · tokens 0 · gold spent 0`;
  } else if (admin) {
    stamp =
      locale === "zh"
        ? `\n\n— 苏坡大模型 · DeepSeek · 非投资建议 · Token ${tokensUsed} · 管理员免扣（标价 ${cost} 金币；100 金币=$1）`
        : `\n\n— Supro Model · DeepSeek · not advice · tokens ${tokensUsed} · admin free (list price ${cost} gold; 100 gold=$1)`;
  } else {
    stamp =
      locale === "zh"
        ? `\n\n— 苏坡大模型 · DeepSeek · 非投资建议 · Token ${tokensUsed} · 已扣 ${spent} 金币（100 金币=$1）`
        : `\n\n— Supro Model · DeepSeek · not advice · tokens ${tokensUsed} · gold spent ${spent} (100 gold=$1)`;
  }

  return json({
    ok: true,
    mode,
    answer: `${answerText}${stamp}`,
    structured,
    gold_spent: spent,
    gold_remaining: Number(spend.data?.gold ?? null),
    tokens_used: tokensUsed,
    admin: Boolean(spend.data?.admin || admin),
    meta: llmMeta,
  });
}
