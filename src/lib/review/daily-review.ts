/**
 * Rule-based daily review bullets from pattern hits (no LLM).
 * Enriched: hotspot sectors, historical signal eval, forward outlook literacy.
 */

import type { PatternHit, PatternId } from "../patterns/types";
import { PATTERN_META } from "../patterns/types";

export interface PatternHorizonStatLite {
  horizon: 1 | 5 | 10 | 20;
  count: number;
  upProb: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  payoffRatio: number | null;
  winRate: number | null;
}

export interface PatternEfficacyLite {
  patternId: PatternId;
  direction: "bull" | "bear" | "neutral";
  horizons: PatternHorizonStatLite[];
}

export interface SymbolReviewInput {
  symbol: string;
  nameZh: string;
  nameEn: string;
  pct1d: number | null;
  dataStatus: "live" | "stale" | "missing";
  recentPatterns: PatternHit[];
  group?: "macro" | "china-etf" | "china-ashare";
  patternStats?: PatternEfficacyLite[];
  sampleYears?: number;
  nBars?: number;
  sectorTags?: string[];
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

function bestWinRate(stats?: PatternEfficacyLite[]): {
  id: string;
  wr: number;
  count: number;
} | null {
  if (!stats?.length) return null;
  let best: { id: string; wr: number; count: number } | null = null;
  for (const p of stats) {
    const h = p.horizons.find((x) => x.horizon === 5);
    if (!h || h.count < 5 || h.winRate == null) continue;
    if (!best || h.winRate > best.wr) {
      best = { id: p.patternId, wr: h.winRate, count: h.count };
    }
  }
  return best;
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

  // (1) Hotspot sectors via pattern density on ETFs / tagged names
  const density = symbols
    .filter((s) => s.group === "china-etf" || (s.sectorTags?.length ?? 0) > 0)
    .map((s) => ({
      s,
      n: s.recentPatterns.length,
      tags: s.sectorTags?.join("/") ?? s.group ?? "",
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  if (density[0]) {
    const top = density.slice(0, 2);
    zh.push(
      `热点板块（形态密度）：${top.map((x) => `${x.s.nameZh}×${x.n}`).join("、")}（代理宇宙，非全市场）。`,
    );
    en.push(
      `Hotspot sectors (pattern density): ${top.map((x) => `${x.s.nameEn}×${x.n}`).join(", ")} (proxy universe).`,
    );
  }

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

  // (2) Historical signal eval using patternStats
  const evalRows = symbols
    .map((s) => ({ s, best: bestWinRate(s.patternStats) }))
    .filter((x) => x.best != null)
    .sort((a, b) => b.best!.wr - a.best!.wr);
  if (evalRows[0]?.best) {
    const { s, best } = evalRows[0];
    const meta = PATTERN_META[best!.id as keyof typeof PATTERN_META];
    const years =
      s.sampleYears != null ? `，样本约 ${s.sampleYears} 年` : "";
    zh.push(
      `历史信号评估：${s.nameZh} 的「${meta?.zh ?? best!.id}」5 日胜率 ${(best!.wr * 100).toFixed(0)}%（n=${best!.count}${years}）。`,
    );
    en.push(
      `Signal eval: ${s.nameEn} «${meta?.en ?? best!.id}» 5d win-rate ${(best!.wr * 100).toFixed(0)}% (n=${best!.count}${s.sampleYears != null ? `, ~${s.sampleYears}y sample` : ""}).`,
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
  if (withBull && zh.length < 7) {
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

  // (3) Forward outlook from confluence — literacy, not prophecy
  const net = dir.bull - dir.bear;
  if (net > 3) {
    zh.push(
      `前瞻（素养，非预言）：近窗多头汇合偏强；关注均线与前高/支撑路径，勿当作必然上涨。`,
    );
    en.push(
      `Outlook literacy (not prophecy): near-window bull confluence is stronger; watch MA paths and prior highs/supports — not a forecast.`,
    );
  } else if (net < -3) {
    zh.push(
      `前瞻（素养，非预言）：近窗空头汇合偏强；关注均线与前低/阻力路径，勿当作必然下跌。`,
    );
    en.push(
      `Outlook literacy (not prophecy): near-window bear confluence is stronger; watch MA paths and prior lows/resistance — not a forecast.`,
    );
  } else {
    zh.push(
      `前瞻（素养，非预言）：多空接近均衡；以区间与路径管理为主，而非单边押注。`,
    );
    en.push(
      `Outlook literacy (not prophecy): bull/bear roughly balanced; favor path/range management over one-way bets.`,
    );
  }

  // Ensure 3–8 bullets
  while (zh.length < 3) {
    zh.push("今日无额外规则亮点；请结合 K 线详情自行判断。");
    en.push("No extra rule highlights; review candle charts for context.");
  }

  return { zh: zh.slice(0, 8), en: en.slice(0, 8) };
}
