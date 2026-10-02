import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FactorScores, FactorWeights } from "./cross-section";
import {
  defaultStudioWeights,
  normalizeWeights,
  rankWithWeights,
  resolveStudioWeights,
} from "./studio";
import type { FactorsIcPayload } from "./ic";

function row(
  symbol: string,
  partial: Partial<FactorScores>,
): FactorScores {
  return {
    symbol,
    nameZh: symbol,
    nameEn: symbol,
    momentum: null,
    lowVol: null,
    sizeAdv: null,
    quality: null,
    peProxy: null,
    pbProxy: null,
    composite: null,
    rank: null,
    ...partial,
  };
}

describe("factor studio", () => {
  it("normalizeWeights sums to 1 and drops zero pe/pb", () => {
    const w = normalizeWeights({
      momentum: 50,
      lowVol: 50,
      sizeAdv: 0,
      quality: 0,
      peProxy: 0,
      pbProxy: 0,
    });
    const sum =
      w.momentum + w.lowVol + w.sizeAdv + w.quality + (w.peProxy ?? 0) + (w.pbProxy ?? 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.equal(w.momentum, 0.5);
    assert.equal(w.lowVol, 0.5);
    assert.equal(w.peProxy, undefined);
  });

  it("normalizeWeights falls back when all zero", () => {
    const w = normalizeWeights({
      momentum: 0,
      lowVol: 0,
      sizeAdv: 0,
      quality: 0,
    });
    assert.equal(w.momentum, 0.25);
    assert.equal(w.quality, 0.25);
  });

  it("rankWithWeights orders by composite and respects topN", () => {
    const factors = [
      row("A", { momentum: 1, lowVol: 0, sizeAdv: 0, quality: 0 }),
      row("B", { momentum: 0.5, lowVol: 0, sizeAdv: 0, quality: 0 }),
      row("C", { momentum: 2, lowVol: 0, sizeAdv: 0, quality: 0 }),
    ];
    const w: FactorWeights = {
      momentum: 1,
      lowVol: 0,
      sizeAdv: 0,
      quality: 0,
    };
    const ranked = rankWithWeights(factors, w, 2);
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].symbol, "C");
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].symbol, "A");
  });

  it("resolveStudioWeights uses IC vector when useIc", () => {
    const base = defaultStudioWeights();
    const ic: FactorsIcPayload = {
      generatedAt: new Date().toISOString(),
      reportDate: "2026-10-02",
      source: "test",
      attribution: { zh: "", en: "" },
      horizonBars: 21,
      rows: [
        {
          factor: "momentum",
          icMean: 0.1,
          icStd: 0.05,
          ir: 2,
          quantileReturns: [],
          nPeriods: 10,
        },
        {
          factor: "lowVol",
          icMean: 0.05,
          icStd: 0.05,
          ir: 1,
          quantileReturns: [],
          nPeriods: 10,
        },
      ],
    };
    const off = resolveStudioWeights(base, false, ic);
    assert.deepEqual(off, normalizeWeights(base));
    const on = resolveStudioWeights(base, true, ic);
    assert.ok(on.momentum > 0);
    assert.ok(on.lowVol > 0);
  });
});
