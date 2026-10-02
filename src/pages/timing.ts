import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { setAcademyFlag } from "../lib/academy/curriculum";
import { destroyDeskChart, mountDeskChart } from "../lib/desk/chart-mount";
import {
  loadSelection,
  onSelection,
  saveSelection,
} from "../lib/desk/selection";
import { loadPaperState } from "../lib/paper/journal";
import {
  isCnTradingDay,
  sessionAgenda,
  type AgendaItem,
} from "../lib/timing/calendar";
import { classifyRegime } from "../lib/timing/regime";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload, SymbolRow } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

const TIMING_AGENDA_KEY = "agenter.timing.agenda.v1";

function loadExtraAgendaSymbols(): string[] {
  try {
    const raw = localStorage.getItem(TIMING_AGENDA_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

function monthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getUTCMonth() === month) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function paperHref(item: AgendaItem): string {
  const q = new URLSearchParams({
    symbol: item.symbol,
    signal: item.signalDate,
  });
  return `#/paper?${q.toString()}`;
}

let unsubSelection: (() => void) | null = null;

export function cleanupTimingPage(): void {
  destroyDeskChart();
  unsubSelection?.();
  unsubSelection = null;
}

export function renderTiming(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  cleanupTimingPage();
  setAcademyFlag("regimeViewed");

  let selection = loadSelection();
  const [ry, rm] = data.reportDate.split("-").map(Number);
  let calYear = ry;
  let calMonth = rm - 1;

  const tradeable = data.symbols.filter((s) => s.dataStatus !== "missing");
  const baseAgenda = sessionAgenda(data.reportDate, tradeable);
  const extraSyms = loadExtraAgendaSymbols();
  const extraRows = tradeable.filter((s) => extraSyms.includes(s.symbol));
  const extraAgenda = sessionAgenda(data.reportDate, extraRows);
  const agendaMap = new Map<string, AgendaItem>();
  for (const a of [...baseAgenda, ...extraAgenda]) {
    if (!agendaMap.has(a.symbol) || a.confluence > (agendaMap.get(a.symbol)?.confluence ?? 0)) {
      agendaMap.set(a.symbol, a);
    }
  }
  const agenda = [...agendaMap.values()].sort(
    (a, b) => b.confluence - a.confluence,
  );

  const paperState = loadPaperState();
  const costOff = paperState.costModelEnabled === false;
  const costWarn = costOff
    ? `<div class="banner-stale">${esc(t(locale, "paperCostOffWarn"))} · ${locale === "zh" ? "议程仅供参考，不可当作可执行建议" : "Agenda is informational only — not actionable with costs OFF"}</div>`
    : "";

  const paint = (): void => {
    const selRow =
      data.symbols.find((s) => s.symbol === selection.symbol) ?? tradeable[0];
    if (selRow && selection.symbol !== selRow.symbol) {
      selection = { symbol: selRow.symbol };
      saveSelection(selection);
    }

    const closes = selRow?.candles.map((c) => c.close) ?? [];
    const regime = classifyRegime(closes);

    const days = monthDays(calYear, calMonth);
    const calHtml = days
      .map((d) => {
        const trading = isCnTradingDay(d);
        const cls = trading ? "cal-trading" : "cal-off";
        const sel = d === data.reportDate ? " cal-today" : "";
        return `<span class="cal-day ${cls}${sel}" title="${esc(d)}">${d.slice(8)}</span>`;
      })
      .join("");

    const sessionList = tradeable
      .slice(0, 8)
      .map((s) => {
        const active = s.symbol === selRow?.symbol ? "active" : "";
        return `<li class="${active}"><button type="button" class="btn-link" data-sym="${esc(s.symbol)}">${esc(s.symbol)}</button></li>`;
      })
      .join("");

    const agendaHtml = agenda
      .slice(0, 20)
      .map((a) => {
        const actionable =
          !costOff && a.sideHint !== "hold"
            ? `<a href="${esc(paperHref(a))}">${esc(tk(locale, "paperThese"))}</a>`
            : `<span class="muted">${esc(a.sideHint)}</span>`;
        return `<tr>
          <td>${esc(a.symbol)}</td>
          <td>${esc(a.sideHint)}</td>
          <td>${a.confluence}</td>
          <td class="tiny">${esc(a.reason)}</td>
          <td>${actionable}</td>
        </tr>`;
      })
      .join("");

    const panesHtml = `
      ${costWarn}
      <aside id="ws-calendar" class="ws-pane">
        <h2>${esc(tk(locale, "timingTitle"))}</h2>
        <div class="cal-nav cta-row">
          <button type="button" class="btn" id="cal-prev">‹</button>
          <span>${calYear}-${String(calMonth + 1).padStart(2, "0")}</span>
          <button type="button" class="btn" id="cal-next">›</button>
        </div>
        <div class="cal-grid">${calHtml}</div>
        <ul class="session-list">${sessionList}</ul>
      </aside>
      <main id="ws-chart" class="ws-pane ws-pane-center">
        <div class="chart-shell"><div id="timing-chart" class="chart"></div></div>
      </main>
      <aside id="ws-agenda" class="ws-pane">
        <h3>${esc(tk(locale, "regimeLabel"))}</h3>
        <p><strong>${esc(regime.label)}</strong> · ${esc(tk(locale, "timingScore"))} ${regime.timingScore}</p>
        <div class="cta-row">
          <button type="button" class="btn" id="timing-csv">${locale === "zh" ? "导出 CSV" : "Export CSV"}</button>
        </div>
        <div class="table-wrap"><table class="agent-table">
          <thead><tr><th>Symbol</th><th>Side</th><th>Conf</th><th></th><th></th></tr></thead>
          <tbody>${agendaHtml}</tbody>
        </table></div>
      </aside>
    `;

    root.innerHTML = renderWorkspaceShell({
      locale,
      active: "timing",
      layout: "timing",
      panesHtml,
      reportDate: data.reportDate,
      statusRight: `${tk(locale, "timingScore")} ${regime.timingScore}`,
    });

    root.querySelector("#cal-prev")?.addEventListener("click", () => {
      calMonth -= 1;
      if (calMonth < 0) {
        calMonth = 11;
        calYear -= 1;
      }
      paint();
    });
    root.querySelector("#cal-next")?.addEventListener("click", () => {
      calMonth += 1;
      if (calMonth > 11) {
        calMonth = 0;
        calYear += 1;
      }
      paint();
    });
    root.querySelectorAll<HTMLButtonElement>("[data-sym]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sym = btn.dataset.sym;
        if (sym) {
          selection = { symbol: sym };
          saveSelection(selection);
          paint();
        }
      });
    });
    root.querySelector("#timing-csv")?.addEventListener("click", () => {
      const lines = [
        "symbol,side_hint,signal_date,confluence,reason",
        ...agenda.map(
          (a) =>
            `${a.symbol},${a.sideHint},${a.signalDate},${a.confluence},${csvEscape(a.reason)}`,
        ),
      ];
      downloadCsv(lines.join("\n"), `agenter-timing-${data.reportDate}.csv`);
    });

    const host = root.querySelector("#timing-chart") as HTMLElement | null;
    if (host && selRow) mountDeskChart(host, selRow);
  };

  unsubSelection = onSelection((s) => {
    selection = s;
    paint();
  });

  paint();
  document.title = `${tk(locale, "navTiming")} · ${tk(locale, "quantOs")}`;
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(text: string, name: string): void {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
