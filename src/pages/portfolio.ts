import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { constructWeights, type WeightMode } from "../lib/portfolio/construct";
import { exposuresForRow, resolveBenchmark } from "../lib/factors/ff-proxy";
import { defaultSignalDate } from "../lib/paper/equity";
import {
  applyBuy,
  equityMark,
  normalizeQty,
  resolveNextOpenFill,
} from "../lib/paper/engine";
import { loadPaperState, savePaperState } from "../lib/paper/journal";
import { confluenceScore } from "../lib/signals/board";
import { esc } from "../lib/util/esc";
import { renderWorkspaceShell } from "./workspace-shell";
import type { LatestPayload, SymbolRow } from "./types";

type Tk = Parameters<typeof t>[1];

function tk(locale: Locale, key: string): string {
  return t(locale, key as Tk);
}

function realizedVol(row: SymbolRow): number {
  const closes = row.candles.slice(-21).map((c) => c.close);
  if (closes.length < 2) return 0.01;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
  }
  if (!rets.length) return 0.01;
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((s, r) => s + (r - m) ** 2, 0) / rets.length;
  return Math.sqrt(v) || 0.01;
}

function totalReturn(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const a = closes[0];
  const b = closes[closes.length - 1];
  if (!(a > 0)) return null;
  return b / a - 1;
}

