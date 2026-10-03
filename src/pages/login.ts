import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { passwordLogin, signUp } from "../lib/auth/session";
import { esc } from "../lib/util/esc";
import { bindShellChrome, renderShell } from "./shell";

function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function renderLogin(root: HTMLElement, locale: Locale): void {
  let mode: "login" | "signup" = "login";
  let flash = "";
  let flashKind: "error" | "ok" = "error";
  let pendingEmail = "";

  const paint = (): void => {
    const confirmPanel =
      flashKind === "ok" && flash
        ? `<aside class="confirm-panel notice notice-ok" role="status">
            <p><strong>${esc(t(locale, "signupNeedsConfirm"))}</strong></p>
            ${pendingEmail ? `<p class="muted tiny">${esc(pendingEmail)}</p>` : ""}
          </aside>`
        : flash
          ? `<p class="notice ${flashKind === "error" ? "notice-error" : "notice-ok"}" role="alert">${esc(flash)}</p>`
          : "";

    const body = `
      <section class="auth-page">
        <h1 class="type-heading-m">${esc(t(locale, "loginTitle"))}</h1>
        <p class="lead">${esc(t(locale, "loginLead"))}</p>
        <p class="muted tiny">${esc(t(locale, "loginGoldGuide"))}</p>
        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab ${mode === "login" ? "active" : ""}" data-mode="login" role="tab" aria-selected="${mode === "login"}">${esc(t(locale, "loginSubmit"))}</button>
          <button type="button" class="auth-tab ${mode === "signup" ? "active" : ""}" data-mode="signup" role="tab" aria-selected="${mode === "signup"}">${esc(t(locale, "signupSubmit"))}</button>
        </div>
        ${confirmPanel}
        <form class="auth-form composer-card" id="auth-form" novalidate>
          ${
            mode === "signup"
              ? `<label>${esc(t(locale, "loginNickname"))}
            <input type="text" id="auth-nickname" maxlength="64" autocomplete="nickname"/>
          </label>`
              : ""
          }
          <label>${esc(t(locale, "loginEmail"))}
            <input type="email" id="auth-email" required autocomplete="username" inputmode="email"/>
          </label>
          <label>${esc(t(locale, "loginPassword"))}
            <input type="password" id="auth-password" required minlength="6" autocomplete="${mode === "login" ? "current-password" : "new-password"}"/>
          </label>
          ${
            mode === "signup"
              ? `<label>${esc(t(locale, "loginPasswordConfirm"))}
            <input type="password" id="auth-password2" required minlength="6" autocomplete="new-password"/>
          </label>`
              : ""
          }
          <p class="muted tiny">${esc(t(locale, "loginPasswordHint"))}</p>
          <div class="cta-row wrap">
            <button type="submit" class="btn btn-ink" id="auth-submit">
              ${esc(mode === "login" ? t(locale, "loginSubmit") : t(locale, "signupSubmit"))}
            </button>
            <a class="btn btn-ghost" href="#/">${esc(t(locale, "backHome"))}</a>
          </div>
        </form>
        <p class="muted tiny">${esc(t(locale, "loginNote"))}</p>
      </section>
    `;
    root.innerHTML = renderShell(locale, "login", body);
    bindShellChrome(root);
    document.title = `${t(locale, "loginTitle")} · Supro`;

    root.querySelectorAll("[data-mode]").forEach((el) => {
      el.addEventListener("click", () => {
        mode = (el as HTMLElement).dataset.mode === "signup" ? "signup" : "login";
        flash = "";
        flashKind = "error";
        paint();
      });
    });

    root.querySelector("#auth-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (
        root.querySelector("#auth-email") as HTMLInputElement
      ).value.trim();
      const password = (
        root.querySelector("#auth-password") as HTMLInputElement
      ).value;
      flashKind = "error";

      if (!validEmail(email)) {
        flash = t(locale, "loginEmailInvalid");
        paint();
        return;
      }
      if (password.length < 6) {
        flash = t(locale, "loginPasswordShort");
        paint();
        return;
      }

      if (mode === "login") {
        const r = await passwordLogin(email, password);
        if (!r.ok) {
          const code = String(r.code || r.error || "").toLowerCase();
          flash =
            code.includes("email_not_confirmed")
              ? t(locale, "loginEmailNotConfirmed")
              : r.error;
          paint();
          return;
        }
        location.hash = "#/fin";
        return;
      }

      const password2 = (
        root.querySelector("#auth-password2") as HTMLInputElement
      ).value;
      if (password !== password2) {
        flash = t(locale, "loginPasswordMismatch");
        paint();
        return;
      }
      const nickname = (
        root.querySelector("#auth-nickname") as HTMLInputElement | null
      )?.value.trim();

      const r = await signUp(email, password, nickname || undefined);
      if (!r.ok) {
        flash = r.error;
        paint();
        return;
      }
      if (r.needsConfirm && !r.session) {
        pendingEmail = email;
        flash = t(locale, "signupNeedsConfirm");
        flashKind = "ok";
        mode = "login";
        paint();
        return;
      }
      location.hash = "#/account";
    });
  };

  paint();
}
