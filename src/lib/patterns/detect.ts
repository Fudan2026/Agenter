/**
 * Candle pattern detectors (15 IDs = 5 legacy + 10 additive).
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
  return lowerWick(c) >= 2 * b && upperWick(c) <= b;
}

/** Long upper wick + small body + short lower wick (shared silhouette). */
function isLongUpperWick(c: OHLC): boolean {
  if (isDoji(c)) return false;
  const b = body(c);
  if (b === 0) return false;
  return upperWick(c) >= 2 * b && lowerWick(c) <= b;
}

/** Prior close slope over lookback — used to split inverted hammer vs shooting star. */
function priorTrend(
  candles: OHLC[],
  i: number,
  lookback = 5,
): "up" | "down" | "flat" {
  if (i < lookback) return "flat";
  const a = candles[i - lookback].close;
  const b = candles[i - 1]?.close ?? candles[i].close;
  if (!(a > 0)) return "flat";
  const ret = (b - a) / a;
  if (ret > 0.01) return "up";
  if (ret < -0.01) return "down";
  return "flat";
}

/** Spinning top: small body with meaningful, roughly equal wicks (not doji). */
function isSpinningTop(c: OHLC): boolean {
  const r = range(c);
  if (r === 0) return false;
  const b = body(c);
  const br = b / r;
  if (br <= 0.1 || br > 0.35) return false;
  const uw = upperWick(c);
  const lw = lowerWick(c);
  if (uw < b * 0.5 || lw < b * 0.5) return false;
  const ratio = Math.min(uw, lw) / Math.max(uw, lw);
  return ratio >= 0.5;
}

function isBullishEngulfing(prev: OHLC, curr: OHLC): boolean {
  if (!isBearish(prev) || !isBullish(curr)) return false;
  return curr.open <= prev.close && curr.close >= prev.open;
}

function isBearishEngulfing(prev: OHLC, curr: OHLC): boolean {
  if (!isBullish(prev) || !isBearish(curr)) return false;
  return curr.open >= prev.close && curr.close <= prev.open;
}

/** Piercing: bearish then bullish closing > midpoint of prior body. */
function isPiercing(prev: OHLC, curr: OHLC): boolean {
  if (!isBearish(prev) || !isBullish(curr)) return false;
  if (curr.open >= prev.close) return false;
  const mid = (prev.open + prev.close) / 2;
  return curr.close > mid && curr.close < prev.open;
}

/** Dark cloud: bullish then bearish closing < midpoint of prior body. */
function isDarkCloudCover(prev: OHLC, curr: OHLC): boolean {
  if (!isBullish(prev) || !isBearish(curr)) return false;
  if (curr.open <= prev.close) return false;
  const mid = (prev.open + prev.close) / 2;
  return curr.close < mid && curr.close > prev.open;
}

/** Bullish harami: large bearish then small bullish inside prior body. */
function isBullishHarami(prev: OHLC, curr: OHLC): boolean {
  if (!isBearish(prev) || !isBullish(curr)) return false;
  const prevHi = Math.max(prev.open, prev.close);
  const prevLo = Math.min(prev.open, prev.close);
  const currHi = Math.max(curr.open, curr.close);
  const currLo = Math.min(curr.open, curr.close);
  if (body(curr) >= body(prev) * 0.6) return false;
  return currHi <= prevHi && currLo >= prevLo;
}

/** Bearish harami: large bullish then small bearish inside prior body. */
function isBearishHarami(prev: OHLC, curr: OHLC): boolean {
  if (!isBullish(prev) || !isBearish(curr)) return false;
  const prevHi = Math.max(prev.open, prev.close);
  const prevLo = Math.min(prev.open, prev.close);
  const currHi = Math.max(curr.open, curr.close);
  const currLo = Math.min(curr.open, curr.close);
  if (body(curr) >= body(prev) * 0.6) return false;
  return currHi <= prevHi && currLo >= prevLo;
}

