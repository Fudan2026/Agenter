import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { isLoggedIn, loadSession } from "../lib/auth/session";
import { esc } from "../lib/util/esc";

export type RouteName =
  | "home"
  | "compare"
  | "learn"
  | "handbook"
  | "tools"
  | "news"
  | "quant"
  | "paper"
  | "sim"
  | "asset"
  | "login"
  | "account"
  | "fin";

const TOOLS_SUBROUTES: RouteName[] = [
  "quant",
  "paper",
  "sim",
  "asset",
  "news",
  "fin",
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
    { route: "handbook", href: "#/handbook", label: "navHandbook" },
    { route: "tools", href: "#/tools", label: "navTools" },
  ];

  const brandSub = opts?.subtitle;
  const session = loadSession();
  const authChip = isLoggedIn()
    ? `<a class="nav-link auth-chip" href="#/account">${esc(session?.user.email || t(locale, "accountTitle"))}</a>
       <a class="nav-link" href="#/fin">${esc(t(locale, "finDeskTitle"))}</a>`
    : `<a class="nav-link auth-chip" href="#/login">${esc(t(locale, "loginTitle"))}</a>`;

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
              const cls =
                active === n.route || toolsActive ? "active" : "";
              return `<a class="nav-link ${cls}" href="${n.href}">${esc(t(locale, n.label))}</a>`;
            })
            .join("")}
          ${authChip}
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
  | "navHandbook"
  | "navTools";
