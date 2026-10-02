import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_COST_CONFIG,
  computeTradeCosts,
  isLimitLocked,
  priceLimitPct,
} from "./costs";

describe("A-share cost model", () => {
  it("buy has no stamp; commission at least min", () => {
    const c = computeTradeCosts({
      side: "buy",
      notional: 100_000,
      symbol: "600519.SS",
      cfg: DEFAULT_COST_CONFIG,
    });
    assert.equal(c.stampDuty, 0);
    assert.ok(c.commission >= 5);
    assert.ok(c.total > c.commission);
  });

  it("sell charges 5 bps stamp on 100k", () => {
    const c = computeTradeCosts({
      side: "sell",
      notional: 100_000,
      symbol: "600519.SS",
      cfg: DEFAULT_COST_CONFIG,
    });
    assert.equal(c.stampDuty, 50);
  });

  it("limit bands by board", () => {
    assert.equal(priceLimitPct("300750.SZ"), 0.2);
    assert.equal(priceLimitPct("600519.SS"), 0.1);
    assert.equal(priceLimitPct("510300.SS"), null);
  });

  it("detects limit-up buy lock", () => {
    assert.equal(
      isLimitLocked({
        symbol: "600519.SS",
        side: "buy",
        prevClose: 100,
        fillPrice: 110,
      }),
      true,
    );
  });

  it("disabled config returns zeros", () => {
    const c = computeTradeCosts({
      side: "sell",
      notional: 100_000,
      symbol: "600519.SS",
      cfg: { ...DEFAULT_COST_CONFIG, enabled: false },
    });
    assert.equal(c.total, 0);
  });
});
