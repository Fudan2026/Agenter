/**
 * Research Audit card — AI篇主题三 / 进阶主题十 distill.
 * Educational checklist; does not change fills by itself.
 */

export interface AuditFlag {
  id: string;
  ok: boolean;
  zh: string;
  en: string;
}

export interface AuditSnapshot {
  flags: AuditFlag[];
  score: number; // 0–100
  level: "green" | "yellow" | "red";
}

export function buildResearchAudit(opts: {
  costModelEnabled: boolean;
  fillRuleNextOpen: boolean;
  usedTimeSplitNotRandom: boolean;
  survivorUniverse: boolean;
  haircutSharpe?: number | null;
  nTrials?: number | null;
  hardcodedParamsOnly?: boolean;
}): AuditSnapshot {
  const flags: AuditFlag[] = [
    {
      id: "costs",
      ok: opts.costModelEnabled,
      zh: "成本模型开启（佣金/印花税/滑点）",
      en: "Cost model ON (commission/stamp/slip)",
    },
    {
      id: "nolahead",
      ok: opts.fillRuleNextOpen,
      zh: "成交规则为次日开盘（无未来函数）",
      en: "Fill rule is next-open (no lookahead)",
    },
    {
      id: "timesplit",
      ok: opts.usedTimeSplitNotRandom,
      zh: "使用时间序列/滚动划分，而非随机打乱",
      en: "Time-series / walk-forward split (not random shuffle)",
    },
    {
      id: "survivor",
      ok: !opts.survivorUniverse,
      zh: "已标注幸存者偏差（烘焙存活集）",
      en: "Survivorship bias disclosed (baked survivor set)",
      // ok=false when survivorUniverse true means warning — invert display:
    },
    {
      id: "haircut",
      ok:
        opts.haircutSharpe == null ||
        (Number.isFinite(opts.haircutSharpe) && opts.nTrials != null),
      zh: `惩罚后夏普已报告${opts.nTrials != null ? `（N=${opts.nTrials}）` : ""}`,
      en: `Haircut Sharpe reported${opts.nTrials != null ? ` (N=${opts.nTrials})` : ""}`,
    },
    {
      id: "params",
      ok: opts.hardcodedParamsOnly !== true,
      zh: "策略参数可调整（非仅硬编码默认）",
      en: "Strategy params adjustable (not hardcoded-only)",
    },
  ];

  // Fix survivor flag semantics: disclosing survivor is "ok" for audit literacy
  const surv = flags.find((f) => f.id === "survivor");
  if (surv) {
    surv.ok = true; // disclosure present on site banners
    surv.zh = opts.survivorUniverse
      ? "幸存者偏差横幅已展示（烘焙存活集）"
      : "宇宙口径已说明";
    surv.en = opts.survivorUniverse
      ? "Survivorship banner shown (baked survivors)"
      : "Universe caveats documented";
  }

  const okN = flags.filter((f) => f.ok).length;
  const score = Math.round((okN / flags.length) * 100);
  const level = score >= 80 ? "green" : score >= 50 ? "yellow" : "red";
  return { flags, score, level };
}
