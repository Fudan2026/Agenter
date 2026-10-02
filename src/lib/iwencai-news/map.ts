/**
 * Pure mapper: Iwencai news-search gateway rows → SPA news items.
 * No network — used by bake script and unit tests.
 */

export interface GatewayNewsRow {
  id?: string;
  uid?: string;
  title?: string;
  summary?: string;
  url?: string;
  publish_time?: number | string;
  publish_date?: string;
  channel?: string;
}

export interface IwencaiNewsItem {
  id: string;
  date: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  query?: string;
  url?: string;
}

export interface IwencaiNewsPayload {
  generatedAt: string;
  source: "同花顺问财";
  skill: "news-search";
  items: IwencaiNewsItem[];
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

export function mapNewsRow(
  row: GatewayNewsRow,
  ctx: { query: string; index: number },
): IwencaiNewsItem | null {
  const title = (row.title ?? "").trim();
  if (!title) return null;
  const summary = clip(row.summary ?? "");
  const date = asDateString(row.publish_date, row.publish_time);
  const rawId = (row.id || row.uid || `${ctx.query}-${date}-${ctx.index}`).toString();
  const id = `news-${rawId}`.replace(/\s+/g, "");
  return {
    id,
    date,
    titleZh: title,
    titleEn: title,
    summaryZh: summary || "（无摘要）",
    summaryEn: summary ? `(ZH) ${summary}` : "(no summary)",
    query: ctx.query,
    url: row.url?.trim() || undefined,
  };
}

export interface GatewayNewsBody {
  status_code?: number;
  status_msg?: string;
  data?: GatewayNewsRow[] | null;
}

export function mapNewsResponse(
  body: GatewayNewsBody,
  ctx: { query: string },
): IwencaiNewsItem[] {
  if (body.status_code !== 0 && body.status_code !== undefined) return [];
  const rows = Array.isArray(body.data) ? body.data : [];
  const out: IwencaiNewsItem[] = [];
  rows.forEach((row, index) => {
    const item = mapNewsRow(row, { ...ctx, index });
    if (item) out.push(item);
  });
  return out;
}
