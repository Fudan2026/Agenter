import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { PATTERN_META } from "../lib/patterns/types";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload, SymbolRow } from "./types";

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

  return `<a class="asset-card" href="#/asset/${encodeURIComponent(s.symbol)}">
    <div class="asset-card-top">
      <div>
        <div class="asset-name">${esc(name)}</div>
        <div class="asset-meta">${esc(s.symbol)} · ${esc(groupLabel(locale, s.group))} · ${esc(statusLabel(locale, s.dataStatus))}</div>
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

/** Quant tool home — former site facade, now at /quant only. */
export function renderQuant(
  root: HTMLElement,
  data: LatestPayload,
  locale: Locale,
): void {
  const bullets = locale === "zh" ? data.dailyReview.zh : data.dailyReview.en;
  const groups: SymbolRow["group"][] = ["macro", "china-etf", "china-ashare"];

  const body = `
    <h1>${esc(t(locale, "quantTitle"))}</h1>
    <p class="lead">${esc(t(locale, "quantSubtitle"))}</p>
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
}
