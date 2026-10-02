/**
 * Strategy Composer parameters (no-lookahead still enforced in engine).
 */

import type { StrategyId } from "./engine";

export interface StrategyParams {
  /** ma_cross */
  maFast?: number;
  maSlow?: number;
  /** rsi_mr */
  rsiPeriod?: number;
  rsiOs?: number;
  rsiOb?: number;
  /** confluence / pattern_confluence */
  confThreshold?: number;
  /** ml_lite */
  mlLags?: number;
  mlShrink?: number;
}

export const DEFAULT_STRATEGY_PARAMS: Required<StrategyParams> = {
  maFast: 20,
  maSlow: 60,
  rsiPeriod: 14,
  rsiOs: 30,
  rsiOb: 70,
  confThreshold: 60,
  mlLags: 5,
  mlShrink: 2,
};

export function mergeParams(p?: StrategyParams | null): Required<StrategyParams> {
  return { ...DEFAULT_STRATEGY_PARAMS, ...(p ?? {}) };
}

export function parseLabParams(hash: string): {
  lab: StrategyId | null;
  params: StrategyParams;
} {
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  const labRaw = params.get("lab");
  const lab = (labRaw as StrategyId) || null;
  const p: StrategyParams = {};
  const num = (k: string) => {
    const v = params.get(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  if (num("fast") != null) p.maFast = num("fast");
  if (num("slow") != null) p.maSlow = num("slow");
  if (num("rsi") != null) p.rsiPeriod = num("rsi");
  if (num("os") != null) p.rsiOs = num("os");
  if (num("ob") != null) p.rsiOb = num("ob");
  if (num("thr") != null) p.confThreshold = num("thr");
  if (num("lags") != null) p.mlLags = num("lags");
  if (num("shrink") != null) p.mlShrink = num("shrink");
  return { lab, params: p };
}
