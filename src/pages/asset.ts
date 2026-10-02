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
import { PATTERN_META } from "../lib/patterns/types";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload, SymbolRow } from "./types";

let chart: IChartApi | null = null;
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
}

function statusLabel(locale: Locale, status: SymbolRow["dataStatus"]): string {
  if (status === "live") return t(locale, "dataLive");
  if (status === "stale") return t(locale, "dataStale");
  return t(locale, "dataMissing");
}

function mountChart(container: HTMLElement, row: SymbolRow): void {
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
  chart.timeScale().fitContent();

  resizeObs = new ResizeObserver(() => {
    if (!chart) return;
    chart.applyOptions({
      width: container.clientWidth,
      height: Math.max(320, container.clientHeight || 360),
    });
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

  const name = locale === "zh" ? row.nameZh : row.nameEn;
  const patterns = [...row.recentPatterns].reverse();
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

  const body = `
    <p><a class="back" href="#/quant">${esc(t(locale, "backQuant"))}</a></p>
    <div class="asset-header">
      <div>
        <h1>${esc(name)}</h1>
        <p class="asset-meta">${esc(row.symbol)} · ${esc(statusLabel(locale, row.dataStatus))} · ${esc(row.dataNote)}</p>
      </div>
      <button type="button" class="btn" id="fs-btn">${esc(t(locale, "fullscreen"))}</button>
    </div>
    <div class="chart-shell" id="chart-shell">
      <div id="chart" class="chart"></div>
    </div>
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
  if (chartEl && row.candles.length) {
    mountChart(chartEl, row);
  }

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
  document.addEventListener(
    "fullscreenchange",
    () => {
      if (!fsBtn) return;
      fsBtn.textContent = document.fullscreenElement
        ? t(locale, "exitFullscreen")
        : t(locale, "fullscreen");
    },
    { once: false },
  );
}

export function cleanupAssetPage(): void {
  destroyChart();
}
