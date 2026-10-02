import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFactorBoard } from "./cross-section";

function synth(seed: number, n = 80): Array<{ close: number; volume: number }> {
  const out: Array<{ close: number; volume: number }> = [];
  let p = 10 + seed;
  for (let i = 0; i < n; i++) {
    p *= 1 + (seed * 0.001 + ((i + seed) % 5) * 0.002 - 0.004);
    out.push({ close: p, volume: 1_000_000 * (1 + seed * 0.2) });
  }
  return out;
}

describe("factor board", () => {
  it("ranks symbols by composite OHLC proxies", () => {
    const rows = [0, 1, 2, 3, 4].map((i) => ({
      symbol: `S${i}.SS`,
      nameZh: `名${i}`,
      nameEn: `N${i}`,
      group: "china-ashare",
      candles: synth(i),
    }));
    const board = buildFactorBoard(rows, { topN: 3, reportDate: "2026-10-02" });
    assert.equal(board.factors.length, 5);
    assert.ok(board.factors[0].rank === 1);
    assert.ok(board.factors.every((f) => f.composite != null));
    assert.ok(board.adfStrip.length > 0);
  });
});
