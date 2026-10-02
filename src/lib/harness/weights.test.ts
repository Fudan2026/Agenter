import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WEIGHTS,
  HARNESS_PRESETS,
  parseCompareShare,
  weightedScore,
} from "./weights";

describe("harness weights", () => {
  it("ignores missing scores so coding agents stay rankable", () => {
    const score = weightedScore(
      { codingAbility: 5, toolUse: 5, contextMemory: 4 },
      DEFAULT_WEIGHTS,
    );
    assert.ok(score > 4);
  });

  it("quant preset emphasizes researchOrchestration", () => {
    const q = HARNESS_PRESETS.quant;
    assert.ok(q.researchOrchestration > q.codingAbility);
    assert.ok(q.backtestRigor > q.codingAbility);
    const tradingAgents = weightedScore(
      {
        researchOrchestration: 5,
        factorAlphaTooling: 4,
        riskControls: 5,
        backtestRigor: 4,
        codingAbility: 2,
      },
      q,
    );
    const codingIde = weightedScore(
      {
        codingAbility: 5,
        toolUse: 5,
        researchOrchestration: 1,
        backtestRigor: 1,
      },
      q,
    );
    assert.ok(tradingAgents > codingIde);
  });

  it("parses legacy 7-dim share links", () => {
    const hash = "#/compare?ids=a,b&w=1,1,1,1,1,1,1";
    const parsed = parseCompareShare(hash);
    assert.deepEqual(parsed.ids, ["a", "b"]);
    assert.ok(parsed.weights);
    assert.equal(parsed.weights!.codingAbility, 1);
    assert.ok(parsed.weights!.researchOrchestration > 0);
  });
});
