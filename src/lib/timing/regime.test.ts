import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyRegime } from "./regime";

function linTrend(start: number, step: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step);
}

describe("classifyRegime", () => {
  it("uptrend scores trend_up", () => {
    const closes = linTrend(100, 0.5, 120);
    const r = classifyRegime(closes);
    assert.equal(r.label, "trend_up");
    assert.ok(r.timingScore >= 0 && r.timingScore <= 100);
  });

  it("downtrend scores trend_down", () => {
    const closes = linTrend(200, -0.6, 120);
    const r = classifyRegime(closes);
    assert.equal(r.label, "trend_down");
  });

  it("flat series tends chop", () => {
    const closes = Array(120).fill(100);
    const r = classifyRegime(closes);
    assert.equal(r.label, "chop");
  });
});
