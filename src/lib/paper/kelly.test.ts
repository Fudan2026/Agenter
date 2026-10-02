import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { suggestHalfKelly } from "./kelly";

describe("half-Kelly", () => {
  it("zero edge yields zero qty", () => {
    const s = suggestHalfKelly({
      winRate: 0.5,
      avgWin: 1,
      avgLoss: 1,
      equity: 100_000_000,
      price: 100,
    });
    assert.equal(s.fStar, 0);
    assert.equal(s.qtyLots, 0);
  });

  it("strong edge yields lots clamped to 20%", () => {
    const s = suggestHalfKelly({
      winRate: 0.6,
      avgWin: 2,
      avgLoss: 1,
      equity: 100_000_000,
      price: 100,
    });
    assert.ok(s.fStar > 0);
    assert.ok(s.qtyLots > 0);
    assert.equal(s.qtyLots % 100, 0);
    assert.ok(s.qtyLots * 100 <= 100_000_000 * 0.2 + 1);
  });
});
