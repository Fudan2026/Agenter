/**
 * Bake public/data/factors-ic.json from latest.json OHLC (no network).
 * Also attaches pairwise corr heatmap (macro vs A-share subset).
 */

import fs from "node:fs";
import path from "node:path";

import { buildFactorsIc } from "../lib/factors/ic";
import { buildCorrMatrix } from "../lib/stats/corr";
import type { LatestPayload } from "../pages/types";

const LATEST = path.join("public", "data", "latest.json");
const OUT = path.join("public", "data", "factors-ic.json");

function main() {
  if (!fs.existsSync(LATEST)) {
    console.error(`[factors:ic-bake] missing ${LATEST} — run quant:bake first`);
    process.exit(1);
  }
  const latest = JSON.parse(fs.readFileSync(LATEST, "utf8")) as LatestPayload;
  const rows = latest.symbols.map((s) => ({
    symbol: s.symbol,
    nameZh: s.nameZh,
    nameEn: s.nameEn,
    group: s.group,
    candles: s.candles,
  }));

  const payload = buildFactorsIc(rows, {
    reportDate: latest.reportDate,
    horizonBars: 21,
    step: 21,
  });

  // Corr heatmap: a few macro + liquid A-share / ETF names
  const prefer = [
    "000001.SS",
    "399001.SZ",
    "000300.SS",
    "399006.SZ",
    "510300.SS",
    "510050.SS",
    "600519.SS",
    "601318.SS",
    "000858.SZ",
    "300750.SZ",
  ];
  const series = prefer
    .map((id) => latest.symbols.find((s) => s.symbol === id))
    .filter((s): s is NonNullable<typeof s> => !!s && s.candles.length > 40)
    .map((s) => ({
      id: s.symbol,
      closes: s.candles.map((c) => c.close),
    }));
  // Fallback: first macros + first ashare
  if (series.length < 4) {
    for (const s of latest.symbols) {
      if (series.length >= 8) break;
      if (s.candles.length < 40) continue;
      if (series.some((x) => x.id === s.symbol)) continue;
      series.push({ id: s.symbol, closes: s.candles.map((c) => c.close) });
    }
  }
  payload.corrHeatmap = buildCorrMatrix(series);
  payload.generatedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `[factors:ic-bake] wrote ${OUT} · IC rows=${payload.rows.length} · corr pairs=${payload.corrHeatmap.length}`,
  );
}

main();
