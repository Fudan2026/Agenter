import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canPlaceReplayOrder,
  replayFillIndex,
  visibleCandles,
} from "./engine";

describe("replay engine", () => {
  const candles = [
    { date: "2026-01-01", open: 1 },
    { date: "2026-01-02", open: 2 },
    { date: "2026-01-03", open: 3 },
  ];

  it("cannot see candle i+1 when asOf is candle i date", () => {
    const vis = visibleCandles(candles, "2026-01-02");
    assert.equal(vis.length, 2);
    assert.equal(vis.at(-1)?.date, "2026-01-02");
  });

  it("fill index is next session after asOf", () => {
    assert.equal(replayFillIndex(candles, "2026-01-01"), 1);
    assert.equal(replayFillIndex(candles, "2026-01-03"), null);
  });

  it("order only when signal on or before asOf", () => {
    assert.equal(canPlaceReplayOrder("2026-01-02", "2026-01-02"), true);
    assert.equal(canPlaceReplayOrder("2026-01-03", "2026-01-02"), false);
  });
});
