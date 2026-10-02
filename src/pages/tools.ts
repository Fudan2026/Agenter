import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
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

export function renderNews(
  root: HTMLElement,
  locale: Locale,
  news: NewsPayload | null,
): void {
  const items = news?.items ?? [];
  const body = `
    <h1>${esc(t(locale, "newsNavTitle"))}</h1>
    <p class="lead muted tiny">${esc(news?.generatedAt?.slice(0, 19) ?? "")}Z · ${esc(news?.source ?? "fixture")}</p>
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
  `;
  root.innerHTML = renderShell(locale, "news", body);
  document.title = `${t(locale, "newsNavTitle")} · Agenter`;
}

export function renderTools(
  root: HTMLElement,
  locale: Locale,
  news: NewsPayload | null,
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
      href: "#/paper",
      title: t(locale, "toolExport"),
      desc: t(locale, "toolExportDesc"),
    },
    {
      href: "#/news",
      title: t(locale, "toolNews"),
      desc: t(locale, "toolNewsDesc"),
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

  const body = `
    <h1>${esc(t(locale, "toolsTitle"))}</h1>
    <p class="lead">${esc(t(locale, "toolsLead"))}</p>
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
  `;
  root.innerHTML = renderShell(locale, "tools", body);
  document.title = `${t(locale, "toolsTitle")} · Agenter`;
}
