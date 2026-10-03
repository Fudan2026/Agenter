/**
 * Pattern efficacy stats — no lookahead.
 * Entry at pattern-complete bar close; measure fwd N-day return.
 */

import type { OHLC } from "../ohlc/types";
import { sampleYearsFromBars } from "../ohlc/resample";
import { detectAt } from "./detect";
import {
  ALL_PATTERN_IDS,
  PATTERN_META,
  type PatternId,
} from "./types";

export const PATTERN_STAT_HORIZONS = [1, 5, 10, 20] as const;
export type PatternStatHorizon = (typeof PATTERN_STAT_HORIZONS)[number];

export interface HorizonStat {
  horizon: PatternStatHorizon;
  count: number;
  upProb: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  payoffRatio: number | null;
  winRate: number | null;
}

export interface PatternEfficacy {
  patternId: PatternId;
  direction: "bull" | "bear" | "neutral";
  horizons: HorizonStat[];
}

export interface SymbolPatternStats {
  symbol: string;
  nBars: number;
  sampleYears: number;
  patterns: PatternEfficacy[];
}

function dateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function fwdReturn(candles: OHLC[], i: number, horizon: number): number | null {
  const j = i + horizon;
  if (j >= candles.length) return null;
  const a = candles[i].close;
  const b = candles[j].close;
  if (!(a > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / a;
}

/** For bear patterns, a down move is a "win"; for bull/neutral, up is win. */
function isWin(
  direction: "bull" | "bear" | "neutral",
  ret: number,
): boolean {
  if (direction === "bear") return ret < 0;
  return ret > 0;
}

function signedEdge(
  direction: "bull" | "bear" | "neutral",
  ret: number,
): number {
  // Edge from the pattern's intended side
  if (direction === "bear") return -ret;
  return ret;
}

function summarizeHorizon(
  returns: number[],
  direction: "bull" | "bear" | "neutral",
  horizon: PatternStatHorizon,
): HorizonStat {
  const count = returns.length;
  if (!count) {
    return {
      horizon,
      count: 0,
      upProb: null,
      avgWin: null,
      avgLoss: null,
      payoffRatio: null,
      winRate: null,
    };
  }
  const ups = returns.filter((r) => r > 0).length;
  const wins: number[] = [];
  const losses: number[] = [];
  let winN = 0;
  for (const r of returns) {
    const edge = signedEdge(direction, r);
    if (isWin(direction, r)) {
      winN++;
      wins.push(Math.abs(edge));
    } else if (edge !== 0) {
      losses.push(Math.abs(edge));
    }
  }
  const avgWin = wins.length
    ? wins.reduce((a, b) => a + b, 0) / wins.length
    : null;
  const avgLoss = losses.length
    ? losses.reduce((a, b) => a + b, 0) / losses.length
    : null;
  const payoffRatio =
    avgWin != null && avgLoss != null && avgLoss > 0
      ? avgWin / avgLoss
      : null;
  return {
    horizon,
    count,
    upProb: ups / count,
    avgWin,
    avgLoss,
    payoffRatio,
    winRate: winN / count,
  };
}

/**
 * Scan full series for each PatternId × horizons.
 * No lookahead: uses only candles[0..i] for detection; return uses i+N.
 */
export function computePatternStats(
  symbol: string,
  candles: OHLC[],
): SymbolPatternStats {
  const nBars = candles.length;
  const byId = new Map<PatternId, Map<PatternStatHorizon, number[]>>();
  for (const id of ALL_PATTERN_IDS) {
    const m = new Map<PatternStatHorizon, number[]>();
    for (const h of PATTERN_STAT_HORIZONS) m.set(h, []);
    byId.set(id, m);
  }

  for (let i = 0; i < candles.length; i++) {
    const found = detectAt(candles, i);
    if (!found.length) continue;
    for (const patternId of found) {
      const bucket = byId.get(patternId);
      if (!bucket) continue;
      for (const h of PATTERN_STAT_HORIZONS) {
        const r = fwdReturn(candles, i, h);
        if (r == null) continue;
        bucket.get(h)!.push(r);
      }
    }
  }

  const patterns: PatternEfficacy[] = ALL_PATTERN_IDS.map((patternId) => {
    const bucket = byId.get(patternId)!;
    const direction = PATTERN_META[patternId].direction;
    const horizons = PATTERN_STAT_HORIZONS.map((h) =>
      summarizeHorizon(bucket.get(h)!, direction, h),
    );
    return { patternId, direction, horizons };
  });

  return {
    symbol,
    nBars,
    sampleYears: sampleYearsFromBars(nBars),
    patterns,
  };
}

/** Pick a single horizon row (default 5d) for UI filters. */
export function horizonStat(
  stats: SymbolPatternStats | null | undefined,
  patternId: PatternId,
  horizon: PatternStatHorizon = 5,
): HorizonStat | null {
  if (!stats) return null;
  const row = stats.patterns.find((p) => p.patternId === patternId);
  if (!row) return null;
  return row.horizons.find((h) => h.horizon === horizon) ?? null;
}

export function patternWithinWinBand(
  winRate: number | null,
  minPct: number,
  maxPct: number,
): boolean {
  if (winRate == null) return false;
  const pct = winRate * 100;
  return pct >= minPct && pct <= maxPct;
}

/** Re-export date helper for tests. */
export function _dateKeyForTest(d: Date): string {
  return dateKey(d);
}
