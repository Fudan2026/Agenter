/**
 * Bake public/data/latest.json for the Quant Pages SPA.
 * Gate: ok+stale >= max(8, floor(n/2)).
 */

import fs from "node:fs";
import path from "node:path";

import { WATCHLIST } from "../data/watchlist";
import { fetchWatchlistOhlc } from "../lib/ohlc/runner";
import type { OHLC } from "../lib/ohlc/types";
import { detectRecentPatterns } from "../lib/patterns/detect";
import { buildDailyReview } from "../lib/review/daily-review";
import { indicatorSeries, summarizeSignals } from "../lib/signals/summary";

const TITLE = {
  zh: "量化复盘",
  en: "Quant review",
} as const;

const OUT = path.join("public", "data", "latest.json");
const GATE_MIN = Math.max(8, Math.floor(WATCHLIST.length / 2));
const CANDLE_DAYS = 120;
const SPARK_DAYS = 30;
const PATTERN_WINDOW = 60;

function shanghaiDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function candleDate(c: OHLC): string {
  return c.date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function pct1d(candles: OHLC[]): number | null {
  if (candles.length < 2) return null;
  const a = candles[candles.length - 2].close;
  const b = candles[candles.length - 1].close;
  if (!Number.isFinite(a) || a === 0) return null;
  return ((b - a) / a) * 100;
}

async function main() {
  console.log(`[quant:bake] fetching ${WATCHLIST.length} symbols…`);
  const { results, stats } = await fetchWatchlistOhlc(WATCHLIST);

  const bySymbol = new Map(results.map((r) => [r.symbol, r]));
  let patternHits = 0;

  const symbols = WATCHLIST.map((def) => {
    const fetched = bySymbol.get(def.symbol);
    const raw = fetched?.raw ?? null;
    const dataStatus = fetched?.dataStatus ?? "missing";
    const dataNote = fetched?.dataNote ?? "missing";
    const candlesFull = raw?.candles ?? [];
    const candles = candlesFull.slice(-CANDLE_DAYS).map((c) => ({
      date: candleDate(c),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    const sparkCloses = candlesFull.slice(-SPARK_DAYS).map((c) => c.close);
    const recentPatterns = detectRecentPatterns(candlesFull, PATTERN_WINDOW);
    patternHits += recentPatterns.length;
    const signals = summarizeSignals(candlesFull, recentPatterns);
    const series = indicatorSeries(candlesFull.slice(-CANDLE_DAYS));
    const lastClose =
      candlesFull.length > 0
        ? candlesFull[candlesFull.length - 1].close
        : raw?.regularMarketPrice ?? 0;

    return {
      symbol: def.symbol,
      nameZh: def.nameZh,
      nameEn: def.nameEn,
      group: def.group,
      dataStatus,
      dataNote,
      lastClose,
      pct1d: pct1d(candlesFull),
      sparkCloses,
      candles,
      recentPatterns,
      signals,
      ma20: series.sma20,
      ma60: series.sma60,
    };
  });

  const dailyReview = buildDailyReview(
    symbols.map((s) => ({
      symbol: s.symbol,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      pct1d: s.pct1d,
      dataStatus: s.dataStatus,
      recentPatterns: s.recentPatterns,
    })),
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    reportDate: shanghaiDate(),
    title: { ...TITLE },
    stats: {
      symbolsAttempted: stats.attempted,
      symbolsOk: stats.ok,
      symbolsStale: stats.stale,
      symbolsMissing: stats.missing,
      patternHits,
    },
    symbols,
    dailyReview,
  };

  const usable = stats.ok + stats.stale;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[quant:bake] wrote ${OUT} usable=${usable}/${stats.attempted} patternHits=${patternHits}`,
  );

  if (usable < GATE_MIN) {
    console.error(
      `[quant:bake] FAIL gate: ok+stale=${usable} < ${GATE_MIN}`,
    );
    process.exit(1);
  }
  console.log(`[quant:bake] OK gate (>= ${GATE_MIN})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
