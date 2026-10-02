/**
 * Bake public/data/indices.json from fixed index queries via vendored
 * hithink-zhishu-query CLI. Fail-open: keep last-good JSON on missing key / errors.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  mapZhishuResponse,
  type IndexItem,
  type IndicesPayload,
  type ZhishuCliBody,
} from "../lib/indices/map";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public", "data", "indices.json");
const CLI = path.join(
  ROOT,
  "skills",
  "hithink-zhishu-query",
  "scripts",
  "cli.py",
);
const THROTTLE_MS = 400;

/** Align with macro / CSI / ChiNext / SZ / mid-cap / STAR watchlist names. */
const INDEX_QUERIES: Array<{ query: string; nameEn: string }> = [
  { query: "上证指数最新点位", nameEn: "SSE Composite" },
  { query: "沪深300最新点位", nameEn: "CSI 300" },
  { query: "创业板指最新点位", nameEn: "ChiNext" },
  { query: "深证成指最新点位", nameEn: "SZSE Component" },
  { query: "中证500最新点位", nameEn: "CSI 500" },
  { query: "科创50最新点位", nameEn: "STAR 50" },
];

function sleepSync(ms: number): void {
  spawnSync("sleep", [String(Math.max(0.1, ms / 1000))]);
}

function emptyPayload(): IndicesPayload {
  return {
    generatedAt: new Date(0).toISOString(),
    source: "同花顺问财",
    skill: "hithink-zhishu-query",
    items: [],
  };
}

function readPrev(): IndicesPayload {
  if (!fs.existsSync(OUT)) return emptyPayload();
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8")) as IndicesPayload;
  } catch {
    return emptyPayload();
  }
}

function callCli(query: string): ZhishuCliBody | null {
  const res = spawnSync(
    "python3",
    [CLI, "--query", query, "--limit", "3"],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (res.status !== 0) {
    console.warn(
      `[indices:bake] CLI exit ${res.status} for ${JSON.stringify(query)}: ${(res.stderr || "").slice(0, 200)}`,
    );
    // Still try to parse stdout (CLI may print JSON errors)
    const rawErr = (res.stdout || "").trim();
    if (rawErr) {
      try {
        return JSON.parse(rawErr) as ZhishuCliBody;
      } catch {
        /* ignore */
      }
    }
    return null;
  }
  const raw = (res.stdout || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ZhishuCliBody;
  } catch (e) {
    console.warn(`[indices:bake] JSON parse fail: ${e}`);
    return null;
  }
}

function main(): void {
  const prev = readPrev();
  const key = process.env.IWENCAI_API_KEY;
  if (!key) {
    console.warn(
      "[indices:bake] IWENCAI_API_KEY missing — keeping last-good JSON",
    );
    if (!fs.existsSync(OUT)) {
      const empty: IndicesPayload = {
        ...emptyPayload(),
        generatedAt: new Date().toISOString(),
      };
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify(empty, null, 2) + "\n", "utf8");
    }
    process.exit(0);
  }

  const collected: IndexItem[] = [];

  for (let i = 0; i < INDEX_QUERIES.length; i++) {
    const { query, nameEn } = INDEX_QUERIES[i];
    const body = callCli(query);
    if (!body) {
      console.warn(`[indices:bake] miss ${query}`);
    } else {
      const items = mapZhishuResponse(body, { query, nameEn });
      console.log(`[indices:bake] ${query} → ${items.length} items`);
      collected.push(...items);
    }
    if (i < INDEX_QUERIES.length - 1) sleepSync(THROTTLE_MS);
  }

  const payload: IndicesPayload = {
    generatedAt: new Date().toISOString(),
    source: "同花顺问财",
    skill: "hithink-zhishu-query",
    items: collected.length ? collected : prev.items,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[indices:bake] wrote ${OUT} items=${payload.items.length} fresh=${collected.length > 0}`,
  );
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(0);
}
