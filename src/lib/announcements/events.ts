/**
 * Coarse announcement event buckets (camp 进阶主题二 distill).
 * Keyword rules only — no LLM. Used by Quant/News/Asset strips.
 */

import type { AnnouncementItem } from "./map";

export type EventBucketId =
  | "earnings"
  | "buyback"
  | "holder_change"
  | "other";

export interface EventBucketMeta {
  id: EventBucketId;
  zh: string;
  en: string;
}

export const EVENT_BUCKETS: EventBucketMeta[] = [
  { id: "earnings", zh: "业绩/财报", en: "Earnings / results" },
  { id: "buyback", zh: "回购", en: "Buyback" },
  { id: "holder_change", zh: "增减持", en: "Holder change" },
  { id: "other", zh: "其他", en: "Other" },
];

const RULES: Array<{ id: EventBucketId; re: RegExp }> = [
  {
    id: "earnings",
    re: /业绩|年度报告|半年度报告|季度报告|年报|半年报|季报|财报|预告|快报|earnings|results|annual|interim/i,
  },
  {
    id: "buyback",
    re: /回购|buyback|repurchase/i,
  },
  {
    id: "holder_change",
    re: /增持|减持|权益变动|持股变动|举牌|insider|holdings?\s*change/i,
  },
];

export function classifyAnnouncementEvent(
  title: string,
  summary = "",
): EventBucketId {
  const hay = `${title} ${summary}`;
  for (const r of RULES) {
    if (r.re.test(hay)) return r.id;
  }
  return "other";
}

export interface BucketedAnnouncement extends AnnouncementItem {
  bucket: EventBucketId;
}

export function bucketAnnouncements(
  items: AnnouncementItem[],
): BucketedAnnouncement[] {
  return items.map((a) => ({
    ...a,
    bucket: classifyAnnouncementEvent(a.titleZh, a.summaryZh),
  }));
}

/** Count by bucket for strip UI. */
export function countByBucket(
  items: AnnouncementItem[],
): Record<EventBucketId, number> {
  const out: Record<EventBucketId, number> = {
    earnings: 0,
    buyback: 0,
    holder_change: 0,
    other: 0,
  };
  for (const a of items) {
    out[classifyAnnouncementEvent(a.titleZh, a.summaryZh)] += 1;
  }
  return out;
}

/**
 * Post-event return placeholder: close after event date vs close on/before date.
 * Returns null when OHLC series lack coverage.
 */
export function postEventReturnPct(
  eventDate: string,
  candles: Array<{ date: string; close: number }>,
  horizon = 5,
): number | null {
  if (!candles.length || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  let i0 = -1;
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].date <= eventDate) i0 = i;
    else break;
  }
  if (i0 < 0) return null;
  // Inclusive horizon window: i0 .. i0+horizon-1 (need horizon >= 2).
  const j = Math.min(candles.length - 1, i0 + horizon - 1);
  if (j <= i0) return null;
  const a = candles[i0].close;
  const b = candles[j].close;
  if (!(a > 0) || !Number.isFinite(b)) return null;
  return ((b - a) / a) * 100;
}
