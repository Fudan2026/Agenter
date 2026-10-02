import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSchedule,
  splitQtyBySchedule,
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

  it("splitQtyBySchedule lot-rounds and conserves parent qty", () => {
    const sched = twapSchedule(4);
    const children = splitQtyBySchedule(10_000, sched, 100);
    assert.ok(children.length >= 1);
    const sum = children.reduce((a, c) => a + c.qty, 0);
    assert.equal(sum, 10_000);
    for (const c of children) {
      assert.equal(c.qty % 100, 0);
      assert.ok(c.label);
    }
  });

  it("splitQtyBySchedule last slice absorbs remainder", () => {
    const sched = vwapSchedule(5);
    const children = splitQtyBySchedule(1_050, sched, 100);
    const sum = children.reduce((a, c) => a + c.qty, 0);
    // Last child may include non-lot remainder so parent qty is conserved.
    assert.equal(sum, 1_050);
    assert.ok(children.length >= 1);
    assert.ok(children.every((c) => c.qty > 0 && c.label));
  });
});
