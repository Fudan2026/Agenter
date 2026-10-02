import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACADEMY_KEY,
  ACADEMY_STAGES,
  loadAcademy,
  markStage,
  readinessScore,
  validateStage,
} from "./curriculum";

describe("academy curriculum", () => {
  it("has seven stages", () => {
    assert.equal(ACADEMY_STAGES.length, 7);
  });

  it("markStage persists", () => {
    const prev = globalThis.localStorage;
    const store = new Map<string, string>();
    // @ts-expect-error test stub
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    };
    markStage("screener");
    const p = loadAcademy();
    assert.equal(p.screener, true);
    assert.ok(store.has(ACADEMY_KEY));
    globalThis.localStorage = prev;
  });

  it("validateStage uses passed flags", () => {
    assert.equal(validateStage("lab", { backtestRun: true }), true);
    assert.equal(validateStage("lab", { backtestRun: false }), false);
  });

  it("readinessScore caps at 100", () => {
    const s = readinessScore({
      costOn: true,
      gatesUnderstood: true,
      academyDone: 7,
      labNotRed: true,
      checklistNonEmpty: true,
    });
    assert.equal(s, 100);
  });
});
