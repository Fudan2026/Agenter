/**
 * A-share trading friction model (default ON).
 * Commission / stamp (sell) / transfer / slippage; limit-band helpers.
 */

export interface CostBreakdown {
  commission: number;
  stampDuty: number;
  transferFee: number;
  slippage: number;
  total: number;
}

export interface CostConfig {
  enabled: boolean;
  commissionBps: number;
  minCommissionCny: number;
  stampDutyBpsSell: number;
  transferFeeBps: number;
  slippageBpsDefault: number;
  slippageBpsIlliquid: number;
}

export const DEFAULT_COST_CONFIG: CostConfig = {
  enabled: true,
  commissionBps: 2.5,
  minCommissionCny: 5,
  stampDutyBpsSell: 5,
  transferFeeBps: 0.1,
  slippageBpsDefault: 5,
  slippageBpsIlliquid: 10,
};

/** Board limit: ChiNext/STAR 20%, main 10%, ETF/index null (skip). */
export function priceLimitPct(symbol: string): number | null {
  const code = symbol.split(".")[0] ?? symbol;
  if (/^(51|15|56|58)/.test(code)) return null; // ETF-ish
  if (/^(000001|399)/.test(code) && /\.(SS|SZ)$/.test(symbol)) {
    // broad indices often 000001.SS / 399001.SZ
    if (code === "000001" && symbol.endsWith(".SS")) return null;
    if (code.startsWith("399")) return null;
  }
  if (/^(300|688)/.test(code)) return 0.2;
  if (/^\d{6}/.test(code)) return 0.1;
  return null;
}

export function isLimitLocked(opts: {
  symbol: string;
  side: "buy" | "sell";
  prevClose: number;
  fillPrice: number;
}): boolean {
  const band = priceLimitPct(opts.symbol);
  if (band == null || !(opts.prevClose > 0)) return false;
  const up = +(opts.prevClose * (1 + band)).toFixed(2);
  const down = +(opts.prevClose * (1 - band)).toFixed(2);
  if (opts.side === "buy" && opts.fillPrice >= up - 1e-9) return true;
  if (opts.side === "sell" && opts.fillPrice <= down + 1e-9) return true;
  return false;
}

export function slippageBpsForSymbol(
  _symbol: string,
  advRank01: number,
  cfg: CostConfig,
): number {
  if (advRank01 <= 0.25) return cfg.slippageBpsIlliquid;
  return cfg.slippageBpsDefault;
}

export function computeTradeCosts(opts: {
  side: "buy" | "sell";
  notional: number;
  symbol: string;
  cfg: CostConfig;
  advRank01?: number;
}): CostBreakdown {
  if (!opts.cfg.enabled) {
    return {
      commission: 0,
      stampDuty: 0,
      transferFee: 0,
      slippage: 0,
      total: 0,
    };
  }
  const n = Math.abs(opts.notional);
  const commission = Math.max(
    opts.cfg.minCommissionCny,
    (n * opts.cfg.commissionBps) / 10_000,
  );
  const stampDuty =
    opts.side === "sell" ? (n * opts.cfg.stampDutyBpsSell) / 10_000 : 0;
  const transferFee = (n * opts.cfg.transferFeeBps) / 10_000;
  const slipBps = slippageBpsForSymbol(
    opts.symbol,
    opts.advRank01 ?? 0.5,
    opts.cfg,
  );
  const slippage = (n * slipBps) / 10_000;
  const total = commission + stampDuty + transferFee + slippage;
  return { commission, stampDuty, transferFee, slippage, total };
}
