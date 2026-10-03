import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { passwordLogin, signUp } from "../lib/auth/session";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

export function renderLogin(root: HTMLElement, locale: Locale): void {
  let mode: "login" | "signup" = "login";
  let flash = "";

  const paint = (): void => {
    const body = `
      <h1>${esc(t(locale, "loginTitle"))}</h1>
      <p class="lead">${esc(t(locale, "loginLead"))}</p>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
      <form class="paper-ticket auth-form" id="auth-form">
        <label>${esc(t(locale, "loginEmail"))}
          <input type="email" id="auth-email" required autocomplete="username"/>
        </label>
        <label>${esc(t(locale, "loginPassword"))}
          <input type="password" id="auth-password" required minlength="6" autocomplete="${mode === "login" ? "current-password" : "new-password"}"/>
        </label>
        <div class="cta-row wrap">
          <button type="submit" class="btn btn-primary" id="auth-submit">
            ${esc(mode === "login" ? t(locale, "loginSubmit") : t(locale, "signupSubmit"))}
          </button>
          <button type="button" class="btn" id="auth-toggle">
            ${esc(mode === "login" ? t(locale, "signupToggle") : t(locale, "loginToggle"))}
          </button>
        </div>
      </form>
      <p class="muted tiny">${esc(t(locale, "loginNote"))}</p>
      <p><a href="#/tools">${esc(t(locale, "backTools"))}</a></p>
    `;
    root.innerHTML = renderShell(locale, "login", body);
    document.title = `${t(locale, "loginTitle")} · Agenter`;

    root.querySelector("#auth-toggle")?.addEventListener("click", () => {
      mode = mode === "login" ? "signup" : "login";
      flash = "";
      paint();
    });

    root.querySelector("#auth-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (
        root.querySelector("#auth-email") as HTMLInputElement
      ).value.trim();
      const password = (
        root.querySelector("#auth-password") as HTMLInputElement
      ).value;
      if (mode === "login") {
        const r = await passwordLogin(email, password);
        if (!r.ok) {
          flash = r.error;
          paint();
          return;
        }
        location.hash = "#/fin";
        return;
      }
      const r = await signUp(email, password);
      if (!r.ok) {
        flash = r.error;
        paint();
        return;
      }
      if (r.needsConfirm && !r.session) {
        flash = t(locale, "signupNeedsConfirm");
        mode = "login";
        paint();
        return;
      }
      location.hash = "#/account";
    });
  };

  paint();
}
