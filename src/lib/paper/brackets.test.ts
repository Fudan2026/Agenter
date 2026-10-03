import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bracketLevelsFromPct,
  evaluateBracketOnBar,
  findBracketExit,
} from "./brackets";
import { isNonSession, nextSessionIndex } from "./calendar";
import type { CnCalendarPayload } from "./calendar";
import { resolveNextOpenFill } from "./engine";

describe("paper brackets", () => {
  it("stop wins when both SL and TP hit the same bar", () => {
    const levels = bracketLevelsFromPct(100, 0.05, 0.05)!;
    const hit = evaluateBracketOnBar(
      { date: "2026-03-02", open: 100, high: 110, low: 90, close: 100, volume: 1 },
      levels,
    );
    assert.ok(hit);
    assert.equal(hit!.hit, "stop");
    assert.equal(hit!.fillPrice, 95);
  });

  it("finds take-profit on a later bar", () => {
    const levels = bracketLevelsFromPct(100, 0.1, 0.1)!;
    const candles = [
      { date: "2026-03-01", open: 100, high: 101, low: 99, close: 100, volume: 1 },
      { date: "2026-03-02", open: 100, high: 105, low: 99, close: 104, volume: 1 },
      { date: "2026-03-03", open: 104, high: 112, low: 103, close: 111, volume: 1 },
    ];
    const exit = findBracketExit(candles, "2026-03-01", levels);
    assert.ok(exit);
    assert.equal(exit!.hit, "take_profit");
    assert.equal(exit!.fillDate, "2026-03-03");
  });
});

describe("cn calendar lite", () => {
  const cal: CnCalendarPayload = {
    generatedAt: "x",
    source: "test",
    attribution: { zh: "", en: "" },
    nonSessions: ["2026-10-01", "2026-10-02"],
  };

  it("flags non-sessions", () => {
    assert.equal(isNonSession("2026-10-01", cal), true);
    assert.equal(isNonSession("2026-10-03", cal), false);
  });

  it("skips holiday bars when resolving next open", () => {
    const candles = [
      { date: "2026-09-30", open: 10, high: 11, low: 9, close: 10, volume: 1 },
      { date: "2026-10-01", open: 10.5, high: 11, low: 10, close: 10.2, volume: 1 },
      { date: "2026-10-02", open: 10.2, high: 10.5, low: 10, close: 10.1, volume: 1 },
      { date: "2026-10-03", open: 10.8, high: 11, low: 10.5, close: 10.9, volume: 1 },
    ];
    const fill = resolveNextOpenFill(candles, "2026-09-30", cal);
    assert.ok(fill);
    assert.equal(fill!.fillDate, "2026-10-03");
    assert.equal(fill!.fillPrice, 10.8);
  });

  it("nextSessionIndex jumps holidays", () => {
    const idx = nextSessionIndex(
      ["2026-09-30", "2026-10-01", "2026-10-03"],
      0,
      cal,
    );
    assert.equal(idx, 2);
  });
});
