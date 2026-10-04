/**
 * Supro Model prompt framework — distilled from LLMFactor SKGP,
 * StockFormer / FinCast literacy, TickerAnalysis report sections,
 * and TribhanginD/market stage JSON (educational AIaaS, no weight training).
 */

export const MODES = new Set([
  "pick",
  "factor",
  "strategy",
  "review",
  "multifactor",
  "e2e",
  "transformer",
  "report",
  "allocate",
  "edge_infer",
  "agent",
]);

export const JSON_SCHEMA_HINT = `
Return ONE JSON object only (no markdown fences) with fields:
{
  "role": "supro_quant_researcher",
  "task": "factor_screen|portfolio|signal|transformer|report|allocate|review|edge_infer|agent",
  "universe_note": "string",
  "factors": [{"id":"string","tilt":"string","keep":true,"reject_reason":null,"rationale":"string"}],
  "eliminations": [{"factor_id":"string","reason":"string"}],
  "portfolio": [{"symbol":"string","weight":0.0,"reason":"string"}],
  "signals": [{"symbol":"string","side":"buy|sell|hold","horizon":"next_open","confidence":0.0,"rationale":"string"}],
  "reasoning_chain": ["step1","step2"],
  "reasoning_steps": [{"step":1,"thought":"string","action":"string","observation":"string"}],
  "attention_view": {"heads_note":"string","features":["close","volume"],"limitations":["string"]},
  "attention_heatmap_data": {"patch_count":0,"weights":[],"features":["string"]},
  "prediction_confidence": 0.0,
  "prediction_band": {"lo":0,"mid":0,"hi":0},
  "allocation": {"weights":[{"symbol":"string","weight":0.0}],"caps_note":"string","rebalance":"string"},
  "report": {"title":"string","summary":"string","sections":[{"heading":"string","body":"string"}],"rating":"string","quality_score":0.0,"sources":["string"]},
  "vision_parse": {"ticker_guess":null,"chart_type":"other","summary":"string"},
  "risks": ["string"],
  "deep_links": ["#/quant?panel=factors","#/quant?panel=lab"],
  "disclaimer": "education_only",
  "narrative": "short human-readable summary for UI"
}
Unused sections may be empty arrays/objects. Always fill reasoning_chain with elimination logic.
Emphasize next-open fills, no lookahead, proxy-universe limits. Not investment advice.
`;

