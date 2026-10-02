import {
  DIMENSION_IDS,
  type DimensionId,
} from "../agents/types";

export const HARNESS_KEY = "agenter.harness.weights.v1";
export const COMPARE_PICK_KEY = "agenter.compare.picks.v1";
export const LEARN_DONE_KEY = "agenter.learn.completed.v1";

/** Default weights prioritize coding-agent dimensions (plan default #6). */
export const DEFAULT_WEIGHTS: Record<DimensionId, number> = {
  codingAbility: 1.4,
  toolUse: 1.3,
  contextMemory: 1.1,
  privacyControl: 1.0,
  costEfficiency: 1.0,
  cnAccessibility: 0.9,
  learningCurve: 0.8,
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

export function weightedScore(
  scores: Record<DimensionId, number>,
  weights: Record<DimensionId, number>,
): number {
  let num = 0;
  let den = 0;
  for (const id of DIMENSION_IDS) {
    const w = weights[id] ?? 0;
    num += (scores[id] ?? 0) * w;
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
