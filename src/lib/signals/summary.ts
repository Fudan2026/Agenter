/**
 * Compact signal summary for bake + Quant board (OpenCool analyzeTicker distill).
 * Uses only bars ≤ latest — no lookahead.
 */

import {
  computeSymbolIndicators,
  type MaAlignment,
  type RsiZone,
} from "../indicators/core";
import type { OHLC } from "../ohlc/types";
import type { PatternHit } from "../patterns/types";

export interface SignalSummary {
  sma20: number | null;
  sma60: number | null;
  rsi14: number | null;
  rsiZone: RsiZone;
  maAlign: MaAlignment;
  volumeSpike: boolean;
  /** Human checklist bias for next open (educational). */
  bias: "bull" | "bear" | "neutral";
  tags: string[];
}

export function summarizeSignals(
  candles: OHLC[],
  recentPatterns: PatternHit[],
): SignalSummary {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const ind = computeSymbolIndicators(closes, volumes);
  const tags: string[] = [];
  if (ind.maAlign === "bull") tags.push("ma_bull");
  if (ind.maAlign === "bear") tags.push("ma_bear");
  if (ind.rsiZone === "oversold") tags.push("rsi_oversold");
  if (ind.rsiZone === "overbought") tags.push("rsi_overbought");
  if (ind.volumeSpike) tags.push("volume_spike");

  const recentBull = recentPatterns
    .slice(-5)
    .filter((p) => p.direction === "bull").length;
  const recentBear = recentPatterns
    .slice(-5)
    .filter((p) => p.direction === "bear").length;
  if (recentBull > recentBear) tags.push("pattern_bull");
  if (recentBear > recentBull) tags.push("pattern_bear");

  let bias: "bull" | "bear" | "neutral" = "neutral";
  const bullScore =
    (ind.maAlign === "bull" ? 1 : 0) +
    (ind.rsiZone === "oversold" ? 1 : 0) +
    (recentBull > recentBear ? 1 : 0);
  const bearScore =
    (ind.maAlign === "bear" ? 1 : 0) +
    (ind.rsiZone === "overbought" ? 1 : 0) +
    (recentBear > recentBull ? 1 : 0);
  if (bullScore >= 2 && bullScore > bearScore) bias = "bull";
  else if (bearScore >= 2 && bearScore > bullScore) bias = "bear";

  return {
    sma20: ind.sma20,
    sma60: ind.sma60,
    rsi14: ind.rsi14,
    rsiZone: ind.rsiZone,
    maAlign: ind.maAlign,
    volumeSpike: ind.volumeSpike,
    bias,
    tags,
  };
}

/** Series for chart overlays (aligned to candle dates). */
export function indicatorSeries(candles: OHLC[]): {
  sma20: Array<{ date: string; value: number }>;
  sma60: Array<{ date: string; value: number }>;
} {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const ind = computeSymbolIndicators(closes, volumes);
  const sma20: Array<{ date: string; value: number }> = [];
  const sma60: Array<{ date: string; value: number }> = [];
  for (let i = 0; i < candles.length; i++) {
    const d = candles[i].date.toLocaleDateString("en-CA", {
      timeZone: "Asia/Shanghai",
    });
    const v20 = ind.sma20Series[i];
    const v60 = ind.sma60Series[i];
    if (v20 != null) sma20.push({ date: d, value: v20 });
    if (v60 != null) sma60.push({ date: d, value: v60 });
  }
  return { sma20, sma60 };
}
