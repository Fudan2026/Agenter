import {
  ColorType,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";

import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { tearsheetFromEquity } from "../lib/analytics/tearsheet";
import { setAcademyFlag } from "../lib/academy/curriculum";
import {
  runBacktest,
  STRATEGY_META,
  type BacktestResult,
  type StrategyId,
} from "../lib/backtest/engine";
import { icSummary, quantileReturns, spearmanIC } from "../lib/factors/ic";
import { exposuresForRow, resolveBenchmark } from "../lib/factors/ff-proxy";
import { rsi } from "../lib/indicators/core";
import {
  applyBuy,
  applySell,
} from "../lib/paper/engine";
import { loadPaperState, savePaperState } from "../lib/paper/journal";
import { evaluateBacktestGates } from "../lib/risk/gates";
import { confluenceScore } from "../lib/signals/board";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload, SymbolRow } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

let labChart: IChartApi | null = null;
let lastLabResult: BacktestResult | null = null;

function destroyLabChartLocal(): void {
  if (labChart) {
    labChart.remove();
    labChart = null;
  }
}

export function cleanupLabPage(): void {
  destroyLabChartLocal();
  lastLabResult = null;
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
  const eqValues = res.equity.map((p) => p.value);
  const dates = res.equity.map((p) => p.time);
  const ts = tearsheetFromEquity(eqValues, dates);
  return `<div class="tear-sheet verdict-${esc(level)}">
    <div class="stats-row paper-stats">
      <div class="stat"><span class="stat-n">${fmt(m.totalReturnPct)}%</span><span class="stat-l">Return</span></div>
      <div class="stat"><span class="stat-n">${fmt(m.maxDrawdownPct)}%</span><span class="stat-l">Max DD</span></div>
      <div class="stat"><span class="stat-n">${fmt(res.oosMetrics.sharpe)}</span><span class="stat-l">${esc(t(locale, "rawSharpe"))}</span></div>
      <div class="stat"><span class="stat-n">${fmt(res.haircutSharpe)}</span><span class="stat-l">${esc(t(locale, "haircutSharpe"))}</span></div>
    </div>
    <p class="muted tiny">Tearsheet · Sh ${ts.sharpe.toFixed(2)} · Sortino ${ts.sortino.toFixed(2)} · win ${(ts.winRate * 100).toFixed(0)}%</p>
    <ul class="tiny">${gate.messages.map((msg) => `<li>${esc(locale === "zh" ? msg.zh : msg.en)}</li>`).join("")}</ul>
  </div>`;
}

function buildFactorIcPairs(symbols: SymbolRow[]): Array<{
  factor: number;
  fwdRet: number;
}> {
  const pairs: Array<{ factor: number; fwdRet: number }> = [];
  for (const row of symbols) {
    const closes = row.candles.map((c) => c.close);
    const rsiSeries = rsi(closes, 14);
    const conf = confluenceScore(row);
    for (let i = 14; i < row.candles.length - 1; i++) {
      const c0 = row.candles[i].close;
      const c1 = row.candles[i + 1].close;
      if (!(c0 > 0)) continue;
      const fwd = c1 / c0 - 1;
      const rsiVal = rsiSeries[i - 14];
      const factor = rsiVal != null ? rsiVal : conf;
      pairs.push({ factor, fwdRet: fwd });
    }
  }
  return pairs;
}

function icPanelHtml(locale: Locale, symbols: SymbolRow[]): string {
  const pairs = buildFactorIcPairs(symbols);
  if (pairs.length < 10) {
    return `<p class="muted">${locale === "zh" ? "样本不足" : "Not enough samples"}</p>`;
  }
  const factors = pairs.map((p) => p.factor);
  const rets = pairs.map((p) => p.fwdRet);
  const ic = spearmanIC(factors, rets);
  const summary = icSummary(
    pairs.map((p, i) => ({
      date: String(i),
      factor: p.factor,
      fwdRet: p.fwdRet,
    })),
    [1],
  );
  const quants = quantileReturns(factors, rets, 5);
  const qRows = quants
    .map((q) => `<tr><td>Q${q.q}</td><td>${(q.meanRet * 100).toFixed(3)}%</td></tr>`)
    .join("");
  return `<h3>Factor IC (RSI / confluence proxy)</h3>
    <p class="muted tiny">spearmanIC ${ic == null ? "—" : ic.toFixed(3)} · icSummary IR ${summary[0]?.ir.toFixed(2) ?? "—"} · Inspired by Alphalens / FactorHub</p>
    <div class="table-wrap"><table class="agent-table"><thead><tr><th>Quantile</th><th>Mean fwd</th></tr></thead><tbody>${qRows}</tbody></table></div>`;
}

