/**
 * In-browser no-lookahead backtest engine.
 * Signal on bar t close → fill at t+1 open (QuantSense / rust-backtester contract).
 */

import { detectAt } from "../patterns/detect";
import type { PatternId } from "../patterns/types";
import { sma, rsi, last } from "../indicators/core";
import type { OHLC } from "../ohlc/types";
import { feeForSide } from "../paper/engine";
import { PAPER_FEE_BPS_RT, PAPER_START_CASH } from "../paper/types";

export type StrategyId =
  | "pattern_follow"
  | "ma_cross"
  | "rsi_mr"
  | "confluence";

export interface BacktestTrade {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  signalDate: string;
  fillDate: string;
  fillPrice: number;
  fee: number;
  fillRule: "next_open";
}

export interface BacktestMetrics {
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  winRate: number;
  profitFactor: number;
  avgHoldDays: number;
  trades: number;
  verdict: "green" | "yellow" | "red";
}

export interface BacktestResult {
  strategyId: StrategyId;
  symbol: string;
  equity: Array<{ time: string; value: number }>;
  drawdown: Array<{ time: string; value: number }>;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  isMetrics: BacktestMetrics;
  oosMetrics: BacktestMetrics;
}

export interface CandleBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toOHLC(c: CandleBar): OHLC {
  return {
    date: new Date(`${c.date}T15:00:00+08:00`),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  };
}

/** Long-only signal: 1 = want long, 0 = flat. Evaluated at bar i using ≤ i only. */
function signalAt(
  strategy: StrategyId,
  candles: CandleBar[],
  i: number,
): 0 | 1 {
  if (i < 1) return 0;
  const closes = candles.slice(0, i + 1).map((c) => c.close);
  const ohlcPrefix = candles.slice(0, i + 1).map(toOHLC);

  if (strategy === "pattern_follow") {
    const hits = detectAt(ohlcPrefix, i);
    const bull: PatternId[] = [
      "bullish_engulfing",
      "hammer",
      "morning_star",
      "three_white_soldiers",
      "piercing_line",
    ];
    const bear: PatternId[] = [
      "bearish_engulfing",
      "shooting_star",
      "evening_star",
      "three_black_crows",
    ];
    if (hits.some((h) => bull.includes(h))) return 1;
    if (hits.some((h) => bear.includes(h))) return 0;
    return 0;
  }

  if (strategy === "ma_cross") {
    const s20 = sma(closes, 20);
    const s60 = sma(closes, 60);
    if (!s20.length || !s60.length) return 0;
    const a = last(s20)!;
    const b = last(s60)!;
    return a > b ? 1 : 0;
  }

  if (strategy === "rsi_mr") {
    const r = rsi(closes, 14);
    const v = last(r);
    if (v == null) return 0;
    if (v < 30) return 1;
    if (v > 70) return 0;
    return 0;
  }

  // confluence
  const hits = detectAt(ohlcPrefix, i);
  const bullish = hits.some((h) =>
    [
      "bullish_engulfing",
      "hammer",
      "morning_star",
      "three_white_soldiers",
      "piercing_line",
    ].includes(h),
  );
  const s20 = sma(closes, 20);
  const s60 = sma(closes, 60);
  const maBull =
    s20.length && s60.length ? last(s20)! > last(s60)! : false;
  const r = last(rsi(closes, 14));
  let score = 0;
  if (bullish) score += 40;
  if (maBull) score += 35;
  if (r != null && r < 40) score += 25;
  return score >= 60 ? 1 : 0;
}

function lotRound(qty: number): number {
  return Math.floor(qty / 100) * 100;
}

function metricsFromEquity(
  equity: Array<{ time: string; value: number }>,
  trades: BacktestTrade[],
  startCash: number,
): BacktestMetrics {
  if (equity.length < 2) {
    return {
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      sharpe: 0,
      winRate: 0,
      profitFactor: 0,
      avgHoldDays: 0,
      trades: trades.length,
      verdict: "red",
    };
  }
  const start = equity[0].value;
  const end = equity[equity.length - 1].value;
  const totalReturnPct = ((end - start) / start) * 100;
  let peak = start;
  let maxDd = 0;
  const rets: number[] = [];
  for (let i = 0; i < equity.length; i++) {
    const v = equity[i].value;
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDd) maxDd = dd;
    if (i > 0 && equity[i - 1].value > 0) {
      rets.push(v / equity[i - 1].value - 1);
    }
  }
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const varSum = rets.reduce((a, b) => a + (b - mean) ** 2, 0);
  const std = rets.length > 1 ? Math.sqrt(varSum / (rets.length - 1)) : 0;
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;

  // Round-trip PnL from paired buys/sells
  const buys = trades.filter((t) => t.side === "buy");
  const sells = trades.filter((t) => t.side === "sell");
  let wins = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let holdSum = 0;
  const n = Math.min(buys.length, sells.length);
  for (let i = 0; i < n; i++) {
    const pnl =
      (sells[i].fillPrice - buys[i].fillPrice) * sells[i].qty -
      sells[i].fee -
      buys[i].fee;
    if (pnl >= 0) {
      wins += 1;
      grossWin += pnl;
    } else grossLoss += -pnl;
    const d0 = new Date(buys[i].fillDate).getTime();
    const d1 = new Date(sells[i].fillDate).getTime();
    holdSum += Math.max(1, (d1 - d0) / 86400000);
  }
  const winRate = n ? wins / n : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const avgHoldDays = n ? holdSum / n : 0;

  let verdict: "green" | "yellow" | "red" = "red";
  if (totalReturnPct > 0 && maxDd < 0.25 && sharpe > 0.5) verdict = "green";
  else if (totalReturnPct > -5 && maxDd < 0.4) verdict = "yellow";

  void startCash;
  return {
    totalReturnPct,
    maxDrawdownPct: maxDd * 100,
    sharpe,
    winRate,
    profitFactor,
    avgHoldDays,
    trades: trades.length,
    verdict,
  };
}

