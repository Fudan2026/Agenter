import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionProxyFromSeries,
  buildTransformerPvProxy,
} from "./attention-proxy";

describe("attention-proxy StockFormer literacy", () => {
  it("returns dual-frequency and temporal shares", () => {
    const bars = Array.from({ length: 30 }, (_, i) => ({
      c: 100 + i + (i % 5 === 0 ? 3 : 0),
      v: 1e6 + i * 1e4,
    }));
    const row = attentionProxyFromSeries("TEST", bars, "en");
    assert.ok(row);
    assert.ok(row!.slowFocus >= 0 && row!.slowFocus <= 1);
    assert.ok(row!.fastFocus >= 0 && row!.fastFocus <= 1);
    assert.ok(
      Math.abs(row!.temporalShare + row!.crossShare - 1) < 1e-9,
    );
    assert.ok(row!.note.includes("StockFormer") || row!.note.includes("slow"));
  });

  it("buildTransformerPvProxy sorts rows", () => {
    const payload = buildTransformerPvProxy(
      [
        {
          symbol: "A",
          candles: Array.from({ length: 40 }, (_, i) => ({
            close: 10 + i * 0.1,
            volume: 1000,
          })),
        },
        {
          symbol: "B",
          candles: Array.from({ length: 40 }, (_, i) => ({
            close: 10 + (i % 3) * 2,
            volume: 1000 + i * 500,
          })),
        },
      ],
      "2026-01-01",
    );
    assert.ok(payload.rows.length >= 1);
    assert.ok(payload.limitations.en.length >= 2);
  });
});
