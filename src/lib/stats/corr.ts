/**
 * Pairwise Pearson correlation — distill of「量化统计方法」.
 */

export function pearsonCorr(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    k += 1;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  if (k < 5) return null;
  const cov = sxy - (sx * sy) / k;
  const vx = sxx - (sx * sx) / k;
  const vy = syy - (sy * sy) / k;
  if (!(vx > 1e-18) || !(vy > 1e-18)) return null;
  return cov / Math.sqrt(vx * vy);
}

/** Daily log-returns from close series. */
export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) out.push(Math.log(b / a));
    else out.push(0);
  }
  return out;
}

export interface CorrPair {
  a: string;
  b: string;
  corr: number | null;
}

/** Align two close series by shared trailing length and compute corr of returns. */
export function pairReturnCorr(
  closesA: number[],
  closesB: number[],
  maxLen = 120,
): number | null {
  const ra = logReturns(closesA);
  const rb = logReturns(closesB);
  const n = Math.min(ra.length, rb.length, maxLen);
  if (n < 20) return null;
  return pearsonCorr(ra.slice(-n), rb.slice(-n));
}

export function buildCorrMatrix(
  series: Array<{ id: string; closes: number[] }>,
): CorrPair[] {
  const pairs: CorrPair[] = [];
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      pairs.push({
        a: series[i].id,
        b: series[j].id,
        corr: pairReturnCorr(series[i].closes, series[j].closes),
      });
    }
  }
  return pairs;
}
