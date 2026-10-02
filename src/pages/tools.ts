import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AnnouncementsPayload } from "../lib/announcements/map";
import type { IwencaiNewsPayload } from "../lib/iwencai-news/map";
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

function renderAnnouncementLis(
  locale: Locale,
  items: AnnouncementsPayload["items"],
  limit?: number,
): string {
  const slice = limit != null ? items.slice(0, limit) : items;
  if (!slice.length) {
    return `<li class="muted">${esc(t(locale, "announcementsEmpty"))}</li>`;
  }
  return slice
    .map((n) => {
      const title = locale === "zh" ? n.titleZh : n.titleEn;
      const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
      const name = locale === "zh" ? n.nameZh : n.symbol;
      return `<li>
        <time>${esc(n.date)} · ${esc(name)}</time>
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
      return `<li>
        <time>${esc(n.date)}</time>
        <strong>${esc(title)}</strong>
        <p class="muted">${esc(summary)}</p>
        ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">source</a></p>` : ""}
      </li>`;
    })
    .join("");
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
  const body = `
    <h1>${esc(t(locale, "newsNavTitleFull"))}</h1>
    <section class="news-section">
      <h2>${esc(t(locale, "newsTitle"))}</h2>
      <p class="lead muted tiny">${esc(news?.generatedAt?.slice(0, 19) ?? "")} · ${esc(news?.source ?? "fixture")}</p>
      <ul class="news-list">
        ${
          items.length
            ? items
                .map((n) => {
                  const title = locale === "zh" ? n.titleZh : n.titleEn;
                  const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
                  return `<li>
                    <time>${esc(n.date)}</time>
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
    <section class="news-section announcements-section">
      <h2>${esc(t(locale, "announcementsTitle"))}</h2>
      <p class="lead muted tiny">${esc(announcements?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "announcementsSource"))}</p>
      <p class="muted tiny">${esc(t(locale, "announcementsLead"))}</p>
      <ul class="news-list">
        ${renderAnnouncementLis(locale, annItems)}
      </ul>
    </section>
    <section class="news-section iwencai-news-section">
      <h2>${esc(t(locale, "iwencaiNewsTitle"))}</h2>
      <p class="lead muted tiny">${esc(iwencaiNews?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "iwencaiSource"))}</p>
      <p class="muted tiny">${esc(t(locale, "iwencaiNewsLead"))}</p>
      <ul class="news-list">
        ${renderIwencaiNewsLis(locale, iwItems)}
      </ul>
    </section>
  `;
  root.innerHTML = renderShell(locale, "news", body);
  document.title = `${t(locale, "newsNavTitleFull")} · Agenter`;
}

export function renderTools(
  root: HTMLElement,
  locale: Locale,
  news: NewsPayload | null,
  announcements: AnnouncementsPayload | null = null,
  iwencaiNews: IwencaiNewsPayload | null = null,
): void {
  const cards = [
    {
      href: "#/quant",
      title: t(locale, "toolQuant"),
      desc: t(locale, "toolQuantDesc"),
    },
    {
      href: "#/paper",
      title: t(locale, "toolPaper"),
      desc: t(locale, "toolPaperDesc"),
    },
    {
      href: "#/sim",
      title: t(locale, "toolSim"),
      desc: t(locale, "toolSimDesc"),
    },
    {
      href: "#/paper",
      title: t(locale, "toolExport"),
      desc: t(locale, "toolExportDesc"),
    },
    {
      href: "#/news",
      title: t(locale, "toolNews"),
      desc: t(locale, "toolNewsDesc"),
    },
    {
      href: "#/news",
      title: t(locale, "toolAnnouncements"),
      desc: t(locale, "toolAnnouncementsDesc"),
    },
    {
      href: "#/news",
      title: t(locale, "toolIwencaiNews"),
      desc: t(locale, "toolIwencaiNewsDesc"),
    },
  ];

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
          <p><a href="#/news">${esc(t(locale, "navNews"))} →</a></p>
        </section>`
      : `<section class="news-stub"><h2>${esc(t(locale, "toolNews"))}</h2><p class="muted">${esc(t(locale, "toolNewsDesc"))}</p></section>`;

  const annItems = announcements?.items ?? [];
  const annBlock = `<section class="news-stub announcements-stub">
      <h2>${esc(t(locale, "toolAnnouncements"))}</h2>
      <ul class="news-list">
        ${renderAnnouncementLis(locale, annItems, 3)}
      </ul>
      <p class="muted tiny">${esc(t(locale, "announcementsSource"))}</p>
      <p><a href="#/news">${esc(t(locale, "announcementsTitle"))} →</a></p>
    </section>`;

  const iwItems = iwencaiNews?.items ?? [];
  const iwBlock = `<section class="news-stub iwencai-news-stub">
      <h2>${esc(t(locale, "toolIwencaiNews"))}</h2>
      <ul class="news-list">
        ${renderIwencaiNewsLis(locale, iwItems, 3)}
      </ul>
      <p class="muted tiny">${esc(t(locale, "iwencaiSource"))}</p>
      <p><a href="#/news">${esc(t(locale, "iwencaiNewsTitle"))} →</a></p>
    </section>`;

  const body = `
    <h1>${esc(t(locale, "toolsTitle"))}</h1>
    <p class="lead">${esc(t(locale, "toolsLead"))}</p>
    <p class="muted">${esc(t(locale, "toolsSecondaryNote"))}</p>
    <div class="tool-grid">
      ${cards
        .map(
          (c) => `<a class="tool-card" href="${c.href}">
            <h2>${esc(c.title)}</h2>
            <p>${esc(c.desc)}</p>
          </a>`,
        )
        .join("")}
    </div>
    ${newsBlock}
    ${annBlock}
    ${iwBlock}
  `;
  root.innerHTML = renderShell(locale, "tools", body);
  document.title = `${t(locale, "toolsTitle")} · Agenter`;
}
