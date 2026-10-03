import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStructuredAnswer } from "./structured";
import { attentionProxyFromSeries } from "./attention-proxy";

describe("fin/structured", () => {
  it("parses JSON answer with stamp", () => {
    const obj = {
      role: "supro_quant_researcher",
      task: "factor_screen",
      reasoning_chain: ["a", "b"],
      narrative: "hello",
      factors: [],
      eliminations: [],
      portfolio: [],
      signals: [],
      risks: [],
      deep_links: [],
      disclaimer: "education_only",
    };
    const raw = `${JSON.stringify(obj)}\n\n— Supro Model · tokens 10 · gold spent 1`;
    const { structured, narrative } = parseStructuredAnswer(raw);
    assert.ok(structured);
    assert.equal(structured?.task, "factor_screen");
    assert.ok(narrative.includes("hello"));
    assert.ok(narrative.includes("Supro Model"));
  });
});

describe("fin/attention-proxy", () => {
  it("scores price/volume focus from bars", () => {
    const bars = Array.from({ length: 20 }, (_, i) => ({
      c: 10 + i * 0.2 + (i % 3) * 0.1,
      v: 1000 + (i % 5) * 200,
    }));
    const row = attentionProxyFromSeries("TEST", bars, "en");
    assert.ok(row);
    assert.ok(row!.priceFocus >= 0 && row!.priceFocus <= 1);
    assert.ok(row!.volumeFocus >= 0 && row!.volumeFocus <= 1);
  });
});
