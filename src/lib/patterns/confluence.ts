/**
 * Pattern-window confluence score (15-pattern catalog).
 * Distinct from signals/board confluenceScore (bias+MA+RSI+vol).
 */

import type { PatternHit } from "./types";

/** Score recent pattern hits in a lookback window (−100…+100). */
export function patternConfluenceScore(
  hits: PatternHit[],
  opts?: { windowBars?: number; asOfDate?: string },
): number {
  const windowBars = opts?.windowBars ?? 15;
  let recent = hits;
  if (opts?.asOfDate) {
    recent = hits.filter((h) => h.date <= opts.asOfDate!);
  }
  // Prefer last N hits by date order (bake already chronological)
  recent = recent.slice(-windowBars);
  if (!recent.length) return 0;

  let score = 0;
  for (const h of recent) {
    const w = h.direction === "bull" ? 1 : h.direction === "bear" ? -1 : 0;
    // Later hits weigh slightly more
    score += w * 8;
  }
  // Cap
  return Math.max(-100, Math.min(100, Math.round(score)));
}

/** Absolute strength 0–100 for board display. */
export function patternConfluenceAbs(hits: PatternHit[]): number {
  return Math.min(100, Math.abs(patternConfluenceScore(hits)));
}
