/**
 * Bake public/data/transformer-infer-bake.json — PatchTST-distill edge inference.
 */

import fs from "node:fs";
import path from "node:path";

import { buildTransformerInferBake } from "../lib/fin/transformer-inference";
import type { LatestPayload } from "../pages/types";

const LATEST = path.join("public", "data", "latest.json");
const OUT = path.join("public", "data", "transformer-infer-bake.json");

function main() {
  if (!fs.existsSync(LATEST)) {
    console.error(`[transformer-infer] missing ${LATEST}`);
    process.exit(1);
  }
  const latest = JSON.parse(fs.readFileSync(LATEST, "utf8")) as LatestPayload;
  const payload = buildTransformerInferBake(
    latest.symbols
      .filter((s) => s.dataStatus !== "missing")
      .map((s) => ({
        symbol: s.symbol,
        candles: (s.candles || []).map((c) => ({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        })),
      })),
    latest.reportDate,
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `[transformer-infer] wrote ${OUT} · ${payload.rows.length} symbols`,
  );
}

main();
