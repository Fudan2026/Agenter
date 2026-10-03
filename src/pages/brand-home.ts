import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AgentRecord } from "../lib/agents/types";
import type { AiRatingsPayload, AiRatingRow } from "../lib/ai-ratings/map";
import { esc } from "../lib/util/esc";
import { loadAgents } from "./compare";
import { renderShell } from "./shell";

function agentName(a: AgentRecord, locale: Locale): string {
  return locale === "zh" ? a.nameZh : a.nameEn;
}

function logoSrc(a: AgentRecord): string {
  const base = import.meta.env.BASE_URL || "/";
  if (a.logo) {
    return a.logo.startsWith("http") ? a.logo : `${base}${a.logo.replace(/^\//, "")}`;
  }
  return `${base}logos/${a.id}.svg`;
}

function rankFor(
  a: AgentRecord,
  byId: Map<string, AiRatingRow>,
): number | null {
  const r = byId.get(a.id);
  return r?.rank ?? null;
}

function renderRankBoard(
  locale: Locale,
  ratings: AiRatingsPayload | null,
  agents: AgentRecord[],
): string {
  if (!ratings?.rows?.length) {
    return `<p class="muted">${esc(locale === "zh" ? "暂无周排名数据（等待 ai-ratings bake）。" : "No weekly ranks yet (awaiting ai-ratings bake).")}</p>`;
  }
  const byAgent = new Map(agents.map((a) => [a.id, a]));
  const rows = [...ratings.rows]
    .filter((r) => r.rank != null)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const body = rows
    .map((r) => {
      const ag = byAgent.get(r.agentId);
      const name = ag ? agentName(ag, locale) : r.agentId;
      const elo = r.arenaElo != null ? String(r.arenaElo) : "—";
      const iq = r.aaIq != null ? String(r.aaIq) : "—";
      return `<tr>
        <td>${esc(String(r.rank))}</td>
        <td>${esc(name)}</td>
        <td>${esc(elo)}</td>
        <td>${esc(iq)}</td>
      </tr>`;
    })
    .join("");
  const updated = ratings.generatedAt
    ? new Date(ratings.generatedAt).toISOString().slice(0, 10)
    : "—";
  return `
    <div class="home-ranks-panel" id="home-ranks">
      <div class="home-ranks-head">
        <h3>${esc(t(locale, "homeWeeklyRanks"))}</h3>
        <button type="button" class="btn btn-ghost" id="home-ranks-close">${esc(t(locale, "homeCloseRanks"))}</button>
      </div>
      <p class="muted tiny">${esc(t(locale, "liveRatingsLead"))} · ${esc(updated)}</p>
      <div class="table-wrap">
        <table class="home-ranks-table">
          <thead>
            <tr>
              <th>${esc(t(locale, "homeRankCol"))}</th>
              <th>${esc(locale === "zh" ? "名称" : "Name")}</th>
              <th>${esc(t(locale, "arenaElo"))}</th>
              <th>${esc(t(locale, "aaIq"))}</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

function renderDirectory(
  locale: Locale,
  agents: AgentRecord[],
  ratings: AiRatingsPayload | null,
): string {
  const byId = new Map((ratings?.rows || []).map((r) => [r.agentId, r]));
  const sorted = [...agents].sort((a, b) => {
    const ra = rankFor(a, byId);
    const rb = rankFor(b, byId);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return agentName(a, locale).localeCompare(agentName(b, locale));
  });

  const cards = sorted
    .map((a) => {
      const name = agentName(a, locale);
      const href = a.links.homepage || a.links.docs || "#/compare";
      const external = Boolean(a.links.homepage || a.links.docs);
      const rank = rankFor(a, byId);
      const rankBtn =
        rank != null
          ? `<button type="button" class="home-rank-chip" data-open-ranks="1" title="${esc(t(locale, "homeWeeklyRanks"))}">#${esc(String(rank))}</button>`
          : `<button type="button" class="home-rank-chip muted" data-open-ranks="1" title="${esc(t(locale, "homeWeeklyRanks"))}">${esc(t(locale, "homeRankCol"))}</button>`;
      const initials = name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .slice(0, 2);
      return `
        <article class="home-ai-card" data-agent="${esc(a.id)}">
          <div class="home-ai-logo-wrap">
            <img class="home-ai-logo" src="${esc(logoSrc(a))}" alt="" width="40" height="40" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='grid'" />
            <span class="home-ai-initials" style="display:none">${esc(initials || "AI")}</span>
          </div>
          <div class="home-ai-meta">
            <a class="home-ai-name" href="${esc(href)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(name)}</a>
            <span class="home-ai-cat muted tiny">${esc(a.category)}</span>
          </div>
          <div class="home-ai-actions">
            ${rankBtn}
            ${
              a.links.homepage
                ? `<a class="home-ai-link" href="${esc(a.links.homepage)}" target="_blank" rel="noopener noreferrer">${esc(t(locale, "homeVisitSite"))}</a>`
                : ""
            }
          </div>
        </article>`;
    })
    .join("");

  return `<div class="home-ai-grid" id="home-ai-grid">${cards}</div>`;
}

