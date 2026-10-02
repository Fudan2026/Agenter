/** localStorage persistence for Sim Desk ledger. */

import { emptyLedger, openSimAccount } from "./ledger";
import { SIM_LEDGER_KEY, type SimLedger } from "./types";

function normalize(parsed: Partial<SimLedger>): SimLedger {
  const base = emptyLedger();
  return {
    version: 1,
    account: parsed.account ?? null,
    cash: typeof parsed.cash === "number" ? parsed.cash : base.cash,
    startingCash:
      typeof parsed.startingCash === "number"
        ? parsed.startingCash
        : base.startingCash,
    positions: Array.isArray(parsed.positions) ? parsed.positions : [],
    boughtLots:
      parsed.boughtLots && typeof parsed.boughtLots === "object"
        ? parsed.boughtLots
        : {},
    trades: Array.isArray(parsed.trades) ? parsed.trades : [],
  };
}

export function loadSimLedger(): SimLedger {
  try {
    const raw = localStorage.getItem(SIM_LEDGER_KEY);
    if (!raw) return emptyLedger();
    const parsed = JSON.parse(raw) as Partial<SimLedger>;
    return normalize(parsed);
  } catch {
    return emptyLedger();
  }
}

export function saveSimLedger(ledger: SimLedger): void {
  try {
    localStorage.setItem(SIM_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    /* ignore */
  }
}

export function resetSimLedger(): SimLedger {
  const fresh = emptyLedger();
  saveSimLedger(fresh);
  return fresh;
}

export function ensureOpenAccount(ledger: SimLedger): SimLedger {
  if (ledger.account) return ledger;
  const next = openSimAccount();
  saveSimLedger(next);
  return next;
}
