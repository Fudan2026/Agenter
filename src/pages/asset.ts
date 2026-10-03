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
import { rsi, sma } from "../lib/indicators/core";
import { bollinger, macd } from "../lib/indicators/macd-boll";
import type { AnnouncementsPayload } from "../lib/announcements/map";
import {
  bucketAnnouncements,
  postEventReturnPct,
  type EventBucketId,
} from "../lib/announcements/events";
import type { IwencaiNewsPayload } from "../lib/iwencai-news/map";
import {
  candlesToBars,
  resampleBars,
  type Timeframe,
} from "../lib/ohlc/resample";
import { patternConfluenceAbs } from "../lib/patterns/confluence";
import { patternWithinWinBand } from "../lib/patterns/stats";
import { PATTERN_META, type PatternId } from "../lib/patterns/types";
import { loadPaperState } from "../lib/paper/journal";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import { renderEventBucketCounts } from "./tools";
import type {
  LatestPayload,
  PatternEfficacyPayload,
  SymbolRow,
} from "./types";

const BUCKET_I18N: Record<
  EventBucketId,
  "eventEarnings" | "eventBuyback" | "eventHolder" | "eventOther"
> = {
  earnings: "eventEarnings",
  buyback: "eventBuyback",
  holder_change: "eventHolder",
  other: "eventOther",
};

type IndFlags = { ma: boolean; rsi: boolean; macd: boolean; boll: boolean };

let chart: IChartApi | null = null;
let rsiChart: IChartApi | null = null;
let macdChart: IChartApi | null = null;
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
  if (macdChart) {
    macdChart.remove();
    macdChart = null;
  }
}

function statusLabel(locale: Locale, status: SymbolRow["dataStatus"]): string {
  if (status === "live") return t(locale, "dataLive");
  if (status === "stale") return t(locale, "dataStale");
  return t(locale, "dataMissing");
}

function horizon5(stats: PatternEfficacyPayload[] | undefined, id: PatternId) {
  const row = stats?.find((p) => p.patternId === id);
  return row?.horizons.find((h) => h.horizon === 5) ?? null;
}

