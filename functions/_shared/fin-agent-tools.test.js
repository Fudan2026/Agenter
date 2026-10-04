import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTickers,
  neighborsFromGraph,
  planAgentTools,
  runAgentTool,
  SEED_INDUSTRY_GRAPH,
} from "./fin-agent-tools.js";

describe("fin-agent-tools", () => {
  it("extractTickers finds codes and aliases", () => {
    const t = extractTickers("分析台积电对中芯国际 688981.SH 的影响");
    assert.ok(t.includes("688981.SH"));
    assert.ok(t.includes("TSM"));
  });

  it("planAgentTools returns ≤4 steps including factors", () => {
    const plan = planAgentTools("Analyze TSMC supply chain impact on A-share semis");
    assert.ok(plan.length <= 4);
    assert.ok(plan.some((p) => p.action === "pull_factors"));
    assert.ok(plan.some((p) => p.action === "graph_neighbors"));
  });

  it("planAgentTools picks quick_backtest for strategy asks", () => {
    const plan = planAgentTools("帮我回测 ma_cross 策略");
    assert.ok(plan.some((p) => p.action === "quick_backtest"));
  });

  it("neighborsFromGraph expands seed", () => {
    const n = neighborsFromGraph(SEED_INDUSTRY_GRAPH, "TSM");
    assert.ok(n.seed);
    assert.ok(n.neighbors.length >= 2);
    assert.ok(n.edges.length >= 1);
  });

  it("runAgentTool quick_backtest is deterministic without network", async () => {
    const r = await runAgentTool("http://invalid.local", "quick_backtest", {
      lab_id: "rsi_reversion",
      tickers: ["600519.SH"],
    });
    assert.equal(r.ok, true);
    assert.equal(r.lab_id, "rsi_reversion");
    assert.ok(r.deep_links[0].includes("lab=rsi_reversion"));
  });

  it("runAgentTool unknown fails soft", async () => {
    const r = await runAgentTool("http://x", "nope", {});
    assert.equal(r.ok, false);
  });
});
