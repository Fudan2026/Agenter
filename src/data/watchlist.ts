/**
 * Exact watchlist — original 16 retained; +10 liquid CN names (additive).
 */

export type AssetGroup = "macro" | "china-etf" | "china-ashare";

export interface TickerDef {
  symbol: string;
  nameZh: string;
  nameEn: string;
  group: AssetGroup;
}

export const WATCHLIST: TickerDef[] = [
  {
    symbol: "000001.SS",
    nameZh: "上证指数",
    nameEn: "SSE Composite",
    group: "macro",
  },
  {
    symbol: "399001.SZ",
    nameZh: "深证成指",
    nameEn: "SZSE Component",
    group: "macro",
  },
  {
    symbol: "000300.SS",
    nameZh: "沪深300",
    nameEn: "CSI 300 Index",
    group: "macro",
  },
  {
    symbol: "399006.SZ",
    nameZh: "创业板指",
    nameEn: "ChiNext Index",
    group: "macro",
  },
  {
    symbol: "000016.SS",
    nameZh: "上证50",
    nameEn: "SSE 50 Index",
    group: "macro",
  },
  {
    symbol: "510300.SS",
    nameZh: "沪深300ETF",
    nameEn: "CSI 300 ETF",
    group: "china-etf",
  },
  {
    symbol: "510500.SS",
    nameZh: "中证500ETF",
    nameEn: "CSI 500 ETF",
    group: "china-etf",
  },
  {
    symbol: "159915.SZ",
    nameZh: "创业板ETF",
    nameEn: "ChiNext ETF",
    group: "china-etf",
  },
  {
    symbol: "588000.SS",
    nameZh: "科创50ETF",
    nameEn: "STAR 50 ETF",
    group: "china-etf",
  },
  {
    symbol: "512880.SS",
    nameZh: "证券ETF",
    nameEn: "Securities ETF",
    group: "china-etf",
  },
  {
    symbol: "512480.SS",
    nameZh: "半导体ETF",
    nameEn: "Semiconductor ETF",
    group: "china-etf",
  },
  {
    symbol: "600519.SS",
    nameZh: "贵州茅台",
    nameEn: "Kweichow Moutai",
    group: "china-ashare",
  },
  {
    symbol: "600036.SS",
    nameZh: "招商银行",
    nameEn: "China Merchants Bank",
    group: "china-ashare",
  },
  {
    symbol: "000858.SZ",
    nameZh: "五粮液",
    nameEn: "Wuliangye",
    group: "china-ashare",
  },
  {
    symbol: "002594.SZ",
    nameZh: "比亚迪",
    nameEn: "BYD",
    group: "china-ashare",
  },
  {
    symbol: "601012.SS",
    nameZh: "隆基绿能",
    nameEn: "LONGi Green Energy",
    group: "china-ashare",
  },
  {
    symbol: "000001.SZ",
    nameZh: "平安银行",
    nameEn: "Ping An Bank",
    group: "china-ashare",
  },
  {
    symbol: "600276.SS",
    nameZh: "恒瑞医药",
    nameEn: "Hengrui Medicine",
    group: "china-ashare",
  },
  {
    symbol: "601888.SS",
    nameZh: "中国中免",
    nameEn: "China Tourism Group Duty Free",
    group: "china-ashare",
  },
  {
    symbol: "510050.SS",
    nameZh: "上证50ETF",
    nameEn: "SSE 50 ETF",
    group: "china-etf",
  },
  {
    symbol: "159919.SZ",
    nameZh: "沪深300ETF嘉实",
    nameEn: "CSI 300 ETF (Harvest)",
    group: "china-etf",
  },
  {
    symbol: "512690.SS",
    nameZh: "酒ETF",
    nameEn: "Liquor ETF",
    group: "china-etf",
  },
  {
    symbol: "515790.SS",
    nameZh: "光伏ETF",
    nameEn: "PV ETF",
    group: "china-etf",
  },
  {
    symbol: "601318.SS",
    nameZh: "中国平安",
    nameEn: "Ping An Insurance",
    group: "china-ashare",
  },
  {
    symbol: "600900.SS",
    nameZh: "长江电力",
    nameEn: "China Yangtze Power",
    group: "china-ashare",
  },
  {
    symbol: "000333.SZ",
    nameZh: "美的集团",
    nameEn: "Midea Group",
    group: "china-ashare",
  },
  {
    symbol: "002415.SZ",
    nameZh: "海康威视",
    nameEn: "Hikvision",
    group: "china-ashare",
  },
  {
    symbol: "300750.SZ",
    nameZh: "宁德时代",
    nameEn: "CATL",
    group: "china-ashare",
  },
  {
    symbol: "601166.SS",
    nameZh: "兴业银行",
    nameEn: "Industrial Bank",
    group: "china-ashare",
  },
];

export const LEGACY_WATCHLIST_COUNT = 16;

if (WATCHLIST.length < LEGACY_WATCHLIST_COUNT) {
  throw new Error(
    `WATCHLIST must keep >= ${LEGACY_WATCHLIST_COUNT} symbols, got ${WATCHLIST.length}`,
  );
}
