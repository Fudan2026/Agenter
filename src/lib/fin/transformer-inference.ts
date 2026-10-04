/**
 * Lightweight PatchTST-style edge inference (distilled, no ONNX in Workers).
 * Produces next-day return/volume distribution, attention heatmap, confidence.
 * Optional SPA path may set engine=transformers_js when VITE_ENABLE_ONNX_PATCHTST=1.
 */

export type InferBar = {
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

export interface PredictionBand {
  lo: number;
  mid: number;
  hi: number;
}

export interface TransformerInferenceRow {
  symbol: string;
  prediction_band: PredictionBand;
  next_day_return_dist: {
    mean: number;
    std: number;
    p10: number;
    p50: number;
    p90: number;
  };
  volume_prob: { up: number; flat: number; down: number };
  attention_heatmap_data: {
    patch_count: number;
    patch_len: number;
    weights: number[];
    features: string[];
  };
  prediction_confidence: number;
  engine: "distill_patch" | "transformers_js";
  last_close: number;
  note: string;
}

export interface TransformerInferBakePayload {
  generatedAt: string;
  reportDate: string;
  source: string;
  attribution: { zh: string; en: string };
  limitations: { zh: string[]; en: string[] };
  rows: TransformerInferenceRow[];
}

const PATCH_LEN = 8;
const MAX_PATCHES = 8;

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)) || 0);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function softmax(xs: number[]): number[] {
  if (!xs.length) return [];
  const m = Math.max(...xs);
  const ex = xs.map((x) => Math.exp(x - m));
  const s = ex.reduce((a, b) => a + b, 0) || 1;
  return ex.map((e) => e / s);
}

/** Patchify a 1d series into non-overlapping patches (tail-aligned). */
export function patchifySeries(series: number[], patchLen = PATCH_LEN): number[][] {
  if (series.length < patchLen) return [];
  const n = Math.min(MAX_PATCHES, Math.floor(series.length / patchLen));
  const start = series.length - n * patchLen;
  const patches: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = start + i * patchLen;
    patches.push(series.slice(a, a + patchLen));
  }
  return patches;
}

/** Project patch → scalar score (mean + slope + energy). */
function patchScore(patch: number[]): number {
  const m = mean(patch);
  const first = patch[0] ?? 0;
  const last = patch[patch.length - 1] ?? 0;
  const slope = last - first;
  const energy = std(patch);
  return m * 0.35 + slope * 0.45 + energy * 0.2;
}

/**
 * Distilled temporal attention over patches (PatchTST literacy).
 * Returns attention weights and a context vector (weighted patch means).
 */
export function temporalAttention(patches: number[][]): {
  weights: number[];
  context: number;
} {
  if (!patches.length) return { weights: [], context: 0 };
  const logits = patches.map((p, i) => {
    // Recency bias: later patches get a small additive boost
    return patchScore(p) + i * 0.05;
  });
  const weights = softmax(logits);
  const context = weights.reduce(
    (acc, w, i) => acc + w * mean(patches[i] || []),
    0,
  );
  return { weights, context };
}

function returnsFromCloses(closes: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return rets;
}

function volumeChangeDir(vols: number[]): { up: number; flat: number; down: number } {
  if (vols.length < 4) return { up: 0.33, flat: 0.34, down: 0.33 };
  let up = 0;
  let down = 0;
  let flat = 0;
  for (let i = 1; i < vols.length; i++) {
    const prev = vols[i - 1] || 1;
    const ch = ((vols[i] || 0) - prev) / prev;
    if (ch > 0.02) up++;
    else if (ch < -0.02) down++;
    else flat++;
  }
  const n = up + down + flat || 1;
  return { up: up / n, flat: flat / n, down: down / n };
}

/**
 * Run distilled PatchTST-style inference on an OHLCV window.
 */
