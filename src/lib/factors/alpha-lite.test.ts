import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALPHA_LITE_IDS,
  buildAlphaLiteBoard,
  computeAlphaLiteFactors,
  type Candle,
} from "./alpha-lite";

function synth(n: number): Candle[] {
  const out: Candle[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    p *= 1 + (i % 7 === 0 ? -0.01 : 0.004);
    const open = p * 0.99;
    const close = p;
    const high = p * 1.01;
    const low = p * 0.98;
    out.push({ open, high, low, close, volume: 1e6 + i * 1000 });
  }
  return out;
}

describe("alpha-lite", () => {
  it("computes non-null core factors on long series", () => {
    const f = computeAlphaLiteFactors(synth(80));
    assert.ok(f.ROC20 != null);
    assert.ok(f.RSV20 != null);
    assert.ok(f.STD20 != null);
    assert.equal(Object.keys(f).length >= 30, true);
  });

  it("ALPHA_LITE_IDS length is in Alpha40-lite band", () => {
    assert.ok(ALPHA_LITE_IDS.length >= 30 && ALPHA_LITE_IDS.length <= 45);
  });

  it("buildAlphaLiteBoard ranks without lookahead crash", () => {
    const board = buildAlphaLiteBoard(
      [
        { symbol: "AAA", nameZh: "甲", nameEn: "A", candles: synth(90) },
        {
          symbol: "BBB",
          nameZh: "乙",
          nameEn: "B",
          candles: synth(90).map((c, i) =>
            i > 60 ? { ...c, close: c.close * 0.9, volume: c.volume * 0.5 } : c,
          ),
        },
        { symbol: "CCC", nameZh: "丙", nameEn: "C", candles: synth(90) },
      ],
      { reportDate: "2026-01-01", topN: 2 },
    );
    assert.equal(board.topN.length, 2);
    assert.ok(board.topN[0].rank === 1);
    assert.ok(board.factorIds.includes("ROC20"));
  });
});
