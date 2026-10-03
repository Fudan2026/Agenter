import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareRotationModes, runRotation } from "./rotation";

function rising(n: number, start = 100, step = 1): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step);
}

function falling(n: number, start = 100, step = 1): number[] {
  return Array.from({ length: n }, (_, i) => start - i * step);
}

describe("etf/rotation", () => {
  it("fixed_5d rebalances less often than daily", () => {
    const etfs = [
      {
        symbol: "UP",
        nameZh: "涨",
        nameEn: "Up",
        closes: rising(60),
        patternMomentum: 2,
      },
      {
        symbol: "DN",
        nameZh: "跌",
        nameEn: "Down",
        closes: falling(60),
        patternMomentum: -2,
      },
      {
        symbol: "FLAT",
        nameZh: "平",
        nameEn: "Flat",
        closes: Array.from({ length: 60 }, () => 100),
      },
    ];
    const daily = runRotation(etfs, { mode: "daily", topK: 1, horizon: 60 });
    const fixed = runRotation(etfs, {
      mode: "fixed_5d",
      topK: 1,
      horizon: 60,
    });
    assert.ok(daily.turns >= fixed.turns);
    assert.ok(daily.totalReturn > 0);
  });

  it("timing overlay can zero weights when scores low", () => {
    const etfs = [
      {
        symbol: "A",
        nameZh: "A",
        nameEn: "A",
        closes: rising(40),
        timingScore: -50,
      },
      {
        symbol: "B",
        nameZh: "B",
        nameEn: "B",
        closes: rising(40, 100, 0.5),
        timingScore: -40,
      },
    ];
    const r = runRotation(etfs, {
      mode: "daily",
      timingOverlay: true,
      timingThreshold: 0,
      topK: 2,
      horizon: 40,
    });
    assert.deepEqual(r.lastWeights, {});
  });

  it("compareRotationModes returns four modes", () => {
    const etfs = [
      {
        symbol: "A",
        nameZh: "A",
        nameEn: "A",
        closes: rising(50),
        timingScore: 20,
      },
      {
        symbol: "B",
        nameZh: "B",
        nameEn: "B",
        closes: falling(50),
        timingScore: -10,
      },
    ];
    const c = compareRotationModes(etfs, { horizon: 50, topK: 1 });
    assert.equal(c.daily.mode, "daily");
    assert.equal(c.fixed_5d.mode, "fixed_5d");
    assert.equal(c.dailyTimed.timingOverlay, true);
    assert.equal(c.fixed_5dTimed.timingOverlay, true);
  });
});
