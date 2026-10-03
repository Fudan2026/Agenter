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

export interface PatternHorizonStatPayload {
  horizon: 1 | 5 | 10 | 20;
  count: number;
  upProb: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  payoffRatio: number | null;
  winRate: number | null;
}

export interface PatternEfficacyPayload {
  patternId: PatternId;
  direction: "bull" | "bear" | "neutral";
  horizons: PatternHorizonStatPayload[];
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
    /** Honest bar count / years disclosure (may be <10y). */
    nBars?: number;
    sampleYears?: number;
    recentPatterns: Array<{
      patternId: PatternId;
      date: string;
      direction: "bull" | "bear" | "neutral";
    }>;
    patternStats?: PatternEfficacyPayload[];
    signals?: SignalSummaryPayload;
    ma20?: Array<{ date: string; value: number }>;
    ma60?: Array<{ date: string; value: number }>;
  }>;
  dailyReview: {
    zh: string[];
    en: string[];
  };
  timing?: Array<{
    symbol: string;
    indexSymbol: string;
    score: number;
    bullHits: number;
    bearHits: number;
    neutralHits: number;
    constituentCount: number;
    constituentsWithHits: number;
    literacy: { zh: string; en: string };
  }>;
  rotation?: {
    daily: RotationModePayload;
    fixed_5d: RotationModePayload;
    dailyTimed: RotationModePayload;
    fixed_5dTimed: RotationModePayload;
  };
  patternMonitor?: {
    generatedAt: string;
    priorGeneratedAt: string | null;
    newHits: Array<{ symbol: string; patternId: string; date: string }>;
  };
}

export interface RotationModePayload {
  mode: string;
  timingOverlay: boolean;
  totalReturn: number;
  maxDrawdown: number;
  turns: number;
  lastWeights: Record<string, number>;
  equityLast?: number;
}

export type SymbolRow = LatestPayload["symbols"][number];
