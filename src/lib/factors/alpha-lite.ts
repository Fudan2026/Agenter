/**
 * Alpha40-lite — distill of Qlib Alpha158 OHLC operators (educational).
 * No lookahead: windows use bars ≤ asOf index (default last bar).
 * Not a full Alpha158 port; ships a strong subset for bake + Fin multifactor.
 */

export type Candle = { open: number; high: number; low: number; close: number; volume: number };

export interface AlphaLiteScores {
  symbol: string;
  nameZh: string;
  nameEn: string;
  factors: Record<string, number | null>;
  /** Cross-section z of selected core factors, then equal-weight composite. */
  composite: number | null;
  rank: number | null;
}

export interface AlphaLitePayload {
  generatedAt: string;
  reportDate: string;
  source: string;
  attribution: { zh: string; en: string };
  factorIds: string[];
  suggestedWeights: Record<string, number>;
  topN: AlphaLiteScores[];
  universe: AlphaLiteScores[];
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function sliceEnds(arr: number[], win: number): number[] {
  if (arr.length < win) return arr.slice();
  return arr.slice(arr.length - win);
}

/** Linear regression slope of y on 0..n-1 */
function slope(ys: number[]): number | null {
  const n = ys.length;
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += ys[i];
    sxx += i * i;
    sxy += i * ys[i];
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  return (n * sxy - sx * sy) / den;
}

function corr(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  const aa = a.slice(a.length - n);
  const bb = b.slice(b.length - n);
  const ma = mean(aa);
  const mb = mean(bb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = aa[i] - ma;
    const y = bb[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  if (!(den > 1e-12)) return null;
  return num / den;
}

/** Core Alpha158-style operators on a single symbol series. */
export function computeAlphaLiteFactors(candles: Candle[]): Record<string, number | null> {
  const n = candles.length;
  const out: Record<string, number | null> = {};
  if (n < 25) {
    return {
      KMID: null,
      KLEN: null,
      KMID2: null,
      KUP: null,
      KLOW: null,
      KSFT: null,
      ROC5: null,
      ROC10: null,
      ROC20: null,
      MA5: null,
      MA10: null,
      MA20: null,
      STD5: null,
      STD10: null,
      STD20: null,
      BETA5: null,
      BETA10: null,
      BETA20: null,
      RSV5: null,
      RSV10: null,
      RSV20: null,
      MAX5: null,
      MAX10: null,
      MIN5: null,
      MIN10: null,
      QTLU20: null,
      QTLD20: null,
      CORR20: null,
      VMA5: null,
      VSTD10: null,
      VWAP_PROXY: null,
      RET1: null,
      RET5: null,
      RANGE20: null,
      OBV_SLOPE10: null,
    };
  }

  const o = candles.map((c) => c.open);
  const h = candles.map((c) => c.high);
  const l = candles.map((c) => c.low);
  const c = candles.map((c) => c.close);
  const v = candles.map((c) => c.volume);
  const last = n - 1;
  const open = o[last];
  const high = h[last];
  const low = l[last];
  const close = c[last];
  const eps = 1e-12;

  out.KMID = open > 0 ? (close - open) / open : null;
  out.KLEN = open > 0 ? (high - low) / open : null;
  out.KMID2 = (close - open) / (high - low + eps);
  out.KUP = open > 0 ? (high - Math.max(open, close)) / open : null;
  out.KLOW = open > 0 ? (Math.min(open, close) - low) / open : null;
  out.KSFT = open > 0 ? (2 * close - high - low) / open : null;

  const roc = (w: number) => {
    if (last < w || !(c[last - w] > 0)) return null;
    return c[last] / c[last - w] - 1;
  };
  out.ROC5 = roc(5);
  out.ROC10 = roc(10);
  out.ROC20 = roc(20);

  const ma = (w: number) => {
    const s = sliceEnds(c, w);
    if (s.length < w || !(close > 0)) return null;
    return mean(s) / close;
  };
  out.MA5 = ma(5);
  out.MA10 = ma(10);
  out.MA20 = ma(20);

  const sd = (w: number) => {
    const s = sliceEnds(c, w);
    if (s.length < w || !(close > 0)) return null;
    return std(s) / close;
  };
  out.STD5 = sd(5);
  out.STD10 = sd(10);
  out.STD20 = sd(20);

  out.BETA5 = slope(sliceEnds(c, 5));
  out.BETA10 = slope(sliceEnds(c, 10));
  out.BETA20 = slope(sliceEnds(c, 20));

  const rsv = (w: number) => {
    const hh = Math.max(...sliceEnds(h, w));
    const ll = Math.min(...sliceEnds(l, w));
    return (close - ll) / (hh - ll + eps);
  };
  out.RSV5 = rsv(5);
  out.RSV10 = rsv(10);
  out.RSV20 = rsv(20);

  out.MAX5 = close > 0 ? Math.max(...sliceEnds(h, 5)) / close : null;
  out.MAX10 = close > 0 ? Math.max(...sliceEnds(h, 10)) / close : null;
  out.MIN5 = close > 0 ? Math.min(...sliceEnds(l, 5)) / close : null;
  out.MIN10 = close > 0 ? Math.min(...sliceEnds(l, 10)) / close : null;

  const sorted20 = sliceEnds(c, 20).slice().sort((a, b) => a - b);
  out.QTLU20 =
    sorted20.length >= 20 && close > 0
      ? sorted20[Math.floor(0.8 * (sorted20.length - 1))] / close
      : null;
  out.QTLD20 =
    sorted20.length >= 20 && close > 0
      ? sorted20[Math.floor(0.2 * (sorted20.length - 1))] / close
      : null;

  const rets: number[] = [];
  const vols: number[] = [];
  for (let i = Math.max(1, n - 20); i < n; i++) {
    if (c[i - 1] > 0) {
      rets.push(c[i] / c[i - 1] - 1);
      vols.push(v[i]);
    }
  }
  out.CORR20 = corr(rets, vols);

  out.VMA5 =
    v[last] > 0 ? mean(sliceEnds(v, 5)) / (v[last] + eps) : null;
  out.VSTD10 =
    v[last] > 0 ? std(sliceEnds(v, 10)) / (v[last] + eps) : null;

  // Typical-price VWAP proxy over 10 bars
  let tpSum = 0;
  let volSum = 0;
  for (let i = Math.max(0, n - 10); i < n; i++) {
    const tp = (h[i] + l[i] + c[i]) / 3;
    tpSum += tp * v[i];
    volSum += v[i];
  }
  out.VWAP_PROXY = volSum > 0 && close > 0 ? tpSum / volSum / close : null;

  out.RET1 = last >= 1 && c[last - 1] > 0 ? c[last] / c[last - 1] - 1 : null;
  out.RET5 = roc(5);
  out.RANGE20 =
    close > 0
      ? (Math.max(...sliceEnds(h, 20)) - Math.min(...sliceEnds(l, 20))) / close
      : null;

  // OBV-like cumulative signed volume slope
  let obv = 0;
  const obvSeries: number[] = [];
  for (let i = 1; i < n; i++) {
    if (c[i] > c[i - 1]) obv += v[i];
    else if (c[i] < c[i - 1]) obv -= v[i];
    obvSeries.push(obv);
  }
  out.OBV_SLOPE10 = slope(sliceEnds(obvSeries, 10));

  return out;
}

export const ALPHA_LITE_IDS = [
  "KMID",
  "KLEN",
  "KMID2",
  "KUP",
  "KLOW",
  "KSFT",
  "ROC5",
  "ROC10",
  "ROC20",
  "MA5",
  "MA10",
  "MA20",
  "STD5",
  "STD10",
  "STD20",
  "BETA5",
  "BETA10",
  "BETA20",
  "RSV5",
  "RSV10",
  "RSV20",
  "MAX5",
  "MAX10",
  "MIN5",
  "MIN10",
  "QTLU20",
  "QTLD20",
  "CORR20",
  "VMA5",
  "VSTD10",
  "VWAP_PROXY",
  "RET1",
  "RET5",
  "RANGE20",
  "OBV_SLOPE10",
] as const;

/** Factors used for composite (long-ish / quality tilt). */
export const COMPOSITE_KEYS = [
  "ROC20",
  "RSV20",
  "BETA20",
  "MA20",
  "STD20",
  "CORR20",
  "OBV_SLOPE10",
  "VWAP_PROXY",
] as const;

/** Suggested portfolio weights over composite keys (sum ≈ 1). */
export const SUGGESTED_WEIGHTS: Record<string, number> = {
  ROC20: 0.18,
  RSV20: 0.14,
  BETA20: 0.12,
  MA20: 0.12,
  STD20: -0.14, // prefer lower vol → invert later via -z
  CORR20: 0.1,
  OBV_SLOPE10: 0.14,
  VWAP_PROXY: 0.1,
};

function zscoreCol(vals: (number | null)[]): (number | null)[] {
  const finite = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length < 2) return vals.map(() => null);
  const m = mean(finite);
  const s = std(finite);
  if (!(s > 1e-12)) return vals.map(() => null);
  return vals.map((v) => (v == null || !Number.isFinite(v) ? null : (v - m) / s));
}

export function buildAlphaLiteBoard(
  rows: Array<{
    symbol: string;
    nameZh: string;
    nameEn: string;
    candles: Candle[];
  }>,
  opts: { reportDate: string; topN?: number },
): AlphaLitePayload {
  const scored: AlphaLiteScores[] = rows.map((r) => ({
    symbol: r.symbol,
    nameZh: r.nameZh,
    nameEn: r.nameEn,
    factors: computeAlphaLiteFactors(r.candles),
    composite: null,
    rank: null,
  }));

  // Cross-section z for composite keys
  const zByKey: Record<string, (number | null)[]> = {};
  for (const k of COMPOSITE_KEYS) {
    let col = scored.map((s) => s.factors[k] ?? null);
    if (k === "STD20") {
      // invert: lower vol → higher score
      col = col.map((v) => (v == null ? null : -v));
    }
    zByKey[k] = zscoreCol(col);
  }

  for (let i = 0; i < scored.length; i++) {
    let wSum = 0;
    let acc = 0;
    for (const k of COMPOSITE_KEYS) {
      const z = zByKey[k][i];
      const w = Math.abs(SUGGESTED_WEIGHTS[k] ?? 0.1);
      if (z == null) continue;
      acc += z * w;
      wSum += w;
    }
    scored[i].composite = wSum > 0 ? acc / wSum : null;
  }

  const ranked = scored
    .filter((s) => s.composite != null)
    .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
  ranked.forEach((s, idx) => {
    s.rank = idx + 1;
  });
  const rankMap = new Map(ranked.map((s) => [s.symbol, s.rank]));
  for (const s of scored) s.rank = rankMap.get(s.symbol) ?? null;

  const topN = opts.topN ?? 12;
  return {
    generatedAt: new Date().toISOString(),
    reportDate: opts.reportDate,
    source: "Alpha40-lite distill of Qlib Alpha158 OHLC ops on bake bars",
    attribution: {
      zh: "Alpha40-lite：蒸馏 Qlib Alpha158 量价算子（教育演示，非完整 158，无未来函数）。",
      en: "Alpha40-lite: distill of Qlib Alpha158 OHLC ops (educational subset; no lookahead).",
    },
    factorIds: [...ALPHA_LITE_IDS],
    suggestedWeights: { ...SUGGESTED_WEIGHTS },
    topN: ranked.slice(0, topN),
    universe: scored,
  };
}
