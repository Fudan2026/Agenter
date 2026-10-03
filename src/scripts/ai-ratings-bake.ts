/**
 * Fail-open bake of public/data/ai-ratings.json from published Arena JSON
 * (+ optional AA-style export). Never mutates agents.json editorial scores.
 *
 * Primary: raw JSON from a public Arena leaderboard snapshot repo.
 * Secondary: optional AA models JSON when reachable.
 */

import fs from "node:fs";
import path from "node:path";

import {
  mapAiRatings,
  type AaModelRow,
  type AiRatingAlias,
  type ArenaLeaderboardRow,
} from "../lib/ai-ratings/map";

const OUT = path.join("public", "data", "ai-ratings.json");
const ALIASES = path.join("public", "data", "ai-rating-aliases.json");
const VENDOR_ARENA = path.join("vendor", "arena-leaderboards", "text.json");

const ARENA_URLS = [
  "https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/data/latest.json",
  "https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/data/text.json",
  "https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/text.json",
];

const AA_URLS = [
  "https://raw.githubusercontent.com/MaurerAnton/artificialanalysis-ai-parser/main/data/models.json",
  "https://raw.githubusercontent.com/MaurerAnton/artificialanalysis-ai-parser/main/models.json",
];

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Agenter/0.1" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function asArenaRows(data: unknown): ArenaLeaderboardRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ArenaLeaderboardRow[];
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["leaderboard", "models", "rows", "data", "text"]) {
      if (Array.isArray(o[key])) return o[key] as ArenaLeaderboardRow[];
    }
    // nested category files
    if (o.categories && typeof o.categories === "object") {
      const cats = o.categories as Record<string, unknown>;
      for (const v of Object.values(cats)) {
        if (Array.isArray(v)) return v as ArenaLeaderboardRow[];
        if (v && typeof v === "object" && Array.isArray((v as { rows?: unknown }).rows)) {
          return (v as { rows: ArenaLeaderboardRow[] }).rows;
        }
      }
    }
  }
  return [];
}

function asAaRows(data: unknown): AaModelRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as AaModelRow[];
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["models", "rows", "data"]) {
      if (Array.isArray(o[key])) return o[key] as AaModelRow[];
    }
  }
  return [];
}

function loadPrior(): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function main() {
  const aliasFile = JSON.parse(fs.readFileSync(ALIASES, "utf8")) as {
    aliases: AiRatingAlias[];
  };
  const sources: string[] = [];
  let arenaRows: ArenaLeaderboardRow[] = [];
  let aaRows: AaModelRow[] = [];

  // Vendored snapshot first (deterministic CI)
  if (fs.existsSync(VENDOR_ARENA)) {
    try {
      const raw = JSON.parse(fs.readFileSync(VENDOR_ARENA, "utf8")) as unknown;
      arenaRows = asArenaRows(raw);
      if (arenaRows.length) sources.push("vendor:arena-leaderboards/text.json");
    } catch {
      /* ignore */
    }
  }

  if (!arenaRows.length) {
    for (const url of ARENA_URLS) {
      const data = await fetchJson(url);
      const rows = asArenaRows(data);
      if (rows.length) {
        arenaRows = rows;
        sources.push(`arena:${url}`);
        break;
      }
    }
  }

  for (const url of AA_URLS) {
    const data = await fetchJson(url);
    const rows = asAaRows(data);
    if (rows.length) {
      aaRows = rows;
      sources.push(`aa:${url}`);
      break;
    }
  }

  if (!arenaRows.length && !aaRows.length) {
    console.warn(
      "[ai-ratings:bake] no live sources — keeping last-good ai-ratings.json",
    );
    const prior = loadPrior();
    if (prior) {
      process.exit(0);
    }
    // write empty seed
    const empty = mapAiRatings(aliasFile.aliases, [], [], ["seed:empty"]);
    fs.writeFileSync(OUT, JSON.stringify(empty, null, 2) + "\n", "utf8");
    process.exit(0);
  }

  const payload = mapAiRatings(
    aliasFile.aliases,
    arenaRows,
    aaRows,
    sources.length ? sources : ["unknown"],
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[ai-ratings:bake] wrote ${OUT} rows=${payload.rows.length} sources=${sources.join(",")}`,
  );
}

main().catch((e) => {
  console.error("[ai-ratings:bake] fail-open", e);
  process.exit(0);
});
