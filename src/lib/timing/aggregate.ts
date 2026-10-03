/**
 * Constituent-pattern → index/ETF timing aggregate (proxy universe).
 */

import type { PatternHit } from "../patterns/types";

export interface TimingConstituentInput {
  symbol: string;
  recentPatterns: PatternHit[];
  pct1d?: number | null;
}

export interface EtfTimingMeta {
  indexSymbol: string;
  sectorTags: string[];
  proxyConstituents: string[];
}

export interface TimingScoreRow {
  symbol: string;
  indexSymbol: string;
  score: number;
  bullHits: number;
  bearHits: number;
  neutralHits: number;
  constituentCount: number;
  constituentsWithHits: number;
  literacy: { zh: string; en: string };
}

const LITERACY = {
  zh: "观察池代理成分聚合，非全指数成分。",
  en: "Watchlist proxy aggregation — not full index membership.",
} as const;

function countDirs(hits: PatternHit[]): {
  bull: number;
  bear: number;
  neutral: number;
} {
  const out = { bull: 0, bear: 0, neutral: 0 };
  for (const h of hits) out[h.direction]++;
  return out;
}

/**
 * Score in [-100, 100] from recent bull/bear confluence across proxies.
 * Neutral hits dampen slightly.
 */
export function scoreFromHits(
  bull: number,
  bear: number,
  neutral: number,
): number {
  const total = bull + bear + neutral;
  if (!total) return 0;
  const raw = ((bull - bear) / total) * 100;
  const damp = 1 - Math.min(0.25, neutral / (total * 4));
  return Math.round(Math.max(-100, Math.min(100, raw * damp)));
}

export function aggregateTimingForEtf(
  etfSymbol: string,
  meta: EtfTimingMeta,
  bySymbol: Map<string, TimingConstituentInput>,
): TimingScoreRow {
  let bull = 0;
  let bear = 0;
  let neutral = 0;
  let withHits = 0;
  let used = 0;
  for (const sym of meta.proxyConstituents) {
    const row = bySymbol.get(sym);
    if (!row) continue;
    used++;
    const d = countDirs(row.recentPatterns);
    if (d.bull + d.bear + d.neutral > 0) withHits++;
    bull += d.bull;
    bear += d.bear;
    neutral += d.neutral;
  }
  // Also fold the ETF/index own recent patterns lightly
  const self = bySymbol.get(etfSymbol) ?? bySymbol.get(meta.indexSymbol);
  if (self) {
    const d = countDirs(self.recentPatterns);
    bull += Math.round(d.bull * 0.5);
    bear += Math.round(d.bear * 0.5);
    neutral += Math.round(d.neutral * 0.5);
  }
  return {
    symbol: etfSymbol,
    indexSymbol: meta.indexSymbol,
    score: scoreFromHits(bull, bear, neutral),
    bullHits: bull,
    bearHits: bear,
    neutralHits: neutral,
    constituentCount: used,
    constituentsWithHits: withHits,
    literacy: { ...LITERACY },
  };
}

export function buildTimingBoard(
  etfs: Record<string, EtfTimingMeta>,
  constituents: TimingConstituentInput[],
): TimingScoreRow[] {
  const bySymbol = new Map(constituents.map((c) => [c.symbol, c]));
  return Object.entries(etfs)
    .map(([sym, meta]) => aggregateTimingForEtf(sym, meta, bySymbol))
    .sort((a, b) => b.score - a.score);
}