function isMorningStar(a: OHLC, b: OHLC, c: OHLC): boolean {
  if (!isBearish(a)) return false;
  const small = body(b) <= body(a) * 0.5;
  if (!small) return false;
  if (!isBullish(c)) return false;
  const aMid = (a.open + a.close) / 2;
  return c.close > aMid;
}

function isEveningStar(a: OHLC, b: OHLC, c: OHLC): boolean {
  if (!isBullish(a)) return false;
  const small = body(b) <= body(a) * 0.5;
  if (!small) return false;
  if (!isBearish(c)) return false;
  const aMid = (a.open + a.close) / 2;
  return c.close < aMid;
}

function isThreeWhiteSoldiers(a: OHLC, b: OHLC, c: OHLC): boolean {
  if (!isBullish(a) || !isBullish(b) || !isBullish(c)) return false;
  if (!(b.close > a.close && c.close > b.close)) return false;
  // each opens within prior body
  const inBody = (prev: OHLC, curr: OHLC) =>
    curr.open >= Math.min(prev.open, prev.close) &&
    curr.open <= Math.max(prev.open, prev.close);
  return inBody(a, b) && inBody(b, c);
}

function isThreeBlackCrows(a: OHLC, b: OHLC, c: OHLC): boolean {
  if (!isBearish(a) || !isBearish(b) || !isBearish(c)) return false;
  if (!(b.close < a.close && c.close < b.close)) return false;
  const inBody = (prev: OHLC, curr: OHLC) =>
    curr.open <= Math.max(prev.open, prev.close) &&
    curr.open >= Math.min(prev.open, prev.close);
  return inBody(a, b) && inBody(b, c);
}

function dateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

/** Detect patterns at a single bar index (uses only candles ≤ i). */
export function detectAt(candles: OHLC[], i: number): PatternId[] {
  if (i < 0 || i >= candles.length) return [];
  const curr = candles[i];
  const hits: PatternId[] = [];

  if (isDoji(curr)) hits.push("doji");
  else {
    if (isHammer(curr)) hits.push("hammer");
    if (isLongUpperWick(curr)) {
      const trend = priorTrend(candles, i);
      if (trend === "down") hits.push("inverted_hammer");
      else if (trend === "up") hits.push("shooting_star");
      else {
        // flat / short history: keep legacy shooting_star; also tag inverted_hammer
        // only when prior bar is clearly lower (micro down)
        if (i >= 1 && candles[i - 1].close > curr.close) {
          hits.push("inverted_hammer");
        } else {
          hits.push("shooting_star");
        }
      }
    }
    if (isSpinningTop(curr)) hits.push("spinning_top");
  }

  if (i >= 1) {
    const prev = candles[i - 1];
    if (isBullishEngulfing(prev, curr)) hits.push("bullish_engulfing");
    if (isBearishEngulfing(prev, curr)) hits.push("bearish_engulfing");
    if (isPiercing(prev, curr)) hits.push("piercing_line");
    if (isDarkCloudCover(prev, curr)) hits.push("dark_cloud_cover");
    if (isBullishHarami(prev, curr)) hits.push("bullish_harami");
    if (isBearishHarami(prev, curr)) hits.push("bearish_harami");
  }

  if (i >= 2) {
    const a = candles[i - 2];
    const b = candles[i - 1];
    if (isMorningStar(a, b, curr)) hits.push("morning_star");
    if (isEveningStar(a, b, curr)) hits.push("evening_star");
    if (isThreeWhiteSoldiers(a, b, curr)) hits.push("three_white_soldiers");
    if (isThreeBlackCrows(a, b, curr)) hits.push("three_black_crows");
  }

  return hits;
}

export function detectRecentPatterns(
  candles: OHLC[],
  windowDays = 60,
): PatternHit[] {
  const hits: PatternHit[] = [];
  if (candles.length === 0) return hits;

  const start = Math.max(0, candles.length - windowDays);
  for (let i = start; i < candles.length; i++) {
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

export function assertKnownPatternId(ids: string[]): void {
  for (const id of ids) {
    if (!ALL_PATTERN_IDS.includes(id as PatternId)) {
      throw new Error(`Unknown patternId: ${id}`);
    }
  }
}
