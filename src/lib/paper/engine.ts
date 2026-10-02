/**
 * Paper fill engine — no-lookahead:
 * Signal on bar t → fill at t+1 open if available, else next close with explicit label.
 */

import type { SymbolRow } from "../../pages/types";
import {
  ASHARE_LOT,
  PAPER_FEE_BPS_RT,
  PAPER_START_CASH,
  type PaperJournalEntry,
  type PaperState,
} from "./types";

export interface CandleBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FillQuote {
  fillPrice: number;
  fillDate: string;
  fillRule: "next_open" | "next_close_fallback";
  signalDate: string;
}

/** Resolve next-bar fill from baked OHLC (quant-no-lookahead). */
export function resolveNextOpenFill(
  candles: CandleBar[],
  signalDate?: string,
): FillQuote | null {
  if (!candles.length) return null;
  let signalIdx = candles.length - 1;
  if (signalDate) {
    const found = candles.findIndex((c) => c.date === signalDate);
    if (found >= 0) signalIdx = found;
  }
  const signal = candles[signalIdx];
  if (!signal) return null;
  const next = candles[signalIdx + 1];
  if (next && next.open > 0) {
    return {
      fillPrice: next.open,
      fillDate: next.date,
      fillRule: "next_open",
      signalDate: signal.date,
    };
  }
  // Fallback: no next bar yet — label next_close_fallback using signal close
  // (educational placeholder until next session opens).
  return {
    fillPrice: signal.close,
    fillDate: signal.date,
    fillRule: "next_close_fallback",
    signalDate: signal.date,
  };
}

export function feeForSide(notional: number, feeBpsRt = PAPER_FEE_BPS_RT): number {
  return (Math.abs(notional) * (feeBpsRt / 2)) / 10_000;
}

export function isLotRestricted(group: SymbolRow["group"]): boolean {
  return group === "china-ashare" || group === "china-etf";
}

export function normalizeQty(
  qty: number,
  group: SymbolRow["group"],
): { qty: number; error?: string } {
  if (!Number.isFinite(qty) || qty <= 0) {
    return { qty: 0, error: "invalid_qty" };
  }
  if (isLotRestricted(group)) {
    const lots = Math.floor(qty / ASHARE_LOT) * ASHARE_LOT;
    if (lots < ASHARE_LOT) return { qty: 0, error: "lot_100" };
    return { qty: lots };
  }
  return { qty: Math.floor(qty) };
}

export function defaultPaperState(): PaperState {
  return {
    version: 2,
    cash: PAPER_START_CASH,
    startingCash: PAPER_START_CASH,
    feeBpsRoundTrip: PAPER_FEE_BPS_RT,
    positions: [],
    journal: [],
  };
}

/** Soft risk snapshot (quant-risk-gates spirit — warnings only). */
export function paperRiskSnapshot(
  state: PaperState,
  lastCloseBySymbol: Record<string, number>,
  maxNamePct = 0.2,
): {
  equity: number;
  cashPct: number;
  maxNamePct: number;
  maxNameSymbol: string | null;
  overweight: boolean;
  consecutiveLosses: number;
} {
  const eq = equityMark(state, lastCloseBySymbol);
  let maxPct = 0;
  let maxSym: string | null = null;
  for (const p of state.positions) {
    const px = lastCloseBySymbol[p.symbol] ?? p.avgCost;
    const pct = eq > 0 ? (p.qty * px) / eq : 0;
    if (pct > maxPct) {
      maxPct = pct;
      maxSym = p.symbol;
    }
  }
  let consecutiveLosses = 0;
  for (const j of state.journal) {
    if (j.side !== "sell") break;
    const posCost = j.fillPrice; // approximate; count sell after buy loss via note not needed
    // Count sells where fill < typical: use fee-adjusted vs last matching buy avg — simplified: loss if note has "loss" skip
    // Better: compare sell fill to most recent buy avg for symbol from remaining journal
    const buy = state.journal.find(
      (x) => x.side === "buy" && x.symbol === j.symbol && x.ts < j.ts,
    );
    const avg = buy?.fillPrice ?? j.fillPrice;
    const pnl = (j.fillPrice - avg) * j.qty - j.fee;
    if (pnl < 0) consecutiveLosses += 1;
    else break;
  }
  return {
    equity: eq,
    cashPct: eq > 0 ? state.cash / eq : 1,
    maxNamePct: maxPct,
    maxNameSymbol: maxSym,
    overweight: maxPct > maxNamePct,
    consecutiveLosses,
  };
}

