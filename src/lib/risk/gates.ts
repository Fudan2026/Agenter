/**
 * Four hard risk gates — product mechanisms, not footnotes.
 */

export type GateCode =
  | "multiple_testing"
  | "lookahead"
  | "oos_degradation"
  | "cost_off"
  | "survivorship";

export interface GateResult {
  okForGreen: boolean;
  okForActionable: boolean;
  level: "green" | "yellow" | "red";
  codes: GateCode[];
  messages: { zh: string; en: string }[];
}

const SURVIVORSHIP_MSG = {
  zh: "宇宙=烘焙存活集，非全历史可交易宇宙（幸存者偏差）。",
  en: "Universe = baked survivors, not the full historical tradable set.",
};

export function evaluateBacktestGates(input: {
  costModelEnabled: boolean;
  fillRuleAllNextOpen: boolean;
  usedPurgedWf: boolean;
  rawSharpe: number;
  haircutSharpe: number;
  isReturn: number;
  oosReturn: number;
  oosSharpe: number;
  maxDdPct: number;
}): GateResult {
  const codes: GateCode[] = ["survivorship"];
  const messages = [SURVIVORSHIP_MSG];
  let level: GateResult["level"] = "green";
  let okForGreen = true;
  let okForActionable = true;

  if (!input.costModelEnabled) {
    codes.push("cost_off");
    messages.push({
      zh: "成本模型关闭 — 不可作实操建议",
      en: "Cost model OFF — not actionable",
    });
    okForActionable = false;
    if (level === "green") level = "yellow";
    okForGreen = false;
  }

  if (!input.usedPurgedWf || !input.fillRuleAllNextOpen) {
    codes.push("lookahead");
    messages.push({
      zh: "缺少 purged/embargo 或次日开盘成交 — 可能前视",
      en: "Missing purged/embargo or next-open fills — lookahead risk",
    });
    okForGreen = false;
    if (level === "green") level = "yellow";
  }

  const degrade =
    input.isReturn > 0 && input.oosReturn < 0.5 * input.isReturn;
  if (input.oosSharpe < 0 || degrade) {
    codes.push("oos_degradation");
    messages.push({
      zh: "样本外相对样本内退化过大",
      en: "IS→OOS degradation exceeds threshold",
    });
    level = "red";
    okForGreen = false;
    okForActionable = false;
  }

  if (input.haircutSharpe < 0.5) {
    codes.push("multiple_testing");
    messages.push({
      zh: "惩罚后夏普不足（多重检验）",
      en: "Haircut Sharpe too low (multiple testing)",
    });
    okForGreen = false;
    if (level === "green") level = "yellow";
  }

  if (input.maxDdPct >= 40) {
    level = "red";
    okForGreen = false;
  }

  if (!okForGreen && level === "green") level = "yellow";
  return { okForGreen, okForActionable, level, codes, messages };
}
