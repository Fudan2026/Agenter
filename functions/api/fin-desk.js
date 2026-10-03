/**
 * POST /api/fin-desk — login-gated Fin Desk AIaaS.
 * Body: { mode, prompt, locale?, context? }
 * Modes: pick | factor | strategy | review
 * Spends gold via spend_gold_for_usage based on token estimate.
 */

import { bearerToken, json } from "../_shared/http.js";
import {
  getUserFromJwt,
  rpcWithServiceRole,
  supabaseAuthConfigured,
} from "../_shared/supabase.js";
import { rateLimit } from "../_shared/rateLimit.js";

const MODES = new Set(["pick", "factor", "strategy", "review"]);
const GOLD_PER_1K = Number(1); // 1 gold / 1k tokens, floor 1

function estimateTokens(text) {
  const n = String(text || "").length;
  // Rough CJK-aware: ~1.5 chars / token average
  return Math.max(200, Math.ceil(n / 1.5) + 400);
}

function goldCost(tokens) {
  return Math.max(1, Math.ceil((tokens / 1000) * GOLD_PER_1K));
}

function systemPrompt(mode, locale) {
  const zh = locale === "zh";
  const base = zh
    ? "你是 Agenter Fin Desk（AIaaS）。教育演示，不构成投资建议。不是 Fin-R1 权重，不下真单。回答简洁，给出可执行的下一步（看板/Lab 深链）。"
    : "You are Agenter Fin Desk (AIaaS). Educational only — not investment advice. Not Fin-R1 weights; no live orders. Be concise; suggest next steps (board/Lab deep-links).";
  const byMode = {
    pick: zh
      ? "模式=智能选股：根据用户描述提出筛选逻辑，可引用烘焙精选屏，说明代理宇宙局限。"
      : "Mode=smart screen: propose screening logic; reference baked screens; disclose proxy-universe limits.",
    factor: zh
      ? "模式=智能因子：建议因子倾斜与 IC 解读，勿声称预测收益。"
      : "Mode=smart factors: suggest factor tilts and IC literacy; no return prophecy.",
    strategy: zh
      ? "模式=策略草稿：建议 Lab 策略 id（ma_cross/rsi_reversion/confluence/ml_lite 等）与参数，并给 #/quant?panel=lab 深链。"
      : "Mode=strategy draft: suggest Lab strategy id + params and a #/quant?panel=lab deep-link.",
    review: zh
      ? "模式=复盘问答：结合提供的语料/日报要点作答，标明不确定处。"
      : "Mode=review Q&A: answer from provided corpus/review bullets; mark uncertainty.",
  };
  return `${base}\n${byMode[mode] || ""}`;
}

async function callLlm(env, messages) {
  const backend = String(env.LLM_BACKEND || "openai").toLowerCase();
  const key =
    env.LLM_API_KEY ||
    env.OPENAI_API_KEY ||
    env.DEEPSEEK_API_KEY ||
    env.ANTHROPIC_API_KEY ||
    "";
  if (!key) {
    return {
      ok: false,
      code: "llm_not_configured",
      text: null,
    };
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
      return { ok: false, code: "llm_error", text: data?.error?.message || "llm_error" };
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

  // OpenAI-compatible (openai / deepseek)
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
  if (mode === "pick") {
    return zh
      ? `【离线草稿】针对「${prompt.slice(0, 80)}」：可先看 Quant 精选屏（#/quant?panel=screens）与 Macro 择时。代理宇宙，非全市场。配置 LLM 密钥后启用完整 AIaaS。`
      : `[Offline draft] For “${prompt.slice(0, 80)}”: open Quant screens (#/quant?panel=screens) and Macro timing. Proxy universe. Configure LLM key for full AIaaS.`;
  }
  if (mode === "factor") {
    return zh
      ? `【离线草稿】建议结合 Factor Studio / IC 面板（#/quant?panel=studio · #/quant?panel=ic）查看动量与低波倾斜。非收益承诺。`
      : `[Offline draft] Use Factor Studio / IC (#/quant?panel=studio · #/quant?panel=ic) for momentum/low-vol tilts. Not a return promise.`;
  }
  if (mode === "strategy") {
    return zh
      ? `【离线草稿】可试 Lab 策略 ma_cross 或 confluence，深链 #/quant?panel=lab。信号 t 收盘 → 次日开盘成交。`
      : `[Offline draft] Try Lab ma_cross or confluence → #/quant?panel=lab. Signal t close → next-open fill.`;
  }
  return zh
    ? `【离线草稿】请打开每日复盘 #/quant?panel=review，并结合语料回答。配置 LLM 后可 RAG 增强。`
    : `[Offline draft] Open Daily Review #/quant?panel=review. Configure LLM for RAG answers.`;
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
  const locale = body?.locale === "en" ? "en" : "zh";
  const context = String(body?.context || "").slice(0, 12000);

  const est = estimateTokens(prompt + context);
  const cost = goldCost(est);

  const spend = await rpcWithServiceRole(env, "spend_gold_for_usage", {
    p_user_id: user.id,
    p_tokens: est,
    p_feature: `fin_desk_${mode}`,
    p_gold: cost,
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
      },
      insufficient ? 402 : spend.status || 500,
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

  // Best-effort same-origin corpus enrichment
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
    /* ignore corpus miss */
  }

  const llm = await callLlm(env, messages);
  let answer;
  let llmMeta = { backend: env.LLM_BACKEND || "openai", offline: false };
  if (!llm.ok) {
    answer = offlineStub(mode, prompt, locale);
    llmMeta = { ...llmMeta, offline: true, code: llm.code };
  } else {
    answer = llm.text;
    llmMeta = { ...llmMeta, usage: llm.usage };
  }

  const stamp =
    locale === "zh"
      ? `\n\n— AIaaS · 非投资建议 · 非 Fin-R1 权重 · 已扣 ${cost} 金币`
      : `\n\n— AIaaS · not advice · not Fin-R1 weights · gold spent ${cost}`;

  return json({
    ok: true,
    mode,
    answer: `${answer}${stamp}`,
    gold_spent: cost,
    gold_remaining: Number(spend.data?.gold ?? spend.data?.new_gold ?? null),
    tokens_estimated: est,
    meta: llmMeta,
  });
}
