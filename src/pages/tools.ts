import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnnouncementItem, AnnouncementsPayload } from "../lib/announcements/map";
import {
  bucketAnnouncements,
  countByBucket,
  EVENT_BUCKETS,
  type EventBucketId,
} from "../lib/announcements/events";
import type { IndicesPayload } from "../lib/indices/map";
import type { IwencaiNewsPayload } from "../lib/iwencai-news/map";
import {
  NEWS_SECTION_IDS,
  readHashQuery,
  scrollToId,
  withHashQuery,
} from "../lib/nav/hash-query";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

export interface NewsPayload {
  generatedAt: string;
  source?: string;
  items: Array<{
    id: string;
    date: string;
    titleZh: string;
    titleEn: string;
    summaryZh: string;
    summaryEn: string;
    tags?: string[];
    url?: string;
  }>;
}

export type { AnnouncementsPayload, IwencaiNewsPayload };

const BUCKET_I18N: Record<
  EventBucketId,
  "eventEarnings" | "eventBuyback" | "eventHolder" | "eventOther"
> = {
  earnings: "eventEarnings",
  buyback: "eventBuyback",
  holder_change: "eventHolder",
  other: "eventOther",
};

/** Compact bucket count chips for News / Tools / Quant strips. */
export function renderEventBucketCounts(
  locale: Locale,
  items: AnnouncementItem[],
): string {
  if (!items.length) return "";
  const counts = countByBucket(items);
  return `<div class="event-bucket-strip" aria-label="${esc(t(locale, "eventBucketsTitle"))}">
    <p class="tiny muted">${esc(t(locale, "eventBucketsTitle"))}</p>
    <div class="event-bucket-chips">
      ${EVENT_BUCKETS.map((b) => {
        const label = t(locale, BUCKET_I18N[b.id]);
        return `<span class="event-bucket-chip" data-bucket="${esc(b.id)}">${esc(label)} <strong>${counts[b.id]}</strong></span>`;
      }).join("")}
    </div>
  </div>`;
}

