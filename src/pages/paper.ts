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
): void {
  destroyEquityChart();
  let state: PaperState = loadPaperState();
  let viewMode: "equity" | "pnlPct" = "pnlPct";
  const hashQ = location.hash.includes("?")
    ? location.hash.slice(location.hash.indexOf("?") + 1)
    : "";
  const params = new URLSearchParams(hashQ);
  const preselect = params.get("symbol") ?? "";
  const preSignal = params.get("signal") ?? "";
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
    const row0 = data.symbols.find((s) => s.symbol === defaultSym);
    const sigDefault =
      preSignal ||
      (row0 ? defaultSignalDate(row0.candles) : null) ||
      "";

    const previewFill = row0
      ? resolveNextOpenFill(row0.candles, sigDefault || undefined)
      : null;

    const { points, markers } = buildMarkToMarketSeries(
      state,
      ohlcMap(data),
    );
    const dd = drawdownSeries(points);
    const pnlPctNow =
      ((eq - state.startingCash) / state.startingCash) * 100;

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
      <div class="stats-row paper-stats">
        <div class="stat"><span class="stat-n">${fmtMoney(state.cash)}</span><span class="stat-l">${esc(t(locale, "paperCash"))}</span></div>
        <div class="stat"><span class="stat-n">${fmtMoney(eq)}</span><span class="stat-l">${esc(t(locale, "paperEquity"))}</span></div>
        <div class="stat"><span class="stat-n">${pnlPctNow.toFixed(3)}%</span><span class="stat-l">${esc(t(locale, "paperPnlPct"))}</span></div>
        <div class="stat"><span class="stat-n">${state.costModelEnabled === false ? "OFF" : "ON"}</span><span class="stat-l">Costs</span></div>
      </div>

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
        <p class="muted tiny" id="p-preview">${
          previewFill
            ? `${esc(t(locale, "paperFillPreview"))}: ${previewFill.fillRule} @ ${previewFill.fillPrice.toFixed(3)} on ${previewFill.fillDate}`
            : ""
        }</p>
        <p class="muted tiny" id="p-kelly"></p>
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

      <section id="ws-journal">
        <h2>${esc(t(locale, "paperJournal"))}</h2>
        ${
          state.journal.length === 0
            ? `<p class="muted">${esc(t(locale, "paperNoJournal"))}</p>`
            : `<div class="table-wrap"><table class="agent-table">
                <thead><tr>
                  <th>Side</th><th>Symbol</th><th>Qty</th><th>Fill</th>
                  <th>${esc(t(locale, "paperFee"))}</th>
                  <th>${esc(t(locale, "paperFillRule"))}</th>
                  <th>Src</th>
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
                        <td>${j.fee.toFixed(2)}${
                          j.feeStampDuty
                            ? ` <span class="muted tiny">(c${(j.feeCommission ?? 0).toFixed(1)}/s${j.feeStampDuty.toFixed(1)})</span>`
                            : ""
                        }</td>
                        <td>${esc(j.fillRule)} <span class="muted tiny">sig ${esc(j.signalDate)}</span></td>
                        <td class="tiny">${esc(j.source ?? "manual")}</td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table></div>`
        }
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
      const fill = resolveNextOpenFill(row.candles, sigEl.value);
      prev.textContent = fill
        ? `${t(locale, "paperFillPreview")}: ${fill.fillRule} @ ${fill.fillPrice.toFixed(3)} on ${fill.fillDate}`
        : "";
    };

    refillSignals();
    if (sigDefault && sigEl) {
      const opts = [...sigEl.options].map((o) => o.value);
      if (opts.includes(sigDefault)) sigEl.value = sigDefault;
      updatePreview();
    }

    symEl?.addEventListener("change", () => refillSignals());
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
      const fill = resolveNextOpenFill(row.candles, signalDate);
      if (!fill) {
        paint("no fill");
        return;
      }
      const result =
        side === "buy"
          ? applyBuy(state, {
              symbol,
              qty: norm.qty,
              fill,
              lastCloseBySymbol: lastClose,
            })
          : applySell(state, { symbol, qty: norm.qty, fill });
      if (!result.ok) {
        paint(errMsg(locale, result.error));
        return;
      }
      state = result.state;
      savePaperState(state);
      paint(
        `${side.toUpperCase()} ${norm.qty} ${symbol} @ ${fill.fillPrice.toFixed(3)} (${fill.fillRule} ${fill.fillDate})`,
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
  };

  paint();
}

export function cleanupPaperPage(): void {
  destroyEquityChart();
}
