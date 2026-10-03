import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { SUPRO_ADMIN_EMAIL } from "../lib/auth/config";
import { fetchBalance } from "../lib/auth/economy";
import { isLoggedIn, loadSession } from "../lib/auth/session";
import { esc } from "../lib/util/esc";
import { bindShellChrome, renderShell } from "./shell";

function isAdmin(): boolean {
  const email = String(loadSession()?.user.email || "").toLowerCase();
  return email === SUPRO_ADMIN_EMAIL;
}

export function renderAdmin(root: HTMLElement, locale: Locale): void {
  if (!isLoggedIn()) {
    location.hash = "#/login";
    return;
  }
  if (!isAdmin()) {
    location.hash = "#/account";
    return;
  }

  let gold = "…";
  let usageHtml = `<p class="muted">${esc(t(locale, "loading"))}</p>`;
  let flash = "";

  const paint = (): void => {
    const body = `
      <h1 class="type-heading-m">${esc(t(locale, "adminTitle"))}</h1>
      <p class="lead">${esc(t(locale, "adminLead"))}</p>
      ${flash ? `<p class="notice notice-error">${esc(flash)}</p>` : ""}
      <section class="composer-card">
        <p class="muted tiny">${esc(loadSession()?.user.email || SUPRO_ADMIN_EMAIL)}</p>
        <p class="stat"><span class="stat-n">${esc(gold)}</span> <span class="stat-l">${esc(t(locale, "goldUnit"))}</span></p>
        <p class="muted tiny">${esc(t(locale, "goldUsdPeg"))}</p>
        <div class="cta-row wrap">
          <a class="btn btn-ink" href="#/fin">${esc(t(locale, "adminOpenFin"))}</a>
          <a class="btn btn-ghost" href="#/account">${esc(t(locale, "accountTitle"))}</a>
        </div>
      </section>
      <section class="home-directory">
        <h2 class="type-heading-m">${esc(t(locale, "adminUsage"))}</h2>
        ${usageHtml}
      </section>
    `;
    root.innerHTML = renderShell(locale, "admin", body);
    bindShellChrome(root);
    document.title = `${t(locale, "adminTitle")} · Supro`;
  };

  paint();
  void fetchBalance().then((b) => {
    if (!b) {
      flash = t(locale, "economyUnavailable");
      gold = "—";
      paint();
      return;
    }
    gold = String(b.gold);
    const rows = b.usage || [];
    usageHtml = rows.length
      ? `<div class="table-wrap"><table class="home-ranks-table"><thead><tr>
          <th>${esc(locale === "zh" ? "时间" : "When")}</th>
          <th>${esc(locale === "zh" ? "功能" : "Feature")}</th>
          <th>Tokens</th>
          <th>${esc(t(locale, "goldUnit"))}</th>
        </tr></thead><tbody>${rows
          .map((u) => {
            const when = u.created_at
              ? new Date(u.created_at).toISOString().slice(0, 19)
              : "—";
            return `<tr>
              <td>${esc(when)}</td>
              <td>${esc(String(u.feature || "—"))}</td>
              <td>${esc(String(u.tokens ?? "—"))}</td>
              <td>${esc(String(u.gold ?? "—"))}</td>
            </tr>`;
          })
          .join("")}</tbody></table></div>`
      : `<p class="muted">${esc(locale === "zh" ? "暂无用量记录" : "No usage yet")}</p>`;
    paint();
  });
}
