export type RegimeLabel = "trend_up" | "trend_down" | "chop" | "high_vol";

function sma(values: number[], end: number, period: number): number {
  const start = end - period + 1;
  if (start < 0) return NaN;
  let sum = 0;
  for (let i = start; i <= end; i++) sum += values[i];
  return sum / period;
}

function realizedVol(closes: number[], end: number, window: number): number {
  const rets: number[] = [];
  for (let i = end - window + 1; i <= end; i++) {
    if (i <= 0) continue;
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const var_ =
    rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(var_) * Math.sqrt(252);
}

function percentileRank(value: number, history: number[]): number {
  if (!history.length) return 50;
  const min = Math.min(...history);
  const max = Math.max(...history);
  if (max - min < 1e-12) return 50;
  let below = 0;
  for (const h of history) if (h < value) below++;
  return (below / history.length) * 100;
}

export function classifyRegime(closes: number[]): {
  label: RegimeLabel;
  timingScore: number;
  volPctile: number;
} {
  if (closes.length < 61) {
    return { label: "chop", timingScore: 50, volPctile: 50 };
  }
  const end = closes.length - 1;
  const s60 = sma(closes, end, 60);
  const last = closes[end];
  const trendPct = s60 > 0 ? (last / s60 - 1) * 100 : 0;

  const volHistory: number[] = [];
  for (let i = 60; i < closes.length; i++) {
    volHistory.push(realizedVol(closes, i, 20));
  }
  const curVol = volHistory[volHistory.length - 1] ?? 0;
  const volBaseline =
    volHistory.length > 1 ? volHistory.slice(0, -1) : volHistory;
  const volPctile = percentileRank(curVol, volBaseline);

  const volElevated = curVol > 1e-8 && volPctile >= 75;
  const weakTrend = Math.abs(trendPct) < 3;
  let label: RegimeLabel;
  if (volElevated && weakTrend) label = "high_vol";
  else if (Math.abs(trendPct) < 1.5) label = "chop";
  else if (trendPct > 0) label = "trend_up";
  else label = "trend_down";

  const trendStrength = Math.min(100, Math.abs(trendPct) * 15);
  const volPenalty = volElevated ? 25 : 0;
  const timingScore = Math.round(
    Math.max(0, Math.min(100, trendStrength + (label === "chop" ? 20 : 35) - volPenalty)),
  );

  return { label, timingScore, volPctile };
}
