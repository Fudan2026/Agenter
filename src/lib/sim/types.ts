/** Local Sim Desk ledger — distilled from SkillHub 模拟炒股 rules. */

export const SIM_LEDGER_KEY = "agenter.sim.ledger.v1";
export const SIM_START_CASH = 100_000_000;
export const SIM_LOT = 100;
export const SIM_FEE_BPS_SIDE = 1.5; // half of ~3 bps RT
export const SIM_YYBID = "997376";

export type SimSide = "buy" | "sell";
export type SimMarketCode = "1" | "2"; // 1=SZ, 2=SH

export interface SimAccount {
  username: string;
  capitalAccount: string;
  departmentId: string;
  shareholderSz: string;
  shareholderSh: string;
  openedAt: string;
}

export interface SimPosition {
  symbol: string;
  nameZh: string;
  nameEn: string;
  qty: number;
  avgCost: number;
  marketCode: SimMarketCode;
}

export interface SimLot {
  qty: number;
  fillDate: string;
}

export interface SimTrade {
  id: string;
  ts: string;
  fillDate: string;
  symbol: string;
  nameZh: string;
  side: SimSide;
  qty: number;
  price: number;
  fee: number;
  marketCode: SimMarketCode;
  note?: string;
}

export interface SimLedger {
  version: 1;
  account: SimAccount | null;
  cash: number;
  startingCash: number;
  positions: SimPosition[];
  boughtLots: Record<string, SimLot[]>;
  trades: SimTrade[];
}

export type SimError =
  | "no_account"
  | "invalid_qty"
  | "lot_100"
  | "invalid_price"
  | "insufficient_cash"
  | "no_position"
  | "insufficient_qty"
  | "t1_lock"
  | "unknown_symbol";
