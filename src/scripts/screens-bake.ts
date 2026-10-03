/**
 * Bake public/data/screens.json from fixed editorial screens via vendored
 * hithink-astock-selector CLI. Fail-open: keep last-good JSON on missing key / errors.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  mapSelectorResponse,
  type ScreensPayload,
  type ScreenPanel,
  type SelectorCliBody,
} from "../lib/screens/map";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public", "data", "screens.json");
const CLI = path.join(
  ROOT,
  "skills",
  "hithink-astock-selector",
  "scripts",
  "cli.py",
);
const THROTTLE_MS = 400;
const TOP_N = 8;

/** Editorial Chinese screens (not interactive NL in browser). */
const SCREENS: Array<{
  id: string;
  nameZh: string;
  nameEn: string;
  query: string;
}> = [
  {
    id: "volume-up-5d",
    nameZh: "近5日放量上涨",
    nameEn: "5-day volume-up rallies",
    query: "近5日放量上涨",
  },
  {
    id: "baijiu-value",
    nameZh: "低估值白酒",
    nameEn: "Undervalued baijiu names",
    query: "低估值白酒",
  },
  {
    id: "semi-etf-strong",
    nameZh: "半导体ETF成分强势",
    nameEn: "Strong semiconductor / chip names",
    // Editorial panel title kept; NL query returns liquid A-share chip names.
    query: "半导体概念股涨幅居前",
  },
  {
    id: "high-div-low-vol",
    nameZh: "高股息低波动",
    nameEn: "High dividend · low vol",
    query: "高股息低波动",
  },
  {
    id: "nev-strong",
    nameZh: "新能源车强势",
    nameEn: "NEV leaders strong",
    query: "新能源车概念股涨幅居前",
  },
  {
    id: "broker-leaders",
    nameZh: "券商龙头",
    nameEn: "Brokerage leaders",
    query: "券商龙头",
  },
  {
    id: "bank-high-div",
    nameZh: "银行高股息",
    nameEn: "Bank high dividend",
    query: "银行高股息",
  },
  {
    id: "ai-compute",
    nameZh: "算力概念强势",
    nameEn: "AI compute strength",
    query: "算力概念股涨幅居前",
  },
  {
    id: "consumer-recovery",
    nameZh: "消费复苏",
    nameEn: "Consumer recovery names",
    query: "消费股涨幅居前",
  },
];

function sleepSync(ms: number): void {
  spawnSync("sleep", [String(Math.max(0.1, ms / 1000))]);
}

function emptyPayload(): ScreensPayload {
  return {
    generatedAt: new Date(0).toISOString(),
    source: "同花顺问财",
    skill: "hithink-astock-selector",
    screens: [],
  };
}

function readPrev(): ScreensPayload {
  if (!fs.existsSync(OUT)) return emptyPayload();
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8")) as ScreensPayload;
  } catch {
    return emptyPayload();
  }
}

function callCli(query: string): SelectorCliBody | null {
  const res = spawnSync(
    "python3",
    [CLI, "--query", query, "--limit", String(TOP_N)],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (res.status !== 0) {
    console.warn(
      `[screens:bake] CLI exit ${res.status} for ${JSON.stringify(query)}: ${(res.stderr || "").slice(0, 200)}`,
    );
    const rawErr = (res.stdout || "").trim();
    if (rawErr) {
      try {
        return JSON.parse(rawErr) as SelectorCliBody;
      } catch {
        /* ignore */
      }
    }
    return null;
  }
  const raw = (res.stdout || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SelectorCliBody;
  } catch (e) {
    console.warn(`[screens:bake] JSON parse fail: ${e}`);
    return null;
  }
}

function main(): void {
  const prev = readPrev();
  const key = process.env.IWENCAI_API_KEY;
  if (!key) {
    console.warn(
      "[screens:bake] IWENCAI_API_KEY missing — keeping last-good JSON",
    );
    if (!fs.existsSync(OUT)) {
      const empty: ScreensPayload = {
        ...emptyPayload(),
        generatedAt: new Date().toISOString(),
      };
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify(empty, null, 2) + "\n", "utf8");
    }
    process.exit(0);
  }

  const collected: ScreenPanel[] = [];

  for (let i = 0; i < SCREENS.length; i++) {
    const meta = SCREENS[i];
    const body = callCli(meta.query);
    if (!body) {
      console.warn(`[screens:bake] miss ${meta.query}`);
      // Keep placeholder panel so UI still shows six editorial slots
      collected.push({
        id: meta.id,
        nameZh: meta.nameZh,
        nameEn: meta.nameEn,
        query: meta.query,
        codeCount: 0,
        tickers: [],
      });
    } else {
      const panel = mapSelectorResponse(body, meta, TOP_N);
      console.log(
        `[screens:bake] ${meta.query} → ${panel.tickers.length} tickers (of ${panel.codeCount})`,
      );
      collected.push(panel);
    }
    if (i < SCREENS.length - 1) sleepSync(THROTTLE_MS);
  }

  const fresh = collected.some((s) => s.tickers.length > 0);
  const payload: ScreensPayload = {
    generatedAt: new Date().toISOString(),
    source: "同花顺问财",
    skill: "hithink-astock-selector",
    screens: fresh ? collected : prev.screens.length ? prev.screens : collected,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[screens:bake] wrote ${OUT} screens=${payload.screens.length} fresh=${fresh}`,
  );
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(0);
}
