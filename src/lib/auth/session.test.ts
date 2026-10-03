import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PUBLIC_ROUTES, requiresAuth } from "./session";

describe("auth/session guards", () => {
  it("gates fin, account, and admin", () => {
    assert.equal(requiresAuth("fin"), true);
    assert.equal(requiresAuth("account"), true);
    assert.equal(requiresAuth("admin"), true);
    assert.equal(requiresAuth("quant"), false);
    assert.equal(requiresAuth("home"), false);
  });

  it("public routes include quant tools", () => {
    assert.ok(PUBLIC_ROUTES.has("quant"));
    assert.ok(PUBLIC_ROUTES.has("compare"));
    assert.ok(!PUBLIC_ROUTES.has("fin"));
  });
});
