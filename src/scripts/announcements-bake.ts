/**
 * Bake public/data/announcements.json from A-share watchlist via vendored
 * announcement-search CLI. Fail-open: keep last-good JSON on missing key / errors.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { WATCHLIST } from "../data/watchlist";
import {
  mapGatewayResponse,
  type AnnouncementItem,
  type AnnouncementsPayload,
  type GatewaySearchBody,
} from "../lib/announcements/map";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public", "data", "announcements.json");
const CLI = path.join(
  ROOT,
  "skills",
  "announcement-search",
  "scripts",
  "announcement_search.py",
);
const SIZE = 5;
const THROTTLE_MS = 400;

function sleepSync(ms: number): void {
  spawnSync("sleep", [String(Math.max(0.1, ms / 1000))]);
}

function readPrev(): AnnouncementsPayload {
  if (!fs.existsSync(OUT)) {
    return {
      generatedAt: new Date(0).toISOString(),
      source: "同花顺问财",
      skill: "announcement-search",
      items: [],
    };
  }
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8")) as AnnouncementsPayload;
  } catch {
    return {
      generatedAt: new Date(0).toISOString(),
      source: "同花顺问财",
      skill: "announcement-search",
      items: [],
    };
  }
}

function callCli(query: string): GatewaySearchBody | null {
  const res = spawnSync("python3", [CLI, query, "--size", String(SIZE)], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.warn(
      `[announcements:bake] CLI exit ${res.status} for ${JSON.stringify(query)}: ${(res.stderr || "").slice(0, 200)}`,
    );
    return null;
  }
  const raw = (res.stdout || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GatewaySearchBody;
  } catch (e) {
    console.warn(`[announcements:bake] JSON parse fail: ${e}`);
    return null;
  }
}

function main(): void {
  const prev = readPrev();
  const key = process.env.IWENCAI_API_KEY;
  if (!key) {
    console.warn(
      "[announcements:bake] IWENCAI_API_KEY missing — keeping last-good JSON",
    );
    if (!fs.existsSync(OUT)) {
      const empty: AnnouncementsPayload = {
        generatedAt: new Date().toISOString(),
        source: "同花顺问财",
        skill: "announcement-search",
        items: [],
      };
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify(empty, null, 2) + "\n", "utf8");
    }
    process.exit(0);
  }

  const ashare = WATCHLIST.filter((t) => t.group === "china-ashare");
  const collected: AnnouncementItem[] = [];

  for (let i = 0; i < ashare.length; i++) {
    const t = ashare[i];
    const query = `${t.nameZh} 最新公告`;
    const body = callCli(query);
    if (!body) {
      console.warn(`[announcements:bake] miss ${t.symbol}`);
    } else if (body.status_code !== 0) {
      console.warn(
        `[announcements:bake] status_code=${body.status_code} ${t.symbol}`,
      );
    } else {
      const items = mapGatewayResponse(body, {
        symbol: t.symbol,
        nameZh: t.nameZh,
      });
      console.log(
        `[announcements:bake] ${t.symbol} → ${items.length} items`,
      );
      collected.push(...items);
    }
    if (i < ashare.length - 1) sleepSync(THROTTLE_MS);
  }

  const items = (collected.length ? collected : prev.items)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));

  const payload: AnnouncementsPayload = {
    generatedAt: new Date().toISOString(),
    source: "同花顺问财",
    skill: "announcement-search",
    items,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[announcements:bake] wrote ${OUT} items=${payload.items.length} fresh=${collected.length > 0}`,
  );
}

try {
  main();
} catch (e) {
  console.error(e);
  // fail-open: do not fail CI
  process.exit(0);
}
