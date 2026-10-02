/**
 * MTM equity + next_open signal-date tests (quant-no-lookahead).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBuy,
  defaultPaperState,
  resolveNextOpenFill,
} from "./engine";
import { buildMarkToMarketSeries, defaultSignalDate } from "./equity";
import type { PaperState } from "./types";

const candles = [
  { date: "2026-03-01", open: 10, high: 11, low: 9.5, close: 10.5, volume: 1 },
  { date: "2026-03-02", open: 10.6, high: 11.2, low: 10.4, close: 11.0, volume: 1 },
  { date: "2026-03-03", open: 11.1, high: 12.0, low: 11.0, close: 11.8, volume: 1 },
  { date: "2026-03-04", open: 11.7, high: 12.5, low: 11.5, close: 12.2, volume: 1 },
];

describe("signal date defaults", () => {
  it("defaults to penultimate bar when next session exists", () => {
    assert.equal(defaultSignalDate(candles), "2026-03-03");
    const fill = resolveNextOpenFill(candles, "2026-03-03");
    assert.ok(fill);
    assert.equal(fill!.fillRule, "next_open");
    assert.equal(fill!.fillDate, "2026-03-04");
    assert.equal(fill!.fillPrice, 11.7);
  });
});

describe("mark-to-market equity series", () => {
  it("produces multi-day moving equity while holding", () => {
    let state = defaultPaperState();
    const fill = resolveNextOpenFill(candles, "2026-03-01");
    assert.ok(fill);
    assert.equal(fill!.fillRule, "next_open");
    const bought = applyBuy(state, {
      symbol: "600519.SS",
      qty: 1000,
      fill: fill!,
    });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    state = bought.state;

    const { points } = buildMarkToMarketSeries(state, {
      "600519.SS": candles,
    });
    assert.ok(points.length >= 3, `expected ≥3 points, got ${points.length}`);
    const times = new Set(points.map((p) => p.time));
    assert.ok(times.size >= 2, "need distinct session dates");
    // After buy at 3/02 open 10.6, MTM should rise as close goes 11 → 11.8 → 12.2
    const afterFill = points.filter((p) => p.time >= fill!.fillDate);
    assert.ok(afterFill.length >= 2);
    const first = afterFill[0].equity;
    const last = afterFill[afterFill.length - 1].equity;
    assert.ok(last > first, `MTM should rise: ${first} → ${last}`);
  });

  it("empty journal still returns ≥2 chart points", () => {
    const state: PaperState = defaultPaperState();
    const { points } = buildMarkToMarketSeries(state, { "X": candles });
    assert.ok(points.length >= 2);
  });
});
