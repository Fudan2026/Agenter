/** Candle pattern IDs — original five retained; additive classics → 15 total. */

export type PatternId =
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "hammer"
  | "shooting_star"
  | "doji"
  | "morning_star"
  | "evening_star"
  | "three_white_soldiers"
  | "three_black_crows"
  | "piercing_line"
  | "inverted_hammer"
  | "spinning_top"
  | "bullish_harami"
  | "bearish_harami"
  | "dark_cloud_cover";

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
  morning_star: {
    en: "Morning star",
    zh: "启明星",
    direction: "bull",
    bars: 3,
  },
  evening_star: {
    en: "Evening star",
    zh: "黄昏星",
    direction: "bear",
    bars: 3,
  },
  three_white_soldiers: {
    en: "Three white soldiers",
    zh: "三白兵",
    direction: "bull",
    bars: 3,
  },
  three_black_crows: {
    en: "Three black crows",
    zh: "三只乌鸦",
    direction: "bear",
    bars: 3,
  },
  piercing_line: {
    en: "Piercing line",
    zh: "刺透形态",
    direction: "bull",
    bars: 2,
  },
  inverted_hammer: {
    en: "Inverted hammer",
    zh: "倒锤子",
    direction: "bull",
    bars: 1,
  },
  spinning_top: {
    en: "Spinning top",
    zh: "纺锤线",
    direction: "neutral",
    bars: 1,
  },
  bullish_harami: {
    en: "Bullish harami",
    zh: "看涨孕线",
    direction: "bull",
    bars: 2,
  },
  bearish_harami: {
    en: "Bearish harami",
    zh: "看跌孕线",
    direction: "bear",
    bars: 2,
  },
  dark_cloud_cover: {
    en: "Dark cloud cover",
    zh: "乌云盖顶",
    direction: "bear",
    bars: 2,
  },
};

export const ALL_PATTERN_IDS: PatternId[] = [
  "bullish_engulfing",
  "bearish_engulfing",
  "hammer",
  "shooting_star",
  "doji",
  "morning_star",
  "evening_star",
  "three_white_soldiers",
  "three_black_crows",
  "piercing_line",
  "inverted_hammer",
  "spinning_top",
  "bullish_harami",
  "bearish_harami",
  "dark_cloud_cover",
];

/** Original five — must remain forever for add-only invariant. */
export const LEGACY_PATTERN_IDS: PatternId[] = [
  "bullish_engulfing",
  "bearish_engulfing",
  "hammer",
  "shooting_star",
  "doji",
];
