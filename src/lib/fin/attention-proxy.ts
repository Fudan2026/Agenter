/**
 * Deterministic OHLCV "attention" literacy proxy (zero LLM).
 * Distills StockFormer idea: temporal vs volume emphasis — not real MHA weights.
 */

export interface AttentionProxyRow {
  symbol: string;
  priceFocus: number;
  volumeFocus: number;
  note: string;
}

type Bar = { c?: number; v?: number; o?: number; h?: number; l?: number };

export function attentionProxyFromSeries(
  symbol: string,
  bars: Bar[],
  locale: "zh" | "en" = "en",
): AttentionProxyRow | null {
  if (!bars || bars.length < 8) return null;
  const slice = bars.slice(-20);
  const closes = slice.map((b) => Number(b.c)).filter((n) => Number.isFinite(n));
  const vols = slice.map((b) => Number(b.v)).filter((n) => Number.isFinite(n));
  if (closes.length < 5 || vols.length < 5) return null;

  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] !== 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const std = (xs: number[]) => {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)) || 0);
  };
  const volMean = mean(vols) || 1;
  const volCv = std(vols) / volMean;
  const retVol = std(rets);
  const priceFocus = Math.min(1, retVol * 40);
  const volumeFocus = Math.min(1, volCv);
  const note =
    locale === "zh"
      ? `价侧重≈${(priceFocus * 100).toFixed(0)}% · 量侧重≈${(volumeFocus * 100).toFixed(0)}%（相关代理，非真实注意力权重）`
      : `price≈${(priceFocus * 100).toFixed(0)}% · volume≈${(volumeFocus * 100).toFixed(0)}% (correlation proxy, not real MHA)`;
  return { symbol, priceFocus, volumeFocus, note };
}

export function renderAttentionBoard(
  rows: AttentionProxyRow[],
): string {
  if (!rows.length) return "";
  return `<div class="attention-board">${rows
    .map(
      (r) =>
        `<div class="attention-cell"><strong>${r.symbol}</strong><br/>P ${(r.priceFocus * 100).toFixed(0)}% · V ${(r.volumeFocus * 100).toFixed(0)}%<br/><span class="muted">${r.note}</span></div>`,
    )
    .join("")}</div>`;
}
