import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  HANDBOOK_MODULES,
  HANDBOOK_SKILLS,
  handbookSearchHaystack,
  handbookSkillChip,
  type HandbookLocale,
} from "../handbook/content";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

function paraHtml(body: string): string {
  return body
    .split(/\n\n+/)
    .map((p) => {
      const withBreaks = esc(p).replace(/\n/g, "<br/>");
      // light **bold** support
      const withBold = withBreaks.replace(
        /\*\*([^*]+)\*\*/g,
        "<strong>$1</strong>",
      );
      return `<p>${withBold}</p>`;
    })
    .join("");
}

function skillChipsHtml(
  skillIds: string[] | undefined,
  locale: HandbookLocale,
): string {
  if (!skillIds?.length) return "";
  const chips = skillIds
    .map((id) => handbookSkillChip(id, locale))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map(
      (c) =>
        `<a class="skill-chip" href="#/handbook" data-skill="${esc(c.id)}" title="${esc(c.skillPath)}">${esc(c.name)}</a>`,
    )
    .join("");
  return `<div class="skill-chip-row"><span class="tiny muted">${esc(t(locale, "handbookSkillsChip"))}</span> ${chips}</div>`;
}

function skillCatalogTable(locale: HandbookLocale): string {
  const rows = HANDBOOK_SKILLS.map((s) => {
    const name = locale === "zh" ? s.nameZh : s.nameEn;
    return `<tr class="handbook-skill-row" data-skill-row="${esc(s.id)}" id="hb-skill-${esc(s.id)}">
      <td><code>${esc(name)}</code></td>
      <td>${esc(s.site[locale])}</td>
      <td><code class="tiny">${esc(s.cli[locale])}</code></td>
      <td class="tiny">${esc(s.bake[locale])}</td>
    </tr>`;
  }).join("");
  const thSite = locale === "zh" ? "站点表面" : "Site surface";
  const thCli = locale === "zh" ? "Agent CLI / 路径" : "Agent CLI / path";
  const thBake = locale === "zh" ? "Bake 产物" : "Bake artifact";
  const thName = locale === "zh" ? "技能" : "Skill";
  return `<div class="handbook-skill-table-wrap"><table class="handbook-skill-table">
    <thead><tr><th>${esc(thName)}</th><th>${esc(thSite)}</th><th>${esc(thCli)}</th><th>${esc(thBake)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

export function renderHandbook(root: HTMLElement, locale: Locale): void {
  const hbLocale = locale as HandbookLocale;

  const toc = HANDBOOK_MODULES.map((m) => {
    const title = m.title[hbLocale];
    return `<a class="handbook-toc-link" href="#/handbook" data-toc="${esc(m.id)}">${esc(title)}</a>`;
  }).join("");

  const modules = HANDBOOK_MODULES.map((m) => {
    const title = m.title[hbLocale];
    const links = (m.deepLinks ?? [])
      .map(
        (d) =>
          `<a class="btn btn-ghost handbook-deeplink" href="${esc(d.href)}">${esc(d.label[hbLocale])}</a>`,
      )
      .join("");
    const catalog =
      m.id === "skills" ? skillCatalogTable(hbLocale) : "";
    return `<article class="handbook-module" id="hb-${esc(m.id)}" data-module="${esc(m.id)}">
      <h2>${esc(title)}</h2>
      ${paraHtml(m.body[hbLocale])}
      ${skillChipsHtml(m.skills, hbLocale)}
      ${catalog}
      ${links ? `<div class="cta-row handbook-deeplinks">${links}</div>` : ""}
    </article>`;
  }).join("");

  const body = `
    <h1>${esc(t(locale, "handbookTitle"))}</h1>
    <p class="lead">${esc(t(locale, "handbookLead"))}</p>
    <div class="handbook-layout">
      <aside class="handbook-toc" aria-label="${esc(t(locale, "handbookToc"))}">
        <p class="handbook-toc-label tiny muted">${esc(t(locale, "handbookToc"))}</p>
        <nav class="handbook-toc-nav">${toc}</nav>
      </aside>
      <div class="handbook-main">
        <label class="handbook-search-label">
          <span class="visually-hidden">${esc(t(locale, "handbookSearch"))}</span>
          <input type="search" class="handbook-search" id="handbook-search" placeholder="${esc(t(locale, "handbookSearch"))}" autocomplete="off"/>
        </label>
        <p class="handbook-empty muted tiny" id="handbook-empty" hidden>${esc(locale === "zh" ? "无匹配章节" : "No matching chapters")}</p>
        <div class="handbook-modules">${modules}</div>
      </div>
    </div>
  `;

  root.innerHTML = renderShell(locale, "handbook", body);
  document.title = `${t(locale, "handbookTitle")} · Supro`;

  const search = root.querySelector<HTMLInputElement>("#handbook-search");
  const empty = root.querySelector<HTMLElement>("#handbook-empty");
  const articles = Array.from(
    root.querySelectorAll<HTMLElement>(".handbook-module"),
  );
  const tocLinks = Array.from(
    root.querySelectorAll<HTMLAnchorElement>(".handbook-toc-link"),
  );

  const applyFilter = (): void => {
    const q = (search?.value ?? "").trim().toLowerCase();
    let shown = 0;
    for (const art of articles) {
      const id = art.dataset.module ?? "";
      const mod = HANDBOOK_MODULES.find((m) => m.id === id);
      if (!mod) continue;
      const hay = handbookSearchHaystack(mod, hbLocale);
      const match = !q || hay.includes(q);
      art.hidden = !match;
      if (match) shown += 1;
      const toc = tocLinks.find((a) => a.dataset.toc === id);
      if (toc) toc.hidden = !match;
    }
    if (empty) empty.hidden = shown > 0;
  };

  search?.addEventListener("input", applyFilter);

  const scrollToModule = (moduleId: string): void => {
    const art = root.querySelector<HTMLElement>(`#hb-${CSS.escape(moduleId)}`);
    if (!art) return;
    art.hidden = false;
    const toc = tocLinks.find((a) => a.dataset.toc === moduleId);
    if (toc) toc.hidden = false;
    art.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  tocLinks.forEach((a) => {
    a.addEventListener("click", (ev) => {
      const id = a.dataset.toc;
      if (!id) return;
      ev.preventDefault();
      scrollToModule(id);
    });
  });

  const highlightSkill = (skillId: string): void => {
    root
      .querySelectorAll(".handbook-skill-row.is-highlight")
      .forEach((el) => el.classList.remove("is-highlight"));
    root
      .querySelectorAll(".skill-chip.is-active")
      .forEach((el) => el.classList.remove("is-active"));
    const row = root.querySelector(`[data-skill-row="${CSS.escape(skillId)}"]`);
    row?.classList.add("is-highlight");
    root
      .querySelectorAll<HTMLElement>(`[data-skill="${CSS.escape(skillId)}"]`)
      .forEach((el) => el.classList.add("is-active"));
    scrollToModule("skills");
    row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  root.querySelectorAll<HTMLAnchorElement>("[data-skill]").forEach((a) => {
    a.addEventListener("click", (ev) => {
      const id = a.dataset.skill;
      if (!id) return;
      ev.preventDefault();
      if (search && search.value) {
        search.value = "";
        applyFilter();
      }
      highlightSkill(id);
    });
  });
}
