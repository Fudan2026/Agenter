/**
 * Committee Desk — bake-only multi-agent screening votes (AI篇主题二 distill).
 * No LLM calls. Roles mirror TradingAgents-style desks.
 */

import type { AnnouncementItem } from "../announcements/map";
import {
  classifyAnnouncementEvent,
  EVENT_BUCKETS,
  type EventBucketId,
} from "../announcements/events";
import type { FactorScores } from "../factors/cross-section";
import type { IwencaiNewsItem } from "../iwencai-news/map";
import { patternConfluenceScore } from "../patterns/confluence";
import type { SymbolRow } from "../../pages/types";

export type CommitteeRole =
  | "fundamentals"
  | "sentiment"
  | "technical"
  | "news"
  | "risk"
  | "portfolio";

export interface RoleVote {
  role: CommitteeRole;
  score: number; // -1 … +1
  evidenceZh: string;
  evidenceEn: string;
}

export interface CommitteeResult {
  symbol: string;
  nameZh: string;
  nameEn: string;
  votes: RoleVote[];
  consensus: number; // -1 … +1
  bias: "bull" | "bear" | "neutral";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function voteForSymbol(
  row: SymbolRow,
  ctx: {
    factor?: FactorScores | null;
    announcements?: AnnouncementItem[];
    news?: IwencaiNewsItem[];
  },
): CommitteeResult {
  const votes: RoleVote[] = [];
  const f = ctx.factor;

  // Fundamentals — quality / peProxy / pbProxy
  {
    const q = f?.quality ?? 0;
    const pe = f?.peProxy ?? 0;
    const pb = f?.pbProxy ?? 0;
    const score = clamp((q + pe * 0.5 + pb * 0.3) / 2.5, -1, 1);
    votes.push({
      role: "fundamentals",
      score,
      evidenceZh: `质量z=${fmt(f?.quality)} PE代理z=${fmt(f?.peProxy)}（OHLC代理，非真实财报）`,
      evidenceEn: `Quality z=${fmt(f?.quality)} PE-proxy z=${fmt(f?.peProxy)} (OHLC proxy, not filings)`,
    });
  }

  // Sentiment — news hit count mentioning name
  {
    const name = row.nameZh;
    const hits = (ctx.news ?? []).filter(
      (n) =>
        (n.titleZh + n.summaryZh).includes(name) ||
        (n.titleEn + n.summaryEn).toLowerCase().includes(row.nameEn.toLowerCase()),
    );
    const score = clamp(hits.length * 0.25 - 0.1, -1, 1);
    votes.push({
      role: "sentiment",
      score,
      evidenceZh: `问财资讯命中 ${hits.length} 条（标题/摘要含名称）`,
      evidenceEn: `${hits.length} Iwencai news hits matching name`,
    });
  }

  // Technical — bias + pattern confluence
  {
    const bias = row.signals?.bias ?? "neutral";
    const conf = patternConfluenceScore(row.recentPatterns) / 100;
    const biasN = bias === "bull" ? 0.5 : bias === "bear" ? -0.5 : 0;
    const ma =
      row.signals?.maAlign === "bull"
        ? 0.3
        : row.signals?.maAlign === "bear"
          ? -0.3
          : 0;
    const score = clamp(biasN + ma + conf * 0.4, -1, 1);
    votes.push({
      role: "technical",
      score,
      evidenceZh: `偏向=${bias} 形态共振=${Math.round(conf * 100)} MA=${row.signals?.maAlign ?? "—"}`,
      evidenceEn: `Bias=${bias} patternConf=${Math.round(conf * 100)} MA=${row.signals?.maAlign ?? "—"}`,
    });
  }

  // News/Filings — recent announcements + event buckets
  {
    const fils = (ctx.announcements ?? []).filter((a) => a.symbol === row.symbol);
    const buckets = new Map<EventBucketId, number>();
    for (const a of fils) {
      const b = classifyAnnouncementEvent(a.titleZh, a.summaryZh);
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    const earnings = buckets.get("earnings") ?? 0;
    const buyback = buckets.get("buyback") ?? 0;
    const holder = buckets.get("holder_change") ?? 0;
    // Earnings / buyback slightly supportive; heavy holder-change cautious
    const score = clamp(
      fils.length * 0.12 + earnings * 0.08 + buyback * 0.1 - holder * 0.05 - 0.05,
      -1,
      1,
    );
    const parts = EVENT_BUCKETS.filter((b) => (buckets.get(b.id) ?? 0) > 0)
      .map((b) => `${b.zh}:${buckets.get(b.id)}`)
      .join(" · ");
    const partsEn = EVENT_BUCKETS.filter((b) => (buckets.get(b.id) ?? 0) > 0)
      .map((b) => `${b.en}:${buckets.get(b.id)}`)
      .join(" · ");
    votes.push({
      role: "news",
      score,
      evidenceZh: `近期公告 ${fils.length} 条${parts ? `（${parts}）` : ""}`,
      evidenceEn: `${fils.length} recent filings${partsEn ? ` (${partsEn})` : ""}`,
    });
  }

  // Risk — vol / lowVol factor + stale
  {
    const lv = f?.lowVol ?? 0;
    const stale = row.dataStatus === "stale" ? -0.3 : 0;
    const spike = row.signals?.volumeSpike ? -0.1 : 0;
    const score = clamp(lv * 0.4 + stale + spike, -1, 1);
    votes.push({
      role: "risk",
      score,
      evidenceZh: `低波z=${fmt(f?.lowVol)} 数据=${row.dataStatus}${row.signals?.volumeSpike ? " 放量" : ""}`,
      evidenceEn: `Low-vol z=${fmt(f?.lowVol)} data=${row.dataStatus}${row.signals?.volumeSpike ? " vol↑" : ""}`,
    });
  }

  // Portfolio — liquidity ADV + composite
  {
    const adv = f?.sizeAdv ?? 0;
    const comp = f?.composite ?? 0;
    const score = clamp(adv * 0.3 + comp * 0.4, -1, 1);
    votes.push({
      role: "portfolio",
      score,
      evidenceZh: `ADV z=${fmt(f?.sizeAdv)} 综合z=${fmt(f?.composite)}`,
      evidenceEn: `ADV z=${fmt(f?.sizeAdv)} composite z=${fmt(f?.composite)}`,
    });
  }

  const consensus =
    votes.reduce((s, v) => s + v.score, 0) / Math.max(1, votes.length);
  const bias: CommitteeResult["bias"] =
    consensus >= 0.2 ? "bull" : consensus <= -0.2 ? "bear" : "neutral";

  return {
    symbol: row.symbol,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    votes,
    consensus,
    bias,
  };
}

function fmt(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(2);
}

export function rankCommittee(
  rows: SymbolRow[],
  ctx: {
    factors?: FactorScores[];
    announcements?: AnnouncementItem[];
    news?: IwencaiNewsItem[];
  },
  topN = 8,
): CommitteeResult[] {
  const fmap = new Map((ctx.factors ?? []).map((f) => [f.symbol, f]));
  return rows
    .filter((r) => r.dataStatus !== "missing")
    .map((r) =>
      voteForSymbol(r, {
        factor: fmap.get(r.symbol),
        announcements: ctx.announcements,
        news: ctx.news,
      }),
    )
    .sort((a, b) => b.consensus - a.consensus)
    .slice(0, topN);
}

export const ROLE_LABELS: Record<
  CommitteeRole,
  { zh: string; en: string }
> = {
  fundamentals: { zh: "基本面", en: "Fundamentals" },
  sentiment: { zh: "情绪", en: "Sentiment" },
  technical: { zh: "技术", en: "Technical" },
  news: { zh: "公告资讯", en: "News/Filings" },
  risk: { zh: "风控", en: "Risk" },
  portfolio: { zh: "组合", en: "Portfolio" },
};
