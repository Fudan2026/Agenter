import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  loadAcademy,
  readinessScore,
  setAcademyFlag,
} from "../lib/academy/curriculum";
import { buildChecklist, checklistToCsv } from "../lib/paper/export";
import { loadPaperState } from "../lib/paper/journal";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

export function renderLiveRehearsal(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  const state = loadPaperState();
  const academy = loadAcademy();
  const done = Object.values(academy).filter(Boolean).length;
  const checklist = buildChecklist(state, locale);
  const score = readinessScore({
    costOn: state.costModelEnabled !== false,
    gatesUnderstood: true,
    academyDone: done,
    labNotRed: true,
    checklistNonEmpty: checklist.length > 0,
  });

  const checklistHtml = checklist
    .map(
      (r) =>
        `<tr><td>${esc(r.symbol)}</td><td>${esc(r.side)}</td><td>${r.qty}</td><td class="tiny">${esc(r.notes)}</td></tr>`,
    )
    .join("");

  const panesHtml = `
    <section class="ws-pane ws-pane-full live-rehearsal">
      <div class="banner-stale"><strong>${esc(tk(locale, "noBrokerSubmit"))}</strong></div>
      <h1>${esc(tk(locale, "liveRehearsalTitle"))}</h1>
      <div class="stats-row">
        <div class="stat"><span class="stat-n">${score}</span><span class="stat-l">${esc(tk(locale, "readinessScore"))}</span></div>
        <div class="stat"><span class="stat-n">${done}/7</span><span class="stat-l">${esc(tk(locale, "academyProgress"))}</span></div>
      </div>
      <div class="cta-row wrap no-print">
        <button type="button" class="btn btn-primary" id="lr-export-csv">${locale === "zh" ? "导出清单 CSV" : "Export checklist CSV"}</button>
        <button type="button" class="btn" id="lr-print">${locale === "zh" ? "打印视图" : "Print view"}</button>
      </div>
      <div id="lr-print-area">
        <h2>${locale === "zh" ? "券商执行清单" : "Broker execution checklist"}</h2>
        <p class="muted tiny">${esc(data.reportDate)} · ${esc(t(locale, "paperDisclaimer"))}</p>
        <div class="table-wrap"><table class="agent-table">
          <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Notes</th></tr></thead>
          <tbody>${checklistHtml || `<tr><td colspan="4" class="muted">—</td></tr>`}</tbody>
        </table></div>
        <ul class="tiny muted">
          <li>${esc(t(locale, "paperCostOn"))}: ${state.costModelEnabled === false ? esc(t(locale, "paperCostOffWarn")) : "ON"}</li>
          <li>${esc(t(locale, "survivorshipBanner"))}</li>
        </ul>
      </div>
    </section>
  `;

  root.innerHTML = renderWorkspaceShell({
    locale,
    active: "live-rehearsal",
    layout: "review",
    panesHtml,
    reportDate: data.reportDate,
    statusRight: `${tk(locale, "readinessScore")} ${score}`,
  });

  root.querySelector("#lr-export-csv")?.addEventListener("click", () => {
    setAcademyFlag("liveChecklist");
    const csv = checklistToCsv(checklist);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenter-live-checklist-${data.reportDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
  root.querySelector("#lr-print")?.addEventListener("click", () => {
    window.print();
  });

  document.title = `${tk(locale, "liveRehearsalTitle")} · ${tk(locale, "quantOs")}`;
}
