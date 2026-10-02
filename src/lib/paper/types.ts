export interface PaperPosition {
  symbol: string;
  qty: number;
  avgCost: number;
}

export interface PaperJournalEntry {
  id: string;
  ts: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  /** Fill price used (next open or next close). */
  fillPrice: number;
  fee: number;
  /** Signal date (bar t). Fill is at t+1. */
  signalDate: string;
  fillDate: string;
  fillRule: "next_open" | "next_close_fallback";
  note: string;
}

export interface PaperState {
  version: 2;
  cash: number;
  startingCash: number;
  feeBpsRoundTrip: number;
  positions: PaperPosition[];
  journal: PaperJournalEntry[];
}

export const PAPER_KEY = "agenter.paper.journal.v2";
export const PAPER_KEY_V1 = "agenter.paper.journal.v1";
/** Every paper user starts with 壹亿 CNY. */
export const PAPER_START_CASH = 100_000_000;
/** 3 bps round-trip simplified → 1.5 bps per side. */
export const PAPER_FEE_BPS_RT = 3;
export const ASHARE_LOT = 100;
/** Soft risk: warn when a single name exceeds this fraction of equity. */
export const PAPER_MAX_NAME_PCT = 0.2;
