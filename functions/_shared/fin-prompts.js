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
]);

export const JSON_SCHEMA_HINT = `
Return ONE JSON object only (no markdown fences) with fields:
{
  "role": "supro_quant_researcher",
  "task": "factor_screen|portfolio|signal|transformer|report|allocate|review",
  "universe_note": "string",
  "factors": [{"id":"string","tilt":"string","keep":true,"reject_reason":null,"rationale":"string"}],
  "eliminations": [{"factor_id":"string","reason":"string"}],
  "portfolio": [{"symbol":"string","weight":0.0,"reason":"string"}],
  "signals": [{"symbol":"string","side":"buy|sell|hold","horizon":"next_open","confidence":0.0,"rationale":"string"}],
  "reasoning_chain": ["step1","step2"],
  "attention_view": {"heads_note":"string","features":["close","volume"],"limitations":["string"]},
  "allocation": {"weights":[{"symbol":"string","weight":0.0}],"caps_note":"string","rebalance":"string"},
  "report": {"title":"string","summary":"string","sections":[{"heading":"string","body":"string"}],"rating":"string","quality_score":0.0,"sources":["string"]},
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
      ? "任务=多因子选股（LLMFactor 风格）：因子筛选→淘汰推理→组合权重→次日开盘信号。JSON 必填 factors/eliminations/portfolio/signals/reasoning_chain。"
      : "Task=multi-factor (LLMFactor-style): screen→elimination rationale→portfolio→next-open signals. JSON must include factors/eliminations/portfolio/signals/reasoning_chain.",
    e2e: zh
      ? "任务=端到端：信号→次日开盘→成本→纸盘/Lab；输出可执行草稿与信号 JSON。"
      : "Task=e2e: signal→next-open→costs→Paper/Lab; actionable draft + signals JSON.",
    transformer: zh
      ? "任务=Transformer 量价建模识字（StockFormer/FinCast 蒸馏）：解释多头注意力在 OHLCV 上的时序/截面角色；填 attention_view；说明本站无权重推理、衰减与成本；可给教育性信号。"
      : "Task=Transformer PV literacy (StockFormer/FinCast distill): multi-head attention over OHLCV (temporal vs cross-sectional); fill attention_view; disclose no weight inference, decay, costs; educational signals ok.",
    report: zh
      ? "任务=金融投研报告：数据→因子发现→策略/回测素养→成稿→quality_score(0-1)。填 report.title/summary/sections/rating/sources；reasoning_chain 写研究步骤。"
      : "Task=research report: data→factor findings→strategy/backtest literacy→draft→quality_score(0-1). Fill report.*; reasoning_chain = research steps.",
    allocate: zh
      ? "任务=AI 动态资产配置：在仓位上限下给出 weights、再平衡说明、次日开盘约束；引用多因子组合逻辑；填 allocation + portfolio + reasoning_chain。"
      : "Task=dynamic allocation: capped weights, rebalance notes, next-open constraint; cite multi-factor logic; fill allocation + portfolio + reasoning_chain.",
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

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
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
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}
