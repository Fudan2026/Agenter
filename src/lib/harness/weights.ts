import {
  DIMENSION_IDS,
  type DimensionId,
} from "../agents/types";

export const HARNESS_KEY = "agenter.harness.weights.v1";
export const COMPARE_PICK_KEY = "agenter.compare.picks.v1";
export const LEARN_DONE_KEY = "agenter.learn.completed.v1";
export const LEARN_SCENARIO_KEY = "agenter.learn.scenarios.v1";

/** Default weights prioritize coding-agent dimensions; quant dims low until Quant preset. */
export const DEFAULT_WEIGHTS: Record<DimensionId, number> = {
  codingAbility: 1.4,
  toolUse: 1.3,
  contextMemory: 1.1,
  privacyControl: 1.0,
  costEfficiency: 1.0,
  cnAccessibility: 0.9,
  learningCurve: 0.8,
  researchOrchestration: 0.35,
  factorAlphaTooling: 0.35,
  memoryReflection: 0.3,
  riskControls: 0.4,
  backtestRigor: 0.4,
};

export const HARNESS_PRESETS: Record<
  string,
  Record<DimensionId, number>
> = {
  coding: {
    codingAbility: 1.6,
    toolUse: 1.5,
    contextMemory: 1.2,
    privacyControl: 0.9,
    costEfficiency: 1.0,
    cnAccessibility: 0.7,
    learningCurve: 0.8,
    researchOrchestration: 0.2,
    factorAlphaTooling: 0.2,
    memoryReflection: 0.2,
    riskControls: 0.3,
    backtestRigor: 0.3,
  },
  cn: {
    codingAbility: 1.1,
    toolUse: 1.1,
    contextMemory: 1.0,
    privacyControl: 1.0,
    costEfficiency: 1.1,
    cnAccessibility: 1.8,
    learningCurve: 1.0,
    researchOrchestration: 0.4,
    factorAlphaTooling: 0.4,
    memoryReflection: 0.3,
    riskControls: 0.5,
    backtestRigor: 0.4,
  },
  privacy: {
    codingAbility: 1.0,
    toolUse: 1.1,
    contextMemory: 1.0,
    privacyControl: 1.8,
    costEfficiency: 1.2,
    cnAccessibility: 0.8,
    learningCurve: 0.9,
    researchOrchestration: 0.3,
    factorAlphaTooling: 0.3,
    memoryReflection: 0.4,
    riskControls: 0.6,
    backtestRigor: 0.5,
  },
  research: {
    codingAbility: 0.7,
    toolUse: 1.3,
    contextMemory: 1.5,
    privacyControl: 1.0,
    costEfficiency: 1.1,
    cnAccessibility: 0.8,
    learningCurve: 1.2,
    researchOrchestration: 0.8,
    factorAlphaTooling: 0.7,
    memoryReflection: 0.9,
    riskControls: 0.6,
    backtestRigor: 0.7,
  },
  /** Camp-aligned Quant / AI-finance preset. */
  quant: {
    codingAbility: 0.5,
    toolUse: 1.0,
    contextMemory: 1.1,
    privacyControl: 0.9,
    costEfficiency: 1.0,
    cnAccessibility: 1.1,
    learningCurve: 1.0,
    researchOrchestration: 1.6,
    factorAlphaTooling: 1.5,
    memoryReflection: 1.3,
    riskControls: 1.5,
    backtestRigor: 1.6,
  },
};

export function loadWeights(): Record<DimensionId, number> {
  try {
    const raw = localStorage.getItem(HARNESS_KEY);
    if (!raw) return { ...DEFAULT_WEIGHTS };
    const parsed = JSON.parse(raw) as Partial<Record<DimensionId, number>>;
    const out = { ...DEFAULT_WEIGHTS };
    for (const id of DIMENSION_IDS) {
      const v = parsed[id];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[id] = v;
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export function saveWeights(weights: Record<DimensionId, number>): void {
  try {
    localStorage.setItem(HARNESS_KEY, JSON.stringify(weights));
  } catch {
    /* ignore */
  }
}

/** Skip missing scores so coding agents without quant dims are not zeroed. */
export function weightedScore(
  scores: Partial<Record<DimensionId, number>>,
  weights: Record<DimensionId, number>,
): number {
  let num = 0;
  let den = 0;
  for (const id of DIMENSION_IDS) {
    const s = scores[id];
    const w = weights[id] ?? 0;
    if (s == null || !Number.isFinite(s) || !(w > 0)) continue;
    num += s * w;
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

export function loadPicks(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_PICK_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string").slice(0, 4);
  } catch {
    return [];
  }
}

export function savePicks(ids: string[]): void {
  try {
    localStorage.setItem(COMPARE_PICK_KEY, JSON.stringify(ids.slice(0, 4)));
  } catch {
    /* ignore */
  }
}

export function isLearnDone(): boolean {
  try {
    return localStorage.getItem(LEARN_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLearnDone(done: boolean): void {
  try {
    localStorage.setItem(LEARN_DONE_KEY, done ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadScenarioProgress(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LEARN_SCENARIO_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setScenarioDone(id: string, done: boolean): void {
  try {
    const cur = loadScenarioProgress();
    cur[id] = done;
    localStorage.setItem(LEARN_SCENARIO_KEY, JSON.stringify(cur));
  } catch {
    /* ignore */
  }
}

export function encodeCompareShare(
  ids: string[],
  weights: Record<DimensionId, number>,
): string {
  const w = DIMENSION_IDS.map((id) => weights[id]).join(",");
  return `#/compare?ids=${encodeURIComponent(ids.join(","))}&w=${encodeURIComponent(w)}`;
}

export function parseCompareShare(hash: string): {
  ids: string[];
  weights: Record<DimensionId, number> | null;
} {
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  const wRaw = params.get("w");
  if (!wRaw) return { ids, weights: null };
  const parts = wRaw.split(",").map(Number);
  // Accept legacy 7-dim share links by padding quant dims with defaults
  if (parts.some((n) => !Number.isFinite(n))) {
    return { ids, weights: null };
  }
  if (parts.length !== DIMENSION_IDS.length && parts.length !== 7) {
    return { ids, weights: null };
  }
  const weights = { ...DEFAULT_WEIGHTS };
  const n = Math.min(parts.length, DIMENSION_IDS.length);
  for (let i = 0; i < n; i++) {
    weights[DIMENSION_IDS[i]] = Math.max(0, parts[i]);
  }
  return { ids, weights };
}
