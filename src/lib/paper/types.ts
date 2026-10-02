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
  version: 1;
  cash: number;
  startingCash: number;
  feeBpsRoundTrip: number;
  positions: PaperPosition[];
  journal: PaperJournalEntry[];
}

export const PAPER_KEY = "agenter.paper.journal.v1";
export const PAPER_START_CASH = 1_000_000;
/** 3 bps round-trip simplified → 1.5 bps per side. */
export const PAPER_FEE_BPS_RT = 3;
export const ASHARE_LOT = 100;
