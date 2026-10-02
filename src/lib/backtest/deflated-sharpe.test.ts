import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { haircutSharpe } from "./deflated-sharpe";

describe("deflated / haircut Sharpe", () => {
  it("higher nTrials lowers haircut Sharpe (monotonic)", () => {
    const a = haircutSharpe({ sharpe: 1.2, nObs: 200, nTrials: 4 });
    const b = haircutSharpe({ sharpe: 1.2, nObs: 200, nTrials: 12 });
    const c = haircutSharpe({ sharpe: 1.2, nObs: 200, nTrials: 50 });
    assert.ok(b.sharpeHaircut <= a.sharpeHaircut + 1e-9);
    assert.ok(c.sharpeHaircut <= b.sharpeHaircut + 1e-9);
  });
});