export function systemPrompt(mode, locale) {
  const zh = locale === "zh";
  const base = zh
    ? "你是苏坡大模型（Supro / Super Professional AIaaS）。教育演示，不构成投资建议。不是 Fin-R1 权重，不下真单。语气乐观平和（苏东坡精神）。必须输出结构化 JSON（见 schema）。强调次日开盘成交与无未来函数。"
    : "You are Supro Model (Super Professional AIaaS). Educational only — not investment advice. Not Fin-R1 weights; no live orders. Calm professional tone. MUST output structured JSON per schema. Emphasize next-open fills and no-lookahead.";

  const byMode = {
    pick: zh
      ? "任务=智能选股：从烘焙精选屏提出筛选逻辑；列出保留/淘汰因子与理由。"
      : "Task=smart screen: propose screening from baked screens; keep/reject factors with reasons.",
    factor: zh
      ? "任务=智能因子：IC/IR 解读与因子倾斜；淘汰链必须可归因。"
      : "Task=smart factors: IC/IR literacy and tilts; eliminations must be attributable.",
    strategy: zh
      ? "任务=策略草稿：建议 Lab id（ma_cross/rsi_reversion/confluence/ml_lite）与参数；给深链。"
      : "Task=strategy draft: Lab id + params; deep-links.",
    review: zh
      ? "任务=复盘问答：结合语料要点；标明不确定；reasoning_chain 写清依据。"
      : "Task=review Q&A: corpus-grounded; mark uncertainty; fill reasoning_chain.",
    multifactor: zh
      ? "任务=多因子选股（蒸馏 LLMFactor SKGP + Qlib Alpha40-lite）：①先写背景知识（市场/行业假设）；②从 Context 的 AlphaLiteTop 引用具体因子 id（如 ROC20/RSV20/STD20）做保留/淘汰；③给出可归因权重与组合；④次日开盘信号。JSON 必填 factors/eliminations/portfolio/signals/reasoning_chain；reasoning_chain 至少 4 步对应 SKGP 顺序。"
      : "Task=multi-factor (LLMFactor SKGP + Qlib Alpha40-lite distill): (1) background knowledge; (2) keep/kill concrete factor ids from AlphaLiteTop in Context (ROC20/RSV20/STD20…); (3) attributable weights + portfolio; (4) next-open signals. JSON must include factors/eliminations/portfolio/signals/reasoning_chain; reasoning_chain ≥4 SKGP steps.",
    e2e: zh
      ? "任务=端到端策略引擎（4x 金币档）：①引用 Context（AlphaLiteTop/Screens/IC/公告）形成信号；②给出 lab_id（仅允许 ma_cross|rsi_reversion|confluence|ml_lite）与 params；③强调次日开盘与成本/闸门；④deep_links 必须含 #/quant?panel=lab&lab=… 与纸盘链接；⑤signals + reasoning_chain ≥5 步。禁止声称已代下单。"
      : "Task=e2e strategy engine (4x gold tier): (1) cite Context (AlphaLiteTop/Screens/IC/filings) for signals; (2) lab_id in {ma_cross,rsi_reversion,confluence,ml_lite} + params; (3) next-open + costs/gates; (4) deep_links MUST include #/quant?panel=lab&lab=… and paper; (5) signals + reasoning_chain ≥5 steps. Never claim live order submission.",
    transformer: zh
      ? "任务=Transformer 量价建模识字（蒸馏 Multitask-Stockformer / StockFormer）：必须填 attention_view，含 heads_note（慢频趋势 vs 快频冲击）、features、limitations；引用 Context 的 TransformerPv 代理分数；说明本站无真实权重/无 DWT；可给教育性次日开盘信号。"
      : "Task=Transformer PV literacy (Multitask-Stockformer / StockFormer distill): MUST fill attention_view with heads_note (slow trend vs fast shock), features, limitations; cite TransformerPv proxy scores from Context; disclose no live weights / no real DWT; educational next-open signals ok.",
    report: zh
      ? "任务=自动化投研报告（3x 金币档）：结合 Context 的公告/问财资讯/因子/AlphaLite；强制填 report.title/summary/sections(≥3)/rating/quality_score/sources；reasoning_chain ≥5；可多轮追问同一标的细化章节。教育演示非投顾。"
      : "Task=automated research report (3x gold tier): use Context filings/iwencai/factors/AlphaLite; MUST fill report.title/summary/sections(≥3)/rating/quality_score/sources; reasoning_chain ≥5; multi-turn may refine the same name. Educational — not advice.",
    allocate: zh
      ? "任务=AI 动态资产配置：在仓位上限下给出 weights、再平衡说明、次日开盘约束；引用多因子组合逻辑；填 allocation + portfolio + reasoning_chain。"
      : "Task=dynamic allocation: capped weights, rebalance notes, next-open constraint; cite multi-factor logic; fill allocation + portfolio + reasoning_chain.",
    edge_infer: zh
      ? "任务=边缘 Transformer 推理 + 多模态（5x 金币档）：①引用 Context 的 EdgeInfer / TransformerInfer 行（prediction_band、attention_heatmap、prediction_confidence）；②若有 VisionParse，整合截图结构化事实；③必须填 attention_heatmap_data、prediction_confidence、prediction_band、attention_view、signals、reasoning_chain≥5；④标明 distill_patch（非 Workers ONNX）；教育演示非投顾。"
      : "Task=edge Transformer inference + multimodal (5x gold): (1) cite EdgeInfer / TransformerInfer rows (prediction_band, attention_heatmap, prediction_confidence); (2) if VisionParse present, merge screenshot facts; (3) MUST fill attention_heatmap_data, prediction_confidence, prediction_band, attention_view, signals, reasoning_chain≥5; (4) disclose distill_patch (no Worker ONNX). Educational — not advice.",
    agent: zh
      ? "任务=Fin-Research Agent 综合（6x）：结合工具观察写投研报告；填 report + reasoning_steps + reasoning_chain；教育演示。"
      : "Task=Fin-Research Agent synthesis (6x): use tool observations; fill report + reasoning_steps + reasoning_chain. Educational.",
  };

  return `${base}\n${byMode[mode] || ""}\n${JSON_SCHEMA_HINT}`;
}

