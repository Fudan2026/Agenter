import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  candlesToBars,
  resampleBars,
  sampleYearsFromBars,
  type CandleBar,
} from "./resample";

function bar(date: string, close: number): CandleBar {
  return {
    date,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  };
}

describe("ohlc/resample", () => {
  it("sampleYearsFromBars uses ~252 sessions", () => {
    assert.equal(sampleYearsFromBars(252), 1);
    assert.equal(sampleYearsFromBars(2520), 10);
    assert.equal(sampleYearsFromBars(0), 0);
  });

  it("weekly aggregate collapses Mon–Fri into one bar", () => {
    const daily = [
      bar("2024-01-02", 10), // Tue
      bar("2024-01-03", 11),
      bar("2024-01-04", 12),
      bar("2024-01-05", 13),
      bar("2024-01-08", 14), // next week Mon
      bar("2024-01-09", 15),
    ];
    const weekly = resampleBars(daily, "W");
    assert.ok(weekly.length >= 2);
    assert.equal(weekly[0].open, 10);
    assert.equal(weekly[0].close, 13);
    assert.equal(weekly[0].high, 14); // 13+1
    assert.equal(weekly[1].open, 14);
  });

  it("monthly aggregate groups by YYYY-MM", () => {
    const daily = [
      bar("2024-01-15", 10),
      bar("2024-01-31", 12),
      bar("2024-02-01", 13),
      bar("2024-02-28", 14),
    ];
    const monthly = resampleBars(daily, "M");
    assert.equal(monthly.length, 2);
    assert.equal(monthly[0].open, 10);
    assert.equal(monthly[0].close, 12);
    assert.equal(monthly[1].open, 13);
    assert.equal(monthly[1].close, 14);
  });

  it("candlesToBars maps Date objects", () => {
    const bars = candlesToBars([
      {
        date: new Date("2024-06-01T15:00:00+08:00"),
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 9,
      },
    ]);
    assert.equal(bars[0].date, "2024-06-01");
    assert.equal(bars[0].close, 1.5);
  });
});
