import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCnTradingDay, nextSession, sessionAgenda } from "./calendar";
import type { SymbolRow } from "../../pages/types";

describe("CN calendar", () => {
  it("weekends are not trading days", () => {
    assert.equal(isCnTradingDay("2026-03-07"), false);
    assert.equal(isCnTradingDay("2026-03-08"), false);
  });

  it("weekday non-holiday is trading", () => {
    assert.equal(isCnTradingDay("2026-03-09"), true);
  });

  it("nextSession skips weekend", () => {
    assert.equal(nextSession("2026-03-07"), "2026-03-09");
  });
});

describe("sessionAgenda", () => {
  it("bull high confluence suggests buy", () => {
    const row: SymbolRow = {
      symbol: "600519.SS",
      nameZh: "x",
      nameEn: "x",
      group: "china-ashare",
      dataStatus: "live",
      dataNote: "",
      lastClose: 1,
      pct1d: 0,
      sparkCloses: [1],
      candles: [{ date: "2026-03-01", open: 1, high: 1, low: 1, close: 1, volume: 1 }],
      recentPatterns: [],
      signals: {
        sma20: 1,
        sma60: 1,
        rsi14: 25,
        rsiZone: "oversold",
        maAlign: "bull",
        volumeSpike: true,
        bias: "bull",
        tags: [],
      },
    };
    const agenda = sessionAgenda("2026-03-09", [row]);
    assert.equal(agenda[0].sideHint, "buy");
    assert.equal(agenda[0].fillRule, "next_open");
  });
});
