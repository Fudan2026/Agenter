/**
 * POST /api/fin-desk — 苏坡大模型 / SuPo Model (DeepSeek).
 * Preflight gold >= 20 (non-admin) → call LLM → debit AFTER actual tokens.
 * Admin (seanfudan@163.com / app_metadata.role=admin): no debit.
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";
import { rateLimit } from "../_shared/rateLimit.js";

const MODES = new Set([
  "pick",
  "factor",
  "strategy",
  "review",
  "multifactor",
  "e2e",
  "transformer",
]);
const GOLD_PER_1K = 1;
const MIN_FLOOR = 20;
const ADMIN_EMAIL = "seanfudan@163.com";

function goldCost(tokens) {
  return Math.max(1, Math.ceil((tokens / 1000) * GOLD_PER_1K));
}

function estimateTokens(text) {
  const n = String(text || "").length;
  return Math.max(200, Math.ceil(n / 1.5) + 400);
}

function systemPrompt(mode, locale) {
  const zh = locale === "zh";
  const base = zh
    ? "你是苏坡大模型（Supro / Super Professional AIaaS）。教育演示，不构成投资建议。不是 Fin-R1 权重，不下真单。语气乐观平和（苏东坡精神）。回答简洁，给出可执行下一步（看板/Lab 深链）。强调次日开盘成交与无未来函数。"
    : "You are SuPo Model (Supro / Super Professional AIaaS). Educational only — not investment advice. Not Fin-R1 weights; no live orders. Calm, professional tone. Be concise; suggest board/Lab deep-links. Emphasize next-open fills and no-lookahead.";
  const byMode = {
    pick: zh
      ? "模式=智能选股：提出筛选逻辑，可引用烘焙精选屏，说明代理宇宙局限。"
      : "Mode=smart screen: propose screening logic; reference baked screens; disclose proxy-universe limits.",
    factor: zh
      ? "模式=智能因子：建议因子倾斜与 IC 解读，勿声称预测收益。"
      : "Mode=smart factors: suggest factor tilts and IC literacy; no return prophecy.",
    strategy: zh
      ? "模式=策略草稿：建议 Lab 策略 id（ma_cross/rsi_reversion/confluence/ml_lite）与参数，并给 #/quant?panel=lab 深链。"
      : "Mode=strategy draft: suggest Lab strategy id + params and #/quant?panel=lab.",
    review: zh
      ? "模式=复盘问答：结合语料/日报要点作答，标明不确定处。"
      : "Mode=review Q&A: answer from corpus/review; mark uncertainty.",
    multifactor: zh
      ? "模式=多因子选股：结合 IC/因子看板上下文，给出可解释的多因子组合与风险披露，勿承诺收益。"
      : "Mode=multi-factor: combine IC/factor-board context into an interpretable basket; disclose risks; no return promises.",
    e2e: zh
      ? "模式=端到端策略：从信号→次日开盘成交→成本→纸盘/Lab 深链，输出可执行草稿（ma_cross/confluence/ml_lite 等）。"
      : "Mode=e2e strategy: signal→next-open fill→costs→Paper/Lab deep-link; draft ma_cross/confluence/ml_lite etc.",
    transformer: zh
      ? "模式=Transformer 识字：解释 TSFM/FinCast 与本站边界（无权重推理）；强调衰减、成本与无未来函数。"
      : "Mode=transformer literacy: explain TSFM/FinCast vs site limits (no weight inference); stress decay, costs, no-lookahead.",
  };
  return `${base}\n${byMode[mode] || ""}`;
}

async function callLlm(env, messages) {
  const backend = String(env.LLM_BACKEND || "deepseek").toLowerCase();
  const key =
    env.LLM_API_KEY ||
    env.DEEPSEEK_API_KEY ||
    env.OPENAI_API_KEY ||
    env.ANTHROPIC_API_KEY ||
    "";
  if (!key) {
    return { ok: false, code: "llm_not_configured", text: null };
  }

  if (backend === "anthropic") {
    const model = env.LLM_MODEL || "claude-3-5-haiku-latest";
    const system = messages.find((m) => m.role === "system")?.content || "";
    const userMsgs = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: userMsgs,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        code: "llm_error",
        text: data?.error?.message || "llm_error",
      };
    }
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return {
      ok: true,
      text,
      usage: {
        input: data.usage?.input_tokens ?? null,
        output: data.usage?.output_tokens ?? null,
      },
    };
  }

  const base =
    env.LLM_BASE_URL ||
    (backend === "deepseek"
      ? "https://api.deepseek.com"
      : "https://api.openai.com/v1");
  const model =
    env.LLM_MODEL ||
    (backend === "deepseek" ? "deepseek-chat" : "gpt-4o-mini");
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      code: "llm_error",
      text: data?.error?.message || "llm_error",
    };
  }
  return {
    ok: true,
    text: data.choices?.[0]?.message?.content || "",
    usage: {
      input: data.usage?.prompt_tokens ?? null,
      output: data.usage?.completion_tokens ?? null,
    },
  };
}

function offlineStub(mode, prompt, locale) {
  const zh = locale === "zh";
  if (mode === "multifactor" || mode === "pick") {
    return zh
      ? `【离线草稿】针对「${prompt.slice(0, 80)}」：先看 Factor Studio / IC（#/quant?panel=studio · #/quant?panel=ic）与精选屏。配置 DeepSeek 密钥后启用完整苏坡大模型。`
      : `[Offline] For “${prompt.slice(0, 80)}”: open Factor Studio / IC and screens. Configure DeepSeek for full SuPo Model.`;
  }
  if (mode === "e2e" || mode === "strategy") {
    return zh
      ? `【离线草稿】可试 Lab confluence / ma_cross → #/quant?panel=lab。信号 t → 次日开盘。`
      : `[Offline] Try Lab confluence / ma_cross → #/quant?panel=lab. Signal t → next open.`;
  }
  if (mode === "transformer") {
    return zh
      ? `【离线草稿】本站不加载 TSFM/FinCast 权重；只做识字与边界说明。详见手册。`
      : `[Offline] This site does not load TSFM/FinCast weights — literacy only. See Handbook.`;
  }
  return zh
    ? `【离线草稿】请打开每日复盘 #/quant?panel=review。配置 DeepSeek 后可 RAG 增强。`
    : `[Offline] Open Daily Review #/quant?panel=review. Configure DeepSeek for RAG.`;
}

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
  const context = String(body?.context || "").slice(0, 12000);

  const pre = await rpcWithServiceRole(env, "preflight_fin_desk", {
    p_user_id: String(user.id),
  });
  if (!pre.ok) {
    return json(
      { ok: false, code: "economy_error", error: pre.data },
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
    const corpRes = await fetch(`${origin}/data/fin-corpus.json`, {
      signal: AbortSignal.timeout(4000),
    });
    if (corpRes.ok) {
      const corp = await corpRes.json();
      const extra = (corp.chunks || [])
        .slice(0, 8)
        .map((c) => `- ${c.title}: ${c.text}`)
        .join("\n");
      if (extra) {
        messages[1].content = `Corpus:\n${extra}\n\n${messages[1].content}`;
      }
    }
  } catch {
    /* ignore */
  }

  const llm = await callLlm(env, messages);
  let answer;
  let llmMeta = {
    backend: env.LLM_BACKEND || "deepseek",
    offline: false,
  };
  let tokensUsed = estimateTokens(prompt + context + (llm.text || ""));
  if (!llm.ok) {
    answer = offlineStub(mode, prompt, locale);
    llmMeta = { ...llmMeta, offline: true, code: llm.code };
  } else {
    answer = llm.text;
    const inn = Number(llm.usage?.input);
    const out = Number(llm.usage?.output);
    if (Number.isFinite(inn) || Number.isFinite(out)) {
      tokensUsed = Math.max(
        1,
        (Number.isFinite(inn) ? inn : 0) + (Number.isFinite(out) ? out : 0),
      );
    }
    llmMeta = { ...llmMeta, usage: llm.usage };
  }

  const cost = goldCost(tokensUsed);
  const spend = await rpcWithServiceRole(env, "spend_gold_for_usage", {
    p_user_id: String(user.id),
    p_tokens: tokensUsed,
    p_feature: `fin_desk_${mode}`,
    p_gold: admin ? 0 : cost,
  });
  if (!spend.ok) {
    const msg = spend.data?.message || spend.data?.error || spend.data;
    const insufficient =
      String(msg).includes("insufficient") || spend.status === 402;
    return json(
      {
        ok: false,
        code: insufficient ? "insufficient_gold" : "spend_failed",
        error: msg,
        gold_needed: cost,
        answer_preview: answer?.slice?.(0, 200),
      },
      insufficient ? 402 : spend.status || 500,
    );
  }

  const spent = Number(spend.data?.spent ?? (admin ? 0 : cost));
  const stamp =
    locale === "zh"
      ? `\n\n— 苏坡大模型 · AIaaS · 非投资建议 · Token ${tokensUsed} · 已扣 ${spent} 金币（100 金币=$1）`
      : `\n\n— SuPo Model · AIaaS · not advice · tokens ${tokensUsed} · gold spent ${spent} (100 gold=$1)`;

  return json({
    ok: true,
    mode,
    answer: `${answer}${stamp}`,
    gold_spent: spent,
    gold_remaining: Number(spend.data?.gold ?? null),
    tokens_used: tokensUsed,
    admin: Boolean(spend.data?.admin || admin),
    meta: llmMeta,
  });
}
