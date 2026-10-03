/**
 * Paper fill engine — no-lookahead:
 * Signal on bar t → fill at t+1 open if available, else next close with explicit label.
 */

import type { SymbolRow } from "../../pages/types";
import {
  computeTradeCosts,
  DEFAULT_COST_CONFIG,
  isLimitLocked,
  type CostConfig,
} from "./costs";
import {
  ASHARE_LOT,
  DEFAULT_RISK_LIMITS,
  PAPER_FEE_BPS_RT,
  PAPER_START_CASH,
  type PaperJournalEntry,
  type PaperState,
} from "./types";
import {
  nextSessionIndex,
  type CnCalendarPayload,
} from "./calendar";
import {
  bracketLevelsFromPct,
  findBracketExit,
  positionHasBrackets,
} from "./brackets";

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
  calendar?: CnCalendarPayload | null,
): FillQuote | null {
  if (!candles.length) return null;
  let signalIdx = candles.length - 1;
  if (signalDate) {
    const found = candles.findIndex((c) => c.date === signalDate);
    if (found >= 0) signalIdx = found;
  }
  const signal = candles[signalIdx];
  if (!signal) return null;

  let nextIdx = signalIdx + 1;
  if (calendar) {
    nextIdx = nextSessionIndex(
      candles.map((c) => c.date),
      signalIdx,
      calendar,
    );
  }
  const next = nextIdx >= 0 ? candles[nextIdx] : undefined;
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
    costModelEnabled: true,
    costConfig: { ...DEFAULT_COST_CONFIG },
    boughtLots: {},
    riskLimits: { ...DEFAULT_RISK_LIMITS },
    priorEquityMark: PAPER_START_CASH,
  };
}

function resolveCostCfg(state: PaperState): CostConfig {
  const base = state.costConfig ?? DEFAULT_COST_CONFIG;
  return {
    ...base,
    enabled: state.costModelEnabled !== false,
  };
}

function sellableQty(state: PaperState, symbol: string, fillDate: string): number {
  const pos = state.positions.find((p) => p.symbol === symbol);
  if (!pos) return 0;
  const lots = state.boughtLots?.[symbol] ?? [];
  const locked = lots
    .filter((l) => l.fillDate === fillDate)
    .reduce((s, l) => s + l.qty, 0);
  return Math.max(0, pos.qty - locked);
}

/** Soft risk snapshot (quant-risk-gates spirit — warnings only). */
export function paperRiskSnapshot(
  state: PaperState,
  lastCloseBySymbol: Record<string, number>,
  maxNamePct = state.riskLimits?.maxNamePct ?? DEFAULT_RISK_LIMITS.maxNamePct,
): {
  equity: number;
  cashPct: number;
  maxNamePct: number;
  maxNameSymbol: string | null;
  overweight: boolean;
  consecutiveLosses: number;
  openNames: number;
  dailyLossPct: number;
  dailyLossHalt: boolean;
} {
  const limits = { ...DEFAULT_RISK_LIMITS, ...(state.riskLimits ?? {}) };
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
    const buy = state.journal.find(
      (x) => x.side === "buy" && x.symbol === j.symbol && x.ts < j.ts,
    );
    const avg = buy?.fillPrice ?? j.fillPrice;
    const pnl = (j.fillPrice - avg) * j.qty - j.fee;
    if (pnl < 0) consecutiveLosses += 1;
    else break;
  }
  const prior = state.priorEquityMark ?? state.startingCash;
  const dailyLossPct = prior > 0 ? (prior - eq) / prior : 0;
  return {
    equity: eq,
    cashPct: eq > 0 ? state.cash / eq : 1,
    maxNamePct: maxPct,
    maxNameSymbol: maxSym,
    overweight: maxPct > maxNamePct,
    consecutiveLosses,
    openNames: state.positions.filter((p) => p.qty > 0).length,
    dailyLossPct,
    dailyLossHalt: dailyLossPct >= limits.dailyLossPct,
  };
}

