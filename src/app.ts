import { detectLocale, setLocale, type Locale } from "./i18n/strings";
import { t } from "./i18n/strings";
import type { AiRatingsPayload } from "./lib/ai-ratings/map";
import type { AnnouncementsPayload } from "./lib/announcements/map";
import type { IndicesPayload } from "./lib/indices/map";
import type { IwencaiNewsPayload } from "./lib/iwencai-news/map";
import type { ScreensPayload } from "./lib/screens/map";
import {
  cleanupAssetPage,
  renderAsset,
  type EtfMetaPayload,
} from "./pages/asset";
import { renderBrandHome } from "./pages/brand-home";
import { loadAgents, renderCompare } from "./pages/compare";
import { renderHandbook } from "./pages/handbook";
import { renderLearn } from "./pages/learn";
import { cleanupPaperPage, renderPaper } from "./pages/paper";
import { cleanupQuantPage, renderQuant, type RecipesPayload } from "./pages/quant";
import { cleanupSimPage, renderSim } from "./pages/sim";
import { renderNews, renderTools, type NewsPayload } from "./pages/tools";
import { renderLogin } from "./pages/login";
import { renderAccount } from "./pages/account";
import { renderFinDesk } from "./pages/fin";
import { renderAdmin } from "./pages/admin";
import { bindShellChrome } from "./pages/shell";
import type { LatestPayload } from "./pages/types";
import type { FactorsPayload } from "./lib/factors/cross-section";
import type { FactorsIcPayload } from "./lib/factors/ic";
import type { AlphaLitePayload } from "./lib/factors/alpha-lite";
import type { TransformerPvProxyPayload } from "./lib/fin/attention-proxy";
import type { CnCalendarPayload } from "./lib/paper/calendar";
import {
  requiresAuth,
  isLoggedIn,
  consumeAuthCallbackFromUrl,
} from "./lib/auth/session";

let quantData: LatestPayload | null = null;
let quantError: string | null = null;
let newsData: NewsPayload | null = null;
let announcementsData: AnnouncementsPayload | null = null;
let iwencaiNewsData: IwencaiNewsPayload | null = null;
let indicesData: IndicesPayload | null = null;
let screensData: ScreensPayload | null = null;
let factorsData: FactorsPayload | null = null;
let factorsIcData: FactorsIcPayload | null = null;
let alphaLiteData: AlphaLitePayload | null = null;
let transformerPvData: TransformerPvProxyPayload | null = null;
let recipesData: RecipesPayload | null = null;
let calendarData: CnCalendarPayload | null = null;
let etfMetaData: EtfMetaPayload | null = null;
let aiRatingsData: AiRatingsPayload | null = null;
let locale: Locale = detectLocale();

type Route =
  | { page: "home" }
  | { page: "compare" }
  | { page: "learn" }
  | { page: "handbook" }
  | { page: "tools" }
  | { page: "news" }
  | { page: "quant" }
  | { page: "paper" }
  | { page: "sim" }
  | { page: "asset"; symbol: string }
  | { page: "login" }
  | { page: "account" }
  | { page: "fin" }
  | { page: "admin" };

