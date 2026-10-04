import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLabStrategyId, normalizeE2eRecipe } from "./e2e-recipe";

describe("e2e-recipe", () => {
  it("accepts known lab ids", () => {
    assert.equal(isLabStrategyId("ma_cross"), true);
    assert.equal(isLabStrategyId("nope"), false);
  });

  it("normalizes invalid lab to ma_cross with deep links", () => {
    const r = normalizeE2eRecipe({
      lab_id: "unknown",
      symbols: ["600519.SS"],
    });
    assert.equal(r.lab_id, "ma_cross");
    assert.equal(r.valid, false);
    assert.ok(r.deep_links.some((d) => d.includes("lab=ma_cross")));
    assert.ok(r.deep_links.some((d) => d.includes("paper")));
  });
});