export function renderPortfolio(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  const candidates = data.symbols.filter(
    (s) => s.dataStatus !== "missing" && s.signals,
  );
  let mode: WeightMode = "equal";
  let selected = new Set(
    candidates
      .slice()
      .sort((a, b) => confluenceScore(b) - confluenceScore(a))
      .slice(0, 6)
      .map((s) => s.symbol),
  );

  const paint = (flash?: string): void => {
    const items = candidates
      .filter((s) => selected.has(s.symbol))
      .map((s) => ({
        symbol: s.symbol,
        score: confluenceScore(s),
        vol: realizedVol(s),
        row: s,
      }));
    const weights = constructWeights(items, mode);
    const bench = resolveBenchmark(data.symbols);
    const benchRow =
      data.symbols.find((s) => s.symbol === "510300.SS") ?? bench;

    let aggBeta = 0;
    let aggSize = 0;
    let aggValue = 0;
    let wSum = 0;
    for (const it of items) {
      const w = weights[it.symbol] ?? 0;
      const ex = exposuresForRow(it.row, bench, data.symbols);
      if (ex.marketBeta != null) {
        aggBeta += w * ex.marketBeta;
        wSum += w;
      }
      if (ex.sizeScore != null) aggSize += w * ex.sizeScore;
      if (ex.valueScore != null) aggValue += w * ex.valueScore;
    }

    const portCloses: number[] = [];
    const minLen = Math.min(
      ...items.map((it) => it.row.candles.length),
      benchRow?.candles.length ?? 0,
    );
    if (minLen > 1 && items.length) {
      for (let i = minLen - 60 > 0 ? minLen - 60 : 0; i < minLen; i++) {
        let level = 0;
        for (const it of items) {
          const w = weights[it.symbol] ?? 0;
          level += w * it.row.candles[i].close;
        }
        portCloses.push(level);
      }
    }
    const portRet = totalReturn(portCloses);
    const benchCloses = benchRow?.candles.slice(-portCloses.length).map((c) => c.close) ?? [];
    const benchRet = totalReturn(benchCloses);
    const alpha =
      portRet != null && benchRet != null ? portRet - benchRet : null;

    const tableRows = items
      .map((it) => {
        const w = weights[it.symbol] ?? 0;
        const name = locale === "zh" ? it.row.nameZh : it.row.nameEn;
        return `<tr>
          <td><label><input type="checkbox" class="pf-sel" data-symbol="${esc(it.symbol)}" checked /> ${esc(it.symbol)}</label><div class="muted tiny">${esc(name)}</div></td>
          <td>${(w * 100).toFixed(1)}%</td>
          <td>${it.score}</td>
        </tr>`;
      })
      .join("");

    const unchecked = candidates
      .filter((s) => !selected.has(s.symbol))
      .slice(0, 12)
      .map(
        (s) =>
          `<label class="tiny"><input type="checkbox" class="pf-sel" data-symbol="${esc(s.symbol)}" /> ${esc(s.symbol)}</label> `,
      )
      .join("");

    const intentRows = items
      .map((it) => {
        const w = weights[it.symbol] ?? 0;
        const sigDate =
          defaultSignalDate(it.row.candles) ??
          it.row.candles.at(-1)?.date ??
          "";
        return `<li><label><input type="checkbox" class="pf-intent" data-symbol="${esc(it.symbol)}" checked />
          ${esc(it.symbol)} · ${(w * 100).toFixed(1)}% · signal ${esc(sigDate)}</label></li>`;
      })
      .join("");

    const panesHtml = `
      <section class="ws-pane ws-pane-full">
        <h1>${esc(tk(locale, "portfolioTitle"))}</h1>
        ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
        <div class="cta-row wrap">
          <label>Mode
            <select id="pf-mode">
              <option value="equal"${mode === "equal" ? " selected" : ""}>Equal</option>
              <option value="score"${mode === "score" ? " selected" : ""}>Score</option>
              <option value="inv_vol"${mode === "inv_vol" ? " selected" : ""}>Inv vol</option>
            </select>
          </label>
        </div>
        <p class="muted tiny">${locale === "zh" ? "更多标的：" : "Add symbols:"} ${unchecked}</p>
        <div class="table-wrap"><table class="agent-table">
          <thead><tr><th>Symbol</th><th>Weight</th><th>${esc(t(locale, "confluence"))}</th></tr></thead>
          <tbody>${tableRows || `<tr><td colspan="3" class="muted">—</td></tr>`}</tbody>
        </table></div>
        <h3>${esc(t(locale, "factorBox"))} (aggregate)</h3>
        <ul class="tiny">
          <li>β ${wSum > 0 ? (aggBeta / wSum).toFixed(2) : "—"}</li>
          <li>Size ${items.length ? aggSize.toFixed(2) : "—"}</li>
          <li>Value ${items.length ? aggValue.toFixed(2) : "—"}</li>
        </ul>
        <h3>${locale === "zh" ? "相对 510300.SS 归因（近似）" : "Attribution vs 510300.SS (approx)"}</h3>
        <p class="muted tiny">Port ${portRet == null ? "—" : (portRet * 100).toFixed(2)}% · Bench ${benchRet == null ? "—" : (benchRet * 100).toFixed(2)}% · α ${alpha == null ? "—" : (alpha * 100).toFixed(2)}%</p>
        <h3>${locale === "zh" ? "应用为纸盘意图（勾选后执行）" : "Apply as paper intents (check to confirm)"}</h3>
        <ul id="pf-intents">${intentRows}</ul>
        <button type="button" class="btn btn-primary" id="pf-apply">${locale === "zh" ? "写入纸盘" : "Apply selected"}</button>
      </section>
    `;

    root.innerHTML = renderWorkspaceShell({
      locale,
      active: "portfolio",
      layout: "review",
      panesHtml,
      reportDate: data.reportDate,
    });

    root.querySelector("#pf-mode")?.addEventListener("change", (e) => {
      mode = (e.target as HTMLSelectElement).value as WeightMode;
      paint();
    });
    root.querySelectorAll<HTMLInputElement>(".pf-sel").forEach((cb) => {
      cb.addEventListener("change", () => {
        const sym = cb.dataset.symbol;
        if (!sym) return;
        if (cb.checked) selected.add(sym);
        else selected.delete(sym);
        paint();
      });
    });
    root.querySelector("#pf-apply")?.addEventListener("click", () => {
      const intents = [
        ...root.querySelectorAll<HTMLInputElement>(".pf-intent:checked"),
      ];
      if (!intents.length) {
        paint(locale === "zh" ? "请勾选意图" : "Select intents first");
        return;
      }
      let state = loadPaperState();
      const lastClose: Record<string, number> = {};
      for (const s of data.symbols) {
        if (s.lastClose) lastClose[s.symbol] = s.lastClose;
      }
      const eq = equityMark(state, lastClose);
      let applied = 0;
      for (const cb of intents) {
        const sym = cb.dataset.symbol;
        if (!sym) continue;
        const row = data.symbols.find((s) => s.symbol === sym);
        if (!row) continue;
        const w = weights[sym] ?? 0;
        const sigDate =
          defaultSignalDate(row.candles) ?? row.candles.at(-1)?.date ?? "";
        const fill = resolveNextOpenFill(row.candles, sigDate);
        if (!fill) continue;
        const budget = eq * w * 0.95;
        const norm = normalizeQty(budget / fill.fillPrice, row.group);
        if (norm.error || !norm.qty) continue;
        const r = applyBuy(state, {
          symbol: sym,
          qty: norm.qty,
          fill,
          source: "manual",
          note: `portfolio weight ${(w * 100).toFixed(1)}%`,
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
          ? `已写入 ${applied} 笔意图（非静默下单）`
          : `Applied ${applied} intents (not silent orders)`,
      );
    });
  };

  paint();
  document.title = `${tk(locale, "navPortfolio")} · ${tk(locale, "quantOs")}`;
}
