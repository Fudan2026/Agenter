/**
 * Exact 16-symbol A-share / CN ETF watchlist (plan §2).
 * Names distilled from OpenCool lib/trading/watchlist.ts.
 */

export type AssetGroup = "macro" | "china-etf" | "china-ashare";

export interface TickerDef {
  symbol: string;
  nameZh: string;
  nameEn: string;
  group: AssetGroup;
}

export const WATCHLIST: TickerDef[] = [
  // Macro (2)
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
  // ETF (6)
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
  // A-share (8) — includes 600519 from OpenCool china-ashare
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
];

if (WATCHLIST.length !== 16) {
  throw new Error(`WATCHLIST must have exactly 16 symbols, got ${WATCHLIST.length}`);
}
