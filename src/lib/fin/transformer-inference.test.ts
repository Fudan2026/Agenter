import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTransformerInferBake,
  patchifySeries,
  runTransformerInference,
  temporalAttention,
} from "./transformer-inference";

function synthBars(n: number) {
  const bars = [];
  let c = 100;
  for (let i = 0; i < n; i++) {
    c = c * (1 + (i % 5 === 0 ? 0.01 : -0.004));
    bars.push({
      o: c * 0.99,
      h: c * 1.01,
      l: c * 0.98,
      c,
      v: 1_000_000 + i * 1000,
    });
  }
  return bars;
}

describe("transformer-inference distill", () => {
  it("patchifySeries is tail-aligned and sized", () => {
    const xs = Array.from({ length: 40 }, (_, i) => i);
    const patches = patchifySeries(xs, 8);
    assert.ok(patches.length >= 1);
    assert.equal(patches[0]!.length, 8);
    assert.equal(patches[patches.length - 1]![7], 39);
  });

  it("temporalAttention weights sum to ~1", () => {
    const patches = [
      [0.01, 0.02, -0.01, 0, 0.01, 0, -0.02, 0.01],
      [0.0, 0.0, 0.01, 0.02, 0.01, 0, 0, -0.01],
      [-0.02, -0.01, 0, 0.01, 0.02, 0.01, 0, 0],
    ];
    const { weights } = temporalAttention(patches);
    const sum = weights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6);
  });

  it("runTransformerInference is deterministic and returns bands", () => {
    const bars = synthBars(64);
    const a = runTransformerInference("TEST", bars, "en");
    const b = runTransformerInference("TEST", bars, "en");
    assert.ok(a);
    assert.deepEqual(a, b);
    assert.equal(a!.engine, "distill_patch");
    assert.ok(a!.prediction_band.lo < a!.prediction_band.hi);
    assert.ok(a!.prediction_confidence >= 0 && a!.prediction_confidence <= 1);
    assert.equal(a!.attention_heatmap_data.weights.length, a!.attention_heatmap_data.patch_count);
  });

  it("rejects short series", () => {
    assert.equal(runTransformerInference("X", synthBars(4)), null);
  });

  it("buildTransformerInferBake sorts by confidence", () => {
    const payload = buildTransformerInferBake(
      [
        { symbol: "A", candles: synthBars(80).map((b) => ({ close: b.c!, volume: b.v! })) },
        { symbol: "B", candles: synthBars(80).map((b) => ({ close: b.c! * 1.1, volume: b.v! })) },
      ],
      "2026-01-01",
    );
    assert.equal(payload.rows.length, 2);
    assert.ok(
      payload.rows[0]!.prediction_confidence >= payload.rows[1]!.prediction_confidence,
    );
  });
});