export function runBacktest(opts: {
  strategyId: StrategyId;
  symbol: string;
  candles: CandleBar[];
  startCash?: number;
  positionPct?: number;
  lotSize?: number;
}): BacktestResult {
  const startCash = opts.startCash ?? PAPER_START_CASH;
  const positionPct = opts.positionPct ?? 0.1;
  const lotSize = opts.lotSize ?? 100;
  const candles = opts.candles;
  let cash = startCash;
  let qty = 0;
  let avgCost = 0;
  const trades: BacktestTrade[] = [];
  const equity: Array<{ time: string; value: number }> = [];

  for (let i = 0; i < candles.length - 1; i++) {
    const want = signalAt(opts.strategyId, candles, i);
    const next = candles[i + 1];
    const mark = candles[i].close;

    // Target position
    if (want === 1 && qty === 0) {
      const budget = cash * positionPct;
      let q = lotRound(budget / next.open);
      if (q < lotSize) q = 0;
      if (q > 0) {
        const fee = feeForSide(q * next.open, PAPER_FEE_BPS_RT);
        const cost = q * next.open + fee;
        if (cost <= cash) {
          cash -= cost;
          qty = q;
          avgCost = next.open;
          trades.push({
            symbol: opts.symbol,
            side: "buy",
            qty: q,
            signalDate: candles[i].date,
            fillDate: next.date,
            fillPrice: next.open,
            fee,
            fillRule: "next_open",
          });
        }
      }
    } else if (want === 0 && qty > 0) {
      const fee = feeForSide(qty * next.open, PAPER_FEE_BPS_RT);
      cash += qty * next.open - fee;
      trades.push({
        symbol: opts.symbol,
        side: "sell",
        qty,
        signalDate: candles[i].date,
        fillDate: next.date,
        fillPrice: next.open,
        fee,
        fillRule: "next_open",
      });
      qty = 0;
      avgCost = 0;
    }

    const eq = cash + qty * mark;
    equity.push({ time: candles[i].date, value: eq });
  }
  // Final mark on last bar
  if (candles.length) {
    const lastBar = candles[candles.length - 1];
    equity.push({
      time: lastBar.date,
      value: cash + qty * lastBar.close,
    });
  }

  let peak = equity[0]?.value ?? startCash;
  const drawdown = equity.map((p) => {
    if (p.value > peak) peak = p.value;
    return {
      time: p.time,
      value: peak > 0 ? -((peak - p.value) / peak) * 100 : 0,
    };
  });

  const split = Math.floor(equity.length * 0.6);
  const isEq = equity.slice(0, Math.max(2, split));
  const oosEq = equity.slice(Math.max(0, split - 1));
  const isTrades = trades.filter((t) => t.fillDate <= (isEq[isEq.length - 1]?.time ?? ""));
  const oosTrades = trades.filter((t) => t.fillDate >= (oosEq[0]?.time ?? ""));

  return {
    strategyId: opts.strategyId,
    symbol: opts.symbol,
    equity,
    drawdown,
    trades,
    metrics: metricsFromEquity(equity, trades, startCash),
    isMetrics: metricsFromEquity(isEq, isTrades, startCash),
    oosMetrics: metricsFromEquity(oosEq, oosTrades, startCash),
  };
}

export const STRATEGY_META: Record<
  StrategyId,
  { en: string; zh: string }
> = {
  pattern_follow: { en: "Pattern follow", zh: "形态跟随" },
  ma_cross: { en: "MA20/60 cross", zh: "均线金叉" },
  rsi_mr: { en: "RSI mean-reversion", zh: "RSI 均值回归" },
  confluence: { en: "Confluence ≥60", zh: "多因子共振" },
};
