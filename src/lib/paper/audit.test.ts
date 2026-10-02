import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildResearchAudit } from "./audit";

describe("research audit", () => {
  it("scores green when core discipline flags are met", () => {
    const snap = buildResearchAudit({
      costModelEnabled: true,
      fillRuleNextOpen: true,
      usedTimeSplitNotRandom: true,
      survivorUniverse: true,
      haircutSharpe: 0.8,
      nTrials: 12,
    });
    assert.equal(snap.level, "green");
    assert.equal(snap.score, 100);
    assert.equal(snap.flags.length, 6);
    assert.ok(snap.flags.every((f) => f.ok));
  });

  it("marks costs / lookahead failures as not ok", () => {
    const snap = buildResearchAudit({
      costModelEnabled: false,
      fillRuleNextOpen: false,
      usedTimeSplitNotRandom: false,
      survivorUniverse: false,
      haircutSharpe: null,
      nTrials: null,
      hardcodedParamsOnly: true,
    });
    assert.ok(snap.score < 80);
    assert.ok(snap.level === "yellow" || snap.level === "red");
    const costs = snap.flags.find((f) => f.id === "costs")!;
    const nolahead = snap.flags.find((f) => f.id === "nolahead")!;
    const params = snap.flags.find((f) => f.id === "params")!;
    assert.equal(costs.ok, false);
    assert.equal(nolahead.ok, false);
    assert.equal(params.ok, false);
  });

  it("survivor flag stays literacy-ok when universe is baked survivors", () => {
    const snap = buildResearchAudit({
      costModelEnabled: true,
      fillRuleNextOpen: true,
      usedTimeSplitNotRandom: true,
      survivorUniverse: true,
    });
    const surv = snap.flags.find((f) => f.id === "survivor")!;
    assert.equal(surv.ok, true);
    assert.match(surv.en, /Survivorship/i);
  });
});
