/**
 * Human broker checklist export (A) — list not live order.
 * Uses next-open wording (no-lookahead / plan default #7).
 */

import type { PaperJournalEntry, PaperState } from "./types";

export interface ChecklistRow {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  orderType: "market_next_open";
  limitOrMarket: "market";
  intendedSession: string;
  notes: string;
}

export function buildChecklist(
  state: PaperState,
  locale: "zh" | "en",
): ChecklistRow[] {
  // Prefer open positions as “tomorrow open” working list;
  // also include most recent unmatched intent notes from journal.
  const rows: ChecklistRow[] = [];

  for (const p of state.positions) {
    rows.push({
      symbol: p.symbol,
      side: "sell",
      qty: p.qty,
      orderType: "market_next_open",
      limitOrMarket: "market",
      intendedSession: "next_open",
      notes:
        locale === "zh"
          ? `纸盘持仓参考均价 ${p.avgCost.toFixed(2)}；请人工在券商/同花顺按【次日开盘】执行，本站不下单。`
          : `Paper avg ${p.avgCost.toFixed(2)}; execute manually at broker/THS at NEXT OPEN — site never submits.`,
    });
  }

  // Latest buy journal entries as optional buy checklist (signal → next open)
  const recentBuys = state.journal
    .filter((j) => j.side === "buy")
    .slice(0, 8);
  for (const j of recentBuys) {
    if (rows.some((r) => r.symbol === j.symbol && r.side === "buy")) continue;
    rows.push(journalToChecklist(j, locale));
  }

  return rows;
}

function journalToChecklist(
  j: PaperJournalEntry,
  locale: "zh" | "en",
): ChecklistRow {
  return {
    symbol: j.symbol,
    side: j.side,
    qty: j.qty,
    orderType: "market_next_open",
    limitOrMarket: "market",
    intendedSession: "next_open",
    notes:
      locale === "zh"
        ? `信号日 ${j.signalDate} → 成交假设 ${j.fillDate}（${j.fillRule === "next_open" ? "次日开盘" : "次日收盘回退"}）。人工按【次日开盘】委托；本站不下单。${j.note}`
        : `Signal ${j.signalDate} → assumed fill ${j.fillDate} (${j.fillRule}). Place at NEXT OPEN manually; site never submits. ${j.note}`,
  };
}

export function checklistToCsv(rows: ChecklistRow[]): string {
  const header = [
    "symbol",
    "side",
    "qty",
    "orderType",
    "limitOrMarket",
    "intendedSession",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.symbol,
        r.side,
        String(r.qty),
        r.orderType,
        r.limitOrMarket,
        r.intendedSession,
        csvEscape(r.notes),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadChecklist(
  state: PaperState,
  locale: "zh" | "en",
  format: "csv" | "json",
): void {
  const rows = buildChecklist(state, locale);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `agenter-broker-checklist-${stamp}.json`);
  } else {
    const blob = new Blob([checklistToCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });
    triggerDownload(blob, `agenter-broker-checklist-${stamp}.csv`);
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
