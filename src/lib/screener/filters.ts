import type { SymbolRow } from "../../pages/types";
import { confluenceScore } from "../signals/board";

export type ScreenerFilters = {
  bias?: "bull" | "bear" | "neutral" | "any";
  rsiZone?: string;
  maAlign?: string;
  volumeSpike?: boolean | null;
  confluenceMin?: number;
  group?: string | "any";
  dataStatus?: string | "any";
};

export function applyScreenerFilters(
  rows: SymbolRow[],
  f: ScreenerFilters,
): SymbolRow[] {
  return rows.filter((row) => {
    const sig = row.signals;
    if (f.bias && f.bias !== "any") {
      if ((sig?.bias ?? "neutral") !== f.bias) return false;
    }
    if (f.rsiZone && f.rsiZone !== "any") {
      if (sig?.rsiZone !== f.rsiZone) return false;
    }
    if (f.maAlign && f.maAlign !== "any") {
      if (sig?.maAlign !== f.maAlign) return false;
    }
    if (f.volumeSpike != null) {
      if ((sig?.volumeSpike ?? false) !== f.volumeSpike) return false;
    }
    if (f.confluenceMin != null && confluenceScore(row) < f.confluenceMin) {
      return false;
    }
    if (f.group && f.group !== "any" && row.group !== f.group) return false;
    if (f.dataStatus && f.dataStatus !== "any" && row.dataStatus !== f.dataStatus) {
      return false;
    }
    return true;
  });
}

export function sortScreener(
  rows: SymbolRow[],
  key: "confluence" | "pct1d" | "symbol" | "rsi",
  dir: "asc" | "desc",
): SymbolRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va: number | string;
    let vb: number | string;
    switch (key) {
      case "confluence":
        va = confluenceScore(a);
        vb = confluenceScore(b);
        break;
      case "pct1d":
        va = a.pct1d ?? -Infinity;
        vb = b.pct1d ?? -Infinity;
        break;
      case "symbol":
        va = a.symbol;
        vb = b.symbol;
        break;
      case "rsi":
        va = a.signals?.rsi14 ?? -Infinity;
        vb = b.signals?.rsi14 ?? -Infinity;
        break;
    }
    if (typeof va === "string" && typeof vb === "string") {
      return mul * va.localeCompare(vb);
    }
    return mul * ((va as number) - (vb as number));
  });
}
