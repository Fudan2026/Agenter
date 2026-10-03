import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  buildChecklistFromSimPositions,
  downloadChecklistRows,
} from "../lib/paper/export";
import {
  equityMark,
  placeOrder,
  pnlSnapshot,
  todayTrades,
  trailing30dReturnPct,
} from "../lib/sim/ledger";
import {
  ensureOpenAccount,
  loadSimLedger,
  resetSimLedger,
  saveSimLedger,
} from "../lib/sim/persist";
import type { SimError, SimLedger } from "../lib/sim/types";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload } from "./types";

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function errMsg(locale: Locale, code: SimError | string): string {
  const map: Record<string, Parameters<typeof t>[1]> = {
    no_account: "simErrNoAccount",
    invalid_qty: "simErrQty",
    lot_100: "simErrLot",
    invalid_price: "simErrPrice",
    insufficient_cash: "simErrCash",
    no_position: "simErrPos",
    insufficient_qty: "simErrInsuff",
    t1_lock: "simErrT1",
    unknown_symbol: "simErrSymbol",
  };
  const key = map[code];
  return key ? t(locale, key) : code;
}

function lastCloseMap(data: LatestPayload): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of data.symbols) {
    if (s.lastClose) out[s.symbol] = s.lastClose;
  }
  return out;
}

function tradeable(data: LatestPayload) {
  return data.symbols.filter(
    (s) =>
      s.dataStatus !== "missing" &&
      s.candles.length >= 1 &&
      (s.group === "china-ashare" || s.group === "china-etf"),
  );
}

function filterSymbols(
  rows: ReturnType<typeof tradeable>,
  q: string,
  locale: Locale,
) {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((s) => {
    const name = (locale === "zh" ? s.nameZh : s.nameEn).toLowerCase();
    return (
      s.symbol.toLowerCase().includes(needle) ||
      name.includes(needle) ||
      s.nameZh.toLowerCase().includes(needle)
    );
  });
}

export function cleanupSimPage(): void {
  /* no charts */
}

