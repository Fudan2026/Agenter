import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { esc } from "../lib/util/esc";

export type DeskRoute =
  | "desk"
  | "research"
  | "screener"
  | "timing"
  | "lab"
  | "paper"
  | "portfolio"
  | "replay"
  | "academy"
  | "live-rehearsal";

export type DeskLayoutId = "trade" | "research" | "timing" | "review";

const DESK_TABS: Array<{ route: DeskRoute; href: string; labelKey: string }> = [
  { route: "desk", href: "#/desk", labelKey: "navDesk" },
  { route: "research", href: "#/research", labelKey: "navResearch" },
  { route: "screener", href: "#/screener", labelKey: "navScreener" },
  { route: "timing", href: "#/timing", labelKey: "navTiming" },
  { route: "lab", href: "#/lab", labelKey: "navLab" },
  { route: "paper", href: "#/paper", labelKey: "navPaper" },
  { route: "portfolio", href: "#/portfolio", labelKey: "navPortfolio" },
  { route: "replay", href: "#/replay", labelKey: "navReplay" },
  { route: "academy", href: "#/academy", labelKey: "navAcademy" },
];

export function setWorkspaceMode(on: boolean): void {
  document.documentElement.classList.toggle("workspace-mode", on);
}

export function renderWorkspaceShell(opts: {
  locale: Locale;
  active: DeskRoute;
  layout: DeskLayoutId;
  panesHtml: string;
  statusRight?: string;
  reportDate?: string;
}): string {
  setWorkspaceMode(true);
  const { locale, active, layout, panesHtml } = opts;
  return `
    <div class="workspace-shell" data-layout="${esc(layout)}">
      <header class="ws-header">
        <div class="ws-brand">
          <a class="brand brand-link" href="#/">${esc(t(locale, "brand"))}</a>
          <span class="ws-pill">${esc(t(locale, "quantOs" as Parameters<typeof t>[1]))}</span>
        </div>
        <nav class="ws-tabs" aria-label="desk">
          ${DESK_TABS.map((tab) => {
            const cls = tab.route === active ? "active" : "";
            return `<a class="ws-tab ${cls}" href="${tab.href}">${esc(t(locale, tab.labelKey as Parameters<typeof t>[1]))}</a>`;
          }).join("")}
        </nav>
        <div class="ws-header-right">
          <a class="btn btn-ghost tiny" href="#/">${esc(t(locale, "exitDesk" as Parameters<typeof t>[1]))}</a>
          <div class="locale-toggle" role="group" aria-label="locale">
            <button type="button" data-locale="zh" class="${locale === "zh" ? "active" : ""}">${esc(t(locale, "localeZh"))}</button>
            <button type="button" data-locale="en" class="${locale === "en" ? "active" : ""}">${esc(t(locale, "localeEn"))}</button>
          </div>
        </div>
      </header>
      <div class="workspace-body ws-layout-${esc(layout)}">
        ${panesHtml}
      </div>
      <footer class="ws-status">
        <span>${esc(opts.reportDate ?? "")}</span>
        <span>${esc(t(locale, "paperCostOn"))}</span>
        <span>${esc(t(locale, "survivorshipBanner"))}</span>
        <span>${opts.statusRight ? esc(opts.statusRight) : ""}</span>
        <span class="muted tiny">Inspired by TWS Mosaic / Launchpad · educational A+C</span>
      </footer>
    </div>
  `;
}
