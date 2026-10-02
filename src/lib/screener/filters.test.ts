import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyScreenerFilters, sortScreener } from "./filters";
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

describe("screener filters", () => {
  it("confluenceMin 70 returns subset", () => {
    const high = stub({
      symbol: "HIGH",
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
        { patternId: "hammer", date: "2026-01-01", direction: "bull" },
        { patternId: "hammer", date: "2026-01-02", direction: "bull" },
      ],
    });
    const low = stub({
      symbol: "LOW",
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
    const rows = [high, low];
    const out = applyScreenerFilters(rows, { confluenceMin: 70 });
    assert.equal(out.length, 1);
    assert.equal(out[0].symbol, "HIGH");
  });

  it("sorts by confluence desc", () => {
    const a = stub({
      symbol: "A",
      signals: {
        sma20: 1,
        sma60: 1,
        rsi14: 50,
        rsiZone: "normal",
        maAlign: "mixed",
        volumeSpike: false,
        bias: "neutral",
        tags: [],
      },
    });
    const b = stub({
      symbol: "B",
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
    });
    const sorted = sortScreener([a, b], "confluence", "desc");
    assert.equal(sorted[0].symbol, "B");
  });
});
