/**
 * Paper Pro TP/SL brackets — educational working exits on OHLC bars.
 * Same-bar conflict: stop fills first (pessimistic).
 */

import type { CandleBar } from "./engine";
import type { PaperPosition } from "./types";

export type BracketHit = "stop" | "take_profit";

export interface BracketLevels {
  stopPrice: number;
  takeProfitPrice: number;
}

/** Absolute levels from avgCost + percentage distances (e.g. 0.03 = 3%). */
export function bracketLevelsFromPct(
  avgCost: number,
  stopPct: number,
  takeProfitPct: number,
): BracketLevels | null {
  if (!(avgCost > 0)) return null;
  if (!(stopPct > 0) || !(takeProfitPct > 0)) return null;
  return {
    stopPrice: avgCost * (1 - stopPct),
    takeProfitPrice: avgCost * (1 + takeProfitPct),
  };
}

/**
 * Evaluate one OHLC bar against long-only brackets.
 * If both stop and TP would trigger in the same bar → stop first.
 */
export function evaluateBracketOnBar(
  bar: CandleBar,
  levels: BracketLevels,
): { hit: BracketHit; fillPrice: number } | null {
  const stopHit = bar.low <= levels.stopPrice;
  const tpHit = bar.high >= levels.takeProfitPrice;
  if (stopHit && tpHit) {
    return { hit: "stop", fillPrice: levels.stopPrice };
  }
  if (stopHit) return { hit: "stop", fillPrice: levels.stopPrice };
  if (tpHit) return { hit: "take_profit", fillPrice: levels.takeProfitPrice };
  return null;
}

/** Find first bracket hit on bars strictly after fromDate (exclusive). */
export function findBracketExit(
  candles: CandleBar[],
  fromDate: string,
  levels: BracketLevels,
): { hit: BracketHit; fillPrice: number; fillDate: string; signalDate: string } | null {
  const start = candles.findIndex((c) => c.date === fromDate);
  const from = start >= 0 ? start + 1 : 0;
  for (let i = from; i < candles.length; i++) {
    const bar = candles[i];
    const ev = evaluateBracketOnBar(bar, levels);
    if (ev) {
      return {
        hit: ev.hit,
        fillPrice: ev.fillPrice,
        fillDate: bar.date,
        signalDate: candles[i - 1]?.date ?? fromDate,
      };
    }
  }
  return null;
}

export function positionHasBrackets(p: PaperPosition): boolean {
  return (
    p.stopPct != null &&
    p.stopPct > 0 &&
    p.takeProfitPct != null &&
    p.takeProfitPct > 0
  );
}
