import { defaultPaperState } from "./engine";
import { PAPER_KEY, type PaperState } from "./types";

export function loadPaperState(): PaperState {
  try {
    const raw = localStorage.getItem(PAPER_KEY);
    if (!raw) return defaultPaperState();
    const parsed = JSON.parse(raw) as PaperState;
    if (parsed?.version !== 1 || typeof parsed.cash !== "number") {
      return defaultPaperState();
    }
    return {
      ...defaultPaperState(),
      ...parsed,
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      journal: Array.isArray(parsed.journal) ? parsed.journal : [],
    };
  } catch {
    return defaultPaperState();
  }
}

export function savePaperState(state: PaperState): void {
  try {
    localStorage.setItem(PAPER_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function resetPaperState(): PaperState {
  const fresh = defaultPaperState();
  savePaperState(fresh);
  return fresh;
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
