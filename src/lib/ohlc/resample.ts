/**
 * Resample daily OHLCV into weekly / monthly bars (oldest-first).
 * Week = ISO week ending Friday (CN sessions); month = calendar month.
 */

import type { OHLC } from "./types";

export type Timeframe = "D" | "W" | "M";

export interface CandleBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function dateKey(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

function toOHLC(bar: CandleBar): OHLC {
  return {
    date: new Date(`${bar.date}T15:00:00+08:00`),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
}

/** Monday-based week key (YYYY-Www) for grouping. */
function weekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+08:00`);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat (local via +08 noon ≈ local)
  // Use Shanghai calendar components
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7));
  const dayNum = Number(dateStr.slice(8, 10));
  const local = new Date(Date.UTC(y, m - 1, dayNum));
  const dow = local.getUTCDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(local);
  monday.setUTCDate(local.getUTCDate() + mondayOffset);
  const my = monday.getUTCFullYear();
  const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const md = String(monday.getUTCDate()).padStart(2, "0");
  void day;
  return `${my}-${mm}-${md}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function aggregate(
  bars: CandleBar[],
  keyFn: (d: string) => string,
): CandleBar[] {
  const groups = new Map<string, CandleBar[]>();
  for (const b of bars) {
    const k = keyFn(b.date);
    const arr = groups.get(k);
    if (arr) arr.push(b);
    else groups.set(k, [b]);
  }
  const out: CandleBar[] = [];
  for (const [, g] of groups) {
    if (!g.length) continue;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const c of g) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
    }
    out.push({
      date: g[g.length - 1].date,
      open: g[0].open,
      high,
      low,
      close: g[g.length - 1].close,
      volume,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export function candlesToBars(
  candles: Array<CandleBar | OHLC>,
): CandleBar[] {
  return candles.map((c) => ({
    date: dateKey(c.date as Date | string),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

export function resampleBars(
  daily: CandleBar[],
  tf: Timeframe,
): CandleBar[] {
  if (tf === "D") return daily.slice();
  if (tf === "W") return aggregate(daily, weekKey);
  return aggregate(daily, monthKey);
}

export function resampleOhlc(candles: OHLC[], tf: Timeframe): OHLC[] {
  const bars = resampleBars(candlesToBars(candles), tf);
  return bars.map(toOHLC);
}

/** Honest sample span from bar count (≈252 sessions / year). */
export function sampleYearsFromBars(nBars: number): number {
  if (nBars <= 0) return 0;
  return Math.round((nBars / 252) * 10) / 10;
}