export function offlineStructured(mode, prompt, locale) {
  const zh = locale === "zh";
  const narrative = zh
    ? `【离线草稿】针对「${prompt.slice(0, 80)}」：请打开 Factor Studio / IC / Lab。配置 DeepSeek 后启用完整苏坡大模型。`
    : `[Offline] For “${prompt.slice(0, 80)}”: open Factor Studio / IC / Lab. Configure DeepSeek for full Supro Model.`;
  return {
    role: "supro_quant_researcher",
    task: mode,
    universe_note: zh ? "代理观察池（烘焙）" : "Baked proxy watchlist",
    factors: [],
    eliminations: [],
    portfolio: [],
    signals: [],
    reasoning_chain: [
      zh ? "离线模式：未调用 DeepSeek" : "Offline: DeepSeek not called",
      zh ? "建议先查看烘焙看板" : "Inspect baked boards first",
    ],
    attention_view: {
      heads_note: zh
        ? "教育性说明：多头注意力分别关注价/量模式（无真实权重）"
        : "Literacy: heads attend to price/volume patterns (no live weights)",
      features: ["close", "volume", "return"],
      limitations: [
        zh ? "本站不加载 FinCast/StockFormer 权重" : "No FinCast/StockFormer weights on-site",
      ],
    },
    allocation: { weights: [], caps_note: "", rebalance: "" },
    report: {
      title: zh ? "离线报告草稿" : "Offline report stub",
      summary: narrative,
      sections: [],
      rating: "n/a",
      quality_score: 0,
      sources: ["fin-corpus", "factors-ic"],
    },
    risks: [zh ? "教育演示，非投资建议" : "Educational only — not advice"],
    deep_links: ["#/quant?panel=studio", "#/quant?panel=lab"],
    disclaimer: "education_only",
    narrative,
  };
}

/**
 * Live DeepSeek fallback when the model returns prose / truncated JSON.
 * MUST NOT reuse offlineStructured — that falsely claims DeepSeek was not called.
 */
export function liveStructuredFromText(mode, prompt, locale, text) {
  const zh = locale === "zh";
  const body = String(text || "").trim();
  const narrative =
    body ||
    (zh
      ? "（DeepSeek 已调用，但返回空正文）"
      : "(DeepSeek called, but empty body)");
  return {
    role: "supro_quant_researcher",
    task: mode,
    universe_note: zh ? "代理观察池（烘焙）" : "Baked proxy watchlist",
    factors: [],
    eliminations: [],
    portfolio: [],
    signals: [],
    reasoning_chain: [
      zh ? "苏坡大模型已调用 DeepSeek（在线）" : "Supro Model called DeepSeek (live)",
      zh
        ? "模型未返回可解析 JSON，已保留原文叙事（非离线）"
        : "Model returned non-JSON; narrative preserved (not offline)",
      zh
        ? `用户问题摘要：${String(prompt || "").slice(0, 80)}`
        : `Prompt summary: ${String(prompt || "").slice(0, 80)}`,
    ],
    attention_view: {
      heads_note: zh
        ? "教育性说明：多头注意力分别关注价/量模式（无真实权重）"
        : "Literacy: heads attend to price/volume patterns (no live weights)",
      features: ["close", "volume", "return"],
      limitations: [
        zh ? "本站不加载 FinCast/StockFormer 权重" : "No FinCast/StockFormer weights on-site",
      ],
    },
    allocation: { weights: [], caps_note: "", rebalance: "" },
    report: {
      title: zh ? "苏坡大模型在线回答" : "Supro Model live answer",
      summary: narrative.slice(0, 600),
      sections: body
        ? [{ heading: zh ? "模型原文" : "Model text", body: narrative.slice(0, 8000) }]
        : [],
      rating: "n/a",
      quality_score: 0,
      sources: ["deepseek", "fin-corpus"],
    },
    risks: [zh ? "教育演示，非投资建议" : "Educational only — not advice"],
    deep_links: ["#/quant?panel=studio", "#/quant?panel=lab"],
    disclaimer: "education_only",
    narrative,
    live: true,
  };
}

export function extractJsonObject(text) {
  let raw = String(text || "").trim();
  if (!raw) return null;
  // Strip BOM / leading junk before first brace
  const brace = raw.indexOf("{");
  if (brace > 0) raw = raw.slice(brace);
  try {
    return JSON.parse(raw);
  } catch {
    /* try fence or substring */
  }
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = raw.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // Truncated JSON: try closing open braces/brackets (best-effort)
      try {
        let repaired = slice;
        const opens = (repaired.match(/\{/g) || []).length;
        const closes = (repaired.match(/\}/g) || []).length;
        const openArr = (repaired.match(/\[/g) || []).length;
        const closeArr = (repaired.match(/\]/g) || []).length;
        // Trim trailing incomplete string
        repaired = repaired.replace(/,\s*"[^"]*$/, "");
        repaired = repaired.replace(/,\s*$/, "");
        for (let i = 0; i < openArr - closeArr; i++) repaired += "]";
        for (let i = 0; i < opens - closes; i++) repaired += "}";
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  }
  return null;
}
