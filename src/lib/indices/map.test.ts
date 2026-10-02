import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapZhishuResponse, type ZhishuCliBody } from "./map";

const FIXTURE: ZhishuCliBody = {
  success: true,
  query: "上证指数最新点位",
  datas: [
    {
      指数代码: "000001.SH",
      指数简称: "上证指数",
      "最新涨跌幅:前复权": 0.3065,
      最新价: "3842.19",
      "收盘价[20260930]": 3842.1946,
    },
  ],
};

describe("zhishu index mapper", () => {
  it("maps CLI datas into SPA index items", () => {
    const items = mapZhishuResponse(FIXTURE, {
      query: "上证指数最新点位",
      nameEn: "SSE Composite",
    });
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.code, "000001.SH");
    assert.equal(item.nameZh, "上证指数");
    assert.equal(item.nameEn, "SSE Composite");
    assert.equal(item.last, 3842.19);
    assert.equal(item.changePct, 0.3065);
    assert.equal(item.query, "上证指数最新点位");
  });

  it("returns empty when success is false", () => {
    const items = mapZhishuResponse(
      { success: false, datas: FIXTURE.datas },
      { query: "x", nameEn: "X" },
    );
    assert.equal(items.length, 0);
  });
});
