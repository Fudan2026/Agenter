import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("bake artifacts", () => {
  it("public/data/latest.json exists and parses", () => {
    const p = path.join("public", "data", "latest.json");
    assert.ok(fs.existsSync(p), "latest.json missing — run quant:bake or restore from git");
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw) as { symbols?: unknown[] };
    assert.ok(Array.isArray(j.symbols) && j.symbols.length > 0);
  });
});
