/**
 * Bake public/data/fin-corpus.json for Fin Desk RAG context.
 * Sources: announcements, iwencai-news, ai-news, handbook snippets (local JSON).
 * Fail-open: write whatever is available.
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join("public", "data", "fin-corpus.json");

interface CorpusChunk {
  id: string;
  source: string;
  date?: string;
  title: string;
  text: string;
  tags: string[];
}

function readJson(p: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function chunkText(id: string, source: string, title: string, text: string, date?: string, tags: string[] = []): CorpusChunk {
  return {
    id,
    source,
    date,
    title: title.slice(0, 200),
    text: text.slice(0, 1200),
    tags,
  };
}

function fromNewsLike(
  payload: { items?: Array<Record<string, unknown>> } | null,
  source: string,
): CorpusChunk[] {
  const items = payload?.items ?? [];
  return items.slice(0, 40).map((it, i) =>
    chunkText(
      `${source}-${i}-${String(it.date || "")}`,
      source,
      String(it.titleZh || it.titleEn || it.title || "item"),
      String(it.summaryZh || it.summaryEn || it.summary || ""),
      String(it.date || "") || undefined,
      Array.isArray(it.tags) ? (it.tags as string[]).map(String) : [],
    ),
  );
}

function handbookSnippets(): CorpusChunk[] {
  // Lightweight static literacy for RAG when handbook module is heavy
  return [
    chunkText(
      "hb-l1l4",
      "handbook",
      "L1–L4 maturity",
      "Agenter public tools ≈ L1–L2. Fin Desk AIaaS is L2→L3 advisory. L4 autonomous live trading is out of browser scope. No broker/THS in-page.",
      undefined,
      ["literacy", "limits"],
    ),
    chunkText(
      "hb-proxy",
      "handbook",
      "Proxy universe",
      "ETF timing and screens use watchlist proxy constituents — not full CSI membership. Disclose sampleYears and bake cadence.",
      undefined,
      ["literacy", "data"],
    ),
    chunkText(
      "hb-gold",
      "handbook",
      "Gold meter",
      "Supro Model requires confirmed login. Server spend_gold_for_usage debits AFTER actual tokens. Floor 20 gold. Admin seanfudan@163.com ≥100000. Redeem codes via Account. Standalone Supro Supabase — no Letus migration.",
      undefined,
      ["economy", "fin-desk"],
    ),
    chunkText(
      "skill-multifactor",
      "skillhub",
      "Multi-factor stock selection",
      "Methodology distill from 多因子选股策略 / 量化因子选股: neutralize industry/size when possible; combine value/momentum/quality/low-vol; eliminate factors with unstable IC; disclose proxy universe; next-open execution; no lookahead.",
      undefined,
      ["skill", "multifactor"],
    ),
    chunkText(
      "skill-ml",
      "skillhub",
      "ML strategy literacy",
      "Distill from 机器学习策略: tree/linear baselines over hand-crafted factors; walk-forward; avoid label leakage; Supro does not train Fin-R1 weights — DeepSeek AIaaS explains and drafts only.",
      undefined,
      ["skill", "ml"],
    ),
    chunkText(
      "skill-factor-research",
      "skillhub",
      "Factor research framework",
      "Distill from 因子研究框架: hypothesis → definition → IC/IR → decay → costs → keep/kill. LLMFactor-style sequential prompting for explainable keep/reject chains.",
      undefined,
      ["skill", "factors"],
    ),
    chunkText(
      "skill-transformer",
      "skillhub",
      "Transformer PV literacy",
      "StockFormer/FinCast distill: multi-head attention over OHLCV tokens; temporal vs cross-sectional heads; causal masks; no on-site weight inference; educational attention proxy from baked candles only.",
      undefined,
      ["skill", "transformer"],
    ),
    chunkText(
      "skill-report",
      "skillhub",
      "Research report pipeline",
      "TickerAnalysis-style sections: data → factor findings → strategy/backtest literacy → narrative → rating + quality_score. Sources from fin-corpus + baked IC/screens. Education only.",
      undefined,
      ["skill", "report"],
    ),
    chunkText(
      "skill-allocate",
      "skillhub",
      "Dynamic allocation",
      "Portfolio stage JSON: capped weights, sector/name caps, rebalance notes, next-open constraint. Inspired by multi-agent market construction stages — deterministic caps in narrative.",
      undefined,
      ["skill", "allocate"],
    ),
  ];
}

function main() {
  const announcements = readJson("public/data/announcements.json") as {
    items?: Array<Record<string, unknown>>;
  } | null;
  const iwencai = readJson("public/data/iwencai-news.json") as {
    items?: Array<Record<string, unknown>>;
  } | null;
  const aiNews = readJson("public/data/ai-news.json") as {
    items?: Array<Record<string, unknown>>;
  } | null;
  const review = readJson("public/data/latest.json") as {
    dailyReview?: { zh?: string[]; en?: string[] };
    reportDate?: string;
  } | null;

  const chunks: CorpusChunk[] = [
    ...fromNewsLike(announcements, "announcements"),
    ...fromNewsLike(iwencai, "iwencai-news"),
    ...fromNewsLike(aiNews, "ai-news"),
    ...handbookSnippets(),
  ];

  if (review?.dailyReview?.zh?.length) {
    chunks.unshift(
      chunkText(
        `review-${review.reportDate || "today"}`,
        "daily-review",
        `Daily review ${review.reportDate || ""}`.trim(),
        [...(review.dailyReview.zh || []), ...(review.dailyReview.en || [])].join(
          " | ",
        ),
        review.reportDate,
        ["review"],
      ),
    );
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    chunkCount: chunks.length,
    chunks,
    note: {
      zh: "Fin Desk RAG 语料：公告/资讯/日报/手册素养片段。代理宇宙，非全市场。",
      en: "Fin Desk RAG corpus: filings/news/review/handbook literacy. Proxy universe.",
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`[fin-corpus:bake] wrote ${OUT} chunks=${chunks.length}`);
}

main();
