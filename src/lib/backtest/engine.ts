/**
 * In-browser no-lookahead backtest engine.
 * Signal on bar t close → fill at t+1 open (QuantSense / rust-backtester contract).
 */

import { detectAt } from "../patterns/detect";
import type { PatternId } from "../patterns/types";
import { sma, rsi, last } from "../indicators/core";
import type { OHLC } from "../ohlc/types";
import {
  computeTradeCosts,
  DEFAULT_COST_CONFIG,
  type CostConfig,
} from "../paper/costs";
import { PAPER_START_CASH } from "../paper/types";
import {
  DEFAULT_N_TRIALS,
  deflatedSharpeVerdict,
  haircutSharpe,
} from "./deflated-sharpe";
import {
  buildExpandingFolds,
  DEFAULT_WF_CONFIG,
  type WfFold,
} from "./walkforward";

export type StrategyId =
  | "pattern_follow"
  | "ma_cross"
  | "rsi_mr"
  | "confluence"
  | "pattern_confluence"
  | "ml_lite";

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
  folds: Array<{ fold: number; metrics: BacktestMetrics }>;
  degradation: { returnRatio: number; sharpeRatio: number };
  costModelEnabled: boolean;
  usedPurgedWf: boolean;
  haircutSharpe: number;
  haircutPct: number;
  nTrials: number;
  gateLevel: "green" | "yellow" | "red";
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

  if (strategy === "pattern_confluence") {
    // 15-pattern window score over last ~12 bars (no lookahead)
    const bull: PatternId[] = [
      "bullish_engulfing",
      "hammer",
      "morning_star",
      "three_white_soldiers",
      "piercing_line",
      "inverted_hammer",
      "bullish_harami",
    ];
    const bear: PatternId[] = [
      "bearish_engulfing",
      "shooting_star",
      "evening_star",
      "three_black_crows",
      "dark_cloud_cover",
      "bearish_harami",
    ];
    let score = 0;
    const start = Math.max(1, i - 11);
    for (let j = start; j <= i; j++) {
      const hits = detectAt(ohlcPrefix, j);
      for (const h of hits) {
        if (bull.includes(h)) score += 8;
        if (bear.includes(h)) score -= 8;
      }
    }
    return score >= 16 ? 1 : 0;
  }

  if (strategy === "ml_lite") {
    // Lagged-return sign rule (ridge-lite): long when mean of lags 1..5 > 0
    // Uses only closes ≤ i (no lookahead).
    if (closes.length < 8) return 0;
    const rets: number[] = [];
    for (let k = 1; k <= 5; k++) {
      const a = closes[closes.length - 1 - k];
      const b = closes[closes.length - k];
      if (a > 0 && b > 0) rets.push(b / a - 1);
    }
    if (rets.length < 3) return 0;
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    // mild ridge shrinkage toward 0
    const shrunk = mean * (rets.length / (rets.length + 2));
    return shrunk > 0 ? 1 : 0;
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
  costConfig?: CostConfig;
  costModelEnabled?: boolean;
}): BacktestResult {
  const startCash = opts.startCash ?? PAPER_START_CASH;
  const positionPct = opts.positionPct ?? 0.1;
  const lotSize = opts.lotSize ?? 100;
  const costModelEnabled = opts.costModelEnabled !== false;
  const costCfg: CostConfig = {
    ...(opts.costConfig ?? DEFAULT_COST_CONFIG),
    enabled: costModelEnabled,
  };
  const candles = opts.candles;
  let cash = startCash;
  let qty = 0;
  const trades: BacktestTrade[] = [];
  const equity: Array<{ time: string; value: number }> = [];
  let buyFillDate: string | null = null;

  for (let i = 0; i < candles.length - 1; i++) {
    const want = signalAt(opts.strategyId, candles, i);
    const next = candles[i + 1];
    const mark = candles[i].close;

    if (want === 1 && qty === 0) {
      const budget = cash * positionPct;
      let q = lotRound(budget / next.open);
      if (q < lotSize) q = 0;
      if (q > 0) {
        const notional = q * next.open;
        const fee = computeTradeCosts({
          side: "buy",
          notional,
          symbol: opts.symbol,
          cfg: costCfg,
        }).total;
        const cost = notional + fee;
        if (cost <= cash) {
          cash -= cost;
          qty = q;
          buyFillDate = next.date;
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
      // T+1: skip sell if would be same session as buy fill
      if (buyFillDate && next.date === buyFillDate) {
        // hold
      } else {
        const notional = qty * next.open;
        const fee = computeTradeCosts({
          side: "sell",
          notional,
          symbol: opts.symbol,
          cfg: costCfg,
        }).total;
        cash += notional - fee;
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
        buyFillDate = null;
      }
    }

    equity.push({ time: candles[i].date, value: cash + qty * mark });
  }
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

  const foldsIdx: WfFold[] = buildExpandingFolds(
    candles.length,
    DEFAULT_WF_CONFIG,
  );
  const usedPurgedWf = foldsIdx.length >= 3;
  const foldMetrics = foldsIdx.map((f, i) => {
    const startDate = candles[f.testStart]?.date ?? "";
    const endDate = candles[Math.min(f.testEnd, candles.length) - 1]?.date ?? "";
    const eqSlice = equity.filter(
      (p) => p.time >= startDate && p.time <= endDate,
    );
    const tr = trades.filter(
      (t) => t.fillDate >= startDate && t.fillDate <= endDate,
    );
    return {
      fold: i + 1,
      metrics: metricsFromEquity(
        eqSlice.length >= 2 ? eqSlice : equity.slice(-2),
        tr,
        startCash,
      ),
    };
  });

  // IS = before first test; OOS = aggregate OOS fold equity
  const firstTest = foldsIdx[0]?.testStart ?? Math.floor(candles.length * 0.6);
  const isEndDate = candles[Math.max(0, firstTest - 1)]?.date ?? "";
  const isEq = equity.filter((p) => p.time <= isEndDate);
  const oosEq = equity.filter((p) => p.time >= (candles[firstTest]?.date ?? ""));
  const isTrades = trades.filter((t) => t.fillDate <= isEndDate);
  const oosTrades = trades.filter(
    (t) => t.fillDate >= (candles[firstTest]?.date ?? ""),
  );

  const metrics = metricsFromEquity(equity, trades, startCash);
  const isMetrics = metricsFromEquity(
    isEq.length >= 2 ? isEq : equity.slice(0, 2),
    isTrades,
    startCash,
  );
  const oosMetrics = metricsFromEquity(
    oosEq.length >= 2 ? oosEq : equity.slice(-2),
    oosTrades,
    startCash,
  );

  const hc = haircutSharpe({
    sharpe: oosMetrics.sharpe,
    nObs: Math.max(2, oosEq.length),
    nTrials: DEFAULT_N_TRIALS,
  });
  const gateLevel = deflatedSharpeVerdict(
    hc.sharpeHaircut,
    oosMetrics.maxDrawdownPct,
  );
  metrics.verdict = gateLevel;

  const returnRatio =
    isMetrics.totalReturnPct !== 0
      ? oosMetrics.totalReturnPct / isMetrics.totalReturnPct
      : 0;
  const sharpeRatio =
    isMetrics.sharpe !== 0 ? oosMetrics.sharpe / isMetrics.sharpe : 0;

  return {
    strategyId: opts.strategyId,
    symbol: opts.symbol,
    equity,
    drawdown,
    trades,
    metrics,
    isMetrics,
    oosMetrics,
    folds: foldMetrics,
    degradation: { returnRatio, sharpeRatio },
    costModelEnabled,
    usedPurgedWf,
    haircutSharpe: hc.sharpeHaircut,
    haircutPct: hc.haircutPct,
    nTrials: DEFAULT_N_TRIALS,
    gateLevel,
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
  pattern_confluence: {
    en: "Pattern confluence (15)",
    zh: "形态窗口共振",
  },
  ml_lite: { en: "ML-lite lag sign", zh: "ML-lite 滞后符号" },
};
