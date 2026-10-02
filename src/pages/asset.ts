import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";

import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { exposuresForRow, resolveBenchmark } from "../lib/factors/ff-proxy";
import { rsi } from "../lib/indicators/core";
import { PATTERN_META } from "../lib/patterns/types";
import { loadPaperState } from "../lib/paper/journal";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload, SymbolRow } from "./types";

let chart: IChartApi | null = null;
let rsiChart: IChartApi | null = null;
let series: ISeriesApi<"Candlestick"> | null = null;
let resizeObs: ResizeObserver | null = null;

function destroyChart(): void {
  resizeObs?.disconnect();
  resizeObs = null;
  if (chart) {
    chart.remove();
    chart = null;
    series = null;
  }
  if (rsiChart) {
    rsiChart.remove();
    rsiChart = null;
  }
}

function statusLabel(locale: Locale, status: SymbolRow["dataStatus"]): string {
  if (status === "live") return t(locale, "dataLive");
  if (status === "stale") return t(locale, "dataStale");
  return t(locale, "dataMissing");
}

function mountChart(
  container: HTMLElement,
  row: SymbolRow,
  showRsi: boolean,
  rsiContainer: HTMLElement | null,
): void {
  destroyChart();
  chart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: "#f7f4ef" },
      textColor: "#1c1917",
    },
    grid: {
      vertLines: { color: "rgba(28,25,23,0.08)" },
      horzLines: { color: "rgba(28,25,23,0.08)" },
    },
    width: container.clientWidth,
    height: Math.max(320, container.clientHeight || 360),
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
  });
  series = chart.addCandlestickSeries({
    upColor: "#15803d",
    downColor: "#b91c1c",
    borderUpColor: "#15803d",
    borderDownColor: "#b91c1c",
    wickUpColor: "#15803d",
    wickDownColor: "#b91c1c",
  });
  const data: CandlestickData[] = row.candles.map((c) => ({
    time: c.date as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  series.setData(data);
  if (row.ma20?.length) {
    const ma20 = chart.addLineSeries({
      color: "#0b6e4f",
      lineWidth: 2,
      title: "MA20",
    });
    ma20.setData(
      row.ma20.map((p) => ({ time: p.date as Time, value: p.value })),
    );
  }
  if (row.ma60?.length) {
    const ma60 = chart.addLineSeries({
      color: "#1d4e89",
      lineWidth: 2,
      title: "MA60",
    });
    ma60.setData(
      row.ma60.map((p) => ({ time: p.date as Time, value: p.value })),
    );
  }

  // Paper journal markers for this symbol
  const journal = loadPaperState().journal.filter((j) => j.symbol === row.symbol);
  if (journal.length) {
    series.setMarkers(
      journal
        .map((j) => ({
          time: j.fillDate as Time,
          position: (j.side === "buy" ? "belowBar" : "aboveBar") as
            | "belowBar"
            | "aboveBar",
          color: j.side === "buy" ? "#15803d" : "#b91c1c",
          shape: (j.side === "buy" ? "arrowUp" : "arrowDown") as
            | "arrowUp"
            | "arrowDown",
          text: j.side.toUpperCase(),
        }))
        .sort((a, b) => String(a.time).localeCompare(String(b.time))),
    );
  }

  chart.timeScale().fitContent();

  if (showRsi && rsiContainer) {
    const closes = row.candles.map((c) => c.close);
    const vals = rsi(closes, 14);
    const offset = closes.length - vals.length;
    rsiChart = createChart(rsiContainer, {
      layout: {
        background: { type: ColorType.Solid, color: "#f7f4ef" },
        textColor: "#1c1917",
      },
      width: rsiContainer.clientWidth,
      height: 140,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: {
        vertLines: { color: "rgba(28,25,23,0.08)" },
        horzLines: { color: "rgba(28,25,23,0.08)" },
      },
    });
    const line = rsiChart.addLineSeries({
      color: "#1d4e89",
      lineWidth: 2,
      title: "RSI14",
    });
    line.setData(
      vals.map((v, i) => ({
        time: row.candles[offset + i].date as Time,
        value: v,
      })),
    );
    rsiChart.timeScale().fitContent();
  }

  resizeObs = new ResizeObserver(() => {
    if (!chart) return;
    chart.applyOptions({
      width: container.clientWidth,
      height: Math.max(320, container.clientHeight || 360),
    });
    if (rsiChart && rsiContainer) {
      rsiChart.applyOptions({ width: rsiContainer.clientWidth });
    }
  });
  resizeObs.observe(container);
}

export function renderAsset(
  root: HTMLElement,
  data: LatestPayload,
  symbol: string,
  locale: Locale,
): void {
  destroyChart();
  const row = data.symbols.find((s) => s.symbol === symbol);
  if (!row) {
    root.innerHTML = renderShell(
      locale,
      "asset",
      `<p><a href="#/quant">${esc(t(locale, "backQuant"))}</a></p>
       <p>${esc(t(locale, "missingSymbol"))}: ${esc(symbol)}</p>`,
    );
    return;
  }

  let showRsi = false;
  const name = locale === "zh" ? row.nameZh : row.nameEn;
  const patterns = [...row.recentPatterns].reverse();
  const bench = resolveBenchmark(data.symbols);
  const factors = exposuresForRow(row, bench, data.symbols);
  const patternList =
    patterns.length === 0
      ? `<p class="muted">${esc(t(locale, "noPatterns"))}</p>`
      : `<ul class="pattern-list">${patterns
          .map((p) => {
            const label =
              locale === "zh"
                ? PATTERN_META[p.patternId].zh
                : PATTERN_META[p.patternId].en;
            return `<li><span class="chip chip-${esc(p.direction)}">${esc(label)}</span> <time>${esc(p.date)}</time></li>`;
          })
          .join("")}</ul>`;

  const paint = (): void => {
    destroyChart();
    const body = `
      <p><a class="back" href="#/quant">${esc(t(locale, "backQuant"))}</a></p>
      <div class="asset-header">
        <div>
          <h1>${esc(name)}</h1>
          <p class="asset-meta">${esc(row.symbol)} · ${esc(statusLabel(locale, row.dataStatus))} · ${esc(row.dataNote)}</p>
        </div>
        <div class="cta-row wrap">
          <label class="tiny"><input type="checkbox" id="rsi-toggle" ${showRsi ? "checked" : ""}/> RSI</label>
          <a class="btn" href="#/paper?symbol=${encodeURIComponent(row.symbol)}">${esc(t(locale, "openPaper"))}</a>
          <button type="button" class="btn" id="fs-btn">${esc(t(locale, "fullscreen"))}</button>
        </div>
      </div>
      <div class="chart-shell" id="chart-shell">
        <div id="chart" class="chart"></div>
      </div>
      <div class="chart-shell rsi-shell" id="rsi-shell" ${showRsi ? "" : "hidden"}>
        <div id="rsi-chart" class="chart rsi-chart"></div>
      </div>
      <section id="factor-box" class="factor-box">
        <h2>${esc(t(locale, "factorBox"))}</h2>
        <p class="muted tiny">${esc(t(locale, "hmlProxyNote"))}</p>
        <ul>
          <li>β ${factors.marketBeta == null ? "—" : factors.marketBeta.toFixed(2)} vs ${esc(factors.labels.market)}</li>
          <li>Size ${factors.sizeScore == null ? "—" : factors.sizeScore.toFixed(2)}</li>
          <li>Value ${factors.valueScore == null ? "—" : factors.valueScore.toFixed(2)} (HML-proxy)</li>
        </ul>
      </section>
      <section class="patterns">
        <h2>${esc(t(locale, "recentPatterns"))}</h2>
        ${patternList}
      </section>
    `;

    root.innerHTML = renderShell(locale, "asset", body, {
      subtitle: t(locale, "quantSubtitle"),
    });
    document.title = `${name} · Agenter`;

    const chartEl = root.querySelector("#chart") as HTMLElement | null;
    const rsiEl = root.querySelector("#rsi-chart") as HTMLElement | null;
    if (chartEl && row.candles.length) {
      mountChart(chartEl, row, showRsi, rsiEl);
    }

    root.querySelector("#rsi-toggle")?.addEventListener("change", (e) => {
      showRsi = (e.target as HTMLInputElement).checked;
      paint();
    });

    const fsBtn = root.querySelector("#fs-btn") as HTMLButtonElement | null;
    const shell = root.querySelector("#chart-shell") as HTMLElement | null;
    fsBtn?.addEventListener("click", async () => {
      if (!shell) return;
      if (!document.fullscreenElement) {
        await shell.requestFullscreen?.();
        fsBtn.textContent = t(locale, "exitFullscreen");
      } else {
        await document.exitFullscreen?.();
        fsBtn.textContent = t(locale, "fullscreen");
      }
    });
  };

  paint();
}

export function cleanupAssetPage(): void {
  destroyChart();
}
