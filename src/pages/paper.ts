import {
  ColorType,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";

import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { downloadChecklist } from "../lib/paper/export";
import {
  attributionByPlaybook,
  attributionBySymbol,
  cockpitStats,
  type PlaybookTag,
} from "../lib/paper/attribution";
import { buildResearchAudit } from "../lib/paper/audit";
import {
  buildSchedule,
  splitQtyBySchedule,
  sqrtImpactBps,
  type ExecAlgo,
} from "../lib/paper/execution";
import {
  applyBuy,
  applySell,
  attachBrackets,
  equityMark,
  normalizeQty,
  paperRiskSnapshot,
  resolveNextOpenFill,
  sweepBrackets,
} from "../lib/paper/engine";
import type { CnCalendarPayload } from "../lib/paper/calendar";
import {
  buildMarkToMarketSeries,
  defaultSignalDate,
  drawdownSeries,
} from "../lib/paper/equity";
import { suggestHalfKelly, conservativeDefaults } from "../lib/paper/kelly";
import {
  downloadJournalJson,
  importPaperState,
  loadPaperState,
  needsTopUp,
  resetPaperState,
  savePaperState,
  topUpToHundredMillion,
} from "../lib/paper/journal";
import {
  DEFAULT_RISK_LIMITS,
  type PaperJournalEntry,
  type PaperState,
} from "../lib/paper/types";
import {
  importSimPositionsToPaper,
  reconcileSimPaper,
} from "../lib/paper/sim-bridge";
import { loadSimLedger } from "../lib/sim/persist";
import type { AnnouncementsPayload } from "../lib/announcements/map";
import { bucketAnnouncements } from "../lib/announcements/events";
import {
  PAPER_PANEL_IDS,
  readHashQuery,
  scrollToId,
} from "../lib/nav/hash-query";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload, SymbolRow } from "./types";

const PLAYBOOK_TAGS: PlaybookTag[] = [
  "momentum",
  "mean_rev",
  "committee",
  "lab",
  "manual",
];
const BLOTTER_TOP_N = 40;

let equityChart: IChartApi | null = null;

