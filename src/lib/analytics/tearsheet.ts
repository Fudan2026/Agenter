function dailyReturns(equity: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    if (equity[i - 1] === 0) rets.push(0);
    else rets.push(equity[i] / equity[i - 1] - 1);
  }
  return rets;
}

function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 0;
  let maxDd = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = peak > 0 ? (peak - e) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v =
    values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function tearsheetFromEquity(
  equity: number[],
  dates?: string[],
): {
  cagr: number | null;
  vol: number;
  sharpe: number;
  sortino: number;
  calmar: number | null;
  maxDd: number;
  winRate: number;
  bestDay: number;
  worstDay: number;
  monthly: Array<{ ym: string; ret: number }>;
} {
  const empty = {
    cagr: null as number | null,
    vol: 0,
    sharpe: 0,
    sortino: 0,
    calmar: null as number | null,
    maxDd: 0,
    winRate: 0,
    bestDay: 0,
    worstDay: 0,
    monthly: [] as Array<{ ym: string; ret: number }>,
  };
  if (equity.length < 2) return empty;

  const rets = dailyReturns(equity);
  const ann = 252;
  const vol = std(rets) * Math.sqrt(ann);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sharpe = std(rets) > 0 ? (mean / std(rets)) * Math.sqrt(ann) : 0;
  const downside = rets.filter((r) => r < 0);
  const downStd = std(downside);
  const sortino =
    downStd > 0 ? (mean / downStd) * Math.sqrt(ann) : mean > 0 ? sharpe : 0;

  const years = (equity.length - 1) / ann;
  const cagr =
    years > 0 && equity[0] > 0
      ? (equity[equity.length - 1] / equity[0]) ** (1 / years) - 1
      : null;

  const maxDd = maxDrawdown(equity);
  const calmar = cagr != null && maxDd > 0 ? cagr / maxDd : null;

  const wins = rets.filter((r) => r > 0).length;
  const winRate = rets.length ? wins / rets.length : 0;
  const bestDay = rets.length ? Math.max(...rets) : 0;
  const worstDay = rets.length ? Math.min(...rets) : 0;

  const monthly: Array<{ ym: string; ret: number }> = [];
  if (dates && dates.length === equity.length) {
    const buckets = new Map<string, { start: number; end: number }>();
    for (let i = 0; i < equity.length; i++) {
      const ym = dates[i].slice(0, 7);
      const b = buckets.get(ym);
      if (!b) buckets.set(ym, { start: equity[i], end: equity[i] });
      else b.end = equity[i];
    }
    for (const [ym, b] of [...buckets.entries()].sort((a, c) =>
      a[0].localeCompare(c[0]),
    )) {
      monthly.push({
        ym,
        ret: b.start > 0 ? b.end / b.start - 1 : 0,
      });
    }
  }

  return {
    cagr,
    vol,
    sharpe,
    sortino,
    calmar,
    maxDd,
    winRate,
    bestDay,
    worstDay,
    monthly,
  };
}
