/** Shared payload types for baked latest.json (plan §6). */

export type PatternId =
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "hammer"
  | "shooting_star"
  | "doji";

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
  }>;
  dailyReview: {
    zh: string[];
    en: string[];
  };
}

export type SymbolRow = LatestPayload["symbols"][number];
