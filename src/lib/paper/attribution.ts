/**
 * Paper Pro P&L attribution by symbol and journal source/tag.
 */

import type { PaperJournalEntry, PaperState } from "./types";

export type PlaybookTag =
  | "momentum"
  | "mean_rev"
  | "committee"
  | "lab"
  | "manual"
  | "other";

export interface AttrRow {
  key: string;
  buys: number;
  sells: number;
  fees: number;
  /** Rough realized proxy: sell proceeds − buy costs − fees for paired flow */
  realizedProxy: number;
}

function tagOf(j: PaperJournalEntry): PlaybookTag {
  const t = (j as PaperJournalEntry & { playbookTag?: string }).playbookTag;
  if (
    t === "momentum" ||
    t === "mean_rev" ||
    t === "committee" ||
    t === "lab" ||
    t === "manual"
  )
    return t;
  if (j.source === "backtest") return "lab";
  if (j.source === "checklist") return "committee";
  if (j.note?.toLowerCase().includes("committee")) return "committee";
  if (j.note?.toLowerCase().includes("lab")) return "lab";
  return "manual";
}

function accumulate(
  journal: PaperJournalEntry[],
  keyFn: (j: PaperJournalEntry) => string,
): AttrRow[] {
  const map = new Map<string, AttrRow>();
  for (const j of journal) {
    if (j.rejectReason) continue;
    const key = keyFn(j);
    const row = map.get(key) ?? {
      key,
      buys: 0,
      sells: 0,
      fees: 0,
      realizedProxy: 0,
    };
    const notional = j.qty * j.fillPrice;
    row.fees += j.fee;
    if (j.side === "buy") {
      row.buys += notional;
      row.realizedProxy -= notional + j.fee;
    } else {
      row.sells += notional;
      row.realizedProxy += notional - j.fee;
    }
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.realizedProxy - a.realizedProxy);
}

export function attributionBySymbol(state: PaperState): AttrRow[] {
  return accumulate(state.journal, (j) => j.symbol);
}

export function attributionBySource(state: PaperState): AttrRow[] {
  return accumulate(state.journal, (j) => j.source ?? "manual");
}

export function attributionByPlaybook(state: PaperState): AttrRow[] {
  return accumulate(state.journal, (j) => tagOf(j));
}

export interface CockpitStats {
  equity: number;
  cash: number;
  dayPnlPct: number | null;
  maxDdPct: number;
  winRate: number | null;
  profitFactor: number | null;
  openNames: number;
  trades: number;
}

export function cockpitStats(
  state: PaperState,
  equity: number,
  equitySeries: Array<{ time: string; value: number }>,
): CockpitStats {
  let maxDd = 0;
  let peak = equitySeries[0]?.value ?? equity;
  for (const p of equitySeries) {
    if (p.value > peak) peak = p.value;
    const dd = peak > 0 ? (peak - p.value) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  let dayPnlPct: number | null = null;
  if (equitySeries.length >= 2) {
    const a = equitySeries[equitySeries.length - 2].value;
    const b = equitySeries[equitySeries.length - 1].value;
    if (a > 0) dayPnlPct = ((b - a) / a) * 100;
  }

  // Pair buys/sells for win rate (simple sequential)
  const buys = state.journal.filter((j) => j.side === "buy" && !j.rejectReason);
  const sells = state.journal.filter(
    (j) => j.side === "sell" && !j.rejectReason,
  );
  const n = Math.min(buys.length, sells.length);
  let wins = 0;
  let gw = 0;
  let gl = 0;
  for (let i = 0; i < n; i++) {
    const pnl =
      (sells[i].fillPrice - buys[i].fillPrice) * sells[i].qty -
      sells[i].fee -
      buys[i].fee;
    if (pnl >= 0) {
      wins += 1;
      gw += pnl;
    } else gl += -pnl;
  }

  return {
    equity,
    cash: state.cash,
    dayPnlPct,
    maxDdPct: maxDd * 100,
    winRate: n ? wins / n : null,
    profitFactor: gl > 0 ? gw / gl : gw > 0 ? 99 : null,
    openNames: state.positions.length,
    trades: state.journal.filter((j) => !j.rejectReason).length,
  };
}
