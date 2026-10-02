import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCorrMatrix, logReturns, pearsonCorr } from "./corr";

describe("corr stats", () => {
  it("pearsonCorr is ~1 for identical series", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const c = pearsonCorr(a, a);
    assert.ok(c != null && c > 0.99);
  });

  it("pearsonCorr is ~-1 for inverted series", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const b = a.map((x) => -x);
    const c = pearsonCorr(a, b);
    assert.ok(c != null && c < -0.99);
  });

  it("logReturns length is n-1", () => {
    assert.equal(logReturns([100, 110, 121]).length, 2);
  });

  it("buildCorrMatrix emits unique pairs", () => {
    const series = [
      { id: "A", closes: Array.from({ length: 40 }, (_, i) => 100 + i) },
      { id: "B", closes: Array.from({ length: 40 }, (_, i) => 100 - i * 0.5) },
      { id: "C", closes: Array.from({ length: 40 }, (_, i) => 50 + Math.sin(i)) },
    ];
    const pairs = buildCorrMatrix(series);
    assert.equal(pairs.length, 3);
    assert.ok(pairs.every((p) => p.a !== p.b));
  });
});
