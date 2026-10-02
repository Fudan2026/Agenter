/**
 * Pure mapper: hithink-zhishu-query CLI rows → SPA index snapshot items.
 * No network — used by bake script and unit tests.
 */

export interface ZhishuDataRow {
  指数代码?: string;
  指数简称?: string;
  最新价?: string | number;
  [key: string]: unknown;
}

export interface IndexItem {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  last: number | null;
  changePct: number | null;
  query: string;
}

export interface IndicesPayload {
  generatedAt: string;
  source: "同花顺问财";
  skill: "hithink-zhishu-query";
  items: IndexItem[];
}

export interface ZhishuCliBody {
  success?: boolean;
  query?: string;
  datas?: ZhishuDataRow[] | null;
  error?: string;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/%/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function findChangePct(row: ZhishuDataRow): number | null {
  const direct = num(row["最新涨跌幅"]);
  if (direct != null) return direct;
  for (const [k, v] of Object.entries(row)) {
    if (k.includes("涨跌幅")) {
      const n = num(v);
      if (n != null) return n;
    }
  }
  return null;
}

export function mapZhishuRow(
  row: ZhishuDataRow,
  ctx: { query: string; nameEn: string; index: number },
): IndexItem | null {
  const nameZh = (row.指数简称 ?? "").trim() || ctx.query;
  const code = (row.指数代码 ?? "").trim() || `idx-${ctx.index}`;
  const last = num(row.最新价);
  const changePct = findChangePct(row);
  if (last == null && changePct == null && !(row.指数简称 ?? "").trim()) {
    return null;
  }
  return {
    id: `${code}-${ctx.index}`,
    code,
    nameZh,
    nameEn: ctx.nameEn,
    last,
    changePct,
    query: ctx.query,
  };
}

export function mapZhishuResponse(
  body: ZhishuCliBody,
  ctx: { query: string; nameEn: string },
): IndexItem[] {
  if (body.success === false) return [];
  const rows = Array.isArray(body.datas) ? body.datas : [];
  const out: IndexItem[] = [];
  rows.forEach((row, index) => {
    const item = mapZhishuRow(row, { ...ctx, index });
    if (item) out.push(item);
  });
  // Prefer first matching row for editorial strip
  return out.slice(0, 1);
}
