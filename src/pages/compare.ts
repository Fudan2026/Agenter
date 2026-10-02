import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import type {
  AgentCategory,
  AgentRecord,
  AgentRegion,
  AgentsPayload,
  DimensionId,
} from "../lib/agents/types";
import { DIMENSION_IDS } from "../lib/agents/types";
import {
  DEFAULT_WEIGHTS,
  encodeCompareShare,
  HARNESS_PRESETS,
  loadPicks,
  loadWeights,
  parseCompareShare,
  savePicks,
  saveWeights,
  weightedScore,
} from "../lib/harness/weights";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

const DIM_LABEL: Record<
  DimensionId,
  | "dimCoding"
  | "dimToolUse"
  | "dimContext"
  | "dimPrivacy"
  | "dimCost"
  | "dimCnAccess"
  | "dimLearn"
  | "dimResearchOrch"
  | "dimFactorAlpha"
  | "dimMemoryReflect"
  | "dimRiskCtrl"
  | "dimBacktestRigor"
> = {
  codingAbility: "dimCoding",
  toolUse: "dimToolUse",
  contextMemory: "dimContext",
  privacyControl: "dimPrivacy",
  costEfficiency: "dimCost",
  cnAccessibility: "dimCnAccess",
  learningCurve: "dimLearn",
  researchOrchestration: "dimResearchOrch",
  factorAlphaTooling: "dimFactorAlpha",
  memoryReflection: "dimMemoryReflect",
  riskControls: "dimRiskCtrl",
  backtestRigor: "dimBacktestRigor",
};

const CAT_LABEL: Record<
  AgentCategory,
  | "catCoding"
  | "catChat"
  | "catResearch"
  | "catImage"
  | "catTooling"
  | "catQuant"
> = {
  coding: "catCoding",
  chat: "catChat",
  research: "catResearch",
  image: "catImage",
  tooling: "catTooling",
  quant: "catQuant",
};

let agentsCache: AgentRecord[] | null = null;

export async function loadAgents(): Promise<AgentRecord[]> {
  if (agentsCache) return agentsCache;
  const base = import.meta.env.BASE_URL;
  const [codingRes, quantRes] = await Promise.all([
    fetch(`${base}data/agents.json`, { cache: "no-cache" }),
    fetch(`${base}data/quant-agents.json`, { cache: "no-cache" }),
  ]);
  if (!codingRes.ok) throw new Error(`agents.json HTTP ${codingRes.status}`);
  const codingPayload = (await codingRes.json()) as AgentsPayload;
  let quantAgents: AgentRecord[] = [];
  if (quantRes.ok) {
    try {
      const quantPayload = (await quantRes.json()) as AgentsPayload;
      quantAgents = quantPayload.agents ?? [];
    } catch {
      quantAgents = [];
    }
  }
  const byId = new Map<string, AgentRecord>();
  for (const a of [...codingPayload.agents, ...quantAgents]) {
    if (!byId.has(a.id)) byId.set(a.id, a);
  }
  agentsCache = [...byId.values()];
  return agentsCache;
}

function cellEqual(a: string, b: string): boolean {
  return a === b;
}

