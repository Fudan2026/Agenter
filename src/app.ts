import { detectLocale, setLocale, type Locale } from "./i18n/strings";
import { cleanupAssetPage, renderAsset } from "./pages/asset";
import { renderHome } from "./pages/home";
import type { LatestPayload } from "./pages/types";

let data: LatestPayload | null = null;
let locale: Locale = detectLocale();
let loadError: string | null = null;

async function loadData(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/latest.json`, {
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json()) as LatestPayload;
    loadError = null;
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    data = null;
  }
}

function parseRoute(): { page: "home" } | { page: "asset"; symbol: string } {
  const hash = location.hash.replace(/^#/, "") || "/";
  const asset = hash.match(/^\/asset\/(.+)$/);
  if (asset) {
    return { page: "asset", symbol: decodeURIComponent(asset[1]) };
  }
  return { page: "home" };
}

function bindLocale(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.locale as Locale;
      if (next !== "zh" && next !== "en") return;
      locale = next;
      setLocale(locale);
      render();
    });
  });
}

function render(): void {
  const root = document.getElementById("app");
  if (!root) return;
  cleanupAssetPage();

  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";

  if (loadError || !data) {
    root.innerHTML = `<main class="page"><p class="error">Failed to load data: ${loadError ?? "empty"}</p></main>`;
    return;
  }

  const route = parseRoute();
  if (route.page === "asset") {
    renderAsset(root, data, route.symbol, locale);
  } else {
    renderHome(root, data, locale);
  }
  bindLocale(root);

  const title =
    locale === "zh" ? data.title.zh : data.title.en;
  document.title = `${title} · Agenter`;
}

export async function startApp(): Promise<void> {
  locale = detectLocale();
  await loadData();
  render();
  window.addEventListener("hashchange", () => render());
}
