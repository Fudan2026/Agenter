/**
 * Pure mapper: hithink-astock-selector CLI rows → SPA screen ticker items.
 * No network — used by bake script and unit tests.
 */

export interface SelectorDataRow {
  股票代码?: string;
  股票简称?: string;
  基金代码?: string;
  基金简称?: string;
  最新价?: string | number;
  最新涨跌幅?: string | number;
  [key: string]: unknown;
}

export interface ScreenTicker {
  code: string;
  nameZh: string;
  last: number | null;
  changePct: number | null;
}

export interface ScreenPanel {
  id: string;
  nameZh: string;
  nameEn: string;
  query: string;
  codeCount: number;
  tickers: ScreenTicker[];
}

export interface ScreensPayload {
  generatedAt: string;
  source: "同花顺问财";
  skill: "hithink-astock-selector";
  screens: ScreenPanel[];
}

export interface SelectorCliBody {
  success?: boolean;
  query?: string;
  code_count?: number;
  datas?: SelectorDataRow[] | null;
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

function findChangePct(row: SelectorDataRow): number | null {
  const direct = num(row.最新涨跌幅);
  if (direct != null) return direct;
  for (const [k, v] of Object.entries(row)) {
    if (k.includes("涨跌幅")) {
      const n = num(v);
      if (n != null) return n;
    }
  }
  return null;
}

export function mapSelectorRow(row: SelectorDataRow): ScreenTicker | null {
  const code = (row.股票代码 ?? row.基金代码 ?? "").trim();
  const nameZh = (row.股票简称 ?? row.基金简称 ?? "").trim();
  if (!code && !nameZh) return null;
  return {
    code: code || "—",
    nameZh: nameZh || code || "—",
    last: num(row.最新价),
    changePct: findChangePct(row),
  };
}

export function mapSelectorResponse(
  body: SelectorCliBody,
  meta: { id: string; nameZh: string; nameEn: string; query: string },
  topN = 8,
): ScreenPanel {
  const rows = body.success === false ? [] : Array.isArray(body.datas) ? body.datas : [];
  const tickers: ScreenTicker[] = [];
  for (const row of rows) {
    const t = mapSelectorRow(row);
    if (t) tickers.push(t);
    if (tickers.length >= topN) break;
  }
  return {
    id: meta.id,
    nameZh: meta.nameZh,
    nameEn: meta.nameEn,
    query: meta.query,
    codeCount: typeof body.code_count === "number" ? body.code_count : tickers.length,
    tickers,
  };
}
