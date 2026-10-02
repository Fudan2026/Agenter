import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { downloadChecklist } from "../lib/paper/export";
import {
  applyBuy,
  applySell,
  equityMark,
  normalizeQty,
  resolveNextOpenFill,
} from "../lib/paper/engine";
import {
  downloadJournalJson,
  loadPaperState,
  resetPaperState,
  savePaperState,
} from "../lib/paper/journal";
import type { PaperState } from "../lib/paper/types";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload, SymbolRow } from "./types";

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

export function renderPaper(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  let state: PaperState = loadPaperState();
  const tradeable = data.symbols.filter(
    (s) => s.dataStatus !== "missing" && s.candles.length >= 2,
  );

  const paint = (flash?: string): void => {
    const lastClose: Record<string, number> = {};
    for (const s of data.symbols) {
      if (s.lastClose) lastClose[s.symbol] = s.lastClose;
    }
    const eq = equityMark(state, lastClose);
    const defaultSym = tradeable[0]?.symbol ?? "";

    const body = `
      <h1>${esc(t(locale, "paperTitle"))}</h1>
      <p class="lead">${esc(t(locale, "paperLead"))}</p>
      <p class="paper-disclaimer">${esc(t(locale, "paperDisclaimer"))}</p>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
      <div class="stats-row paper-stats">
        <div class="stat"><span class="stat-n">${state.cash.toFixed(2)}</span><span class="stat-l">${esc(t(locale, "paperCash"))}</span></div>
        <div class="stat"><span class="stat-n">${eq.toFixed(2)}</span><span class="stat-l">${esc(t(locale, "paperEquity"))}</span></div>
        <div class="stat"><span class="stat-n">${state.feeBpsRoundTrip}</span><span class="stat-l">bps RT</span></div>
      </div>

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
        <h2>${esc(t(locale, "paperPositions"))}</h2>
        ${
          state.positions.length === 0
            ? `<p class="muted">${esc(t(locale, "paperEmpty"))}</p>`
            : `<div class="table-wrap"><table class="agent-table">
                <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Mark</th></tr></thead>
                <tbody>
                  ${state.positions
                    .map((p) => {
                      const mark = lastClose[p.symbol] ?? p.avgCost;
                      return `<tr><td>${esc(p.symbol)}</td><td>${p.qty}</td><td>${p.avgCost.toFixed(3)}</td><td>${mark.toFixed(3)}</td></tr>`;
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
                        <td>${j.qty}</td>
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
        <button type="button" class="btn btn-danger" id="p-reset">${esc(t(locale, "paperReset"))}</button>
      </div>
    `;

    root.innerHTML = renderShell(locale, "paper", body);
    document.title = `${t(locale, "paperTitle")} · Agenter`;

    const symEl = root.querySelector("#p-symbol") as HTMLSelectElement | null;
    if (symEl && defaultSym) symEl.value = defaultSym;

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
      paint(locale === "zh" ? "纸盘已重置" : "Paper reset");
    });
  };

  paint();
}