function fmtPctOpt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function mountProChart(
  container: HTMLElement,
  row: SymbolRow,
  tf: Timeframe,
  inds: IndFlags,
  rsiContainer: HTMLElement | null,
  macdContainer: HTMLElement | null,
): void {
  destroyChart();
  const daily = candlesToBars(row.candles);
  const bars = resampleBars(daily, tf);
  if (!bars.length) return;

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
  const data: CandlestickData[] = bars.map((c) => ({
    time: c.date as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  series.setData(data);

  const closes = bars.map((b) => b.close);

  if (inds.ma) {
    const ma20arr = sma(closes, 20);
    const ma60arr = sma(closes, Math.min(60, Math.floor(closes.length / 2) || 20));
    const o20 = closes.length - ma20arr.length;
    const o60 = closes.length - ma60arr.length;
    if (ma20arr.length) {
      const ma20 = chart.addLineSeries({
        color: "#0b6e4f",
        lineWidth: 2,
        title: "MA20",
      });
      ma20.setData(
        ma20arr.map((v, i) => ({ time: bars[o20 + i].date as Time, value: v })),
      );
    }
    if (ma60arr.length) {
      const ma60 = chart.addLineSeries({
        color: "#1d4e89",
        lineWidth: 2,
        title: "MA60",
      });
      ma60.setData(
        ma60arr.map((v, i) => ({ time: bars[o60 + i].date as Time, value: v })),
      );
    }
  }

  if (inds.boll) {
    const bb = bollinger(closes, 20, 2);
    const off = closes.length - bb.length;
    if (bb.length) {
      const upper = chart.addLineSeries({
        color: "rgba(28,25,23,0.35)",
        lineWidth: 1,
        title: "BOLL U",
      });
      const mid = chart.addLineSeries({
        color: "rgba(28,25,23,0.45)",
        lineWidth: 1,
        title: "BOLL M",
      });
      const lower = chart.addLineSeries({
        color: "rgba(28,25,23,0.35)",
        lineWidth: 1,
        title: "BOLL L",
      });
      upper.setData(
        bb.map((p, i) => ({ time: bars[off + i].date as Time, value: p.upper })),
      );
      mid.setData(
        bb.map((p, i) => ({ time: bars[off + i].date as Time, value: p.mid })),
      );
      lower.setData(
        bb.map((p, i) => ({ time: bars[off + i].date as Time, value: p.lower })),
      );
    }
  }

  if (tf === "D") {
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
  }

  chart.timeScale().fitContent();

  if (inds.rsi && rsiContainer) {
    rsiContainer.hidden = false;
    const vals = rsi(closes, 14);
    const offset = closes.length - vals.length;
    rsiChart = createChart(rsiContainer, {
      layout: {
        background: { type: ColorType.Solid, color: "#f7f4ef" },
        textColor: "#1c1917",
      },
      width: rsiContainer.clientWidth,
      height: 120,
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
        time: bars[offset + i].date as Time,
        value: v,
      })),
    );
    rsiChart.timeScale().fitContent();
  } else if (rsiContainer) {
    rsiContainer.hidden = true;
  }

  if (inds.macd && macdContainer) {
    macdContainer.hidden = false;
    const pts = macd(closes);
    const offset = closes.length - pts.length;
    macdChart = createChart(macdContainer, {
      layout: {
        background: { type: ColorType.Solid, color: "#f7f4ef" },
        textColor: "#1c1917",
      },
      width: macdContainer.clientWidth,
      height: 120,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: {
        vertLines: { color: "rgba(28,25,23,0.08)" },
        horzLines: { color: "rgba(28,25,23,0.08)" },
      },
    });
    const mLine = macdChart.addLineSeries({
      color: "#0b6e4f",
      lineWidth: 2,
      title: "MACD",
    });
    const sLine = macdChart.addLineSeries({
      color: "#b45309",
      lineWidth: 1,
      title: "Signal",
    });
    mLine.setData(
      pts.map((p, i) => ({
        time: bars[offset + i].date as Time,
        value: p.macd,
      })),
    );
    sLine.setData(
      pts.map((p, i) => ({
        time: bars[offset + i].date as Time,
        value: p.signal,
      })),
    );
    macdChart.timeScale().fitContent();
  } else if (macdContainer) {
    macdContainer.hidden = true;
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
    if (macdChart && macdContainer) {
      macdChart.applyOptions({ width: macdContainer.clientWidth });
    }
  });
  resizeObs.observe(container);
}