export function renderSim(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  let ledger: SimLedger = loadSimLedger();
  let searchQ = "";
  const rows = tradeable(data);
  const marks = lastCloseMap(data);

  const paint = (flash?: string): void => {
    const eq = equityMark(ledger, marks);
    const pnl = pnlSnapshot(ledger, marks);
    const ret30 = trailing30dReturnPct(ledger, marks);
    const today = todayTrades(ledger);
    const filtered = filterSymbols(rows, searchQ, locale);
    const defaultSym = filtered[0]?.symbol ?? rows[0]?.symbol ?? "";
    const defaultRow = data.symbols.find((s) => s.symbol === defaultSym);
    const defaultPx = defaultRow?.lastClose ?? 0;

    const accountBlock = ledger.account
      ? `<div class="sim-account">
          <p><strong>${esc(t(locale, "simUsername"))}</strong>: ${esc(ledger.account.username)}</p>
          <p class="muted tiny">${esc(t(locale, "simFundId"))}: ${esc(ledger.account.capitalAccount)} · yybid ${esc(ledger.account.departmentId)}</p>
          <p class="muted tiny">SZ ${esc(ledger.account.shareholderSz)} · SH ${esc(ledger.account.shareholderSh)}</p>
        </div>`
      : `<div class="sim-account">
          <p class="muted">${esc(t(locale, "simNoAccount"))}</p>
          <button type="button" class="btn btn-primary" id="sim-open">${esc(t(locale, "simOpenAccount"))}</button>
        </div>`;

    const body = `
      <h1>${esc(t(locale, "simTitle"))}</h1>
      <p class="lead">${esc(t(locale, "simLead"))}</p>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}

      <section class="sim-panel" id="sim-funds">
        <h2>${esc(t(locale, "simFunds"))}</h2>
        ${accountBlock}
        <div class="stats-row paper-stats">
          <div class="stat"><span class="stat-n">${fmtMoney(ledger.cash)}</span><span class="stat-l">${esc(t(locale, "paperCash"))}</span></div>
          <div class="stat"><span class="stat-n">${fmtMoney(eq)}</span><span class="stat-l">${esc(t(locale, "paperEquity"))}</span></div>
          <div class="stat"><span class="stat-n">${pnl.pnlPct.toFixed(3)}%</span><span class="stat-l">${esc(t(locale, "simPnl"))}</span></div>
          <div class="stat"><span class="stat-n">${ret30.toFixed(3)}%</span><span class="stat-l">${esc(t(locale, "simRet30"))}</span></div>
        </div>
      </section>

      <section class="sim-panel" id="sim-search">
        <h2>${esc(t(locale, "simSearch"))}</h2>
        <label class="sim-search-label">
          <input type="search" id="sim-q" value="${esc(searchQ)}" placeholder="${esc(t(locale, "simSearchPh"))}" />
        </label>
        <ul class="sim-search-hits">
          ${filtered
            .slice(0, 8)
            .map((s) => {
              const name = locale === "zh" ? s.nameZh : s.nameEn;
              return `<li><button type="button" class="linkish sim-pick" data-symbol="${esc(s.symbol)}">${esc(s.symbol)} · ${esc(name)} · ${s.lastClose.toFixed(3)}</button></li>`;
            })
            .join("")}
        </ul>
      </section>

      <section class="paper-ticket sim-panel" id="sim-order">
        <h2>${esc(t(locale, "simOrder"))}</h2>
        <label>${esc(t(locale, "paperSymbol"))}
          <select id="sim-symbol">
            ${rows
              .map((s) => {
                const name = locale === "zh" ? s.nameZh : s.nameEn;
                return `<option value="${esc(s.symbol)}">${esc(s.symbol)} · ${esc(name)}</option>`;
              })
              .join("")}
          </select>
        </label>
        <label>${esc(t(locale, "simLimitPx"))}
          <input type="number" id="sim-price" min="0.01" step="0.01" value="${defaultPx.toFixed(3)}" />
        </label>
        <label>${esc(t(locale, "paperQty"))}
          <input type="number" id="sim-qty" min="100" step="100" value="100" />
        </label>
        <p class="muted tiny">${esc(t(locale, "simOrderHint"))}</p>
        <div class="cta-row">
          <button type="button" class="btn btn-primary" id="sim-buy">${esc(t(locale, "simBuy"))}</button>
          <button type="button" class="btn" id="sim-sell">${esc(t(locale, "simSell"))}</button>
        </div>
      </section>

      <section class="sim-panel" id="sim-positions">
        <h2>${esc(t(locale, "simPositions"))}</h2>
        ${
          ledger.positions.length === 0
            ? `<p class="muted">${esc(t(locale, "paperEmpty"))}</p>`
            : `<div class="table-wrap"><table class="agent-table">
                <thead><tr>
                  <th>Symbol</th><th>Qty</th><th>Avg</th><th>Mark</th>
                  <th>${esc(t(locale, "paperUnrealPnl"))}</th><th>Mkt</th>
                </tr></thead>
                <tbody>
                  ${ledger.positions
                    .map((p) => {
                      const mark = marks[p.symbol] ?? p.avgCost;
                      const upnl = (mark - p.avgCost) * p.qty;
                      const cls = upnl >= 0 ? "positive" : "negative";
                      return `<tr>
                        <td>${esc(p.symbol)}</td>
                        <td>${p.qty.toLocaleString()}</td>
                        <td>${p.avgCost.toFixed(3)}</td>
                        <td>${mark.toFixed(3)}</td>
                        <td class="${cls}">${fmtMoney(upnl)}</td>
                        <td>${p.marketCode === "1" ? "SZ" : "SH"}</td>
                      </tr>`;
                    })
                    .join("")}
                </tbody>
              </table></div>`
        }
      </section>

      <section class="sim-panel" id="sim-today">
        <h2>${esc(t(locale, "simTodayTrades"))}</h2>
        ${
          today.length === 0
            ? `<p class="muted">${esc(t(locale, "simNoToday"))}</p>`
            : `<div class="table-wrap"><table class="agent-table">
                <thead><tr><th>Side</th><th>Symbol</th><th>Qty</th><th>Px</th><th>Fee</th></tr></thead>
                <tbody>
                  ${today
                    .map(
                      (tr) => `<tr>
                        <td>${esc(tr.side)}</td>
                        <td>${esc(tr.symbol)}</td>
                        <td>${tr.qty.toLocaleString()}</td>
                        <td>${tr.price.toFixed(3)}</td>
                        <td>${tr.fee.toFixed(2)}</td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table></div>`
        }
      </section>

      <section class="sim-panel" id="sim-journal">
        <h2>${esc(t(locale, "simJournal"))}</h2>
        ${
          ledger.trades.length === 0
            ? `<p class="muted">${esc(t(locale, "paperNoJournal"))}</p>`
            : `<div class="table-wrap"><table class="agent-table">
                <thead><tr><th>Date</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Px</th></tr></thead>
                <tbody>
                  ${ledger.trades
                    .slice(0, 40)
                    .map(
                      (tr) => `<tr>
                        <td>${esc(tr.fillDate)}</td>
                        <td>${esc(tr.side)}</td>
                        <td>${esc(tr.symbol)}</td>
                        <td>${tr.qty.toLocaleString()}</td>
                        <td>${tr.price.toFixed(3)}</td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table></div>`
        }
      </section>

      <div class="cta-row wrap">
        <button type="button" class="btn btn-primary" id="sim-handoff">${esc(t(locale, "simHandoff"))}</button>
        <a class="btn" href="#/paper?panel=reconcile">${esc(t(locale, "openPaperLink"))}</a>
        <button type="button" class="btn btn-danger" id="sim-reset">${esc(t(locale, "simReset"))}</button>
      </div>
      <p class="muted tiny">${esc(t(locale, "simHandoffLead"))}</p>
      <p class="paper-disclaimer sim-attr">${esc(t(locale, "simAttribution"))}</p>
      <p class="muted tiny">${esc(t(locale, "simDistillNote"))}</p>
    `;

    root.innerHTML = renderShell(locale, "sim", body);
    document.title = `${t(locale, "simTitle")} · Agenter`;

    const symEl = root.querySelector("#sim-symbol") as HTMLSelectElement | null;
    const pxEl = root.querySelector("#sim-price") as HTMLInputElement | null;
    const qtyEl = root.querySelector("#sim-qty") as HTMLInputElement | null;
    if (symEl && defaultSym) symEl.value = defaultSym;

    const syncPrice = (): void => {
      if (!symEl || !pxEl) return;
      const row = data.symbols.find((s) => s.symbol === symEl.value);
      if (row?.lastClose) pxEl.value = row.lastClose.toFixed(3);
    };
    symEl?.addEventListener("change", () => syncPrice());

    root.querySelector("#sim-open")?.addEventListener("click", () => {
      ledger = ensureOpenAccount(ledger);
      paint(t(locale, "simOpenedFlash"));
    });

    root.querySelector("#sim-q")?.addEventListener("input", (e) => {
      searchQ = (e.target as HTMLInputElement).value;
      paint();
      const qEl = root.querySelector("#sim-q") as HTMLInputElement | null;
      if (qEl) {
        qEl.focus();
        const len = qEl.value.length;
        qEl.setSelectionRange(len, len);
      }
    });

    root.querySelectorAll<HTMLButtonElement>(".sim-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sym = btn.dataset.symbol;
        if (!sym || !symEl) return;
        symEl.value = sym;
        syncPrice();
      });
    });

    const submit = (side: "buy" | "sell"): void => {
      if (!ledger.account) {
        paint(errMsg(locale, "no_account"));
        return;
      }
      const symbol = symEl?.value ?? "";
      const row = data.symbols.find((s) => s.symbol === symbol);
      const qty = Number(qtyEl?.value ?? 0);
      const price = Number(pxEl?.value ?? 0);
      const fillDate = new Date().toISOString().slice(0, 10);
      const result = placeOrder(ledger, {
        symbol,
        nameZh: row?.nameZh,
        nameEn: row?.nameEn,
        side,
        qty,
        price,
        fillDate,
      });
      if (!result.ok) {
        paint(errMsg(locale, result.error));
        return;
      }
      ledger = result.ledger;
      saveSimLedger(ledger);
      paint(
        side === "buy"
          ? t(locale, "simBuyFlash")
          : t(locale, "simSellFlash"),
      );
    };

    root.querySelector("#sim-buy")?.addEventListener("click", () => submit("buy"));
    root.querySelector("#sim-sell")?.addEventListener("click", () => submit("sell"));
    root.querySelector("#sim-handoff")?.addEventListener("click", () => {
      const rows = buildChecklistFromSimPositions(ledger.positions, locale);
      if (!rows.length) {
        paint(locale === "zh" ? "暂无持仓可导出" : "No positions to export");
        return;
      }
      downloadChecklistRows(rows, "json", "agenter-sim-checklist");
      paint(
        locale === "zh"
          ? `已导出 ${rows.length} 条核对清单`
          : `Exported ${rows.length} checklist rows`,
      );
    });
    root.querySelector("#sim-reset")?.addEventListener("click", () => {
      if (!confirm(t(locale, "simResetConfirm"))) return;
      ledger = resetSimLedger();
      paint(t(locale, "simResetFlash"));
    });
  };

  paint();
}
