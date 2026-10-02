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

  it("exports fifteen pattern ids including legacy five", () => {
    assert.equal(ALL_PATTERN_IDS.length, 15);
    for (const id of [
      "bullish_engulfing",
      "bearish_engulfing",
      "hammer",
      "shooting_star",
      "doji",
      "inverted_hammer",
      "spinning_top",
      "bullish_harami",
      "bearish_harami",
      "dark_cloud_cover",
    ]) {
      assert.ok(ALL_PATTERN_IDS.includes(id as (typeof ALL_PATTERN_IDS)[number]));
    }
  });
});

describe("additive patterns", () => {
  it("detects piercing line", () => {
    const prev = c(12, 12.2, 10, 10.2, 1); // bearish
    const curr = c(9.8, 11.5, 9.5, 11.2, 2); // bullish closes above mid
    const hits = detectAt([prev, curr], 1);
    assert.ok(hits.includes("piercing_line"));
  });

  it("detects three white soldiers", () => {
    const a = c(10, 10.8, 9.9, 10.6, 1);
    const b = c(10.4, 11.2, 10.3, 11.0, 2);
    const c3 = c(10.8, 11.6, 10.7, 11.4, 3);
    const hits = detectAt([a, b, c3], 2);
    assert.ok(hits.includes("three_white_soldiers"));
  });

  it("detects inverted hammer after downtrend", () => {
    const series = [
      c(12, 12.2, 11.8, 12.0, 1),
      c(11.8, 11.9, 11.4, 11.5, 2),
      c(11.4, 11.5, 11.0, 11.1, 3),
      c(11.0, 11.1, 10.6, 10.7, 4),
      c(10.6, 10.7, 10.2, 10.3, 5),
      // long upper wick, small body, short lower
      c(10.2, 13.2, 10.1, 10.8, 6),
    ];
    const hits = detectAt(series, 5);
    assert.ok(hits.includes("inverted_hammer"));
    assert.ok(!hits.includes("shooting_star"));
  });

  it("detects spinning top", () => {
    // body 1, upper 1.5, lower 1.5, range 4 → body/range 0.25
    const candle = c(10, 12.5, 8.5, 11, 1);
    const hits = detectAt([candle], 0);
    assert.ok(hits.includes("spinning_top"));
  });

  it("detects bullish and bearish harami", () => {
    const bearPrev = c(12, 12.3, 10, 10.2, 1);
    const bullCurr = c(10.5, 11.2, 10.4, 11.0, 2);
    assert.ok(detectAt([bearPrev, bullCurr], 1).includes("bullish_harami"));

    const bullPrev = c(10, 12.2, 9.8, 12.0, 1);
    const bearCurr = c(11.5, 11.8, 11.0, 11.2, 2);
    assert.ok(detectAt([bullPrev, bearCurr], 1).includes("bearish_harami"));
  });

  it("detects dark cloud cover", () => {
    const prev = c(10, 12.2, 9.8, 12.0, 1); // bullish
    const curr = c(12.3, 12.5, 10.5, 10.8, 2); // opens above close, closes below mid
    const hits = detectAt([prev, curr], 1);
    assert.ok(hits.includes("dark_cloud_cover"));
  });

  it("3-bar pattern at i ignores future bars", () => {
    const a = c(12, 12.5, 11.5, 11.6, 1); // bearish start for morning star
    const b = c(11.5, 11.7, 11.2, 11.4, 2); // small
    const c3 = c(11.5, 12.8, 11.4, 12.5, 3); // bullish
    const future = c(1, 2, 0.5, 1.5, 4);
    assert.deepEqual(detectAt([a, b, c3, future], 2), detectAt([a, b, c3], 2));
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
