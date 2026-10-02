import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExpandingFolds,
  foldHasNoLeakage,
  DEFAULT_WF_CONFIG,
} from "./walkforward";

describe("purged embargo walk-forward", () => {
  it("builds >=3 non-overlapping folds on 250 bars", () => {
    const folds = buildExpandingFolds(250, DEFAULT_WF_CONFIG);
    assert.ok(folds.length >= 3, `got ${folds.length}`);
    for (const f of folds) {
      assert.equal(foldHasNoLeakage(f), true);
      assert.ok(f.trainEnd <= f.purgeStart);
      assert.ok(f.purgeEnd <= f.testStart);
    }
  });

  it("train ∩ test empty", () => {
    const folds = buildExpandingFolds(200);
    for (const f of folds) {
      const train = new Set(
        Array.from({ length: f.trainEnd - f.trainStart }, (_, k) => f.trainStart + k),
      );
      for (let i = f.testStart; i < f.testEnd; i++) {
        assert.equal(train.has(i), false);
      }
    }
  });
});
