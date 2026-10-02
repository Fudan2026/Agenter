/**
 * Half-Kelly position sizing (Thorp practical fraction).
 */

import { ASHARE_LOT, PAPER_MAX_NAME_PCT } from "./types";

export interface KellyInput {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  equity: number;
  price: number;
  lotSize?: number;
  maxNamePct?: number;
  fraction?: number;
}

export interface KellySuggestion {
  fStar: number;
  fUsed: number;
  rawQty: number;
  qtyLots: number;
  assumptions: string[];
  failureModes: string[];
}

export function conservativeDefaults(): Pick<
  KellyInput,
  "winRate" | "avgWin" | "avgLoss"
> {
  return { winRate: 0.52, avgWin: 1, avgLoss: 1 };
}

export function suggestHalfKelly(input: KellyInput): KellySuggestion {
  const lot = input.lotSize ?? ASHARE_LOT;
  const maxName = input.maxNamePct ?? PAPER_MAX_NAME_PCT;
  const fraction = input.fraction ?? 0.5;
  const p = input.winRate;
  const b = input.avgLoss > 0 ? input.avgWin / input.avgLoss : 0;
  let fStar = 0;
  if (b > 0 && p > 0 && p < 1) {
    fStar = p - (1 - p) / b;
  }
  if (!Number.isFinite(fStar) || fStar < 0) fStar = 0;
  const fUsed = fraction * fStar;
  const budget = Math.min(
    input.equity * fUsed,
    input.equity * maxName,
  );
  const rawQty = input.price > 0 ? budget / input.price : 0;
  const qtyLots = Math.floor(rawQty / lot) * lot;
  return {
    fStar,
    fUsed,
    rawQty,
    qtyLots: qtyLots >= lot ? qtyLots : 0,
    assumptions: [
      `p=${p.toFixed(2)}`,
      `b=${b.toFixed(2)}`,
      `half-Kelly fraction=${fraction}`,
      `max name ${maxName * 100}%`,
    ],
    failureModes: [
      "edge estimate error",
      "serial correlation / non-i.i.d. bets",
      "tail events outside sample",
      "crowding / reflexivity",
    ],
  };
}
