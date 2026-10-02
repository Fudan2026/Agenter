import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tearsheetFromEquity } from "./tearsheet";

describe("tearsheetFromEquity", () => {
  it("maxDd matches hand calc", () => {
    const equity = [100, 110, 105, 120, 90, 95];
    const ts = tearsheetFromEquity(equity);
    let peak = equity[0];
    let maxDd = 0;
    for (const e of equity) {
      if (e > peak) peak = e;
      const dd = (peak - e) / peak;
      if (dd > maxDd) maxDd = dd;
    }
    assert.equal(ts.maxDd, maxDd);
    assert.ok(Math.abs(ts.maxDd - 0.25) < 1e-9);
  });
});
