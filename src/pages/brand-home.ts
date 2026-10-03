import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { AgentRecord } from "../lib/agents/types";
import type { AiRatingsPayload, AiRatingRow } from "../lib/ai-ratings/map";
import { esc } from "../lib/util/esc";
import { loadAgents } from "./compare";
import { bindShellChrome, renderShell } from "./shell";

function agentName(a: AgentRecord, locale: Locale): string {
  return locale === "zh" ? a.nameZh : a.nameEn;
}

function logoSrc(a: AgentRecord): string {
  const base = import.meta.env.BASE_URL || "/";
  if (a.logo) {
    return a.logo.startsWith("http")
      ? a.logo
      : `${base}${a.logo.replace(/^\//, "")}`;
  }
  return `${base}logos/${a.id}.svg`;
}

function rankFor(
  a: AgentRecord,
  byId: Map<string, AiRatingRow>,
): number | null {
  return byId.get(a.id)?.rank ?? null;
}

const TRY_PROMPTS_EN = [
  "Multi-factor screen: momentum + low-vol with liquidity filter",
  "Draft an e2e Lab strategy using confluence and next-open fills",
  "Explain IC decay and McLean-style post-publication fade",
  "Review today’s baked daily review in plain English",
  "Map a transformer / FinCast idea to what this site can and cannot run",
  "Propose factor tilts from the IC board without promising returns",
];

const TRY_PROMPTS_ZH = [
  "多因子选股：动量 + 低波，并考虑流动性",
  "端到端策略：用 confluence，强调次日开盘成交",
  "解释 IC 衰减与发表后可预测性变弱",
  "用白话复盘今日烘焙日报",
  "把 Transformer / FinCast 想法映射到本站能做与不能做的边界",
  "根据 IC 面板给因子倾斜建议，不承诺收益",
];

