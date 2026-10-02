import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateBacktestGates } from "./gates";

const base = {
  costModelEnabled: true,
  fillRuleAllNextOpen: true,
  usedPurgedWf: true,
  rawSharpe: 1.2,
  haircutSharpe: 0.8,
  isReturn: 20,
  oosReturn: 15,
  oosSharpe: 0.7,
  maxDdPct: 15,
};

describe("risk gates", () => {
  it("cost_off blocks actionable", () => {
    const g = evaluateBacktestGates({ ...base, costModelEnabled: false });
    assert.equal(g.okForActionable, false);
    assert.ok(g.codes.includes("cost_off"));
  });

  it("lookahead blocks green", () => {
    const g = evaluateBacktestGates({ ...base, usedPurgedWf: false });
    assert.equal(g.okForGreen, false);
    assert.ok(g.codes.includes("lookahead"));
  });

  it("oos degradation is red", () => {
    const g = evaluateBacktestGates({
      ...base,
      oosReturn: 2,
      oosSharpe: -0.1,
    });
    assert.equal(g.level, "red");
    assert.ok(g.codes.includes("oos_degradation"));
  });

  it("multiple_testing when haircut low", () => {
    const g = evaluateBacktestGates({ ...base, haircutSharpe: 0.2 });
    assert.equal(g.okForGreen, false);
    assert.ok(g.codes.includes("multiple_testing"));
  });

  it("always includes survivorship", () => {
    const g = evaluateBacktestGates(base);
    assert.ok(g.codes.includes("survivorship"));
  });
});
