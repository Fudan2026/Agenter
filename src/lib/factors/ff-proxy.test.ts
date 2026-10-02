import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rollingBeta, valueProxy12_1 } from "./ff-proxy";

describe("ff-proxy", () => {
  it("beta of series vs itself ~ 1", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 * (1 + i * 0.01));
    const b = rollingBeta(closes, closes, 60);
    assert.ok(b != null);
    assert.ok(Math.abs(b! - 1) < 0.05);
  });

  it("value proxy finite on length>=40", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 - i * 0.5);
    const v = valueProxy12_1(closes);
    assert.ok(v != null && v >= 0 && v <= 1);
  });
});
