/** Hash-route query helpers for `#/path?a=1` SPA deep-links. */

export function readHashQuery(hash = location.hash): URLSearchParams {
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

/** Build `#/path?k=v` (path may be `/news` or `#/news`). Empty params → bare path. */
export function withHashQuery(
  path: string,
  params: Record<string, string | null | undefined>,
): string {
  const bare = path.replace(/^#/, "");
  const normalized = bare.startsWith("/") ? bare : `/${bare}`;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `#${normalized}?${qs}` : `#${normalized}`;
}

/** Post-paint scroll + brief highlight for deep-link targets. */
export function scrollToId(
  id: string,
  opts?: { highlightMs?: number; behavior?: ScrollBehavior },
): void {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const behavior = opts?.behavior ?? "smooth";
  const highlightMs = opts?.highlightMs ?? 1600;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior, block: "start" });
    el.classList.add("deeplink-flash");
    window.setTimeout(() => el.classList.remove("deeplink-flash"), highlightMs);
  });
}

/** Map News `?section=` values to element ids. */
export const NEWS_SECTION_IDS: Record<string, string> = {
  ai: "news-ai",
  filings: "news-filings",
  iwencai: "news-iwencai",
};

/** Map Paper `?panel=` values to element ids. */
export const PAPER_PANEL_IDS: Record<string, string> = {
  export: "ws-ops",
  exec: "ws-exec",
  ticket: "ws-ticket",
  blotter: "ws-journal",
  audit: "ws-audit",
  risk: "ws-risk",
  reconcile: "ws-reconcile",
  cockpit: "ws-cockpit",
  positions: "ws-positions",
};

/** Map Quant `?panel=` values to element ids. */
export const QUANT_PANEL_IDS: Record<string, string> = {
  studio: "quant-studio",
  committee: "quant-committee",
  lab: "quant-lab",
  ic: "quant-ic",
  screens: "quant-screens",
  signals: "quant-signals",
  filings: "quant-filings",
  macro: "quant-macro",
  rotation: "quant-rotation",
  review: "quant-review",
};
