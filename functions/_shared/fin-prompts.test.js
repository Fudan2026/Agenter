import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractJsonObject,
  liveStructuredFromText,
  offlineStructured,
} from "./fin-prompts.js";

describe("fin-prompts live vs offline", () => {
  it("liveStructuredFromText never claims DeepSeek was not called", () => {
    const s = liveStructuredFromText("review", "hello", "zh", "真实回答正文");
    const chain = (s.reasoning_chain || []).join(" ");
    assert.ok(!chain.includes("未调用 DeepSeek"));
    assert.ok(!chain.includes("离线模式"));
    assert.ok(chain.includes("已调用 DeepSeek") || chain.includes("在线"));
    assert.equal(s.narrative, "真实回答正文");
    assert.equal(s.live, true);
  });

  it("offlineStructured still marks offline for opt-in path only", () => {
    const s = offlineStructured("review", "x", "zh");
    assert.ok((s.reasoning_chain || []).some((x) => x.includes("未调用")));
  });

  it("extractJsonObject parses fenced and truncated-ish JSON", () => {
    const fenced = "```json\n{\"role\":\"supro_quant_researcher\",\"narrative\":\"ok\"}\n```";
    assert.equal(extractJsonObject(fenced)?.narrative, "ok");
    const plain = '{"role":"x","narrative":"y"}';
    assert.equal(extractJsonObject(plain)?.narrative, "y");
  });
});