function renderRankBoard(
  locale: Locale,
  ratings: AiRatingsPayload | null,
  agents: AgentRecord[],
): string {
  if (!ratings?.rows?.length) {
    return `<p class="muted">${esc(locale === "zh" ? "暂无周排名（等待 ai-ratings bake）。" : "No weekly ranks yet (awaiting ai-ratings bake).")}</p>`;
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

  return `<ul class="home-ai-list" id="home-ai-grid">${sorted
    .map((a) => {
      const name = agentName(a, locale);
      const href = a.links.homepage || a.links.docs || "#/compare";
      const external = Boolean(a.links.homepage || a.links.docs);
      const rank = rankFor(a, byId);
      const rankBtn =
        rank != null
          ? `<button type="button" class="home-rank-chip" data-open-ranks="1">#${esc(String(rank))}</button>`
          : `<button type="button" class="home-rank-chip muted" data-open-ranks="1">${esc(t(locale, "homeRankCol"))}</button>`;
      const initials = name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .slice(0, 2);
      return `
        <li class="home-ai-row" data-agent="${esc(a.id)}">
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
                ? `<a class="home-ai-link site-link-dotted" href="${esc(a.links.homepage)}" target="_blank" rel="noopener noreferrer">${esc(t(locale, "homeVisitSite"))}</a>`
                : ""
            }
          </div>
        </li>`;
    })
    .join("")}</ul>`;
}

export function renderBrandHome(
  root: HTMLElement,
  locale: Locale,
  aiRatings: AiRatingsPayload | null = null,
): void {
  const prompts = locale === "zh" ? TRY_PROMPTS_ZH : TRY_PROMPTS_EN;
  const chips = prompts
    .map(
      (p, i) => `
      <li class="try-chip">
        <span class="try-chip-q">${esc(p)}</span>
        <button type="button" class="try-chip-btn" data-try="${i}">${esc(t(locale, "homeTry"))}</button>
      </li>`,
    )
    .join("");

  const body = `
    <section class="hero brand-hero home-hero-america">
      <p class="hero-kicker">${esc(t(locale, "helloKicker"))}</p>
      <h1 class="hero-brand type-site-hero">${esc(t(locale, "homeH1"))}</h1>
      <p class="hero-sub">${esc(t(locale, "homeSub"))}</p>
      <p class="hero-lead">${esc(t(locale, "homeLead"))}</p>

      <form class="home-composer" id="home-composer" aria-label="${esc(t(locale, "homeComposerLabel"))}">
        <label class="sr-only" for="home-composer-input">${esc(t(locale, "homeComposerLabel"))}</label>
        <textarea id="home-composer-input" name="q" rows="2" placeholder="${esc(t(locale, "homeComposerPh"))}"></textarea>
        <button type="submit" class="composer-submit">${esc(t(locale, "homeComposerSubmit"))}</button>
      </form>
      <p class="composer-meta">
        <a class="site-link-dotted" href="#/handbook">${esc(t(locale, "homePrivacyLink"))}</a>
        <span class="meta-dot" aria-hidden="true">·</span>
        <a class="site-link-dotted" href="#/fin">${esc(t(locale, "homeHowLink"))}</a>
      </p>
      <ul class="try-row" aria-label="examples">${chips}</ul>
    </section>

    <section class="home-directory" id="home-directory">
      <div class="home-section-head">
        <div>
          <h2 class="type-heading-m">${esc(t(locale, "homeDirectoryTitle"))}</h2>
          <p class="muted">${esc(t(locale, "homeDirectoryLead"))}</p>
        </div>
        <button type="button" class="btn btn-ink" id="home-open-ranks">${esc(t(locale, "homeWeeklyRanks"))}</button>
      </div>
      <div id="home-directory-body"><p class="muted">${esc(t(locale, "loading"))}</p></div>
      <div id="home-ranks-slot" hidden></div>
    </section>

    <section class="home-quant-strip">
      <h2 class="type-heading-m">${esc(t(locale, "homeQuantStripTitle"))}</h2>
      <p class="muted">${esc(t(locale, "homeQuantStripLead"))}</p>
      <div class="cta-row wrap">
        <a class="btn btn-ink" href="#/quant">${esc(t(locale, "navQuant"))}</a>
        <a class="btn" href="#/paper">${esc(t(locale, "navPaper"))}</a>
        <a class="btn" href="#/fin">${esc(t(locale, "finDeskTitle"))}</a>
        <a class="btn btn-ghost" href="#/tools">${esc(t(locale, "ctaTools"))}</a>
      </div>
    </section>
  `;

  root.innerHTML = renderShell(locale, "home", body, {
    subtitle: t(locale, "homeSub"),
  });
  bindShellChrome(root);
  document.title = `${t(locale, "homeH1")} · ${t(locale, "tagline")}`;

  const input = root.querySelector(
    "#home-composer-input",
  ) as HTMLTextAreaElement | null;
  root.querySelectorAll("[data-try]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number((btn as HTMLElement).dataset.try);
      if (!input || !Number.isFinite(i) || !prompts[i]) return;
      input.value = prompts[i];
      input.focus();
    });
  });
  root.querySelector("#home-composer")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (input?.value || "").trim();
    const enc = encodeURIComponent(q);
    location.hash = q ? `#/fin?q=${enc}` : "#/fin";
  });

  const dirBody = root.querySelector("#home-directory-body");
  const ranksSlot = root.querySelector(
    "#home-ranks-slot",
  ) as HTMLElement | null;
  let loadedAgents: AgentRecord[] = [];

  const openRanks = (): void => {
    if (!ranksSlot) return;
    ranksSlot.hidden = false;
    ranksSlot.innerHTML = renderRankBoard(locale, aiRatings, loadedAgents);
    ranksSlot
      .querySelector("#home-ranks-close")
      ?.addEventListener("click", () => {
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
        dirBody.innerHTML = `<p class="notice notice-error">${esc(t(locale, "loadError"))}</p>`;
      }
    });
}
