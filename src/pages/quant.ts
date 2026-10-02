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
import { PATTERN_META, type PatternId } from "../lib/patterns/types";
import {
  applyBuy,
  applySell,
  equityMark,
  normalizeQty,
  resolveNextOpenFill,
} from "../lib/paper/engine";
import { defaultSignalDate } from "../lib/paper/equity";
import { loadPaperState, savePaperState } from "../lib/paper/journal";
import {
  confluenceScore,
  isStaleVsReport,
  patternHeatmap,
} from "../lib/signals/board";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload, SymbolRow } from "./types";

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

  return `<a class="asset-card" href="#/asset/${encodeURIComponent(s.symbol)}">
    <div class="asset-card-top">
      <div>
        <div class="asset-name">${esc(name)} <span class="chip chip-${esc(bias === "neutral" ? "neutral" : bias === "bull" ? "bull" : "bear")}">${esc(biasLabel(locale, bias))}</span></div>
        <div class="asset-meta">${esc(s.symbol)} · ${esc(groupLabel(locale, s.group))} · ${esc(statusLabel(locale, s.dataStatus))} · ${esc(t(locale, "confluence"))} ${conf}${
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
  return `<div class="tear-sheet verdict-${esc(m.verdict)}">
    <div class="stats-row paper-stats">
      <div class="stat"><span class="stat-n">${fmt(m.totalReturnPct)}%</span><span class="stat-l">Return</span></div>
      <div class="stat"><span class="stat-n">${fmt(m.maxDrawdownPct)}%</span><span class="stat-l">Max DD</span></div>
      <div class="stat"><span class="stat-n">${fmt(m.sharpe)}</span><span class="stat-l">Sharpe</span></div>
      <div class="stat"><span class="stat-n">${esc(m.verdict)}</span><span class="stat-l">${esc(t(locale, "verdict"))}</span></div>
    </div>
    <p class="muted tiny">WR ${(m.winRate * 100).toFixed(0)}% · PF ${fmt(m.profitFactor)} · hold ${fmt(m.avgHoldDays, 1)}d · trades ${m.trades}</p>
    <p class="muted tiny">${esc(t(locale, "strategyIS"))}: ${fmt(res.isMetrics.totalReturnPct)}% / Sh ${fmt(res.isMetrics.sharpe)} · ${esc(t(locale, "strategyOOS"))}: ${fmt(res.oosMetrics.totalReturnPct)}% / Sh ${fmt(res.oosMetrics.sharpe)}</p>
  </div>`;
}

/** Quant tool home — former site facade, now at /quant only. */
export function renderQuant(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
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

  let biasFilter: "all" | "bull" | "bear" | "neutral" = "all";
  let sortKey: "confluence" | "rsi" | "bias" = "confluence";
  let labStrategy: StrategyId = strategies[0] ?? "ma_cross";
  let labSymbol: string = tradeable[0]?.symbol ?? "";

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
      ${
        stale
          ? `<div class="banner-stale">${esc(t(locale, "staleBanner"))}</div>`
          : ""
      }
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
      <div class="stats-row">
        <div class="stat"><span class="stat-n">${data.stats.symbolsOk}</span><span class="stat-l">${esc(t(locale, "statsOk"))}</span></div>
        <div class="stat"><span class="stat-n">${data.stats.symbolsStale}</span><span class="stat-l">${esc(t(locale, "statsStale"))}</span></div>
        <div class="stat"><span class="stat-n">${data.stats.symbolsMissing}</span><span class="stat-l">${esc(t(locale, "statsMissing"))}</span></div>
        <div class="stat"><span class="stat-n">${data.stats.patternHits}</span><span class="stat-l">${esc(t(locale, "statsPatterns"))}</span></div>
      </div>
      <section class="review">
        <h2>${esc(t(locale, "dailyReview"))}</h2>
        <p class="muted tiny">${esc(data.reportDate)} · ${esc(data.generatedAt.slice(0, 19))}Z</p>
        <ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </section>

      <section class="strategy-lab">
        <h2>${esc(t(locale, "strategyLab"))}</h2>
        <p class="muted tiny">signal t close → fill t+1 open · 3 bps RT · long-only · 60/40 walk-forward</p>
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
          <button type="button" class="btn btn-primary" id="lab-run">${esc(t(locale, "strategyRun"))}</button>
          <button type="button" class="btn" id="lab-send" ${lastLabResult ? "" : "disabled"}>${esc(t(locale, "strategySendPaper"))}</button>
        </div>
        <div id="lab-metrics">${lastLabResult ? metricsHtml(locale, lastLabResult) : ""}</div>
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
                const sigDate = signalDateForRow(s);
                return `<tr>
                  <td><a href="#/asset/${encodeURIComponent(s.symbol)}">${esc(s.symbol)}</a><div class="muted tiny">${esc(name)}</div></td>
                  <td><span class="chip chip-${sig.bias === "neutral" ? "neutral" : sig.bias === "bull" ? "bull" : "bear"}">${esc(biasLabel(locale, sig.bias))}</span></td>
                  <td>${conf}</td>
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
      const row = data.symbols.find((s) => s.symbol === labSymbol);
      if (!row || row.candles.length < 60) {
        paint(locale === "zh" ? "K线不足" : "Not enough candles");
        return;
      }
      lastLabResult = runBacktest({
        strategyId: labStrategy,
        symbol: labSymbol,
        candles: row.candles,
      });
      paint(
        locale === "zh"
          ? `回测完成 · ${lastLabResult.trades.length} 笔`
          : `Backtest done · ${lastLabResult.trades.length} fills`,
      );
    });

    root.querySelector("#lab-send")?.addEventListener("click", () => {
      if (!lastLabResult?.trades.length) return;
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
