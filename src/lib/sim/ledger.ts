/** Sim Desk order engine — lot 100, T+1, no network. */

import {
  SIM_FEE_BPS_SIDE,
  SIM_LOT,
  SIM_START_CASH,
  SIM_YYBID,
  type SimError,
  type SimLedger,
  type SimMarketCode,
  type SimSide,
  type SimTrade,
} from "./types";

export function marketCodeFromSymbol(symbol: string): SimMarketCode | null {
  const u = symbol.trim().toUpperCase();
  if (u.endsWith(".SZ")) return "1";
  if (u.endsWith(".SS") || u.endsWith(".SH")) return "2";
  const code = u.replace(/\.(SS|SH|SZ)$/i, "");
  if (/^[03]\d{5}$/.test(code)) return "1";
  if (/^[65]\d{5}$/.test(code)) return "2";
  return null;
}

export function normalizeSimSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function validateLotQty(qty: number): { qty: number; error?: SimError } {
  if (!Number.isFinite(qty) || qty <= 0) return { qty: 0, error: "invalid_qty" };
  const q = Math.floor(qty);
  if (q % SIM_LOT !== 0 || q < SIM_LOT) return { qty: 0, error: "lot_100" };
  return { qty: q };
}

export function feeForNotional(notional: number): number {
  return (Math.abs(notional) * SIM_FEE_BPS_SIDE) / 10_000;
}

export function emptyLedger(): SimLedger {
  return {
    version: 1,
    account: null,
    cash: 0,
    startingCash: SIM_START_CASH,
    positions: [],
    boughtLots: {},
    trades: [],
  };
}

/** One-click 开户 — local fund account, ¥100M. */
export function openSimAccount(now = new Date()): SimLedger {
  const ms = now.getTime();
  const username = `skill_${ms}`;
  const capitalAccount = String(100_000_000 + (ms % 90_000_000));
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  return {
    version: 1,
    account: {
      username,
      capitalAccount,
      departmentId: SIM_YYBID,
      shareholderSz: `00${day}${(ms % 10000).toString().padStart(4, "0")}`.slice(
        0,
        11,
      ),
      shareholderSh: `A${day}${(ms % 100000).toString().padStart(5, "0")}`.slice(
        0,
        10,
      ),
      openedAt: now.toISOString(),
    },
    cash: SIM_START_CASH,
    startingCash: SIM_START_CASH,
    positions: [],
    boughtLots: {},
    trades: [],
  };
}

export function equityMark(
  ledger: SimLedger,
  lastCloseBySymbol: Record<string, number>,
): number {
  let eq = ledger.cash;
  for (const p of ledger.positions) {
    const px = lastCloseBySymbol[p.symbol] ?? p.avgCost;
    eq += p.qty * px;
  }
  return eq;
}

function sellableQty(
  ledger: SimLedger,
  symbol: string,
  fillDate: string,
): number {
  const pos = ledger.positions.find((p) => p.symbol === symbol);
  if (!pos) return 0;
  const lots = ledger.boughtLots[symbol] ?? [];
  const locked = lots
    .filter((l) => l.fillDate === fillDate)
    .reduce((s, l) => s + l.qty, 0);
  return Math.max(0, pos.qty - locked);
}

