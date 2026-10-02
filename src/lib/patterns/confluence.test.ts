import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  patternConfluenceAbs,
  patternConfluenceScore,
} from "./confluence";
import type { PatternHit } from "./types";

function hit(
  direction: PatternHit["direction"],
  date: string,
  patternId: PatternHit["patternId"] = "hammer",
): PatternHit {
  return { patternId, date, direction };
}

describe("pattern confluence", () => {
  it("scores bull hits positive and caps abs at 100", () => {
    const hits = Array.from({ length: 20 }, (_, i) =>
      hit("bull", `2026-01-${String(i + 1).padStart(2, "0")}`),
    );
    const score = patternConfluenceScore(hits);
    assert.ok(score > 0);
    assert.ok(score <= 100);
    assert.equal(patternConfluenceAbs(hits), Math.abs(score));
  });

  it("scores bear hits negative", () => {
    const hits = [
      hit("bear", "2026-01-01", "shooting_star"),
      hit("bear", "2026-01-02", "evening_star"),
      hit("neutral", "2026-01-03", "doji"),
    ];
    assert.ok(patternConfluenceScore(hits) < 0);
  });

  it("returns 0 for empty window", () => {
    assert.equal(patternConfluenceScore([]), 0);
    assert.equal(patternConfluenceAbs([]), 0);
  });
});
