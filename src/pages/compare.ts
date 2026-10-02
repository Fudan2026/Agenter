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
  loadPicks,
  loadWeights,
  savePicks,
  saveWeights,
  weightedScore,
} from "../lib/harness/weights";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

const DIM_LABEL: Record<DimensionId, "dimCoding" | "dimToolUse" | "dimContext" | "dimPrivacy" | "dimCost" | "dimCnAccess" | "dimLearn"> = {
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

export function renderCompare(
  root: HTMLElement,
  locale: Locale,
  agents: AgentRecord[],
): void {
  let region: AgentRegion | "all" = "all";
  let category: AgentCategory | "all" = "all";
  let picks = new Set(loadPicks());
  let weights = loadWeights();

  const paint = (): void => {
    const filtered = agents.filter((a) => {
      if (region !== "all" && a.region !== region) return false;
      if (category !== "all" && a.category !== category) return false;
      return true;
    });

    const picked = agents.filter((a) => picks.has(a.id));
    const ranked = [...picked]
      .map((a) => ({
        agent: a,
        score: weightedScore(a.scores, weights),
      }))
      .sort((a, b) => b.score - a.score);

    const body = `
      <h1>${esc(t(locale, "compareTitle"))}</h1>
      <p class="lead">${esc(t(locale, "compareLead"))}</p>
      <div class="filters">
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
      </div>
      <p class="muted tiny">${esc(t(locale, "pickHint"))}</p>
      <div class="table-wrap">
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
        <div class="weight-grid">
          ${DIMENSION_IDS.map((id) => {
            return `<label class="weight-row">${esc(t(locale, DIM_LABEL[id]))}
              <input type="range" min="0" max="2" step="0.1" data-weight="${id}" value="${weights[id]}" />
              <span class="weight-val" data-weight-val="${id}">${weights[id].toFixed(1)}</span>
            </label>`;
          }).join("")}
        </div>
        <button type="button" class="btn" id="reset-weights">${esc(t(locale, "resetWeights"))}</button>
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

    root.querySelector("#f-region")?.addEventListener("change", (e) => {
      region = (e.target as HTMLSelectElement).value as AgentRegion | "all";
      paint();
    });
    root.querySelector("#f-cat")?.addEventListener("change", (e) => {
      category = (e.target as HTMLSelectElement).value as AgentCategory | "all";
      paint();
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
        } else {
          picks.delete(id);
        }
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
        // light update of scores without full paint for snappiness — full paint OK
        paint();
      });
    });
    root.querySelector("#reset-weights")?.addEventListener("click", () => {
      weights = { ...DEFAULT_WEIGHTS };
      saveWeights(weights);
      paint();
    });
  };

  paint();
}
