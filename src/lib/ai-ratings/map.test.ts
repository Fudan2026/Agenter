import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapAiRatings } from "./map";

describe("ai-ratings/map", () => {
  it("maps alias names to agent rows without inventing scores", () => {
    const payload = mapAiRatings(
      [
        {
          agentId: "claude-code",
          arenaNames: ["Claude 3.5 Sonnet"],
          aaNames: ["Claude 3.5 Sonnet"],
        },
        {
          agentId: "chatgpt",
          arenaNames: ["GPT-4o"],
          aaNames: ["GPT-4o"],
        },
        {
          agentId: "missing-agent",
          arenaNames: ["Nope"],
          aaNames: ["Nope"],
        },
      ],
      [
        { name: "Claude 3.5 Sonnet", elo: 1280, rank: 3, url: "https://example/arena" },
        { name: "GPT-4o", elo: 1260, rank: 5 },
      ],
      [
        { name: "Claude 3.5 Sonnet", iq: 72, rank: 2 },
        { name: "GPT-4o", intelligence_index: 68 },
      ],
      ["arena:test", "aa:test"],
    );
    assert.equal(payload.rows.length, 2);
    const claude = payload.rows.find((r) => r.agentId === "claude-code")!;
    assert.equal(claude.arenaElo, 1280);
    assert.equal(claude.aaIq, 72);
    assert.equal(claude.rank, 3);
    assert.ok(!payload.rows.some((r) => r.agentId === "missing-agent"));
  });
});
