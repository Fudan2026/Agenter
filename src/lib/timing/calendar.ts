import type { SymbolRow } from "../../pages/types";
import { confluenceScore } from "../signals/board";
import { defaultSignalDate } from "../paper/equity";

/**
 * Minimal mainland China exchange holiday stub (2024–2026).
 * Weekends are non-trading; listed dates are closed — not a complete calendar.
 */
const CN_HOLIDAYS = new Set([
  "2024-01-01",
  "2024-02-09",
  "2024-02-10",
  "2024-02-11",
  "2024-02-12",
  "2024-02-16",
  "2024-02-17",
  "2024-04-04",
  "2024-04-05",
  "2024-05-01",
  "2024-05-02",
  "2024-05-03",
  "2024-10-01",
  "2024-10-02",
  "2024-10-03",
  "2024-10-04",
  "2025-01-01",
  "2025-01-28",
  "2025-01-29",
  "2025-01-30",
  "2025-01-31",
  "2025-02-03",
  "2025-02-04",
  "2025-05-01",
  "2025-05-02",
  "2025-10-01",
  "2025-10-02",
  "2025-10-03",
  "2026-01-01",
  "2026-01-02",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-05-01",
  "2026-10-01",
  "2026-10-02",
]);

function parseIso(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isCnTradingDay(isoDate: string): boolean {
  const d = parseIso(isoDate);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !CN_HOLIDAYS.has(isoDate);
}

export function nextSession(isoDate: string): string {
  let d = parseIso(isoDate);
  for (let i = 0; i < 366; i++) {
    const iso = formatIso(d);
    if (isCnTradingDay(iso)) return iso;
    d = new Date(d.getTime() + 86400000);
  }
  return isoDate;
}

export type AgendaItem = {
  symbol: string;
  sideHint: "buy" | "sell" | "hold";
  signalDate: string;
  fillRule: "next_open";
  confluence: number;
  reason: string;
};

function signalDateForRow(row: SymbolRow): string {
  const lastPat = row.recentPatterns.at(-1)?.date;
  if (lastPat && row.candles.some((c) => c.date === lastPat)) return lastPat;
  return defaultSignalDate(row.candles) ?? row.candles.at(-1)?.date ?? "";
}

export function sessionAgenda(
  reportDate: string,
  symbols: SymbolRow[],
): AgendaItem[] {
  const session = nextSession(reportDate);
  const items: AgendaItem[] = [];
  for (const row of symbols) {
    const conf = confluenceScore(row);
    const bias = row.signals?.bias ?? "neutral";
    let sideHint: AgendaItem["sideHint"] = "hold";
    let reason = "neutral bias";
    if (bias === "bull" && conf >= 55) {
      sideHint = "buy";
      reason = `bull bias, confluence ${conf}`;
    } else if (bias === "bear" && conf >= 55) {
      sideHint = "sell";
      reason = `bear bias, confluence ${conf}`;
    } else if (conf >= 70) {
      sideHint = bias === "bear" ? "sell" : "buy";
      reason = `high confluence ${conf}`;
    }
    const signalDate = signalDateForRow(row) || session;
    items.push({
      symbol: row.symbol,
      sideHint,
      signalDate,
      fillRule: "next_open",
      confluence: conf,
      reason,
    });
  }
  return items.sort((a, b) => b.confluence - a.confluence);
}
