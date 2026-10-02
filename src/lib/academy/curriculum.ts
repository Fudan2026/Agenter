export const ACADEMY_KEY = "agenter.academy.v1";
export const ACADEMY_FLAGS_KEY = "agenter.academy.flags.v1";

export type AcademyStageId =
  | "research"
  | "screener"
  | "timing"
  | "lab"
  | "paper"
  | "replay"
  | "live";

export const ACADEMY_STAGES: Array<{
  id: AcademyStageId;
  titleZh: string;
  titleEn: string;
  descZh: string;
  descEn: string;
}> = [
  {
    id: "research",
    titleZh: "研究",
    titleEn: "Research",
    descZh: "阅读日报与因子暴露。",
    descEn: "Read daily brief and factor exposures.",
  },
  {
    id: "screener",
    titleZh: "筛选",
    titleEn: "Screener",
    descZh: "用信号与共振分过滤标的。",
    descEn: "Filter symbols with signals and confluence.",
  },
  {
    id: "timing",
    titleZh: "择时",
    titleEn: "Timing",
    descZh: "理解交易日历与市场状态。",
    descEn: "Trading calendar and regime context.",
  },
  {
    id: "lab",
    titleZh: "实验室",
    titleEn: "Lab",
    descZh: "回测策略并查看风险闸门。",
    descEn: "Backtest strategies and risk gates.",
  },
  {
    id: "paper",
    titleZh: "模拟",
    titleEn: "Paper",
    descZh: "纸上交易与成本假设。",
    descEn: "Paper trading with cost assumptions.",
  },
  {
    id: "replay",
    titleZh: "回放",
    titleEn: "Replay",
    descZh: "按日推进，禁止偷看未来。",
    descEn: "Walk forward without lookahead.",
  },
  {
    id: "live",
    titleZh: "实盘准备",
    titleEn: "Live readiness",
    descZh: "清单、成本与闸门全部就绪。",
    descEn: "Checklist, costs, and gates aligned.",
  },
];

const STAGE_FLAG_REQUIREMENTS: Record<AcademyStageId, string[]> = {
  research: ["briefRead"],
  screener: ["screenerUsed"],
  timing: ["regimeViewed"],
  lab: ["backtestRun"],
  paper: ["paperTrade"],
  replay: ["replaySession"],
  live: ["liveChecklist"],
};

function emptyProgress(): Record<AcademyStageId, boolean> {
  return {
    research: false,
    screener: false,
    timing: false,
    lab: false,
    paper: false,
    replay: false,
    live: false,
  };
}

export function loadAcademy(): Record<AcademyStageId, boolean> {
  const base = emptyProgress();
  try {
    const raw = localStorage.getItem(ACADEMY_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<AcademyStageId, boolean>>;
    for (const stage of ACADEMY_STAGES) {
      if (parsed[stage.id]) base[stage.id] = true;
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function markStage(id: AcademyStageId): void {
  const progress = loadAcademy();
  progress[id] = true;
  try {
    localStorage.setItem(ACADEMY_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

function loadFlags(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(ACADEMY_FLAGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function setAcademyFlag(key: string): void {
  try {
    const f = loadFlags();
    f[key] = true;
    localStorage.setItem(ACADEMY_FLAGS_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

export function validateStage(
  id: AcademyStageId,
  flags?: Record<string, boolean>,
): boolean {
  const progress = loadAcademy();
  if (progress[id]) return true;
  const f = flags ?? loadFlags();
  const required = STAGE_FLAG_REQUIREMENTS[id];
  return required.every((key) => f[key] === true);
}

export function readinessScore(opts: {
  costOn: boolean;
  gatesUnderstood: boolean;
  academyDone: number;
  labNotRed: boolean;
  checklistNonEmpty: boolean;
}): number {
  let score = 0;
  if (opts.costOn) score += 20;
  if (opts.gatesUnderstood) score += 20;
  score += Math.min(40, Math.max(0, opts.academyDone) * (40 / 7));
  if (opts.labNotRed) score += 10;
  if (opts.checklistNonEmpty) score += 10;
  return Math.min(100, Math.round(score));
}
