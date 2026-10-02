/** Five fixed pattern IDs (plan §5). */

export type PatternId =
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "hammer"
  | "shooting_star"
  | "doji";

export type PatternDirection = "bull" | "bear" | "neutral";

export interface PatternHit {
  patternId: PatternId;
  date: string;
  direction: PatternDirection;
}

export const PATTERN_META: Record<
  PatternId,
  { en: string; zh: string; direction: PatternDirection; bars: number }
> = {
  bullish_engulfing: {
    en: "Bullish engulfing",
    zh: "看涨吞没",
    direction: "bull",
    bars: 2,
  },
  bearish_engulfing: {
    en: "Bearish engulfing",
    zh: "看跌吞没",
    direction: "bear",
    bars: 2,
  },
  hammer: { en: "Hammer", zh: "锤子线", direction: "bull", bars: 1 },
  shooting_star: {
    en: "Shooting star",
    zh: "射击之星",
    direction: "bear",
    bars: 1,
  },
  doji: { en: "Doji", zh: "十字星", direction: "neutral", bars: 1 },
};

export const ALL_PATTERN_IDS: PatternId[] = [
  "bullish_engulfing",
  "bearish_engulfing",
  "hammer",
  "shooting_star",
  "doji",
];
