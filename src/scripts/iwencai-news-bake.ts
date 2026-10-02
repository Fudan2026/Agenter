/**
 * Bake public/data/iwencai-news.json from curated queries via vendored
 * news-search CLI. Fail-open: keep last-good JSON on missing key / errors.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  mapNewsResponse,
  type GatewayNewsBody,
  type IwencaiNewsItem,
  type IwencaiNewsPayload,
} from "../lib/iwencai-news/map";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public", "data", "iwencai-news.json");
const CLI = path.join(ROOT, "skills", "news-search", "scripts", "news_search.py");
const SIZE = 5;
const THROTTLE_MS = 400;

const QUERIES = [
  "人工智能 Agent 财经 最新消息",
  "A股政策 最新消息",
];

function sleepSync(ms: number): void {
  spawnSync("sleep", [String(Math.max(0.1, ms / 1000))]);
}

function emptyPayload(): IwencaiNewsPayload {
  return {
    generatedAt: new Date(0).toISOString(),
    source: "同花顺问财",
    skill: "news-search",
    items: [],
  };
}

function readPrev(): IwencaiNewsPayload {
  if (!fs.existsSync(OUT)) return emptyPayload();
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8")) as IwencaiNewsPayload;
  } catch {
    return emptyPayload();
  }
}

function callCli(query: string): GatewayNewsBody | null {
  const res = spawnSync("python3", [CLI, query, "--size", String(SIZE)], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.warn(
      `[iwencai-news:bake] CLI exit ${res.status} for ${JSON.stringify(query)}: ${(res.stderr || "").slice(0, 200)}`,
    );
    return null;
  }
  const raw = (res.stdout || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GatewayNewsBody;
  } catch (e) {
    console.warn(`[iwencai-news:bake] JSON parse fail: ${e}`);
    return null;
  }
}

function main(): void {
  const prev = readPrev();
  const key = process.env.IWENCAI_API_KEY;
  if (!key) {
    console.warn(
      "[iwencai-news:bake] IWENCAI_API_KEY missing — keeping last-good JSON",
    );
    if (!fs.existsSync(OUT)) {
      const empty: IwencaiNewsPayload = {
        ...emptyPayload(),
        generatedAt: new Date().toISOString(),
      };
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify(empty, null, 2) + "\n", "utf8");
    }
    process.exit(0);
  }

  const collected: IwencaiNewsItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    const body = callCli(query);
    if (!body) {
      console.warn(`[iwencai-news:bake] miss ${query}`);
    } else if (body.status_code !== 0) {
      console.warn(
        `[iwencai-news:bake] status_code=${body.status_code} ${query}`,
      );
    } else {
      const items = mapNewsResponse(body, { query });
      console.log(`[iwencai-news:bake] ${query} → ${items.length} items`);
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        collected.push(item);
      }
    }
    if (i < QUERIES.length - 1) sleepSync(THROTTLE_MS);
  }

  const items = (collected.length ? collected : prev.items)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const payload: IwencaiNewsPayload = {
    generatedAt: new Date().toISOString(),
    source: "同花顺问财",
    skill: "news-search",
    items,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[iwencai-news:bake] wrote ${OUT} items=${payload.items.length} fresh=${collected.length > 0}`,
  );
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(0);
}
