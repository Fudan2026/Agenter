/**
 * Pattern detector unit tests + no-lookahead cases (quant-no-lookahead).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OHLC } from "../ohlc/types";
import { detectAt, detectRecentPatterns } from "./detect";
import { ALL_PATTERN_IDS } from "./types";

function c(
  o: number,
  h: number,
  l: number,
  cl: number,
  day = 1,
): OHLC {
  return {
    date: new Date(`2026-03-${String(day).padStart(2, "0")}T15:00:00+08:00`),
    open: o,
    high: h,
    low: l,
    close: cl,
    volume: 1000,
  };
}

describe("pattern detectors", () => {
  it("detects bullish engulfing (body engulfs prior bearish body)", () => {
    const prev = c(12, 12.2, 10, 10.2, 1); // bearish
    const curr = c(10, 13, 9.8, 12.5, 2); // bullish engulfs
    const hits = detectAt([prev, curr], 1);
    assert.ok(hits.includes("bullish_engulfing"));
  });

  it("detects bearish engulfing", () => {
    const prev = c(10, 12, 9.8, 11.8, 1); // bullish
    const curr = c(12, 12.2, 9.5, 9.8, 2); // bearish engulfs
    const hits = detectAt([prev, curr], 1);
    assert.ok(hits.includes("bearish_engulfing"));
  });

  it("detects hammer", () => {
    // body 1, lower wick 3 (>=2x), upper wick 0.5 (<= body)
    const candle = c(10, 10.5, 6.5, 11, 1);
    const hits = detectAt([candle], 0);
    assert.ok(hits.includes("hammer"));
    assert.ok(!hits.includes("doji"));
  });

  it("detects shooting star", () => {
    // body 1, upper wick 3, lower wick 0.5
    const candle = c(10, 14, 9.5, 11, 1);
    const hits = detectAt([candle], 0);
    assert.ok(hits.includes("shooting_star"));
  });

  it("detects doji when body/range <= 0.1", () => {
    const candle = c(10, 11, 9, 10.05, 1);
    const hits = detectAt([candle], 0);
    assert.ok(hits.includes("doji"));
  });

  it("treats high===low as doji", () => {
    const candle = c(10, 10, 10, 10, 1);
    const hits = detectAt([candle], 0);
    assert.ok(hits.includes("doji"));
  });

  it("exports exactly five pattern ids", () => {
    assert.equal(ALL_PATTERN_IDS.length, 5);
  });
});

describe("no-lookahead", () => {
  it("pattern at bar t ignores future bars", () => {
    // At index 0: plain doji; future bar is a dramatic engulfing that must not leak back.
    const bar0 = c(10, 11, 9, 10.05, 1); // doji
    const future = c(8, 15, 7, 14, 2); // would engulf if used as "current" with bar0 as prev
    const series = [bar0, future];

    const at0 = detectAt(series, 0);
    assert.ok(at0.includes("doji"));
    assert.ok(!at0.includes("bullish_engulfing"));
    assert.ok(!at0.includes("bearish_engulfing"));

    // Mutating a future bar must not change detection at t=0
    const mutated = [
      bar0,
      c(1, 100, 0.5, 99, 2), // absurd future candle
    ];
    const at0Again = detectAt(mutated, 0);
    assert.deepEqual(at0Again, at0);
  });

  it("detectRecentPatterns only uses bars <= i for each hit", () => {
    const candles: OHLC[] = [];
    for (let d = 1; d <= 10; d++) {
      candles.push(c(10, 10.5, 9.5, 10.1, d)); // small range, near-doji-ish but body/range > 0.1
    }
    // Make day 5 a clear hammer using only that bar's OHLC
    candles[4] = c(10, 10.4, 7, 10.8, 5);

    const hits = detectRecentPatterns(candles, 60);
    const hammerHits = hits.filter((h) => h.patternId === "hammer");
    assert.ok(hammerHits.length >= 1);
    assert.equal(hammerHits[0].date, "2026-03-05");

    // Truncate after hammer bar — same hammer must still fire
    const truncated = candles.slice(0, 5);
    const hitsTrunc = detectRecentPatterns(truncated, 60);
    assert.ok(hitsTrunc.some((h) => h.patternId === "hammer" && h.date === "2026-03-05"));
  });

  it("2-bar pattern at i does not read candles[i+1]", () => {
    const prev = c(12, 12.2, 10, 10.2, 1);
    const curr = c(10, 13, 9.8, 12.5, 2);
    const after = c(20, 30, 19, 29, 3);
    const withFuture = [prev, curr, after];
    const withoutFuture = [prev, curr];
    assert.deepEqual(detectAt(withFuture, 1), detectAt(withoutFuture, 1));
  });
});
