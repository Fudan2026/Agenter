import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

interface NewsPayload {
  generatedAt: string;
  items: Array<{
    id: string;
    date: string;
    titleZh: string;
    titleEn: string;
    summaryZh: string;
    summaryEn: string;
  }>;
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
  ];

  const newsBlock =
    news && news.items.length
      ? `<section class="news-stub">
          <h2>${esc(t(locale, "newsTitle"))}</h2>
          <ul class="news-list">
            ${news.items
              .map((n) => {
                const title = locale === "zh" ? n.titleZh : n.titleEn;
                const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
                return `<li><time>${esc(n.date)}</time><strong>${esc(title)}</strong><p class="muted">${esc(summary)}</p></li>`;
              })
              .join("")}
          </ul>
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
