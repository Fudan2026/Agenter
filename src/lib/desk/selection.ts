/** Linked symbol selection bus across Quant OS panes (TWS link spirit). */

export type DeskSelection = { symbol: string; asOf?: string };

export const DESK_SELECTION_KEY = "agenter.desk.selection.v1";

const listeners = new Set<(s: DeskSelection) => void>();

export function loadSelection(): DeskSelection {
  try {
    const raw = localStorage.getItem(DESK_SELECTION_KEY);
    if (raw) {
      const p = JSON.parse(raw) as DeskSelection;
      if (typeof p.symbol === "string" && p.symbol) return p;
    }
  } catch {
    /* ignore */
  }
  return { symbol: "600519.SS" };
}

export function saveSelection(s: DeskSelection): void {
  try {
    localStorage.setItem(DESK_SELECTION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  for (const cb of listeners) cb(s);
}

export function onSelection(cb: (s: DeskSelection) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
