export function visibleCandles<T extends { date: string }>(
  candles: T[],
  asOf: string,
): T[] {
  return candles.filter((c) => c.date <= asOf);
}

export function canPlaceReplayOrder(signalDate: string, asOf: string): boolean {
  return signalDate <= asOf;
}

export function replayFillIndex(
  candles: Array<{ date: string; open: number }>,
  asOf: string,
): number | null {
  const idx = candles.findIndex((c) => c.date > asOf);
  return idx >= 0 ? idx : null;
}
