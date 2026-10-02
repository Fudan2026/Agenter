/** Shared payload types for baked latest.json. */

import type { PatternId } from "../lib/patterns/types";
import type { MaAlignment, RsiZone } from "../lib/indicators/core";

export type { PatternId };

export interface SignalSummaryPayload {
  sma20: number | null;
  sma60: number | null;
  rsi14: number | null;
  rsiZone: RsiZone;
  maAlign: MaAlignment;
  volumeSpike: boolean;
  bias: "bull" | "bear" | "neutral";
  tags: string[];
}

export interface LatestPayload {
  generatedAt: string;
  reportDate: string;
  title: { zh: string; en: string };
  stats: {
    symbolsAttempted: number;
    symbolsOk: number;
    symbolsStale: number;
    symbolsMissing: number;
    patternHits: number;
  };
  symbols: Array<{
    symbol: string;
    nameZh: string;
    nameEn: string;
    group: "macro" | "china-etf" | "china-ashare";
    dataStatus: "live" | "stale" | "missing";
    dataNote: string;
    lastClose: number;
    pct1d: number | null;
    sparkCloses: number[];
    candles: Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    recentPatterns: Array<{
      patternId: PatternId;
      date: string;
      direction: "bull" | "bear" | "neutral";
    }>;
    signals?: SignalSummaryPayload;
    ma20?: Array<{ date: string; value: number }>;
    ma60?: Array<{ date: string; value: number }>;
  }>;
  dailyReview: {
    zh: string[];
    en: string[];
  };
}

export type SymbolRow = LatestPayload["symbols"][number];
