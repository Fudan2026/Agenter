/**
 * Paper engine unit tests — no-lookahead fill rule + ¥100M start.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBuy,
  applySell,
  defaultPaperState,
  feeForSide,
  normalizeQty,
  paperRiskSnapshot,
  resolveNextOpenFill,
} from "./engine";
import { PAPER_START_CASH } from "./types";

describe("paper no-lookahead fills", () => {
  const candles = [
    { date: "2026-03-01", open: 10, high: 11, low: 9.5, close: 10.5, volume: 1 },
    { date: "2026-03-02", open: 10.6, high: 11.2, low: 10.4, close: 11, volume: 1 },
    { date: "2026-03-03", open: 11.1, high: 11.5, low: 10.9, close: 11.2, volume: 1 },
  ];

  it("fills at t+1 open when next bar exists", () => {
    const fill = resolveNextOpenFill(candles, "2026-03-01");
    assert.ok(fill);
    assert.equal(fill!.fillRule, "next_open");
    assert.equal(fill!.fillDate, "2026-03-02");
    assert.equal(fill!.fillPrice, 10.6);
    assert.equal(fill!.signalDate, "2026-03-01");
  });

  it("does not use same-bar close as next_open fill", () => {
    const fill = resolveNextOpenFill(candles, "2026-03-02");
    assert.ok(fill);
    assert.equal(fill!.fillPrice, 11.1);
    assert.notEqual(fill!.fillPrice, 11);
  });

  it("labels next_close_fallback when no next bar", () => {
    const fill = resolveNextOpenFill(candles, "2026-03-03");
    assert.ok(fill);
    assert.equal(fill!.fillRule, "next_close_fallback");
    assert.equal(fill!.fillPrice, 11.2);
  });
});

describe("paper capital and lots", () => {
  it("starts at 100_000_000 CNY", () => {
    const s = defaultPaperState();
    assert.equal(PAPER_START_CASH, 100_000_000);
    assert.equal(s.cash, 100_000_000);
    assert.equal(s.startingCash, 100_000_000);
    assert.equal(s.version, 2);
  });

  it("enforces 100-share lots for A-shares", () => {
    assert.equal(normalizeQty(150, "china-ashare").qty, 100);
    assert.equal(normalizeQty(50, "china-ashare").error, "lot_100");
    assert.equal(normalizeQty(7, "macro").qty, 7);
  });

  it("charges half of 3 bps RT per side", () => {
    const fee = feeForSide(100_000, 3);
    assert.ok(Math.abs(fee - 15) < 1e-9);
  });

  it("buy then sell updates cash and journal", () => {
    let state = defaultPaperState();
    const fill = {
      fillPrice: 100,
      fillDate: "2026-03-02",
      fillRule: "next_open" as const,
      signalDate: "2026-03-01",
    };
    const bought = applyBuy(state, { symbol: "600519.SS", qty: 100, fill });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    state = bought.state;
    assert.equal(state.positions[0]?.qty, 100);
    const sold = applySell(state, {
      symbol: "600519.SS",
      qty: 100,
      fill: { ...fill, fillPrice: 110 },
    });
    assert.equal(sold.ok, true);
    if (!sold.ok) return;
    assert.equal(sold.state.positions.length, 0);
    assert.ok(sold.state.journal.length >= 2);
  });

  it("risk snapshot flags overweight name", () => {
    let state = defaultPaperState();
    const fill = {
      fillPrice: 100,
      fillDate: "2026-03-02",
      fillRule: "next_open" as const,
      signalDate: "2026-03-01",
    };
    // Buy 250_000 shares @ 100 = 25M notional → 25% of 100M
    const bought = applyBuy(state, {
      symbol: "600519.SS",
      qty: 250_000,
      fill,
    });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    state = bought.state;
    const risk = paperRiskSnapshot(state, { "600519.SS": 100 }, 0.2);
    assert.equal(risk.overweight, true);
    assert.ok(risk.maxNamePct > 0.2);
  });
});

describe("paper top-up migration math", () => {
  it("tops up delta from old 1M starting cash", () => {
    const oldStart = 1_000_000;
    const cash = 900_000;
    const delta = PAPER_START_CASH - oldStart;
    assert.equal(delta, 99_000_000);
    assert.equal(cash + delta, 99_900_000);
  });
});
