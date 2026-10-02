/**
 * Mark-to-market equity series for paper desk (fixes flat-line bug).
 * Walks baked OHLC closes between fills — marks use only closes ≤ date.
 */

import { equityMark } from "./engine";
import type { PaperJournalEntry, PaperPosition, PaperState } from "./types";

export interface CandleBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
  pnlPct: number;
  drawdownPct: number;
}

export interface TradeMarker {
  time: string;
  side: "buy" | "sell";
  symbol: string;
  price: number;
}

/** Latest bar index that still has a next session (honest next_open). */
export function defaultSignalDate(candles: CandleBar[]): string | null {
  if (candles.length >= 2) return candles[candles.length - 2].date;
  if (candles.length === 1) return candles[0].date;
  return null;
}

function applyFillToShadow(
  cash: number,
  positions: PaperPosition[],
  j: PaperJournalEntry,
): { cash: number; positions: PaperPosition[] } {
  const notional = j.qty * j.fillPrice;
  const fee = j.fee;
  const nextPos = positions.map((p) => ({ ...p }));
  if (j.side === "buy") {
    cash -= notional + fee;
    const idx = nextPos.findIndex((p) => p.symbol === j.symbol);
    if (idx >= 0) {
      const prev = nextPos[idx];
      const newQty = prev.qty + j.qty;
      const avgCost =
        (prev.avgCost * prev.qty + j.fillPrice * j.qty) / newQty;
      nextPos[idx] = { symbol: j.symbol, qty: newQty, avgCost };
    } else {
      nextPos.push({ symbol: j.symbol, qty: j.qty, avgCost: j.fillPrice });
    }
  } else {
    cash += notional - fee;
    const idx = nextPos.findIndex((p) => p.symbol === j.symbol);
    if (idx >= 0) {
      const prev = nextPos[idx];
      const remaining = prev.qty - j.qty;
      if (remaining <= 0) nextPos.splice(idx, 1);
      else nextPos[idx] = { ...prev, qty: remaining };
    }
  }
  return { cash, positions: nextPos };
}

function markOnDate(
  cash: number,
  positions: PaperPosition[],
  ohlcBySymbol: Record<string, CandleBar[]>,
  date: string,
): number {
  let eq = cash;
  for (const p of positions) {
    const bars = ohlcBySymbol[p.symbol] ?? [];
    let px = p.avgCost;
    for (const b of bars) {
      if (b.date <= date) px = b.close;
      else break;
    }
    eq += p.qty * px;
  }
  return eq;
}

/**
 * Build daily MTM equity from journal + per-symbol OHLC calendars.
 */
export function buildMarkToMarketSeries(
  state: PaperState,
  ohlcBySymbol: Record<string, CandleBar[]>,
): { points: EquityPoint[]; markers: TradeMarker[] } {
  const chronological = [...state.journal].reverse();
  const markers: TradeMarker[] = chronological.map((j) => ({
    time: j.fillDate,
    side: j.side,
    symbol: j.symbol,
    price: j.fillPrice,
  }));

  const dateSet = new Set<string>();
  for (const bars of Object.values(ohlcBySymbol)) {
    for (const b of bars) dateSet.add(b.date);
  }
  for (const j of chronological) {
    dateSet.add(j.fillDate);
    dateSet.add(j.signalDate);
  }
  const dates = [...dateSet].sort();

  if (!chronological.length) {
    const today =
      dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
    const lastMarks: Record<string, number> = {};
    for (const [sym, bars] of Object.entries(ohlcBySymbol)) {
      if (bars.length) lastMarks[sym] = bars[bars.length - 1].close;
    }
    const eq = equityMark(state, lastMarks);
    const pnlPct = ((eq - state.startingCash) / state.startingCash) * 100;
    const pt = { time: today, equity: eq, pnlPct, drawdownPct: 0 };
    return { points: [pt, { ...pt }], markers: [] };
  }

  const firstFill = chronological[0].fillDate;
  let startIdx = dates.indexOf(firstFill);
  if (startIdx < 0) startIdx = 0;
  startIdx = Math.max(0, startIdx - 1);
  const windowDates = dates.slice(startIdx);

  let cash = state.startingCash;
  let positions: PaperPosition[] = [];
  let fillPtr = 0;
  let peak = state.startingCash;
  const points: EquityPoint[] = [];

  if (windowDates.length) {
    points.push({
      time: windowDates[0],
      equity: state.startingCash,
      pnlPct: 0,
      drawdownPct: 0,
    });
  }

  for (const d of windowDates) {
    while (
      fillPtr < chronological.length &&
      chronological[fillPtr].fillDate === d
    ) {
      const next = applyFillToShadow(cash, positions, chronological[fillPtr]);
      cash = next.cash;
      positions = next.positions;
      fillPtr += 1;
    }

    const eq = markOnDate(cash, positions, ohlcBySymbol, d);
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    const pnlPct = ((eq - state.startingCash) / state.startingCash) * 100;
    const last = points[points.length - 1];
    if (last && last.time === d) {
      last.equity = eq;
      last.pnlPct = pnlPct;
      last.drawdownPct = dd;
    } else {
      points.push({ time: d, equity: eq, pnlPct, drawdownPct: dd });
    }
  }

  if (points.length === 1) points.push({ ...points[0] });
  return { points, markers };
}

export function drawdownSeries(
  points: EquityPoint[],
): Array<{ time: string; value: number }> {
  return points.map((p) => ({ time: p.time, value: -p.drawdownPct }));
}
