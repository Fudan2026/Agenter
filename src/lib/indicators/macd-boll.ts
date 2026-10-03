/**
 * MACD + Bollinger on close series (pure TS, no deps).
 */

import { ema, sma } from "./core";

export interface MacdPoint {
  macd: number;
  signal: number;
  hist: number;
}

/** Classic 12/26/9 MACD; returns series aligned to the end of closes. */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  if (closes.length < slow + signalPeriod) return [];
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  // Align: emaFast starts at index fast-1, emaSlow at slow-1
  const fastOffset = closes.length - emaFast.length;
  const slowOffset = closes.length - emaSlow.length;
  const start = Math.max(fastOffset, slowOffset);
  const macdLine: number[] = [];
  for (let i = start; i < closes.length; i++) {
    const f = emaFast[i - fastOffset];
    const s = emaSlow[i - slowOffset];
    macdLine.push(f - s);
  }
  const signalLine = ema(macdLine, signalPeriod);
  const sigOffset = macdLine.length - signalLine.length;
  const out: MacdPoint[] = [];
  for (let i = sigOffset; i < macdLine.length; i++) {
    const m = macdLine[i];
    const sig = signalLine[i - sigOffset];
    out.push({ macd: m, signal: sig, hist: m - sig });
  }
  return out;
}

export interface BollPoint {
  mid: number;
  upper: number;
  lower: number;
}

export function bollinger(
  closes: number[],
  period = 20,
  mult = 2,
): BollPoint[] {
  if (closes.length < period) return [];
  const midArr = sma(closes, period);
  const out: BollPoint[] = [];
  const offset = closes.length - midArr.length;
  for (let i = 0; i < midArr.length; i++) {
    const end = offset + i;
    const start = end - period + 1;
    let sumSq = 0;
    const mid = midArr[i];
    for (let j = start; j <= end; j++) {
      const d = closes[j] - mid;
      sumSq += d * d;
    }
    const sd = Math.sqrt(sumSq / period);
    out.push({
      mid,
      upper: mid + mult * sd,
      lower: mid - mult * sd,
    });
  }
  return out;
}
