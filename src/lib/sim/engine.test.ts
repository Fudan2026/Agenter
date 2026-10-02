/**
 * Sim Desk unit tests — open account, buy, T+1, lot reject (no network).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyLedger,
  marketCodeFromSymbol,
  openSimAccount,
  placeOrder,
  trailing30dReturnPct,
  validateLotQty,
} from "./ledger";
import { SIM_LOT, SIM_START_CASH } from "./types";

describe("sim market + lots", () => {
  it("maps SZ/SH suffixes to market codes", () => {
    assert.equal(marketCodeFromSymbol("000858.SZ"), "1");
    assert.equal(marketCodeFromSymbol("600519.SS"), "2");
    assert.equal(marketCodeFromSymbol("510300.SS"), "2");
  });

  it("rejects non-100 lots", () => {
    assert.equal(validateLotQty(50).error, "lot_100");
    assert.equal(validateLotQty(150).error, "lot_100");
    assert.equal(validateLotQty(0).error, "invalid_qty");
    assert.equal(validateLotQty(200).qty, 200);
    assert.equal(SIM_LOT, 100);
  });
});

describe("sim account + orders", () => {
  it("opens skill_<ms> account at ¥100M", () => {
    const ledger = openSimAccount(new Date("2026-03-15T08:00:00.000Z"));
    assert.ok(ledger.account);
    assert.match(ledger.account!.username, /^skill_\d{13}$/);
    assert.equal(ledger.cash, SIM_START_CASH);
    assert.equal(ledger.startingCash, SIM_START_CASH);
    assert.equal(ledger.version, 1);
  });

  it("rejects orders without account", () => {
    const r = placeOrder(emptyLedger(), {
      symbol: "600519.SS",
      side: "buy",
      qty: 100,
      price: 100,
      fillDate: "2026-03-02",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "no_account");
  });

  it("buys and updates cash/position", () => {
    let ledger = openSimAccount();
    const bought = placeOrder(ledger, {
      symbol: "600519.SS",
      nameZh: "贵州茅台",
      side: "buy",
      qty: 100,
      price: 100,
      fillDate: "2026-03-02",
    });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    ledger = bought.ledger;
    assert.equal(ledger.positions[0]?.qty, 100);
    assert.ok(ledger.cash < SIM_START_CASH);
    assert.equal(ledger.trades[0]?.side, "buy");
  });

  it("T+1 blocks same-day sell", () => {
    let ledger = openSimAccount();
    const bought = placeOrder(ledger, {
      symbol: "600519.SS",
      side: "buy",
      qty: 100,
      price: 100,
      fillDate: "2026-03-02",
    });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    const sold = placeOrder(bought.ledger, {
      symbol: "600519.SS",
      side: "sell",
      qty: 100,
      price: 110,
      fillDate: "2026-03-02",
    });
    assert.equal(sold.ok, false);
    if (!sold.ok) assert.equal(sold.error, "t1_lock");
  });

  it("allows sell on a later fillDate", () => {
    let ledger = openSimAccount();
    const bought = placeOrder(ledger, {
      symbol: "000858.SZ",
      side: "buy",
      qty: 200,
      price: 50,
      fillDate: "2026-03-02",
    });
    assert.equal(bought.ok, true);
    if (!bought.ok) return;
    const sold = placeOrder(bought.ledger, {
      symbol: "000858.SZ",
      side: "sell",
      qty: 200,
      price: 55,
      fillDate: "2026-03-03",
    });
    assert.equal(sold.ok, true);
    if (!sold.ok) return;
    assert.equal(sold.ledger.positions.length, 0);
    assert.ok(sold.ledger.trades.length >= 2);
  });

  it("computes trailing return helper without throwing", () => {
    const ledger = openSimAccount();
    const pct = trailing30dReturnPct(ledger, {});
    assert.equal(pct, 0);
  });
});
