import type { CostConfig } from "./costs";
import { DEFAULT_COST_CONFIG } from "./costs";

export type RejectReason =
  | "t1_lock"
  | "limit_up"
  | "limit_down"
  | "insufficient_cash"
  | "lot_100"
  | "invalid_qty"
  | "no_position"
  | "insufficient_qty"
  | "risk_overweight"
  | "risk_cash"
  | "risk_max_names"
  | "risk_daily_loss";

export interface PaperJournalEntry {
  id: string;
  ts: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  fillPrice: number;
  fee: number;
  feeCommission?: number;
  feeStampDuty?: number;
  feeTransfer?: number;
  feeSlippage?: number;
  signalDate: string;
  fillDate: string;
  fillRule: "next_open" | "next_close_fallback";
  note: string;
  source?: "manual" | "backtest" | "checklist" | "sim" | "bracket";
  /** Paper Pro playbook tag (optional). */
  playbookTag?:
    | "momentum"
    | "mean_rev"
    | "committee"
    | "lab"
    | "manual"
    | "other";
  /** Educational TWAP/VWAP slice label when materialized. */
  sliceLabel?: string;
  rejectReason?: RejectReason;
}

export interface LotLot {
  qty: number;
  fillDate: string;
}

export interface PaperRiskLimits {
  maxNamePct: number;
  minCashPct: number;
  maxOpenNames: number;
  /** Daily MTM loss halt vs priorEquityMark (e.g. 0.03 = −3%). */
  dailyLossPct: number;
}

export interface PaperPosition {
  symbol: string;
  qty: number;
  avgCost: number;
  /** Protective stop distance as fraction of avgCost (long-only). */
  stopPct?: number;
  /** Take-profit distance as fraction of avgCost (long-only). */
  takeProfitPct?: number;
}

export interface PaperState {
  version: 2;
  cash: number;
  startingCash: number;
  feeBpsRoundTrip: number;
  positions: PaperPosition[];
  journal: PaperJournalEntry[];
  hardRiskGates?: boolean;
  costModelEnabled?: boolean;
  costConfig?: CostConfig;
  boughtLots?: Record<string, LotLot[]>;
  riskLimits?: PaperRiskLimits;
  /** Equity mark used as daily-loss baseline (set on first paint / reset). */
  priorEquityMark?: number;
}

export const PAPER_KEY = "agenter.paper.journal.v2";
export const PAPER_KEY_V1 = "agenter.paper.journal.v1";
export const PAPER_START_CASH = 100_000_000;
export const PAPER_FEE_BPS_RT = 3;
export const ASHARE_LOT = 100;
export const PAPER_MAX_NAME_PCT = 0.2;
export const PAPER_MIN_CASH_PCT = 0.1;
export const PAPER_MAX_OPEN_NAMES = 12;
export const PAPER_DAILY_LOSS_PCT = 0.03;

export const DEFAULT_RISK_LIMITS: PaperRiskLimits = {
  maxNamePct: PAPER_MAX_NAME_PCT,
  minCashPct: PAPER_MIN_CASH_PCT,
  maxOpenNames: PAPER_MAX_OPEN_NAMES,
  dailyLossPct: PAPER_DAILY_LOSS_PCT,
};

export { DEFAULT_COST_CONFIG };