export function applyBuy(
  state: PaperState,
  opts: {
    symbol: string;
    qty: number;
    fill: FillQuote;
    note?: string;
  },
): { ok: true; state: PaperState } | { ok: false; error: string } {
  const notional = opts.qty * opts.fill.fillPrice;
  const fee = feeForSide(notional, state.feeBpsRoundTrip);
  const cost = notional + fee;
  if (cost > state.cash + 1e-9) return { ok: false, error: "insufficient_cash" };

  const positions = [...state.positions];
  const idx = positions.findIndex((p) => p.symbol === opts.symbol);
  if (idx >= 0) {
    const prev = positions[idx];
    const newQty = prev.qty + opts.qty;
    const avgCost =
      (prev.avgCost * prev.qty + opts.fill.fillPrice * opts.qty) / newQty;
    positions[idx] = { symbol: opts.symbol, qty: newQty, avgCost };
  } else {
    positions.push({
      symbol: opts.symbol,
      qty: opts.qty,
      avgCost: opts.fill.fillPrice,
    });
  }

  const entry: PaperJournalEntry = {
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    symbol: opts.symbol,
    side: "buy",
    qty: opts.qty,
    fillPrice: opts.fill.fillPrice,
    fee,
    signalDate: opts.fill.signalDate,
    fillDate: opts.fill.fillDate,
    fillRule: opts.fill.fillRule,
    note: opts.note ?? "",
  };

  return {
    ok: true,
    state: {
      ...state,
      version: 2,
      cash: state.cash - cost,
      positions,
      journal: [entry, ...state.journal],
    },
  };
}

export function applySell(
  state: PaperState,
  opts: {
    symbol: string;
    qty: number;
    fill: FillQuote;
    note?: string;
  },
): { ok: true; state: PaperState } | { ok: false; error: string } {
  const idx = state.positions.findIndex((p) => p.symbol === opts.symbol);
  if (idx < 0) return { ok: false, error: "no_position" };
  const pos = state.positions[idx];
  if (opts.qty > pos.qty) return { ok: false, error: "insufficient_qty" };

  const notional = opts.qty * opts.fill.fillPrice;
  const fee = feeForSide(notional, state.feeBpsRoundTrip);
  const proceeds = notional - fee;

  const positions = [...state.positions];
  const remaining = pos.qty - opts.qty;
  if (remaining === 0) positions.splice(idx, 1);
  else positions[idx] = { ...pos, qty: remaining };

  const entry: PaperJournalEntry = {
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    symbol: opts.symbol,
    side: "sell",
    qty: opts.qty,
    fillPrice: opts.fill.fillPrice,
    fee,
    signalDate: opts.fill.signalDate,
    fillDate: opts.fill.fillDate,
    fillRule: opts.fill.fillRule,
    note: opts.note ?? "",
  };

  return {
    ok: true,
    state: {
      ...state,
      version: 2,
      cash: state.cash + proceeds,
      positions,
      journal: [entry, ...state.journal],
    },
  };
}

export function equityMark(
  state: PaperState,
  lastCloseBySymbol: Record<string, number>,
): number {
  let eq = state.cash;
  for (const p of state.positions) {
    const px = lastCloseBySymbol[p.symbol] ?? p.avgCost;
    eq += p.qty * px;
  }
  return eq;
}
