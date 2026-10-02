import { detectLocale, setLocale, type Locale } from "./i18n/strings";
import { t } from "./i18n/strings";
import type { AnnouncementsPayload } from "./lib/announcements/map";
import { cleanupAssetPage, renderAsset } from "./pages/asset";
import { renderBrandHome } from "./pages/brand-home";
import { loadAgents, renderCompare } from "./pages/compare";
import { renderLearn } from "./pages/learn";
import { cleanupPaperPage, renderPaper } from "./pages/paper";
import { cleanupQuantPage, renderQuant } from "./pages/quant";
import { cleanupSimPage, renderSim } from "./pages/sim";
import { renderNews, renderTools, type NewsPayload } from "./pages/tools";
import type { LatestPayload } from "./pages/types";

let quantData: LatestPayload | null = null;
let quantError: string | null = null;
let newsData: NewsPayload | null = null;
let announcementsData: AnnouncementsPayload | null = null;
let locale: Locale = detectLocale();

type Route =
  | { page: "home" }
  | { page: "compare" }
  | { page: "learn" }
  | { page: "tools" }
  | { page: "news" }
  | { page: "quant" }
  | { page: "paper" }
  | { page: "sim" }
  | { page: "asset"; symbol: string };

async function loadQuantData(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/latest.json`, {
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    quantData = (await res.json()) as LatestPayload;
    quantError = null;
  } catch (e) {
    quantError = e instanceof Error ? e.message : String(e);
    quantData = null;
  }
}

async function loadNews(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/ai-news.json`, {
      cache: "no-cache",
    });
    if (!res.ok) return;
    newsData = (await res.json()) as NewsPayload;
  } catch {
    newsData = null;
  }
}

async function loadAnnouncements(): Promise<void> {
  try {
    const res = await fetch(
      `${import.meta.env.BASE_URL}data/announcements.json`,
      { cache: "no-cache" },
    );
    if (!res.ok) return;
    announcementsData = (await res.json()) as AnnouncementsPayload;
  } catch {
    announcementsData = null;
  }
}

function parseRoute(): Route {
  const hash = location.hash.replace(/^#/, "") || "/";
  const path = (hash.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (path === "/" || path === "") return { page: "home" };
  if (path === "/compare") return { page: "compare" };
  if (path === "/learn") return { page: "learn" };
  if (path === "/tools") return { page: "tools" };
  if (path === "/news") return { page: "news" };
  if (path === "/quant") return { page: "quant" };
  if (path === "/paper") return { page: "paper" };
  if (path === "/sim") return { page: "sim" };
  const asset = path.match(/^\/asset\/(.+)$/);
  if (asset) return { page: "asset", symbol: decodeURIComponent(asset[1]) };
  return { page: "home" };
}

function bindLocale(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.locale as Locale;
      if (next !== "zh" && next !== "en") return;
      locale = next;
      setLocale(locale);
      void render();
    });
  });
}

async function render(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;
  cleanupAssetPage();
  cleanupPaperPage();
  cleanupQuantPage();
  cleanupSimPage();
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  root.classList.remove("route-enter");
  void root.offsetWidth;
  root.classList.add("route-enter");

  const route = parseRoute();

  try {
    switch (route.page) {
      case "home":
        renderBrandHome(root, locale);
        break;
      case "compare": {
        const agents = await loadAgents();
        renderCompare(root, locale, agents);
        break;
      }
      case "learn":
        renderLearn(root, locale);
        break;
      case "tools":
        renderTools(root, locale, newsData, announcementsData);
        break;
      case "news":
        renderNews(root, locale, newsData, announcementsData);
        break;
      case "quant":
        if (quantError || !quantData) {
          root.innerHTML = `<main class="page"><p class="error">${t(locale, "loadError")} (${quantError ?? "empty"})</p></main>`;
        } else {
          renderQuant(root, quantData, locale);
        }
        break;
      case "paper":
        if (quantError || !quantData) {
          root.innerHTML = `<main class="page"><p class="error">${t(locale, "loadError")} (${quantError ?? "empty"})</p></main>`;
        } else {
          renderPaper(root, quantData, locale);
        }
        break;
      case "sim":
        if (quantError || !quantData) {
          root.innerHTML = `<main class="page"><p class="error">${t(locale, "loadError")} (${quantError ?? "empty"})</p></main>`;
        } else {
          renderSim(root, quantData, locale);
        }
        break;
      case "asset":
        if (quantError || !quantData) {
          root.innerHTML = `<main class="page"><p class="error">${t(locale, "loadError")}</p></main>`;
        } else {
          renderAsset(root, quantData, route.symbol, locale, announcementsData);
        }
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    root.innerHTML = `<main class="page"><p class="error">${msg}</p></main>`;
  }

  bindLocale(root);
}

export async function startApp(): Promise<void> {
  locale = detectLocale();
  await Promise.all([loadQuantData(), loadNews(), loadAnnouncements()]);
  await render();
  window.addEventListener("hashchange", () => {
    void render();
  });
}
