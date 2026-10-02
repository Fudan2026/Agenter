import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSchedule,
  sqrtImpactBps,
  twapSchedule,
  vwapSchedule,
} from "./execution";

describe("paper execution desk", () => {
  it("twap weights sum to ~1", () => {
    const s = twapSchedule(5);
    assert.equal(s.length, 5);
    const sum = s.reduce((a, x) => a + x.weight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(s.at(-1)!.cumFrac >= 0.999);
  });

  it("vwap U-shape puts more weight on ends", () => {
    const s = vwapSchedule(8);
    assert.equal(s.length, 8);
    const mid = s[3].weight + s[4].weight;
    const ends = s[0].weight + s[7].weight;
    assert.ok(ends > mid);
  });

  it("buildSchedule dispatches by algo", () => {
    assert.equal(buildSchedule("twap", 3)[0].label.startsWith("T"), true);
    assert.equal(buildSchedule("vwap", 3)[0].label.startsWith("V"), true);
  });

  it("sqrtImpactBps scales with participation", () => {
    const low = sqrtImpactBps(10_000, 1_000_000);
    const high = sqrtImpactBps(200_000, 1_000_000);
    assert.ok(high.impactBps > low.impactBps);
    assert.ok(Math.abs(low.participation - 0.01) < 1e-9);
  });
});