function dataUrl(file: string): string {
  const base = String(import.meta.env.BASE_URL || "/");
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}data/${file.replace(/^\//, "")}`;
}

async function fetchJsonWithRetry<T>(file: string): Promise<T> {
  const url = dataUrl(file);
  let lastErr: Error | null = null;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { cache: i === 0 ? "no-cache" : "reload" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error("fetch_failed");
}

async function loadQuantData(): Promise<void> {
  try {
    quantData = await fetchJsonWithRetry<LatestPayload>("latest.json");
    quantError = null;
  } catch (e) {
    quantError = e instanceof Error ? e.message : String(e);
    quantData = null;
  }
}

async function loadNews(): Promise<void> {
  try {
    newsData = await fetchJsonWithRetry<NewsPayload>("ai-news.json");
  } catch {
    newsData = null;
  }
}

async function loadAnnouncements(): Promise<void> {
  try {
    announcementsData = await fetchJsonWithRetry<AnnouncementsPayload>("announcements.json");
  } catch {
    announcementsData = null;
  }
}

async function loadIwencaiNews(): Promise<void> {
  try {
    iwencaiNewsData = await fetchJsonWithRetry<IwencaiNewsPayload>("iwencai-news.json");
  } catch {
    iwencaiNewsData = null;
  }
}

async function loadIndices(): Promise<void> {
  try {
    indicesData = await fetchJsonWithRetry<IndicesPayload>("indices.json");
  } catch {
    indicesData = null;
  }
}

async function loadScreens(): Promise<void> {
  try {
    screensData = await fetchJsonWithRetry<ScreensPayload>("screens.json");
  } catch {
    screensData = null;
  }
}

async function loadFactors(): Promise<void> {
  try {
    factorsData = await fetchJsonWithRetry<FactorsPayload>("factors.json");
  } catch {
    factorsData = null;
  }
}

async function loadFactorsIc(): Promise<void> {
  try {
    factorsIcData = await fetchJsonWithRetry<FactorsIcPayload>("factors-ic.json");
  } catch {
    factorsIcData = null;
  }
}

async function loadAlphaLite(): Promise<void> {
  try {
    alphaLiteData = await fetchJsonWithRetry<AlphaLitePayload>(
      "factors-alpha-lite.json",
    );
  } catch {
    alphaLiteData = null;
  }
}

async function loadTransformerPv(): Promise<void> {
  try {
    transformerPvData = await fetchJsonWithRetry<TransformerPvProxyPayload>(
      "transformer-pv-proxy.json",
    );
  } catch {
    transformerPvData = null;
  }
}

async function loadRecipes(): Promise<void> {
  try {
    recipesData = await fetchJsonWithRetry<RecipesPayload>("recipes.json");
  } catch {
    recipesData = null;
  }
}

async function loadCalendar(): Promise<void> {
  try {
    calendarData = await fetchJsonWithRetry<CnCalendarPayload>("cn-calendar.json");
  } catch {
    calendarData = null;
  }
}

async function loadEtfMeta(): Promise<void> {
  try {
    etfMetaData = await fetchJsonWithRetry<EtfMetaPayload>("etf-meta.json");
  } catch {
    etfMetaData = null;
  }
}

async function loadAiRatings(): Promise<void> {
  try {
    aiRatingsData = await fetchJsonWithRetry<AiRatingsPayload>("ai-ratings.json");
  } catch {
    aiRatingsData = null;
  }
}

function renderLoadFail(root: HTMLElement, detail: string): void {
  root.innerHTML = `<main class="page load-fail">
    <p class="error">${t(locale, "loadErrorShort")} <span class="muted tiny">(${detail})</span></p>
    <p class="muted">${t(locale, "loadError")}</p>
    <div class="cta-row wrap">
      <button type="button" class="btn btn-ink" id="retry-quant">${t(locale, "loadRetry")}</button>
      <a class="btn btn-ghost" href="#/">${t(locale, "backHome")}</a>
    </div>
  </main>`;
  root.querySelector("#retry-quant")?.addEventListener("click", () => {
    void (async () => {
      await loadQuantData();
      await render();
    })();
  });
}

function parseRoute(): Route {
  const hash = location.hash.replace(/^#/, "") || "/";
  const path = (hash.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (path === "/" || path === "") return { page: "home" };
  if (path === "/compare") return { page: "compare" };
  if (path === "/learn") return { page: "learn" };
  if (path === "/handbook") return { page: "handbook" };
  if (path === "/tools") return { page: "tools" };
  if (path === "/news") return { page: "news" };
  if (path === "/quant") return { page: "quant" };
  if (path === "/paper") return { page: "paper" };
  if (path === "/sim") return { page: "sim" };
  if (path === "/login") return { page: "login" };
  if (path === "/account") return { page: "account" };
  if (path === "/fin") return { page: "fin" };
  if (path === "/admin") return { page: "admin" };
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
  if (requiresAuth(route.page) && !isLoggedIn()) {
    location.hash = `#/login`;
    return;
  }

  try {
    switch (route.page) {
      case "home":
        renderBrandHome(root, locale, aiRatingsData);
        break;
      case "login":
        renderLogin(root, locale);
        break;
      case "account":
        renderAccount(root, locale);
        break;
      case "fin":
        renderFinDesk(
          root,
          locale,
          quantData,
          screensData,
          factorsIcData,
          alphaLiteData,
          transformerPvData,
          announcementsData,
          iwencaiNewsData,
        );
        break;
      case "admin":
        renderAdmin(root, locale);
        break;
      case "compare": {
        const agents = await loadAgents();
        renderCompare(root, locale, agents, aiRatingsData);
        break;
      }
      case "learn":
        renderLearn(root, locale);
        break;
      case "handbook":
        renderHandbook(root, locale);
        break;
      case "tools":
        renderTools(
          root,
          locale,
          newsData,
          announcementsData,
          iwencaiNewsData,
          indicesData,
        );
        break;
      case "news":
        renderNews(root, locale, newsData, announcementsData, iwencaiNewsData);
        break;
      case "quant":
        if (quantError || !quantData) {
          renderLoadFail(root, quantError ?? "empty");
        } else {
          renderQuant(
            root,
            quantData,
            locale,
            indicesData,
            screensData,
            factorsData,
            recipesData,
            announcementsData,
            iwencaiNewsData,
            factorsIcData,
          );
        }
        break;
      case "paper":
        if (quantError || !quantData) {
          renderLoadFail(root, quantError ?? "empty");
        } else {
          renderPaper(root, quantData, locale, announcementsData, calendarData);
        }
        break;
      case "sim":
        if (quantError || !quantData) {
          renderLoadFail(root, quantError ?? "empty");
        } else {
          renderSim(root, quantData, locale);
        }
        break;
      case "asset":
        if (quantError || !quantData) {
          renderLoadFail(root, quantError ?? "empty");
        } else {
          renderAsset(
            root,
            quantData,
            route.symbol,
            locale,
            announcementsData,
            iwencaiNewsData,
            etfMetaData,
          );
        }
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    root.innerHTML = `<main class="page"><p class="error">${msg}</p></main>`;
  }

  bindLocale(root);
  bindShellChrome(root);
}

export async function startApp(): Promise<void> {
  locale = detectLocale();
  const fromConfirm = consumeAuthCallbackFromUrl();
  await Promise.all([
    loadQuantData(),
    loadNews(),
    loadAnnouncements(),
    loadIwencaiNews(),
    loadIndices(),
    loadScreens(),
    loadFactors(),
    loadFactorsIc(),
    loadAlphaLite(),
    loadTransformerPv(),
    loadRecipes(),
    loadCalendar(),
    loadEtfMeta(),
    loadAiRatings(),
  ]);
  if (fromConfirm && !location.hash.includes("/account")) {
    location.hash = "#/account";
  }
  await render();
  window.addEventListener("hashchange", () => {
    void render();
  });
}