function fmtPct(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function fmtRatio(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function researchAuditHtml(
  locale: Locale,
  opts: Parameters<typeof buildResearchAudit>[0],
): string {
  const snap = buildResearchAudit(opts);
  return `<section class="research-audit audit-${esc(snap.level)}" id="ws-audit">
    <h2>${esc(t(locale, "researchAudit"))}</h2>
    <p class="muted tiny">${esc(t(locale, "researchAuditLead"))}</p>
    <div class="audit-score">
      <span class="stat-n">${snap.score}</span>
      <span class="stat-l">${esc(t(locale, "auditScore"))} · ${esc(snap.level)}</span>
    </div>
    <ul class="audit-flags">
      ${snap.flags
        .map(
          (f) =>
            `<li class="${f.ok ? "ok" : "warn"}">${f.ok ? "✓" : "!"} ${esc(locale === "zh" ? f.zh : f.en)}</li>`,
        )
        .join("")}
    </ul>
  </section>`;
}

function attrTableHtml(
  locale: Locale,
  titleKey: Parameters<typeof t>[1],
  rows: ReturnType<typeof attributionBySymbol>,
): string {
  if (!rows.length) {
    return `<section class="attr-block"><h3>${esc(t(locale, titleKey))}</h3><p class="muted">${esc(t(locale, "attrEmpty"))}</p></section>`;
  }
  return `<section class="attr-block"><h3>${esc(t(locale, titleKey))}</h3>
    <div class="table-wrap"><table class="agent-table attr-table">
      <thead><tr>
        <th>${esc(t(locale, "attrKey"))}</th>
        <th>${esc(t(locale, "attrBuys"))}</th>
        <th>${esc(t(locale, "attrSells"))}</th>
        <th>${esc(t(locale, "attrFees"))}</th>
        <th>${esc(t(locale, "attrRealized"))}</th>
      </tr></thead>
      <tbody>
        ${rows
          .map((r) => {
            const cls = r.realizedProxy >= 0 ? "positive" : "negative";
            return `<tr>
              <td>${esc(r.key)}</td>
              <td>${fmtMoney(r.buys)}</td>
              <td>${fmtMoney(r.sells)}</td>
              <td>${fmtMoney(r.fees)}</td>
              <td class="${cls}">${fmtMoney(r.realizedProxy)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
  </section>`;
}

function filterJournal(
  journal: PaperJournalEntry[],
  filters: { symbol: string; side: string; source: string },
): PaperJournalEntry[] {
  return journal.filter((j) => {
    if (
      filters.symbol &&
      !j.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
    )
      return false;
    if (filters.side && j.side !== filters.side) return false;
    if (filters.source && (j.source ?? "manual") !== filters.source)
      return false;
    return true;
  });
}

function readPlaybookTag(root: HTMLElement): PlaybookTag {
  const el = root.querySelector("#p-playbook") as HTMLSelectElement | null;
  const v = el?.value ?? "manual";
  return PLAYBOOK_TAGS.includes(v as PlaybookTag)
    ? (v as PlaybookTag)
    : "manual";
}

function destroyEquityChart(): void {
  if (equityChart) {
    equityChart.remove();
    equityChart = null;
  }
}

function errMsg(locale: Locale, code: string): string {
  const map: Record<string, Parameters<typeof t>[1]> = {
    insufficient_cash: "paperErrCash",
    lot_100: "paperErrLot",
    invalid_qty: "paperErrQty",
    no_position: "paperErrPos",
    insufficient_qty: "paperErrInsuff",
    risk_overweight: "paperErrOverweight",
    risk_cash: "paperErrCashGate",
    t1_lock: "paperT1Lock",
    limit_up: "paperLimitReject",
    limit_down: "paperLimitReject",
  };
  const key = map[code];
  return key ? t(locale, key) : code;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ohlcMap(data: LatestPayload): Record<
  string,
  SymbolRow["candles"]
> {
  const out: Record<string, SymbolRow["candles"]> = {};
  for (const s of data.symbols) out[s.symbol] = s.candles;
  return out;
}

export function renderPaper(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
  announcements: AnnouncementsPayload | null = null,
  calendar: CnCalendarPayload | null = null,
): void {
  destroyEquityChart();
  let state: PaperState = loadPaperState();
  if (!state.riskLimits) state.riskLimits = { ...DEFAULT_RISK_LIMITS };
  let viewMode: "equity" | "pnlPct" = "pnlPct";
  let execAlgo: ExecAlgo = "twap";
  let execSlices = 8;
  let execQty = 100_000;
  let execAdv = 1_000_000;
  let execSide: "buy" | "sell" = "buy";
  let playbookTag: PlaybookTag = "manual";
  let blotterFilter = { symbol: "", side: "", source: "" };
  const params = readHashQuery();
  const preselect = params.get("symbol") ?? "";
  const preSignal = params.get("signal") ?? "";
  const panelTarget = PAPER_PANEL_IDS[params.get("panel") ?? ""] ?? "";
  let scrolledPanel = false;
  const tradeable = data.symbols.filter(
    (s) => s.dataStatus !== "missing" && s.candles.length >= 2,
  );

  const simLedger = loadSimLedger();
  const paint = (flash?: string): void => {
    destroyEquityChart();
    const lastClose: Record<string, number> = {};
    for (const s of data.symbols) {
      if (s.lastClose) lastClose[s.symbol] = s.lastClose;
    }
    const eq = equityMark(state, lastClose);
    const risk = paperRiskSnapshot(state, lastClose);
    const reconcile = reconcileSimPaper(simLedger, state);

    const showTopUp = needsTopUp(state);
    const defaultSym =
      (preselect && tradeable.some((s) => s.symbol === preselect)
        ? preselect
        : null) ??
      tradeable[0]?.symbol ??
      "";
    const row0 = data.symbols.find((s) => s.symbol === defaultSym);
    const sigDefault =
      preSignal ||
      (row0 ? defaultSignalDate(row0.candles) : null) ||
      "";

    const previewFill = row0
      ? resolveNextOpenFill(row0.candles, sigDefault || undefined, calendar)
      : null;

    const { points, markers } = buildMarkToMarketSeries(
      state,
      ohlcMap(data),
    );
    const dd = drawdownSeries(points);
    const pnlPctNow =
      ((eq - state.startingCash) / state.startingCash) * 100;
    const cockpit = cockpitStats(
      state,
      eq,
      points.map((p) => ({ time: p.time, value: p.equity })),
    );
    const bySymbol = attributionBySymbol(state);
    const byPlaybook = attributionByPlaybook(state);
    const filteredJournal = filterJournal(state.journal, blotterFilter).slice(
      0,
      BLOTTER_TOP_N,
    );

    const schedule = buildSchedule(execAlgo, execSlices);
    const impact = sqrtImpactBps(execQty, execAdv);
    const childQtys = splitQtyBySchedule(execQty, schedule);

    const body = `
      <h1>${esc(t(locale, "paperTitle"))}</h1>
      <p class="lead">${esc(t(locale, "paperLead"))}</p>
      <p class="paper-disclaimer">${esc(t(locale, "paperDisclaimer"))}</p>
      ${
        showTopUp
          ? `<div class="banner-topup">
              <p>${esc(t(locale, "paperTopUpHint"))}</p>
              <button type="button" class="btn btn-primary" id="p-topup">${esc(t(locale, "paperTopUp"))}</button>
            </div>`
          : ""
      }
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
      <p class="muted tiny" id="ws-account">${esc(t(locale, "paperSurvivorship"))} · ${
        state.costModelEnabled === false
          ? esc(t(locale, "paperCostOffWarn"))
          : esc(t(locale, "paperCostOn"))
      } · ${esc(t(locale, "paperReflexivityWarn"))}</p>

      <section class="cockpit-strip" id="ws-cockpit" aria-label="${esc(t(locale, "cockpitTitle"))}">
        <h2 class="sr-only">${esc(t(locale, "cockpitTitle"))}</h2>
        <div class="stats-row paper-stats cockpit-stats">
          <div class="stat"><span class="stat-n">${fmtMoney(cockpit.equity)}</span><span class="stat-l">${esc(t(locale, "paperEquity"))}</span></div>
          <div class="stat"><span class="stat-n">${fmtMoney(cockpit.cash)}</span><span class="stat-l">${esc(t(locale, "paperCash"))}</span></div>
          <div class="stat"><span class="stat-n">${fmtPct(cockpit.dayPnlPct)}</span><span class="stat-l">${esc(t(locale, "cockpitDayPnl"))}</span></div>
          <div class="stat"><span class="stat-n">${fmtPct(cockpit.maxDdPct)}</span><span class="stat-l">${esc(t(locale, "cockpitMaxDd"))}</span></div>
          <div class="stat"><span class="stat-n">${fmtPct(cockpit.winRate != null ? cockpit.winRate * 100 : null)}</span><span class="stat-l">${esc(t(locale, "cockpitWinRate"))}</span></div>
          <div class="stat"><span class="stat-n">${fmtRatio(cockpit.profitFactor)}</span><span class="stat-l">${esc(t(locale, "cockpitPf"))}</span></div>
          <div class="stat"><span class="stat-n">${cockpit.openNames}</span><span class="stat-l">${esc(t(locale, "cockpitOpen"))}</span></div>
          <div class="stat"><span class="stat-n">${cockpit.trades}</span><span class="stat-l">${esc(t(locale, "cockpitTrades"))}</span></div>
        </div>
        <p class="muted tiny">MTM ${pnlPctNow.toFixed(3)}% · costs ${state.costModelEnabled === false ? "OFF" : "ON"}</p>
      </section>

      <section class="exec-desk" id="ws-exec">
        <h2>${esc(t(locale, "execDesk"))}</h2>
        <p class="muted tiny">${esc(t(locale, "execDeskLead"))}</p>
        <div class="cta-row wrap exec-presets">
          <span class="tiny muted">${esc(t(locale, "execPresets"))}:</span>
          <button type="button" class="btn btn-ghost" data-exec-preset="twap8">TWAP-8</button>
          <button type="button" class="btn btn-ghost" data-exec-preset="vwap-sqrt">VWAP-√</button>
          <button type="button" class="btn btn-ghost" data-exec-preset="twap-tight">TWAP-tight</button>
        </div>
        <div class="cta-row wrap exec-controls">
          <label>${esc(t(locale, "execAlgo"))}
            <select id="exec-algo">
              <option value="twap"${execAlgo === "twap" ? " selected" : ""}>${esc(t(locale, "twap"))}</option>
              <option value="vwap"${execAlgo === "vwap" ? " selected" : ""}>${esc(t(locale, "vwap"))}</option>
            </select>
          </label>
          <label>${esc(t(locale, "execSlices"))}
            <input type="number" id="exec-slices" min="1" max="48" step="1" value="${execSlices}" />
          </label>
          <label>${esc(t(locale, "execOrderQty"))}
            <input type="number" id="exec-qty" min="1" step="100" value="${execQty}" />
          </label>
          <label>${esc(t(locale, "execAdv"))}
            <input type="number" id="exec-adv" min="1" step="1000" value="${execAdv}" />
          </label>
          <label>${esc(t(locale, "execMatSide"))}
            <select id="exec-side">
              <option value="buy"${execSide === "buy" ? " selected" : ""}>buy</option>
              <option value="sell"${execSide === "sell" ? " selected" : ""}>sell</option>
            </select>
          </label>
          <button type="button" class="btn" id="exec-recalc">${esc(t(locale, "execImpact"))}</button>
          <button type="button" class="btn btn-primary" id="exec-materialize">${esc(t(locale, "execMaterialize"))}</button>
        </div>
        <p class="exec-impact">${esc(t(locale, "execImpact"))}: <strong>${impact.impactBps.toFixed(1)} bps</strong>
          · participation ${(impact.participation * 100).toFixed(2)}%
          <span class="muted tiny">· ${esc(impact.note)}</span>
        </p>
        <div class="table-wrap"><table class="agent-table">
          <thead><tr>
            <th>${esc(t(locale, "execSchedule"))}</th>
            <th>weight</th>
            <th>cum</th>
            <th>qty≈</th>
          </tr></thead>
          <tbody>
            ${schedule
              .map((sl) => {
                const child = childQtys.find((c) => c.label === sl.label);
                return `<tr>
                  <td>${esc(sl.label)}</td>
                  <td>${(sl.weight * 100).toFixed(1)}%</td>
                  <td>${(sl.cumFrac * 100).toFixed(1)}%</td>
                  <td>${(child?.qty ?? Math.round(execQty * sl.weight)).toLocaleString()}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>
      </section>

      <section class="risk-strip ${risk.overweight ? "warn" : ""}" id="ws-risk">
        <h2>${esc(t(locale, "paperRisk"))}</h2>
        <ul>
          <li>${esc(t(locale, "paperCashBuf"))}: ${(risk.cashPct * 100).toFixed(1)}%</li>
          <li>${esc(t(locale, "paperMaxName"))}: ${
            risk.maxNameSymbol
              ? `${esc(risk.maxNameSymbol)} ${(risk.maxNamePct * 100).toFixed(1)}%`
              : "—"
          }${risk.overweight ? ` · ${esc(t(locale, "paperOverweight"))}` : ""}</li>
          <li>${esc(t(locale, "paperConsecLoss"))}: ${risk.consecutiveLosses}</li>
          <li>${esc(t(locale, "paperStress"))}: −8% / −15% equity shock → ${fmtMoney(eq * 0.92)} / ${fmtMoney(eq * 0.85)}</li>
        </ul>
        <label class="tiny"><input type="checkbox" id="p-hard" ${state.hardRiskGates ? "checked" : ""}/> ${esc(t(locale, "paperHardGates"))}</label>
        <label class="tiny"><input type="checkbox" id="p-cost" ${state.costModelEnabled === false ? "" : "checked"}/> ${esc(t(locale, "paperCostOn"))}</label>
        <label class="tiny">${esc(t(locale, "slipModel"))}
          <select id="p-slip">
            <option value="fixed"${(state.costConfig?.slippageModel ?? "fixed") === "fixed" ? " selected" : ""}>${esc(t(locale, "slipFixed"))}</option>
            <option value="sqrt"${state.costConfig?.slippageModel === "sqrt" ? " selected" : ""}>${esc(t(locale, "slipSqrt"))}</option>
          </select>
        </label>
                <p class="muted tiny">${esc(t(locale, "paperRiskNames"))}: ${risk.openNames} / ${state.riskLimits?.maxOpenNames ?? 12} · ${esc(t(locale, "paperRiskDaily"))}: ${fmtPct(risk.dailyLossPct * 100)} ${risk.dailyLossHalt ? "⚠" : ""}</p>
<p class="muted tiny">${esc(t(locale, "paperRiskNote"))} · ${esc(t(locale, "slipNote"))}</p>
      </section>

      <section class="paper-ticket" id="ws-ticket">
        <h2>${esc(t(locale, "wsTicket"))}</h2>
        <label>${esc(t(locale, "paperSymbol"))}
          <select id="p-symbol">
            ${tradeable
              .map((s) => {
                const name = locale === "zh" ? s.nameZh : s.nameEn;
                return `<option value="${esc(s.symbol)}">${esc(s.symbol)} · ${esc(name)}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>${esc(t(locale, "paperSignalDate"))}
          <select id="p-signal"></select>
        </label>
        <label>${esc(t(locale, "paperQty"))}
          <input type="number" id="p-qty" min="1" step="100" value="1000" />
        </label>
        <label>${esc(t(locale, "playbookTag"))}
          <select id="p-playbook">
            ${PLAYBOOK_TAGS.map(
              (tag) =>
                `<option value="${esc(tag)}"${playbookTag === tag ? " selected" : ""}>${esc(tag)}</option>`,
            ).join("")}
          </select>
        </label>
        <p class="muted tiny" id="p-preview">${
          previewFill
            ? `${esc(t(locale, "paperFillPreview"))}: ${previewFill.fillRule} @ ${previewFill.fillPrice.toFixed(3)} on ${previewFill.fillDate}`
            : ""
        }</p>
        <div class="cta-row wrap">
          <label class="tiny">${esc(t(locale, "paperStopPct"))}
            <input type="number" id="p-stop" min="0" max="50" step="0.5" value="3" />
          </label>
          <label class="tiny">${esc(t(locale, "paperTpPct"))}
            <input type="number" id="p-tp" min="0" max="80" step="0.5" value="6" />
          </label>
          <button type="button" class="btn" id="p-attach-brackets">${esc(t(locale, "paperAttachBrackets"))}</button>
          <button type="button" class="btn" id="p-sweep-brackets">${esc(t(locale, "paperSweepBrackets"))}</button>
        </div>
        <p class="muted tiny" id="p-kelly"></p>
        <p class="muted tiny filing-badge" id="p-filing-badge"></p>
        <div class="cta-row">
          <button type="button" class="btn" id="kelly-fill">${esc(t(locale, "paperKellySuggest"))}</button>
          <button type="button" class="btn btn-primary" id="p-buy">${esc(t(locale, "paperBuy"))}</button>
          <button type="button" class="btn" id="p-sell">${esc(t(locale, "paperSell"))}</button>
        </div>
      </section>

      <section id="ws-perf">
        <h2>${esc(t(locale, "paperEquityCurve"))}</h2>
        <div class="cta-row wrap">
          <button type="button" class="btn ${viewMode === "pnlPct" ? "btn-primary" : ""}" id="v-pnl">${esc(t(locale, "paperViewPnl"))}</button>
          <button type="button" class="btn ${viewMode === "equity" ? "btn-primary" : ""}" id="v-eq">${esc(t(locale, "paperViewEquity"))}</button>
        </div>
        <div class="chart-shell equity-shell"><div id="equity-chart" class="chart equity-chart"></div></div>
        <div class="chart-shell equity-shell dd-shell"><div id="dd-chart" class="chart equity-chart"></div></div>
        <p class="muted tiny">${esc(t(locale, "paperMtmNote"))} · points=${points.length} · markers=${markers.length}</p>
      </section>

      <section id="ws-positions">
        <h2>${esc(t(locale, "paperPositions"))}</h2>
        ${
          state.positions.length === 0
            ? `<p class="muted">${esc(t(locale, "paperEmpty"))}</p>`
            : `<div class="table-wrap"><table class="agent-table">
                <thead><tr>
                  <th>Symbol</th><th>Qty</th><th>Avg</th><th>Mark</th>
                  <th>${esc(t(locale, "paperWeight"))}</th>
                  <th>${esc(t(locale, "paperUnrealPnl"))}</th>
                </tr></thead>
                <tbody>
                  ${state.positions
                    .map((p) => {
                      const mark = lastClose[p.symbol] ?? p.avgCost;
                      const mv = p.qty * mark;
                      const w = eq > 0 ? (mv / eq) * 100 : 0;
                      const upnl = (mark - p.avgCost) * p.qty;
                      const cls = upnl >= 0 ? "positive" : "negative";
                      return `<tr>
                        <td>${esc(p.symbol)}</td>
                        <td>${p.qty.toLocaleString()}</td>
                        <td>${p.avgCost.toFixed(3)}</td>
                        <td>${mark.toFixed(3)}</td>
                        <td>${w.toFixed(1)}%</td>
                        <td class="${cls}">${fmtMoney(upnl)}</td>
                      </tr>`;
                    })
                    .join("")}
                </tbody>
              </table></div>`
        }
      </section>

      <section class="attr-section" id="ws-attr">
        <h2>${esc(t(locale, "attributionTitle"))}</h2>
        <p class="muted tiny">${esc(t(locale, "attributionLead"))}</p>
        <div class="attr-grid">
          ${attrTableHtml(locale, "attrBySymbol", bySymbol)}
          ${attrTableHtml(locale, "attrByPlaybook", byPlaybook)}
        </div>
      </section>

      <section id="ws-journal" class="blotter-section">
        <h2>${esc(t(locale, "blotterTitle"))}</h2>
        <div class="cta-row wrap blotter-filters">
          <label>${esc(t(locale, "blotterFilterSymbol"))}
            <input type="text" id="blot-symbol" value="${esc(blotterFilter.symbol)}" placeholder="600519" />
          </label>
          <label>${esc(t(locale, "blotterFilterSide"))}
            <select id="blot-side">
              <option value="">all</option>
              <option value="buy"${blotterFilter.side === "buy" ? " selected" : ""}>buy</option>
              <option value="sell"${blotterFilter.side === "sell" ? " selected" : ""}>sell</option>
            </select>
          </label>
          <label>${esc(t(locale, "blotterFilterSource"))}
            <select id="blot-source">
              <option value="">all</option>
              <option value="manual"${blotterFilter.source === "manual" ? " selected" : ""}>manual</option>
              <option value="backtest"${blotterFilter.source === "backtest" ? " selected" : ""}>backtest</option>
              <option value="checklist"${blotterFilter.source === "checklist" ? " selected" : ""}>checklist</option>
            </select>
          </label>
          <button type="button" class="btn" id="blot-apply">${esc(t(locale, "blotterApply"))}</button>
        </div>
        ${
          filteredJournal.length === 0
            ? `<p class="muted">${esc(t(locale, "paperNoJournal"))}</p>`
            : `<div class="table-wrap"><table class="agent-table blotter-table">
                <thead><tr>
                  <th>Side</th><th>Symbol</th><th>Qty</th><th>Fill</th>
                  <th>${esc(t(locale, "paperFee"))}</th>
                  <th>${esc(t(locale, "paperFillRule"))}</th>
                  <th>Src</th>
                  <th>${esc(t(locale, "playbookTag"))}</th>
                  <th>${esc(t(locale, "sliceLabel"))}</th>
                </tr></thead>
                <tbody>
                  ${filteredJournal
                    .map(
                      (j) => `<tr>
                        <td>${esc(j.side)}</td>
                        <td>${esc(j.symbol)}</td>
                        <td>${j.qty.toLocaleString()}</td>
                        <td>${j.fillPrice.toFixed(3)} <span class="muted tiny">${esc(j.fillDate)}</span></td>
                        <td>${j.fee.toFixed(2)}${
                          j.feeStampDuty
                            ? ` <span class="muted tiny">(c${(j.feeCommission ?? 0).toFixed(1)}/s${j.feeStampDuty.toFixed(1)})</span>`
                            : ""
                        }</td>
                        <td>${esc(j.fillRule)} <span class="muted tiny">sig ${esc(j.signalDate)}</span></td>
                        <td class="tiny">${esc(j.source ?? "manual")}</td>
                        <td class="tiny">${esc(j.playbookTag ?? "—")}</td>
                        <td class="tiny">${esc(j.sliceLabel ?? "—")}</td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table></div>
              <p class="muted tiny">${esc(t(locale, "blotterTopN"))}: ${BLOTTER_TOP_N}</p>`
        }
      </section>

      ${researchAuditHtml(locale, {
        costModelEnabled: state.costModelEnabled !== false,
        fillRuleNextOpen: true,
        usedTimeSplitNotRandom: true,
        survivorUniverse: true,
      })}

            <section class="reconcile-panel" id="ws-reconcile">
        <h2>${esc(t(locale, "paperReconcile"))}</h2>
        <p class="muted tiny">${esc(t(locale, "paperReconcileLead"))}</p>
        <p class="tiny">Sim cash ${fmtMoney(reconcile.simCash)} · Paper cash ${fmtMoney(reconcile.paperCash)} · Δ ${fmtMoney(reconcile.cashDelta)}</p>
        ${
          reconcile.rows.length
            ? `<div class="table-wrap"><table class="agent-table">
                <thead><tr><th>Symbol</th><th>Sim</th><th>Paper</th><th>Δ</th></tr></thead>
                <tbody>
                  ${reconcile.rows
                    .map(
                      (r) => `<tr>
                        <td>${esc(r.symbol)}</td>
                        <td>${r.simQty}</td>
                        <td>${r.paperQty}</td>
                        <td>${r.deltaQty}</td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table></div>`
            : `<p class="muted tiny">${esc(t(locale, "paperReconcileEmpty"))}</p>`
        }
        <div class="cta-row wrap">
          <button type="button" class="btn btn-primary" id="p-import-sim">${esc(t(locale, "paperImportSim"))}</button>
          <a class="btn btn-ghost" href="#/sim">${esc(t(locale, "toolSim"))}</a>
        </div>
      </section>

      <div class="cta-row wrap" id="ws-ops">
        <button type="button" class="btn" id="p-csv">${esc(t(locale, "paperExportCsv"))}</button>
        <button type="button" class="btn" id="p-json">${esc(t(locale, "paperExportJson"))}</button>
        <button type="button" class="btn" id="p-jl">${esc(t(locale, "paperDownloadJournal"))}</button>
        <label class="btn file-btn">${esc(t(locale, "paperImportJournal"))}
          <input type="file" id="p-import" accept="application/json,.json" hidden />
        </label>
        <button type="button" class="btn btn-danger" id="p-reset">${esc(t(locale, "paperReset"))}</button>
      </div>
    `;

    root.innerHTML = renderShell(locale, "paper", body);
    document.title = `${t(locale, "paperTitle")} · Agenter`;
    if (panelTarget && !scrolledPanel) {
      scrolledPanel = true;
      scrollToId(panelTarget);
    }

    const symEl = root.querySelector("#p-symbol") as HTMLSelectElement | null;
    const sigEl = root.querySelector("#p-signal") as HTMLSelectElement | null;
    if (symEl && defaultSym) symEl.value = defaultSym;

    const refillSignals = (): void => {
      if (!symEl || !sigEl) return;
      const row = data.symbols.find((s) => s.symbol === symEl.value);
      if (!row) return;
      const prefer = defaultSignalDate(row.candles);
      sigEl.innerHTML = row.candles
        .map((c, i) => {
          const hasNext = i < row.candles.length - 1;
          const label = hasNext
            ? `${c.date} → next_open`
            : `${c.date} (fallback)`;
          return `<option value="${esc(c.date)}">${esc(label)}</option>`;
        })
        .join("");
      sigEl.value = prefer ?? row.candles[row.candles.length - 1]?.date ?? "";
      updatePreview();
    };

    const updatePreview = (): void => {
      const prev = root.querySelector("#p-preview");
      if (!symEl || !sigEl || !prev) return;
      const row = data.symbols.find((s) => s.symbol === symEl.value);
      if (!row) return;
      const fill = resolveNextOpenFill(row.candles, sigEl.value, calendar);
      prev.textContent = fill
        ? `${t(locale, "paperFillPreview")}: ${fill.fillRule} @ ${fill.fillPrice.toFixed(3)} on ${fill.fillDate}`
        : "";
    };

    const updateFilingBadge = (): void => {
      const el = root.querySelector("#p-filing-badge");
      if (!el || !symEl) return;
      const sym = symEl.value;
      const items = (announcements?.items ?? []).filter((a) => a.symbol === sym);
      if (!items.length) {
        el.textContent = "";
        return;
      }
      const bucketed = bucketAnnouncements(items).slice(0, 3);
      const bits = bucketed.map((a) => {
        const label =
          a.bucket === "earnings"
            ? t(locale, "eventEarnings")
            : a.bucket === "buyback"
              ? t(locale, "eventBuyback")
              : a.bucket === "holder_change"
                ? t(locale, "eventHolder")
                : t(locale, "eventOther");
        return `${label}`;
      });
      el.textContent = `${t(locale, "paperFilingBadge")}: ${bits.join(" · ")} (${items.length})`;
    };

    refillSignals();
    updateFilingBadge();
    if (sigDefault && sigEl) {
      const opts = [...sigEl.options].map((o) => o.value);
      if (opts.includes(sigDefault)) sigEl.value = sigDefault;
      updatePreview();
    }

    symEl?.addEventListener("change", () => {
      refillSignals();
      updateFilingBadge();
    });
    sigEl?.addEventListener("change", () => updatePreview());

    // Charts
    const chartEl = root.querySelector("#equity-chart") as HTMLElement | null;
    const ddEl = root.querySelector("#dd-chart") as HTMLElement | null;
    if (chartEl && points.length) {
      equityChart = createChart(chartEl, {
        layout: {
          background: { type: ColorType.Solid, color: "#f7fbf8" },
          textColor: "#12231f",
        },
        width: chartEl.clientWidth,
        height: 240,
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        grid: {
          vertLines: { color: "rgba(18,35,31,0.06)" },
          horzLines: { color: "rgba(18,35,31,0.06)" },
        },
      });
      const line = equityChart.addLineSeries({
        color: "#0b6e4f",
        lineWidth: 2,
      });
      const seriesData = points.map((p) => ({
        time: p.time as Time,
        value: viewMode === "pnlPct" ? p.pnlPct : p.equity,
      }));
      line.setData(seriesData);
      for (const m of markers) {
        // lightweight-charts markers via setMarkers on series
      }
      line.setMarkers(
        markers.map((m) => ({
          time: m.time as Time,
          position: m.side === "buy" ? "belowBar" : "aboveBar",
          color: m.side === "buy" ? "#15803d" : "#b91c1c",
          shape: m.side === "buy" ? "arrowUp" : "arrowDown",
          text: m.side.toUpperCase(),
        })),
      );
      equityChart.timeScale().fitContent();
    }
    if (ddEl && dd.length) {
      const ddChart = createChart(ddEl, {
        layout: {
          background: { type: ColorType.Solid, color: "#f7fbf8" },
          textColor: "#12231f",
        },
        width: ddEl.clientWidth,
        height: 120,
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        grid: {
          vertLines: { color: "rgba(18,35,31,0.06)" },
          horzLines: { color: "rgba(18,35,31,0.06)" },
        },
      });
      const area = ddChart.addAreaSeries({
        lineColor: "#b91c1c",
        topColor: "rgba(185,28,28,0.35)",
        bottomColor: "rgba(185,28,28,0.02)",
        lineWidth: 1,
      });
      area.setData(dd.map((p) => ({ time: p.time as Time, value: p.value })));
      ddChart.timeScale().fitContent();
      // store on equityChart cleanup path — remove with paint destroy only main; dd removed on next paint via orphan GCC
      const prev = equityChart;
      equityChart = {
        remove: () => {
          prev?.remove();
          ddChart.remove();
        },
      } as IChartApi;
    }

    root.querySelector("#v-pnl")?.addEventListener("click", () => {
      viewMode = "pnlPct";
      paint();
    });
    root.querySelector("#v-eq")?.addEventListener("click", () => {
      viewMode = "equity";
      paint();
    });

    const syncExecInputs = (): void => {
      const algoEl = root.querySelector("#exec-algo") as HTMLSelectElement | null;
      const slicesEl = root.querySelector("#exec-slices") as HTMLInputElement | null;
      const qtyEl = root.querySelector("#exec-qty") as HTMLInputElement | null;
      const advEl = root.querySelector("#exec-adv") as HTMLInputElement | null;
      const sideEl = root.querySelector("#exec-side") as HTMLSelectElement | null;
      if (algoEl) execAlgo = algoEl.value === "vwap" ? "vwap" : "twap";
      if (slicesEl) execSlices = Math.max(1, Math.floor(Number(slicesEl.value) || 1));
      if (qtyEl) execQty = Math.max(1, Number(qtyEl.value) || 1);
      if (advEl) execAdv = Math.max(1, Number(advEl.value) || 1);
      if (sideEl) execSide = sideEl.value === "sell" ? "sell" : "buy";
    };
    root.querySelector("#exec-recalc")?.addEventListener("click", () => {
      syncExecInputs();
      paint();
    });
    root.querySelector("#exec-algo")?.addEventListener("change", () => {
      syncExecInputs();
      paint();
    });
    root.querySelector("#p-playbook")?.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      playbookTag = PLAYBOOK_TAGS.includes(v as PlaybookTag)
        ? (v as PlaybookTag)
        : "manual";
    });
    root.querySelector("#blot-apply")?.addEventListener("click", () => {
      blotterFilter = {
        symbol:
          (root.querySelector("#blot-symbol") as HTMLInputElement | null)
            ?.value ?? "",
        side:
          (root.querySelector("#blot-side") as HTMLSelectElement | null)
            ?.value ?? "",
        source:
          (root.querySelector("#blot-source") as HTMLSelectElement | null)
            ?.value ?? "",
      };
      paint();
    });
    root.querySelector("#exec-materialize")?.addEventListener("click", () => {
      syncExecInputs();
      playbookTag = readPlaybookTag(root);
      const symbol = (root.querySelector("#p-symbol") as HTMLSelectElement)
        .value;
      const signalDate = (
        root.querySelector("#p-signal") as HTMLSelectElement
      ).value;
      const row = data.symbols.find((s) => s.symbol === symbol);
      if (!row) {
        paint(locale === "zh" ? "无标的" : "No symbol");
        return;
      }
      const fill = resolveNextOpenFill(row.candles, signalDate, calendar);
      if (!fill) {
        paint("no fill");
        return;
      }
      const sched = buildSchedule(execAlgo, execSlices);
      const children = splitQtyBySchedule(execQty, sched);
      if (!children.length) {
        paint(locale === "zh" ? "无切片数量" : "No slice qty");
        return;
      }
      let okN = 0;
      let lastErr = "";
      let next = state;
      for (const child of children) {
        const note = `slice:${child.label} · playbook:${playbookTag}`;
        const result =
          execSide === "buy"
            ? applyBuy(next, {
                symbol,
                qty: child.qty,
                fill,
                note,
                playbookTag,
                sliceLabel: child.label,
                lastCloseBySymbol: lastClose,
              })
            : applySell(next, {
                symbol,
                qty: child.qty,
                fill,
                note,
                playbookTag,
                sliceLabel: child.label,
              });
        if (!result.ok) {
          lastErr = result.error;
          break;
        }
        next = result.state;
        okN += 1;
      }
      state = next;
      savePaperState(state);
      if (okN === 0) {
        paint(errMsg(locale, lastErr || "invalid_qty"));
        return;
      }
      paint(
        `${t(locale, "execMaterialized")}: ${okN}/${children.length} · ${execSide} ${symbol} @ ${fill.fillPrice.toFixed(3)} (${fill.fillRule})`,
      );
    });

    root.querySelector("#p-hard")?.addEventListener("change", (e) => {
      state = {
        ...state,
        hardRiskGates: (e.target as HTMLInputElement).checked,
      };
      savePaperState(state);
    });
    root.querySelector("#p-cost")?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      state = { ...state, costModelEnabled: on };
      savePaperState(state);
      paint();
    });
    root.querySelector("#p-slip")?.addEventListener("change", (e) => {
      const model = (e.target as HTMLSelectElement).value as "fixed" | "sqrt";
      state = {
        ...state,
        costConfig: {
          ...(state.costConfig ?? {
            enabled: true,
            commissionBps: 2.5,
            minCommissionCny: 5,
            stampDutyBpsSell: 5,
            transferFeeBps: 0.1,
            slippageBpsDefault: 5,
            slippageBpsIlliquid: 10,
          }),
          slippageModel: model,
        },
      };
      savePaperState(state);
      paint();
    });
    root.querySelector("#kelly-fill")?.addEventListener("click", () => {
      const symbol = (root.querySelector("#p-symbol") as HTMLSelectElement)
        .value;
      const row = data.symbols.find((s) => s.symbol === symbol);
      if (!row?.lastClose) return;
      const d = conservativeDefaults();
      const sug = suggestHalfKelly({
        ...d,
        equity: eq,
        price: row.lastClose,
      });
      const qtyEl = root.querySelector("#p-qty") as HTMLInputElement | null;
      if (qtyEl) qtyEl.value = String(sug.qtyLots || 100);
      const kel = root.querySelector("#p-kelly");
      if (kel) {
        kel.textContent = `${t(locale, "paperKellySuggest")}: ${sug.qtyLots} · f*=${sug.fStar.toFixed(3)} · ${t(locale, "paperKellyFail")}: ${sug.failureModes.join("; ")}`;
      }
    });

    const trade = (side: "buy" | "sell"): void => {
      playbookTag = readPlaybookTag(root);
      const symbol = (root.querySelector("#p-symbol") as HTMLSelectElement)
        .value;
      const signalDate = (
        root.querySelector("#p-signal") as HTMLSelectElement
      ).value;
      const qtyRaw = Number(
        (root.querySelector("#p-qty") as HTMLInputElement).value,
      );
      const row = data.symbols.find((s) => s.symbol === symbol);
      if (!row) return;
      const norm = normalizeQty(qtyRaw, row.group);
      if (norm.error) {
        paint(errMsg(locale, norm.error));
        return;
      }
      const fill = resolveNextOpenFill(row.candles, signalDate, calendar);
      if (!fill) {
        paint("no fill");
        return;
      }
      const note = `playbook:${playbookTag}`;
      const result =
        side === "buy"
          ? applyBuy(state, {
              symbol,
              qty: norm.qty,
              fill,
              note,
              playbookTag,
              lastCloseBySymbol: lastClose,
            })
          : applySell(state, {
              symbol,
              qty: norm.qty,
              fill,
              note,
              playbookTag,
            });
      if (!result.ok) {
        paint(errMsg(locale, result.error));
        return;
      }
      state = result.state;
      savePaperState(state);
      paint(
        `${side.toUpperCase()} ${norm.qty} ${symbol} @ ${fill.fillPrice.toFixed(3)} (${fill.fillRule} ${fill.fillDate}) · ${playbookTag}`,
      );
    };

    root.querySelector("#p-buy")?.addEventListener("click", () => trade("buy"));
    root.querySelector("#p-sell")?.addEventListener("click", () => trade("sell"));
    root.querySelector("#p-csv")?.addEventListener("click", () => {
      downloadChecklist(state, locale, "csv");
    });
    root.querySelector("#p-json")?.addEventListener("click", () => {
      downloadChecklist(state, locale, "json");
    });
    root.querySelector("#p-jl")?.addEventListener("click", () => {
      downloadJournalJson(state);
    });
    root.querySelector("#p-reset")?.addEventListener("click", () => {
      state = resetPaperState();
      paint(locale === "zh" ? "纸盘已重置（壹亿）" : "Paper reset (¥100M)");
    });
    root.querySelector("#p-topup")?.addEventListener("click", () => {
      state = topUpToHundredMillion(state);
      paint(locale === "zh" ? "已补足至壹亿起始资金" : "Topped up to ¥100M start");
    });
    root.querySelector("#p-import")?.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const next = importPaperState(JSON.parse(await file.text()) as unknown);
        if (!next) {
          paint(locale === "zh" ? "导入失败" : "Import failed");
          return;
        }
        state = next;
        paint(locale === "zh" ? "日记已导入" : "Journal imported");
      } catch {
        paint(locale === "zh" ? "导入失败" : "Import failed");
      }
    });

    root.querySelectorAll<HTMLButtonElement>("[data-exec-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.execPreset;
        if (key === "twap8") {
          execAlgo = "twap";
          execSlices = 8;
          execAdv = 1_000_000;
        } else if (key === "vwap-sqrt") {
          execAlgo = "vwap";
          execSlices = 10;
          execAdv = 2_000_000;
          state = {
            ...state,
            costConfig: {
              ...(state.costConfig ?? {
                enabled: true,
                commissionBps: 2.5,
                minCommissionCny: 5,
                stampDutyBpsSell: 5,
                transferFeeBps: 0.1,
                slippageBpsDefault: 1.5,
                slippageBpsIlliquid: 5,
              }),
              slippageModel: "sqrt",
            },
          };
          savePaperState(state);
        } else if (key === "twap-tight") {
          execAlgo = "twap";
          execSlices = 4;
          execQty = 50_000;
          execAdv = 500_000;
        }
        paint(locale === "zh" ? `执行预设 ${key}` : `Exec preset ${key}`);
      });
    });

    root.querySelector("#p-attach-brackets")?.addEventListener("click", () => {
      if (!symEl) return;
      const stop =
        Number((root.querySelector("#p-stop") as HTMLInputElement | null)?.value ?? 0) /
        100;
      const tp =
        Number((root.querySelector("#p-tp") as HTMLInputElement | null)?.value ?? 0) /
        100;
      state = attachBrackets(state, symEl.value, stop, tp);
      savePaperState(state);
      paint(locale === "zh" ? "已挂保护止损/止盈" : "Brackets attached");
    });

    root.querySelector("#p-sweep-brackets")?.addEventListener("click", () => {
      const map: Record<string, (typeof data.symbols)[0]["candles"]> = {};
      for (const s of data.symbols) map[s.symbol] = s.candles;
      const swept = sweepBrackets(state, map);
      state = swept.state;
      savePaperState(state);
      paint(
        locale === "zh"
          ? `括号扫出 ${swept.closed} 笔（同 bar 先止损）`
          : `Swept ${swept.closed} bracket exits (stop-first)`,
      );
    });

    root.querySelector("#p-import-sim")?.addEventListener("click", () => {
      const lastClose: Record<string, number> = {};
      const candles: Record<string, (typeof data.symbols)[0]["candles"]> = {};
      const groups: Record<string, "macro" | "china-etf" | "china-ashare"> = {};
      for (const s of data.symbols) {
        if (s.lastClose) lastClose[s.symbol] = s.lastClose;
        candles[s.symbol] = s.candles;
        groups[s.symbol] = s.group;
      }
      const r = importSimPositionsToPaper(simLedger, candles, groups, lastClose);
      state = r.state;
      paint(
        locale === "zh"
          ? `Sim 导入 ${r.applied} 票，跳过 ${r.skipped}`
          : `Imported ${r.applied} from Sim; skipped ${r.skipped}`,
      );
    });

  };

  paint();
}

export function cleanupPaperPage(): void {
  destroyEquityChart();
}
