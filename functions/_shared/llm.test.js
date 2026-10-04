import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowFinOffline,
  extractChatText,
  goldCost,
  llmApiKey,
  llmConfigured,
  llmModel,
} from "./llm.js";

describe("functions/_shared/llm", () => {
  it("reads LLM_API_KEY and DEEPSEEK_API_KEY aliases", () => {
    assert.equal(llmApiKey({ LLM_API_KEY: "k1" }), "k1");
    assert.equal(llmApiKey({ DEEPSEEK_API_KEY: "k2" }), "k2");
    assert.equal(llmApiKey({}), "");
    assert.equal(llmConfigured({ LLM_API_KEY: "x" }), true);
    assert.equal(llmConfigured({}), false);
  });

  it("defaults deepseek-chat model", () => {
    assert.equal(llmModel({ LLM_BACKEND: "deepseek" }), "deepseek-chat");
  });

  it("goldCost is proportional with floor 1 when tokens > 0", () => {
    assert.equal(goldCost(0), 0);
    assert.equal(goldCost(1), 1);
    assert.equal(goldCost(1000), 1);
    assert.equal(goldCost(1001), 2);
    assert.equal(goldCost(4713), 5);
  });

  it("allowFinOffline is opt-in only", () => {
    assert.equal(allowFinOffline({}), false);
    assert.equal(allowFinOffline({ ALLOW_FIN_OFFLINE: "true" }), true);
  });

  it("extractChatText prefers content then reasoning_content", () => {
    assert.equal(
      extractChatText({
        choices: [{ message: { content: "hi", reasoning_content: "think" } }],
      }),
      "hi",
    );
    assert.equal(
      extractChatText({
        choices: [{ message: { content: "", reasoning_content: "think" } }],
      }),
      "think",
    );
  });
});