/** Top bucketed filings list (Quant / News enrichment). */
export function renderBucketedFilingsList(
  locale: Locale,
  items: AnnouncementItem[],
  limit = 8,
): string {
  const bucketed = bucketAnnouncements(items).slice(0, limit);
  if (!bucketed.length) {
    return `<p class="muted">${esc(t(locale, "announcementsEmpty"))}</p>`;
  }
  return `<ul class="news-list filings-list">
    ${bucketed
      .map((n) => {
        const title = locale === "zh" ? n.titleZh : n.titleEn;
        const name = locale === "zh" ? n.nameZh : n.symbol;
        const bucketLabel = t(locale, BUCKET_I18N[n.bucket]);
        return `<li>
          <time>${esc(n.date)} · ${esc(name)}</time>
          <span class="chip event-bucket-tag">${esc(bucketLabel)}</span>
          <strong>${esc(title)}</strong>
          ${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">source</a>` : ""}
        </li>`;
      })
      .join("")}
  </ul>`;
}

function renderAnnouncementLis(
  locale: Locale,
  items: AnnouncementsPayload["items"],
  limit?: number,
): string {
  const slice = limit != null ? items.slice(0, limit) : items;
  if (!slice.length) {
    return `<li class="muted">${esc(t(locale, "announcementsEmpty"))}</li>`;
  }
  const bucketed = bucketAnnouncements(slice);
  return bucketed
    .map((n) => {
      const title = locale === "zh" ? n.titleZh : n.titleEn;
      const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
      const name = locale === "zh" ? n.nameZh : n.symbol;
      const bucketLabel = t(locale, BUCKET_I18N[n.bucket]);
      return `<li>
        <time>${esc(n.date)} · ${esc(name)}</time>
        <span class="chip event-bucket-tag">${esc(bucketLabel)}</span>
        <strong>${esc(title)}</strong>
        <p class="muted">${esc(summary)}</p>
        ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">source</a></p>` : ""}
      </li>`;
    })
    .join("");
}

function renderIwencaiNewsLis(
  locale: Locale,
  items: IwencaiNewsPayload["items"],
  limit?: number,
): string {
  const slice = limit != null ? items.slice(0, limit) : items;
  if (!slice.length) {
    return `<li class="muted">${esc(t(locale, "iwencaiNewsEmpty"))}</li>`;
  }
  return slice
    .map((n) => {
      const title = locale === "zh" ? n.titleZh : n.titleEn;
      const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
      const qTag = n.query
        ? `<span class="chip query-tag">${esc(n.query)}</span>`
        : "";
      return `<li>
        <time>${esc(n.date)}</time>
        ${qTag}
        <strong>${esc(title)}</strong>
        <p class="muted">${esc(summary)}</p>
        ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">source</a></p>` : ""}
      </li>`;
    })
    .join("");
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtLast(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function renderIndicesStrip(
  locale: Locale,
  indices: IndicesPayload | null,
): string {
  const items = indices?.items ?? [];
  if (!items.length) {
    return `<section class="indices-strip">
      <h2 class="indices-h">${esc(t(locale, "indicesTitle"))}</h2>
      <p class="muted tiny">${esc(t(locale, "indicesEmpty"))} · ${esc(t(locale, "iwencaiSource"))}</p>
    </section>`;
  }
  return `<section class="indices-strip">
    <div class="indices-head">
      <h2 class="indices-h">${esc(t(locale, "indicesTitle"))}</h2>
      <p class="muted tiny">${esc(indices?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "iwencaiSource"))}</p>
    </div>
    <div class="indices-row">
      ${items
        .map((ix) => {
          const name = locale === "zh" ? ix.nameZh : ix.nameEn;
          const up = (ix.changePct ?? 0) > 0;
          const down = (ix.changePct ?? 0) < 0;
          const cls = up ? "up" : down ? "down" : "flat";
          return `<div class="index-chip ${cls}">
            <span class="index-name">${esc(name)}</span>
            <span class="index-last">${esc(fmtLast(ix.last))}</span>
            <span class="index-chg">${esc(fmtPct(ix.changePct))}</span>
          </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

export function renderNews(
  root: HTMLElement,
  locale: Locale,
  news: NewsPayload | null,
  announcements: AnnouncementsPayload | null = null,
  iwencaiNews: IwencaiNewsPayload | null = null,
): void {
  const items = news?.items ?? [];
  const annItems = announcements?.items ?? [];
  const iwItems = iwencaiNews?.items ?? [];
  const iwQueries = [
    ...new Set(iwItems.map((n) => n.query).filter((q): q is string => !!q)),
  ];
  const bakeLine = (bits: string[]): string =>
    bits.length
      ? `<p class="muted tiny bake-meta">${esc(bits.join(" · "))}</p>`
      : "";
  const body = `
    <h1>${esc(t(locale, "newsNavTitleFull"))}</h1>
    <div class="cta-row wrap news-section-chips" role="navigation" aria-label="News sections">
      <a class="btn btn-ghost" href="${withHashQuery("/news", { section: "ai" })}">${esc(t(locale, "toolNewsChipAi"))}</a>
      <a class="btn btn-ghost" href="${withHashQuery("/news", { section: "filings" })}">${esc(t(locale, "toolNewsChipFilings"))}</a>
      <a class="btn btn-ghost" href="${withHashQuery("/news", { section: "iwencai" })}">${esc(t(locale, "toolNewsChipIwencai"))}</a>
    </div>
    <section class="news-section" id="news-ai">
      <h2>${esc(t(locale, "newsTitle"))}</h2>
      <p class="lead muted tiny">${esc(news?.generatedAt?.slice(0, 19) ?? "")} · ${esc(news?.source ?? "fixture")}</p>
      ${bakeLine(news?.source ? [`source: ${news.source}`] : [])}
      <ul class="news-list">
        ${
          items.length
            ? items
                .map((n) => {
                  const title = locale === "zh" ? n.titleZh : n.titleEn;
                  const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
                  const tags = (n.tags ?? [])
                    .map((tg) => `<span class="chip query-tag">${esc(tg)}</span>`)
                    .join("");
                  return `<li>
                    <time>${esc(n.date)}</time>
                    ${tags}
                    <strong>${esc(title)}</strong>
                    <p class="muted">${esc(summary)}</p>
                    ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">source</a></p>` : ""}
                  </li>`;
                })
                .join("")
            : `<li class="muted">${esc(t(locale, "toolNewsDesc"))}</li>`
        }
      </ul>
    </section>
    <section class="news-section announcements-section" id="news-filings">
      <h2>${esc(t(locale, "announcementsTitle"))}</h2>
      <p class="lead muted tiny">${esc(announcements?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "announcementsSource"))}</p>
      <p class="muted tiny">${esc(t(locale, "announcementsLead"))}</p>
      ${bakeLine(
        [
          announcements?.skill ? `skill: ${announcements.skill}` : "",
          "channel: announcement",
          `n=${annItems.length}`,
        ].filter(Boolean),
      )}
      ${renderEventBucketCounts(locale, annItems)}
      <ul class="news-list">
        ${renderAnnouncementLis(locale, annItems)}
      </ul>
    </section>
    <section class="news-section iwencai-news-section" id="news-iwencai">
      <h2>${esc(t(locale, "iwencaiNewsTitle"))}</h2>
      <p class="lead muted tiny">${esc(iwencaiNews?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "iwencaiSource"))}</p>
      <p class="muted tiny">${esc(t(locale, "iwencaiNewsLead"))}</p>
      ${bakeLine(
        [
          iwencaiNews?.skill ? `skill: ${iwencaiNews.skill}` : "",
          "channel: news",
          ...iwQueries.slice(0, 4).map((q) => `query: ${q}`),
        ].filter(Boolean),
      )}
      <ul class="news-list">
        ${renderIwencaiNewsLis(locale, iwItems)}
      </ul>
    </section>
  `;
  root.innerHTML = renderShell(locale, "news", body);
  document.title = `${t(locale, "newsNavTitleFull")} · Agenter`;
  const section = readHashQuery().get("section") ?? "";
  const target = NEWS_SECTION_IDS[section];
  if (target) scrollToId(target);
}

export function renderTools(
  root: HTMLElement,
  locale: Locale,
  news: NewsPayload | null,
  announcements: AnnouncementsPayload | null = null,
  iwencaiNews: IwencaiNewsPayload | null = null,
  indices: IndicesPayload | null = null,
): void {
  const cards = [
    {
      href: "#/handbook",
      title: t(locale, "toolHandbook"),
      desc: t(locale, "toolHandbookDesc"),
    },
    {
      href: "#/quant",
      title: t(locale, "toolQuant"),
      desc: t(locale, "toolQuantDesc"),
    },
    {
      href: "#/paper",
      title: t(locale, "toolPaper"),
      desc: t(locale, "toolPaperDesc"),
      chipHref: withHashQuery("/paper", { panel: "export" }),
      chipLabel: t(locale, "toolPaperExportChip"),
    },
    {
      href: "#/sim",
      title: t(locale, "toolSim"),
      desc: t(locale, "toolSimDesc"),
    },
    {
      href: "#/news",
      title: t(locale, "toolNews"),
      desc: t(locale, "toolNewsDesc"),
    },
  ];

  const newsHref = withHashQuery("/news", { section: "ai" });
  const filingsHref = withHashQuery("/news", { section: "filings" });
  const iwencaiHref = withHashQuery("/news", { section: "iwencai" });

  const newsBlock =
    news && news.items.length
      ? `<section class="news-stub">
          <h2>${esc(t(locale, "newsTitle"))}</h2>
          <ul class="news-list">
            ${news.items
              .slice(0, 3)
              .map((n) => {
                const title = locale === "zh" ? n.titleZh : n.titleEn;
                const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
                return `<li><time>${esc(n.date)}</time><strong>${esc(title)}</strong><p class="muted">${esc(summary)}</p></li>`;
              })
              .join("")}
          </ul>
          <p><a href="${newsHref}">${esc(t(locale, "toolNewsChipAi"))} →</a></p>
        </section>`
      : `<section class="news-stub"><h2>${esc(t(locale, "toolNewsChipAi"))}</h2><p class="muted">${esc(t(locale, "toolNewsDesc"))}</p><p><a href="${newsHref}">→</a></p></section>`;

  const annItems = announcements?.items ?? [];
  const annBlock = `<section class="news-stub announcements-stub">
      <h2>${esc(t(locale, "toolAnnouncements"))}</h2>
      ${renderEventBucketCounts(locale, annItems)}
      <ul class="news-list">
        ${renderAnnouncementLis(locale, annItems, 3)}
      </ul>
      <p class="muted tiny">${esc(t(locale, "announcementsSource"))}</p>
      <p><a href="${filingsHref}">${esc(t(locale, "announcementsTitle"))} →</a></p>
    </section>`;

  const iwItems = iwencaiNews?.items ?? [];
  const iwBlock = `<section class="news-stub iwencai-news-stub">
      <h2>${esc(t(locale, "toolIwencaiNews"))}</h2>
      <ul class="news-list">
        ${renderIwencaiNewsLis(locale, iwItems, 3)}
      </ul>
      <p class="muted tiny">${esc(t(locale, "iwencaiSource"))}</p>
      <p><a href="${iwencaiHref}">${esc(t(locale, "iwencaiNewsTitle"))} →</a></p>
    </section>`;

  const body = `
    <h1>${esc(t(locale, "toolsTitle"))}</h1>
    <p class="lead">${esc(t(locale, "toolsLead"))}</p>
    <p class="muted">${esc(t(locale, "toolsSecondaryNote"))}</p>
    ${renderIndicesStrip(locale, indices)}
    <div class="tool-grid">
      ${cards
        .map((c) => {
          const chip =
            "chipHref" in c && c.chipHref
              ? `<p class="tool-card-chip"><a href="${esc(c.chipHref)}">${esc(c.chipLabel ?? "")}</a></p>`
              : "";
          return `<div class="tool-card">
            <a class="tool-card-main" href="${c.href}">
              <h2>${esc(c.title)}</h2>
              <p>${esc(c.desc)}</p>
            </a>
            ${chip}
          </div>`;
        })
        .join("")}
    </div>
    ${newsBlock}
    ${annBlock}
    ${iwBlock}
  `;
  root.innerHTML = renderShell(locale, "tools", body);
  document.title = `${t(locale, "toolsTitle")} · Agenter`;
}