export function runTransformerInference(
  symbol: string,
  bars: InferBar[],
  locale: "zh" | "en" = "en",
): TransformerInferenceRow | null {
  if (!bars || bars.length < PATCH_LEN + 2) return null;
  const slice = bars.slice(-Math.max(64, PATCH_LEN * MAX_PATCHES));
  const closes = slice
    .map((b) => Number(b.c))
    .filter((n) => Number.isFinite(n) && n > 0);
  const vols = slice
    .map((b) => Number(b.v))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (closes.length < PATCH_LEN + 2) return null;

  const rets = returnsFromCloses(closes);
  const retPatches = patchifySeries(rets, Math.min(PATCH_LEN, Math.max(4, Math.floor(rets.length / MAX_PATCHES)) || PATCH_LEN));
  const closePatches = patchifySeries(closes, PATCH_LEN);
  const patches = retPatches.length ? retPatches : closePatches;
  if (!patches.length) return null;

  const { weights, context } = temporalAttention(patches);
  const retMean = mean(rets.slice(-20));
  const retStd = std(rets.slice(-20)) || 0.01;
  // Forecast head: blend recent mean with attention context (normalized)
  const ctxNorm = Number.isFinite(context) ? context * 0.15 : 0;
  const meanRet = retMean * 0.65 + ctxNorm * 0.35;
  const confBase = clamp01(1 - retStd * 18);
  const attnEntropy =
    weights.length > 0
      ? -weights.reduce((s, w) => s + (w > 1e-12 ? w * Math.log(w) : 0), 0) /
        Math.log(weights.length || 2)
      : 1;
  const prediction_confidence = clamp01(confBase * (1 - 0.35 * attnEntropy) + 0.15);

  const z10 = -1.2816;
  const z90 = 1.2816;
  const next_day_return_dist = {
    mean: meanRet,
    std: retStd,
    p10: meanRet + z10 * retStd,
    p50: meanRet,
    p90: meanRet + z90 * retStd,
  };
  const last_close = closes[closes.length - 1]!;
  const prediction_band: PredictionBand = {
    lo: last_close * (1 + next_day_return_dist.p10),
    mid: last_close * (1 + next_day_return_dist.p50),
    hi: last_close * (1 + next_day_return_dist.p90),
  };

  const volume_prob = volumeChangeDir(vols.length ? vols : closes.map(() => 1));
  const note =
    locale === "zh"
      ? `蒸馏 PatchTST 边缘推理 · 置信 ${(prediction_confidence * 100).toFixed(0)}% · 非 ONNX/非训练权重`
      : `Distill PatchTST edge infer · conf ${(prediction_confidence * 100).toFixed(0)}% · not ONNX/trained weights`;

  return {
    symbol,
    prediction_band,
    next_day_return_dist,
    volume_prob,
    attention_heatmap_data: {
      patch_count: weights.length,
      patch_len: PATCH_LEN,
      weights: weights.map((w) => Number(w.toFixed(4))),
      features: ["return_patches", "close", "volume"],
    },
    prediction_confidence: Number(prediction_confidence.toFixed(4)),
    engine: "distill_patch",
    last_close,
    note,
  };
}

export function buildTransformerInferBake(
  symbols: Array<{
    symbol: string;
    candles: Array<{
      open?: number;
      high?: number;
      low?: number;
      close: number;
      volume: number;
    }>;
  }>,
  reportDate: string,
): TransformerInferBakePayload {
  const rows = symbols
    .map((s) =>
      runTransformerInference(
        s.symbol,
        (s.candles || []).map((c) => ({
          o: c.open,
          h: c.high,
          l: c.low,
          c: c.close,
          v: c.volume,
        })),
        "en",
      ),
    )
    .filter((r): r is TransformerInferenceRow => Boolean(r))
    .sort((a, b) => b.prediction_confidence - a.prediction_confidence);

  return {
    generatedAt: new Date().toISOString(),
    reportDate,
    source:
      "PatchTST-distill edge inference on bake OHLC (no ONNX in Workers; no trained weights)",
    attribution: {
      zh: "蒸馏 PatchTST / TimeGPT / FinGPT 思路：补丁时序注意力 + 次日收益分位带；浏览器边缘推理，Workers 不嵌入 ONNX。",
      en: "Distill of PatchTST / TimeGPT / FinGPT ideas: patch temporal attention + next-day quantile bands; browser-edge; no ONNX in Workers.",
    },
    limitations: {
      zh: [
        "默认 distill_patch，非 HuggingFace ONNX 权重",
        "分位带为启发式高斯，非校准概率",
        "教育演示，非投资建议",
      ],
      en: [
        "Default distill_patch — not HuggingFace ONNX weights",
        "Bands are heuristic Gaussian, not calibrated probs",
        "Educational only — not advice",
      ],
    },
    rows,
  };
}

export function formatInferenceContext(rows: TransformerInferenceRow[], limit = 6): string {
  return rows
    .slice(0, limit)
    .map(
      (r) =>
        `- ${r.symbol} mid=${r.prediction_band.mid.toFixed(2)} lo=${r.prediction_band.lo.toFixed(2)} hi=${r.prediction_band.hi.toFixed(2)} conf=${r.prediction_confidence.toFixed(2)} retMean=${r.next_day_return_dist.mean.toFixed(4)} engine=${r.engine}`,
    )
    .join("\n");
}
