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
  applyBuy,
  applySell,
  equityMark,
  normalizeQty,
  paperRiskSnapshot,
  resolveNextOpenFill,
} from "../lib/paper/engine";
import {
  downloadJournalJson,
  importPaperState,
  loadPaperState,
  needsTopUp,
  resetPaperState,
  savePaperState,
  topUpToHundredMillion,
} from "../lib/paper/journal";
import { PAPER_START_CASH, type PaperState } from "../lib/paper/types";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload, SymbolRow } from "./types";

let equityChart: IChartApi | null = null;

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

function buildEquitySeries(
  state: PaperState,
  lastCloseBySymbol: Record<string, number>,
): Array<{ time: string; value: number }> {
  const chronological = [...state.journal].reverse();
  let cash = state.startingCash;
  const points: Array<{ time: string; value: number }> = [];
  if (!chronological.length) {
    const today = new Date().toISOString().slice(0, 10);
    return [{ time: today, value: equityMark(state, lastCloseBySymbol) }];
  }
  for (const j of chronological) {
    const notional = j.qty * j.fillPrice;
    if (j.side === "buy") cash -= notional + j.fee;
    else cash += notional - j.fee;
    points.push({ time: j.fillDate, value: cash });
  }
  const last = points[points.length - 1];
  const eq = equityMark(state, lastCloseBySymbol);
  if (last) points.push({ time: last.time, value: eq });
  const byDay = new Map<string, number>();
  for (const p of points) byDay.set(p.time, p.value);
  return [...byDay.entries()].map(([time, value]) => ({ time, value }));
}

