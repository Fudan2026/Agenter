/**
 * Educational A-share session calendar (static holidays).
 * Approximate — not an exchange official feed. No live API.
 */

export interface CnCalendarPayload {
  generatedAt: string;
  source: string;
  attribution: { zh: string; en: string };
  /** YYYY-MM-DD non-session days (weekends omitted — OHLC bake already skips them). */
  nonSessions: string[];
}

export function isNonSession(
  date: string,
  calendar: CnCalendarPayload | null | undefined,
): boolean {
  if (!calendar?.nonSessions?.length) return false;
  return calendar.nonSessions.includes(date.slice(0, 10));
}

/** Walk forward from signalIdx+1 skipping holiday/non-session bars. */
export function nextSessionIndex(
  dates: string[],
  fromIdx: number,
  calendar: CnCalendarPayload | null | undefined,
): number {
  for (let i = fromIdx + 1; i < dates.length; i++) {
    if (!isNonSession(dates[i], calendar)) return i;
  }
  return -1;
}