function combineEqualWeight(
  results: BacktestResult[],
  labelSymbol: string,
): BacktestResult | null {
  if (!results.length) return null;
  if (results.length === 1) return results[0];
  const dateSet = new Set<string>();
  for (const r of results) {
    for (const p of r.equity) dateSet.add(p.time);
  }
  const dates = [...dateSet].sort();
  const normBySym = results.map((r) => {
    const map = new Map(r.equity.map((p) => [p.time, p.value]));
    const start = r.equity[0]?.value ?? 1;
    return { r, map, start };
  });
  const equity = dates.map((time) => {
    let sum = 0;
    let n = 0;
    for (const { map, start } of normBySym) {
      const v = map.get(time);
      if (v != null && start > 0) {
        sum += v / start;
        n += 1;
      }
    }
    const avgNorm = n > 0 ? sum / n : 1;
    return { time, value: avgNorm * (results[0].equity[0]?.value ?? 1) };
  });
  const merged: BacktestResult = {
    ...results[0],
    symbol: labelSymbol,
    equity,
    trades: results.flatMap((r) => r.trades),
  };
  return merged;
}

export function renderLab(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  cleanupLabPage();
  const tradeable = data.symbols.filter(
    (s) => s.dataStatus !== "missing" && s.candles.length >= 60,
  );
  const strategies = Object.keys(STRATEGY_META) as StrategyId[];
  let labStrategy: StrategyId = strategies[0] ?? "ma_cross";
  let labSymbol = tradeable[0]?.symbol ?? "";
  let multiMode = false;
  let multiSymbols: string[] = tradeable.slice(0, 3).map((s) => s.symbol);

  const paint = (flash?: string): void => {
    destroyLabChartLocal();
    const bench = resolveBenchmark(data.symbols);
    const row = data.symbols.find((s) => s.symbol === labSymbol);

    const panesHtml = `
      <section class="ws-pane ws-pane-full strategy-lab">
        <h1>${esc(t(locale, "strategyLab"))}</h1>
        <p class="muted tiny">signal t close → fill t+1 open · walk-forward · max 8 symbols equal-weight</p>
        ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
        <div class="lab-controls cta-row wrap">
          <label>Strategy
            <select id="lab-strategy">
              ${strategies
                .map((id) => {
                  const label =
                    locale === "zh" ? STRATEGY_META[id].zh : STRATEGY_META[id].en;
                  return `<option value="${esc(id)}"${id === labStrategy ? " selected" : ""}>${esc(label)}</option>`;
                })
                .join("")}
            </select>
          </label>
          <label>Symbol
            <select id="lab-symbol" ${multiMode ? "disabled" : ""}>
              ${tradeable
                .map((s) => {
                  const name = locale === "zh" ? s.nameZh : s.nameEn;
                  return `<option value="${esc(s.symbol)}"${s.symbol === labSymbol ? " selected" : ""}>${esc(s.symbol)} · ${esc(name)}</option>`;
                })
                .join("")}
            </select>
          </label>
          <label><input type="checkbox" id="lab-multi" ${multiMode ? "checked" : ""} /> Equal-weight (≤8)</label>
          <div id="lab-multi-pick" class="${multiMode ? "" : "hidden"}">
            ${tradeable
              .slice(0, 24)
              .map(
                (s) =>
                  `<label class="tiny"><input type="checkbox" class="lab-sym" value="${esc(s.symbol)}" ${multiSymbols.includes(s.symbol) ? "checked" : ""} /> ${esc(s.symbol)}</label>`,
              )
              .join(" ")}
          </div>
          <button type="button" class="btn btn-primary" id="lab-run">${esc(t(locale, "strategyRun"))}</button>
          <button type="button" class="btn" id="lab-send" ${lastLabResult ? "" : "disabled"}>${esc(t(locale, "strategySendPaper"))}</button>
        </div>
        <div id="lab-metrics">${lastLabResult ? metricsHtml(locale, lastLabResult) : ""}</div>
        <div class="chart-shell equity-shell"><div id="lab-chart" class="chart equity-chart"></div></div>
        <div id="factor-box" class="factor-box">
          ${
            row
              ? (() => {
                  const ex = exposuresForRow(row, bench, data.symbols);
                  return `<h3>${esc(t(locale, "factorBox"))}</h3>
                    <ul class="tiny">
                      <li>β ${ex.marketBeta == null ? "—" : ex.marketBeta.toFixed(2)}</li>
                      <li>Size ${ex.sizeScore == null ? "—" : ex.sizeScore.toFixed(2)}</li>
                      <li>Value ${ex.valueScore == null ? "—" : ex.valueScore.toFixed(2)}</li>
                    </ul>`;
                })()
              : ""
          }
        </div>
        <div id="lab-ic">${icPanelHtml(locale, tradeable)}</div>
      </section>
    `;

    root.innerHTML = renderWorkspaceShell({
      locale,
      active: "lab",
      layout: "research",
      panesHtml,
      reportDate: data.reportDate,
    });

    const mountLabChart = (res: BacktestResult): void => {
      const el = root.querySelector("#lab-chart") as HTMLElement | null;
      if (!el || !res.equity.length) return;
      destroyLabChartLocal();
      labChart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: "#f7fbf8" },
          textColor: "#12231f",
        },
        width: el.clientWidth || 640,
        height: 220,
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        grid: {
          vertLines: { color: "rgba(18,35,31,0.06)" },
          horzLines: { color: "rgba(18,35,31,0.06)" },
        },
      });
      const start = res.equity[0].value;
      const line = labChart.addLineSeries({ color: "#0b6e4f", lineWidth: 2 });
      line.setData(
        res.equity.map((p) => ({
          time: p.time as Time,
          value: ((p.value - start) / start) * 100,
        })),
      );
      labChart.timeScale().fitContent();
    };

    if (lastLabResult) mountLabChart(lastLabResult);

    root.querySelector("#lab-multi")?.addEventListener("change", (e) => {
      multiMode = (e.target as HTMLInputElement).checked;
      paint();
    });
    root.querySelectorAll<HTMLInputElement>(".lab-sym").forEach((cb) => {
      cb.addEventListener("change", () => {
        multiSymbols = [...root.querySelectorAll<HTMLInputElement>(".lab-sym:checked")]
          .map((x) => x.value)
          .slice(0, 8);
        paint();
      });
    });

    root.querySelector("#lab-run")?.addEventListener("click", () => {
      labStrategy = (root.querySelector("#lab-strategy") as HTMLSelectElement)
        .value as StrategyId;
      labSymbol = (root.querySelector("#lab-symbol") as HTMLSelectElement).value;
      const syms = multiMode ? multiSymbols : [labSymbol];
      const results: BacktestResult[] = [];
      for (const sym of syms.slice(0, 8)) {
        const r = data.symbols.find((s) => s.symbol === sym);
        if (!r || r.candles.length < 60) continue;
        results.push(
          runBacktest({
            strategyId: labStrategy,
            symbol: sym,
            candles: r.candles,
          }),
        );
      }
      if (!results.length) {
        paint(locale === "zh" ? "K线不足" : "Not enough candles");
        return;
      }
      lastLabResult =
        results.length === 1
          ? results[0]
          : combineEqualWeight(results, "EW×" + results.length) ?? results[0];
      setAcademyFlag("backtestRun");
      paint(
        locale === "zh"
          ? `回测完成 · ${lastLabResult.trades.length} 笔`
          : `Backtest done · ${lastLabResult.trades.length} fills`,
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
      let applied = 0;
      for (const tr of [...lastLabResult.trades].sort((a, b) =>
        a.fillDate.localeCompare(b.fillDate),
      )) {
        const fill = {
          fillPrice: tr.fillPrice,
          fillDate: tr.fillDate,
          fillRule: tr.fillRule as "next_open",
          signalDate: tr.signalDate,
        };
        const r =
          tr.side === "buy"
            ? applyBuy(state, {
                symbol: tr.symbol,
                qty: tr.qty,
                fill,
                source: "backtest",
                note: `lab:${lastLabResult.strategyId}`,
              })
            : applySell(state, {
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
      savePaperState(state);
      paint(
        locale === "zh"
          ? `已写入纸盘 ${applied} 笔`
          : `Sent ${applied} fills to Paper`,
      );
    });
  };

  paint();
  document.title = `${tk(locale, "navLab")} · ${tk(locale, "quantOs")}`;
}
