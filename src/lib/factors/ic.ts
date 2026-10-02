function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

export function spearmanIC(factor: number[], fwdRet: number[]): number | null {
  if (factor.length !== fwdRet.length || factor.length < 2) return null;
  return pearson(rank(factor), rank(fwdRet));
}

export function icSummary(
  pairs: Array<{ date: string; factor: number; fwdRet: number }>,
  horizons: number[],
): { horizon: number; ic: number; ir: number }[] {
  const byDate = new Map<string, { f: number[]; r: number[] }>();
  for (const p of pairs) {
    const bucket = byDate.get(p.date) ?? { f: [], r: [] };
    bucket.f.push(p.factor);
    bucket.r.push(p.fwdRet);
    byDate.set(p.date, bucket);
  }
  const dailyIcs: number[] = [];
  for (const { f, r } of byDate.values()) {
    const ic = spearmanIC(f, r);
    if (ic != null && !Number.isNaN(ic)) dailyIcs.push(ic);
  }
  const ic =
    dailyIcs.length > 0
      ? dailyIcs.reduce((a, b) => a + b, 0) / dailyIcs.length
      : spearmanIC(
          pairs.map((p) => p.factor),
          pairs.map((p) => p.fwdRet),
        ) ?? 0;
  const mean = ic;
  const std =
    dailyIcs.length > 1
      ? Math.sqrt(
          dailyIcs.reduce((s, x) => s + (x - mean) ** 2, 0) / (dailyIcs.length - 1),
        )
      : 0;
  const ir = std > 0 ? mean / std : mean;
  return horizons.map((h) => ({ horizon: h, ic: mean, ir }));
}

export function quantileReturns(
  factor: number[],
  fwdRet: number[],
  nQuantiles = 5,
): { q: number; meanRet: number }[] {
  const n = factor.length;
  if (n === 0 || n !== fwdRet.length) return [];
  const order = factor
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f - b.f)
    .map((x) => x.i);
  const qSize = Math.max(1, Math.floor(n / nQuantiles));
  const out: { q: number; meanRet: number }[] = [];
  for (let q = 0; q < nQuantiles; q++) {
    const start = q * qSize;
    const end = q === nQuantiles - 1 ? n : Math.min(n, (q + 1) * qSize);
    if (start >= end) {
      out.push({ q: q + 1, meanRet: 0 });
      continue;
    }
    const idxs = order.slice(start, end);
    const meanRet =
      idxs.reduce((s, i) => s + fwdRet[i], 0) / idxs.length;
    out.push({ q: q + 1, meanRet });
  }
  return out;
}
