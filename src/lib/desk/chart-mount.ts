/**
 * Shared lightweight-charts mount for desk panes.
 */

import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { SymbolRow } from "../../pages/types";

let chart: IChartApi | null = null;
let series: ISeriesApi<"Candlestick"> | null = null;

export function destroyDeskChart(): void {
  if (chart) {
    chart.remove();
    chart = null;
    series = null;
  }
}

export function mountDeskChart(
  container: HTMLElement,
  row: SymbolRow,
  opts?: { asOf?: string; height?: number },
): void {
  destroyDeskChart();
  const candles = opts?.asOf
    ? row.candles.filter((c) => c.date <= opts.asOf!)
    : row.candles;
  chart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: "#f4f8f6" },
      textColor: "#12231f",
    },
    width: container.clientWidth || 640,
    height: opts?.height ?? Math.max(280, container.clientHeight || 320),
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    grid: {
      vertLines: { color: "rgba(18,35,31,0.06)" },
      horzLines: { color: "rgba(18,35,31,0.06)" },
    },
  });
  series = chart.addCandlestickSeries({
    upColor: "#15803d",
    downColor: "#b91c1c",
    borderUpColor: "#15803d",
    borderDownColor: "#b91c1c",
    wickUpColor: "#15803d",
    wickDownColor: "#b91c1c",
  });
  series.setData(
    candles.map((c) => ({
      time: c.date as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })),
  );
  if (row.ma20?.length) {
    const ma20 = chart.addLineSeries({ color: "#0b6e4f", lineWidth: 2 });
    ma20.setData(
      row.ma20
        .filter((p) => !opts?.asOf || p.date <= opts.asOf)
        .map((p) => ({ time: p.date as Time, value: p.value })),
    );
  }
  if (row.ma60?.length) {
    const ma60 = chart.addLineSeries({ color: "#1d4e89", lineWidth: 2 });
    ma60.setData(
      row.ma60
        .filter((p) => !opts?.asOf || p.date <= opts.asOf)
        .map((p) => ({ time: p.date as Time, value: p.value })),
    );
  }
  chart.timeScale().fitContent();
}
