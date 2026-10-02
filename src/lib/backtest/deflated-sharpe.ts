/**
 * Harvey / Bailey–LdP style haircut / Deflated Sharpe (simplified).
 * N trials locked to max(4, nStrategies*3) = 12 for current lab.
 */

export const DEFAULT_N_TRIALS = 12;

function normCdf(x: number): number {
  // Abramowitz–Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function sharpeToT(sharpe: number, nObs: number): number {
  if (nObs <= 1) return 0;
  return sharpe * Math.sqrt(nObs);
}

export function haircutSharpe(opts: {
  sharpe: number;
  nObs: number;
  nTrials?: number;
}): {
  t: number;
  pSingle: number;
  pMulti: number;
  sharpeHaircut: number;
  haircutPct: number;
} {
  const nTrials = opts.nTrials ?? DEFAULT_N_TRIALS;
  const t = sharpeToT(opts.sharpe, opts.nObs);
  const pSingle = 2 * (1 - normCdf(Math.abs(t)));
  const pMulti = Math.min(1, pSingle * nTrials);
  // Map multi-test p back to equivalent |t| via rough inverse through SR scale
  // Conservatively haircut SR proportional to p inflation.
  const scale =
    pSingle > 0 && pMulti > 0 ? Math.sqrt(pSingle / pMulti) : 0;
  const sharpeHaircut =
    opts.sharpe > 0 ? opts.sharpe * Math.min(1, Math.max(0, scale)) : opts.sharpe;
  const haircutPct =
    opts.sharpe !== 0
      ? (1 - sharpeHaircut / opts.sharpe) * 100
      : 0;
  return { t, pSingle, pMulti, sharpeHaircut, haircutPct };
}

export function deflatedSharpeVerdict(
  sharpeHaircut: number,
  maxDdPct: number,
): "green" | "yellow" | "red" {
  if (sharpeHaircut >= 0.5 && maxDdPct < 25) return "green";
  if (sharpeHaircut > 0 && maxDdPct < 40) return "yellow";
  return "red";
}
