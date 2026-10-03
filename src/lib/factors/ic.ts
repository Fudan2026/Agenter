/**
 * Factor IC / IR / quantile monotonicity from OHLC proxies.
 * Distill of「因子研究框架」— educational, no live fundamentals.
 */

import type { BakeRow } from "./cross-section";

export interface FactorIcRow {
  factor: "momentum" | "lowVol";
  icMean: number | null;
  icStd: number | null;
  ir: number | null;
  quantileReturns: number[]; // Q1 (low) … Qn (high) mean forward return
  nPeriods: number;
}

export interface FactorIcHorizonSlice {
  horizonBars: number;
  rows: FactorIcRow[];
}

export interface FactorsIcPayload {
  generatedAt: string;
  reportDate: string;
  source: string;
  attribution: { zh: string; en: string };
  horizonBars: number;
  rows: FactorIcRow[];
  /** Multi-horizon IC strip (5/10/21) when baked. */
  horizons?: FactorIcHorizonSlice[];
  corrHeatmap?: Array<{ a: string; b: string; corr: number | null }>;
}

function momentumRaw(closes: number[], asOf: number): number | null {
  if (asOf < 40) return null;
  const skip = Math.min(21, Math.floor(asOf / 10));
  const lookback = Math.min(252, asOf);
  const end = asOf - skip;
  const start = Math.max(0, asOf - lookback);
  if (end <= start) return null;
  const a = closes[start];
  const b = closes[end];
  if (!(a > 0)) return null;
  return b / a - 1;
}

function lowVolRaw(closes: number[], asOf: number, win = 60): number | null {
  if (asOf < win + 1) return null;
  const rets: number[] = [];
  for (let i = asOf - win + 1; i <= asOf; i++) {
    const p = closes[i - 1];
    if (p > 0) rets.push(closes[i] / p - 1);
  }
  if (rets.length < 10) return null;
  const m = rets.reduce((s, r) => s + r, 0) / rets.length;
  const v = rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1);
  // lower vol → higher score for ranking (negate later as "lowVol")
  return -Math.sqrt(v);
}

function fwdReturn(closes: number[], asOf: number, horizon: number): number | null {
  const j = asOf + horizon;
  if (j >= closes.length) return null;
  const a = closes[asOf];
  const b = closes[j];
  if (!(a > 0)) return null;
  return b / a - 1;
}

function rankPearson(
  xs: number[],
  ys: number[],
): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null;
  // Spearman via rank transform
  const rank = (arr: number[]) => {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = Array(arr.length).fill(0);
    idx.forEach((item, rank0) => {
      r[item.i] = rank0 + 1;
    });
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  const n = xs.length;
  for (let i = 0; i < n; i++) {
    sx += rx[i];
    sy += ry[i];
    sxx += rx[i] * rx[i];
    syy += ry[i] * ry[i];
    sxy += rx[i] * ry[i];
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (!(vx > 1e-12) || !(vy > 1e-12)) return null;
  return cov / Math.sqrt(vx * vy);
}

function quantileMeans(scores: number[], fwds: number[], q = 5): number[] {
  const pairs = scores
    .map((s, i) => ({ s, f: fwds[i] }))
    .filter((p) => Number.isFinite(p.s) && Number.isFinite(p.f))
    .sort((a, b) => a.s - b.s);
  if (pairs.length < q * 2) return Array(q).fill(0);
  const out: number[] = [];
  const size = Math.floor(pairs.length / q);
  for (let qi = 0; qi < q; qi++) {
    const slice = pairs.slice(qi * size, qi === q - 1 ? pairs.length : (qi + 1) * size);
    const m = slice.reduce((s, p) => s + p.f, 0) / slice.length;
    out.push(m);
  }
  return out;
}

/**
 * Walk trailing dates; at each rebalance compute cross-section IC of factor vs fwd return.
 */
export function buildFactorsIc(
  rows: BakeRow[],
  opts?: { horizonBars?: number; step?: number; quantiles?: number; reportDate?: string },
): FactorsIcPayload {
  const horizon = opts?.horizonBars ?? 21;
  const step = opts?.step ?? 21;
  const q = opts?.quantiles ?? 5;
  const universe = rows.filter(
    (r) => r.group === "china-ashare" || r.group === "china-etf",
  );
  const src = universe.length ? universe : rows;

  const minLen = Math.min(...src.map((r) => r.candles.length));
  const icMom: number[] = [];
  const icVol: number[] = [];
  let lastQMom: number[] = Array(q).fill(0);
  let lastQVol: number[] = Array(q).fill(0);

  // Align by trailing index into each series
  for (let asOf = 80; asOf + horizon < minLen; asOf += step) {
    const scoresMom: number[] = [];
    const scoresVol: number[] = [];
    const fwds: number[] = [];
    for (const r of src) {
      const closes = r.candles.map((c) => c.close);
      // asOf counted from start of shortest — use end-relative for each
      const i = closes.length - (minLen - asOf);
      if (i < 40 || i + horizon >= closes.length) continue;
      const m = momentumRaw(closes, i);
      const v = lowVolRaw(closes, i);
      const f = fwdReturn(closes, i, horizon);
      if (m == null || v == null || f == null) continue;
      scoresMom.push(m);
      scoresVol.push(v);
      fwds.push(f);
    }
    if (fwds.length < 8) continue;
    const icM = rankPearson(scoresMom, fwds);
    const icV = rankPearson(scoresVol, fwds);
    if (icM != null) icMom.push(icM);
    if (icV != null) icVol.push(icV);
    lastQMom = quantileMeans(scoresMom, fwds, q);
    lastQVol = quantileMeans(scoresVol, fwds, q);
  }

  const summarize = (
    factor: "momentum" | "lowVol",
    ics: number[],
    qRets: number[],
  ): FactorIcRow => {
    if (!ics.length) {
      return {
        factor,
        icMean: null,
        icStd: null,
        ir: null,
        quantileReturns: qRets,
        nPeriods: 0,
      };
    }
    const mean = ics.reduce((s, x) => s + x, 0) / ics.length;
    const sd = Math.sqrt(
      ics.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, ics.length - 1),
    );
    return {
      factor,
      icMean: mean,
      icStd: sd,
      ir: sd > 1e-12 ? mean / sd : null,
      quantileReturns: qRets,
      nPeriods: ics.length,
    };
  };

  return {
    generatedAt: new Date().toISOString(),
    reportDate: opts?.reportDate ?? new Date().toISOString().slice(0, 10),
    source: "ohlc-proxy-ic",
    attribution: {
      zh: "IC/IR 来自 OHLC 代理横截面（动量、低波）对前瞻收益的 Spearman；教育 distill，非实盘因子库。",
      en: "IC/IR from OHLC-proxy cross-section (momentum, low-vol) vs forward returns (Spearman). Educational distill — not a live factor library.",
    },
    horizonBars: horizon,
    rows: [
      summarize("momentum", icMom, lastQMom),
      summarize("lowVol", icVol, lastQVol),
    ],
  };
}

