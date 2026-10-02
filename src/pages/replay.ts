import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { setAcademyFlag } from "../lib/academy/curriculum";
import { destroyDeskChart, mountDeskChart } from "../lib/desk/chart-mount";
import { loadSelection, saveSelection } from "../lib/desk/selection";
import {
  applyBuy,
  applySell,
  normalizeQty,
} from "../lib/paper/engine";
import { loadPaperState, savePaperState } from "../lib/paper/journal";
import {
  canPlaceReplayOrder,
  replayFillIndex,
} from "../lib/replay/engine";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

let playTimer: ReturnType<typeof setInterval> | null = null;

export function cleanupReplayPage(): void {
  destroyDeskChart();
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

export function renderReplay(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  cleanupReplayPage();
  setAcademyFlag("replaySession");

  const selection = loadSelection();
  const row =
    data.symbols.find((s) => s.symbol === selection.symbol) ??
    data.symbols.find((s) => s.candles.length > 10);
  if (!row) {
    root.innerHTML = renderWorkspaceShell({
      locale,
      active: "replay",
      layout: "timing",
      panesHtml: `<p class="muted">${esc(t(locale, "loadError"))}</p>`,
      reportDate: data.reportDate,
    });
    return;
  }

  const dates = row.candles.map((c) => c.date);
  let asOfIdx = Math.max(0, dates.length - 30);
  let playing = false;
  let signalDate = dates[Math.max(0, asOfIdx - 1)] ?? dates[0];

  const paint = (flash?: string): void => {
    destroyDeskChart();
    const asOf = dates[asOfIdx] ?? dates[dates.length - 1];
    const canOrder = canPlaceReplayOrder(signalDate, asOf);

    const panesHtml = `
      <section class="ws-pane ws-pane-full">
        <h1>${esc(tk(locale, "replayTitle"))}</h1>
        ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
        <p class="muted tiny">${esc(row.symbol)} · as-of ${esc(asOf)} · signal ${esc(signalDate)}</p>
        <div class="cta-row wrap">
          <button type="button" class="btn" id="rp-step-back">−1</button>
          <button type="button" class="btn btn-primary" id="rp-step">+1</button>
          <button type="button" class="btn" id="rp-play">${playing ? "Pause" : "Play"}</button>
          <label>Signal <select id="rp-signal">
            ${dates
              .slice(0, asOfIdx + 1)
              .map(
                (d) =>
                  `<option value="${esc(d)}"${d === signalDate ? " selected" : ""}>${esc(d)}</option>`,
              )
              .join("")}
          </select></label>
          <button type="button" class="btn" id="rp-buy" ${canOrder ? "" : "disabled"}>${locale === "zh" ? "模拟买入" : "Sim buy"}</button>
          <button type="button" class="btn" id="rp-sell" ${canOrder ? "" : "disabled"}>${locale === "zh" ? "模拟卖出" : "Sim sell"}</button>
        </div>
        <input type="range" id="rp-scrub" min="0" max="${dates.length - 1}" value="${asOfIdx}" style="width:100%" />
        <div class="chart-shell"><div id="replay-chart" class="chart"></div></div>
      </section>
    `;

    root.innerHTML = renderWorkspaceShell({
      locale,
      active: "replay",
      layout: "timing",
      panesHtml,
      reportDate: data.reportDate,
      statusRight: asOf,
    });

    const host = root.querySelector("#replay-chart") as HTMLElement | null;
    if (host) {
      mountDeskChart(host, row, { asOf });
    }

    const setIdx = (idx: number): void => {
      asOfIdx = Math.max(0, Math.min(dates.length - 1, idx));
      paint();
    };

    root.querySelector("#rp-scrub")?.addEventListener("input", (e) => {
      setIdx(Number((e.target as HTMLInputElement).value));
    });
    root.querySelector("#rp-step")?.addEventListener("click", () => setIdx(asOfIdx + 1));
    root.querySelector("#rp-step-back")?.addEventListener("click", () =>
      setIdx(asOfIdx - 1),
    );
    root.querySelector("#rp-signal")?.addEventListener("change", (e) => {
      signalDate = (e.target as HTMLSelectElement).value;
      paint();
    });
    root.querySelector("#rp-play")?.addEventListener("click", () => {
      playing = !playing;
      if (playTimer) {
        clearInterval(playTimer);
        playTimer = null;
      }
      if (playing) {
        playTimer = setInterval(() => {
          if (asOfIdx >= dates.length - 1) {
            playing = false;
            if (playTimer) clearInterval(playTimer);
            playTimer = null;
            paint();
            return;
          }
          asOfIdx += 1;
          paint();
        }, 800);
      }
      paint();
    });

    const placeOrder = (side: "buy" | "sell"): void => {
      if (!canPlaceReplayOrder(signalDate, asOf)) {
        paint(
          locale === "zh"
            ? "不可下单：信号日晚于 as-of"
            : "Cannot order: signal after as-of",
        );
        return;
      }
      const fillIdx = replayFillIndex(row.candles, asOf);
      if (fillIdx == null) {
        paint(locale === "zh" ? "无下一开盘" : "No next open");
        return;
      }
      const bar = row.candles[fillIdx];
      let state = loadPaperState();
      const norm = normalizeQty(
        side === "buy" ? 10000 / bar.open : 100,
        row.group,
      );
      if (norm.error || !norm.qty) {
        paint(norm.error ?? "qty");
        return;
      }
      const fill = {
        fillPrice: bar.open,
        fillDate: bar.date,
        fillRule: "next_open" as const,
        signalDate,
      };
      const r =
        side === "buy"
          ? applyBuy(state, {
              symbol: row.symbol,
              qty: norm.qty,
              fill,
              source: "manual",
              note: `replay buy@${asOf}`,
            })
          : applySell(state, {
              symbol: row.symbol,
              qty: norm.qty,
              fill,
              source: "manual",
              note: `replay sell@${asOf}`,
            });
      if (r.ok) {
        savePaperState(r.state);
        paint(
          locale === "zh"
            ? `${side} @ ${bar.date} ${bar.open.toFixed(2)}`
            : `${side} filled ${bar.date}`,
        );
      } else {
        paint(r.error ?? "err");
      }
    };

    root.querySelector("#rp-buy")?.addEventListener("click", () => placeOrder("buy"));
    root.querySelector("#rp-sell")?.addEventListener("click", () =>
      placeOrder("sell"),
    );
  };

  saveSelection({ symbol: row.symbol, asOf: dates[asOfIdx] });
  paint();
  document.title = `${tk(locale, "navReplay")} · ${tk(locale, "quantOs")}`;
}
