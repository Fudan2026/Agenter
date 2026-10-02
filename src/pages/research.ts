import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { markStage, setAcademyFlag } from "../lib/academy/curriculum";
import { destroyDeskChart, mountDeskChart } from "../lib/desk/chart-mount";
import {
  loadSelection,
  onSelection,
  saveSelection,
} from "../lib/desk/selection";
import { exposuresForRow, resolveBenchmark } from "../lib/factors/ff-proxy";
import { confluenceScore } from "../lib/signals/board";
import { esc } from "../lib/util/esc";
import type { NewsPayload } from "./tools";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload, SymbolRow } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

function biasLabel(locale: Locale, bias: "bull" | "bear" | "neutral"): string {
  if (bias === "bull") return t(locale, "biasBull");
  if (bias === "bear") return t(locale, "biasBear");
  return t(locale, "biasNeutral");
}

let unsubSelection: (() => void) | null = null;
let pinnedSymbols = new Set<string>();

export function cleanupResearchPage(): void {
  destroyDeskChart();
  unsubSelection?.();
  unsubSelection = null;
  pinnedSymbols = new Set();
}

export function renderResearch(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
  news?: NewsPayload | null,
): void {
  cleanupResearchPage();
  setAcademyFlag("briefRead");

  let selection = loadSelection();
  const rows = data.symbols.filter(
    (s) => s.signals && s.dataStatus !== "missing",
  );

  const paint = (): void => {
    const selRow =
      data.symbols.find((s) => s.symbol === selection.symbol) ?? rows[0];
    if (selRow && selection.symbol !== selRow.symbol) {
      selection = { symbol: selRow.symbol, asOf: selection.asOf };
      saveSelection(selection);
    }

    const bullets =
      locale === "zh" ? data.dailyReview.zh : data.dailyReview.en;
    const symTag = selRow?.symbol.split(".")[0] ?? "";
    const newsItems = (news?.items ?? []).filter((n) => {
      if (!n.tags?.length) return true;
      return n.tags.some(
        (tag) =>
          tag.includes(symTag) ||
          tag.includes(selRow?.symbol ?? "") ||
          tag.toLowerCase().includes((selRow?.symbol ?? "").toLowerCase()),
      );
    });

    const bench = resolveBenchmark(data.symbols);
    const factorHtml = selRow
      ? (() => {
          const ex = exposuresForRow(selRow, bench, data.symbols);
          return `<h3>${esc(t(locale, "factorBox"))}</h3>
            <p class="muted tiny">${esc(t(locale, "hmlProxyNote"))}</p>
            <ul class="tiny">
              <li>β ${ex.marketBeta == null ? "—" : ex.marketBeta.toFixed(2)} vs ${esc(ex.labels.market)}</li>
              <li>Size ${ex.sizeScore == null ? "—" : ex.sizeScore.toFixed(2)}</li>
              <li>Value ${ex.valueScore == null ? "—" : ex.valueScore.toFixed(2)}</li>
            </ul>`;
        })()
      : "";

    const watchlistHtml = rows
      .map((s) => {
        const name = locale === "zh" ? s.nameZh : s.nameEn;
        const active = s.symbol === selRow?.symbol ? "active" : "";
        const conf = confluenceScore(s);
        const sig = s.signals!;
        return `<tr class="ws-wl-row ${active}" data-symbol="${esc(s.symbol)}">
          <td><strong>${esc(s.symbol)}</strong><div class="muted tiny">${esc(name)}</div></td>
          <td><span class="chip chip-${sig.bias === "neutral" ? "neutral" : sig.bias === "bull" ? "bull" : "bear"}">${esc(biasLabel(locale, sig.bias))}</span></td>
          <td>${conf}</td>
        </tr>`;
      })
      .join("");

    const panesHtml = `
      <aside id="ws-watchlist" class="ws-pane">
        <h2>${esc(tk(locale, "navResearch"))}</h2>
        <div class="table-wrap"><table class="agent-table ws-wl-table">
          <thead><tr><th>Symbol</th><th>Bias</th><th>${esc(t(locale, "confluence"))}</th></tr></thead>
          <tbody>${watchlistHtml}</tbody>
        </table></div>
      </aside>
      <main id="ws-chart" class="ws-pane ws-pane-center">
        <div class="chart-shell"><div id="desk-chart-host" class="chart"></div></div>
        <p class="muted tiny">${esc(selRow?.symbol ?? "")}</p>
      </main>
      <aside id="ws-news" class="ws-pane">
        <h2>${esc(t(locale, "dailyReview"))}</h2>
        <ul class="tiny">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
        <h3>News</h3>
        <ul class="tiny news-compact">
          ${
            newsItems.length
              ? newsItems
                  .slice(0, 12)
                  .map((n) => {
                    const title = locale === "zh" ? n.titleZh : n.titleEn;
                    return `<li><time>${esc(n.date)}</time> ${esc(title)}</li>`;
                  })
                  .join("")
              : `<li class="muted">—</li>`
          }
        </ul>
      </aside>
      <section id="ws-factors" class="ws-pane ws-pane-bottom factor-box">${factorHtml}</section>
    `;

    root.innerHTML = renderWorkspaceShell({
      locale,
      active: "research",
      layout: "research",
      panesHtml,
      reportDate: data.reportDate,
      statusRight: selRow ? `${confluenceScore(selRow)} ${t(locale, "confluence")}` : "",
    });

    root.querySelectorAll<HTMLElement>(".ws-wl-row").forEach((tr) => {
      tr.addEventListener("click", () => {
        const sym = tr.dataset.symbol;
        if (!sym) return;
        selection = { symbol: sym };
        saveSelection(selection);
        pinnedSymbols.add(sym);
        if (pinnedSymbols.size >= 3) {
          markStage("research");
        }
        paint();
      });
    });

    const host = root.querySelector("#desk-chart-host") as HTMLElement | null;
    if (host && selRow) {
      mountDeskChart(host, selRow, { asOf: selection.asOf });
    }
  };

  unsubSelection = onSelection((s) => {
    selection = s;
    paint();
  });

  paint();
  document.title = `${tk(locale, "navResearch")} · ${tk(locale, "quantOs")}`;
}
