import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runBacktest } from "./engine";

function synthCandles(n: number): Array<{
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const out = [];
  let px = 100;
  for (let i = 0; i < n; i++) {
    const day = 1 + (i % 28);
    const month = 1 + Math.floor(i / 28);
    const open = px;
    const close = px * (1 + (i % 7 === 0 ? -0.02 : 0.01));
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    out.push({
      date: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      open,
      high,
      low,
      close,
      volume: 1_000_000,
    });
    px = close;
  }
  return out;
}

describe("backtest no-lookahead", () => {
  it("fills only at next open and never same-bar close", () => {
    const candles = synthCandles(80);
    const res = runBacktest({
      strategyId: "ma_cross",
      symbol: "TEST.SS",
      candles,
      startCash: 1_000_000,
      positionPct: 0.2,
    });
    for (const t of res.trades) {
      assert.equal(t.fillRule, "next_open");
      const sigIdx = candles.findIndex((c) => c.date === t.signalDate);
      const fillIdx = candles.findIndex((c) => c.date === t.fillDate);
      assert.ok(sigIdx >= 0 && fillIdx === sigIdx + 1);
      assert.equal(t.fillPrice, candles[fillIdx].open);
    }
    assert.ok(res.equity.length >= 2);
    assert.ok(["green", "yellow", "red"].includes(res.metrics.verdict));
  });
});
