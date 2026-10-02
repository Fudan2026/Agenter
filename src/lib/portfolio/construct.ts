export type WeightMode = "equal" | "score" | "inv_vol";

export function constructWeights(
  items: Array<{ symbol: string; score: number; vol: number }>,
  mode: WeightMode,
): Record<string, number> {
  if (!items.length) return {};
  const weights: Record<string, number> = {};
  if (mode === "equal") {
    const w = 1 / items.length;
    for (const it of items) weights[it.symbol] = w;
    return weights;
  }
  let raw: number[];
  if (mode === "score") {
    raw = items.map((it) => Math.max(0, it.score));
  } else {
    raw = items.map((it) => (it.vol > 0 ? 1 / it.vol : 0));
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const w = 1 / items.length;
    for (const it of items) weights[it.symbol] = w;
    return weights;
  }
  for (let i = 0; i < items.length; i++) {
    weights[items[i].symbol] = raw[i] / sum;
  }
  return weights;
}
