/**
 * Bake public/data/factors.json from baked latest.json OHLC (no network).
 */

import fs from "node:fs";
import path from "node:path";

import { buildFactorBoard } from "../lib/factors/cross-section";
import { residualDiagnostics } from "../lib/stats/adf";
import type { LatestPayload } from "../pages/types";

const LATEST = path.join("public", "data", "latest.json");
const OUT = path.join("public", "data", "factors.json");

function main() {
  if (!fs.existsSync(LATEST)) {
    console.error(`[factors:bake] missing ${LATEST} — run quant:bake first`);
    process.exit(1);
  }
  const latest = JSON.parse(fs.readFileSync(LATEST, "utf8")) as LatestPayload;
  const payload = buildFactorBoard(
    latest.symbols.map((s) => ({
      symbol: s.symbol,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      group: s.group,
      candles: s.candles,
    })),
    { reportDate: latest.reportDate, topN: 8 },
  );

  payload.adfStrip = payload.adfStrip.map((row) => {
    const sym = latest.symbols.find((s) => s.symbol === row.symbol);
    const closes = sym?.candles.map((c) => c.close) ?? [];
    const diag = residualDiagnostics(closes);
    return {
      ...row,
      adfStat: diag.adf?.statistic ?? null,
      adfP: diag.adf?.pValue ?? null,
      stationary: diag.adf?.stationary ?? null,
      dailyVol: diag.vol ?? row.dailyVol,
    };
  });

  payload.generatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `[factors:bake] wrote ${OUT} · ${payload.factors.length} names · ADF strip ${payload.adfStrip.length}`,
  );
}

main();
