import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DESK_SELECTION_KEY, loadSelection, saveSelection } from "./selection";

describe("desk selection bus", () => {
  it("round-trips symbol", () => {
    const prev = globalThis.localStorage;
    const store = new Map<string, string>();
    // @ts-expect-error test stub
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    saveSelection({ symbol: "510300.SS", asOf: "2026-01-02" });
    const s = loadSelection();
    assert.equal(s.symbol, "510300.SS");
    assert.equal(s.asOf, "2026-01-02");
    assert.ok(store.has(DESK_SELECTION_KEY));
    globalThis.localStorage = prev;
  });
});
