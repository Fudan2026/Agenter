/**
 * Deterministic Fin-Research Agent tools — baked public/data only.
 * Distilled from FinRobot / Plan-and-Solve patterns (no Playwright).
 */

export const TOOL_NAMES = [
  "search_announcements",
  "search_iwencai",
  "pull_factors",
  "graph_neighbors",
  "quick_backtest",
];

/** Minimal seed until Stage 5C industry-graph bake. */
export const SEED_INDUSTRY_GRAPH = {
  nodes: [
    { id: "ind_semi", type: "industry", name: "半导体", nameEn: "Semiconductors" },
    { id: "sub_foundry", type: "subsector", name: "晶圆代工", nameEn: "Foundry" },
    { id: "sub_equip", type: "subsector", name: "设备材料", nameEn: "Equipment/Materials" },
    { id: "688981.SH", type: "stock", name: "中芯国际", nameEn: "SMIC" },
    { id: "002371.SZ", type: "stock", name: "北方华创", nameEn: "Naura" },
    { id: "TSM", type: "stock", name: "台积电", nameEn: "TSMC" },
    { id: "ind_evbat", type: "industry", name: "动力电池", nameEn: "EV Battery" },
    { id: "300750.SZ", type: "stock", name: "宁德时代", nameEn: "CATL" },
    { id: "ind_liquor", type: "industry", name: "白酒", nameEn: "Baijiu" },
    { id: "600519.SH", type: "stock", name: "贵州茅台", nameEn: "Moutai" },
  ],
  edges: [
    { from: "TSM", to: "sub_foundry", rel: "belongs_to" },
    { from: "688981.SH", to: "sub_foundry", rel: "belongs_to" },
    { from: "002371.SZ", to: "sub_equip", rel: "belongs_to" },
    { from: "sub_foundry", to: "ind_semi", rel: "belongs_to" },
    { from: "sub_equip", to: "ind_semi", rel: "belongs_to" },
    { from: "002371.SZ", to: "688981.SH", rel: "upstream" },
    { from: "TSM", to: "688981.SH", rel: "peer" },
    { from: "300750.SZ", to: "ind_evbat", rel: "belongs_to" },
    { from: "600519.SH", to: "ind_liquor", rel: "belongs_to" },
  ],
};

const LAB_IDS = ["ma_cross", "rsi_reversion", "confluence", "ml_lite"];

export function extractTickers(text) {
  const s = String(text || "");
  const out = new Set();
  for (const m of s.matchAll(/\b(\d{6}\.(?:SH|SZ|BJ))\b/gi)) {
    out.add(m[1].toUpperCase());
  }
  for (const m of s.matchAll(/\b([A-Z]{1,5})\b/g)) {
    const t = m[1];
    if (t.length >= 2 && t !== "AI" && t !== "JSON") out.add(t);
  }
  // Common Chinese names → codes
  if (/中芯|SMIC/i.test(s)) out.add("688981.SH");
  if (/宁德|CATL/i.test(s)) out.add("300750.SZ");
  if (/茅台|Moutai/i.test(s)) out.add("600519.SH");
  if (/台积电|TSMC/i.test(s)) out.add("TSM");
  if (/北方华创|Naura/i.test(s)) out.add("002371.SZ");
  return [...out].slice(0, 8);
}

/** Heuristic Plan-and-Solve planner (≤4 tools). */
export function planAgentTools(prompt) {
  const p = String(prompt || "");
  const tickers = extractTickers(p);
  const q = tickers[0] || p.slice(0, 40);
  const steps = [];
  steps.push({
    action: "search_announcements",
    thought: "Pull recent filings / announcements for entities in the question.",
    args: { q, tickers },
  });
  steps.push({
    action: "search_iwencai",
    thought: "Scan iwencai news bake for related headlines.",
    args: { q, tickers },
  });
  steps.push({
    action: "pull_factors",
    thought: "Load Alpha40-lite / IC factor context for the universe.",
    args: { tickers },
  });
  if (/回测|策略|lab|backtest|e2e|ma_cross|rsi/i.test(p)) {
    const lab =
      LAB_IDS.find((id) => p.toLowerCase().includes(id)) || "ma_cross";
    steps.push({
      action: "quick_backtest",
      thought: "Propose a Lab quick-backtest recipe (educational, no live orders).",
      args: { lab_id: lab, tickers },
    });
  } else {
    steps.push({
      action: "graph_neighbors",
      thought: "Expand industry / supply-chain neighbors for Graph RAG context.",
      args: { ticker: tickers[0] || q, tickers },
    });
  }
  return steps.slice(0, 4);
}

