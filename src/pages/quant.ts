import {
  ColorType,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";

import type { Locale } from "../i18n/strings";
import { t, type StringKey } from "../i18n/strings";
import {
  runBacktest,
  STRATEGY_META,
  type BacktestResult,
  type StrategyId,
} from "../lib/backtest/engine";
import {
  mergeParams,
  parseLabParams,
  type StrategyParams,
} from "../lib/backtest/params";
import {
  QUANT_PANEL_IDS,
  readHashQuery,
  scrollToId,
} from "../lib/nav/hash-query";
import {
  rankCommittee,
  ROLE_LABELS,
  type CommitteeResult,
} from "../lib/committee/votes";
import { exposuresForRow, resolveBenchmark } from "../lib/factors/ff-proxy";
import {
  type FactorsPayload,
  type FactorScores,
  type FactorWeights,
} from "../lib/factors/cross-section";
import {
  FACTOR_TILTS,
  quantileSpread,
  type FactorTiltId,
  type FactorsIcPayload,
} from "../lib/factors/ic";
import {
  defaultStudioWeights,
  loadRecipes,
  normalizeWeights,
  rankWithWeights,
  resolveStudioWeights,
  saveRecipes,
  type FactorRecipe,
} from "../lib/factors/studio";
import { PATTERN_META, type PatternId } from "../lib/patterns/types";
import { patternConfluenceAbs } from "../lib/patterns/confluence";
import {
  DEFAULT_COST_CONFIG,
  type SlippageModel,
} from "../lib/paper/costs";
import { buildResearchAudit } from "../lib/paper/audit";
import {
  applyBuy,
  applySell,
  equityMark,
  normalizeQty,
  resolveNextOpenFill,
} from "../lib/paper/engine";
import { defaultSignalDate } from "../lib/paper/equity";
import { downloadChecklistRows } from "../lib/paper/export";
import { loadPaperState, savePaperState } from "../lib/paper/journal";
import { evaluateBacktestGates } from "../lib/risk/gates";
import {
  confluenceScore,
  isStaleVsReport,
  patternHeatmap,
} from "../lib/signals/board";
import type { AnnouncementsPayload } from "../lib/announcements/map";
import type { IndicesPayload } from "../lib/indices/map";
import type { IwencaiNewsPayload } from "../lib/iwencai-news/map";
import type { ScreensPayload } from "../lib/screens/map";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import {
  renderBucketedFilingsList,
  renderEventBucketCounts,
} from "./tools";
import type { LatestPayload, SymbolRow } from "./types";

export interface RecipesPayload {
  generatedAt: string;
  attribution: { zh: string; en: string };
  cards: Array<{
    id: string;
    skill: string;
    titleZh: string;
    titleEn: string;
    bodyZh: string;
    bodyEn: string;
    href: string;
  }>;
}

let labChart: IChartApi | null = null;
let lastLabResult: BacktestResult | null = null;

function destroyLabChart(): void {
  if (labChart) {
    labChart.remove();
    labChart = null;
  }
}

export function cleanupQuantPage(): void {
  destroyLabChart();
  lastLabResult = null;
}

function sparklineSvg(closes: number[]): string {
  if (!closes || closes.length < 2) return "";
  const w = 120;
  const h = 36;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const pts = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * w;
      const y = h - ((c - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "#15803d" : "#b91c1c";
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke="${stroke}" stroke-width="1.5" points="${pts}"/></svg>`;
}

function statusLabel(locale: Locale, status: SymbolRow["dataStatus"]): string {
  if (status === "live") return t(locale, "dataLive");
  if (status === "stale") return t(locale, "dataStale");
  return t(locale, "dataMissing");
}

function groupLabel(locale: Locale, group: SymbolRow["group"]): string {
  if (group === "macro") return t(locale, "groupMacro");
  if (group === "china-etf") return t(locale, "groupEtf");
  return t(locale, "groupAshare");
}

function patternChip(
  locale: Locale,
  p: SymbolRow["recentPatterns"][number],
): string {
  const label =
    locale === "zh" ? PATTERN_META[p.patternId].zh : PATTERN_META[p.patternId].en;
  return `<span class="chip chip-${esc(p.direction)}">${esc(label)}</span>`;
}

function biasLabel(locale: Locale, bias: "bull" | "bear" | "neutral"): string {
  if (bias === "bull") return t(locale, "biasBull");
  if (bias === "bear") return t(locale, "biasBear");
  return t(locale, "biasNeutral");
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtLast(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtIsoSlice(iso: string | undefined | null): string {
  if (!iso) return "—";
  const s = iso.slice(0, 19);
  return s || "—";
}

function renderSkillsOpsBar(
  locale: Locale,
  stamps: {
    latest?: string | null;
    factors?: string | null;
    factorsIc?: string | null;
    indices?: string | null;
    screens?: string | null;
    announcements?: string | null;
    iwencaiNews?: string | null;
  },
): string {
  const cells: Array<[Parameters<typeof t>[1], string | null | undefined]> = [
    ["skillsOpsLatest", stamps.latest],
    ["skillsOpsFactors", stamps.factors],
    ["skillsOpsFactorsIc", stamps.factorsIc],
    ["skillsOpsIndices", stamps.indices],
    ["skillsOpsScreens", stamps.screens],
    ["skillsOpsAnnouncements", stamps.announcements],
    ["skillsOpsIwencaiNews", stamps.iwencaiNews],
  ];
  return `<section class="skills-ops-bar">
    <h2 class="skills-ops-h">${esc(t(locale, "skillsOps"))}</h2>
    <p class="muted tiny">${esc(t(locale, "skillsOpsLead"))}</p>
    <div class="skills-ops-row">
      ${cells
        .map(
          ([key, val]) => `<div class="skills-ops-chip">
            <span class="skills-ops-label">${esc(t(locale, key))}</span>
            <span class="skills-ops-ts">${esc(fmtIsoSlice(val))}</span>
          </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

function renderFilingsStub(
  locale: Locale,
  announcements: AnnouncementsPayload | null,
): string {
  const items = announcements?.items ?? [];
  return `<section class="filings-stub" id="quant-filings">
    <h2>${esc(t(locale, "filingsStub"))}</h2>
    <p class="muted tiny">${esc(t(locale, "filingsStubLead"))} · ${esc(fmtIsoSlice(announcements?.generatedAt))} · ${esc(t(locale, "iwencaiSource"))}</p>
    ${renderEventBucketCounts(locale, items)}
    ${renderBucketedFilingsList(locale, items, 8)}
  </section>`;
}

function renderIcPanel(
  locale: Locale,
  ic: FactorsIcPayload | null,
): string {
  if (!ic?.rows?.length) return "";
  const attr = locale === "zh" ? ic.attribution.zh : ic.attribution.en;
  const fmtIc = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? "—" : n.toFixed(3);
  const horizonStrip =
    ic.horizons && ic.horizons.length
      ? `<div class="ic-horizon-strip" aria-label="multi-horizon IC">
          <p class="tiny muted">${esc(t(locale, "icMultiHorizon"))}</p>
          <div class="table-wrap"><table class="agent-table tiny">
            <thead><tr>
              <th>H</th>
              <th>Mom IC</th>
              <th>Mom IR</th>
              <th>LowVol IC</th>
              <th>LowVol IR</th>
              <th>Mom Q-spread</th>
            </tr></thead>
            <tbody>
              ${ic.horizons
                .map((h) => {
                  const mom = h.rows.find((r) => r.factor === "momentum");
                  const lv = h.rows.find((r) => r.factor === "lowVol");
                  const spread = quantileSpread(mom);
                  return `<tr>
                    <td>${h.horizonBars}d</td>
                    <td>${esc(fmtIc(mom?.icMean))}</td>
                    <td>${esc(fmtIc(mom?.ir))}</td>
                    <td>${esc(fmtIc(lv?.icMean))}</td>
                    <td>${esc(fmtIc(lv?.ir))}</td>
                    <td>${esc(spread == null ? "—" : `${(spread * 100).toFixed(2)}%`)}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table></div>
          <p class="muted tiny">${esc(t(locale, "icDecayNote"))}</p>
        </div>`
      : `<p class="muted tiny">${esc(t(locale, "icDecayNote"))}</p>`;
  return `<section class="ic-panel" id="quant-ic">
    <h2>${esc(t(locale, "icPanel"))}</h2>
    <p class="muted tiny">${esc(t(locale, "icPanelLead"))}</p>
    <p class="muted tiny">${esc(attr)} · horizon ${ic.horizonBars}d · ${esc(fmtIsoSlice(ic.generatedAt))}</p>
    ${horizonStrip}
    <div class="ic-rows">
      ${ic.rows
        .map((r) => {
          const qBars = (r.quantileReturns ?? [])
            .map((q, i) => {
              const pct = (q * 100).toFixed(2);
              const w = Math.min(100, Math.abs(q) * 800);
              const cls = q >= 0 ? "up" : "down";
              return `<div class="ic-qbar ${cls}" title="Q${i + 1}">
                <span class="ic-q-label">Q${i + 1}</span>
                <span class="ic-q-track"><span style="width:${w}%"></span></span>
                <span class="ic-q-val">${pct}%</span>
              </div>`;
            })
            .join("");
          return `<article class="ic-card">
            <h3>${esc(r.factor)}</h3>
            <div class="ic-metrics">
              <span>${esc(t(locale, "icMean"))}: <strong>${r.icMean == null ? "—" : r.icMean.toFixed(3)}</strong></span>
              <span>${esc(t(locale, "icIr"))}: <strong>${r.ir == null ? "—" : r.ir.toFixed(3)}</strong></span>
              <span class="muted tiny">n=${r.nPeriods}</span>
            </div>
            <div class="ic-quantiles">
              <p class="muted tiny">${esc(t(locale, "icQuantiles"))}</p>
              ${qBars}
            </div>
          </article>`;
        })
        .join("")}
    </div>
  </section>`;
}

function renderCorrHeatmap(
  locale: Locale,
  ic: FactorsIcPayload | null,
): string {
  const pairs = ic?.corrHeatmap ?? [];
  if (!pairs.length) return "";
  return `<section class="corr-heatmap-panel">
    <h2>${esc(t(locale, "corrHeatmap"))}</h2>
    <p class="muted tiny">${esc(t(locale, "corrHeatmapLead"))}</p>
    <div class="table-wrap"><table class="agent-table corr-table">
      <thead><tr><th>A</th><th>B</th><th>corr</th></tr></thead>
      <tbody>
        ${pairs
          .slice(0, 24)
          .map((p) => {
            const c = p.corr;
            const cls =
              c == null ? "" : c >= 0.5 ? "corr-hi" : c <= -0.2 ? "corr-lo" : "";
            return `<tr class="${cls}">
              <td class="tiny">${esc(p.a)}</td>
              <td class="tiny">${esc(p.b)}</td>
              <td>${c == null ? "—" : c.toFixed(2)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
  </section>`;
}

/** UI slider state 0–100 → FactorWeights via normalizeWeights. */
type StudioSliderState = {
  momentum: number;
  lowVol: number;
  sizeAdv: number;
  quality: number;
  peProxy: number;
  pbProxy: number;
};

function slidersFromWeights(w: FactorWeights): StudioSliderState {
  return {
    momentum: Math.round((w.momentum ?? 0) * 100),
    lowVol: Math.round((w.lowVol ?? 0) * 100),
    sizeAdv: Math.round((w.sizeAdv ?? 0) * 100),
    quality: Math.round((w.quality ?? 0) * 100),
    peProxy: Math.round((w.peProxy ?? 0) * 100),
    pbProxy: Math.round((w.pbProxy ?? 0) * 100),
  };
}

function weightsFromSliders(s: StudioSliderState): FactorWeights {
  return normalizeWeights({
    momentum: s.momentum,
    lowVol: s.lowVol,
    sizeAdv: s.sizeAdv,
    quality: s.quality,
    peProxy: s.peProxy,
    pbProxy: s.pbProxy,
  });
}

function tiltLabel(locale: Locale, id: FactorTiltId): string {
  if (id === "equal") return t(locale, "factorTiltEqual");
  if (id === "ic") return t(locale, "factorTiltIc");
  if (id === "value") return t(locale, "factorTiltValue");
  if (id === "momentum") return t(locale, "factorTiltMomentum");
  return t(locale, "factorTiltQuality");
}

function renderFactorStudio(
  locale: Locale,
  factors: FactorsPayload | null,
  sliders: StudioSliderState,
  topN: number,
  useIc: boolean,
  factorsIc: FactorsIcPayload | null,
  recipes: FactorRecipe[],
): string {
  if (!factors?.factors?.length) return "";
  const base = weightsFromSliders(sliders);
  const w = resolveStudioWeights(base, useIc, factorsIc);
  const ranked = rankWithWeights(factors.factors, w, topN);
  const attr = locale === "zh" ? factors.attribution.zh : factors.attribution.en;
  const tiltOpts: FactorTiltId[] = [
    "equal",
    "ic",
    "value",
    "momentum",
    "quality",
  ];
  const sliderKeys: Array<keyof StudioSliderState> = [
    "momentum",
    "lowVol",
    "sizeAdv",
    "quality",
    "peProxy",
    "pbProxy",
  ];
  const sliderLabel = (k: keyof StudioSliderState): string => {
    if (k === "momentum") return t(locale, "factorMomentum");
    if (k === "lowVol") return t(locale, "factorLowVol");
    if (k === "sizeAdv") return t(locale, "factorSizeAdv");
    if (k === "quality") return t(locale, "factorQuality");
    if (k === "peProxy") return t(locale, "peProxy");
    return t(locale, "pbProxy");
  };
  const topOpts = Array.from({ length: 11 }, (_, i) => i + 5);
  return `<section class="factor-board-panel factor-studio-panel" id="quant-studio">
    <h2>${esc(t(locale, "factorStudio"))}</h2>
    <p class="muted tiny">${esc(t(locale, "factorStudioLead"))}</p>
    <p class="muted tiny">${esc(attr)}</p>
    <div class="factor-tilt-bar cta-row wrap">
      <span class="tiny muted">${esc(t(locale, "factorTilt"))}:</span>
      ${tiltOpts
        .map(
          (id) =>
            `<button type="button" class="btn btn-ghost studio-tilt" data-tilt="${esc(id)}">${esc(tiltLabel(locale, id))}</button>`,
        )
        .join("")}
    </div>
    <div class="studio-sliders" aria-label="${esc(t(locale, "studioSliders"))}">
      ${sliderKeys
        .map((k) => {
          const disabled = useIc && ["momentum", "lowVol", "sizeAdv", "quality"].includes(k);
          return `<label class="studio-slider">
            <span>${esc(sliderLabel(k))} <strong data-slider-val="${esc(k)}">${sliders[k]}</strong></span>
            <input type="range" min="0" max="100" step="1" id="studio-${esc(k)}" data-studio-key="${esc(k)}" value="${sliders[k]}"${disabled ? " disabled" : ""}/>
          </label>`;
        })
        .join("")}
    </div>
    <div class="cta-row wrap studio-controls">
      <label>${esc(t(locale, "studioTopN"))}
        <select id="studio-topn">
          ${topOpts
            .map((n) => {
              const sel = n === topN ? " selected" : "";
              return `<option value="${n}"${sel}>${n}</option>`;
            })
            .join("")}
        </select>
      </label>
      <label class="tiny"><input type="checkbox" id="studio-use-ic" ${useIc ? "checked" : ""}/> ${esc(t(locale, "studioUseIc"))}</label>
      <label>${esc(t(locale, "studioRecipeName"))}
        <input type="text" id="studio-recipe-name" maxlength="40" placeholder="my-recipe" value=""/>
      </label>
      <button type="button" class="btn" id="studio-save">${esc(t(locale, "studioSave"))}</button>
      <label>${esc(t(locale, "studioLoad"))}
        <select id="studio-load">
          <option value="">—</option>
          ${recipes
            .map(
              (r) =>
                `<option value="${esc(r.id)}">${esc(r.name)} · N=${r.topN}</option>`,
            )
            .join("")}
        </select>
      </label>
      <button type="button" class="btn" id="studio-export">${esc(t(locale, "studioExport"))}</button>
      <button type="button" class="btn btn-primary" id="studio-topn-paper">${esc(t(locale, "studioTopNPaper"))}</button>
    </div>
    <p class="muted tiny">${esc(t(locale, "factorComposite"))}: mom ${(w.momentum * 100).toFixed(0)} · lv ${(w.lowVol * 100).toFixed(0)} · adv ${(w.sizeAdv * 100).toFixed(0)} · q ${(w.quality * 100).toFixed(0)}${w.peProxy ? ` · pe ${(w.peProxy * 100).toFixed(0)}` : ""}${w.pbProxy ? ` · pb ${(w.pbProxy * 100).toFixed(0)}` : ""}</p>
    <div class="table-wrap"><table class="agent-table" id="studio-rank-table">
      <thead><tr>
        <th>${esc(t(locale, "factorRank"))}</th>
        <th>Symbol</th>
        <th>${esc(t(locale, "factorMomentum"))}</th>
        <th>${esc(t(locale, "factorLowVol"))}</th>
        <th>${esc(t(locale, "factorSizeAdv"))}</th>
        <th>${esc(t(locale, "factorQuality"))}</th>
        <th>${esc(t(locale, "peProxy"))}</th>
        <th>${esc(t(locale, "pbProxy"))}</th>
        <th>${esc(t(locale, "factorComposite"))}</th>
      </tr></thead>
      <tbody>
        ${ranked
          .map((f) => {
            const name = locale === "zh" ? f.nameZh : f.nameEn;
            return `<tr data-symbol="${esc(f.symbol)}">
              <td>${f.rank ?? "—"}</td>
              <td><a href="#/asset/${encodeURIComponent(f.symbol)}">${esc(f.symbol)}</a>
                <div class="muted tiny">${esc(name)}</div></td>
              <td>${esc(fmtZ(f.momentum))}</td>
              <td>${esc(fmtZ(f.lowVol))}</td>
              <td>${esc(fmtZ(f.sizeAdv))}</td>
              <td>${esc(fmtZ(f.quality))}</td>
              <td>${esc(fmtZ(f.peProxy))}</td>
              <td>${esc(fmtZ(f.pbProxy))}</td>
              <td><strong>${esc(fmtZ(f.composite))}</strong></td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
  </section>`;
}

function renderCommitteeDesk(
  locale: Locale,
  results: CommitteeResult[],
): string {
  if (!results.length) {
    return `<section class="committee-desk-panel" id="quant-committee">
      <h2>${esc(t(locale, "committeeDesk"))}</h2>
      <p class="muted tiny">${esc(t(locale, "committeeDeskLead"))}</p>
      <p class="muted">${esc(t(locale, "committeeEmpty"))}</p>
    </section>`;
  }
  return `<section class="committee-desk-panel" id="quant-committee">
    <h2>${esc(t(locale, "committeeDesk"))}</h2>
    <p class="muted tiny">${esc(t(locale, "committeeDeskLead"))}</p>
    <div class="cta-row wrap">
      <button type="button" class="btn btn-primary" id="committee-promote-json">${esc(t(locale, "committeePromote"))}</button>
      <button type="button" class="btn" id="committee-promote-paper">${esc(t(locale, "committeePromotePaper"))}</button>
    </div>
    <div class="table-wrap"><table class="agent-table committee-table">
      <thead><tr>
        <th>Symbol</th>
        <th>${esc(t(locale, "committeeConsensus"))}</th>
        <th>Bias</th>
        ${(["fundamentals", "sentiment", "technical", "news", "risk", "portfolio"] as const)
          .map((r) => `<th class="tiny">${esc(ROLE_LABELS[r][locale])}</th>`)
          .join("")}
      </tr></thead>
      <tbody>
        ${results
          .map((r) => {
            const name = locale === "zh" ? r.nameZh : r.nameEn;
            const vote = (role: string) =>
              r.votes.find((v) => v.role === role)?.score ?? 0;
            return `<tr data-symbol="${esc(r.symbol)}" data-bias="${esc(r.bias)}">
              <td><a href="#/asset/${encodeURIComponent(r.symbol)}">${esc(r.symbol)}</a>
                <div class="muted tiny">${esc(name)}</div></td>
              <td><strong>${r.consensus.toFixed(2)}</strong></td>
              <td><span class="chip chip-${r.bias === "neutral" ? "neutral" : r.bias === "bull" ? "bull" : "bear"}">${esc(biasLabel(locale, r.bias))}</span></td>
              ${(["fundamentals", "sentiment", "technical", "news", "risk", "portfolio"] as const)
                .map((role) => {
                  const v = vote(role);
                  const ev = r.votes.find((x) => x.role === role);
                  const tip = locale === "zh" ? ev?.evidenceZh : ev?.evidenceEn;
                  return `<td class="tiny" title="${esc(tip ?? "")}">${v.toFixed(2)}</td>`;
                })
                .join("")}
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
  </section>`;
}

function renderAlphaRecipeCards(locale: Locale): string {
  const cards: Array<{ title: StringKey; body: StringKey; href: string }> = [
    {
      title: "alphaMomTitle",
      body: "alphaMomBody",
      href: "#/handbook",
    },
    {
      title: "alphaLowVolTitle",
      body: "alphaLowVolBody",
      href: "#/handbook",
    },
    {
      title: "alphaQualityTitle",
      body: "alphaQualityBody",
      href: "#/handbook",
    },
    {
      title: "alphaValueTitle",
      body: "alphaValueBody",
      href: "#/handbook",
    },
  ];
  return `<section class="alpha-recipes-panel recipe-cards-panel">
    <h2>${esc(t(locale, "alphaRecipes"))}</h2>
    <p class="muted tiny">${esc(t(locale, "alphaRecipesLead"))}</p>
    <div class="recipe-grid">
      ${cards
        .map(
          (c) => `<article class="recipe-card alpha-card">
            <h3>${esc(t(locale, c.title))}</h3>
            <p>${esc(t(locale, c.body))}</p>
            <a class="btn" href="${esc(c.href)}">${esc(t(locale, "navHandbook"))}</a>
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}

function composerParamsHtml(
  locale: Locale,
  strategy: StrategyId,
  params: StrategyParams,
): string {
  const m = mergeParams(params);
  if (strategy === "ma_cross") {
    return `<div class="composer-params cta-row wrap" id="composer-params">
      <span class="tiny muted">${esc(t(locale, "strategyComposer"))}</span>
      <label>${esc(t(locale, "composerFast"))}
        <input type="number" id="p-fast" min="2" max="120" value="${m.maFast}"/>
      </label>
      <label>${esc(t(locale, "composerSlow"))}
        <input type="number" id="p-slow" min="3" max="250" value="${m.maSlow}"/>
      </label>
    </div>`;
  }
  if (strategy === "rsi_mr") {
    return `<div class="composer-params cta-row wrap" id="composer-params">
      <span class="tiny muted">${esc(t(locale, "strategyComposer"))}</span>
      <label>${esc(t(locale, "composerRsi"))}
        <input type="number" id="p-rsi" min="2" max="50" value="${m.rsiPeriod}"/>
      </label>
      <label>${esc(t(locale, "composerOs"))}
        <input type="number" id="p-os" min="5" max="45" value="${m.rsiOs}"/>
      </label>
      <label>${esc(t(locale, "composerOb"))}
        <input type="number" id="p-ob" min="55" max="95" value="${m.rsiOb}"/>
      </label>
    </div>`;
  }
  if (strategy === "confluence" || strategy === "pattern_confluence") {
    return `<div class="composer-params cta-row wrap" id="composer-params">
      <span class="tiny muted">${esc(t(locale, "strategyComposer"))}</span>
      <label>${esc(t(locale, "composerThr"))}
        <input type="number" id="p-thr" min="10" max="100" value="${m.confThreshold}"/>
      </label>
    </div>`;
  }
  if (strategy === "ml_lite") {
    return `<div class="composer-params cta-row wrap" id="composer-params">
      <span class="tiny muted">${esc(t(locale, "strategyComposer"))}</span>
      <label>${esc(t(locale, "composerLags"))}
        <input type="number" id="p-lags" min="2" max="12" value="${m.mlLags}"/>
      </label>
      <label>${esc(t(locale, "composerShrink"))}
        <input type="number" id="p-shrink" min="0" max="20" step="0.5" value="${m.mlShrink}"/>
      </label>
    </div>`;
  }
  return `<div class="composer-params muted tiny" id="composer-params">${esc(t(locale, "strategyComposer"))}: —</div>`;
}

function fmtZ(v: number | null): string {
  return v == null ? "—" : v.toFixed(2);
}

function renderIndicesStrip(
  locale: Locale,
  indices: IndicesPayload | null,
): string {
  const items = indices?.items ?? [];
  if (!items.length) {
    return `<section class="indices-strip">
      <h2 class="indices-h">${esc(t(locale, "indicesTitle"))}</h2>
      <p class="muted tiny">${esc(t(locale, "indicesEmpty"))} · ${esc(t(locale, "iwencaiSource"))}</p>
    </section>`;
  }
  return `<section class="indices-strip">
    <div class="indices-head">
      <h2 class="indices-h">${esc(t(locale, "indicesTitle"))}</h2>
      <p class="muted tiny">${esc(indices?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "iwencaiSource"))}</p>
    </div>
    <div class="indices-row">
      ${items
        .map((ix) => {
          const name = locale === "zh" ? ix.nameZh : ix.nameEn;
          const up = (ix.changePct ?? 0) > 0;
          const down = (ix.changePct ?? 0) < 0;
          const cls = up ? "up" : down ? "down" : "flat";
          return `<a class="index-chip ${cls}" href="#/asset/${encodeURIComponent(ix.code.includes(".") ? ix.code : guessYahoo(ix.code))}">
            <span class="index-name">${esc(name)}</span>
            <span class="index-last">${esc(fmtLast(ix.last))}</span>
            <span class="index-chg">${esc(fmtPct(ix.changePct))}</span>
          </a>`;
        })
        .join("")}
    </div>
  </section>`;
}

/** Best-effort map bare CN index codes → Yahoo-style symbols on the watchlist. */
function guessYahoo(code: string): string {
  const c = code.replace(/\D/g, "").padStart(6, "0");
  if (c.startsWith("399") || c.startsWith("159")) return `${c}.SZ`;
  return `${c}.SS`;
}

function renderScreensPanel(
  locale: Locale,
  screens: ScreensPayload | null,
): string {
  const panels = screens?.screens ?? [];
  return `<section class="screens-panel" id="quant-screens">
    <h2>${esc(t(locale, "screensTitle"))}</h2>
    <p class="muted tiny">${esc(t(locale, "screensLead"))}</p>
    <p class="muted tiny">${esc(screens?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "iwencaiSource"))}</p>
    ${
      !panels.length
        ? `<p class="muted">${esc(t(locale, "screensEmpty"))}</p>`
        : `<div class="cta-row wrap">
      <button type="button" class="btn btn-primary" id="screens-all-paper">${esc(t(locale, "screensPromoteAll"))}</button>
    </div>
    <div class="screens-grid">
      ${panels
        .map((p) => {
          const name = locale === "zh" ? p.nameZh : p.nameEn;
          const tickers = p.tickers
            .slice(0, 8)
            .map((tk) => {
              const up = (tk.changePct ?? 0) > 0;
              const down = (tk.changePct ?? 0) < 0;
              const cls = up ? "up" : down ? "down" : "flat";
              return `<li class="${cls}">
                <strong>${esc(tk.nameZh)}</strong>
                <span class="muted tiny">${esc(tk.code)}</span>
                <span>${esc(fmtLast(tk.last))}</span>
                <span class="chg">${esc(fmtPct(tk.changePct))}</span>
              </li>`;
            })
            .join("");
          return `<article class="screen-card">
            <h3>${esc(name)}</h3>
            <p class="muted tiny">${esc(t(locale, "screensMatches"))}: ${p.codeCount}</p>
            ${
              p.tickers.length
                ? `<ul class="screen-tickers">${tickers}</ul>`
                : `<p class="muted tiny">${esc(t(locale, "screensEmpty"))}</p>`
            }
            <button type="button" class="btn" data-screen-paper="${esc(p.id)}">${esc(t(locale, "screensPromote"))}</button>
          </article>`;
        })
        .join("")}
    </div>`
    }
  </section>`;
}

function renderAdfStrip(
  locale: Locale,
  factors: FactorsPayload | null,
): string {
  const rows = factors?.adfStrip ?? [];
  if (!rows.length) return "";
  return `<section class="adf-strip-panel">
    <h2>${esc(t(locale, "adfStrip"))}</h2>
    <p class="muted tiny">${esc(t(locale, "adfStripLead"))}</p>
    <div class="table-wrap"><table class="agent-table">
      <thead><tr>
        <th>Symbol</th>
        <th>${esc(t(locale, "adfStat"))}</th>
        <th>${esc(t(locale, "adfP"))}</th>
        <th>${esc(t(locale, "adfStationary"))}</th>
        <th>σ</th>
      </tr></thead>
      <tbody>
        ${rows
          .map((r) => {
            const name = locale === "zh" ? r.nameZh : r.nameEn;
            const st =
              r.stationary == null
                ? "—"
                : r.stationary
                  ? t(locale, "yes")
                  : t(locale, "no");
            return `<tr>
              <td>${esc(r.symbol)}<div class="muted tiny">${esc(name)}</div></td>
              <td>${r.adfStat == null ? "—" : r.adfStat.toFixed(2)}</td>
              <td>${r.adfP == null ? "—" : r.adfP.toFixed(3)}</td>
              <td>${esc(st)}</td>
              <td>${r.dailyVol == null ? "—" : (r.dailyVol * 100).toFixed(2) + "%"}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
  </section>`;
}

function renderRecipeCards(
  locale: Locale,
  recipes: RecipesPayload | null,
): string {
  const cards = recipes?.cards ?? [];
  if (!cards.length) return "";
  const attr =
    locale === "zh" ? recipes!.attribution.zh : recipes!.attribution.en;
  return `<section class="recipe-cards-panel">
    <h2>${esc(t(locale, "recipeCards"))}</h2>
    <p class="muted tiny">${esc(t(locale, "recipeCardsLead"))}</p>
    <p class="muted tiny">${esc(attr)}</p>
    <div class="recipe-grid">
      ${cards
        .map((c) => {
          const title = locale === "zh" ? c.titleZh : c.titleEn;
          const body = locale === "zh" ? c.bodyZh : c.bodyEn;
          return `<article class="recipe-card">
            <h3>${esc(title)}</h3>
            <p class="muted tiny">${esc(c.skill)}</p>
            <p>${esc(body)}</p>
            <a class="btn" href="${esc(c.href)}">${esc(c.skill)}</a>
          </article>`;
        })
        .join("")}
    </div>
  </section>`;
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

function cardHtml(locale: Locale, s: SymbolRow): string {
  const name = locale === "zh" ? s.nameZh : s.nameEn;
  const pct =
    s.pct1d == null
      ? "—"
      : `${s.pct1d >= 0 ? "+" : ""}${s.pct1d.toFixed(2)}%`;
  const pctCls =
    s.pct1d == null ? "" : s.pct1d >= 0 ? "positive" : "negative";
  const chips = s.recentPatterns
    .slice(-3)
    .reverse()
    .map((p) => patternChip(locale, p))
    .join("");
  const bias = s.signals?.bias ?? "neutral";
  const conf = confluenceScore(s);
  const patConf = patternConfluenceAbs(s.recentPatterns);

  return `<a class="asset-card" href="#/asset/${encodeURIComponent(s.symbol)}">
    <div class="asset-card-top">
      <div>
        <div class="asset-name">${esc(name)} <span class="chip chip-${esc(bias === "neutral" ? "neutral" : bias === "bull" ? "bull" : "bear")}">${esc(biasLabel(locale, bias))}</span></div>
        <div class="asset-meta">${esc(s.symbol)} · ${esc(groupLabel(locale, s.group))} · ${esc(statusLabel(locale, s.dataStatus))} · ${esc(t(locale, "confluence"))} ${conf} · ${esc(t(locale, "patternConf"))} ${patConf}${
          s.signals?.rsi14 != null
            ? ` · RSI ${s.signals.rsi14.toFixed(0)}`
            : ""
        }${s.signals?.volumeSpike ? " · vol↑" : ""}</div>
      </div>
      <div class="asset-price">
        <div class="last-close">${s.lastClose ? s.lastClose.toFixed(2) : "—"}</div>
        <div class="pct ${pctCls}">${pct}</div>
      </div>
    </div>
    <div class="asset-card-bottom">
      ${sparklineSvg(s.sparkCloses)}
      <div class="chips">${chips}</div>
    </div>
  </a>`;
}

function metricsHtml(locale: Locale, res: BacktestResult): string {
  const m = res.metrics;
  const fmt = (n: number, d = 2) => n.toFixed(d);
  const gate = evaluateBacktestGates({
    costModelEnabled: res.costModelEnabled,
    fillRuleAllNextOpen: res.trades.every((t) => t.fillRule === "next_open"),
    usedPurgedWf: res.usedPurgedWf,
    rawSharpe: res.oosMetrics.sharpe,
    haircutSharpe: res.haircutSharpe,
    isReturn: res.isMetrics.totalReturnPct,
    oosReturn: res.oosMetrics.totalReturnPct,
    oosSharpe: res.oosMetrics.sharpe,
    maxDdPct: res.oosMetrics.maxDrawdownPct,
  });
  const level = gate.okForGreen ? gate.level : gate.level === "green" ? "yellow" : gate.level;
  const foldRows = res.folds
    .map(
      (f) =>
        `<tr><td>${f.fold}</td><td>${fmt(f.metrics.totalReturnPct)}%</td><td>${fmt(f.metrics.sharpe)}</td></tr>`,
    )
    .join("");
  return `<div class="tear-sheet verdict-${esc(level)}">
    <div class="stats-row paper-stats">
      <div class="stat"><span class="stat-n">${fmt(m.totalReturnPct)}%</span><span class="stat-l">Return</span></div>
      <div class="stat"><span class="stat-n">${fmt(m.maxDrawdownPct)}%</span><span class="stat-l">Max DD</span></div>
      <div class="stat"><span class="stat-n">${fmt(res.oosMetrics.sharpe)}</span><span class="stat-l">${esc(t(locale, "rawSharpe"))}</span></div>
      <div class="stat"><span class="stat-n">${fmt(res.haircutSharpe)}</span><span class="stat-l">${esc(t(locale, "haircutSharpe"))} N=${res.nTrials}</span></div>
    </div>
    <p class="muted tiny">Haircut ${fmt(res.haircutPct, 0)}% · verdict <strong>${esc(level)}</strong> · cost ${res.costModelEnabled ? "ON" : "OFF"} · purged WF ${res.usedPurgedWf ? "yes" : "no"}</p>
    <p class="muted tiny">${esc(t(locale, "strategyIS"))}: ${fmt(res.isMetrics.totalReturnPct)}% / Sh ${fmt(res.isMetrics.sharpe)} · ${esc(t(locale, "strategyOOS"))}: ${fmt(res.oosMetrics.totalReturnPct)}% / Sh ${fmt(res.oosMetrics.sharpe)} · deg ${fmt(res.degradation.returnRatio)}</p>
    ${
      foldRows
        ? `<div class="table-wrap"><table class="agent-table"><thead><tr><th>Fold</th><th>OOS ret</th><th>OOS Sh</th></tr></thead><tbody>${foldRows}</tbody></table></div>`
        : ""
    }
    <ul class="tiny">${gate.messages.map((msg) => `<li>${esc(locale === "zh" ? msg.zh : msg.en)}</li>`).join("")}</ul>
  </div>
  ${(() => {
    const audit = buildResearchAudit({
      costModelEnabled: res.costModelEnabled,
      fillRuleNextOpen: res.trades.every((tr) => tr.fillRule === "next_open"),
      usedTimeSplitNotRandom: res.usedPurgedWf,
      survivorUniverse: true,
      haircutSharpe: res.haircutSharpe,
      nTrials: res.nTrials,
    });
    return `<div class="research-audit audit-${esc(audit.level)} lab-audit-strip">
      <h3>${esc(t(locale, "researchAudit"))}</h3>
      <p class="muted tiny">${esc(t(locale, "researchAuditLead"))} · score ${audit.score} (${esc(audit.level)})</p>
      <ul class="audit-flags">
        ${audit.flags
          .map(
            (f) =>
              `<li class="${f.ok ? "ok" : "warn"}">${f.ok ? "✓" : "!"} ${esc(locale === "zh" ? f.zh : f.en)}</li>`,
          )
          .join("")}
      </ul>
    </div>`;
  })()}`;
}

function fmtRet(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function renderMacroTimingPanel(
  locale: Locale,
  data: LatestPayload,
): string {
  const rows = data.timing ?? [];
  const bySym = new Map(data.symbols.map((s) => [s.symbol, s]));
  return `<section class="macro-timing-panel" id="quant-macro">
    <h2>${esc(t(locale, "macroTimingTitle"))}</h2>
    <p class="muted tiny">${esc(t(locale, "macroTimingLead"))}</p>
    ${
      !rows.length
        ? `<p class="muted">—</p>`
        : `<div class="table-wrap"><table class="agent-table">
      <thead><tr>
        <th>ETF</th>
        <th>Index</th>
        <th>Score</th>
        <th>Bull</th>
        <th>Bear</th>
        <th>n</th>
      </tr></thead>
      <tbody>
        ${rows
          .map((r) => {
            const name =
              locale === "zh"
                ? bySym.get(r.symbol)?.nameZh ?? r.symbol
                : bySym.get(r.symbol)?.nameEn ?? r.symbol;
            return `<tr>
              <td><a href="#/asset/${encodeURIComponent(r.symbol)}">${esc(name)}</a></td>
              <td><a href="#/asset/${encodeURIComponent(r.indexSymbol)}">${esc(r.indexSymbol)}</a></td>
              <td><strong>${r.score}</strong></td>
              <td>${r.bullHits}</td>
              <td>${r.bearHits}</td>
              <td>${r.constituentsWithHits}/${r.constituentCount}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
    <p class="muted tiny">${esc(rows[0]?.literacy[locale] ?? t(locale, "etfProxyNote"))}</p>`
    }
  </section>`;
}

function renderRotationPanel(locale: Locale, data: LatestPayload): string {
  const rot = data.rotation;
  if (!rot) {
    return `<section class="rotation-panel" id="quant-rotation">
      <h2>${esc(t(locale, "rotationTitle"))}</h2>
      <p class="muted">${esc(t(locale, "rotationLead"))}</p>
    </section>`;
  }
  const cards: Array<{
    key: keyof NonNullable<LatestPayload["rotation"]>;
    title: string;
  }> = [
    { key: "daily", title: t(locale, "rotationDaily") },
    { key: "fixed_5d", title: t(locale, "rotationFixed5d") },
    {
      key: "dailyTimed",
      title: `${t(locale, "rotationDaily")} + ${t(locale, "rotationWithTiming")}`,
    },
    {
      key: "fixed_5dTimed",
      title: `${t(locale, "rotationFixed5d")} + ${t(locale, "rotationWithTiming")}`,
    },
  ];
  return `<section class="rotation-panel" id="quant-rotation">
    <h2>${esc(t(locale, "rotationTitle"))}</h2>
    <p class="muted tiny">${esc(t(locale, "rotationLead"))}</p>
    <div class="screens-grid rotation-grid">
      ${cards
        .map(({ key, title }) => {
          const m = rot[key];
          const weights = Object.entries(m.lastWeights)
            .map(([sym, w]) => `${sym} ${(w * 100).toFixed(0)}%`)
            .join(" · ");
          return `<article class="screen-card">
            <h3>${esc(title)}</h3>
            <p class="muted tiny">ret ${esc(fmtRet(m.totalReturn))} · DD ${esc(fmtRet(m.maxDrawdown))} · turns ${m.turns}</p>
            <p class="tiny">${esc(weights || "—")}</p>
          </article>`;
        })
        .join("")}
    </div>
    <div class="cta-row wrap">
      <button type="button" class="btn btn-primary" id="rotation-paper">${esc(t(locale, "sendRotationPaper"))}</button>
    </div>
  </section>`;
}

function renderPatternMonitor(locale: Locale, data: LatestPayload): string {
  const mon = data.patternMonitor;
  const hits = mon?.newHits ?? [];
  return `<section class="pattern-monitor-panel" id="quant-monitor">
    <h2>${esc(t(locale, "patternMonitorTitle"))}</h2>
    <p class="muted tiny">${esc(t(locale, "patternMonitorLead"))}
      ${mon?.priorGeneratedAt ? ` · prior ${esc(mon.priorGeneratedAt.slice(0, 19))}` : ""}</p>
    ${
      !hits.length
        ? `<p class="muted">—</p>`
        : `<ul class="pattern-list">${hits
            .slice(0, 12)
            .map((h) => {
              const label =
                locale === "zh"
                  ? PATTERN_META[h.patternId as keyof typeof PATTERN_META]?.zh ??
                    h.patternId
                  : PATTERN_META[h.patternId as keyof typeof PATTERN_META]?.en ??
                    h.patternId;
              return `<li><a href="#/asset/${encodeURIComponent(h.symbol)}">${esc(h.symbol)}</a>
                <span class="chip">${esc(label)}</span> <time>${esc(h.date)}</time></li>`;
            })
            .join("")}</ul>`
    }
  </section>`;
}

/** Quant tool home — former site facade, now at /quant only. */
export function renderQuant(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
  indices: IndicesPayload | null = null,
  screens: ScreensPayload | null = null,
  factors: FactorsPayload | null = null,
  recipes: RecipesPayload | null = null,
  announcements: AnnouncementsPayload | null = null,
  iwencaiNews: IwencaiNewsPayload | null = null,
  factorsIc: FactorsIcPayload | null = null,
): void {
  destroyLabChart();
  const bullets = locale === "zh" ? data.dailyReview.zh : data.dailyReview.en;
  const groups: SymbolRow["group"][] = ["macro", "china-etf", "china-ashare"];
  const tradeable = data.symbols.filter(
    (s) => s.dataStatus !== "missing" && s.candles.length >= 60,
  );
  const strategies = Object.keys(STRATEGY_META) as StrategyId[];
  const heat = patternHeatmap(
    data.symbols.filter((s) => s.dataStatus !== "missing"),
  );
  const heatSymbols = data.symbols
    .filter((s) => s.dataStatus !== "missing")
    .map((s) => s.symbol);
  const stale = isStaleVsReport(data);

  const parsedLab = parseLabParams(location.hash);
  const panelTarget =
    QUANT_PANEL_IDS[readHashQuery().get("panel") ?? ""] ?? "";
  let scrolledPanel = false;
  let biasFilter: "all" | "bull" | "bear" | "neutral" = "all";
  let sortKey: "confluence" | "rsi" | "bias" = "confluence";
  let labStrategy: StrategyId =
    parsedLab.lab && strategies.includes(parsedLab.lab)
      ? parsedLab.lab
      : (strategies[0] ?? "ma_cross");
  let labSymbol: string = tradeable[0]?.symbol ?? "";
  let labSlip: SlippageModel = "fixed";
  let labParams: StrategyParams = { ...parsedLab.params };
  let studioSliders: StudioSliderState = slidersFromWeights(
    defaultStudioWeights(),
  );
  let studioTopN = Math.min(15, Math.max(5, factors?.topN ?? 8));
  let studioUseIc = false;
  let studioRecipes = loadRecipes();

  const ashareTradeable = data.symbols.filter(
    (s) =>
      s.group === "china-ashare" &&
      s.dataStatus !== "missing" &&
      s.candles.length >= 60,
  );

  const studioRanked = (): FactorScores[] => {
    if (!factors?.factors?.length) return [];
    const base = weightsFromSliders(studioSliders);
    const w = resolveStudioWeights(base, studioUseIc, factorsIc);
    return rankWithWeights(factors.factors, w, studioTopN);
  };

  const committeeResults = (): CommitteeResult[] =>
    rankCommittee(
      ashareTradeable.length ? ashareTradeable : tradeable,
      {
        factors: factors?.factors,
        announcements: announcements?.items,
        news: iwencaiNews?.items,
      },
      8,
    );

  const readComposerFromDom = (): StrategyParams => {
    const num = (id: string): number | undefined => {
      const el = root.querySelector(`#${id}`) as HTMLInputElement | null;
      if (!el || el.value === "") return undefined;
      const n = Number(el.value);
      return Number.isFinite(n) ? n : undefined;
    };
    const next: StrategyParams = { ...labParams };
    const fast = num("p-fast");
    const slow = num("p-slow");
    const rsi = num("p-rsi");
    const os = num("p-os");
    const ob = num("p-ob");
    const thr = num("p-thr");
    const lags = num("p-lags");
    const shrink = num("p-shrink");
    if (fast != null) next.maFast = fast;
    if (slow != null) next.maSlow = slow;
    if (rsi != null) next.rsiPeriod = rsi;
    if (os != null) next.rsiOs = os;
    if (ob != null) next.rsiOb = ob;
    if (thr != null) next.confThreshold = thr;
    if (lags != null) next.mlLags = lags;
    if (shrink != null) next.mlShrink = shrink;
    return next;
  };

  const paperBatchSymbols = (syms: string[], note: string): number => {
    let state = loadPaperState();
    const lastClose: Record<string, number> = {};
    for (const s of data.symbols) {
      if (s.lastClose) lastClose[s.symbol] = s.lastClose;
    }
    const eq = equityMark(state, lastClose);
    let applied = 0;
    for (const sym of syms) {
      const s = data.symbols.find((r) => r.symbol === sym);
      if (!s) continue;
      const sigDate = signalDateForRow(s);
      const fill = resolveNextOpenFill(s.candles, sigDate);
      if (!fill || fill.fillRule !== "next_open") continue;
      const budget = eq * 0.01;
      const rawQty = budget / fill.fillPrice;
      const norm = normalizeQty(rawQty, s.group);
      if (norm.error || !norm.qty) continue;
      const r = applyBuy(state, {
        symbol: s.symbol,
        qty: norm.qty,
        fill,
        source: "checklist",
        note,
        lastCloseBySymbol: lastClose,
      });
      if (r.ok) {
        state = r.state;
        applied += 1;
      }
    }
    savePaperState(state);
    return applied;
  };

  /** Map Iwencai screen codes (600519.SH) onto baked Yahoo symbols (600519.SS). */
  const resolveScreenSymbols = (codes: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of codes) {
      const code = raw.trim().toUpperCase();
      const bare = code.replace(/\.(SH|SS|SZ)$/i, "");
      const hit = data.symbols.find((s) => {
        const sym = s.symbol.toUpperCase();
        return (
          sym === code ||
          sym === `${bare}.SS` ||
          sym === `${bare}.SZ` ||
          sym.startsWith(`${bare}.`)
        );
      });
      if (hit && !seen.has(hit.symbol)) {
        seen.add(hit.symbol);
        out.push(hit.symbol);
      }
    }
    return out;
  };

  const boardRows = (): SymbolRow[] => {
    let rows = data.symbols.filter(
      (s) => s.signals && s.dataStatus !== "missing",
    );
    if (biasFilter !== "all") {
      rows = rows.filter((s) => s.signals?.bias === biasFilter);
    }
    rows = [...rows].sort((a, b) => {
      if (sortKey === "confluence") {
        return confluenceScore(b) - confluenceScore(a);
      }
      if (sortKey === "rsi") {
        return (b.signals?.rsi14 ?? 0) - (a.signals?.rsi14 ?? 0);
      }
      const rank = (x: SymbolRow) =>
        x.signals?.bias === "bull" ? 0 : x.signals?.bias === "bear" ? 2 : 1;
      return rank(a) - rank(b);
    });
    return rows;
  };

  const paint = (flash?: string): void => {
    destroyLabChart();
    const board = boardRows();
    const checklist = board
      .filter((s) => s.signals?.bias !== "neutral")
      .slice(0, 12);

    const body = `
      <h1>${esc(t(locale, "quantTitle"))}</h1>
      <p class="lead">${esc(t(locale, "quantSubtitle"))}</p>
      ${renderSkillsOpsBar(locale, {
        latest: data.generatedAt,
        factors: factors?.generatedAt,
        factorsIc: factorsIc?.generatedAt,
        indices: indices?.generatedAt,
        screens: screens?.generatedAt,
        announcements: announcements?.generatedAt,
        iwencaiNews: iwencaiNews?.generatedAt,
      })}
      ${renderIndicesStrip(locale, indices)}
      ${renderMacroTimingPanel(locale, data)}
      ${renderRotationPanel(locale, data)}
      ${renderPatternMonitor(locale, data)}
      ${
        stale
          ? `<div class="banner-stale">${esc(t(locale, "staleBanner"))}</div>`
          : ""
      }
      <div class="banner-stale">${esc(t(locale, "survivorshipBanner"))}</div>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
      <div class="stats-row">
        <div class="stat"><span class="stat-n">${data.stats.symbolsOk}</span><span class="stat-l">${esc(t(locale, "statsOk"))}</span></div>
        <div class="stat"><span class="stat-n">${data.stats.symbolsStale}</span><span class="stat-l">${esc(t(locale, "statsStale"))}</span></div>
        <div class="stat"><span class="stat-n">${data.stats.symbolsMissing}</span><span class="stat-l">${esc(t(locale, "statsMissing"))}</span></div>
        <div class="stat"><span class="stat-n">${data.stats.patternHits}</span><span class="stat-l">${esc(t(locale, "statsPatterns"))}</span></div>
      </div>
      ${renderFilingsStub(locale, announcements)}
      ${renderScreensPanel(locale, screens)}
      ${renderIcPanel(locale, factorsIc)}
      ${renderCorrHeatmap(locale, factorsIc)}
      ${renderFactorStudio(
        locale,
        factors,
        studioSliders,
        studioTopN,
        studioUseIc,
        factorsIc,
        studioRecipes,
      )}
      ${renderCommitteeDesk(locale, committeeResults())}
      ${renderAlphaRecipeCards(locale)}
      ${renderAdfStrip(locale, factors)}
      ${renderRecipeCards(locale, recipes)}
      <section class="review" id="quant-review">
        <h2>${esc(t(locale, "dailyReview"))}</h2>
        <p class="muted tiny">${esc(data.reportDate)} · ${esc(data.generatedAt.slice(0, 19))}Z</p>
        <ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </section>

      <section class="strategy-lab" id="quant-lab">
        <h2>${esc(t(locale, "strategyLab"))}</h2>
        <p class="muted tiny">signal t close → fill t+1 open · long-only · 60/40 walk-forward · ${esc(t(locale, "slipNote"))}</p>
        <div class="lab-controls cta-row wrap">
          <label>Strategy
            <select id="lab-strategy">
              ${strategies
                .map((id) => {
                  const label =
                    locale === "zh"
                      ? STRATEGY_META[id].zh
                      : STRATEGY_META[id].en;
                  const sel = id === labStrategy ? " selected" : "";
                  return `<option value="${esc(id)}"${sel}>${esc(label)}</option>`;
                })
                .join("")}
            </select>
          </label>
          <label>Symbol
            <select id="lab-symbol">
              ${tradeable
                .map((s) => {
                  const name = locale === "zh" ? s.nameZh : s.nameEn;
                  const sel = s.symbol === labSymbol ? " selected" : "";
                  return `<option value="${esc(s.symbol)}"${sel}>${esc(s.symbol)} · ${esc(name)}</option>`;
                })
                .join("")}
            </select>
          </label>
          <label>${esc(t(locale, "slipModel"))}
            <select id="lab-slip">
              <option value="fixed"${labSlip === "fixed" ? " selected" : ""}>${esc(t(locale, "slipFixed"))}</option>
              <option value="sqrt"${labSlip === "sqrt" ? " selected" : ""}>${esc(t(locale, "slipSqrt"))}</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary" id="lab-run">${esc(t(locale, "strategyRun"))}</button>
          <button type="button" class="btn" id="lab-send" ${lastLabResult ? "" : "disabled"}>${esc(t(locale, "strategySendPaper"))}</button>
        </div>
        ${composerParamsHtml(locale, labStrategy, labParams)}
        <div id="lab-metrics">${lastLabResult ? metricsHtml(locale, lastLabResult) : ""}</div>
        <div id="factor-box" class="factor-box">
          ${(() => {
            const row = data.symbols.find((s) => s.symbol === labSymbol);
            if (!row) return "";
            const bench = resolveBenchmark(data.symbols);
            const ex = exposuresForRow(row, bench, data.symbols);
            return `<h3>${esc(t(locale, "factorBox"))}</h3>
              <p class="muted tiny">${esc(t(locale, "hmlProxyNote"))}</p>
              <ul class="tiny">
                <li>β ${ex.marketBeta == null ? "—" : ex.marketBeta.toFixed(2)} vs ${esc(ex.labels.market)}</li>
                <li>Size ${ex.sizeScore == null ? "—" : ex.sizeScore.toFixed(2)} (${esc(ex.labels.size)})</li>
                <li>Value ${ex.valueScore == null ? "—" : ex.valueScore.toFixed(2)} (${esc(ex.labels.value)})</li>
              </ul>`;
          })()}
        </div>
        <div class="chart-shell equity-shell"><div id="lab-chart" class="chart equity-chart"></div></div>
      </section>

      <section class="signal-board" id="quant-signals">
        <h2>${esc(t(locale, "signalBoard"))}</h2>
        <div class="filter-bar cta-row wrap">
          <label>${esc(t(locale, "filterBias"))}
            <select id="f-bias">
              <option value="all"${biasFilter === "all" ? " selected" : ""}>All</option>
              <option value="bull"${biasFilter === "bull" ? " selected" : ""}>${esc(t(locale, "biasBull"))}</option>
              <option value="bear"${biasFilter === "bear" ? " selected" : ""}>${esc(t(locale, "biasBear"))}</option>
              <option value="neutral"${biasFilter === "neutral" ? " selected" : ""}>${esc(t(locale, "biasNeutral"))}</option>
            </select>
          </label>
          <label>Sort
            <select id="f-sort">
              <option value="confluence"${sortKey === "confluence" ? " selected" : ""}>${esc(t(locale, "confluence"))}</option>
              <option value="rsi"${sortKey === "rsi" ? " selected" : ""}>RSI</option>
              <option value="bias"${sortKey === "bias" ? " selected" : ""}>${esc(t(locale, "filterBias"))}</option>
            </select>
          </label>
        </div>
        <div class="table-wrap"><table class="agent-table">
          <thead><tr>
            <th>Symbol</th><th>Bias</th><th>${esc(t(locale, "confluence"))}</th>
            <th>RSI</th><th>MA</th><th>Tags</th><th></th>
          </tr></thead>
          <tbody>
            ${board
              .map((s) => {
                const name = locale === "zh" ? s.nameZh : s.nameEn;
                const sig = s.signals!;
                const conf = confluenceScore(s);
                const patConf = patternConfluenceAbs(s.recentPatterns);
                const sigDate = signalDateForRow(s);
                return `<tr>
                  <td><a href="#/asset/${encodeURIComponent(s.symbol)}">${esc(s.symbol)}</a><div class="muted tiny">${esc(name)}</div></td>
                  <td><span class="chip chip-${sig.bias === "neutral" ? "neutral" : sig.bias === "bull" ? "bull" : "bear"}">${esc(biasLabel(locale, sig.bias))}</span></td>
                  <td>${conf} <span class="muted tiny">/${patConf}</span></td>
                  <td>${sig.rsi14 == null ? "—" : sig.rsi14.toFixed(1)}</td>
                  <td>${esc(sig.maAlign)}</td>
                  <td class="tiny">${esc(sig.tags.join(", ") || "—")}</td>
                  <td><a class="btn" href="${esc(paperHref(s.symbol, sigDate))}">${esc(t(locale, "openPaper"))}</a></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>
      </section>

      <section class="heatmap-section">
        <h2>${esc(t(locale, "heatmap"))}</h2>
        <div class="table-wrap heatmap-wrap"><table class="agent-table heatmap-table">
          <thead><tr><th>Pattern</th>${heatSymbols.map((sym) => `<th class="tiny">${esc(sym.split(".")[0])}</th>`).join("")}</tr></thead>
          <tbody>
            ${heat
              .map((row) => {
                const pid = row.patternId as PatternId;
                const label =
                  PATTERN_META[pid]
                    ? locale === "zh"
                      ? PATTERN_META[pid].zh
                      : PATTERN_META[pid].en
                    : row.patternId;
                return `<tr>
                  <td class="tiny">${esc(label)}</td>
                  ${heatSymbols
                    .map((sym) => {
                      const n = row.counts[sym] ?? 0;
                      const cls = n >= 3 ? "heat-hi" : n === 2 ? "heat-mid" : n === 1 ? "heat-lo" : "";
                      return `<td class="heat-cell ${cls}">${n || ""}</td>`;
                    })
                    .join("")}
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>
      </section>

      <section class="tomorrow-list">
        <h2>${esc(t(locale, "tomorrowList"))}</h2>
        <p class="muted tiny">${esc(t(locale, "paperDisclaimer"))}</p>
        <div class="cta-row wrap">
          <button type="button" class="btn btn-primary" id="batch-paper">${esc(t(locale, "paperBatch"))}</button>
          <button type="button" class="btn" id="batch-csv">${esc(t(locale, "paperExportCsv"))}</button>
        </div>
        <ul id="checklist">
          ${
            checklist.length
              ? checklist
                  .map((s) => {
                    const side =
                      s.signals?.bias === "bear" ? "sell/watch" : "buy/watch";
                    const sigDate = signalDateForRow(s);
                    return `<li data-symbol="${esc(s.symbol)}" data-bias="${esc(s.signals?.bias ?? "neutral")}">
                      <strong>${esc(s.symbol)}</strong> — ${esc(side)} @ next open
                      · conf ${confluenceScore(s)}
                      · <a href="${esc(paperHref(s.symbol, sigDate))}">${esc(t(locale, "openPaper"))}</a>
                    </li>`;
                  })
                  .join("")
              : `<li class="muted">—</li>`
          }
        </ul>
      </section>
      ${groups
        .map((g) => {
          const rows = data.symbols.filter((s) => s.group === g);
          if (!rows.length) return "";
          return `<section class="group">
            <h2>${esc(groupLabel(locale, g))}</h2>
            <div class="card-list">${rows.map((s) => cardHtml(locale, s)).join("")}</div>
          </section>`;
        })
        .join("")}
    `;

    root.innerHTML = renderShell(locale, "quant", body, {
      subtitle: t(locale, "quantSubtitle"),
    });
    document.title = `${t(locale, "quantTitle")} · Supro`;

    root.querySelector("#f-bias")?.addEventListener("change", (e) => {
      biasFilter = (e.target as HTMLSelectElement).value as typeof biasFilter;
      paint();
    });
    root.querySelector("#f-sort")?.addEventListener("change", (e) => {
      sortKey = (e.target as HTMLSelectElement).value as typeof sortKey;
      paint();
    });

    root.querySelectorAll<HTMLInputElement>("[data-studio-key]").forEach((el) => {
      el.addEventListener("input", () => {
        const key = el.dataset.studioKey as keyof StudioSliderState;
        studioSliders = { ...studioSliders, [key]: Number(el.value) };
        const label = root.querySelector(`[data-slider-val="${key}"]`);
        if (label) label.textContent = String(el.value);
      });
      el.addEventListener("change", () => {
        const key = el.dataset.studioKey as keyof StudioSliderState;
        studioSliders = { ...studioSliders, [key]: Number(el.value) };
        paint();
      });
    });
    root.querySelector("#studio-topn")?.addEventListener("change", (e) => {
      studioTopN = Number((e.target as HTMLSelectElement).value);
      paint();
    });
    root.querySelector("#studio-use-ic")?.addEventListener("change", (e) => {
      studioUseIc = (e.target as HTMLInputElement).checked;
      paint();
    });
    root.querySelectorAll<HTMLButtonElement>(".studio-tilt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.tilt as FactorTiltId;
        if (id === "ic") {
          studioUseIc = true;
          studioSliders = slidersFromWeights(defaultStudioWeights());
        } else {
          studioUseIc = false;
          studioSliders = slidersFromWeights(FACTOR_TILTS[id]);
        }
        paint();
      });
    });
    root.querySelector("#studio-save")?.addEventListener("click", () => {
      const nameEl = root.querySelector(
        "#studio-recipe-name",
      ) as HTMLInputElement | null;
      const name =
        nameEl?.value?.trim() ||
        `recipe-${new Date().toISOString().slice(0, 10)}`;
      const recipe: FactorRecipe = {
        id: `r-${Date.now()}`,
        name,
        topN: studioTopN,
        useIc: studioUseIc,
        weights: weightsFromSliders(studioSliders),
        savedAt: new Date().toISOString(),
      };
      studioRecipes = [recipe, ...studioRecipes.filter((r) => r.name !== name)];
      saveRecipes(studioRecipes);
      paint(locale === "zh" ? `已保存配方 ${name}` : `Saved recipe ${name}`);
    });
    root.querySelector("#studio-load")?.addEventListener("change", (e) => {
      const id = (e.target as HTMLSelectElement).value;
      const recipe = studioRecipes.find((r) => r.id === id);
      if (!recipe) return;
      studioSliders = slidersFromWeights(recipe.weights);
      studioTopN = Math.min(15, Math.max(5, recipe.topN));
      studioUseIc = recipe.useIc;
      paint(locale === "zh" ? `已加载 ${recipe.name}` : `Loaded ${recipe.name}`);
    });
    root.querySelector("#studio-export")?.addEventListener("click", () => {
      const payload = {
        topN: studioTopN,
        useIc: studioUseIc,
        weights: resolveStudioWeights(
          weightsFromSliders(studioSliders),
          studioUseIc,
          factorsIc,
        ),
        ranked: studioRanked().map((f) => ({
          symbol: f.symbol,
          rank: f.rank,
          composite: f.composite,
        })),
        recipes: studioRecipes,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenter-factor-studio-${data.reportDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    root.querySelector("#studio-topn-paper")?.addEventListener("click", () => {
      const syms = studioRanked().map((f) => f.symbol);
      const n = paperBatchSymbols(syms, "studio TopN 1% equity");
      paint(
        locale === "zh"
          ? `工作室 TopN 纸盘买入 ${n} 票`
          : `Papered ${n} Factor Studio TopN names`,
      );
    });

    root.querySelector("#screens-all-paper")?.addEventListener("click", () => {
      const codes = (screens?.screens ?? []).flatMap((p) =>
        p.tickers.map((tk) => tk.code),
      );
      const syms = resolveScreenSymbols(codes);
      const n = paperBatchSymbols(syms, "screen:all 1% equity");
      paint(
        locale === "zh"
          ? `精选屏合计纸盘买入 ${n} 票（宇宙内可映射）`
          : `Papered ${n} screen hits in bake universe`,
      );
    });
    root.querySelectorAll<HTMLButtonElement>("[data-screen-paper]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.screenPaper ?? "";
        const panel = (screens?.screens ?? []).find((p) => p.id === id);
        if (!panel) return;
        const syms = resolveScreenSymbols(panel.tickers.map((tk) => tk.code));
        const n = paperBatchSymbols(syms, `screen:${id} 1% equity`);
        paint(
          locale === "zh"
            ? `精选屏「${panel.nameZh}」纸盘买入 ${n} 票`
            : `Papered ${n} from screen ${panel.nameEn}`,
        );
      });
    });

    root
      .querySelector("#committee-promote-json")
      ?.addEventListener("click", () => {
        const bulls = committeeResults().filter((r) => r.bias === "bull");
        const rows = bulls.map((r) => ({
          symbol: r.symbol,
          side: "buy" as const,
          qty: 100,
          orderType: "market_next_open" as const,
          limitOrMarket: "market" as const,
          intendedSession: "next_open",
          notes:
            locale === "zh"
              ? `委员会共识 ${r.consensus.toFixed(2)}；人工【次日开盘】核对；本站不下单。`
              : `Committee consensus ${r.consensus.toFixed(2)}; human NEXT OPEN checklist — site never submits.`,
        }));
        downloadChecklistRows(rows, "json", "agenter-committee-checklist");
        paint(
          locale === "zh"
            ? `已导出偏多 ${rows.length} 条委员会清单`
            : `Exported ${rows.length} bullish committee rows`,
        );
      });
    root
      .querySelector("#committee-promote-paper")
      ?.addEventListener("click", () => {
        const bulls = committeeResults()
          .filter((r) => r.bias === "bull")
          .map((r) => r.symbol);
        const n = paperBatchSymbols(bulls, "committee bullish 1% equity");
        paint(
          locale === "zh"
            ? `委员会偏多纸盘买入 ${n} 票`
            : `Papered ${n} committee bullish names`,
        );
      });

    root.querySelector("#lab-strategy")?.addEventListener("change", (e) => {
      labParams = readComposerFromDom();
      labStrategy = (e.target as HTMLSelectElement).value as StrategyId;
      paint();
    });

    const mountLabChart = (res: BacktestResult): void => {
      const el = root.querySelector("#lab-chart") as HTMLElement | null;
      if (!el || !res.equity.length) return;
      destroyLabChart();
      labChart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: "#f7fbf8" },
          textColor: "#12231f",
        },
        width: el.clientWidth,
        height: 220,
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        grid: {
          vertLines: { color: "rgba(18,35,31,0.06)" },
          horzLines: { color: "rgba(18,35,31,0.06)" },
        },
      });
      const start = res.equity[0].value;
      const line = labChart.addLineSeries({
        color: "#0b6e4f",
        lineWidth: 2,
      });
      line.setData(
        res.equity.map((p) => ({
          time: p.time as Time,
          value: ((p.value - start) / start) * 100,
        })),
      );
      line.setMarkers(
        res.trades.map((tr) => ({
          time: tr.fillDate as Time,
          position: tr.side === "buy" ? "belowBar" : "aboveBar",
          color: tr.side === "buy" ? "#15803d" : "#b91c1c",
          shape: tr.side === "buy" ? "arrowUp" : "arrowDown",
          text: tr.side.toUpperCase(),
        })),
      );
      labChart.timeScale().fitContent();
    };

    if (lastLabResult) mountLabChart(lastLabResult);

    root.querySelector("#lab-run")?.addEventListener("click", () => {
      labStrategy = (
        root.querySelector("#lab-strategy") as HTMLSelectElement
      ).value as StrategyId;
      labSymbol = (root.querySelector("#lab-symbol") as HTMLSelectElement)
        .value;
      labSlip = ((root.querySelector("#lab-slip") as HTMLSelectElement)
        ?.value ?? "fixed") as SlippageModel;
      labParams = readComposerFromDom();
      const row = data.symbols.find((s) => s.symbol === labSymbol);
      if (!row || row.candles.length < 60) {
        paint(locale === "zh" ? "K线不足" : "Not enough candles");
        return;
      }
      lastLabResult = runBacktest({
        strategyId: labStrategy,
        symbol: labSymbol,
        candles: row.candles,
        costConfig: {
          ...DEFAULT_COST_CONFIG,
          slippageModel: labSlip,
        },
        params: labParams,
      });
      paint(
        locale === "zh"
          ? `回测完成 · ${lastLabResult.trades.length} 笔 · ${labSlip === "sqrt" ? "√冲击" : "固定bps"}`
          : `Backtest done · ${lastLabResult.trades.length} fills · ${labSlip}`,
      );
    });

    root.querySelector("#lab-send")?.addEventListener("click", () => {
      if (!lastLabResult?.trades.length) return;
      const gate = evaluateBacktestGates({
        costModelEnabled: lastLabResult.costModelEnabled,
        fillRuleAllNextOpen: lastLabResult.trades.every(
          (t) => t.fillRule === "next_open",
        ),
        usedPurgedWf: lastLabResult.usedPurgedWf,
        rawSharpe: lastLabResult.oosMetrics.sharpe,
        haircutSharpe: lastLabResult.haircutSharpe,
        isReturn: lastLabResult.isMetrics.totalReturnPct,
        oosReturn: lastLabResult.oosMetrics.totalReturnPct,
        oosSharpe: lastLabResult.oosMetrics.sharpe,
        maxDdPct: lastLabResult.oosMetrics.maxDrawdownPct,
      });
      if (!gate.okForActionable) {
        paint(
          locale === "zh"
            ? "门禁拦截：结果不可作实操建议"
            : "Gate blocked: not actionable",
        );
        return;
      }
      let state = loadPaperState();
      const chrono = [...lastLabResult.trades].sort((a, b) =>
        a.fillDate.localeCompare(b.fillDate),
      );
      let applied = 0;
      for (const tr of chrono) {
        const fill = {
          fillPrice: tr.fillPrice,
          fillDate: tr.fillDate,
          fillRule: tr.fillRule as "next_open",
          signalDate: tr.signalDate,
        };
        if (tr.side === "buy") {
          const r = applyBuy(state, {
            symbol: tr.symbol,
            qty: tr.qty,
            fill,
            source: "backtest",
            note: `lab:${lastLabResult.strategyId}`,
          });
          if (r.ok) {
            state = r.state;
            applied += 1;
          }
        } else {
          const r = applySell(state, {
            symbol: tr.symbol,
            qty: tr.qty,
            fill,
            source: "backtest",
            note: `lab:${lastLabResult.strategyId}`,
          });
          if (r.ok) {
            state = r.state;
            applied += 1;
          }
        }
      }
      savePaperState(state);
      paint(
        locale === "zh"
          ? `已写入纸盘 ${applied}/${chrono.length} 笔`
          : `Sent ${applied}/${chrono.length} fills to Paper`,
      );
    });

    root.querySelector("#batch-paper")?.addEventListener("click", () => {
      let state = loadPaperState();
      const lastClose: Record<string, number> = {};
      for (const s of data.symbols) {
        if (s.lastClose) lastClose[s.symbol] = s.lastClose;
      }
      const eq = equityMark(state, lastClose);
      let applied = 0;
      for (const s of checklist) {
        if (s.signals?.bias !== "bull") continue;
        const sigDate = signalDateForRow(s);
        const fill = resolveNextOpenFill(s.candles, sigDate);
        if (!fill || fill.fillRule !== "next_open") continue;
        const budget = eq * 0.01;
        const rawQty = budget / fill.fillPrice;
        const norm = normalizeQty(rawQty, s.group);
        if (norm.error || !norm.qty) continue;
        const r = applyBuy(state, {
          symbol: s.symbol,
          qty: norm.qty,
          fill,
          source: "checklist",
          note: "batch 1% equity",
          lastCloseBySymbol: lastClose,
        });
        if (r.ok) {
          state = r.state;
          applied += 1;
        }
      }
      savePaperState(state);
      paint(
        locale === "zh"
          ? `清单纸盘买入 ${applied} 票`
          : `Papered ${applied} checklist names`,
      );
    });

    root.querySelector("#batch-csv")?.addEventListener("click", () => {
      const lines = [
        "symbol,side,signal_date,fill_rule,note",
        ...checklist.map((s) => {
          const side = s.signals?.bias === "bear" ? "sell/watch" : "buy/watch";
          const sig = signalDateForRow(s);
          return `${s.symbol},${side},${sig},next_open,checklist`;
        }),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenter-tomorrow-${data.reportDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    root.querySelector("#rotation-paper")?.addEventListener("click", () => {
      const weights =
        data.rotation?.fixed_5d.lastWeights ??
        data.rotation?.daily.lastWeights ??
        {};
      const syms = Object.keys(weights);
      let state = loadPaperState();
      const lastClose: Record<string, number> = {};
      for (const s of data.symbols) {
        if (s.lastClose) lastClose[s.symbol] = s.lastClose;
      }
      const eq = equityMark(state, lastClose);
      let applied = 0;
      for (const sym of syms) {
        const row = data.symbols.find((s) => s.symbol === sym);
        if (!row || row.dataStatus === "missing") continue;
        const sigDate = signalDateForRow(row);
        const fill = resolveNextOpenFill(row.candles, sigDate);
        if (!fill || fill.fillRule !== "next_open") continue;
        const budget = eq * 0.01;
        const rawQty = budget / fill.fillPrice;
        const norm = normalizeQty(rawQty, row.group);
        if (norm.error || !norm.qty) continue;
        const r = applyBuy(state, {
          symbol: sym,
          qty: norm.qty,
          fill,
          source: "checklist",
          note: "rotation lab",
          lastCloseBySymbol: lastClose,
        });
        if (r.ok) {
          state = r.state;
          applied += 1;
        }
      }
      savePaperState(state);
      paint(
        locale === "zh"
          ? `轮动清单纸盘买入 ${applied} 票`
          : `Papered ${applied} rotation names`,
      );
    });

    if (panelTarget && !scrolledPanel) {
      scrolledPanel = true;
      scrollToId(panelTarget);
    }
  };

  paint();
}
