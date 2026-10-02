import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFactorsIc,
  FACTOR_TILTS,
  icWeightVector,
  type FactorsIcPayload,
} from "./ic";

function synth(seed: number, n = 200): Array<{ close: number; volume: number }> {
  const out: Array<{ close: number; volume: number }> = [];
  let p = 10 + seed;
  for (let i = 0; i < n; i++) {
    p *= 1 + (seed * 0.0008 + ((i + seed) % 7) * 0.0015 - 0.004);
    out.push({ close: p, volume: 1_000_000 * (1 + seed * 0.15) });
  }
  return out;
}

describe("factors IC", () => {
  it("buildFactorsIc returns momentum + lowVol rows", () => {
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
      symbol: `S${i}.SS`,
      nameZh: `名${i}`,
      nameEn: `N${i}`,
      group: "china-ashare",
      candles: synth(i + 1),
    }));
    const payload = buildFactorsIc(rows, {
      reportDate: "2026-10-02",
      horizonBars: 21,
      step: 21,
    });
    assert.equal(payload.rows.length, 2);
    assert.ok(payload.rows.some((r) => r.factor === "momentum"));
    assert.ok(payload.rows.some((r) => r.factor === "lowVol"));
    assert.equal(payload.horizonBars, 21);
  });

  it("icWeightVector falls back to positive weights", () => {
    const empty: FactorsIcPayload = {
      generatedAt: new Date().toISOString(),
      reportDate: "2026-10-02",
      source: "test",
      attribution: { zh: "", en: "" },
      horizonBars: 21,
      rows: [],
    };
    const w = icWeightVector(empty);
    assert.ok(w.momentum > 0);
    assert.ok(w.lowVol > 0);
  });

  it("FACTOR_TILTS includes value pe/pb proxies", () => {
    assert.ok((FACTOR_TILTS.value.peProxy ?? 0) > 0);
    assert.ok((FACTOR_TILTS.value.pbProxy ?? 0) > 0);
  });
});
