import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapGatewayResponse,
  mapGatewayRow,
  type GatewaySearchBody,
} from "./map";

const FIXTURE: GatewaySearchBody = {
  status_msg: "OK",
  status_code: 0,
  data: [
    {
      id: "52c5df0fcce6ad54_0",
      uid: "52c5df0fcce6ad54",
      title:
        "贵州茅台：贵州茅台关于2025年中期利润分配方案暨贯彻落实“提质增效重回报”专项行动方案的公告",
      summary:
        "证券简称：贵州茅台\n证券代码：600519\n每股派发现金红利23.957元（含税）。",
      url: "https://static.sse.com.cn/disclosure/listedinfo/announcement/c/new/2025-11-06/600519_20251106_XHPX.pdf",
      publish_time: 1762358400,
      publish_date: "2025-11-06 00:00:00",
    },
    {
      id: "empty-title",
      title: "   ",
      summary: "skip me",
      publish_date: "2025-01-01 00:00:00",
    },
  ],
};

describe("announcement gateway mapper", () => {
  it("maps known fields into SPA items", () => {
    const items = mapGatewayResponse(FIXTURE, {
      symbol: "600519.SS",
      nameZh: "贵州茅台",
    });
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.symbol, "600519.SS");
    assert.equal(item.nameZh, "贵州茅台");
    assert.equal(item.date, "2025-11-06");
    assert.match(item.titleZh, /利润分配/);
    assert.equal(item.titleEn, item.titleZh);
    assert.ok(item.summaryZh.includes("23.957"));
    assert.ok(item.summaryEn.startsWith("(ZH)"));
    assert.ok(item.url?.includes("600519"));
    assert.ok(item.id.includes("600519.SS"));
  });

  it("returns empty on non-zero status_code", () => {
    const items = mapGatewayResponse(
      { status_code: 1, data: FIXTURE.data },
      { symbol: "600519.SS", nameZh: "贵州茅台" },
    );
    assert.equal(items.length, 0);
  });

  it("falls back publish_time seconds to date", () => {
    const item = mapGatewayRow(
      {
        id: "t1",
        title: "测试公告标题",
        publish_time: 1762358400,
      },
      { symbol: "000858.SZ", nameZh: "五粮液", index: 0 },
    );
    assert.ok(item);
    assert.equal(item!.date, "2025-11-05"); // UTC from unix seconds
  });
});
