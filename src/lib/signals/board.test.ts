import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { confluenceScore, patternHeatmap } from "./board";
import type { SymbolRow } from "../../pages/types";

function stub(partial: Partial<SymbolRow> & Pick<SymbolRow, "symbol">): SymbolRow {
  return {
    nameZh: "t",
    nameEn: "t",
    group: "china-ashare",
    dataStatus: "live",
    dataNote: "",
    lastClose: 10,
    pct1d: 0,
    sparkCloses: [10],
    candles: [],
    recentPatterns: [],
    ...partial,
  };
}

describe("confluence score", () => {
  it("scores bull + MA + oversold higher than neutral", () => {
    const bull = stub({
      symbol: "A",
      signals: {
        sma20: 1,
        sma60: 1,
        rsi14: 28,
        rsiZone: "oversold",
        maAlign: "bull",
        volumeSpike: true,
        bias: "bull",
        tags: [],
      },
      recentPatterns: [
        {
          patternId: "hammer",
          date: "2026-01-01",
          direction: "bull",
        },
      ],
    });
    const flat = stub({
      symbol: "B",
      signals: {
        sma20: null,
        sma60: null,
        rsi14: 50,
        rsiZone: "normal",
        maAlign: "unknown",
        volumeSpike: false,
        bias: "neutral",
        tags: [],
      },
    });
    assert.ok(confluenceScore(bull) > confluenceScore(flat));
    assert.ok(confluenceScore(bull) <= 100);
  });
});

describe("pattern heatmap", () => {
  it("counts pattern hits per symbol", () => {
    const rows = [
      stub({
        symbol: "X",
        recentPatterns: [
          { patternId: "doji", date: "a", direction: "neutral" },
          { patternId: "doji", date: "b", direction: "neutral" },
        ],
      }),
      stub({ symbol: "Y", recentPatterns: [] }),
    ];
    const heat = patternHeatmap(rows);
    const doji = heat.find((h) => h.patternId === "doji");
    assert.ok(doji);
    assert.equal(doji!.counts.X, 2);
    assert.equal(doji!.counts.Y, 0);
  });
});
