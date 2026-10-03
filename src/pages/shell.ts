import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  SUPRO_ADMIN_EMAIL,
} from "../lib/auth/config";
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
  | "fin"
  | "admin";

type StringKeyNav =
  | "navHome"
  | "navCompare"
  | "navLearn"
  | "navHandbook"
  | "navTools"
  | "navQuant"
  | "accountTitle"
  | "loginTitle"
  | "finDeskTitle"
  | "adminTitle";

const TOOLS_SUBROUTES: RouteName[] = [
  "quant",
  "paper",
  "sim",
  "asset",
  "news",
  "fin",
];

function isAdminSession(): boolean {
  const email = String(loadSession()?.user.email || "").toLowerCase();
  return email === SUPRO_ADMIN_EMAIL;
}

export function renderShell(
  locale: Locale,
  active: RouteName,
  body: string,
  opts?: { title?: string; subtitle?: string },
): string {
  const session = loadSession();
  const loggedIn = isLoggedIn();
  const admin = isAdminSession();

  const menu: Array<{ href: string; label: StringKeyNav; route?: RouteName }> = [
    { href: "#/", label: "navHome", route: "home" },
    { href: "#/compare", label: "navCompare", route: "compare" },
    { href: "#/quant", label: "navQuant", route: "quant" },
    { href: "#/handbook", label: "navHandbook", route: "handbook" },
    { href: "#/tools", label: "navTools", route: "tools" },
    {
      href: loggedIn ? "#/account" : "#/login",
      label: loggedIn ? "accountTitle" : "loginTitle",
      route: loggedIn ? "account" : "login",
    },
    { href: "#/fin", label: "finDeskTitle", route: "fin" },
  ];
  if (admin) {
    menu.push({ href: "#/admin", label: "adminTitle", route: "admin" });
  }

  const brandSub = opts?.subtitle;

  return `
    <a class="skip-link" href="#main-content">${esc(locale === "zh" ? "跳到主要内容" : "Skip to main content")}</a>
    <div class="official-banner" role="note">${esc(t(locale, "officialBanner"))}</div>
    <header class="site-header america-header">
      <div class="brand-block">
        <a class="brand brand-link" href="#/">${esc(t(locale, "brand"))}</a>
        ${brandSub ? `<p class="subtitle">${esc(brandSub)}</p>` : `<p class="subtitle">${esc(t(locale, "tagline"))}</p>`}
      </div>
      <div class="header-controls">
        <button type="button" class="menu-trigger" id="menu-open" aria-haspopup="dialog" aria-controls="site-menu">${esc(t(locale, "menuLabel"))}</button>
        <div class="locale-toggle" role="group" aria-label="locale">
          <button type="button" data-locale="zh" class="${locale === "zh" ? "active" : ""}">${esc(t(locale, "localeZh"))}</button>
          <button type="button" data-locale="en" class="${locale === "en" ? "active" : ""}">${esc(t(locale, "localeEn"))}</button>
        </div>
      </div>
    </header>
    <div class="menu-sheet" id="site-menu" hidden>
      <div class="menu-sheet-panel" role="dialog" aria-modal="true" aria-label="${esc(t(locale, "menuLabel"))}">
        <div class="menu-sheet-head">
          <strong>${esc(t(locale, "brand"))}</strong>
          <button type="button" class="btn btn-ghost" id="menu-close">${esc(t(locale, "menuClose"))}</button>
        </div>
        <nav class="menu-sheet-nav">
          ${menu
            .map((n) => {
              const toolsActive =
                n.route === "tools" && TOOLS_SUBROUTES.includes(active);
              const cls =
                active === n.route || toolsActive ? "active" : "";
              return `<a class="menu-link ${cls}" href="${n.href}">${esc(t(locale, n.label))}</a>`;
            })
            .join("")}
          ${
            loggedIn
              ? `<p class="muted tiny menu-email">${esc(session?.user.email || "")}</p>`
              : ""
          }
        </nav>
      </div>
    </div>
    <main class="page" id="main-content">
      ${body}
    </main>
    <footer class="site-footer america-footer">
      <div class="footer-links">
        <a href="#/handbook">${esc(t(locale, "navHandbook"))}</a>
        <a href="#/quant">${esc(t(locale, "navQuant"))}</a>
        <a href="#/compare">${esc(t(locale, "navCompare"))}</a>
        <a href="#/fin">${esc(t(locale, "finDeskTitle"))}</a>
        <a href="#/login">${esc(t(locale, "loginTitle"))}</a>
      </div>
      <p class="footer-credit">${esc(t(locale, "tagline"))} · ${esc(locale === "zh" ? "苏坡大模型 · 教育演示，不构成投资建议" : "SuPo Model · educational, not advice")}</p>
      <p class="footer-langs">
        <button type="button" data-locale="en" class="footer-lang ${locale === "en" ? "active" : ""}">English</button>
        <button type="button" data-locale="zh" class="footer-lang ${locale === "zh" ? "active" : ""}">中文</button>
      </p>
      <p class="disclaimer">${esc(t(locale, "disclaimer"))}</p>
    </footer>
  `;
}

/** Wire menu after shell paint (locale stays wired by app.ts). */
export function bindShellChrome(root: HTMLElement): void {
  const menu = root.querySelector("#site-menu") as HTMLElement | null;
  const open = () => {
    if (!menu) return;
    menu.hidden = false;
    document.body.classList.add("menu-open");
    (root.querySelector("#menu-close") as HTMLButtonElement | null)?.focus();
  };
  const close = () => {
    if (!menu) return;
    menu.hidden = true;
    document.body.classList.remove("menu-open");
  };
  root.querySelector("#menu-open")?.addEventListener("click", open);
  root.querySelector("#menu-close")?.addEventListener("click", close);
  menu?.addEventListener("click", (e) => {
    if (e.target === menu) close();
  });
  root.querySelectorAll(".menu-link").forEach((a) => {
    a.addEventListener("click", () => close());
  });
}
