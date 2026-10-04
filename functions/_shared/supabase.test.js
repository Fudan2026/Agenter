import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  anonKey,
  cloudNotConfiguredBody,
  supabaseAuthConfigured,
  supabaseUrl,
} from "./supabase.js";

describe("functions/_shared/supabase env", () => {
  it("reads SUPABASE_* first", () => {
    const env = {
      SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_ANON_KEY: "anon",
      VITE_SUPABASE_URL: "https://ignored.supabase.co",
      VITE_SUPABASE_ANON_KEY: "ignored",
    };
    assert.equal(supabaseUrl(env), "https://abc.supabase.co");
    assert.equal(anonKey(env), "anon");
    assert.equal(supabaseAuthConfigured(env), true);
  });

  it("falls back to VITE_* when SUPABASE_* missing", () => {
    const env = {
      VITE_SUPABASE_URL: "https://vite.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "vite-anon",
    };
    assert.equal(supabaseUrl(env), "https://vite.supabase.co");
    assert.equal(anonKey(env), "vite-anon");
    assert.equal(supabaseAuthConfigured(env), true);
  });

  it("reports not configured when empty", () => {
    assert.equal(supabaseAuthConfigured({}), false);
    const body = cloudNotConfiguredBody();
    assert.equal(body.code, "cloud_not_configured");
    assert.ok(Array.isArray(body.need));
  });
});
