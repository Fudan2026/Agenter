import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { icSummary, quantileReturns, spearmanIC } from "./ic";

describe("spearmanIC", () => {
  it("perfect positive monotonic", () => {
    const f = [1, 2, 3, 4, 5];
    const r = [0.1, 0.2, 0.3, 0.4, 0.5];
    const ic = spearmanIC(f, r);
    assert.ok(ic != null && ic > 0.99);
  });
});

describe("quantileReturns", () => {
  it("top quantile beats bottom when factor sorts returns", () => {
    const f = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const r = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1];
    const qs = quantileReturns(f, r, 2);
    assert.ok(qs[1].meanRet > qs[0].meanRet);
  });
});

describe("icSummary", () => {
  it("returns one row per horizon", () => {
    const pairs = [
      { date: "2026-01-01", factor: 1, fwdRet: 0.1 },
      { date: "2026-01-01", factor: 2, fwdRet: 0.2 },
      { date: "2026-01-02", factor: 1, fwdRet: 0.05 },
      { date: "2026-01-02", factor: 3, fwdRet: 0.25 },
    ];
    const sum = icSummary(pairs, [5, 10]);
    assert.equal(sum.length, 2);
    assert.ok(Math.abs(sum[0].ic) <= 1);
  });
});
