/**
 * EM → Yahoo → last-good cache orchestration (concurrency 4).
 * Distilled from OpenCool lib/trading/runner.ts; CN symbols only.
 */

import type { TickerDef } from "../../data/watchlist";
import { fetchEmKline, isCnAshareOrEtf } from "./eastmoney-kline";
import { loadOhlcvCache, saveOhlcvCache } from "./ohlcv-cache";
import type { SymbolFetchResult, TickerRawData } from "./types";
import { fetchTickerData } from "./yahoo";

const CONCURRENCY = 4;

export interface WatchlistFetchStats {
  attempted: number;
  ok: number;
  stale: number;
  missing: number;
}

async function fetchRawForTicker(
  def: TickerDef,
): Promise<{ raw: TickerRawData | null; source: "em" | "yahoo" | null }> {
  if (isCnAshareOrEtf(def.symbol)) {
    const em = await fetchEmKline(def.symbol);
    if (em && em.candles.length > 0) return { raw: em, source: "em" };
    const y = await fetchTickerData(def.symbol);
    if (y && y.candles.length > 0) return { raw: y, source: "yahoo" };
    return { raw: null, source: null };
  }
  const y = await fetchTickerData(def.symbol);
  if (y && y.candles.length > 0) return { raw: y, source: "yahoo" };
  return { raw: null, source: null };
}

/**
 * Fetch the watchlist with bounded concurrency.
 * Failures are non-fatal. Last-good cache yields stale rows.
 */
export async function fetchWatchlistOhlc(
  watchlist: TickerDef[],
): Promise<{ results: SymbolFetchResult[]; stats: WatchlistFetchStats }> {
  const out: (SymbolFetchResult | null)[] = new Array(watchlist.length).fill(
    null,
  );
  const stats: WatchlistFetchStats = {
    attempted: watchlist.length,
    ok: 0,
    stale: 0,
    missing: 0,
  };
  let i = 0;

  async function worker() {
    while (i < watchlist.length) {
      const idx = i++;
      const def = watchlist[idx];
      try {
        const { raw, source } = await fetchRawForTicker(def);
        if (raw && raw.candles.length > 0) {
          saveOhlcvCache(raw);
          out[idx] = {
            symbol: def.symbol,
            raw,
            dataStatus: "live",
            dataNote: source === "em" ? "East Money" : "Yahoo",
          };
          stats.ok++;
          continue;
        }

        const cached = loadOhlcvCache(def.symbol);
        if (cached) {
          out[idx] = {
            symbol: def.symbol,
            raw: cached.data,
            dataStatus: "stale",
            dataNote: `stale cache (${cached.savedAt.slice(0, 10)})`,
          };
          stats.stale++;
          console.warn(`[ohlc] ${def.symbol} live miss → last-good cache`);
          continue;
        }

        out[idx] = {
          symbol: def.symbol,
          raw: null,
          dataStatus: "missing",
          dataNote: "no live data or cache",
        };
        stats.missing++;
        console.warn(`[ohlc] ${def.symbol} returned no data`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[ohlc] ${def.symbol} failed: ${msg}`);
        const cached = loadOhlcvCache(def.symbol);
        if (cached) {
          out[idx] = {
            symbol: def.symbol,
            raw: cached.data,
            dataStatus: "stale",
            dataNote: `error then cache (${cached.savedAt.slice(0, 10)})`,
          };
          stats.stale++;
        } else {
          out[idx] = {
            symbol: def.symbol,
            raw: null,
            dataStatus: "missing",
            dataNote: msg,
          };
          stats.missing++;
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, watchlist.length) }, () =>
      worker(),
    ),
  );

  const successLike = stats.ok + stats.stale;
  console.log(
    `[ohlc] success rate: ${successLike}/${stats.attempted}` +
      ` (ok=${stats.ok} stale=${stats.stale} missing=${stats.missing})`,
  );

  return {
    results: out.filter((x): x is SymbolFetchResult => x !== null),
    stats,
  };
}
