import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { esc } from "../lib/util/esc";

export type RouteName =
  | "home"
  | "compare"
  | "learn"
  | "desk"
  | "tools"
  | "news"
  | "quant"
  | "paper"
  | "asset"
  | "research"
  | "screener"
  | "timing"
  | "lab"
  | "portfolio"
  | "replay"
  | "academy"
  | "live-rehearsal";

const TOOLS_SUBROUTES: RouteName[] = [
  "quant",
  "paper",
  "asset",
  "news",
  "lab",
  "screener",
  "timing",
  "portfolio",
  "replay",
  "academy",
  "live-rehearsal",
  "research",
];

const DESK_SUBROUTES: RouteName[] = [
  "desk",
  "research",
  "screener",
  "timing",
  "lab",
  "paper",
  "portfolio",
  "replay",
  "academy",
  "live-rehearsal",
];

export function renderShell(
  locale: Locale,
  active: RouteName,
  body: string,
  opts?: { title?: string; subtitle?: string },
): string {
  const nav: Array<{ route: RouteName; href: string; label: StringKeyNav }> = [
    { route: "home", href: "#/", label: "navHome" },
    { route: "compare", href: "#/compare", label: "navCompare" },
    { route: "learn", href: "#/learn", label: "navLearn" },
    { route: "desk", href: "#/desk", label: "navDesk" },
    { route: "tools", href: "#/tools", label: "navTools" },
  ];

  const brandSub = opts?.subtitle;

  return `
    <header class="site-header">
      <div class="brand-block">
        <a class="brand brand-link" href="#/">${esc(t(locale, "brand"))}</a>
        ${brandSub ? `<p class="subtitle">${esc(brandSub)}</p>` : `<p class="subtitle">${esc(t(locale, "tagline"))}</p>`}
      </div>
      <div class="header-controls">
        <nav class="site-nav" aria-label="primary">
          ${nav
            .map((n) => {
              const toolsActive =
                n.route === "tools" && TOOLS_SUBROUTES.includes(active);
              const deskActive =
                n.route === "desk" && DESK_SUBROUTES.includes(active);
              const cls =
                active === n.route || toolsActive || deskActive ? "active" : "";
              return `<a class="nav-link ${cls}" href="${n.href}">${esc(t(locale, n.label))}</a>`;
            })
            .join("")}
        </nav>
        <div class="locale-toggle" role="group" aria-label="locale">
          <button type="button" data-locale="zh" class="${locale === "zh" ? "active" : ""}">${esc(t(locale, "localeZh"))}</button>
          <button type="button" data-locale="en" class="${locale === "en" ? "active" : ""}">${esc(t(locale, "localeEn"))}</button>
        </div>
      </div>
    </header>
    <main class="page">
      ${body}
    </main>
    <footer class="site-footer"><p>${esc(t(locale, "disclaimer"))}</p></footer>
  `;
}

type StringKeyNav =
  | "navHome"
  | "navCompare"
  | "navLearn"
  | "navDesk"
  | "navTools";
