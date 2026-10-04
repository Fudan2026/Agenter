import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billGoldForMode,
  modeGoldMultiplier,
  trimHistoryForModel,
} from "./gold-tiers.js";

describe("gold-tiers", () => {
  it("multipliers match commercial tiers", () => {
    assert.equal(modeGoldMultiplier("review"), 1);
    assert.equal(modeGoldMultiplier("multifactor"), 2);
    assert.equal(modeGoldMultiplier("transformer"), 2);
    assert.equal(modeGoldMultiplier("report"), 3);
    assert.equal(modeGoldMultiplier("e2e"), 4);
  });

  it("bills tokens * multiplier; admin free", () => {
    assert.equal(billGoldForMode(1000, "review"), 1);
    assert.equal(billGoldForMode(1000, "e2e"), 4);
    assert.equal(billGoldForMode(2500, "report"), 9); // ceil(2.5)=3 * 3
    assert.equal(billGoldForMode(2500, "report", { admin: true }), 0);
    assert.equal(billGoldForMode(0, "e2e"), 0);
  });

  it("trimHistoryForModel keeps last N", () => {
    const msgs = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    const t = trimHistoryForModel(msgs, 30);
    assert.equal(t.length, 30);
    assert.equal(t[0].content, "m10");
    assert.equal(t[29].content, "m39");
  });
});
