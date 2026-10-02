import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { setAcademyFlag } from "../lib/academy/curriculum";
import { saveSelection } from "../lib/desk/selection";
import { defaultSignalDate } from "../lib/paper/equity";
import {
  applyScreenerFilters,
  sortScreener,
  type ScreenerFilters,
} from "../lib/screener/filters";
import { confluenceScore } from "../lib/signals/board";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload, SymbolRow } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

const PRESET_KEY = "agenter.screener.preset.v1";
const TIMING_AGENDA_KEY = "agenter.timing.agenda.v1";

function loadPreset(): ScreenerFilters {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (raw) return JSON.parse(raw) as ScreenerFilters;
  } catch {
    /* ignore */
  }
  return { bias: "any", confluenceMin: 0 };
}

function savePreset(f: ScreenerFilters): void {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(f));
    setAcademyFlag("screenerUsed");
  } catch {
    /* ignore */
  }
}

function addToTimingAgenda(symbol: string): void {
  try {
    const raw = localStorage.getItem(TIMING_AGENDA_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(symbol)) list.push(symbol);
    localStorage.setItem(TIMING_AGENDA_KEY, JSON.stringify(list.slice(-32)));
  } catch {
    /* ignore */
  }
}

function signalDateForRow(row: SymbolRow): string {
  const lastPat = row.recentPatterns.at(-1)?.date;
  if (lastPat && row.candles.some((c) => c.date === lastPat)) return lastPat;
  return defaultSignalDate(row.candles) ?? row.candles.at(-1)?.date ?? "";
}

function paperHref(symbol: string, signalDate?: string): string {
  const q = new URLSearchParams({ symbol });
  if (signalDate) q.set("signal", signalDate);
  return `#/paper?${q.toString()}`;
}

export function renderScreener(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  let filters = loadPreset();
  let sortKey: "confluence" | "pct1d" | "symbol" | "rsi" = "confluence";
  let sortDir: "asc" | "desc" = "desc";

  const baseRows = data.symbols.filter(
    (s) => s.signals && s.dataStatus !== "missing",
  );

  const paint = (): void => {
    let rows = applyScreenerFilters(baseRows, filters);
    rows = sortScreener(rows, sortKey, sortDir);

    const panesHtml = `
      <section class="ws-pane ws-pane-full">
        <h1>${esc(tk(locale, "screenerTitle"))}</h1>
        <div class="filter-bar cta-row wrap">
          <label>${esc(t(locale, "filterBias"))}
            <select id="scr-bias">
              ${["any", "bull", "bear", "neutral"]
                .map(
                  (v) =>
                    `<option value="${v}"${filters.bias === v ? " selected" : ""}>${esc(v)}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>${esc(t(locale, "confluence"))} ≥
            <input type="number" id="scr-conf" min="0" max="100" value="${filters.confluenceMin ?? 0}" />
          </label>
          <label>Sort
            <select id="scr-sort">
              <option value="confluence"${sortKey === "confluence" ? " selected" : ""}>${esc(t(locale, "confluence"))}</option>
              <option value="pct1d"${sortKey === "pct1d" ? " selected" : ""}>1d</option>
              <option value="rsi"${sortKey === "rsi" ? " selected" : ""}>RSI</option>
              <option value="symbol"${sortKey === "symbol" ? " selected" : ""}>Symbol</option>
            </select>
          </label>
          <label>Dir
            <select id="scr-dir">
              <option value="desc"${sortDir === "desc" ? " selected" : ""}>↓</option>
              <option value="asc"${sortDir === "asc" ? " selected" : ""}>↑</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary" id="scr-save">${locale === "zh" ? "保存预设" : "Save preset"}</button>
        </div>
        <div class="table-wrap"><table class="agent-table">
          <thead><tr>
            <th>Symbol</th><th>${esc(t(locale, "confluence"))}</th><th>RSI</th><th></th>
          </tr></thead>
          <tbody>
            ${rows
              .map((s) => {
                const sig = s.signals!;
                const sigDate = signalDateForRow(s);
                return `<tr>
                  <td>${esc(s.symbol)}</td>
                  <td>${confluenceScore(s)}</td>
                  <td>${sig.rsi14 == null ? "—" : sig.rsi14.toFixed(1)}</td>
                  <td class="cta-row wrap tiny">
                    <button type="button" class="btn" data-focus="${esc(s.symbol)}">${locale === "zh" ? "聚焦" : "Focus"}</button>
                    <a class="btn" href="${esc(paperHref(s.symbol, sigDate))}">${esc(t(locale, "openPaper"))}</a>
                    <button type="button" class="btn" data-timing="${esc(s.symbol)}">${locale === "zh" ? "加入择时" : "Add timing"}</button>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>
      </section>
    `;

    root.innerHTML = renderWorkspaceShell({
      locale,
      active: "screener",
      layout: "review",
      panesHtml,
      reportDate: data.reportDate,
    });

    root.querySelector("#scr-bias")?.addEventListener("change", (e) => {
      filters = {
        ...filters,
        bias: (e.target as HTMLSelectElement).value as ScreenerFilters["bias"],
      };
      paint();
    });
    root.querySelector("#scr-conf")?.addEventListener("change", (e) => {
      filters = {
        ...filters,
        confluenceMin: Number((e.target as HTMLInputElement).value) || 0,
      };
      paint();
    });
    root.querySelector("#scr-sort")?.addEventListener("change", (e) => {
      sortKey = (e.target as HTMLSelectElement)
        .value as typeof sortKey;
      paint();
    });
    root.querySelector("#scr-dir")?.addEventListener("change", (e) => {
      sortDir = (e.target as HTMLSelectElement).value as typeof sortDir;
      paint();
    });
    root.querySelector("#scr-save")?.addEventListener("click", () => {
      savePreset(filters);
      paint();
    });
    root.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sym = btn.dataset.focus;
        if (sym) saveSelection({ symbol: sym });
      });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-timing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sym = btn.dataset.timing;
        if (sym) addToTimingAgenda(sym);
      });
    });
  };

  paint();
  document.title = `${tk(locale, "navScreener")} · ${tk(locale, "quantOs")}`;
}