export function renderBrandHome(
  root: HTMLElement,
  locale: Locale,
  aiRatings: AiRatingsPayload | null = null,
): void {
  const body = `
    <section class="hero brand-hero home-hero-pro">
      <p class="hero-kicker">${esc(t(locale, "tagline"))}</p>
      <h1 class="hero-brand">${esc(t(locale, "homeH1"))}</h1>
      <p class="hero-sub">${esc(t(locale, "homeSub"))}</p>
      <p class="hero-lead">${esc(t(locale, "homeLead"))}</p>
      <div class="cta-row wrap">
        <a class="btn btn-primary" href="#/compare">${esc(t(locale, "ctaCompare"))}</a>
        <a class="btn" href="#/quant">${esc(t(locale, "ctaQuantHome"))}</a>
        <a class="btn" href="#/fin">${esc(t(locale, "ctaFinHome"))}</a>
        <a class="btn btn-ghost" href="#/handbook">${esc(t(locale, "ctaHandbook"))}</a>
      </div>
    </section>

    <section class="home-directory" id="home-directory">
      <div class="home-section-head">
        <div>
          <h2>${esc(t(locale, "homeDirectoryTitle"))}</h2>
          <p class="muted">${esc(t(locale, "homeDirectoryLead"))}</p>
        </div>
        <button type="button" class="btn btn-primary" id="home-open-ranks">${esc(t(locale, "homeWeeklyRanks"))}</button>
      </div>
      <div id="home-directory-body"><p class="muted">${esc(t(locale, "loading"))}</p></div>
      <div id="home-ranks-slot" hidden></div>
    </section>

    <section class="home-quant-strip">
      <h2>${esc(t(locale, "homeQuantStripTitle"))}</h2>
      <p class="muted">${esc(t(locale, "homeQuantStripLead"))}</p>
      <div class="cta-row wrap">
        <a class="btn btn-primary" href="#/quant">${esc(t(locale, "navQuant"))}</a>
        <a class="btn" href="#/paper">${esc(t(locale, "navPaper"))}</a>
        <a class="btn" href="#/fin">${esc(t(locale, "finDeskTitle"))}</a>
        <a class="btn btn-ghost" href="#/tools">${esc(t(locale, "ctaTools"))}</a>
      </div>
    </section>
  `;

  root.innerHTML = renderShell(locale, "home", body, {
    subtitle: t(locale, "homeSub"),
  });
  document.title = `${t(locale, "homeH1")} · ${t(locale, "tagline")}`;

  const dirBody = root.querySelector("#home-directory-body");
  const ranksSlot = root.querySelector("#home-ranks-slot") as HTMLElement | null;
  let loadedAgents: AgentRecord[] = [];

  const openRanks = (): void => {
    if (!ranksSlot) return;
    ranksSlot.hidden = false;
    ranksSlot.innerHTML = renderRankBoard(locale, aiRatings, loadedAgents);
    ranksSlot.querySelector("#home-ranks-close")?.addEventListener("click", () => {
      ranksSlot.hidden = true;
      ranksSlot.innerHTML = "";
    });
    ranksSlot.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  root.querySelector("#home-open-ranks")?.addEventListener("click", openRanks);

  void loadAgents()
    .then((agents) => {
      loadedAgents = agents;
      if (dirBody) {
        dirBody.innerHTML = renderDirectory(locale, agents, aiRatings);
        dirBody.querySelectorAll("[data-open-ranks]").forEach((el) => {
          el.addEventListener("click", openRanks);
        });
      }
    })
    .catch(() => {
      if (dirBody) {
        dirBody.innerHTML = `<p class="flash">${esc(t(locale, "loadError"))}</p>`;
      }
    });
}
