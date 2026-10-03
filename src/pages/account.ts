import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { GOLD_PER_USD, fetchBalance, redeemCode } from "../lib/auth/economy";
import { isLoggedIn, loadSession, logout } from "../lib/auth/session";
import { SUPRO_ADMIN_EMAIL } from "../lib/auth/config";
import { esc } from "../lib/util/esc";
import { bindShellChrome, renderShell } from "./shell";

export function renderAccount(root: HTMLElement, locale: Locale): void {
  if (!isLoggedIn()) {
    location.hash = "#/login";
    return;
  }

  let flash = "";
  let gold = "…";
  let email = loadSession()?.user.email || "";
  let isAdmin = false;

  const paint = (): void => {
    const body = `
      <h1 class="type-heading-m">${esc(t(locale, "accountTitle"))}</h1>
      <p class="lead">${esc(t(locale, "accountLead"))}</p>
      ${flash ? `<p class="notice ${flash.startsWith("Redeem") || flash.includes("兑换") ? "notice-ok" : "notice-error"}">${esc(flash)}</p>` : ""}
      <section class="composer-card">
        <h2>${esc(t(locale, "goldBalance"))}</h2>
        <p class="stat"><span class="stat-n">${esc(String(gold))}</span> <span class="stat-l">${esc(t(locale, "goldUnit"))}</span></p>
        <p class="muted tiny">${esc(email)}${isAdmin ? ` · ${esc(locale === "zh" ? "管理员" : "admin")}` : ""}</p>
        <p class="muted tiny">${esc(t(locale, "goldUsdPeg"))}</p>
        <p class="muted tiny">${esc(t(locale, "sharedWalletNote"))}</p>
        <p class="muted tiny">${esc(t(locale, "goldFloorNote"))}</p>
        <p class="muted tiny">${esc(t(locale, "welcomeGoldNote"))}</p>
      </section>
      <section class="composer-card">
        <h2>${esc(t(locale, "redeemCode"))}</h2>
        <label>${esc(t(locale, "redeemCode"))}
          <input type="text" id="redeem-code" placeholder="SUPRO100"/>
        </label>
        <button type="button" class="btn btn-ink" id="redeem-btn">${esc(t(locale, "redeemSubmit"))}</button>
      </section>
      <div class="cta-row wrap">
        <a class="btn btn-ink" href="#/fin">${esc(t(locale, "openFinDesk"))}</a>
        ${
          String(email).toLowerCase() === SUPRO_ADMIN_EMAIL
            ? `<a class="btn" href="#/admin">${esc(t(locale, "adminTitle"))}</a>`
            : ""
        }
        <button type="button" class="btn btn-ghost" id="logout-btn">${esc(t(locale, "logout"))}</button>
      </div>
    `;
    root.innerHTML = renderShell(locale, "account", body);
    bindShellChrome(root);
    document.title = `${t(locale, "accountTitle")} · Supro`;

    root.querySelector("#logout-btn")?.addEventListener("click", () => {
      logout();
      location.hash = "#/";
    });

    root.querySelector("#redeem-btn")?.addEventListener("click", async () => {
      const code = (
        root.querySelector("#redeem-code") as HTMLInputElement
      ).value.trim();
      const r = await redeemCode(code);
      if (!r.ok) {
        flash = r.error;
        paint();
        return;
      }
      gold = String(r.gold);
      flash =
        locale === "zh"
          ? `兑换成功 +${r.granted}（≈ $${(r.granted / GOLD_PER_USD).toFixed(2)}）`
          : `Redeemed +${r.granted} (≈ $${(r.granted / GOLD_PER_USD).toFixed(2)})`;
      paint();
    });
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
    if (b.email) email = b.email;
    isAdmin = Boolean(b.is_admin);
    paint();
  });
}
