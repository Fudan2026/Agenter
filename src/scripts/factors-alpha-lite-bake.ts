/**
 * Bake public/data/factors-alpha-lite.json from latest.json OHLC (no network).
 * Distill of Qlib Alpha158 subset (Alpha40-lite).
 */

import fs from "node:fs";
import path from "node:path";

import { buildAlphaLiteBoard } from "../lib/factors/alpha-lite";
import type { LatestPayload } from "../pages/types";

const LATEST = path.join("public", "data", "latest.json");
const OUT = path.join("public", "data", "factors-alpha-lite.json");

function main() {
  if (!fs.existsSync(LATEST)) {
    console.error(`[factors:alpha-lite] missing ${LATEST} — run quant:bake first`);
    process.exit(1);
  }
  const latest = JSON.parse(fs.readFileSync(LATEST, "utf8")) as LatestPayload;
  const payload = buildAlphaLiteBoard(
    latest.symbols.map((s) => ({
      symbol: s.symbol,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      candles: (s.candles || []).map((c) => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
    })),
    { reportDate: latest.reportDate, topN: 12 },
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `[factors:alpha-lite] wrote ${OUT} · universe ${payload.universe.length} · top ${payload.topN.length}`,
  );
}

main();
