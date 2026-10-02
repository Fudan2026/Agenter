/**
 * Cross-sectional OHLC-proxy factor board.
 * Distill of SkillHub factor skills — not live fundamentals.
 */

export interface FactorScores {
  symbol: string;
  nameZh: string;
  nameEn: string;
  momentum: number | null;
  lowVol: number | null;
  sizeAdv: number | null;
  quality: number | null;
  composite: number | null;
  rank: number | null;
}

export interface FactorsPayload {
  generatedAt: string;
  reportDate: string;
  source: string;
  attribution: { zh: string; en: string };
  topN: number;
  factors: FactorScores[];
  adfStrip: Array<{
    symbol: string;
    nameZh: string;
    nameEn: string;
    adfStat: number | null;
    adfP: number | null;
    stationary: boolean | null;
    dailyVol: number | null;
  }>;
}

function zscore(vals: (number | null)[]): (number | null)[] {
  const finite = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length < 2) return vals.map(() => null);
  const mean = finite.reduce((s, x) => s + x, 0) / finite.length;
  const varSum = finite.reduce((s, x) => s + (x - mean) ** 2, 0);
  const sd = Math.sqrt(varSum / (finite.length - 1));
  if (!(sd > 1e-12)) return vals.map(() => null);
  return vals.map((v) => (v == null || !Number.isFinite(v) ? null : (v - mean) / sd));
}

function momentum12_1(closes: number[]): number | null {
  if (closes.length < 40) return null;
  const n = closes.length;
  const skip = Math.min(21, Math.floor(n / 10));
  const lookback = Math.min(252, n - 1);
  const end = n - 1 - skip;
  const start = Math.max(0, n - 1 - lookback);
  if (end <= start) return null;
  const a = closes[start];
  const b = closes[end];
  if (!(a > 0)) return null;
  return b / a - 1;
}

function realizedVol(closes: number[], win = 60): number | null {
  if (closes.length < win + 1) return null;
  const rets: number[] = [];
  for (let i = closes.length - win; i < closes.length; i++) {
    const p = closes[i - 1];
    if (p > 0) rets.push(closes[i] / p - 1);
  }
  if (rets.length < 10) return null;
  const m = rets.reduce((s, r) => s + r, 0) / rets.length;
  const v = rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(v);
}

/** Higher = more liquid (ADV). */
function advNotional(
  candles: Array<{ close: number; volume: number }>,
  win = 20,
): number | null {
  const slice = candles.slice(-win);
  if (slice.length < 5) return null;
  const sum = slice.reduce((s, c) => s + c.close * c.volume, 0);
  return sum / slice.length;
}

/**
 * Quality proxy: return / vol (Sharpe-like) over ~60d — educational OHLC stand-in.
 */
function qualityProxy(closes: number[], win = 60): number | null {
  if (closes.length < win + 1) return null;
  const rets: number[] = [];
  for (let i = closes.length - win; i < closes.length; i++) {
    const p = closes[i - 1];
    if (p > 0) rets.push(closes[i] / p - 1);
  }
  if (rets.length < 10) return null;
  const m = rets.reduce((s, r) => s + r, 0) / rets.length;
  const v = rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(v);
  if (!(sd > 1e-12)) return null;
  return m / sd;
}

export interface BakeRow {
  symbol: string;
  nameZh: string;
  nameEn: string;
  group: string;
  candles: Array<{ close: number; volume: number }>;
}

export function buildFactorBoard(
  rows: BakeRow[],
  opts?: { topN?: number; reportDate?: string },
): FactorsPayload {
  const topN = opts?.topN ?? 8;
  const ashare = rows.filter(
    (r) => r.group === "china-ashare" || r.group === "china-etf",
  );
  const universe = ashare.length ? ashare : rows;

  const rawMom = universe.map((r) =>
    momentum12_1(r.candles.map((c) => c.close)),
  );
  const rawVol = universe.map((r) =>
    realizedVol(r.candles.map((c) => c.close)),
  );
  const rawAdv = universe.map((r) => advNotional(r.candles));
  const rawQual = universe.map((r) =>
    qualityProxy(r.candles.map((c) => c.close)),
  );

  // Higher momentum / quality / ADV good; lower vol good → invert vol before z
  const zMom = zscore(rawMom);
  const zLowVol = zscore(rawVol.map((v) => (v == null ? null : -v)));
  const zSize = zscore(rawAdv); // liquidity / size-ADV proxy (higher ADV → higher)
  const zQual = zscore(rawQual);

  const scored: FactorScores[] = universe.map((r, i) => {
    const parts = [zMom[i], zLowVol[i], zSize[i], zQual[i]].filter(
      (v): v is number => v != null,
    );
    const composite =
      parts.length >= 2
        ? parts.reduce((s, x) => s + x, 0) / parts.length
        : null;
    return {
      symbol: r.symbol,
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      momentum: zMom[i],
      lowVol: zLowVol[i],
      sizeAdv: zSize[i],
      quality: zQual[i],
      composite,
      rank: null,
    };
  });

  scored.sort((a, b) => (b.composite ?? -999) - (a.composite ?? -999));
  scored.forEach((s, i) => {
    s.rank = s.composite == null ? null : i + 1;
  });

  // ADF strip: prefer major A-share names first
  const majors = [
    "510300.SS",
    "510050.SS",
    "600519.SS",
    "601318.SS",
    "000858.SZ",
    "300750.SZ",
  ];
  const stripSrc = [
    ...majors
      .map((sym) => universe.find((r) => r.symbol === sym))
      .filter((r): r is BakeRow => !!r),
    ...universe.filter((r) => !majors.includes(r.symbol)),
  ].slice(0, 8);

  // lazy import avoided — caller can attach ADF; we compute vol here and leave adf to bake script
  const adfStrip = stripSrc.map((r) => {
    const closes = r.candles.map((c) => c.close);
    const vol = realizedVol(closes, 60);
    return {
      symbol: r.symbol,
      nameZh: r.nameZh,
      nameEn: r.nameEn,
      adfStat: null as number | null,
      adfP: null as number | null,
      stationary: null as boolean | null,
      dailyVol: vol,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    reportDate: opts?.reportDate ?? new Date().toISOString().slice(0, 10),
    source: "ohlc-proxy",
    attribution: {
      zh: "分数来自烘焙 OHLC 代理（动量 / 低波 / ADV / 质量），是因子技能的站点 distill，非实时基本面行情。",
      en: "Scores are OHLC-proxy distill (momentum / low-vol / ADV / quality) of factor skills — not a live fundamental feed.",
    },
    topN,
    factors: scored,
    adfStrip,
  };
}
