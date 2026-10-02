import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSelectorResponse, type SelectorCliBody } from "./map";

const FIXTURE: SelectorCliBody = {
  success: true,
  query: "近5日放量上涨",
  code_count: 3546,
  datas: [
    {
      股票代码: "600066.SH",
      股票简称: "宇通客车",
      最新价: "26.72",
      最新涨跌幅: 1.442673,
    },
    {
      股票代码: "600081.SH",
      股票简称: "东风科技",
      最新价: "11.89",
      最新涨跌幅: 9.990749,
    },
  ],
};

describe("astock selector screen mapper", () => {
  it("maps CLI datas into a screen panel", () => {
    const panel = mapSelectorResponse(FIXTURE, {
      id: "volume-up",
      nameZh: "近5日放量上涨",
      nameEn: "5d volume-up",
      query: "近5日放量上涨",
    });
    assert.equal(panel.id, "volume-up");
    assert.equal(panel.codeCount, 3546);
    assert.equal(panel.tickers.length, 2);
    assert.equal(panel.tickers[0].code, "600066.SH");
    assert.equal(panel.tickers[0].nameZh, "宇通客车");
    assert.equal(panel.tickers[0].last, 26.72);
    assert.ok(Math.abs((panel.tickers[0].changePct ?? 0) - 1.442673) < 1e-6);
  });

  it("maps fund rows when stock fields are absent", () => {
    const panel = mapSelectorResponse(
      {
        success: true,
        code_count: 1,
        datas: [
          {
            基金代码: "513310.SH",
            基金简称: "中韩半导体ETF华泰柏瑞",
          },
        ],
      },
      {
        id: "semi",
        nameZh: "半导体",
        nameEn: "Semi",
        query: "半导体ETF成分强势",
      },
    );
    assert.equal(panel.tickers.length, 1);
    assert.equal(panel.tickers[0].code, "513310.SH");
    assert.match(panel.tickers[0].nameZh, /半导体/);
  });
});
