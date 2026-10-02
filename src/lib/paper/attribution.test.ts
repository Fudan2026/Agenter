import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attributionByPlaybook,
  attributionBySymbol,
  cockpitStats,
} from "./attribution";
import type { PaperJournalEntry, PaperState } from "./types";
import { PAPER_START_CASH } from "./types";

function entry(
  partial: Partial<PaperJournalEntry> &
    Pick<PaperJournalEntry, "symbol" | "side" | "qty" | "fillPrice">,
): PaperJournalEntry {
  return {
    id: partial.id ?? `j-${Math.random().toString(36).slice(2, 8)}`,
    ts: partial.ts ?? "2024-01-02T00:00:00.000Z",
    symbol: partial.symbol,
    side: partial.side,
    qty: partial.qty,
    fillPrice: partial.fillPrice,
    fee: partial.fee ?? 10,
    signalDate: partial.signalDate ?? "2024-01-01",
    fillDate: partial.fillDate ?? "2024-01-02",
    fillRule: partial.fillRule ?? "next_open",
    note: partial.note ?? "",
    source: partial.source,
    playbookTag: partial.playbookTag,
    sliceLabel: partial.sliceLabel,
    rejectReason: partial.rejectReason,
  };
}

function baseState(journal: PaperJournalEntry[]): PaperState {
  return {
    version: 2,
    cash: PAPER_START_CASH,
    startingCash: PAPER_START_CASH,
    feeBpsRoundTrip: 3,
    positions: [{ symbol: "600519.SS", qty: 1000, avgCost: 100 }],
    journal,
  };
}

describe("paper attribution", () => {
  it("attributionBySymbol aggregates buys/sells/fees", () => {
    const state = baseState([
      entry({
        symbol: "600519.SS",
        side: "buy",
        qty: 100,
        fillPrice: 10,
        fee: 5,
        playbookTag: "momentum",
      }),
      entry({
        symbol: "600519.SS",
        side: "sell",
        qty: 100,
        fillPrice: 12,
        fee: 6,
        playbookTag: "momentum",
      }),
      entry({
        symbol: "000001.SZ",
        side: "buy",
        qty: 200,
        fillPrice: 5,
        fee: 4,
        playbookTag: "lab",
      }),
    ]);
    const rows = attributionBySymbol(state);
    assert.equal(rows.length, 2);
    const a = rows.find((r) => r.key === "600519.SS")!;
    assert.ok(a);
    assert.equal(a.buys, 1000);
    assert.equal(a.sells, 1200);
    assert.equal(a.fees, 11);
    assert.ok(a.realizedProxy > 0);
  });

  it("attributionByPlaybook uses playbookTag", () => {
    const state = baseState([
      entry({
        symbol: "A",
        side: "buy",
        qty: 100,
        fillPrice: 10,
        playbookTag: "committee",
      }),
      entry({
        symbol: "B",
        side: "sell",
        qty: 100,
        fillPrice: 11,
        playbookTag: "committee",
      }),
      entry({
        symbol: "C",
        side: "buy",
        qty: 100,
        fillPrice: 10,
        source: "backtest",
      }),
    ]);
    const rows = attributionByPlaybook(state);
    const committee = rows.find((r) => r.key === "committee");
    const lab = rows.find((r) => r.key === "lab");
    assert.ok(committee);
    assert.ok(lab);
  });

  it("cockpitStats reports equity, open names, trades, max DD", () => {
    const state = baseState([
      entry({
        symbol: "600519.SS",
        side: "buy",
        qty: 100,
        fillPrice: 100,
        fee: 1,
      }),
      entry({
        symbol: "600519.SS",
        side: "sell",
        qty: 100,
        fillPrice: 110,
        fee: 1,
      }),
    ]);
    const series = [
      { time: "2024-01-01", value: 100_000_000 },
      { time: "2024-01-02", value: 99_000_000 },
      { time: "2024-01-03", value: 101_000_000 },
    ];
    const c = cockpitStats(state, 101_000_000, series);
    assert.equal(c.equity, 101_000_000);
    assert.equal(c.openNames, 1);
    assert.equal(c.trades, 2);
    assert.ok(c.maxDdPct > 0);
    assert.ok(c.dayPnlPct != null && c.dayPnlPct > 0);
    assert.equal(c.winRate, 1);
    assert.ok(c.profitFactor != null && c.profitFactor > 0);
  });

  it("skips rejected journal rows", () => {
    const state = baseState([
      entry({
        symbol: "X",
        side: "buy",
        qty: 100,
        fillPrice: 10,
        rejectReason: "insufficient_cash",
      }),
    ]);
    assert.equal(attributionBySymbol(state).length, 0);
    assert.equal(cockpitStats(state, PAPER_START_CASH, []).trades, 0);
  });
});
