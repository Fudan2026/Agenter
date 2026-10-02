/**
 * Pure mapper: Iwencai announcement gateway rows → SPA announcement items.
 * No network — used by bake script and unit tests.
 */

export interface GatewayAnnouncementRow {
  id?: string;
  uid?: string;
  title?: string;
  summary?: string;
  url?: string;
  publish_time?: number | string;
  publish_date?: string;
}

export interface AnnouncementItem {
  id: string;
  symbol: string;
  nameZh: string;
  date: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  url?: string;
}

export interface AnnouncementsPayload {
  generatedAt: string;
  source: "同花顺问财";
  skill: "announcement-search";
  items: AnnouncementItem[];
}

function asDateString(
  publishDate?: string,
  publishTime?: number | string,
): string {
  if (publishDate) {
    const d = publishDate.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }
  if (typeof publishTime === "number" && Number.isFinite(publishTime)) {
    // Gateway may send seconds or milliseconds
    const ms = publishTime > 1e12 ? publishTime : publishTime * 1000;
    const iso = new Date(ms).toISOString();
    if (Number.isFinite(Date.parse(iso))) return iso.slice(0, 10);
  }
  if (typeof publishTime === "string" && publishTime.trim()) {
    const parsed = Date.parse(publishTime);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function clip(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/** Map one gateway row for a watchlist symbol into a stable SPA item. */
export function mapGatewayRow(
  row: GatewayAnnouncementRow,
  ctx: { symbol: string; nameZh: string; index: number },
): AnnouncementItem | null {
  const title = (row.title ?? "").trim();
  if (!title) return null;
  const summary = clip(row.summary ?? "");
  const date = asDateString(row.publish_date, row.publish_time);
  const rawId = (row.id || row.uid || `${ctx.symbol}-${date}-${ctx.index}`).toString();
  const id = `${ctx.symbol}-${rawId}`.replace(/\s+/g, "");
  return {
    id,
    symbol: ctx.symbol,
    nameZh: ctx.nameZh,
    date,
    titleZh: title,
    titleEn: title,
    summaryZh: summary || "（无摘要）",
    summaryEn: summary ? `(ZH) ${summary}` : "(no summary)",
    url: row.url?.trim() || undefined,
  };
}

export interface GatewaySearchBody {
  status_code?: number;
  status_msg?: string;
  data?: GatewayAnnouncementRow[] | null;
}

/** Extract and map rows from a raw gateway JSON body for one symbol. */
export function mapGatewayResponse(
  body: GatewaySearchBody,
  ctx: { symbol: string; nameZh: string },
): AnnouncementItem[] {
  if (body.status_code !== 0 && body.status_code !== undefined) return [];
  const rows = Array.isArray(body.data) ? body.data : [];
  const out: AnnouncementItem[] = [];
  rows.forEach((row, index) => {
    const item = mapGatewayRow(row, { ...ctx, index });
    if (item) out.push(item);
  });
  return out;
}