/** Bake helper: primary 21d IC plus 5/10/21 multi-horizon strip. */
export function buildFactorsIcMulti(
  rows: BakeRow[],
  opts?: { step?: number; quantiles?: number; reportDate?: string },
): FactorsIcPayload {
  const horizons = [5, 10, 21];
  const primary = buildFactorsIc(rows, {
    ...opts,
    horizonBars: 21,
  });
  primary.horizons = horizons.map((h) => {
    const slice = buildFactorsIc(rows, { ...opts, horizonBars: h });
    return { horizonBars: h, rows: slice.rows };
  });
  return primary;
}

/** Simple post-publication decay proxy: Q5−Q1 spread across horizons (literacy). */
export function quantileSpread(row: FactorIcRow | undefined): number | null {
  const q = row?.quantileReturns;
  if (!q || q.length < 2) return null;
  const lo = q[0];
  const hi = q[q.length - 1];
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return hi - lo;
}

/** IC-weight vector from latest IC means (fallback equal). */
export function icWeightVector(
  ic: FactorsIcPayload | null,
): { momentum: number; lowVol: number; sizeAdv: number; quality: number } {
  const mom = ic?.rows.find((r) => r.factor === "momentum")?.icMean;
  const lv = ic?.rows.find((r) => r.factor === "lowVol")?.icMean;
  const wMom = mom != null ? Math.max(0.05, Math.abs(mom)) : 0.25;
  const wLv = lv != null ? Math.max(0.05, Math.abs(lv)) : 0.25;
  const rest = Math.max(0.1, 1 - wMom - wLv);
  return {
    momentum: wMom,
    lowVol: wLv,
    sizeAdv: rest / 2,
    quality: rest / 2,
  };
}

export type FactorTiltId = "equal" | "ic" | "value" | "momentum" | "quality";

export const FACTOR_TILTS: Record<
  FactorTiltId,
  { momentum: number; lowVol: number; sizeAdv: number; quality: number; peProxy?: number; pbProxy?: number }
> = {
  equal: { momentum: 0.25, lowVol: 0.25, sizeAdv: 0.25, quality: 0.25 },
  ic: { momentum: 0.4, lowVol: 0.3, sizeAdv: 0.15, quality: 0.15 }, // overwritten by icWeightVector when available
  value: { momentum: 0.1, lowVol: 0.2, sizeAdv: 0.2, quality: 0.15, peProxy: 0.2, pbProxy: 0.15 },
  momentum: { momentum: 0.5, lowVol: 0.15, sizeAdv: 0.2, quality: 0.15 },
  quality: { momentum: 0.15, lowVol: 0.25, sizeAdv: 0.15, quality: 0.45 },
};
