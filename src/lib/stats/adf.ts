/**
 * Compact Augmented Dickey–Fuller (ADF) unit-root test — pure TS.
 * Distill of SkillHub「量化统计方法」for Quant diagnostics strip.
 */

export interface AdfResult {
  statistic: number;
  pValue: number;
  nObs: number;
  lags: number;
  /** Heuristic label from p-value thresholds. */
  stationary: boolean;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** OLS y ~ X (with intercept column already in X[*,0]=1). Returns beta + residual SE. */
function ols(
  y: number[],
  X: number[][],
): { beta: number[]; se: number[]; resid: number[] } | null {
  const n = y.length;
  const k = X[0]?.length ?? 0;
  if (n < k + 2 || k === 0) return null;

  // XtX and XtY
  const XtX: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const XtY: number[] = Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      XtY[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }

  // Gauss-Jordan invert XtX
  const m = XtX.map((row, i) => [...row, ...eyeRow(k, i)]);
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    }
    if (Math.abs(m[piv][col]) < 1e-14) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    const div = m[col][col];
    for (let c = 0; c < 2 * k; c++) m[col][c] /= div;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = m[r][col];
      for (let c = 0; c < 2 * k; c++) m[r][c] -= f * m[col][c];
    }
  }
  const inv = m.map((row) => row.slice(k));

  const beta = Array(k).fill(0);
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) beta[a] += inv[a][b] * XtY[b];
  }

  const resid = y.map((yi, i) => {
    let pred = 0;
    for (let a = 0; a < k; a++) pred += X[i][a] * beta[a];
    return yi - pred;
  });
  const sse = resid.reduce((s, e) => s + e * e, 0);
  const sigma2 = sse / (n - k);
  const se = Array(k).fill(0);
  for (let a = 0; a < k; a++) se[a] = Math.sqrt(Math.max(0, inv[a][a] * sigma2));

  return { beta, se, resid };
}

function eyeRow(k: number, i: number): number[] {
  const r = Array(k).fill(0);
  r[i] = 1;
  return r;
}

/**
 * MacKinnon-ish one-sided p-value approximation for ADF t-stat (constant, no trend).
 * Adequate for educational UI — not a substitute for statsmodels.
 */
export function approxAdfPValue(tStat: number): number {
  // Critical values ~ −3.43 (1%), −2.86 (5%), −2.57 (10%) for large n
  if (tStat <= -3.43) return 0.005;
  if (tStat <= -2.86) {
    return 0.01 + ((tStat + 3.43) / (-2.86 + 3.43)) * 0.04;
  }
  if (tStat <= -2.57) {
    return 0.05 + ((tStat + 2.86) / (-2.57 + 2.86)) * 0.05;
  }
  if (tStat <= -1.95) {
    return 0.1 + ((tStat + 2.57) / (-1.95 + 2.57)) * 0.2;
  }
  if (tStat <= 0) {
    return 0.3 + ((tStat + 1.95) / 1.95) * 0.4;
  }
  return Math.min(0.99, 0.7 + tStat * 0.1);
}

/**
 * ADF with constant, lag order = floor(cbrt(n)) capped.
 * Series should be levels (e.g. log prices or equity curve).
 */
export function adfTest(series: number[], maxLags?: number): AdfResult | null {
  const x = series.filter((v) => Number.isFinite(v));
  const n = x.length;
  if (n < 20) return null;
  const lags =
    maxLags ?? Math.max(0, Math.min(8, Math.floor(Math.cbrt(n))));

  const y: number[] = [];
  const X: number[][] = [];
  for (let t = lags + 1; t < n; t++) {
    const dy = x[t] - x[t - 1];
    const row: number[] = [1, x[t - 1]];
    for (let L = 1; L <= lags; L++) {
      row.push(x[t - L] - x[t - L - 1]);
    }
    y.push(dy);
    X.push(row);
  }

  const fit = ols(y, X);
  if (!fit || !(fit.se[1] > 0)) return null;
  const statistic = fit.beta[1] / fit.se[1];
  const pValue = approxAdfPValue(statistic);
  return {
    statistic,
    pValue,
    nObs: y.length,
    lags,
    stationary: pValue < 0.05,
  };
}

/** Log-price ADF for a close series (skips non-positive). */
export function adfLogPrices(closes: number[]): AdfResult | null {
  const logs = closes.filter((c) => c > 0).map((c) => Math.log(c));
  return adfTest(logs);
}

export function residualDiagnostics(closes: number[]): {
  meanReturn: number | null;
  vol: number | null;
  adf: AdfResult | null;
} {
  if (closes.length < 3) {
    return { meanReturn: null, vol: null, adf: null };
  }
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
  }
  const m = rets.length ? mean(rets) : null;
  let vol: number | null = null;
  if (rets.length > 2 && m != null) {
    const v =
      rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1);
    vol = Math.sqrt(v);
  }
  return { meanReturn: m, vol, adf: adfLogPrices(closes) };
}
