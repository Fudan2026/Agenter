import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateTimingForEtf, buildTimingBoard, scoreFromHits } from "./aggregate";

describe("timing/aggregate", () => {
  it("scoreFromHits is bullish when bulls dominate", () => {
    assert.ok(scoreFromHits(8, 2, 0) > 0);
    assert.ok(scoreFromHits(1, 9, 0) < 0);
    assert.equal(scoreFromHits(0, 0, 0), 0);
  });

  it("aggregateTimingForEtf counts proxy constituents", () => {
    const by = new Map([
      [
        "A",
        {
          symbol: "A",
          recentPatterns: [
            { patternId: "hammer" as const, date: "2024-01-01", direction: "bull" as const },
            { patternId: "hammer" as const, date: "2024-01-02", direction: "bull" as const },
          ],
        },
      ],
      [
        "B",
        {
          symbol: "B",
          recentPatterns: [
            {
              patternId: "shooting_star" as const,
              date: "2024-01-01",
              direction: "bear" as const,
            },
          ],
        },
      ],
    ]);
    const row = aggregateTimingForEtf(
      "ETF",
      {
        indexSymbol: "IDX",
        sectorTags: ["x"],
        proxyConstituents: ["A", "B", "MISSING"],
      },
      by,
    );
    assert.equal(row.constituentCount, 2);
    assert.equal(row.constituentsWithHits, 2);
    assert.ok(row.bullHits >= 2);
    assert.ok(row.bearHits >= 1);
  });

  it("buildTimingBoard sorts by score desc", () => {
    const board = buildTimingBoard(
      {
        E1: {
          indexSymbol: "I1",
          sectorTags: [],
          proxyConstituents: ["A"],
        },
        E2: {
          indexSymbol: "I2",
          sectorTags: [],
          proxyConstituents: ["B"],
        },
      },
      [
        {
          symbol: "A",
          recentPatterns: [
            { patternId: "hammer", date: "d", direction: "bull" },
            { patternId: "hammer", date: "d2", direction: "bull" },
          ],
        },
        {
          symbol: "B",
          recentPatterns: [
            { patternId: "shooting_star", date: "d", direction: "bear" },
          ],
        },
      ],
    );
    assert.equal(board[0].symbol, "E1");
  });
});
