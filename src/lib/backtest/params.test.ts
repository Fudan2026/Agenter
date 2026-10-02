import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_STRATEGY_PARAMS,
  mergeParams,
  parseLabParams,
} from "./params";

describe("strategy params", () => {
  it("mergeParams fills defaults", () => {
    const m = mergeParams({ maFast: 10 });
    assert.equal(m.maFast, 10);
    assert.equal(m.maSlow, DEFAULT_STRATEGY_PARAMS.maSlow);
    assert.equal(m.rsiOs, 30);
  });

  it("parseLabParams reads lab + numeric knobs from hash", () => {
    const { lab, params } = parseLabParams(
      "#/quant?lab=ma_cross&fast=12&slow=48&rsi=10&os=25&ob=75&thr=55&lags=4&shrink=1.5",
    );
    assert.equal(lab, "ma_cross");
    assert.equal(params.maFast, 12);
    assert.equal(params.maSlow, 48);
    assert.equal(params.rsiPeriod, 10);
    assert.equal(params.rsiOs, 25);
    assert.equal(params.rsiOb, 75);
    assert.equal(params.confThreshold, 55);
    assert.equal(params.mlLags, 4);
    assert.equal(params.mlShrink, 1.5);
  });

  it("parseLabParams ignores bad numbers", () => {
    const { params } = parseLabParams("#/quant?fast=abc&slow=");
    assert.equal(params.maFast, undefined);
    assert.equal(params.maSlow, undefined);
  });
});
