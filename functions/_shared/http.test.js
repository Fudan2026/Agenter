import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errText } from "./http.js";

describe("errText", () => {
  it("keeps strings", () => {
    assert.equal(errText("boom"), "boom");
  });
  it("flattens PostgREST objects", () => {
    assert.equal(
      errText({ message: "function missing", code: "PGRST202" }),
      "function missing",
    );
  });
  it("never returns [object Object]", () => {
    const s = errText({ foo: 1, bar: "x" });
    assert.notEqual(s, "[object Object]");
    assert.ok(s.includes("foo"));
  });
});
