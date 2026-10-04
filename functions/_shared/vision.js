/**
 * DeepSeek vision helpers — OpenAI-compatible multimodal chat parts.
 * No local vision encoder weights.
 */

const MAX_IMAGE_CHARS = 5_500_000; // ~4 MiB base64 budget after client compress

export function llmVisionModel(env) {
  const v = String(env?.LLM_VISION_MODEL || "").trim();
  return v || "deepseek-v4-flash-vision-exp";
}

export function isDataImageUrl(url) {
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(String(url || ""));
}

export function sanitizeImageDataUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (!isDataImageUrl(s)) return null;
  if (s.length > MAX_IMAGE_CHARS) return null;
  return s;
}

/** Build OpenAI-style multimodal user content parts. */
export function visionUserContent(text, imageDataUrl) {
  const parts = [{ type: "text", text: String(text || "") }];
  if (imageDataUrl) {
    parts.push({
      type: "image_url",
      image_url: { url: imageDataUrl },
    });
  }
  return parts;
}

export function visionParseSystemPrompt(locale) {
  const zh = locale === "zh";
  return zh
    ? `你是苏坡多模态解析器。用户上传了财报截图或 K 线截图。只输出一个 JSON 对象：
{"ticker_guess":"string|null","chart_type":"kline|report|table|other","levels":[{"label":"string","value":0}],"text_facts":["string"],"risks":["string"],"summary":"string"}
教育演示，非投资建议。不要 markdown。`
    : `You are Supro multimodal parser. User uploaded a financial report or K-line screenshot. Output ONE JSON object only:
{"ticker_guess":"string|null","chart_type":"kline|report|table|other","levels":[{"label":"string","value":0}],"text_facts":["string"],"risks":["string"],"summary":"string"}
Educational only. No markdown.`;
}
