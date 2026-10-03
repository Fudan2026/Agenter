/**
 * Bake public/data/latest.json for the Quant Pages SPA.
 * Gate: ok+stale >= max(8, floor(n/2)).
 * Long-history OHLC (~10y target) + patternStats + timing + rotation.
 */

import fs from "node:fs";
import path from "node:path";

import { WATCHLIST } from "../data/watchlist";
import { compareRotationModes } from "../lib/etf/rotation";
import { EM_MAX_DAILY_BARS } from "../lib/ohlc/eastmoney-kline";
import { fetchWatchlistOhlc } from "../lib/ohlc/runner";
import { sampleYearsFromBars } from "../lib/ohlc/resample";
import type { OHLC } from "../lib/ohlc/types";
import { detectRecentPatterns } from "../lib/patterns/detect";
import { computePatternStats } from "../lib/patterns/stats";
import { buildDailyReview } from "../lib/review/daily-review";
import { indicatorSeries, summarizeSignals } from "../lib/signals/summary";
import { buildTimingBoard } from "../lib/timing/aggregate";

const TITLE = {
  zh: "量化复盘",
  en: "Quant review",
} as const;

const OUT = path.join("public", "data", "latest.json");
const PATTERN_STATS_OUT = path.join("public", "data", "pattern-stats.json");
const ETF_META_PATH = path.join("public", "data", "etf-meta.json");
const PRIOR_STATS_PATH = path.join("public", "data", "pattern-stats.json");
const GATE_MIN = Math.max(8, Math.floor(WATCHLIST.length / 2));
const CANDLE_DAYS = EM_MAX_DAILY_BARS;
const SPARK_DAYS = 30;
const PATTERN_WINDOW = 60;

interface EtfMetaFile {
  etfs: Record<
    string,
    {
      indexSymbol: string;
      sectorTags: string[];
      proxyConstituents: string[];
    }
  >;
}

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

function loadEtfMeta(): EtfMetaFile {
  try {
    return JSON.parse(fs.readFileSync(ETF_META_PATH, "utf8")) as EtfMetaFile;
  } catch {
    return { etfs: {} };
  }
}

function buildPatternMonitor(
  generatedAt: string,
  symbols: Array<{
    symbol: string;
    recentPatterns: Array<{ patternId: string; date: string }>;
  }>,
): {
  generatedAt: string;
  priorGeneratedAt: string | null;
  newHits: Array<{ symbol: string; patternId: string; date: string }>;
} {
  let priorGeneratedAt: string | null = null;
  let priorDates = new Set<string>();
  try {
    const prior = JSON.parse(fs.readFileSync(PRIOR_STATS_PATH, "utf8")) as {
      generatedAt?: string;
    };
    priorGeneratedAt = prior.generatedAt ?? null;
  } catch {
    /* first bake */
  }
  // Compare recent pattern date keys vs a stamp file of last hits
  const hitStampPath = path.join("public", "data", "pattern-hit-stamp.json");
  try {
    const stamp = JSON.parse(fs.readFileSync(hitStampPath, "utf8")) as {
      keys?: string[];
    };
    priorDates = new Set(stamp.keys ?? []);
  } catch {
    priorDates = new Set();
  }

  const newHits: Array<{ symbol: string; patternId: string; date: string }> =
    [];
  const allKeys: string[] = [];
  for (const s of symbols) {
    for (const p of s.recentPatterns) {
      const key = `${s.symbol}|${p.patternId}|${p.date}`;
      allKeys.push(key);
      if (!priorDates.has(key)) {
        newHits.push({
          symbol: s.symbol,
          patternId: p.patternId,
          date: p.date,
        });
      }
    }
  }
  fs.writeFileSync(
    hitStampPath,
    JSON.stringify({ generatedAt, keys: allKeys }, null, 2) + "\n",
    "utf8",
  );
  return {
    generatedAt,
    priorGeneratedAt,
    newHits: newHits.slice(0, 40),
  };
}

