/**
 * Deterministic OHLCV "attention" literacy proxy (zero LLM).
 * Distills StockFormer (arXiv 2401.06139 / Multitask-Stockformer):
 * dual-frequency (slow trend vs fast shock), temporal vs cross-name emphasis.
 * NOT real MHA / FinCast / StockFormer weights.
 */

export interface AttentionProxyRow {
  symbol: string;
  priceFocus: number;
  volumeFocus: number;
  /** Slow / low-frequency trend emphasis 0..1 */
  slowFocus: number;
  /** Fast / high-frequency shock emphasis 0..1 */
  fastFocus: number;
  /** Temporal (within-name) vs cross-sectional share of attention budget */
  temporalShare: number;
  crossShare: number;
  note: string;
}

export interface TransformerPvProxyPayload {
  generatedAt: string;
  reportDate: string;
  source: string;
  attribution: { zh: string; en: string };
  limitations: { zh: string[]; en: string[] };
  rows: AttentionProxyRow[];
}

type Bar = { c?: number; v?: number; o?: number; h?: number; l?: number };

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)) || 0);
}

/** Simple moving average as low-frequency proxy (StockFormer wavelet literacy). */
function sma(xs: number[], w: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const a = Math.max(0, i - w + 1);
    out.push(mean(xs.slice(a, i + 1)));
  }
  return out;
}

export function attentionProxyFromSeries(
  symbol: string,
  bars: Bar[],
  locale: "zh" | "en" = "en",
): AttentionProxyRow | null {
  if (!bars || bars.length < 8) return null;
  const slice = bars.slice(-40);
  const closes = slice.map((b) => Number(b.c)).filter((n) => Number.isFinite(n));
  const vols = slice.map((b) => Number(b.v)).filter((n) => Number.isFinite(n));
  if (closes.length < 8 || vols.length < 8) return null;

  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] !== 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const volMean = mean(vols) || 1;
  const volCv = std(vols) / volMean;
  const retVol = std(rets);
  const priceFocus = Math.min(1, retVol * 40);
  const volumeFocus = Math.min(1, volCv);

  // Dual-frequency: slow = |close - SMA10| / close; fast = |close - SMA3 residual|
  const slow = sma(closes, 10);
  const fastMa = sma(closes, 3);
  const last = closes.length - 1;
  const slowDev =
    closes[last] > 0 ? Math.abs(closes[last] - slow[last]) / closes[last] : 0;
  const fastResid =
    closes[last] > 0
      ? Math.abs(closes[last] - fastMa[last]) / closes[last]
      : 0;
  const slowFocus = Math.min(1, slowDev * 25);
  const fastFocus = Math.min(1, fastResid * 40);

  // Temporal vs cross: higher autocorrelation → more temporal; else cross-ish
  let ac = 0;
  if (rets.length > 3) {
    const a = rets.slice(0, -1);
    const b = rets.slice(1);
    const ma = mean(a);
    const mb = mean(b);
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] - ma;
      const y = b[i] - mb;
      num += x * y;
      da += x * x;
      db += y * y;
    }
    const den = Math.sqrt(da * db);
    ac = den > 1e-12 ? Math.abs(num / den) : 0;
  }
  const temporalShare = Math.min(0.85, Math.max(0.15, 0.35 + ac * 0.5));
  const crossShare = 1 - temporalShare;

  const note =
    locale === "zh"
      ? `价${(priceFocus * 100).toFixed(0)}%·量${(volumeFocus * 100).toFixed(0)}% · 慢频${(slowFocus * 100).toFixed(0)}%/快频${(fastFocus * 100).toFixed(0)}% · 时序${(temporalShare * 100).toFixed(0)}%/截面${(crossShare * 100).toFixed(0)}%（StockFormer 识字代理，非真实权重）`
      : `P${(priceFocus * 100).toFixed(0)}%·V${(volumeFocus * 100).toFixed(0)}% · slow${(slowFocus * 100).toFixed(0)}%/fast${(fastFocus * 100).toFixed(0)}% · temp${(temporalShare * 100).toFixed(0)}%/xsec${(crossShare * 100).toFixed(0)}% (StockFormer literacy proxy, not real MHA)`;

  return {
    symbol,
    priceFocus,
    volumeFocus,
    slowFocus,
    fastFocus,
    temporalShare,
    crossShare,
    note,
  };
}

export function buildTransformerPvProxy(
  symbols: Array<{
    symbol: string;
    candles: Array<{ close: number; volume: number }>;
  }>,
  reportDate: string,
): TransformerPvProxyPayload {
  const rows = symbols
    .map((s) =>
      attentionProxyFromSeries(
        s.symbol,
        (s.candles || []).map((c) => ({ c: c.close, v: c.volume })),
        "en",
      ),
    )
    .filter((r): r is AttentionProxyRow => Boolean(r))
    .sort(
      (a, b) =>
        b.priceFocus + b.volumeFocus + b.fastFocus -
        (a.priceFocus + a.volumeFocus + a.fastFocus),
    );

  return {
    generatedAt: new Date().toISOString(),
    reportDate,
    source: "StockFormer dual-frequency literacy proxy on bake OHLC (no weights)",
    attribution: {
      zh: "蒸馏 Multitask-Stockformer / StockFormer：双频（慢趋势/快冲击）与时序·截面注意力识字；本站不加载真实权重。",
      en: "Distill of Multitask-Stockformer / StockFormer: dual-frequency + temporal/cross attention literacy; no live weights on-site.",
    },
    limitations: {
      zh: [
        "无 FinCast / StockFormer 权重推理",
        "SMA 代理小波双频，非真实 DWT",
        "教育演示，非投资建议",
      ],
      en: [
        "No FinCast / StockFormer weight inference",
        "SMA stands in for wavelet dual-frequency (not real DWT)",
        "Educational only — not advice",
      ],
    },
    rows,
  };
}

export function renderAttentionBoard(rows: AttentionProxyRow[]): string {
  if (!rows.length) return "";
  return `<div class="attention-board">${rows
    .map(
      (r) =>
        `<div class="attention-cell"><strong>${r.symbol}</strong><br/>P ${(r.priceFocus * 100).toFixed(0)}% · V ${(r.volumeFocus * 100).toFixed(0)}%<br/>slow ${(r.slowFocus * 100).toFixed(0)}% / fast ${(r.fastFocus * 100).toFixed(0)}%<br/>T ${(r.temporalShare * 100).toFixed(0)}% · X ${(r.crossShare * 100).toFixed(0)}%<br/><span class="muted">${r.note}</span></div>`,
    )
    .join("")}</div>`;
}
