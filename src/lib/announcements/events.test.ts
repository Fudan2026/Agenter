import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyAnnouncementEvent,
  countByBucket,
  postEventReturnPct,
} from "./events";

describe("announcement event buckets", () => {
  it("classifies earnings / buyback / holder change", () => {
    assert.equal(classifyAnnouncementEvent("2025年年度报告"), "earnings");
    assert.equal(classifyAnnouncementEvent("关于回购股份的进展公告"), "buyback");
    assert.equal(classifyAnnouncementEvent("股东减持股份计划公告"), "holder_change");
    assert.equal(classifyAnnouncementEvent("日常经营公告"), "other");
  });

  it("counts buckets", () => {
    const counts = countByBucket([
      {
        id: "1",
        symbol: "A",
        nameZh: "A",
        date: "2026-01-01",
        titleZh: "半年度报告",
        titleEn: "x",
        summaryZh: "",
        summaryEn: "",
      },
      {
        id: "2",
        symbol: "B",
        nameZh: "B",
        date: "2026-01-02",
        titleZh: "回购注销",
        titleEn: "x",
        summaryZh: "",
        summaryEn: "",
      },
    ]);
    assert.equal(counts.earnings, 1);
    assert.equal(counts.buyback, 1);
  });

  it("computes post-event return when OHLC covers horizon", () => {
    const candles = [
      { date: "2026-01-01", close: 10 },
      { date: "2026-01-02", close: 10 },
      { date: "2026-01-03", close: 11 },
      { date: "2026-01-04", close: 12 },
      { date: "2026-01-05", close: 12 },
      { date: "2026-01-06", close: 13 },
      { date: "2026-01-07", close: 13 },
    ];
    const pct = postEventReturnPct("2026-01-02", candles, 4);
    assert.ok(pct != null);
    assert.ok(Math.abs(pct! - 20) < 1e-9);
  });
});
