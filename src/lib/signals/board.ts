import type { LatestPayload, SymbolRow } from "../../pages/types";

/** Confluence score 0–100 from baked signals + recent patterns. */
export function confluenceScore(row: SymbolRow): number {
  let score = 0;
  const sig = row.signals;
  if (!sig) return 0;
  if (sig.bias === "bull") score += 30;
  else if (sig.bias === "bear") score += 10;
  else score += 15;
  if (sig.maAlign === "bull") score += 25;
  else if (sig.maAlign === "bear") score += 5;
  else if (sig.maAlign === "mixed") score += 12;
  if (sig.rsiZone === "oversold") score += 20;
  else if (sig.rsiZone === "normal") score += 10;
  if (sig.volumeSpike) score += 10;
  const bulls = row.recentPatterns.filter((p) => p.direction === "bull").length;
  const bears = row.recentPatterns.filter((p) => p.direction === "bear").length;
  score += Math.min(15, bulls * 3);
  score -= Math.min(10, bears * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function lastCandleDate(row: SymbolRow): string | null {
  if (!row.candles.length) return null;
  return row.candles[row.candles.length - 1].date;
}

export function isStaleVsReport(data: LatestPayload): boolean {
  const dates = data.symbols
    .map(lastCandleDate)
    .filter((d): d is string => !!d);
  if (!dates.length) return false;
  const maxD = dates.sort().at(-1)!;
  return maxD < data.reportDate;
}

export function patternHeatmap(
  symbols: SymbolRow[],
): { patternId: string; counts: Record<string, number> }[] {
  const patternIds = new Set<string>();
  for (const s of symbols) {
    for (const p of s.recentPatterns) patternIds.add(p.patternId);
  }
  return [...patternIds].sort().map((patternId) => {
    const counts: Record<string, number> = {};
    for (const s of symbols) {
      counts[s.symbol] = s.recentPatterns.filter(
        (p) => p.patternId === patternId,
      ).length;
    }
    return { patternId, counts };
  });
}
