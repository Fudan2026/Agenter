/**
 * POST /api/fin-agent — Fin-Research Agent (Plan-and-Solve), 6× gold.
 * Max 4 deterministic tools + 1 synthesis LLM call.
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
  extractJsonObject,
  liveStructuredFromText,
  offlineStructured,
  systemPrompt,
} from "../_shared/fin-prompts.js";
import {
  allowFinOffline,
  callLlm,
  llmBackend,
  llmConfigured,
  llmModel,
  repairJsonLlm,
  sumUsage,
} from "../_shared/llm.js";
import {
  billGoldForMode,
  minGoldFloorForMode,
  modeGoldMultiplier,
  trimHistoryForModel,
} from "../_shared/gold-tiers.js";
import { executeAgentPlan } from "../_shared/fin-agent-tools.js";

const MODE = "agent";
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
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return json({ ok: false, code: "email_not_confirmed" }, 403);
  }

  const rl = rateLimit(`fin-agent:${user.id}`, { limit: 8, windowMs: 60_000 });
  if (!rl.ok) return json({ ok: false, code: "rate_limited" }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }

  const prompt = String(body?.prompt || "").trim();
  if (!prompt || prompt.length > 4000) {
    return json({ ok: false, code: "invalid_prompt" }, 400);
  }
  const locale = body?.locale === "zh" ? "zh" : "en";
  const context = String(body?.context || "").slice(0, 10000);
  const historyIn = Array.isArray(body?.messages) ? body.messages : [];
  let conversationId = body?.conversation_id
    ? String(body.conversation_id)
    : null;
  const floor = minGoldFloorForMode(MODE);

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
      },
      pre.status || 500,
    );
  }
  const preflight = pre.data || {};
  const admin = isAdminUser(user, preflight);
  if (!admin && (preflight.ok === false || Number(preflight.gold ?? 0) < floor)) {
    return json(
      {
        ok: false,
        code: "insufficient_gold_floor",
        gold: Number(preflight.gold ?? 0),
        min_gold_floor: floor,
      },
      402,
    );
  }

  const origin = new URL(request.url).origin;
  const { reasoning_steps, observations } = await executeAgentPlan(
    origin,
    prompt,
  );

  const toolBlock = reasoning_steps
    .map(
      (s) =>
        `[step ${s.step}] thought=${s.thought}\naction=${s.action}\nobs=${s.observation}`,
    )
    .join("\n\n")
    .slice(0, 7000);

  const userContent = `Context:\n${context.slice(0, 4000)}\n\nAgentToolTrace:\n${toolBlock}\n\nUser:\n${prompt}`;

  const prior = trimHistoryForModel(historyIn, 20);
  const messages = [
    { role: "system", content: systemPrompt(MODE, locale) },
    ...prior,
    { role: "user", content: userContent },
  ];

  {
    const ens = await rpcWithUserJwt(env, jwt, "ensure_my_fin_conversation", {
      p_id: conversationId,
      p_title: prompt.slice(0, 80),
      p_mode: MODE,
    });
    if (ens.ok && ens.data?.id) conversationId = String(ens.data.id);
  }

  if (!llmConfigured(env) && !allowFinOffline(env)) {
    return json(
      {
        ok: false,
        code: "llm_not_configured",
        error: "llm_not_configured",
        reasoning_steps,
      },
      503,
    );
  }

  let llm = await callLlm(env, messages, MODE);
  let usageAcc = llm.usage || null;
  let structured = null;
  let answerText = "";
  let llmMeta = {
    backend: llmBackend(env),
    model: llmModel(env),
    offline: false,
    agent: true,
    tool_count: observations.length,
  };
  let tokensUsed = 0;

  if (!llm.ok) {
    if (!allowFinOffline(env)) {
      return json(
        {
          ok: false,
          code: llm.code || "llm_error",
          error: errText(llm.error || llm.code, "llm_error"),
          reasoning_steps,
        },
        llm.code === "llm_not_configured" ? 503 : 502,
      );
    }
    structured = offlineStructured(MODE, prompt, locale);
    structured.reasoning_steps = reasoning_steps;
    answerText = JSON.stringify(structured);
    llmMeta.offline = true;
    tokensUsed = 0;
  } else {
    structured = extractJsonObject(llm.text);
    if (!structured) {
      const repaired = await repairJsonLlm(env, MODE, llm.text, locale);
      usageAcc = sumUsage(usageAcc, repaired.usage) || usageAcc;
      if (repaired.ok) structured = extractJsonObject(repaired.text);
    }
    if (!structured) {
      structured = liveStructuredFromText(MODE, prompt, locale, llm.text);
      llmMeta.non_json = true;
    }
    structured.reasoning_steps = reasoning_steps;
    if (!structured.report?.title) {
      structured.report = {
        ...(structured.report || {}),
        title:
          locale === "zh" ? "苏大学士深度投研（Agent）" : "Supro Agent Research",
        summary: structured.narrative || structured.report?.summary || "",
        sections: structured.report?.sections || [],
        rating: structured.report?.rating || "n/a",
        quality_score: structured.report?.quality_score ?? 0.5,
        sources: [
          ...(structured.report?.sources || []),
          "announcements",
          "iwencai",
          "alpha-lite",
          "agent-tools",
        ],
      };
    }
    answerText = JSON.stringify(structured);
    const inn = Number(usageAcc?.input);
    const out = Number(usageAcc?.output);
    tokensUsed =
      Number.isFinite(inn) || Number.isFinite(out)
        ? Math.max(
            1,
            (Number.isFinite(inn) ? inn : 0) + (Number.isFinite(out) ? out : 0),
          )
        : 1;
    llmMeta = { ...llmMeta, usage: usageAcc, live: true };
  }

  const mult = modeGoldMultiplier(MODE);
  const cost = billGoldForMode(tokensUsed, MODE, { admin: false });
  const billGold = billGoldForMode(tokensUsed, MODE, { admin });

  let spend = await rpcWithUserJwt(env, jwt, "spend_my_gold_for_usage", {
    p_tokens: tokensUsed,
    p_feature: `fin_desk_${MODE}`,
    p_gold: billGold,
  });
  if (!spend.ok && serviceKey(env)) {
    spend = await rpcWithServiceRole(env, "spend_gold_for_usage", {
      p_user_id: String(user.id),
      p_tokens: tokensUsed,
      p_feature: `fin_desk_${MODE}`,
      p_gold: billGold,
    });
  }
  if (!spend.ok) {
    const msg = errText(spend.data, "spend_failed");
    const insufficient = msg.includes("insufficient") || spend.status === 402;
    return json(
      {
        ok: false,
        code: insufficient ? "insufficient_gold" : "spend_failed",
        error: msg,
        gold_needed: cost,
        mode_multiplier: mult,
        reasoning_steps,
      },
      insufficient ? 402 : spend.status || 500,
    );
  }

  const spent = Number(spend.data?.spent ?? billGold);
  const stamp =
    admin
      ? locale === "zh"
        ? `\n\n— 苏坡 Agent · DeepSeek · 非投资建议 · Token ${tokensUsed} · 6x档 · 管理员免扣（标价 ${cost}）`
        : `\n\n— Supro Agent · DeepSeek · not advice · tokens ${tokensUsed} · 6x · admin free (list ${cost})`
      : locale === "zh"
        ? `\n\n— 苏坡 Agent · DeepSeek · 非投资建议 · Token ${tokensUsed} · 6x档 · 已扣 ${spent} 金币`
        : `\n\n— Supro Agent · DeepSeek · not advice · tokens ${tokensUsed} · 6x · gold spent ${spent}`;

  if (conversationId) {
    await rpcWithUserJwt(env, jwt, "append_my_fin_messages", {
      p_conversation_id: conversationId,
      p_user_content: prompt,
      p_assistant_content: `${answerText}${stamp}`,
      p_structured: structured,
      p_tokens: tokensUsed,
      p_gold: spent,
      p_mode: MODE,
    });
  }

  return json({
    ok: true,
    mode: MODE,
    conversation_id: conversationId,
    answer: `${answerText}${stamp}`,
    structured,
    reasoning_steps,
    gold_spent: spent,
    gold_remaining: Number(spend.data?.gold ?? null),
    tokens_used: tokensUsed,
    mode_multiplier: mult,
    admin: Boolean(spend.data?.admin || admin),
    meta: llmMeta,
  });
}
