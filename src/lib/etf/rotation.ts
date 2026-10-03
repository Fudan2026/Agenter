/**
 * ETF momentum/pattern rotation — daily vs fixed_5d schedules.
 * Distill of FREQ=5 research cadence; bake-universe only.
 */

export type RebalanceMode = "daily" | "fixed_5d";

export interface RotationEtfInput {
  symbol: string;
  nameZh: string;
  nameEn: string;
  /** Oldest-first closes (daily). */
  closes: number[];
  /** Optional timing score [-100,100]; when overlay on, hold only if >= threshold. */
  timingScore?: number | null;
  /** Pattern-momentum bump from recent bull - bear. */
  patternMomentum?: number;
}

export interface RotationModeResult {
  mode: RebalanceMode;
  timingOverlay: boolean;
  equity: number[];
  dates?: string[];
  totalReturn: number;
  maxDrawdown: number;
  turns: number;
  lastWeights: Record<string, number>;
}

export interface RotationCompare {
  daily: RotationModeResult;
  fixed_5d: RotationModeResult;
  dailyTimed: RotationModeResult;
  fixed_5dTimed: RotationModeResult;
}

function momentumScore(closes: number[], lookback = 20): number {
  if (closes.length < lookback + 1) return 0;
  const a = closes[closes.length - 1 - lookback];
  const b = closes[closes.length - 1];
  if (!(a > 0)) return 0;
  return (b - a) / a;
}

function strength(row: RotationEtfInput): number {
  const mom = momentumScore(row.closes);
  const bump = (row.patternMomentum ?? 0) * 0.02;
  return mom + bump;
}

function maxDrawdown(equity: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

function shouldRebalance(mode: RebalanceMode, dayIndex: number): boolean {
  if (mode === "daily") return true;
  return dayIndex % 5 === 0;
}

/**
 * Equal-weight top-K long-only rotation on aligned close matrix.
 * Uses last `horizon` overlapping sessions across ETFs.
 */
export function runRotation(
  etfs: RotationEtfInput[],
  opts: {
    mode: RebalanceMode;
    timingOverlay?: boolean;
    timingThreshold?: number;
    topK?: number;
    horizon?: number;
  },
): RotationModeResult {
  const mode = opts.mode;
  const timingOverlay = opts.timingOverlay === true;
  const threshold = opts.timingThreshold ?? 0;
  const topK = opts.topK ?? 3;
  const horizon = Math.min(
    opts.horizon ?? 120,
    ...etfs.map((e) => e.closes.length),
  );
  if (etfs.length === 0 || horizon < 2) {
    return {
      mode,
      timingOverlay,
      equity: [1],
      totalReturn: 0,
      maxDrawdown: 0,
      turns: 0,
      lastWeights: {},
    };
  }

  const series = etfs.map((e) => e.closes.slice(-horizon));
  const equity: number[] = [1];
  let nav = 1;
  let turns = 0;
  let weights = new Array(etfs.length).fill(0);
  let lastWeights: Record<string, number> = {};

  for (let t = 1; t < horizon; t++) {
    if (shouldRebalance(mode, t)) {
      const scored = etfs
        .map((e, i) => {
          const slice = series[i].slice(0, t + 1);
          let s = strength({ ...e, closes: slice });
          if (timingOverlay) {
            const ts = e.timingScore ?? 0;
            if (ts < threshold) s = -Infinity;
          }
          return { i, s };
        })
        .filter((x) => Number.isFinite(x.s))
        .sort((a, b) => b.s - a.s)
        .slice(0, topK);
      const next = new Array(etfs.length).fill(0);
      if (scored.length) {
        const w = 1 / scored.length;
        for (const x of scored) next[x.i] = w;
      }
      const changed = next.some((w, i) => Math.abs(w - weights[i]) > 1e-9);
      if (changed) turns++;
      weights = next;
      lastWeights = {};
      weights.forEach((w, i) => {
        if (w > 0) lastWeights[etfs[i].symbol] = w;
      });
    }

    let dayRet = 0;
    for (let i = 0; i < etfs.length; i++) {
      if (!weights[i]) continue;
      const prev = series[i][t - 1];
      const cur = series[i][t];
      if (prev > 0) dayRet += weights[i] * ((cur - prev) / prev);
    }
    nav *= 1 + dayRet;
    equity.push(nav);
  }

  return {
    mode,
    timingOverlay,
    equity,
    totalReturn: nav - 1,
    maxDrawdown: maxDrawdown(equity),
    turns,
    lastWeights,
  };
}

export function compareRotationModes(
  etfs: RotationEtfInput[],
  opts?: { topK?: number; horizon?: number; timingThreshold?: number },
): RotationCompare {
  const base = {
    topK: opts?.topK ?? 3,
    horizon: opts?.horizon ?? 120,
    timingThreshold: opts?.timingThreshold ?? 0,
  };
  return {
    daily: runRotation(etfs, { ...base, mode: "daily", timingOverlay: false }),
    fixed_5d: runRotation(etfs, {
      ...base,
      mode: "fixed_5d",
      timingOverlay: false,
    }),
    dailyTimed: runRotation(etfs, {
      ...base,
      mode: "daily",
      timingOverlay: true,
    }),
    fixed_5dTimed: runRotation(etfs, {
      ...base,
      mode: "fixed_5d",
      timingOverlay: true,
    }),
  };
}
