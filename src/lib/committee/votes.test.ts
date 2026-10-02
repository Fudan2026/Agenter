import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FactorScores } from "../factors/cross-section";
import type { SymbolRow } from "../../pages/types";
import {
  rankCommittee,
  ROLE_LABELS,
  voteForSymbol,
} from "./votes";

function fakeRow(symbol: string, bias: "bull" | "bear" | "neutral"): SymbolRow {
  return {
    symbol,
    nameZh: `名${symbol}`,
    nameEn: `Name${symbol}`,
    group: "china-ashare",
    dataStatus: "live",
    dataNote: "",
    lastClose: 10,
    pct1d: 0.5,
    sparkCloses: [9, 10],
    candles: [],
    recentPatterns: [],
    signals: {
      bias,
      rsi14: 45,
      rsiZone: "normal",
      sma20: 10,
      sma60: 9,
      maAlign: bias === "bull" ? "bull" : bias === "bear" ? "bear" : "mixed",
      volumeSpike: false,
      tags: [],
    },
  };
}

function factor(symbol: string, quality: number): FactorScores {
  return {
    symbol,
    nameZh: symbol,
    nameEn: symbol,
    momentum: 0.2,
    lowVol: 0.1,
    sizeAdv: 0.3,
    quality,
    peProxy: 0.1,
    pbProxy: 0.1,
    composite: quality,
    rank: 1,
  };
}

describe("committee votes", () => {
  it("voteForSymbol returns six roles and consensus", () => {
    const r = voteForSymbol(fakeRow("600519.SS", "bull"), {
      factor: factor("600519.SS", 1),
      announcements: [],
      news: [],
    });
    assert.equal(r.votes.length, 6);
    assert.ok(Number.isFinite(r.consensus));
    assert.ok(["bull", "bear", "neutral"].includes(r.bias));
    for (const v of r.votes) {
      assert.ok(ROLE_LABELS[v.role]);
      assert.ok(v.score >= -1 && v.score <= 1);
    }
  });

  it("rankCommittee sorts by consensus and caps topN", () => {
    const rows = [
      fakeRow("A", "bear"),
      fakeRow("B", "bull"),
      fakeRow("C", "neutral"),
    ];
    const ranked = rankCommittee(
      rows,
      {
        factors: [
          factor("A", -1),
          factor("B", 1.5),
          factor("C", 0),
        ],
      },
      2,
    );
    assert.equal(ranked.length, 2);
    assert.ok(ranked[0].consensus >= ranked[1].consensus);
  });
});