async function fetchJson(origin, path, timeoutMs = 2500) {
  try {
    const res = await fetch(`${origin}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function matchItems(items, q, tickers, limit = 6) {
  const list = Array.isArray(items) ? items : [];
  const ql = String(q || "").toLowerCase();
  const tset = new Set((tickers || []).map((t) => String(t).toUpperCase()));
  const scored = list
    .map((it) => {
      const sym = String(it.symbol || it.code || "").toUpperCase();
      const title = String(it.titleZh || it.titleEn || it.title || "");
      const blob = `${sym} ${title} ${it.summaryZh || it.summary || ""}`.toLowerCase();
      let score = 0;
      if (tset.has(sym)) score += 5;
      if (ql && blob.includes(ql)) score += 2;
      for (const t of tset) {
        if (t && blob.includes(t.toLowerCase())) score += 1;
      }
      return { it, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.it);
  if (scored.length) return scored;
  return list.slice(0, Math.min(limit, 4));
}

export function neighborsFromGraph(graph, ticker) {
  const g = graph || SEED_INDUSTRY_GRAPH;
  const id = String(ticker || "").toUpperCase();
  const nodes = g.nodes || [];
  const edges = g.edges || [];
  // Resolve by id or name substring
  let seed = nodes.find((n) => String(n.id).toUpperCase() === id);
  if (!seed) {
    seed = nodes.find(
      (n) =>
        String(n.name || "").includes(String(ticker || "")) ||
        String(n.nameEn || "")
          .toLowerCase()
          .includes(String(ticker || "").toLowerCase()),
    );
  }
  if (!seed) {
    return {
      seed: null,
      neighbors: nodes.slice(0, 5),
      edges: edges.slice(0, 8),
      note: "no_exact_seed",
    };
  }
  const sid = seed.id;
  const linked = edges.filter((e) => e.from === sid || e.to === sid);
  const ids = new Set([sid]);
  for (const e of linked) {
    ids.add(e.from);
    ids.add(e.to);
  }
  // one more hop
  for (const e of edges) {
    if (ids.has(e.from) || ids.has(e.to)) {
      ids.add(e.from);
      ids.add(e.to);
    }
  }
  return {
    seed,
    neighbors: nodes.filter((n) => ids.has(n.id)),
    edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    note: "1hop_plus",
  };
}

export async function runAgentTool(origin, action, args, graphOverride = null) {
  const a = String(action || "");
  const tickers = args?.tickers || extractTickers(args?.q || "");
  const q = args?.q || tickers[0] || "";

  if (a === "search_announcements") {
    const data = await fetchJson(origin, "/data/announcements.json");
    const items = matchItems(data?.items || data?.rows || [], q, tickers, 6);
    return {
      ok: true,
      action: a,
      count: items.length,
      items: items.map((it) => ({
        symbol: it.symbol,
        title: it.titleZh || it.titleEn || it.title,
        date: it.date,
      })),
    };
  }

  if (a === "search_iwencai") {
    const data = await fetchJson(origin, "/data/iwencai-news.json");
    const items = matchItems(data?.items || data?.rows || [], q, tickers, 6);
    return {
      ok: true,
      action: a,
      count: items.length,
      items: items.map((it) => ({
        title: it.titleZh || it.titleEn || it.title,
        date: it.date || it.publishedAt,
      })),
    };
  }

  if (a === "pull_factors") {
    const [alpha, ic] = await Promise.all([
      fetchJson(origin, "/data/factors-alpha-lite.json"),
      fetchJson(origin, "/data/factors-ic.json"),
    ]);
    const top = (alpha?.topN || []).slice(0, 8);
    const filtered = tickers.length
      ? top.filter((r) => tickers.includes(String(r.symbol || "").toUpperCase()))
      : top;
    return {
      ok: true,
      action: a,
      weights: alpha?.suggestedWeights || {},
      topN: (filtered.length ? filtered : top).slice(0, 8),
      ic: (ic?.rows || []).slice(0, 6).map((r) => ({
        factor: r.factor,
        icMean: r.icMean,
        ir: r.ir,
      })),
    };
  }

  if (a === "graph_neighbors") {
    let graph = graphOverride;
    if (!graph) {
      graph =
        (await fetchJson(origin, "/data/industry-graph.json")) ||
        SEED_INDUSTRY_GRAPH;
    }
    const ticker = args?.ticker || tickers[0] || q;
    const neigh = neighborsFromGraph(graph, ticker);
    return { ok: true, action: a, ...neigh };
  }

  if (a === "quick_backtest") {
    const lab = LAB_IDS.includes(args?.lab_id) ? args.lab_id : "ma_cross";
    const symbols = (tickers.length ? tickers : ["600519.SH"]).slice(0, 3);
    return {
      ok: true,
      action: a,
      lab_id: lab,
      symbols,
      deep_links: [
        `#/quant?panel=lab&lab=${lab}`,
        ...symbols.map((s) => `#/paper?symbol=${encodeURIComponent(s)}`),
      ],
      note: "Educational recipe only — no live broker / THS orders. Run Lab client-side.",
      pseudo_metrics: {
        horizon: "next_open",
        costs: "baked_proxy",
        status: "recipe_ready",
      },
    };
  }

  return { ok: false, action: a, error: "unknown_tool" };
}

export async function executeAgentPlan(origin, prompt, graphOverride = null) {
  const plan = planAgentTools(prompt);
  const reasoning_steps = [];
  const observations = [];
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const obs = await runAgentTool(origin, step.action, step.args, graphOverride);
    reasoning_steps.push({
      step: i + 1,
      thought: step.thought,
      action: step.action,
      observation: JSON.stringify(obs).slice(0, 1800),
    });
    observations.push(obs);
  }
  return { plan, reasoning_steps, observations };
}
