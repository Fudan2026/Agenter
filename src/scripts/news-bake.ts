/**
 * Bake public/data/ai-news.json — fail-open (keep last-good on network errors).
 * Distills a small set of public AI/agent RSS feeds (OpenCool-inspired).
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join("public", "data", "ai-news.json");

const FEEDS: Array<{ id: string; url: string; lang: "en" | "zh" }> = [
  { id: "openai-news", url: "https://openai.com/news/rss.xml", lang: "en" },
  {
    id: "huggingface-blog",
    url: "https://huggingface.co/blog/feed.xml",
    lang: "en",
  },
  { id: "qbitai", url: "https://www.qbitai.com/feed", lang: "zh" },
  {
    id: "googleapis-ai",
    url: "https://blog.google/technology/ai/rss/",
    lang: "en",
  },
  {
    id: "jiqizhixin",
    url: "https://www.jiqizhixin.com/rss",
    lang: "zh",
  },
];

interface Item {
  id: string;
  date: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  tags: string[];
  url?: string;
}

function strip(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRss(xml: string, feedId: string, lang: "en" | "zh"): Item[] {
  const items: Item[] = [];
  const chunks = xml.split(/<item[\s>]/i).slice(1);
  for (const chunk of chunks.slice(0, 6)) {
    const title = strip(
      (chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? "",
    );
    const link = strip(
      (chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ?? [])[1] ?? "",
    );
    const desc = strip(
      (chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ??
        [])[1] ?? "",
    ).slice(0, 220);
    const pub =
      strip((chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ?? [])[1] ?? "") ||
      new Date().toISOString();
    if (!title) continue;
    const date = new Date(pub);
    const dateStr = Number.isFinite(date.getTime())
      ? date.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const summary =
      desc ||
      (lang === "zh"
        ? "来自公开 RSS 的 AI/Agent 资讯条目。"
        : "AI/agent headline distilled from public RSS.");
    items.push({
      id: `${feedId}-${dateStr}-${items.length}`,
      date: dateStr,
      titleZh: lang === "zh" ? title : title,
      titleEn: lang === "en" ? title : title,
      summaryZh: lang === "zh" ? summary : `（英）${summary}`,
      summaryEn: lang === "en" ? summary : `(ZH) ${summary}`,
      tags: ["ai", feedId],
      url: link || undefined,
    });
  }
  return items;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "AgenterNewsBake/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function main() {
  const prev = fs.existsSync(OUT)
    ? (JSON.parse(fs.readFileSync(OUT, "utf8")) as { items: Item[] })
    : { items: [] as Item[] };

  const collected: Item[] = [];
  for (const feed of FEEDS) {
    const xml = await fetchText(feed.url);
    if (!xml) {
      console.warn(`[news:bake] miss ${feed.id}`);
      continue;
    }
    collected.push(...parseRss(xml, feed.id, feed.lang));
  }

  const items = (collected.length ? collected : prev.items)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 18);

  // Always ensure at least the educational fixtures remain if everything empty
  const fallback: Item[] = [
    {
      id: "stub-1",
      date: new Date().toISOString().slice(0, 10),
      titleZh: "编码 Agent 工具链继续向 MCP / CLI 收敛",
      titleEn: "Coding agents keep converging on MCP / CLI toolchains",
      summaryZh: "对比页可关注 toolUse 与 privacy 维度。",
      summaryEn: "Compare on toolUse and privacy dimensions.",
      tags: ["coding", "tools"],
    },
    {
      id: "stub-2",
      date: new Date().toISOString().slice(0, 10),
      titleZh: "国内可达性仍是选型硬约束",
      titleEn: "CN accessibility remains a hard filter",
      summaryZh: "Harness 中 cnAccessibility 权重可反映网络与支付可达性。",
      summaryEn: "Weight cnAccessibility for reachability.",
      tags: ["CN", "access"],
    },
    {
      id: "stub-3",
      date: new Date().toISOString().slice(0, 10),
      titleZh: "纸盘与清单导出：站点不下真单",
      titleEn: "Paper + checklist export: sites should not place live orders",
      summaryZh: "快速实盘 = 信号清单 + 纸盘，券商侧人工下单。",
      summaryEn: "Fast practice = signal list + paper; humans order at broker.",
      tags: ["paper", "risk"],
    },
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    source: collected.length ? "rss-bake" : "static-fixture",
    items: items.length ? items : fallback,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[news:bake] wrote ${OUT} items=${payload.items.length} source=${payload.source}`,
  );
}

main().catch((e) => {
  console.error(e);
  // fail-open: do not fail CI
  process.exit(0);
});
