/**
 * Educational VWAP / TWAP schedule + √-participation impact (sim only).
 * Distill of SkillHub「执行模型」— never submits orders.
 */

export type ExecAlgo = "twap" | "vwap";

export interface ExecSlice {
  /** 0-based slice index */
  i: number;
  /** Share of parent order (sums ≈ 1) */
  weight: number;
  /** Cumulative fraction filled after this slice */
  cumFrac: number;
  label: string;
}

export interface ImpactEstimate {
  participation: number;
  /** Approximate impact in bps (√ model) */
  impactBps: number;
  note: string;
}

/** Equal TWAP weights over n slices. */
export function twapSchedule(n: number): ExecSlice[] {
  const slices = Math.max(1, Math.floor(n));
  const w = 1 / slices;
  const out: ExecSlice[] = [];
  let cum = 0;
  for (let i = 0; i < slices; i++) {
    cum += w;
    out.push({
      i,
      weight: w,
      cumFrac: Math.min(1, cum),
      label: `T${i + 1}/${slices}`,
    });
  }
  return out;
}

/**
 * Educational VWAP weights: U-shaped intraday volume profile (open/close heavier).
 * Pure heuristic — not a live volume curve.
 */
export function vwapSchedule(n: number): ExecSlice[] {
  const slices = Math.max(1, Math.floor(n));
  const raw: number[] = [];
  for (let i = 0; i < slices; i++) {
    const t = slices === 1 ? 0.5 : i / (slices - 1);
    // U-shape: higher at ends
    const u = 1.2 - Math.sin(Math.PI * t);
    raw.push(Math.max(0.15, u));
  }
  const sum = raw.reduce((s, x) => s + x, 0);
  const out: ExecSlice[] = [];
  let cum = 0;
  for (let i = 0; i < slices; i++) {
    const w = raw[i] / sum;
    cum += w;
    out.push({
      i,
      weight: w,
      cumFrac: Math.min(1, cum),
      label: `V${i + 1}/${slices}`,
    });
  }
  return out;
}

export function buildSchedule(algo: ExecAlgo, n: number): ExecSlice[] {
  return algo === "twap" ? twapSchedule(n) : vwapSchedule(n);
}

/**
 * √-participation impact: impactBps ≈ k * sqrt(participation) * 10000 scale in bps.
 * Default k≈0.1 → 10% participation ≈ 31.6 bps educational.
 */
export function sqrtImpactBps(
  orderQty: number,
  advShares: number,
  k = 0.1,
): ImpactEstimate {
  const adv = Math.max(1, advShares);
  const participation = Math.max(0, orderQty) / adv;
  const impactBps = k * Math.sqrt(participation) * 10_000;
  return {
    participation,
    impactBps,
    note:
      "Educational √-impact only — not a venue model; Paper/Sim never route live.",
  };
}
