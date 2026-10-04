/**
 * Bake public/data/transformer-pv-proxy.json — StockFormer literacy proxy (no weights).
 */

import fs from "node:fs";
import path from "node:path";

import { buildTransformerPvProxy } from "../lib/fin/attention-proxy";
import type { LatestPayload } from "../pages/types";

const LATEST = path.join("public", "data", "latest.json");
const OUT = path.join("public", "data", "transformer-pv-proxy.json");

function main() {
  if (!fs.existsSync(LATEST)) {
    console.error(`[transformer-pv] missing ${LATEST}`);
    process.exit(1);
  }
  const latest = JSON.parse(fs.readFileSync(LATEST, "utf8")) as LatestPayload;
  const payload = buildTransformerPvProxy(
    latest.symbols
      .filter((s) => s.dataStatus !== "missing")
      .map((s) => ({
        symbol: s.symbol,
        candles: (s.candles || []).map((c) => ({
          close: c.close,
          volume: c.volume,
        })),
      })),
    latest.reportDate,
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `[transformer-pv] wrote ${OUT} · ${payload.rows.length} symbols`,
  );
}

main();
