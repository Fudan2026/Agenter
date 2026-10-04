/**
 * DeepSeek / OpenAI-compatible / Anthropic caller for Pages Functions.
 * Keys stay in env — never ship to the browser.
 */

import {
  sanitizeImageDataUrl,
  visionParseSystemPrompt,
  visionUserContent,
} from "./vision.js";

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

export function llmApiKey(env) {
  return firstNonEmpty(
    env?.LLM_API_KEY,
    env?.DEEPSEEK_API_KEY,
    env?.OPENAI_API_KEY,
    env?.ANTHROPIC_API_KEY,
    env?.SUPRO_LLM_API_KEY,
  );
}

export function llmBackend(env) {
  return String(env?.LLM_BACKEND || "deepseek").toLowerCase();
}

export function llmModel(env) {
  const backend = llmBackend(env);
  return (
    firstNonEmpty(env?.LLM_MODEL) ||
    (backend === "deepseek"
      ? "deepseek-chat"
      : backend === "anthropic"
        ? "claude-3-5-haiku-latest"
        : "gpt-4o-mini")
  );
}

export function llmConfigured(env) {
  return Boolean(llmApiKey(env));
}

export function allowFinOffline(env) {
  const v = String(env?.ALLOW_FIN_OFFLINE || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** 1 gold per 1k tokens, floor 1 (when tokens > 0). */
export function goldCost(tokens) {
  const t = Math.max(0, Number(tokens) || 0);
  if (t <= 0) return 0;
  return Math.max(1, Math.ceil((t / 1000) * 1));
}

/** Heuristic only — never report as billed tokens when LLM was not called. */
export function estimateTokens(text) {
  const n = String(text || "").length;
  return Math.max(200, Math.ceil(n / 1.5) + 400);
}

export function maxTokensForMode(mode) {
  if (mode === "agent" || mode === "report") return 4096;
  if (mode === "edge_infer") return 3072;
  if (mode === "multifactor" || mode === "e2e" || mode === "allocate") return 3072;
  if (mode === "transformer") return 2560;
  return 2048;
}

export function llmVisionModel(env) {
  return (
    firstNonEmpty(env?.LLM_VISION_MODEL) || "deepseek-v4-flash-vision-exp"
  );
}

function deepseekBases(env) {
  const raw = firstNonEmpty(env?.LLM_BASE_URL) || "https://api.deepseek.com";
  let u = raw.replace(/\/$/, "");
  // Prefer /v1; also try bare host (DeepSeek accepts both).
  const withV1 = /\/v\d+$/i.test(u) ? u : `${u}/v1`;
  const bare = withV1.replace(/\/v\d+$/i, "");
  const urls = [`${withV1}/chat/completions`];
  if (bare && bare !== withV1) urls.push(`${bare}/chat/completions`);
  return [...new Set(urls)];
}

function openaiBase(env) {
  const raw = firstNonEmpty(env?.LLM_BASE_URL) || "https://api.openai.com/v1";
  return raw.replace(/\/$/, "");
}

/** DeepSeek chat + reasoner both may put text in content or reasoning_content. */
export function extractChatText(data) {
  const msg = data?.choices?.[0]?.message || {};
  const content = String(msg.content || "").trim();
  if (content) return content;
  const reasoning = String(msg.reasoning_content || "").trim();
  if (reasoning) return reasoning;
  // Some gateways nest text
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((c) => (typeof c === "string" ? c : c?.text || ""))
      .join("\n")
      .trim();
  }
  return "";
}

function sumUsage(a, b) {
  if (!a && !b) return null;
  return {
    input: (Number(a?.input) || 0) + (Number(b?.input) || 0) || null,
    output: (Number(a?.output) || 0) + (Number(b?.output) || 0) || null,
  };
}

async function openAiCompatibleCall(url, key, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function callLlm(env, messages, mode, opts = {}) {
  const backend = llmBackend(env);
  const key = llmApiKey(env);
  if (!key) {
    return {
      ok: false,
      code: "llm_not_configured",
      text: null,
      error: "llm_not_configured",
    };
  }

  const max_tokens = opts.max_tokens || maxTokensForMode(mode);
  const wantJson = opts.json !== false;
  const useVision = Boolean(opts.vision);

  try {
    if (backend === "anthropic") {
      const model = opts.model || llmModel(env);
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
          text: null,
          error: data?.error?.message || `anthropic_http_${res.status}`,
          status: res.status,
        };
      }
      const text = (data.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      if (!String(text || "").trim()) {
        return {
          ok: false,
          code: "llm_empty",
          text: null,
          error: "empty_model_content",
        };
      }
      return {
        ok: true,
        text,
        usage: {
          input: data.usage?.input_tokens ?? null,
          output: data.usage?.output_tokens ?? null,
        },
        finish_reason: data.stop_reason || null,
        model,
      };
    }

    const model = opts.model || (useVision ? llmVisionModel(env) : llmModel(env));
    const urls =
      backend === "deepseek"
        ? deepseekBases(env)
        : [`${openaiBase(env)}/chat/completions`];

    let lastErr = "llm_error";
    let lastStatus = 502;

    for (const url of urls) {
      const baseBody = {
        model,
        messages,
        temperature: opts.temperature ?? 0.35,
        max_tokens,
      };
      // Vision / multimodal often rejects response_format
      if (wantJson && !useVision) {
        baseBody.response_format = { type: "json_object" };
      }

      let { res, data } = await openAiCompatibleCall(url, key, baseBody);

      if (
        !res.ok &&
        wantJson &&
        !useVision &&
        String(data?.error?.message || "")
          .toLowerCase()
          .includes("response_format")
      ) {
        ({ res, data } = await openAiCompatibleCall(url, key, {
          model,
          messages,
          temperature: opts.temperature ?? 0.35,
          max_tokens,
        }));
      }

      if (!res.ok) {
        lastErr = data?.error?.message || data?.message || `llm_http_${res.status}`;
        lastStatus = res.status;
        // Try next URL (e.g. /v1 vs bare)
        continue;
      }

      const text = extractChatText(data);
      const finish = data?.choices?.[0]?.finish_reason || null;
      if (!text) {
        return {
          ok: false,
          code: "llm_empty",
          text: null,
          error: "empty_model_content",
          finish_reason: finish,
          usage: {
            input: data.usage?.prompt_tokens ?? null,
            output: data.usage?.completion_tokens ?? null,
          },
          url,
          model,
        };
      }
      return {
        ok: true,
        text,
        usage: {
          input: data.usage?.prompt_tokens ?? null,
          output: data.usage?.completion_tokens ?? null,
        },
        finish_reason: finish,
        url,
        model,
      };
    }

    return {
      ok: false,
      code: "llm_error",
      text: null,
      error: lastErr,
      status: lastStatus,
    };
  } catch (e) {
    return {
      ok: false,
      code: "llm_network_error",
      text: null,
      error: e?.message || "llm_network_error",
    };
  }
}

/** Vision parse pass — multimodal user content with image_url data URL. */
export async function callVisionLlm(env, locale, userText, imageDataUrl) {
  const image = sanitizeImageDataUrl(imageDataUrl);
  if (!image) {
    return { ok: false, code: "invalid_image", text: null, error: "invalid_image" };
  }
  const messages = [
    { role: "system", content: visionParseSystemPrompt(locale) },
    {
      role: "user",
      content: visionUserContent(userText || "Parse this financial image.", image),
    },
  ];
  return callLlm(env, messages, "edge_infer", {
    vision: true,
    model: llmVisionModel(env),
    json: false,
    temperature: 0.2,
    max_tokens: 1536,
  });
}

/** Second-pass: force JSON from a prior prose / truncated answer. */
export async function repairJsonLlm(env, mode, priorText, locale) {
  const zh = locale === "zh";
  const messages = [
    {
      role: "system",
      content: zh
        ? "你是 JSON 修复器。只输出一个合法 JSON 对象，不要 markdown。字段需符合苏坡大模型 schema（role/task/reasoning_chain/narrative 等）。"
        : "You are a JSON repairer. Output ONE valid JSON object only, no markdown. Match Supro Model schema (role/task/reasoning_chain/narrative, etc.).",
    },
    {
      role: "user",
      content: `Convert the following model answer into the required JSON schema. Keep meaning.\n\n---\n${String(priorText || "").slice(0, 12000)}`,
    },
  ];
  return callLlm(env, messages, mode, {
    json: true,
    temperature: 0.1,
    max_tokens: 3072,
  });
}

export { sumUsage };
