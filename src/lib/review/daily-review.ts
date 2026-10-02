/**
 * Rule-based daily review bullets from pattern hits (no LLM).
 */

import type { PatternHit } from "../patterns/types";
import { PATTERN_META } from "../patterns/types";

export interface SymbolReviewInput {
  symbol: string;
  nameZh: string;
  nameEn: string;
  pct1d: number | null;
  dataStatus: "live" | "stale" | "missing";
  recentPatterns: PatternHit[];
}

function countByDirection(hits: PatternHit[]): {
  bull: number;
  bear: number;
  neutral: number;
} {
  const out = { bull: 0, bear: 0, neutral: 0 };
  for (const h of hits) out[h.direction]++;
  return out;
}

export function buildDailyReview(symbols: SymbolReviewInput[]): {
  zh: string[];
  en: string[];
} {
  const zh: string[] = [];
  const en: string[] = [];

  const ok = symbols.filter((s) => s.dataStatus !== "missing");
  const missing = symbols.filter((s) => s.dataStatus === "missing");
  const stale = symbols.filter((s) => s.dataStatus === "stale");

  zh.push(
    `观察池 ${symbols.length} 只：有效行情 ${ok.length}，缓存 ${stale.length}，缺失 ${missing.length}。`,
  );
  en.push(
    `Watchlist ${symbols.length}: live/usable ${ok.length}, stale ${stale.length}, missing ${missing.length}.`,
  );

  const allHits = symbols.flatMap((s) => s.recentPatterns);
  const dir = countByDirection(allHits);
  zh.push(
    `近 60 个交易日形态合计 ${allHits.length} 次（看涨 ${dir.bull} / 看跌 ${dir.bear} / 中性 ${dir.neutral}）。`,
  );
  en.push(
    `Last 60 sessions: ${allHits.length} pattern hits (bull ${dir.bull} / bear ${dir.bear} / neutral ${dir.neutral}).`,
  );

  // Top movers among non-missing with pct
  const movers = ok
    .filter((s) => s.pct1d != null)
    .sort((a, b) => Math.abs(b.pct1d!) - Math.abs(a.pct1d!))
    .slice(0, 2);
  for (const m of movers) {
    const sign = m.pct1d! >= 0 ? "+" : "";
    zh.push(
      `${m.nameZh}（${m.symbol}）日涨跌 ${sign}${m.pct1d!.toFixed(2)}%。`,
    );
    en.push(
      `${m.nameEn} (${m.symbol}) 1D change ${sign}${m.pct1d!.toFixed(2)}%.`,
    );
  }

  // Highlight symbols with most recent bullish / bearish hits
  const withBull = symbols
    .map((s) => ({
      s,
      n: s.recentPatterns.filter((p) => p.direction === "bull").length,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0];
  if (withBull) {
    const latest = withBull.s.recentPatterns
      .filter((p) => p.direction === "bull")
      .at(-1)!;
    zh.push(
      `${withBull.s.nameZh} 近窗看涨形态较多（含 ${PATTERN_META[latest.patternId].zh}，${latest.date}）。`,
    );
    en.push(
      `${withBull.s.nameEn} leads bullish hits (incl. ${PATTERN_META[latest.patternId].en} on ${latest.date}).`,
    );
  }

  const withBear = symbols
    .map((s) => ({
      s,
      n: s.recentPatterns.filter((p) => p.direction === "bear").length,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0];
  if (withBear && zh.length < 6) {
    const latest = withBear.s.recentPatterns
      .filter((p) => p.direction === "bear")
      .at(-1)!;
    zh.push(
      `${withBear.s.nameZh} 近窗看跌形态较多（含 ${PATTERN_META[latest.patternId].zh}，${latest.date}）。`,
    );
    en.push(
      `${withBear.s.nameEn} leads bearish hits (incl. ${PATTERN_META[latest.patternId].en} on ${latest.date}).`,
    );
  }

  // Ensure 3–6 bullets
  while (zh.length < 3) {
    zh.push("今日无额外规则亮点；请结合 K 线详情自行判断。");
    en.push("No extra rule highlights; review candle charts for context.");
  }

  return { zh: zh.slice(0, 6), en: en.slice(0, 6) };
}
