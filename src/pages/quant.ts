import {
  ColorType,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";

import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  runBacktest,
  STRATEGY_META,
  type BacktestResult,
  type StrategyId,
} from "../lib/backtest/engine";
import { exposuresForRow, resolveBenchmark } from "../lib/factors/ff-proxy";
import {
  compositeFromWeights,
  type FactorsPayload,
  type FactorScores,
} from "../lib/factors/cross-section";
import {
  FACTOR_TILTS,
  icWeightVector,
  type FactorTiltId,
  type FactorsIcPayload,
} from "../lib/factors/ic";
import { PATTERN_META, type PatternId } from "../lib/patterns/types";
import { patternConfluenceAbs } from "../lib/patterns/confluence";
import {
  DEFAULT_COST_CONFIG,
  type SlippageModel,
} from "../lib/paper/costs";
import {
  applyBuy,
  applySell,
  equityMark,
  normalizeQty,
  resolveNextOpenFill,
} from "../lib/paper/engine";
import { defaultSignalDate } from "../lib/paper/equity";
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
  return `<section class="filings-stub">
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
  return `<section class="ic-panel">
    <h2>${esc(t(locale, "icPanel"))}</h2>
    <p class="muted tiny">${esc(t(locale, "icPanelLead"))}</p>
    <p class="muted tiny">${esc(attr)} · horizon ${ic.horizonBars}d · ${esc(fmtIsoSlice(ic.generatedAt))}</p>
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

function tiltWeights(
  tilt: FactorTiltId,
  ic: FactorsIcPayload | null,
): {
  momentum: number;
  lowVol: number;
  sizeAdv: number;
  quality: number;
  peProxy?: number;
  pbProxy?: number;
} {
  if (tilt === "ic") return icWeightVector(ic);
  return FACTOR_TILTS[tilt];
}

function rankedFactors(
  factors: FactorsPayload | null,
  tilt: FactorTiltId,
  ic: FactorsIcPayload | null,
): FactorScores[] {
  if (!factors?.factors?.length) return [];
  const w = tiltWeights(tilt, ic);
  const rescored = factors.factors.map((f) => {
    const composite = compositeFromWeights(f, w);
    return { ...f, composite };
  });
  rescored.sort((a, b) => (b.composite ?? -999) - (a.composite ?? -999));
  return rescored.map((f, i) => ({
    ...f,
    rank: f.composite == null ? null : i + 1,
  }));
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
          return `<div class="index-chip ${cls}">
            <span class="index-name">${esc(name)}</span>
            <span class="index-last">${esc(fmtLast(ix.last))}</span>
            <span class="index-chg">${esc(fmtPct(ix.changePct))}</span>
          </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

function renderScreensPanel(
  locale: Locale,
  screens: ScreensPayload | null,
): string {
  const panels = screens?.screens ?? [];
  return `<section class="screens-panel">
    <h2>${esc(t(locale, "screensTitle"))}</h2>
    <p class="muted tiny">${esc(t(locale, "screensLead"))}</p>
    <p class="muted tiny">${esc(screens?.generatedAt?.slice(0, 19) ?? "")} · ${esc(t(locale, "iwencaiSource"))}</p>
    ${
      !panels.length
        ? `<p class="muted">${esc(t(locale, "screensEmpty"))}</p>`
        : `<div class="screens-grid">
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
          </article>`;
        })
        .join("")}
    </div>`
    }
  </section>`;
}

function fmtZ(v: number | null): string {
  return v == null ? "—" : v.toFixed(2);
}

function renderFactorBoard(
  locale: Locale,
  factors: FactorsPayload | null,
  tilt: FactorTiltId,
  factorsIc: FactorsIcPayload | null,
): string {
  if (!factors?.factors?.length) return "";
  const ranked = rankedFactors(factors, tilt, factorsIc);
  const top = ranked.filter((f) => f.composite != null).slice(0, factors.topN ?? 8);
  const attr = locale === "zh" ? factors.attribution.zh : factors.attribution.en;
  const tiltOpts: FactorTiltId[] = [
    "equal",
    "ic",
    "value",
    "momentum",
    "quality",
  ];
  const tiltLabel = (id: FactorTiltId): string => {
    if (id === "equal") return t(locale, "factorTiltEqual");
    if (id === "ic") return t(locale, "factorTiltIc");
    if (id === "value") return t(locale, "factorTiltValue");
    if (id === "momentum") return t(locale, "factorTiltMomentum");
    return t(locale, "factorTiltQuality");
  };
  return `<section class="factor-board-panel">
    <h2>${esc(t(locale, "factorBoard"))}</h2>
    <p class="muted tiny">${esc(t(locale, "factorBoardLead"))}</p>
    <p class="muted tiny">${esc(attr)}</p>
    <div class="factor-tilt-bar cta-row wrap">
      <label>${esc(t(locale, "factorTilt"))}
        <select id="factor-tilt">
          ${tiltOpts
            .map((id) => {
              const sel = id === tilt ? " selected" : "";
              return `<option value="${esc(id)}"${sel}>${esc(tiltLabel(id))}</option>`;
            })
            .join("")}
        </select>
      </label>
      <label class="tiny"><input type="checkbox" id="factor-ic-toggle" ${tilt === "ic" ? "checked" : ""}/> ${esc(t(locale, "factorTiltIc"))}</label>
    </div>
    <div class="table-wrap"><table class="agent-table">
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
        ${top
          .map((f) => {
            const name = locale === "zh" ? f.nameZh : f.nameEn;
            return `<tr>
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
  </div>`;
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

  const hashQ = location.hash.includes("?")
    ? location.hash.slice(location.hash.indexOf("?") + 1)
    : "";
  const hashParams = new URLSearchParams(hashQ);
  const labFromHash = hashParams.get("lab");

  let biasFilter: "all" | "bull" | "bear" | "neutral" = "all";
  let sortKey: "confluence" | "rsi" | "bias" = "confluence";
  let labStrategy: StrategyId =
    labFromHash && strategies.includes(labFromHash as StrategyId)
      ? (labFromHash as StrategyId)
      : (strategies[0] ?? "ma_cross");
  let labSymbol: string = tradeable[0]?.symbol ?? "";
  let labSlip: SlippageModel = "fixed";
  let factorTilt: FactorTiltId = "equal";

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
      ${renderFactorBoard(locale, factors, factorTilt, factorsIc)}
      ${renderAdfStrip(locale, factors)}
      ${renderRecipeCards(locale, recipes)}
      <section class="review">
        <h2>${esc(t(locale, "dailyReview"))}</h2>
        <p class="muted tiny">${esc(data.reportDate)} · ${esc(data.generatedAt.slice(0, 19))}Z</p>
        <ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </section>

      <section class="strategy-lab">
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

      <section class="signal-board">
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
    document.title = `${t(locale, "quantTitle")} · Agenter`;

    root.querySelector("#f-bias")?.addEventListener("change", (e) => {
      biasFilter = (e.target as HTMLSelectElement).value as typeof biasFilter;
      paint();
    });
    root.querySelector("#f-sort")?.addEventListener("change", (e) => {
      sortKey = (e.target as HTMLSelectElement).value as typeof sortKey;
      paint();
    });
    root.querySelector("#factor-tilt")?.addEventListener("change", (e) => {
      factorTilt = (e.target as HTMLSelectElement).value as FactorTiltId;
      paint();
    });
    root.querySelector("#factor-ic-toggle")?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      factorTilt = on ? "ic" : "equal";
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
  };

  paint();
}
