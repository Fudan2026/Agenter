import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  loadAcademy,
  markStage,
  validateStage,
  ACADEMY_STAGES,
  type AcademyStageId,
} from "../lib/academy/curriculum";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

const STAGE_HREF: Record<AcademyStageId, string> = {
  research: "#/research",
  screener: "#/screener",
  timing: "#/timing",
  lab: "#/lab",
  paper: "#/paper",
  replay: "#/replay",
  live: "#/live-rehearsal",
};

export function renderAcademy(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  const progress = loadAcademy();
  const doneCount = ACADEMY_STAGES.filter((s) => progress[s.id]).length;

  const rows = ACADEMY_STAGES.map((stage) => {
    const title = locale === "zh" ? stage.titleZh : stage.titleEn;
    const desc = locale === "zh" ? stage.descZh : stage.descEn;
    const completed = progress[stage.id];
    const canMark = validateStage(stage.id);
    const status = completed
      ? locale === "zh"
        ? "已完成"
        : "Complete"
      : canMark
        ? locale === "zh"
          ? "可确认"
          : "Ready to confirm"
        : locale === "zh"
          ? "进行中"
          : "In progress";
    return `<tr>
      <td><a href="${STAGE_HREF[stage.id]}"><strong>${esc(title)}</strong></a><div class="muted tiny">${esc(desc)}</div></td>
      <td>${esc(status)}</td>
      <td>
        ${
          completed
            ? `<span class="chip chip-bull">✓</span>`
            : canMark
              ? `<button type="button" class="btn btn-primary" data-mark="${esc(stage.id)}">${locale === "zh" ? "标记完成" : "Mark complete"}</button>`
              : `<span class="muted">—</span>`
        }
      </td>
    </tr>`;
  }).join("");

  const panesHtml = `
    <section class="ws-pane ws-pane-full">
      <h1>${esc(tk(locale, "academyTitle"))}</h1>
      <p class="lead">${esc(tk(locale, "academyProgress"))}: ${doneCount}/${ACADEMY_STAGES.length}</p>
      <div class="table-wrap"><table class="agent-table">
        <thead><tr><th>Stage</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>
  `;

  root.innerHTML = renderWorkspaceShell({
    locale,
    active: "academy",
    layout: "review",
    panesHtml,
    reportDate: data.reportDate,
  });

  root.querySelectorAll<HTMLButtonElement>("[data-mark]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.mark as AcademyStageId | undefined;
      if (!id || !validateStage(id)) return;
      markStage(id);
      renderAcademy(root, data, locale);
    });
  });

  document.title = `${tk(locale, "navAcademy")} · ${tk(locale, "quantOs")}`;
}
