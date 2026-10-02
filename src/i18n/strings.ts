/** zh / en UI strings. Locked titles from plan §1. */

export type Locale = "zh" | "en";

export const LOCALE_KEY = "agenter.locale";

export const STRINGS = {
  zh: {
    title: "Agent 能力演示：量化复盘",
    brand: "Agenter",
    subtitle: "for better agents",
    localeZh: "中文",
    localeEn: "EN",
    dailyReview: "每日复盘日报",
    statsOk: "有效",
    statsStale: "缓存",
    statsMissing: "缺失",
    statsPatterns: "形态命中",
    backHome: "← 返回首页",
    fullscreen: "全屏查看",
    exitFullscreen: "退出全屏",
    recentPatterns: "有效形态（近60日）",
    noPatterns: "近 60 日无命中形态",
    loading: "加载中…",
    loadError: "无法加载数据。请先运行 npm run quant:bake。",
    missingSymbol: "未找到该标的",
    dataLive: "实时",
    dataStale: "缓存",
    dataMissing: "暂缺",
    disclaimer:
      "本页为教育演示，不构成投资建议，不提供实盘交易。形态识别仅基于历史 K 线规则，不含未来函数确认。",
    groupMacro: "宏观指数",
    groupEtf: "基金 / ETF",
    groupAshare: "A 股",
  },
  en: {
    title: "Agent capability demo: quant review",
    brand: "Agenter",
    subtitle: "for better agents",
    localeZh: "中文",
    localeEn: "EN",
    dailyReview: "Daily review",
    statsOk: "OK",
    statsStale: "Stale",
    statsMissing: "Missing",
    statsPatterns: "Pattern hits",
    backHome: "← Home",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    recentPatterns: "Patterns (last 60 sessions)",
    noPatterns: "No pattern hits in the last 60 sessions",
    loading: "Loading…",
    loadError: "Failed to load data. Run npm run quant:bake first.",
    missingSymbol: "Symbol not found",
    dataLive: "Live",
    dataStale: "Stale",
    dataMissing: "Missing",
    disclaimer:
      "Educational demo only — not investment advice; no live trading. Patterns use historical OHLC rules with no future-bar confirmation.",
    groupMacro: "Macro",
    groupEtf: "CN ETF",
    groupAshare: "A-shares",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["zh"];

export function t(locale: Locale, key: StringKey): string {
  return STRINGS[locale][key];
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  return nav.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function setLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}
