import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NEWS_SECTION_IDS,
  PAPER_PANEL_IDS,
  QUANT_PANEL_IDS,
  readHashQuery,
  withHashQuery,
} from "./hash-query";

describe("hash-query", () => {
  it("readHashQuery parses after ?", () => {
    const q = readHashQuery("#/news?section=filings&x=1");
    assert.equal(q.get("section"), "filings");
    assert.equal(q.get("x"), "1");
  });

  it("readHashQuery empty without ?", () => {
    assert.equal(readHashQuery("#/paper").toString(), "");
  });

  it("withHashQuery builds and skips empty", () => {
    assert.equal(
      withHashQuery("/news", { section: "ai" }),
      "#/news?section=ai",
    );
    assert.equal(
      withHashQuery("#/paper", { panel: "export", symbol: "" }),
      "#/paper?panel=export",
    );
    assert.equal(withHashQuery("/quant", {}), "#/quant");
  });

  it("panel maps cover plan targets", () => {
    assert.equal(NEWS_SECTION_IDS.filings, "news-filings");
    assert.equal(PAPER_PANEL_IDS.export, "ws-ops");
    assert.equal(QUANT_PANEL_IDS.studio, "quant-studio");
    assert.equal(QUANT_PANEL_IDS.macro, "quant-macro");
    assert.equal(QUANT_PANEL_IDS.rotation, "quant-rotation");
    assert.equal(QUANT_PANEL_IDS.review, "quant-review");
  });
});