export function renderAsset(
  root: HTMLElement,
  data: LatestPayload,
  symbol: string,
  locale: Locale,
  announcements: AnnouncementsPayload | null = null,
  iwencaiNews: IwencaiNewsPayload | null = null,
  etfMeta: EtfMetaPayload | null = null,
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

  let filterOn = false;
  let winMin = 60;
  let winMax = 80;
  let tf: Timeframe = "D";
  let inds: IndFlags = { ma: true, rsi: false, macd: false, boll: false };

  const name = locale === "zh" ? row.nameZh : row.nameEn;
  const patConf = patternConfluenceAbs(row.recentPatterns);
  const bench = resolveBenchmark(data.symbols);
  const factors = exposuresForRow(row, bench, data.symbols);
  const sampleYears = row.sampleYears ?? null;
  const nBars = row.nBars ?? row.candles.length;

  const etfInfo = etfMeta?.etfs?.[row.symbol] ?? null;
  const indexJump =
    etfInfo?.indexSymbol != null
      ? `<p class="muted tiny">${esc(t(locale, "etfTracksIndex"))}: <a href="#/asset/${encodeURIComponent(etfInfo.indexSymbol)}">${esc(etfInfo.indexSymbol)}</a>
         · <a href="#/quant?panel=macro">${esc(t(locale, "openMacroTiming"))}</a></p>
         <p class="muted tiny">${esc(t(locale, "etfProxyNote"))}</p>`
      : "";

  const symbolAnn = (announcements?.items ?? []).filter(
    (a) => a.symbol === row.symbol,
  );
  const candles = row.candles.map((c) => ({ date: c.date, close: c.close }));
  const annList =
    symbolAnn.length === 0
      ? `<p class="muted">${esc(t(locale, "announcementsEmpty"))}</p>`
      : `<ul class="news-list">${bucketAnnouncements(symbolAnn)
          .slice(0, 5)
          .map((n) => {
            const title = locale === "zh" ? n.titleZh : n.titleEn;
            const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
            const bucketLabel = t(locale, BUCKET_I18N[n.bucket]);
            const postRet = postEventReturnPct(n.date, candles, 5);
            const retStr =
              postRet == null
                ? "—"
                : `${postRet > 0 ? "+" : ""}${postRet.toFixed(2)}%`;
            return `<li>
              <time>${esc(n.date)}</time>
              <span class="chip event-bucket-tag">${esc(bucketLabel)}</span>
              <strong>${esc(title)}</strong>
              <p class="muted tiny">${esc(t(locale, "eventPostRet"))}: ${esc(retStr)}</p>
              <p class="muted">${esc(summary)}</p>
              ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">source</a></p>` : ""}
            </li>`;
          })
          .join("")}</ul>`;

  const needles = [row.nameZh, row.nameEn].filter(Boolean);
  const symbolNews = (iwencaiNews?.items ?? []).filter((n) => {
    const blob = `${n.titleZh} ${n.titleEn} ${n.summaryZh} ${n.summaryEn}`;
    return needles.some((k) => k && blob.includes(k));
  });
  const newsList =
    symbolNews.length === 0
      ? `<p class="muted">${esc(t(locale, "iwencaiNewsEmpty"))}</p>`
      : `<ul class="news-list">${symbolNews
          .slice(0, 5)
          .map((n) => {
            const title = locale === "zh" ? n.titleZh : n.titleEn;
            const summary = locale === "zh" ? n.summaryZh : n.summaryEn;
            return `<li>
              <time>${esc(n.date)}</time>
              <strong>${esc(title)}</strong>
              <p class="muted">${esc(summary)}</p>
              ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">source</a></p>` : ""}
            </li>`;
          })
          .join("")}</ul>`;

  const paint = (): void => {
    destroyChart();
    const patterns = [...row.recentPatterns].reverse().filter((p) => {
      if (!filterOn) return true;
      const h = horizon5(row.patternStats, p.patternId);
      return patternWithinWinBand(h?.winRate ?? null, winMin, winMax);
    });
    const patternList =
      patterns.length === 0
        ? `<p class="muted">${esc(t(locale, "noPatterns"))}</p>`
        : `<ul class="pattern-list">${patterns
            .map((p) => {
              const label =
                locale === "zh"
                  ? PATTERN_META[p.patternId].zh
                  : PATTERN_META[p.patternId].en;
              const h = horizon5(row.patternStats, p.patternId);
              const wr =
                h?.winRate != null ? ` · WR ${(h.winRate * 100).toFixed(0)}%` : "";
              return `<li><span class="chip chip-${esc(p.direction)}">${esc(label)}</span> <time>${esc(p.date)}</time><span class="muted tiny">${esc(wr)}</span></li>`;
            })
            .join("")}</ul>`;

    const efficacyRows = (row.patternStats ?? [])
      .map((p) => {
        const h = p.horizons.find((x) => x.horizon === 5);
        return { p, h };
      })
      .filter(({ h }) => (h?.count ?? 0) > 0)
      .filter(({ h }) =>
        filterOn ? patternWithinWinBand(h?.winRate ?? null, winMin, winMax) : true,
      )
      .sort((a, b) => (b.h?.winRate ?? 0) - (a.h?.winRate ?? 0));

    const efficacyTable =
      efficacyRows.length === 0
        ? `<p class="muted">${esc(t(locale, "noPatterns"))}</p>`
        : `<div class="table-wrap"><table class="agent-table effective-patterns-table">
      <thead><tr>
        <th>${esc(t(locale, "colPattern"))}</th>
        <th>${esc(t(locale, "colCount"))}</th>
        <th>${esc(t(locale, "colUpProb"))}</th>
        <th>${esc(t(locale, "colPayoff"))}</th>
        <th>${esc(t(locale, "colWinRate"))}</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${efficacyRows
          .map(({ p, h }) => {
            const label =
              locale === "zh"
                ? PATTERN_META[p.patternId].zh
                : PATTERN_META[p.patternId].en;
            return `<tr>
              <td><span class="chip chip-${esc(p.direction)}">${esc(label)}</span></td>
              <td>${h?.count ?? 0}</td>
              <td>${esc(fmtPctOpt(h?.upProb))}</td>
              <td>${esc(fmtNum(h?.payoffRatio))}</td>
              <td>${esc(fmtPctOpt(h?.winRate))}</td>
              <td><a class="btn" href="#/quant?panel=lab">${esc(t(locale, "openLab"))}</a></td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>`;

    const body = `
      <p><a class="back" href="#/quant">${esc(t(locale, "backQuant"))}</a></p>
      <div class="asset-header">
        <div>
          <h1>${esc(name)}</h1>
          <p class="asset-meta">${esc(row.symbol)} · ${esc(statusLabel(locale, row.dataStatus))} · ${esc(row.dataNote)} · ${esc(t(locale, "patternConf"))} ${patConf}
            · ${esc(t(locale, "sampleYearsLabel"))} ${sampleYears == null ? "—" : sampleYears}
            · ${esc(t(locale, "nBarsLabel"))} ${nBars}</p>
          ${
            row.group === "china-etf" || etfInfo
              ? `<section class="etf-basics"><h2 class="tiny">${esc(t(locale, "etfBasicInfo"))}</h2>${indexJump}</section>`
              : ""
          }
        </div>
        <div class="cta-row wrap">
          <a class="btn" href="#/paper?symbol=${encodeURIComponent(row.symbol)}">${esc(t(locale, "openPaper"))}</a>
          <button type="button" class="btn" id="fs-btn">${esc(t(locale, "fullscreen"))}</button>
        </div>
      </div>

      <section class="winrate-filter cta-row wrap" id="winrate-filter">
        <label class="tiny"><input type="checkbox" id="wr-toggle" ${filterOn ? "checked" : ""}/> ${esc(t(locale, "winRateFilter"))}</label>
        <label class="tiny">${esc(t(locale, "winRateMin"))}
          <input type="number" id="wr-min" min="0" max="100" value="${winMin}" ${filterOn ? "" : "disabled"}/>
        </label>
        <label class="tiny">${esc(t(locale, "winRateMax"))}
          <input type="number" id="wr-max" min="0" max="100" value="${winMax}" ${filterOn ? "" : "disabled"}/>
        </label>
        <p class="muted tiny">${esc(t(locale, "winRateFilterLead"))}</p>
      </section>

      <div class="chart-shell" id="chart-shell">
        <div class="pro-chart-bar cta-row wrap">
          <span class="tiny muted">${esc(t(locale, "proChartTf"))}</span>
          <button type="button" class="btn tf-btn ${tf === "D" ? "btn-primary" : ""}" data-tf="D">${esc(t(locale, "tfDaily"))}</button>
          <button type="button" class="btn tf-btn ${tf === "W" ? "btn-primary" : ""}" data-tf="W">${esc(t(locale, "tfWeekly"))}</button>
          <button type="button" class="btn tf-btn ${tf === "M" ? "btn-primary" : ""}" data-tf="M">${esc(t(locale, "tfMonthly"))}</button>
          <span class="tiny muted">${esc(t(locale, "proChartInd"))}</span>
          <label class="tiny"><input type="checkbox" data-ind="ma" ${inds.ma ? "checked" : ""}/> MA</label>
          <label class="tiny"><input type="checkbox" data-ind="rsi" ${inds.rsi ? "checked" : ""}/> RSI</label>
          <label class="tiny"><input type="checkbox" data-ind="macd" ${inds.macd ? "checked" : ""}/> MACD</label>
          <label class="tiny"><input type="checkbox" data-ind="boll" ${inds.boll ? "checked" : ""}/> BOLL</label>
        </div>
        <div id="chart" class="chart"></div>
        <div class="chart-shell rsi-shell" id="rsi-shell" ${inds.rsi ? "" : "hidden"}>
          <div id="rsi-chart" class="chart rsi-chart"></div>
        </div>
        <div class="chart-shell macd-shell" id="macd-shell" ${inds.macd ? "" : "hidden"}>
          <div id="macd-chart" class="chart macd-chart"></div>
        </div>
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
        <p class="muted tiny">${esc(t(locale, "patternConf"))}: <strong>${patConf}</strong></p>
        ${patternList}
      </section>
      <section class="effective-patterns" id="effective-patterns">
        <h2>${esc(t(locale, "effectivePatterns"))}</h2>
        <p class="muted tiny">${esc(t(locale, "effectivePatternsLead"))}
          · ${esc(t(locale, "sampleYearsLabel"))} ${sampleYears == null ? "—" : sampleYears}
          · ${esc(t(locale, "nBarsLabel"))} ${nBars}</p>
        ${efficacyTable}
      </section>
      <section class="asset-announcements">
        <h2>${esc(t(locale, "announcementsTitle"))}</h2>
        <p class="muted tiny">${esc(t(locale, "announcementsSource"))}</p>
        ${renderEventBucketCounts(locale, symbolAnn)}
        ${annList}
      </section>
      <section class="asset-iwencai-news">
        <h2>${esc(t(locale, "iwencaiNewsTitle"))}</h2>
        <p class="muted tiny">${esc(t(locale, "iwencaiSource"))}</p>
        ${newsList}
      </section>
    `;

    root.innerHTML = renderShell(locale, "asset", body, {
      subtitle: t(locale, "quantSubtitle"),
    });
    document.title = `${name} · Supro`;

    const chartEl = root.querySelector("#chart") as HTMLElement | null;
    const rsiEl = root.querySelector("#rsi-chart") as HTMLElement | null;
    const macdEl = root.querySelector("#macd-chart") as HTMLElement | null;
    if (chartEl && row.candles.length) {
      mountProChart(chartEl, row, tf, inds, rsiEl, macdEl);
    }

    root.querySelector("#wr-toggle")?.addEventListener("change", (e) => {
      filterOn = (e.target as HTMLInputElement).checked;
      paint();
    });
    root.querySelector("#wr-min")?.addEventListener("change", (e) => {
      winMin = Number((e.target as HTMLInputElement).value) || 0;
      paint();
    });
    root.querySelector("#wr-max")?.addEventListener("change", (e) => {
      winMax = Number((e.target as HTMLInputElement).value) || 100;
      paint();
    });

    root.querySelectorAll(".tf-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        tf = ((btn as HTMLElement).dataset.tf as Timeframe) || "D";
        paint();
      });
    });
    root.querySelectorAll("input[data-ind]").forEach((el) => {
      el.addEventListener("change", (e) => {
        const key = (e.target as HTMLInputElement).dataset.ind as keyof IndFlags;
        if (!key) return;
        inds = { ...inds, [key]: (e.target as HTMLInputElement).checked };
        paint();
      });
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

/** Optional ETF meta loaded by router (Step Two). */
export interface EtfMetaPayload {
  generatedAt?: string;
  etfs: Record<
    string,
    {
      indexSymbol: string;
      sectorTags: string[];
      proxyConstituents: string[];
    }
  >;
}

export function cleanupAssetPage(): void {
  destroyChart();
}
