import { detectLocale, setLocale, type Locale } from "./i18n/strings";
import { t } from "./i18n/strings";
import { cleanupAssetPage, renderAsset } from "./pages/asset";
import { renderAcademy } from "./pages/academy";
import { renderBrandHome } from "./pages/brand-home";
import { loadAgents, renderCompare } from "./pages/compare";
import { renderDesk } from "./pages/desk";
import { cleanupLabPage, renderLab } from "./pages/lab";
import { renderLearn } from "./pages/learn";
import { renderLiveRehearsal } from "./pages/live-rehearsal";
import { cleanupPaperPage, renderPaper } from "./pages/paper";
import { renderPortfolio } from "./pages/portfolio";
import { cleanupQuantPage } from "./pages/quant";
import { cleanupReplayPage, renderReplay } from "./pages/replay";
import { cleanupResearchPage, renderResearch } from "./pages/research";
import { renderScreener } from "./pages/screener";
import { cleanupTimingPage, renderTiming } from "./pages/timing";
import { renderNews, renderTools, type NewsPayload } from "./pages/tools";
import { setWorkspaceMode } from "./pages/workspace-shell";
import type { LatestPayload } from "./pages/types";

let quantData: LatestPayload | null = null;
let quantError: string | null = null;
let newsData: NewsPayload | null = null;
let locale: Locale = detectLocale();

type Route =
  | { page: "home" }
  | { page: "compare" }
  | { page: "learn" }
  | { page: "desk" }
  | { page: "tools" }
  | { page: "news" }
  | { page: "quant" }
  | { page: "paper" }
  | { page: "research" }
  | { page: "screener" }
  | { page: "timing" }
  | { page: "lab" }
  | { page: "portfolio" }
  | { page: "replay" }
  | { page: "academy" }
  | { page: "live-rehearsal" }
  | { page: "asset"; symbol: string };

const WORKSPACE_PAGES = new Set([
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
]);

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

function parseRoute(): Route {
  const hash = location.hash.replace(/^#/, "") || "/";
  const path = (hash.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (path === "/" || path === "") return { page: "home" };
  if (path === "/compare") return { page: "compare" };
  if (path === "/learn") return { page: "learn" };
  if (path === "/desk") return { page: "desk" };
  if (path === "/tools") return { page: "tools" };
  if (path === "/news") return { page: "news" };
  if (path === "/quant") return { page: "quant" };
  if (path === "/paper") return { page: "paper" };
  if (path === "/research") return { page: "research" };
  if (path === "/screener") return { page: "screener" };
  if (path === "/timing") return { page: "timing" };
  if (path === "/lab") return { page: "lab" };
  if (path === "/portfolio") return { page: "portfolio" };
  if (path === "/replay") return { page: "replay" };
  if (path === "/academy") return { page: "academy" };
  if (path === "/live-rehearsal") return { page: "live-rehearsal" };
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

function needQuant(root: HTMLElement): boolean {
  if (quantError || !quantData) {
    setWorkspaceMode(false);
    root.innerHTML = `<main class="page"><p class="error">${t(locale, "loadError")} (${quantError ?? "empty"})</p></main>`;
    return false;
  }
  return true;
}

async function render(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;
  cleanupAssetPage();
  cleanupPaperPage();
  cleanupQuantPage();
  cleanupLabPage();
  cleanupResearchPage();
  cleanupTimingPage();
  cleanupReplayPage();
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  root.classList.remove("route-enter");
  void root.offsetWidth;
  root.classList.add("route-enter");

  const route = parseRoute();
  setWorkspaceMode(WORKSPACE_PAGES.has(route.page));

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
      case "desk":
        if (!needQuant(root)) break;
        renderDesk(root, quantData!, locale);
        break;
      case "tools":
        renderTools(root, locale, newsData);
        break;
      case "news":
        renderNews(root, locale, newsData);
        break;
      case "quant":
        // Soft alias → Lab (keep old links)
        location.hash = "#/lab";
        return;
      case "paper":
        if (!needQuant(root)) break;
        renderPaper(root, quantData!, locale);
        break;
      case "research":
        if (!needQuant(root)) break;
        renderResearch(root, quantData!, locale, newsData);
        break;
      case "screener":
        if (!needQuant(root)) break;
        renderScreener(root, quantData!, locale);
        break;
      case "timing":
        if (!needQuant(root)) break;
        renderTiming(root, quantData!, locale);
        break;
      case "lab":
        if (!needQuant(root)) break;
        renderLab(root, quantData!, locale);
        break;
      case "portfolio":
        if (!needQuant(root)) break;
        renderPortfolio(root, quantData!, locale);
        break;
      case "replay":
        if (!needQuant(root)) break;
        renderReplay(root, quantData!, locale);
        break;
      case "academy":
        if (!needQuant(root)) break;
        renderAcademy(root, quantData!, locale);
        break;
      case "live-rehearsal":
        if (!needQuant(root)) break;
        renderLiveRehearsal(root, quantData!, locale);
        break;
      case "asset":
        if (!needQuant(root)) break;
        renderAsset(root, quantData!, route.symbol, locale);
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setWorkspaceMode(false);
    root.innerHTML = `<main class="page"><p class="error">${msg}</p></main>`;
  }

  bindLocale(root);
}

export async function startApp(): Promise<void> {
  locale = detectLocale();
  await Promise.all([loadQuantData(), loadNews()]);
  await render();
  window.addEventListener("hashchange", () => {
    void render();
  });
}
