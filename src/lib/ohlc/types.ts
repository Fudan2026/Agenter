/** Shared OHLC types (distilled from OpenCool lib/trading/yahoo.ts). */

export interface OHLC {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerRawData {
  symbol: string;
  currency: string;
  exchangeName: string;
  regularMarketPrice: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  /** Daily OHLCV, oldest first. */
  candles: OHLC[];
}

export type DataStatus = "live" | "stale" | "missing";

export interface SymbolFetchResult {
  symbol: string;
  raw: TickerRawData | null;
  dataStatus: DataStatus;
  dataNote: string;
}
