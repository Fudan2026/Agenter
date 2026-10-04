/**
 * DeepSeek / OpenAI-compatible / Anthropic caller for Pages Functions.
 * Keys stay in env — never ship to the browser.
 */

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
  if (mode === "report") return 3200;
  if (mode === "multifactor" || mode === "e2e" || mode === "allocate") return 2048;
  return 1400;
}

function deepseekBase(env) {
  const raw = firstNonEmpty(env?.LLM_BASE_URL) || "https://api.deepseek.com";
  let u = raw.replace(/\/$/, "");
  // Official DeepSeek accepts both /chat/completions and /v1/chat/completions.
  // Normalize bare host → /v1 so OpenAI-compatible clients behave.
  if (!/\/v\d+$/i.test(u) && !/\/chat\/completions$/i.test(u)) {
    u = `${u}/v1`;
  }
  return u;
}

function openaiBase(env) {
  const raw = firstNonEmpty(env?.LLM_BASE_URL) || "https://api.openai.com/v1";
  return raw.replace(/\/$/, "");
}

export async function callLlm(env, messages, mode) {
  const backend = llmBackend(env);
  const key = llmApiKey(env);
  if (!key) {
    return { ok: false, code: "llm_not_configured", text: null, error: "llm_not_configured" };
  }

  const max_tokens = maxTokensForMode(mode);

  try {
    if (backend === "anthropic") {
      const model = llmModel(env);
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
      return {
        ok: true,
        text,
        usage: {
          input: data.usage?.input_tokens ?? null,
          output: data.usage?.output_tokens ?? null,
        },
      };
    }

    const base = backend === "deepseek" ? deepseekBase(env) : openaiBase(env);
    const model = llmModel(env);
    const url = `${base}/chat/completions`;
    const res = await fetch(url, {
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
      const errMsg = String(data?.error?.message || data?.message || "");
      // Retry without response_format if provider rejects it
      if (errMsg.toLowerCase().includes("response_format")) {
        const res2 = await fetch(url, {
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
            text: null,
            error: data2?.error?.message || `llm_http_${res2.status}`,
            status: res2.status,
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
        text: null,
        error: errMsg || `llm_http_${res.status}`,
        status: res.status,
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
  } catch (e) {
    return {
      ok: false,
      code: "llm_network_error",
      text: null,
      error: e?.message || "llm_network_error",
    };
  }
}
