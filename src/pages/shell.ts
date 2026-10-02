import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { esc } from "../lib/util/esc";

export type RouteName =
  | "home"
  | "compare"
  | "learn"
  | "tools"
  | "news"
  | "quant"
  | "paper"
  | "asset";

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
    { route: "tools", href: "#/tools", label: "navTools" },
    { route: "news", href: "#/news", label: "navNews" },
    { route: "quant", href: "#/quant", label: "navQuant" },
    { route: "paper", href: "#/paper", label: "navPaper" },
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
              const cls =
                active === n.route || (active === "asset" && n.route === "quant")
                  ? "active"
                  : "";
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
  | "navTools"
  | "navNews"
  | "navQuant"
  | "navPaper";
