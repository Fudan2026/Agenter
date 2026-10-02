import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adfTest, approxAdfPValue, residualDiagnostics } from "./adf";

describe("ADF diagnostics", () => {
  it("approx p-value is monotone in t-stat", () => {
    assert.ok(approxAdfPValue(-3.5) < approxAdfPValue(-2.5));
    assert.ok(approxAdfPValue(-2.5) < approxAdfPValue(-1.0));
  });

  it("rejects unit root on mean-reverting series (low p)", () => {
    // AR(1) with phi=0.3 around mean
    const x: number[] = [0];
    let v = 0;
    for (let i = 0; i < 200; i++) {
      v = 0.3 * v + ((i % 7) - 3) * 0.01;
      x.push(v);
    }
    const r = adfTest(x);
    assert.ok(r);
    assert.ok(r!.pValue < 0.1, `expected low p, got ${r!.pValue}`);
  });

  it("residualDiagnostics returns vol + adf for price series", () => {
    const closes: number[] = [];
    let p = 100;
    for (let i = 0; i < 120; i++) {
      p *= 1 + ((i % 5) - 2) * 0.002;
      closes.push(p);
    }
    const d = residualDiagnostics(closes);
    assert.ok(d.vol != null && d.vol > 0);
    assert.ok(d.adf != null);
  });
});
