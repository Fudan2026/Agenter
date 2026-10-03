import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reconcileSimPaper } from "./sim-bridge";
import { defaultPaperState } from "./engine";
import type { SimLedger } from "../sim/types";

describe("sim-paper bridge", () => {
  it("reconciles cash and qty deltas", () => {
    const sim: SimLedger = {
      version: 1,
      account: null,
      cash: 90_000_000,
      startingCash: 100_000_000,
      positions: [
        {
          symbol: "600519.SS",
          nameZh: "茅台",
          nameEn: "Moutai",
          qty: 200,
          avgCost: 1700,
          marketCode: "2",
        },
      ],
      boughtLots: {},
      trades: [],
    };
    const paper = {
      ...defaultPaperState(),
      cash: 95_000_000,
      positions: [{ symbol: "600519.SS", qty: 100, avgCost: 1700 }],
    };
    const snap = reconcileSimPaper(sim, paper);
    assert.equal(snap.cashDelta, 5_000_000);
    assert.equal(snap.rows.length, 1);
    assert.equal(snap.rows[0].deltaQty, -100);
  });
});
