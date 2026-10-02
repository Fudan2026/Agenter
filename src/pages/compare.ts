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
> = {
  codingAbility: "dimCoding",
  toolUse: "dimToolUse",
  contextMemory: "dimContext",
  privacyControl: "dimPrivacy",
  costEfficiency: "dimCost",
  cnAccessibility: "dimCnAccess",
  learningCurve: "dimLearn",
};

const CAT_LABEL: Record<
  AgentCategory,
  "catCoding" | "catChat" | "catResearch" | "catImage" | "catTooling"
> = {
  coding: "catCoding",
  chat: "catChat",
  research: "catResearch",
  image: "catImage",
  tooling: "catTooling",
};

let agentsCache: AgentRecord[] | null = null;

export async function loadAgents(): Promise<AgentRecord[]> {
  if (agentsCache) return agentsCache;
  const res = await fetch(`${import.meta.env.BASE_URL}data/agents.json`, {
    cache: "no-cache",
  });
  if (!res.ok) throw new Error(`agents.json HTTP ${res.status}`);
  const payload = (await res.json()) as AgentsPayload;
  agentsCache = payload.agents;
  return agentsCache;
}

function dimBars(scores: Record<DimensionId, number>): string {
  return `<div class="dim-bars" aria-hidden="true">${DIMENSION_IDS.map((id) => {
    const v = scores[id] ?? 0;
    const pct = (v / 5) * 100;
    return `<div class="dim-bar"><span style="width:${pct}%"></span></div>`;
  }).join("")}</div>`;
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
  let picks = new Set(shared.ids.length ? shared.ids : loadPicks());
  let weights = shared.weights ?? loadWeights();

  let flash = "";
  const paint = (): void => {
    const filtered = agents.filter((a) => {
      if (region !== "all" && a.region !== region) return false;
      if (category !== "all" && a.category !== category) return false;
      if (pricing && !a.pricingBand.toLowerCase().includes(pricing.toLowerCase()))
        return false;
      if (toolsQ && !a.toolsMcp.toLowerCase().includes(toolsQ.toLowerCase()))
        return false;
      if (search) {
        const hay = `${a.nameZh} ${a.nameEn} ${a.id} ${a.notesEn ?? ""} ${a.notesZh ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });

    const picked = agents.filter((a) => picks.has(a.id));
    const ranked = [...picked]
      .map((a) => ({ agent: a, score: weightedScore(a.scores, weights) }))
      .sort((a, b) => b.score - a.score);

    const body = `
      <h1>${esc(t(locale, "compareTitle"))}</h1>
      <p class="lead">${esc(t(locale, "compareLead"))}</p>
      <p class="muted tiny">${esc(t(locale, "editorialNote"))}</p>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
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
          <input type="text" id="f-pricing" value="${esc(pricing)}" placeholder="freemium / BYOK" />
        </label>
        <label>${esc(t(locale, "filterTools"))}
          <input type="text" id="f-tools" value="${esc(toolsQ)}" placeholder="MCP / CLI" />
        </label>
      </div>
      <p class="muted tiny">${esc(t(locale, "pickHint"))}</p>
      <div class="table-wrap sticky-first">
        <table class="agent-table">
          <thead>
            <tr>
              <th></th>
              <th>${locale === "zh" ? "名称" : "Name"}</th>
              <th>${esc(t(locale, "filterRegion"))}</th>
              <th>${esc(t(locale, "filterCategory"))}</th>
              <th>${esc(t(locale, "weightedScore"))}</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map((a) => {
                const name = locale === "zh" ? a.nameZh : a.nameEn;
                const score = weightedScore(a.scores, weights);
                return `<tr>
                  <td><input type="checkbox" data-pick="${esc(a.id)}" ${picks.has(a.id) ? "checked" : ""} /></td>
                  <td><strong>${esc(name)}</strong><div class="muted tiny">${esc(a.pricingBand)} · ${esc(a.contextWindow)}</div></td>
                  <td>${esc(a.region)}</td>
                  <td>${esc(t(locale, CAT_LABEL[a.category]))}</td>
                  <td>${score.toFixed(2)}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <section class="harness">
        <h2>${esc(t(locale, "harnessWeights"))}</h2>
        <div class="cta-row wrap preset-row">
          <button type="button" class="btn" data-preset="coding">${esc(t(locale, "presetCoding"))}</button>
          <button type="button" class="btn" data-preset="cn">${esc(t(locale, "presetCn"))}</button>
          <button type="button" class="btn" data-preset="privacy">${esc(t(locale, "presetPrivacy"))}</button>
          <button type="button" class="btn" data-preset="research">${esc(t(locale, "presetResearch"))}</button>
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

      <section class="side-by-side">
        <h2>${esc(t(locale, "sideBySide"))}</h2>
        ${
          ranked.length < 2
            ? `<p class="muted">${esc(t(locale, "emptyCompare"))}</p>`
            : `<div class="compare-cols">
                ${ranked
                  .map(({ agent: a, score }) => {
                    const name = locale === "zh" ? a.nameZh : a.nameEn;
                    const note =
                      locale === "zh" ? a.notesZh ?? "" : a.notesEn ?? "";
                    return `<article class="compare-card">
                      <h3>${esc(name)}</h3>
                      <p class="score-big">${score.toFixed(2)}</p>
                      ${dimBars(a.scores)}
                      <ul class="dim-list">
                        ${DIMENSION_IDS.map(
                          (id) =>
                            `<li><span>${esc(t(locale, DIM_LABEL[id]))}</span><strong>${a.scores[id]}</strong></li>`,
                        ).join("")}
                      </ul>
                      <p class="muted tiny">${esc(a.toolsMcp)} · ${esc(a.privacy)}</p>
                      ${note ? `<p class="tiny">${esc(note)}</p>` : ""}
                      ${
                        a.links.homepage
                          ? `<p><a href="${esc(a.links.homepage)}" target="_blank" rel="noopener">${esc(a.links.homepage)}</a></p>`
                          : ""
                      }
                    </article>`;
                  })
                  .join("")}
              </div>`
        }
      </section>
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
