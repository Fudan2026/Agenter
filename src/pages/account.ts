import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { GOLD_PER_USD, fetchBalance, redeemCode } from "../lib/auth/economy";
import { accessToken, isLoggedIn, loadSession, logout } from "../lib/auth/session";
import { SUPRO_ADMIN_EMAIL } from "../lib/auth/config";
import { esc } from "../lib/util/esc";
import { bindShellChrome, renderShell } from "./shell";

async function loadProfile(): Promise<{
  nickname: string;
  avatar_url: string;
} | null> {
  try {
    const res = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${accessToken()}` },
      cache: "no-cache",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      profile?: { nickname?: string; avatar_url?: string };
    };
    if (!data.ok) return null;
    return {
      nickname: String(data.profile?.nickname || ""),
      avatar_url: String(data.profile?.avatar_url || ""),
    };
  } catch {
    return null;
  }
}

async function saveProfile(
  nickname: string,
  avatar_url: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken()}`,
      },
      body: JSON.stringify({ nickname, avatar_url }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
    if (!data.ok) return { ok: false, error: String(data.error || data.code || "save_failed") };
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export function renderAccount(root: HTMLElement, locale: Locale): void {
  if (!isLoggedIn()) {
    location.hash = "#/login";
    return;
  }

  let flash = "";
  let flashOk = false;
  let gold = "…";
  let email = loadSession()?.user.email || "";
  let isAdmin = false;
  let nickname = "";
  let avatarUrl = "";

  const paint = (): void => {
    const body = `
      <h1 class="type-heading-m">${esc(t(locale, "accountTitle"))}</h1>
      <p class="lead">${esc(t(locale, "accountLead"))}</p>
      ${flash ? `<p class="notice ${flashOk ? "notice-ok" : "notice-error"}">${esc(flash)}</p>` : ""}
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
        <h2>${esc(t(locale, "profileTitle"))}</h2>
        <label>${esc(t(locale, "profileNickname"))}
          <input type="text" id="profile-nickname" maxlength="64" value="${esc(nickname)}"/>
        </label>
        <label>${esc(t(locale, "profileAvatarUrl"))}
          <input type="url" id="profile-avatar" placeholder="https://…" value="${esc(avatarUrl)}"/>
        </label>
        ${avatarUrl ? `<p class="avatar-preview"><img src="${esc(avatarUrl)}" alt="" width="64" height="64"/></p>` : ""}
        <button type="button" class="btn btn-ink" id="profile-save">${esc(t(locale, "profileSave"))}</button>
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

    root.querySelector("#profile-save")?.addEventListener("click", async () => {
      nickname = (
        root.querySelector("#profile-nickname") as HTMLInputElement
      ).value.trim();
      avatarUrl = (
        root.querySelector("#profile-avatar") as HTMLInputElement
      ).value.trim();
      const r = await saveProfile(nickname, avatarUrl);
      flashOk = r.ok;
      flash = r.ok ? t(locale, "profileSaved") : r.error;
      paint();
    });

    root.querySelector("#redeem-btn")?.addEventListener("click", async () => {
      const code = (
        root.querySelector("#redeem-code") as HTMLInputElement
      ).value.trim();
      const r = await redeemCode(code);
      if (!r.ok) {
        flashOk = false;
        flash = r.error;
        paint();
        return;
      }
      gold = String(r.gold);
      flashOk = true;
      flash =
        locale === "zh"
          ? `兑换成功 +${r.granted}（≈ $${(r.granted / GOLD_PER_USD).toFixed(2)}）`
          : `Redeemed +${r.granted} (≈ $${(r.granted / GOLD_PER_USD).toFixed(2)})`;
      paint();
    });
  };

  paint();
  void Promise.all([fetchBalance(), loadProfile()]).then(([b, p]) => {
    if (!b) {
      flashOk = false;
      flash = t(locale, "economyUnavailable");
      gold = "—";
    } else {
      gold = String(b.gold);
      if (b.email) email = b.email;
      isAdmin = Boolean(b.is_admin);
    }
    if (p) {
      nickname = p.nickname;
      avatarUrl = p.avatar_url;
    }
    paint();
  });
}
