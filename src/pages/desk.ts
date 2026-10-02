import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

const MODULES: Array<{ href: string; titleKey: string; leadKey: string }> = [
  { href: "#/research", titleKey: "navResearch", leadKey: "layoutResearch" },
  { href: "#/screener", titleKey: "navScreener", leadKey: "screenerTitle" },
  { href: "#/timing", titleKey: "navTiming", leadKey: "timingTitle" },
  { href: "#/lab", titleKey: "navLab", leadKey: "navLab" },
  { href: "#/paper", titleKey: "navPaper", leadKey: "navPaper" },
  { href: "#/portfolio", titleKey: "navPortfolio", leadKey: "portfolioTitle" },
  { href: "#/replay", titleKey: "navReplay", leadKey: "replayTitle" },
  { href: "#/academy", titleKey: "navAcademy", leadKey: "academyTitle" },
  {
    href: "#/live-rehearsal",
    titleKey: "liveRehearsalTitle",
    leadKey: "readinessScore",
  },
];

export function renderDesk(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  const panesHtml = `
    <section class="ws-pane ws-pane-full desk-home">
      <h1>${esc(tk(locale, "deskHomeTitle"))}</h1>
      <p class="lead">${esc(tk(locale, "deskHomeLead"))}</p>
      <div class="dual-system-blurb">
        <h2>${esc(tk(locale, "dualSystemTitle"))}</h2>
        <p class="muted">${esc(tk(locale, "dualSystemLead"))}</p>
      </div>
      <div class="cta-row wrap">
        <a class="btn btn-primary" href="#/research">${esc(tk(locale, "enterDesk"))}</a>
        <a class="btn" href="#/compare">${esc(tk(locale, "ctaCompareAgents"))}</a>
        <a class="btn" href="#/research">${esc(tk(locale, "ctaEnterDesk"))}</a>
      </div>
      <h2>${esc(tk(locale, "layoutTrade"))} · ${esc(tk(locale, "layoutResearch"))} · ${esc(tk(locale, "layoutTiming"))} · ${esc(tk(locale, "layoutReview"))}</h2>
      <ul class="desk-module-list">
        ${MODULES.map(
          (m) =>
            `<li><a href="${m.href}"><strong>${esc(tk(locale, m.titleKey))}</strong></a> <span class="muted tiny">${esc(tk(locale, m.leadKey))}</span></li>`,
        ).join("")}
      </ul>
    </section>
  `;

  root.innerHTML = renderWorkspaceShell({
    locale,
    active: "desk",
    layout: "review",
    panesHtml,
    reportDate: data.reportDate,
  });
  document.title = `${tk(locale, "navDesk")} · ${tk(locale, "quantOs")}`;
}
