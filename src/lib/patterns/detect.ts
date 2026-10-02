/**
 * Five candle pattern detectors.
 * No-lookahead: pattern ending at index i uses only candles[0..i].
 */

import type { OHLC } from "../ohlc/types";
import {
  ALL_PATTERN_IDS,
  PATTERN_META,
  type PatternHit,
  type PatternId,
} from "./types";

function body(c: OHLC): number {
  return Math.abs(c.close - c.open);
}

function range(c: OHLC): number {
  return c.high - c.low;
}

function upperWick(c: OHLC): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerWick(c: OHLC): number {
  return Math.min(c.open, c.close) - c.low;
}

function isBullish(c: OHLC): boolean {
  return c.close > c.open;
}

function isBearish(c: OHLC): boolean {
  return c.close < c.open;
}

function isDoji(c: OHLC): boolean {
  const r = range(c);
  if (r === 0) return true;
  return body(c) / r <= 0.1;
}

function isHammer(c: OHLC): boolean {
  if (isDoji(c)) return false;
  const b = body(c);
  if (b === 0) return false;
  const lw = lowerWick(c);
  const uw = upperWick(c);
  // small body near top of range; lower wick ≥ 2× body; upper wick ≤ body
  return lw >= 2 * b && uw <= b;
}

function isShootingStar(c: OHLC): boolean {
  if (isDoji(c)) return false;
  const b = body(c);
  if (b === 0) return false;
  const lw = lowerWick(c);
  const uw = upperWick(c);
  // small body near bottom of range; upper wick ≥ 2× body; lower wick ≤ body
  return uw >= 2 * b && lw <= b;
}

function isBullishEngulfing(prev: OHLC, curr: OHLC): boolean {
  if (!isBearish(prev) || !isBullish(curr)) return false;
  return curr.open <= prev.close && curr.close >= prev.open;
}

function isBearishEngulfing(prev: OHLC, curr: OHLC): boolean {
  if (!isBullish(prev) || !isBearish(curr)) return false;
  return curr.open >= prev.close && curr.close <= prev.open;
}

function dateKey(d: Date): string {
  // Asia/Shanghai calendar date for CN markets
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

/** Detect patterns at a single bar index (uses only candles ≤ i). */
export function detectAt(
  candles: OHLC[],
  i: number,
): PatternId[] {
  if (i < 0 || i >= candles.length) return [];
  const curr = candles[i];
  const hits: PatternId[] = [];

  if (isDoji(curr)) hits.push("doji");
  else {
    if (isHammer(curr)) hits.push("hammer");
    if (isShootingStar(curr)) hits.push("shooting_star");
  }

  if (i >= 1) {
    const prev = candles[i - 1];
    if (isBullishEngulfing(prev, curr)) hits.push("bullish_engulfing");
    if (isBearishEngulfing(prev, curr)) hits.push("bearish_engulfing");
  }

  return hits;
}

/**
 * Scan candles and return pattern hits.
 * Only last `windowDays` bars are included in the result list.
 * Evaluation at each bar uses no future data.
 */
export function detectRecentPatterns(
  candles: OHLC[],
  windowDays = 60,
): PatternHit[] {
  const hits: PatternHit[] = [];
  if (candles.length === 0) return hits;

  const start = Math.max(0, candles.length - windowDays);
  for (let i = start; i < candles.length; i++) {
    // Pass full prefix up to i so 2-bar patterns can read prev;
    // detectAt only reads ≤ i — no lookahead.
    const found = detectAt(candles, i);
    for (const patternId of found) {
      hits.push({
        patternId,
        date: dateKey(candles[i].date),
        direction: PATTERN_META[patternId].direction,
      });
    }
  }
  return hits;
}

/** Assert only the five allowed IDs exist. */
export function assertKnownPatternIds(ids: string[]): void {
  for (const id of ids) {
    if (!ALL_PATTERN_IDS.includes(id as PatternId)) {
      throw new Error(`Unknown patternId: ${id}`);
    }
  }
}