export function applyBuy(
  state: PaperState,
  opts: {
    symbol: string;
    qty: number;
    fill: FillQuote;
    note?: string;
    source?: PaperJournalEntry["source"];
    playbookTag?: PaperJournalEntry["playbookTag"];
    sliceLabel?: string;
    lastCloseBySymbol?: Record<string, number>;
    prevClose?: number;
  },
): { ok: true; state: PaperState } | { ok: false; error: string } {
  if (
    opts.prevClose != null &&
    isLimitLocked({
      symbol: opts.symbol,
      side: "buy",
      prevClose: opts.prevClose,
      fillPrice: opts.fill.fillPrice,
    })
  ) {
    return { ok: false, error: "limit_up" };
  }

  const notional = opts.qty * opts.fill.fillPrice;
  const cfg = resolveCostCfg(state);
  const breakdown = cfg.enabled
    ? computeTradeCosts({
        side: "buy",
        notional,
        symbol: opts.symbol,
        cfg,
      })
    : {
        commission: feeForSide(notional, state.feeBpsRoundTrip),
        stampDuty: 0,
        transferFee: 0,
        slippage: 0,
        total: feeForSide(notional, state.feeBpsRoundTrip),
      };
  const fee = breakdown.total;
  const cost = notional + fee;
  if (cost > state.cash + 1e-9) return { ok: false, error: "insufficient_cash" };

  if (state.hardRiskGates && opts.lastCloseBySymbol) {
    const limits = { ...DEFAULT_RISK_LIMITS, ...(state.riskLimits ?? {}) };
    const riskNow = paperRiskSnapshot(state, opts.lastCloseBySymbol);
    if (riskNow.dailyLossHalt) return { ok: false, error: "risk_daily_loss" };
    const projectedCash = state.cash - cost;
    const projectedPositions = [...state.positions];
    const idx = projectedPositions.findIndex((p) => p.symbol === opts.symbol);
    if (idx >= 0) {
      const prev = projectedPositions[idx];
      projectedPositions[idx] = { ...prev, qty: prev.qty + opts.qty };
    } else {
      if (projectedPositions.length >= limits.maxOpenNames) {
        return { ok: false, error: "risk_max_names" };
      }
      projectedPositions.push({
        symbol: opts.symbol,
        qty: opts.qty,
        avgCost: opts.fill.fillPrice,
      });
    }
    const shadow: PaperState = {
      ...state,
      cash: projectedCash,
      positions: projectedPositions,
    };
    const risk = paperRiskSnapshot(
      shadow,
      opts.lastCloseBySymbol,
      limits.maxNamePct,
    );
    if (risk.overweight) return { ok: false, error: "risk_overweight" };
    if (risk.cashPct < limits.minCashPct) return { ok: false, error: "risk_cash" };
  }

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

  const boughtLots = { ...(state.boughtLots ?? {}) };
  const lots = [...(boughtLots[opts.symbol] ?? [])];
  lots.push({ qty: opts.qty, fillDate: opts.fill.fillDate });
  boughtLots[opts.symbol] = lots;

  const entry: PaperJournalEntry = {
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    symbol: opts.symbol,
    side: "buy",
    qty: opts.qty,
    fillPrice: opts.fill.fillPrice,
    fee,
    feeCommission: breakdown.commission,
    feeStampDuty: breakdown.stampDuty,
    feeTransfer: breakdown.transferFee,
    feeSlippage: breakdown.slippage,
    signalDate: opts.fill.signalDate,
    fillDate: opts.fill.fillDate,
    fillRule: opts.fill.fillRule,
    note: opts.note ?? "",
    source: opts.source ?? "manual",
    playbookTag: opts.playbookTag,
    sliceLabel: opts.sliceLabel,
  };

  return {
    ok: true,
    state: {
      ...state,
      version: 2,
      cash: state.cash - cost,
      positions,
      boughtLots,
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
    source?: PaperJournalEntry["source"];
    playbookTag?: PaperJournalEntry["playbookTag"];
    sliceLabel?: string;
    prevClose?: number;
  },
): { ok: true; state: PaperState } | { ok: false; error: string } {
  const idx = state.positions.findIndex((p) => p.symbol === opts.symbol);
  if (idx < 0) return { ok: false, error: "no_position" };
  const pos = state.positions[idx];
  if (opts.qty > pos.qty) return { ok: false, error: "insufficient_qty" };

  const sellable = sellableQty(state, opts.symbol, opts.fill.fillDate);
  if (opts.qty > sellable) return { ok: false, error: "t1_lock" };

  if (
    opts.prevClose != null &&
    isLimitLocked({
      symbol: opts.symbol,
      side: "sell",
      prevClose: opts.prevClose,
      fillPrice: opts.fill.fillPrice,
    })
  ) {
    return { ok: false, error: "limit_down" };
  }

  const notional = opts.qty * opts.fill.fillPrice;
  const cfg = resolveCostCfg(state);
  const breakdown = cfg.enabled
    ? computeTradeCosts({
        side: "sell",
        notional,
        symbol: opts.symbol,
        cfg,
      })
    : {
        commission: feeForSide(notional, state.feeBpsRoundTrip),
        stampDuty: 0,
        transferFee: 0,
        slippage: 0,
        total: feeForSide(notional, state.feeBpsRoundTrip),
      };
  const fee = breakdown.total;
  const proceeds = notional - fee;

  const positions = [...state.positions];
  const remaining = pos.qty - opts.qty;
  if (remaining === 0) positions.splice(idx, 1);
  else positions[idx] = { ...pos, qty: remaining };

  // Consume lots FIFO preferring unlocked (older) lots
  const boughtLots = { ...(state.boughtLots ?? {}) };
  let left = opts.qty;
  const lots = [...(boughtLots[opts.symbol] ?? [])];
  const nextLots = [];
  for (const lot of lots) {
    if (left <= 0) {
      nextLots.push(lot);
      continue;
    }
    if (lot.fillDate === opts.fill.fillDate) {
      nextLots.push(lot);
      continue;
    }
    const take = Math.min(lot.qty, left);
    left -= take;
    if (lot.qty > take) nextLots.push({ ...lot, qty: lot.qty - take });
  }
  if (left > 0) {
    // should not happen if sellable checked
    return { ok: false, error: "t1_lock" };
  }
  if (nextLots.length) boughtLots[opts.symbol] = nextLots;
  else delete boughtLots[opts.symbol];

  const entry: PaperJournalEntry = {
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    symbol: opts.symbol,
    side: "sell",
    qty: opts.qty,
    fillPrice: opts.fill.fillPrice,
    fee,
    feeCommission: breakdown.commission,
    feeStampDuty: breakdown.stampDuty,
    feeTransfer: breakdown.transferFee,
    feeSlippage: breakdown.slippage,
    signalDate: opts.fill.signalDate,
    fillDate: opts.fill.fillDate,
    fillRule: opts.fill.fillRule,
    note: opts.note ?? "",
    source: opts.source ?? "manual",
    playbookTag: opts.playbookTag,
    sliceLabel: opts.sliceLabel,
  };

  return {
    ok: true,
    state: {
      ...state,
      version: 2,
      cash: state.cash + proceeds,
      positions,
      boughtLots,
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

/** Attach / update TP/SL percentages on an open position. */
export function attachBrackets(
  state: PaperState,
  symbol: string,
  stopPct: number,
  takeProfitPct: number,
): PaperState {
  const positions = state.positions.map((p) =>
    p.symbol === symbol
      ? {
          ...p,
          stopPct: stopPct > 0 ? stopPct : undefined,
          takeProfitPct: takeProfitPct > 0 ? takeProfitPct : undefined,
        }
      : p,
  );
  return { ...state, version: 2, positions };
}

/**
 * Sweep open positions with brackets against baked OHLC.
 * Same-bar SL+TP → stop first (pessimistic).
 */
export function sweepBrackets(
  state: PaperState,
  candlesBySymbol: Record<string, CandleBar[]>,
): { state: PaperState; closed: number } {
  let next = state;
  let closed = 0;
  for (const pos of [...state.positions]) {
    if (!positionHasBrackets(pos)) continue;
    const levels = bracketLevelsFromPct(
      pos.avgCost,
      pos.stopPct!,
      pos.takeProfitPct!,
    );
    if (!levels) continue;
    const candles = candlesBySymbol[pos.symbol];
    if (!candles?.length) continue;
    const lastBuy = next.journal.find(
      (j) => j.symbol === pos.symbol && j.side === "buy",
    );
    const fromDate = lastBuy?.fillDate ?? candles[0].date;
    const hit = findBracketExit(candles, fromDate, levels);
    if (!hit) continue;
    const sold = applySell(next, {
      symbol: pos.symbol,
      qty: pos.qty,
      fill: {
        fillPrice: hit.fillPrice,
        fillDate: hit.fillDate,
        fillRule: "next_open",
        signalDate: hit.signalDate,
      },
      source: "bracket",
      note: hit.hit === "stop" ? "bracket stop" : "bracket take-profit",
      playbookTag: "other",
    });
    if (sold.ok) {
      next = sold.state;
      closed += 1;
    }
  }
  return { state: next, closed };
}
