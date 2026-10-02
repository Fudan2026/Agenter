import type { CostConfig } from "./costs";
import { DEFAULT_COST_CONFIG } from "./costs";

export interface PaperPosition {
  symbol: string;
  qty: number;
  avgCost: number;
}

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
  | "risk_cash";

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
  source?: "manual" | "backtest" | "checklist";
  rejectReason?: RejectReason;
}

export interface LotLot {
  qty: number;
  fillDate: string;
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
}

export const PAPER_KEY = "agenter.paper.journal.v2";
export const PAPER_KEY_V1 = "agenter.paper.journal.v1";
export const PAPER_START_CASH = 100_000_000;
export const PAPER_FEE_BPS_RT = 3;
export const ASHARE_LOT = 100;
export const PAPER_MAX_NAME_PCT = 0.2;
export const PAPER_MIN_CASH_PCT = 0.1;

export { DEFAULT_COST_CONFIG };
