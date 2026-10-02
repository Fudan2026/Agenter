/**
 * Fama–French style exposures with educational proxies (Tier 2).
 * Market β vs CSI300 ETF; Size = ADV percentile; Value = 12−1 reversal proxy.
 */

import type { SymbolRow } from "../../pages/types";

export interface FactorExposure {
  marketBeta: number | null;
  sizeScore: number | null;
  valueScore: number | null;
  labels: { market: string; size: string; value: string };
}

export function rollingBeta(
  assetCloses: number[],
  benchCloses: number[],
  win = 60,
): number | null {
  const n = Math.min(assetCloses.length, benchCloses.length);
  if (n < win + 1) return null;
  const aR: number[] = [];
  const bR: number[] = [];
  for (let i = n - win; i < n; i++) {
    if (i <= 0) continue;
    const ap = assetCloses[i - 1];
    const bp = benchCloses[i - 1];
    if (ap > 0 && bp > 0) {
      aR.push(assetCloses[i] / ap - 1);
      bR.push(benchCloses[i] / bp - 1);
    }
  }
  if (aR.length < 10) return null;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(aR);
  const mb = mean(bR);
  let cov = 0;
  let vb = 0;
  for (let i = 0; i < aR.length; i++) {
    cov += (aR[i] - ma) * (bR[i] - mb);
    vb += (bR[i] - mb) ** 2;
  }
  if (vb < 1e-12) return null;
  return cov / vb;
}

export function advPercentile(
  symbol: string,
  universeAdv: Record<string, number>,
): number {
  const vals = Object.entries(universeAdv).sort((a, b) => a[1] - b[1]);
  if (!vals.length) return 0.5;
  const idx = vals.findIndex(([s]) => s === symbol);
  if (idx < 0) return 0.5;
  return vals.length === 1 ? 0.5 : idx / (vals.length - 1);
}

/** Higher score = cheaper via 12−1 reversal (negative long-horizon return). */
export function valueProxy12_1(closes: number[]): number | null {
  if (closes.length < 40) return null;
  const lookback = Math.min(252, closes.length - 1);
  const past = closes[closes.length - 1 - lookback];
  const now = closes[closes.length - 1];
  if (!(past > 0)) return null;
  const ret = now / past - 1;
  // Map return to 0–1 cheapness: lower ret → higher value score
  return Math.max(0, Math.min(1, 0.5 - ret));
}

export function exposuresForRow(
  row: SymbolRow,
  bench: SymbolRow | null,
  universe: SymbolRow[],
): FactorExposure {
  const assetCloses = row.candles.map((c) => c.close);
  const benchCloses = bench?.candles.map((c) => c.close) ?? [];
  const universeAdv: Record<string, number> = {};
  for (const s of universe) {
    const vols = s.candles.slice(-20).map((c) => c.volume * c.close);
    universeAdv[s.symbol] = vols.length
      ? vols.reduce((a, b) => a + b, 0) / vols.length
      : 0;
  }
  return {
    marketBeta: bench ? rollingBeta(assetCloses, benchCloses) : null,
    sizeScore: advPercentile(row.symbol, universeAdv),
    valueScore: valueProxy12_1(assetCloses),
    labels: {
      market: bench?.symbol ?? "equal-weight",
      size: "ADV percentile (SMB proxy)",
      value: "HML-proxy (12−1 reversal)",
    },
  };
}

export function resolveBenchmark(symbols: SymbolRow[]): SymbolRow | null {
  return (
    symbols.find((s) => s.symbol === "510300.SS") ??
    symbols.find((s) => s.symbol === "000001.SS") ??
    null
  );
}