export function renderPaper(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  destroyEquityChart();
  let state: PaperState = loadPaperState();
  const hashQ = location.hash.includes("?")
    ? location.hash.slice(location.hash.indexOf("?") + 1)
    : "";
  const params = new URLSearchParams(hashQ);
  const preselect = params.get("symbol") ?? "";
  const tradeable = data.symbols.filter(
    (s) => s.dataStatus !== "missing" && s.candles.length >= 2,
  );

  const paint = (flash?: string): void => {
    destroyEquityChart();
    const lastClose: Record<string, number> = {};
    for (const s of data.symbols) {
      if (s.lastClose) lastClose[s.symbol] = s.lastClose;
    }
    const eq = equityMark(state, lastClose);
    const risk = paperRiskSnapshot(state, lastClose);
    const showTopUp = needsTopUp(state);
    const defaultSym =
      (preselect && tradeable.some((s) => s.symbol === preselect)
        ? preselect
        : null) ??
      tradeable[0]?.symbol ??
      "";

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
      <div class="stats-row paper-stats">
        <div class="stat"><span class="stat-n">${fmtMoney(state.cash)}</span><span class="stat-l">${esc(t(locale, "paperCash"))}</span></div>
        <div class="stat"><span class="stat-n">${fmtMoney(eq)}</span><span class="stat-l">${esc(t(locale, "paperEquity"))}</span></div>
        <div class="stat"><span class="stat-n">${fmtMoney(PAPER_START_CASH)}</span><span class="stat-l">${esc(t(locale, "paperStart"))}</span></div>
        <div class="stat"><span class="stat-n">${state.feeBpsRoundTrip}</span><span class="stat-l">bps RT</span></div>
      </div>

      <section class="risk-strip ${risk.overweight ? "warn" : ""}">
        <h2>${esc(t(locale, "paperRisk"))}</h2>
        <ul>
          <li>${esc(t(locale, "paperCashBuf"))}: ${(risk.cashPct * 100).toFixed(1)}%</li>
          <li>${esc(t(locale, "paperMaxName"))}: ${
            risk.maxNameSymbol
              ? `${esc(risk.maxNameSymbol)} ${(risk.maxNamePct * 100).toFixed(1)}%`
              : "—"
          }${risk.overweight ? ` · ${esc(t(locale, "paperOverweight"))}` : ""}</li>
          <li>${esc(t(locale, "paperConsecLoss"))}: ${risk.consecutiveLosses}</li>
        </ul>
        <p class="muted tiny">${esc(t(locale, "paperRiskNote"))}</p>
      </section>

      <section class="paper-ticket">
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
        <label>${esc(t(locale, "paperQty"))}
          <input type="number" id="p-qty" min="1" step="100" value="100" />
        </label>
        <div class="cta-row">
          <button type="button" class="btn btn-primary" id="p-buy">${esc(t(locale, "paperBuy"))}</button>
          <button type="button" class="btn" id="p-sell">${esc(t(locale, "paperSell"))}</button>
        </div>
      </section>

      <section>
        <h2>${esc(t(locale, "paperEquityCurve"))}</h2>
        <div class="chart-shell equity-shell"><div id="equity-chart" class="chart equity-chart"></div></div>
      </section>

      <section>
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

      <section>
        <h2>${esc(t(locale, "paperJournal"))}</h2>
        ${
          state.journal.length === 0
            ? `<p class="muted">${esc(t(locale, "paperNoJournal"))}</p>`
            : `<div class="table-wrap"><table class="agent-table">
                <thead><tr>
                  <th>Side</th><th>Symbol</th><th>Qty</th><th>Fill</th>
                  <th>${esc(t(locale, "paperFee"))}</th>
                  <th>${esc(t(locale, "paperFillRule"))}</th>
                </tr></thead>
                <tbody>
                  ${state.journal
                    .slice(0, 40)
                    .map(
                      (j) => `<tr>
                        <td>${esc(j.side)}</td>
                        <td>${esc(j.symbol)}</td>
                        <td>${j.qty.toLocaleString()}</td>
                        <td>${j.fillPrice.toFixed(3)} <span class="muted tiny">${esc(j.fillDate)}</span></td>
                        <td>${j.fee.toFixed(2)}</td>
                        <td>${esc(j.fillRule)} <span class="muted tiny">sig ${esc(j.signalDate)}</span></td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table></div>`
        }
      </section>

      <div class="cta-row wrap">
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

    const symEl = root.querySelector("#p-symbol") as HTMLSelectElement | null;
    if (symEl && defaultSym) symEl.value = defaultSym;

    const series = buildEquitySeries(state, lastClose);
    const chartEl = root.querySelector("#equity-chart") as HTMLElement | null;
    if (chartEl && series.length) {
      equityChart = createChart(chartEl, {
        layout: {
          background: { type: ColorType.Solid, color: "#f7fbf8" },
          textColor: "#12231f",
        },
        width: chartEl.clientWidth,
        height: 220,
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
      line.setData(
        series.map((p) => ({ time: p.time as Time, value: p.value })),
      );
      equityChart.timeScale().fitContent();
    }

    const trade = (side: "buy" | "sell"): void => {
      const symbol = (root.querySelector("#p-symbol") as HTMLSelectElement)
        .value;
      const qtyRaw = Number(
        (root.querySelector("#p-qty") as HTMLInputElement).value,
      );
      const row = data.symbols.find((s) => s.symbol === symbol) as
        | SymbolRow
        | undefined;
      if (!row) return;
      const norm = normalizeQty(qtyRaw, row.group);
      if (norm.error) {
        paint(errMsg(locale, norm.error));
        return;
      }
      const fill = resolveNextOpenFill(row.candles);
      if (!fill) {
        paint("no fill");
        return;
      }
      const result =
        side === "buy"
          ? applyBuy(state, { symbol, qty: norm.qty, fill })
          : applySell(state, { symbol, qty: norm.qty, fill });
      if (!result.ok) {
        paint(errMsg(locale, result.error));
        return;
      }
      state = result.state;
      savePaperState(state);
      paint(
        `${side.toUpperCase()} ${norm.qty} ${symbol} @ ${fill.fillPrice.toFixed(3)} (${fill.fillRule})`,
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
        const text = await file.text();
        const next = importPaperState(JSON.parse(text) as unknown);
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
  };

  paint();
}

export function cleanupPaperPage(): void {
  destroyEquityChart();
}