async function main() {
  console.log(
    `[quant:bake] fetching ${WATCHLIST.length} symbols (lmt≈${CANDLE_DAYS})…`,
  );
  const { results, stats } = await fetchWatchlistOhlc(WATCHLIST);
  const etfMeta = loadEtfMeta();

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
    const series = indicatorSeries(
      candlesFull.slice(-Math.min(CANDLE_DAYS, 400)),
    );
    const lastClose =
      candlesFull.length > 0
        ? candlesFull[candlesFull.length - 1].close
        : raw?.regularMarketPrice ?? 0;
    const patternStats = computePatternStats(def.symbol, candlesFull);
    const nBars = candles.length;
    const sampleYears = sampleYearsFromBars(nBars);
    const sectorTags = etfMeta.etfs[def.symbol]?.sectorTags;

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
      nBars,
      sampleYears,
      recentPatterns,
      patternStats: patternStats.patterns,
      sectorTags,
      signals,
      ma20: series.sma20,
      ma60: series.sma60,
    };
  });

  const timing = buildTimingBoard(
    etfMeta.etfs,
    symbols.map((s) => ({
      symbol: s.symbol,
      recentPatterns: s.recentPatterns,
      pct1d: s.pct1d,
    })),
  );

  const timingBySym = new Map(timing.map((t) => [t.symbol, t]));
  const rotationEtfs = symbols
    .filter((s) => s.group === "china-etf" && s.candles.length > 40)
    .map((s) => {
      const bull = s.recentPatterns.filter((p) => p.direction === "bull").length;
      const bear = s.recentPatterns.filter((p) => p.direction === "bear").length;
      return {
        symbol: s.symbol,
        nameZh: s.nameZh,
        nameEn: s.nameEn,
        closes: s.candles.map((c) => c.close),
        timingScore: timingBySym.get(s.symbol)?.score ?? 0,
        patternMomentum: bull - bear,
      };
    });
  const rotation = compareRotationModes(rotationEtfs, {
    horizon: Math.min(120, ...rotationEtfs.map((e) => e.closes.length)),
    topK: 3,
    timingThreshold: 0,
  });

  const dailyReview = buildDailyReview(
    symbols.map((s) => ({
      symbol: s.symbol,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      group: s.group,
      pct1d: s.pct1d,
      dataStatus: s.dataStatus,
      recentPatterns: s.recentPatterns,
      patternStats: s.patternStats,
      sampleYears: s.sampleYears,
      nBars: s.nBars,
      sectorTags: s.sectorTags,
    })),
  );

  const generatedAt = new Date().toISOString();
  const patternMonitor = buildPatternMonitor(generatedAt, symbols);

  const payload = {
    generatedAt,
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
    timing,
    rotation: {
      daily: {
        mode: rotation.daily.mode,
        timingOverlay: rotation.daily.timingOverlay,
        totalReturn: rotation.daily.totalReturn,
        maxDrawdown: rotation.daily.maxDrawdown,
        turns: rotation.daily.turns,
        lastWeights: rotation.daily.lastWeights,
        equityLast: rotation.daily.equity.slice(-1)[0],
      },
      fixed_5d: {
        mode: rotation.fixed_5d.mode,
        timingOverlay: rotation.fixed_5d.timingOverlay,
        totalReturn: rotation.fixed_5d.totalReturn,
        maxDrawdown: rotation.fixed_5d.maxDrawdown,
        turns: rotation.fixed_5d.turns,
        lastWeights: rotation.fixed_5d.lastWeights,
        equityLast: rotation.fixed_5d.equity.slice(-1)[0],
      },
      dailyTimed: {
        mode: rotation.dailyTimed.mode,
        timingOverlay: true,
        totalReturn: rotation.dailyTimed.totalReturn,
        maxDrawdown: rotation.dailyTimed.maxDrawdown,
        turns: rotation.dailyTimed.turns,
        lastWeights: rotation.dailyTimed.lastWeights,
        equityLast: rotation.dailyTimed.equity.slice(-1)[0],
      },
      fixed_5dTimed: {
        mode: rotation.fixed_5dTimed.mode,
        timingOverlay: true,
        totalReturn: rotation.fixed_5dTimed.totalReturn,
        maxDrawdown: rotation.fixed_5dTimed.maxDrawdown,
        turns: rotation.fixed_5dTimed.turns,
        lastWeights: rotation.fixed_5dTimed.lastWeights,
        equityLast: rotation.fixed_5dTimed.equity.slice(-1)[0],
      },
    },
    patternMonitor,
  };

  const patternStatsSidecar = {
    generatedAt: payload.generatedAt,
    symbols: symbols.map((s) => ({
      symbol: s.symbol,
      nBars: s.nBars,
      sampleYears: s.sampleYears,
      patterns: s.patternStats,
    })),
  };

  const usable = stats.ok + stats.stale;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  fs.writeFileSync(
    PATTERN_STATS_OUT,
    JSON.stringify(patternStatsSidecar, null, 2) + "\n",
    "utf8",
  );
  console.log(
    `[quant:bake] wrote ${OUT} + ${PATTERN_STATS_OUT} usable=${usable}/${stats.attempted} patternHits=${patternHits} timing=${timing.length}`,
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
