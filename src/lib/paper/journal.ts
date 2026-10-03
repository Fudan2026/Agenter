import { defaultPaperState } from "./engine";
import {
  PAPER_KEY,
  PAPER_KEY_V1,
  PAPER_START_CASH,
  type PaperState,
} from "./types";

function normalizeState(parsed: Partial<PaperState> & { version?: number }): PaperState {
  const base = defaultPaperState();
  return {
    ...base,
    cash: typeof parsed.cash === "number" ? parsed.cash : base.cash,
    startingCash:
      typeof parsed.startingCash === "number"
        ? parsed.startingCash
        : base.startingCash,
    feeBpsRoundTrip:
      typeof parsed.feeBpsRoundTrip === "number"
        ? parsed.feeBpsRoundTrip
        : base.feeBpsRoundTrip,
    positions: Array.isArray(parsed.positions) ? parsed.positions : [],
    journal: Array.isArray(parsed.journal) ? parsed.journal : [],
    hardRiskGates: Boolean(parsed.hardRiskGates),
    costModelEnabled: parsed.costModelEnabled !== false,
    costConfig: parsed.costConfig ?? base.costConfig,
    boughtLots:
      parsed.boughtLots && typeof parsed.boughtLots === "object"
        ? parsed.boughtLots
        : {},
    riskLimits: parsed.riskLimits
      ? { ...base.riskLimits!, ...parsed.riskLimits }
      : base.riskLimits,
    priorEquityMark:
      typeof parsed.priorEquityMark === "number"
        ? parsed.priorEquityMark
        : base.priorEquityMark,
    version: 2,
  };
}

export function loadPaperState(): PaperState {
  try {
    const rawV2 = localStorage.getItem(PAPER_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<PaperState>;
      if (typeof parsed.cash === "number") return normalizeState(parsed);
    }
    const rawV1 = localStorage.getItem(PAPER_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as Partial<PaperState> & {
        version?: number;
      };
      if (typeof parsed.cash === "number") {
        const migrated = normalizeState(parsed);
        savePaperState(migrated);
        return migrated;
      }
    }
    return defaultPaperState();
  } catch {
    return defaultPaperState();
  }
}

export function savePaperState(state: PaperState): void {
  try {
    localStorage.setItem(PAPER_KEY, JSON.stringify({ ...state, version: 2 }));
  } catch {
    /* ignore */
  }
}

export function resetPaperState(): PaperState {
  const fresh = defaultPaperState();
  savePaperState(fresh);
  return fresh;
}

/** Top up starting cash to ¥100M without wiping journal/positions. */
export function topUpToHundredMillion(state: PaperState): PaperState {
  if (state.startingCash >= PAPER_START_CASH) return state;
  const delta = PAPER_START_CASH - state.startingCash;
  const next: PaperState = {
    ...state,
    version: 2,
    cash: state.cash + delta,
    startingCash: PAPER_START_CASH,
  };
  savePaperState(next);
  return next;
}

export function needsTopUp(state: PaperState): boolean {
  return state.startingCash < PAPER_START_CASH;
}

export function importPaperState(raw: unknown): PaperState | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const parsed = raw as Partial<PaperState>;
    if (typeof parsed.cash !== "number") return null;
    const next = normalizeState(parsed);
    savePaperState(next);
    return next;
  } catch {
    return null;
  }
}

export function downloadJournalJson(state: PaperState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agenter-paper-journal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Append backtest fills into paper journal without wiping positions rebuild — replay via applyBuy/Sell preferred from UI. */
export function appendJournalEntries(
  state: PaperState,
  entries: PaperState["journal"],
): PaperState {
  const next: PaperState = {
    ...state,
    version: 2,
    journal: [...entries, ...state.journal],
  };
  savePaperState(next);
  return next;
}
