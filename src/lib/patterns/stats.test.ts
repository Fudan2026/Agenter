import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OHLC } from "../ohlc/types";
import {
  computePatternStats,
  patternWithinWinBand,
  PATTERN_STAT_HORIZONS,
  type HorizonStat,
} from "./stats";

function c(
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
): OHLC {
  return {
    date: new Date(`${date}T15:00:00+08:00`),
    open,
    high,
    low,
    close,
    volume: 1_000_000,
  };
}

/** Build a long synthetic series with a clear bullish engulfing at a known index. */
function syntheticSeries(): OHLC[] {
  const out: OHLC[] = [];
  let close = 100;
  // flat preamble
  for (let i = 0; i < 30; i++) {
    const d = `2020-01-${String(i + 1).padStart(2, "0")}`;
    // skip invalid calendar days by using sequential ISO via Date math
    const base = new Date(Date.UTC(2020, 0, 2 + i));
    const key = base.toISOString().slice(0, 10);
    out.push(c(key, close, close + 1, close - 1, close));
  }
  // bearish bar then bullish engulfing
  const d0 = new Date(Date.UTC(2020, 1, 3));
  const d1 = new Date(Date.UTC(2020, 1, 4));
  out.push(
    c(d0.toISOString().slice(0, 10), 100, 101, 90, 91), // bearish
  );
  out.push(
    c(d1.toISOString().slice(0, 10), 90, 110, 89, 108), // bullish engulfing
  );
  // forward path: rise then settle — positive 5d edge
  close = 108;
  for (let i = 0; i < 40; i++) {
    close += i < 10 ? 1 : 0.1;
    const base = new Date(Date.UTC(2020, 1, 5 + i));
    const key = base.toISOString().slice(0, 10);
    out.push(c(key, close - 0.5, close + 1, close - 1, close));
  }
  return out;
}

describe("patterns/stats", () => {
  it("emits all horizons with no lookahead (count uses fwd bars)", () => {
    const candles = syntheticSeries();
    const stats = computePatternStats("TEST", candles);
    assert.equal(stats.symbol, "TEST");
    assert.ok(stats.nBars === candles.length);
    assert.ok(stats.sampleYears > 0);
    const engulf = stats.patterns.find((p) => p.patternId === "bullish_engulfing");
    assert.ok(engulf);
    for (const h of PATTERN_STAT_HORIZONS) {
      const row: HorizonStat | undefined = engulf!.horizons.find(
        (x) => x.horizon === h,
      );
      assert.ok(row);
      assert.equal(row.horizon, h);
      assert.ok(row.count >= 0);
    }
    // At least one engulfing with measurable 5d return in this series
    const h5 = engulf!.horizons.find((x) => x.horizon === 5)!;
    assert.ok(h5.count >= 1);
    assert.ok(h5.winRate != null && h5.winRate > 0);
  });

  it("patternWithinWinBand respects 60–80 band", () => {
    assert.equal(patternWithinWinBand(0.7, 60, 80), true);
    assert.equal(patternWithinWinBand(0.5, 60, 80), false);
    assert.equal(patternWithinWinBand(0.9, 60, 80), false);
    assert.equal(patternWithinWinBand(null, 60, 80), false);
  });
});