function tradeId(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function placeOrder(
  ledger: SimLedger,
  opts: {
    symbol: string;
    nameZh?: string;
    nameEn?: string;
    side: SimSide;
    qty: number;
    price: number;
    fillDate?: string;
    note?: string;
  },
): { ok: true; ledger: SimLedger } | { ok: false; error: SimError } {
  if (!ledger.account) return { ok: false, error: "no_account" };

  const symbol = normalizeSimSymbol(opts.symbol);
  const market = marketCodeFromSymbol(symbol);
  if (!market) return { ok: false, error: "unknown_symbol" };

  const lot = validateLotQty(opts.qty);
  if (lot.error) return { ok: false, error: lot.error };

  if (!Number.isFinite(opts.price) || opts.price <= 0) {
    return { ok: false, error: "invalid_price" };
  }

  const fillDate =
    opts.fillDate ?? new Date().toISOString().slice(0, 10);
  const qty = lot.qty;
  const price = opts.price;
  const notional = qty * price;
  const fee = feeForNotional(notional);
  const nameZh = opts.nameZh ?? symbol;
  const nameEn = opts.nameEn ?? symbol;

  if (opts.side === "buy") {
    const cost = notional + fee;
    if (cost > ledger.cash + 1e-9) return { ok: false, error: "insufficient_cash" };

    const positions = [...ledger.positions];
    const idx = positions.findIndex((p) => p.symbol === symbol);
    if (idx >= 0) {
      const prev = positions[idx];
      const newQty = prev.qty + qty;
      const avgCost = (prev.avgCost * prev.qty + price * qty) / newQty;
      positions[idx] = {
        ...prev,
        qty: newQty,
        avgCost,
        nameZh,
        nameEn,
        marketCode: market,
      };
    } else {
      positions.push({
        symbol,
        nameZh,
        nameEn,
        qty,
        avgCost: price,
        marketCode: market,
      });
    }

    const boughtLots = { ...ledger.boughtLots };
    boughtLots[symbol] = [
      ...(boughtLots[symbol] ?? []),
      { qty, fillDate },
    ];

    const trade: SimTrade = {
      id: tradeId(),
      ts: new Date().toISOString(),
      fillDate,
      symbol,
      nameZh,
      side: "buy",
      qty,
      price,
      fee,
      marketCode: market,
      note: opts.note,
    };

    return {
      ok: true,
      ledger: {
        ...ledger,
        cash: ledger.cash - cost,
        positions,
        boughtLots,
        trades: [trade, ...ledger.trades],
      },
    };
  }

  // sell
  const idx = ledger.positions.findIndex((p) => p.symbol === symbol);
  if (idx < 0) return { ok: false, error: "no_position" };
  const pos = ledger.positions[idx];
  if (qty > pos.qty) return { ok: false, error: "insufficient_qty" };
  const sellable = sellableQty(ledger, symbol, fillDate);
  if (qty > sellable) return { ok: false, error: "t1_lock" };

  const proceeds = notional - fee;
  const positions = [...ledger.positions];
  const remaining = pos.qty - qty;
  if (remaining === 0) positions.splice(idx, 1);
  else positions[idx] = { ...pos, qty: remaining };

  const boughtLots = { ...ledger.boughtLots };
  let left = qty;
  const nextLots = [];
  for (const lotRow of boughtLots[symbol] ?? []) {
    if (left <= 0) {
      nextLots.push(lotRow);
      continue;
    }
    if (lotRow.fillDate === fillDate) {
      nextLots.push(lotRow);
      continue;
    }
    const take = Math.min(lotRow.qty, left);
    left -= take;
    if (lotRow.qty > take) nextLots.push({ ...lotRow, qty: lotRow.qty - take });
  }
  if (left > 0) return { ok: false, error: "t1_lock" };
  if (nextLots.length) boughtLots[symbol] = nextLots;
  else delete boughtLots[symbol];

  const trade: SimTrade = {
    id: tradeId(),
    ts: new Date().toISOString(),
    fillDate,
    symbol,
    nameZh: pos.nameZh,
    side: "sell",
    qty,
    price,
    fee,
    marketCode: market,
    note: opts.note,
  };

  return {
    ok: true,
    ledger: {
      ...ledger,
      cash: ledger.cash + proceeds,
      positions,
      boughtLots,
      trades: [trade, ...ledger.trades],
    },
  };
}

/** Realized + unrealized PnL vs starting cash at marks. */
export function pnlSnapshot(
  ledger: SimLedger,
  lastCloseBySymbol: Record<string, number>,
): { equity: number; pnl: number; pnlPct: number } {
  const equity = equityMark(ledger, lastCloseBySymbol);
  const pnl = equity - ledger.startingCash;
  const pnlPct = ledger.startingCash > 0 ? (pnl / ledger.startingCash) * 100 : 0;
  return { equity, pnl, pnlPct };
}

/** Approximate trailing 30-calendar-day return from trade journal + marks. */
export function trailing30dReturnPct(
  ledger: SimLedger,
  lastCloseBySymbol: Record<string, number>,
  now = new Date(),
): number {
  if (!ledger.account) return 0;
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const recent = ledger.trades.filter((t) => t.fillDate >= cutoff);
  if (!recent.length) {
    // no activity — mark-to-market vs start if positions exist
    const { pnlPct } = pnlSnapshot(ledger, lastCloseBySymbol);
    return ledger.positions.length ? pnlPct : 0;
  }
  // Net cash flow from trades in window + MTM delta approximation:
  // start equity ≈ current equity - sum(signed trade notional net of fee in window) is wrong;
  // simpler: pnl% of current equity vs cash after removing window trades' impact.
  // Product intent: show journal-based 30d gain % ≈ (equity - equity_proxy_30d_ago) / start.
  let cashFlow = 0;
  for (const t of recent) {
    const signed = t.side === "buy" ? -(t.qty * t.price + t.fee) : t.qty * t.price - t.fee;
    cashFlow += signed;
  }
  const eq = equityMark(ledger, lastCloseBySymbol);
  // equity_30d_ago ≈ eq - cashFlow (ignoring MTM of older holdings)
  const eqThen = eq - cashFlow;
  if (eqThen <= 0) return 0;
  return ((eq - eqThen) / eqThen) * 100;
}

export function todayTrades(ledger: SimLedger, today?: string): SimTrade[] {
  const d = today ?? new Date().toISOString().slice(0, 10);
  return ledger.trades.filter((t) => t.fillDate === d);
}
