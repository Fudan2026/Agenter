/**
 * POST /api/fin-desk — 苏坡大模型 / Supro Model (DeepSeek).
 * Preflight gold >= 20 (non-admin) → call LLM → debit AFTER actual tokens.
 * Structured JSON pillars: multifactor / e2e / transformer / report / allocate.
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

function maxTokensForMode(mode) {
  if (mode === "report") return 3200;
  if (mode === "multifactor" || mode === "e2e" || mode === "allocate") return 2048;
  return 1400;
}

async function callLlm(env, messages, mode) {
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

  const max_tokens = maxTokensForMode(mode);

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
        max_tokens,
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
      temperature: 0.35,
      max_tokens,
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Retry without response_format if provider rejects it
    if (String(data?.error?.message || "").toLowerCase().includes("response_format")) {
      const res2 = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.35,
          max_tokens,
        }),
      });
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) {
        return {
          ok: false,
          code: "llm_error",
          text: data2?.error?.message || "llm_error",
        };
      }
      return {
        ok: true,
        text: data2.choices?.[0]?.message?.content || "",
        usage: {
          input: data2.usage?.prompt_tokens ?? null,
          output: data2.usage?.completion_tokens ?? null,
        },
      };
    }
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

  const llm = await callLlm(env, messages, mode);
  let structured = null;
  let answerText = "";
  let llmMeta = {
    backend: env.LLM_BACKEND || "deepseek",
    offline: false,
  };
  let tokensUsed = estimateTokens(prompt + context + (llm.text || ""));

  if (!llm.ok) {
    structured = offlineStructured(mode, prompt, locale);
    answerText = JSON.stringify(structured);
    llmMeta = { ...llmMeta, offline: true, code: llm.code };
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
    }
    llmMeta = { ...llmMeta, usage: llm.usage };
  }

  const cost = goldCost(tokensUsed);
  let spend = await rpcWithUserJwt(env, jwt, "spend_my_gold_for_usage", {
    p_tokens: tokensUsed,
    p_feature: `fin_desk_${mode}`,
    p_gold: admin ? 0 : cost,
  });
  if (!spend.ok && serviceKey(env)) {
    spend = await rpcWithServiceRole(env, "spend_gold_for_usage", {
      p_user_id: String(user.id),
      p_tokens: tokensUsed,
      p_feature: `fin_desk_${mode}`,
      p_gold: admin ? 0 : cost,
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

  const spent = Number(spend.data?.spent ?? (admin ? 0 : cost));
  const stamp =
    locale === "zh"
      ? `\n\n— 苏坡大模型 · AIaaS · 非投资建议 · Token ${tokensUsed} · 已扣 ${spent} 金币（100 金币=$1）`
      : `\n\n— Supro Model · AIaaS · not advice · tokens ${tokensUsed} · gold spent ${spent} (100 gold=$1)`;

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
