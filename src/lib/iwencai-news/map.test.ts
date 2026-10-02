import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapNewsResponse,
  mapNewsRow,
  type GatewayNewsBody,
} from "./map";

const FIXTURE: GatewayNewsBody = {
  status_msg: "OK",
  status_code: 0,
  data: [
    {
      id: "f024151b54a8a74",
      uid: "f024151b54a8a74",
      title: "人工智能行业：图解网安标委《人工智能安全治理框架3.0》",
      summary: "网安标委发布《人工智能安全治理框架3.0》。",
      url: "https://example.com/ai-news",
      publish_time: 1790524800,
      publish_date: "2026-09-28 00:00:00",
      channel: "news",
    },
    {
      id: "empty",
      title: "   ",
      summary: "skip",
      publish_date: "2026-01-01 00:00:00",
    },
  ],
};

describe("iwencai news gateway mapper", () => {
  it("maps known fields into SPA items", () => {
    const items = mapNewsResponse(FIXTURE, { query: "人工智能 最新消息" });
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.date, "2026-09-28");
    assert.match(item.titleZh, /人工智能/);
    assert.equal(item.titleEn, item.titleZh);
    assert.ok(item.summaryZh.includes("治理框架"));
    assert.ok(item.summaryEn.startsWith("(ZH)"));
    assert.equal(item.url, "https://example.com/ai-news");
    assert.equal(item.query, "人工智能 最新消息");
    assert.ok(item.id.startsWith("news-"));
  });

  it("returns empty on non-zero status_code", () => {
    const items = mapNewsResponse(
      { status_code: 1, data: FIXTURE.data },
      { query: "x" },
    );
    assert.equal(items.length, 0);
  });

  it("falls back publish_time seconds to date", () => {
    const item = mapNewsRow(
      {
        id: "t1",
        title: "测试财经新闻标题",
        publish_time: 1762358400,
      },
      { query: "A股政策", index: 0 },
    );
    assert.ok(item);
    assert.equal(item!.date, "2025-11-05");
  });
});
