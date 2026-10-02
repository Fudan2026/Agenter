/**
 * Minimal indicators distilled from OpenCool lib/trading/indicators.ts.
 * No external technicalindicators dependency.
 */

export function sma(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out.push(sum / period);
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out.push(sum / period);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  const out: number[] = [prev];
  for (let i = period; i < values.length; i++) {
    prev = (values[i] - prev) * k + prev;
    out.push(prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  if (closes.length <= period) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  const out: number[] = [];
  out.push(100 - 100 / (1 + avgGain / (avgLoss || 1e-10)));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    out.push(100 - 100 / (1 + avgGain / (avgLoss || 1e-10)));
  }
  return out;
}

export function volumeSpike(
  volumes: number[],
  period = 20,
  mult = 2,
): boolean {
  const ma = sma(volumes, period);
  if (!ma.length) return false;
  const lastVol = volumes[volumes.length - 1];
  const lastMa = ma[ma.length - 1];
  if (!lastMa) return false;
  return lastVol >= mult * lastMa;
}

export type MaAlignment = "bull" | "bear" | "mixed" | "unknown";

export function maAlignment(
  price: number,
  sma20: number | null,
  sma50: number | null,
  sma60: number | null,
): MaAlignment {
  // Prefer sma20/50/60 when 200 unavailable (120-bar bake window).
  if (sma20 == null || sma50 == null || sma60 == null) return "unknown";
  if (price > sma20 && sma20 > sma50 && sma50 > sma60) return "bull";
  if (price < sma20 && sma20 < sma50 && sma50 < sma60) return "bear";
  return "mixed";
}

export function last<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined;
}

export type RsiZone = "overbought" | "oversold" | "normal";

export interface SymbolIndicators {
  sma20: number | null;
  sma60: number | null;
  rsi14: number | null;
  rsiZone: RsiZone;
  maAlign: MaAlignment;
  volumeSpike: boolean;
  /** Full-length SMA20 aligned to candle index (null padded). */
  sma20Series: Array<number | null>;
  sma60Series: Array<number | null>;
}

export function computeSymbolIndicators(
  closes: number[],
  volumes: number[],
): SymbolIndicators {
  const sma20arr = sma(closes, 20);
  const sma60arr = sma(closes, 60);
  const rsiArr = rsi(closes, 14);
  const sma20Val = last(sma20arr) ?? null;
  const sma60Val = last(sma60arr) ?? null;
  const sma50arr = sma(closes, 50);
  const sma50Val = last(sma50arr) ?? null;
  const price = last(closes) ?? 0;
  const rsi14 = last(rsiArr) ?? null;
  let rsiZone: RsiZone = "normal";
  if (rsi14 != null) {
    if (rsi14 > 70) rsiZone = "overbought";
    else if (rsi14 < 30) rsiZone = "oversold";
  }
  const pad = (arr: number[], period: number): Array<number | null> => {
    const out: Array<number | null> = Array(Math.max(0, period - 1)).fill(null);
    return out.concat(arr);
  };
  return {
    sma20: sma20Val,
    sma60: sma60Val,
    rsi14,
    rsiZone,
    maAlign: maAlignment(price, sma20Val, sma50Val, sma60Val),
    volumeSpike: volumeSpike(volumes, 20, 2),
    sma20Series: pad(sma20arr, 20).slice(-closes.length),
    sma60Series: pad(sma60arr, 60).slice(-closes.length),
  };
}
