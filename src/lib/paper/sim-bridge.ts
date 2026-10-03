/**
 * Sim Desk ↔ Paper Pro bridge (localStorage only — no THS API).
 */

import type { SimLedger, SimPosition } from "../sim/types";
import {
  applyBuy,
  equityMark,
  normalizeQty,
  resolveNextOpenFill,
  type CandleBar,
} from "./engine";
import type { PaperState } from "./types";
import { loadPaperState, savePaperState } from "./journal";

export interface SimReconcileRow {
  symbol: string;
  simQty: number;
  paperQty: number;
  deltaQty: number;
}

export interface SimReconcileSnapshot {
  simCash: number;
  paperCash: number;
  cashDelta: number;
  rows: SimReconcileRow[];
}

export function reconcileSimPaper(
  sim: SimLedger,
  paper: PaperState,
): SimReconcileSnapshot {
  const syms = new Set<string>([
    ...sim.positions.map((p) => p.symbol),
    ...paper.positions.map((p) => p.symbol),
  ]);
  const rows: SimReconcileRow[] = [];
  for (const symbol of [...syms].sort()) {
    const simQty = sim.positions.find((p) => p.symbol === symbol)?.qty ?? 0;
    const paperQty =
      paper.positions.find((p) => p.symbol === symbol)?.qty ?? 0;
    if (simQty === 0 && paperQty === 0) continue;
    rows.push({
      symbol,
      simQty,
      paperQty,
      deltaQty: paperQty - simQty,
    });
  }
  return {
    simCash: sim.cash,
    paperCash: paper.cash,
    cashDelta: paper.cash - sim.cash,
    rows,
  };
}

export function importSimPositionsToPaper(
  sim: SimLedger,
  candlesBySymbol: Record<string, CandleBar[]>,
  groupBySymbol: Record<string, "macro" | "china-etf" | "china-ashare">,
  lastCloseBySymbol: Record<string, number>,
): { applied: number; skipped: number; state: PaperState } {
  let state = loadPaperState();
  let applied = 0;
  let skipped = 0;
  const eq = equityMark(state, lastCloseBySymbol);
  for (const pos of sim.positions) {
    if (pos.qty <= 0) {
      skipped += 1;
      continue;
    }
    const candles = candlesBySymbol[pos.symbol];
    if (!candles?.length) {
      skipped += 1;
      continue;
    }
    // Use second-to-last bar as signal so next_open can resolve when possible
    const sig =
      candles.length >= 2
        ? candles[candles.length - 2].date
        : candles[candles.length - 1].date;
    const fill = resolveNextOpenFill(candles, sig);
    if (!fill || fill.fillRule !== "next_open") {
      skipped += 1;
      continue;
    }
    const group = groupBySymbol[pos.symbol] ?? "china-ashare";
    const norm = normalizeQty(pos.qty, group);
    if (norm.error || !norm.qty) {
      skipped += 1;
      continue;
    }
    // Cap import size to 5% equity per name to avoid cash blow-ups on large sim books
    const budget = eq * 0.05;
    const maxQty = Math.floor(budget / fill.fillPrice / 100) * 100;
    const qty = Math.min(norm.qty, Math.max(100, maxQty || 100));
    const r = applyBuy(state, {
      symbol: pos.symbol,
      qty,
      fill,
      source: "sim",
      note: `sim import qty=${pos.qty} @avg ${pos.avgCost.toFixed(2)}`,
      playbookTag: "other",
      lastCloseBySymbol,
    });
    if (r.ok) {
      state = r.state;
      applied += 1;
    } else {
      skipped += 1;
    }
  }
  savePaperState(state);
  return { applied, skipped, state };
}

export function simPositionSymbols(positions: SimPosition[]): string[] {
  return positions.filter((p) => p.qty > 0).map((p) => p.symbol);
}
