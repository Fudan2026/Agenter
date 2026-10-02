import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { constructWeights } from "./construct";

function sum(w: Record<string, number>): number {
  return Object.values(w).reduce((a, b) => a + b, 0);
}

describe("constructWeights", () => {
  const items = [
    { symbol: "A", score: 80, vol: 0.2 },
    { symbol: "B", score: 40, vol: 0.1 },
    { symbol: "C", score: 60, vol: 0.4 },
  ];

  it("equal sums to 1", () => {
    const w = constructWeights(items, "equal");
    assert.ok(Math.abs(sum(w) - 1) < 1e-9);
  });

  it("score favors higher score", () => {
    const w = constructWeights(items, "score");
    assert.ok(w.A > w.B);
    assert.ok(Math.abs(sum(w) - 1) < 1e-9);
  });

  it("inv_vol favors lower vol", () => {
    const w = constructWeights(items, "inv_vol");
    assert.ok(w.B > w.A);
    assert.ok(Math.abs(sum(w) - 1) < 1e-9);
  });
});