export function renderCompare(
  root: HTMLElement,
  locale: Locale,
  agents: AgentRecord[],
): void {
  const shared = parseCompareShare(location.hash);
  let region: AgentRegion | "all" = "all";
  let category: AgentCategory | "all" = "all";
  let search = "";
  let pricing = "";
  let toolsQ = "";
  let diffsOnly = false;
  let picks = new Set(shared.ids.length ? shared.ids : loadPicks());
  let weights = shared.weights ?? loadWeights();
  let flash = "";

  const paint = (): void => {
    const filtered = agents.filter((a) => {
      if (region !== "all" && a.region !== region) return false;
      if (category !== "all" && a.category !== category) return false;
      if (
        pricing &&
        !a.pricingBand.toLowerCase().includes(pricing.toLowerCase())
      )
        return false;
      if (toolsQ && !a.toolsMcp.toLowerCase().includes(toolsQ.toLowerCase()))
        return false;
      if (search) {
        const hay =
          `${a.nameZh} ${a.nameEn} ${a.id} ${a.notesEn ?? ""} ${a.notesZh ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });

    const ranked = agents
      .filter((a) => picks.has(a.id))
      .map((a) => ({ agent: a, score: weightedScore(a.scores, weights) }))
      .sort((a, b) => b.score - a.score);

    const cols = ranked.map((r) => r.agent);
    const scoreById = Object.fromEntries(
      ranked.map((r) => [r.agent.id, r.score]),
    );

    type MatrixRow = {
      key: string;
      label: string;
      values: string[];
      numeric?: number[];
    };

    const harnessRows: MatrixRow[] = DIMENSION_IDS.map((id) => {
      const numeric = cols.map((a) => a.scores[id] ?? 0);
      return {
        key: id,
        label: t(locale, DIM_LABEL[id]),
        values: numeric.map(String),
        numeric,
      };
    });

    const profileRows: MatrixRow[] = [
      {
        key: "region",
        label: t(locale, "filterRegion"),
        values: cols.map((a) => a.region),
      },
      {
        key: "category",
        label: t(locale, "filterCategory"),
        values: cols.map((a) => t(locale, CAT_LABEL[a.category])),
      },
      {
        key: "pricing",
        label: t(locale, "filterPricing"),
        values: cols.map((a) => a.pricingBand || "—"),
      },
      {
        key: "context",
        label: "Context",
        values: cols.map((a) => a.contextWindow || "—"),
      },
      {
        key: "tools",
        label: t(locale, "filterTools"),
        values: cols.map((a) =>
          a.toolsMcp && a.toolsMcp !== "—" ? "yes" : "—",
        ),
      },
      {
        key: "privacy",
        label: t(locale, "dimPrivacy"),
        values: cols.map((a) => a.privacy || "—"),
      },
    ];

    const rowVisible = (row: MatrixRow): boolean => {
      if (!diffsOnly || row.values.length < 2) return true;
      return !row.values.every((v) => cellEqual(v, row.values[0]));
    };

    const renderRow = (row: MatrixRow): string => {
      if (!rowVisible(row)) return "";
      const max =
        row.numeric && row.numeric.length
          ? Math.max(...row.numeric)
          : null;
      return `<tr>
        <th scope="row">${esc(row.label)}</th>
        ${row.values
          .map((v, i) => {
            const best =
              max != null && row.numeric && row.numeric[i] === max
                ? "best"
                : "";
            return `<td class="${best}">${esc(v)}</td>`;
          })
          .join("")}
      </tr>`;
    };

    const stickyCols = [0, 1, 2, 3]
      .map((i) => {
        const col = cols[i];
        if (!col) {
          return `<div class="compare-slot empty">
            <label>${esc(t(locale, "compareAddAgent"))}
              <select data-add-slot="${i}">
                <option value="">—</option>
                ${filtered
                  .filter((a) => !picks.has(a.id))
                  .map((a) => {
                    const name = locale === "zh" ? a.nameZh : a.nameEn;
                    return `<option value="${esc(a.id)}">${esc(name)}</option>`;
                  })
                  .join("")}
              </select>
            </label>
          </div>`;
        }
        const name = locale === "zh" ? col.nameZh : col.nameEn;
        return `<div class="compare-slot">
          <button type="button" class="slot-x" data-remove="${esc(col.id)}" aria-label="remove">×</button>
          <div class="slot-name">${esc(name)}</div>
          <div class="score-big">${scoreById[col.id].toFixed(2)}</div>
          <label class="tiny">${esc(t(locale, "compareAddAgent"))}
            <select data-swap="${esc(col.id)}">
              ${agents
                .map((a) => {
                  const n = locale === "zh" ? a.nameZh : a.nameEn;
                  const sel = a.id === col.id ? " selected" : "";
                  const disabled =
                    picks.has(a.id) && a.id !== col.id ? " disabled" : "";
                  return `<option value="${esc(a.id)}"${sel}${disabled}>${esc(n)}</option>`;
                })
                .join("")}
            </select>
          </label>
        </div>`;
      })
      .join("");

    const body = `
      <h1>${esc(t(locale, "compareTitle"))}</h1>
      <p class="lead">${esc(t(locale, "compareLead"))}</p>
      <p class="muted tiny">${esc(t(locale, "editorialNote"))}</p>
      <p class="muted tiny">${esc(t(locale, "compareQuantNote"))}</p>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}

      <section class="harness presets-first">
        <h2>${esc(t(locale, "compareHelpChoose"))}</h2>
        <div class="cta-row wrap preset-row">
          <button type="button" class="btn" data-preset="coding">${esc(t(locale, "presetCoding"))}</button>
          <button type="button" class="btn" data-preset="cn">${esc(t(locale, "presetCn"))}</button>
          <button type="button" class="btn" data-preset="privacy">${esc(t(locale, "presetPrivacy"))}</button>
          <button type="button" class="btn" data-preset="research">${esc(t(locale, "presetResearch"))}</button>
          <button type="button" class="btn" data-preset="quant">${esc(t(locale, "presetQuant"))}</button>
          <button type="button" class="btn" id="reset-weights">${esc(t(locale, "resetWeights"))}</button>
          <button type="button" class="btn btn-primary" id="copy-share">${esc(t(locale, "copyShare"))}</button>
          <button type="button" class="btn" id="export-scores">${esc(t(locale, "exportScores"))}</button>
        </div>
        <div class="weight-grid">
          ${DIMENSION_IDS.map((id) => {
            return `<label class="weight-row">${esc(t(locale, DIM_LABEL[id]))}
              <input type="range" min="0" max="2" step="0.1" data-weight="${id}" value="${weights[id]}" />
              <span class="weight-val" data-weight-val="${id}">${weights[id].toFixed(1)}</span>
            </label>`;
          }).join("")}
        </div>
      </section>

      <div id="compare-sticky" class="compare-sticky">${stickyCols}</div>

      <section>
        <div class="cta-row wrap">
          <h2 style="margin:0;flex:1">${esc(t(locale, "compareMatrix"))}</h2>
          <label class="tiny"><input type="checkbox" id="diff-only" ${diffsOnly ? "checked" : ""}/> ${esc(t(locale, "compareDiffsOnly"))}</label>
        </div>
        ${
          cols.length < 2
            ? `<p class="muted">${esc(t(locale, "emptyCompare"))}</p>`
            : `<div class="table-wrap compare-matrix-wrap"><table class="agent-table compare-matrix" id="compare-matrix">
                <thead><tr><th></th>${cols
                  .map((a) => {
                    const name = locale === "zh" ? a.nameZh : a.nameEn;
                    return `<th>${esc(name)}</th>`;
                  })
                  .join("")}</tr></thead>
                <tbody>
                  <tr class="group-row"><th colspan="${cols.length + 1}">Harness</th></tr>
                  ${harnessRows.map(renderRow).join("")}
                  <tr class="group-row"><th colspan="${cols.length + 1}">Profile</th></tr>
                  ${profileRows.map(renderRow).join("")}
                </tbody>
              </table></div>`
        }
      </section>

      <details class="catalog-details">
        <summary>${esc(t(locale, "compareBrowseCatalog"))}</summary>
        <div class="filters">
          <label>${esc(t(locale, "searchAgents"))}
            <input type="search" id="f-search" value="${esc(search)}" placeholder="Cursor / Kimi…" />
          </label>
          <label>${esc(t(locale, "filterRegion"))}
            <select id="f-region">
              <option value="all"${region === "all" ? " selected" : ""}>${esc(t(locale, "filterAll"))}</option>
              <option value="CN"${region === "CN" ? " selected" : ""}>CN</option>
              <option value="US"${region === "US" ? " selected" : ""}>US</option>
              <option value="Global"${region === "Global" ? " selected" : ""}>Global</option>
            </select>
          </label>
          <label>${esc(t(locale, "filterCategory"))}
            <select id="f-cat">
              <option value="all"${category === "all" ? " selected" : ""}>${esc(t(locale, "filterAll"))}</option>
              ${(Object.keys(CAT_LABEL) as AgentCategory[])
                .map(
                  (c) =>
                    `<option value="${c}"${category === c ? " selected" : ""}>${esc(t(locale, CAT_LABEL[c]))}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label>${esc(t(locale, "filterPricing"))}
            <input type="text" id="f-pricing" value="${esc(pricing)}" />
          </label>
          <label>${esc(t(locale, "filterTools"))}
            <input type="text" id="f-tools" value="${esc(toolsQ)}" />
          </label>
        </div>
        <div class="table-wrap sticky-first">
          <table class="agent-table">
            <thead><tr><th></th><th>Name</th><th>${esc(t(locale, "weightedScore"))}</th></tr></thead>
            <tbody>
              ${filtered
                .map((a) => {
                  const name = locale === "zh" ? a.nameZh : a.nameEn;
                  const score = weightedScore(a.scores, weights);
                  return `<tr>
                    <td><input type="checkbox" data-pick="${esc(a.id)}" ${picks.has(a.id) ? "checked" : ""} /></td>
                    <td><strong>${esc(name)}</strong><div class="muted tiny">${esc(a.region)} · ${esc(a.pricingBand)}</div></td>
                    <td>${score.toFixed(2)}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </details>
    `;

    root.innerHTML = renderShell(locale, "compare", body);
    document.title = `${t(locale, "compareTitle")} · Agenter`;

    const bindInput = (sel: string, fn: (v: string) => void) => {
      root.querySelector(sel)?.addEventListener("input", (e) => {
        fn((e.target as HTMLInputElement).value);
        paint();
      });
      root.querySelector(sel)?.addEventListener("change", (e) => {
        fn((e.target as HTMLInputElement | HTMLSelectElement).value);
        paint();
      });
    };
    bindInput("#f-search", (v) => {
      search = v;
    });
    bindInput("#f-region", (v) => {
      region = v as AgentRegion | "all";
    });
    bindInput("#f-cat", (v) => {
      category = v as AgentCategory | "all";
    });
    bindInput("#f-pricing", (v) => {
      pricing = v;
    });
    bindInput("#f-tools", (v) => {
      toolsQ = v;
    });

    root.querySelector("#diff-only")?.addEventListener("change", (e) => {
      diffsOnly = (e.target as HTMLInputElement).checked;
      paint();
    });

    root.querySelectorAll<HTMLSelectElement>("[data-add-slot]").forEach((el) => {
      el.addEventListener("change", () => {
        if (!el.value || picks.size >= 4) return;
        picks.add(el.value);
        savePicks([...picks]);
        paint();
      });
    });
    root.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        picks.delete(btn.dataset.remove!);
        savePicks([...picks]);
        paint();
      });
    });
    root.querySelectorAll<HTMLSelectElement>("[data-swap]").forEach((el) => {
      el.addEventListener("change", () => {
        const oldId = el.dataset.swap!;
        const next = el.value;
        if (!next || next === oldId) return;
        picks.delete(oldId);
        if (picks.size >= 4 && !picks.has(next)) {
          picks.add(oldId);
          return;
        }
        picks.add(next);
        savePicks([...picks]);
        paint();
      });
    });

    root.querySelectorAll<HTMLInputElement>("[data-pick]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.dataset.pick!;
        if (el.checked) {
          if (picks.size >= 4) {
            el.checked = false;
            return;
          }
          picks.add(id);
        } else picks.delete(id);
        savePicks([...picks]);
        paint();
      });
    });
    root.querySelectorAll<HTMLInputElement>("[data-weight]").forEach((el) => {
      el.addEventListener("input", () => {
        const id = el.dataset.weight as DimensionId;
        weights = { ...weights, [id]: Number(el.value) };
        saveWeights(weights);
        const val = root.querySelector(`[data-weight-val="${id}"]`);
        if (val) val.textContent = Number(el.value).toFixed(1);
        paint();
      });
    });
    root.querySelector("#reset-weights")?.addEventListener("click", () => {
      weights = { ...DEFAULT_WEIGHTS };
      saveWeights(weights);
      paint();
    });
    root.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.preset!;
        const preset = HARNESS_PRESETS[key];
        if (!preset) return;
        weights = { ...preset };
        saveWeights(weights);
        paint();
      });
    });
    root.querySelector("#copy-share")?.addEventListener("click", async () => {
      const link =
        location.origin +
        location.pathname +
        encodeCompareShare([...picks], weights);
      try {
        await navigator.clipboard.writeText(link);
        flash = t(locale, "copied");
      } catch {
        flash = link;
      }
      paint();
    });
    root.querySelector("#export-scores")?.addEventListener("click", () => {
      const rows = ranked.map(({ agent: a, score }) => [
        a.id,
        locale === "zh" ? a.nameZh : a.nameEn,
        score.toFixed(3),
        ...DIMENSION_IDS.map((id) => String(a.scores[id])),
      ]);
      const header = ["id", "name", "weighted", ...DIMENSION_IDS].join(",");
      const csv = [header, ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "agenter-shortlist.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  paint();
}
