import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

export function renderBrandHome(root: HTMLElement, locale: Locale): void {
  const body = `
    <section class="hero brand-hero">
      <p class="hero-kicker">${esc(t(locale, "tagline"))}</p>
      <h1 class="hero-brand">${esc(t(locale, "homeH1"))}</h1>
      <p class="hero-sub">${esc(t(locale, "homeSub"))}</p>
      <p class="hero-lead">${esc(t(locale, "homeLead"))}</p>
      <div class="cta-row wrap">
        <a class="btn btn-primary" href="#/compare">${esc(t(locale, "ctaCompare"))}</a>
        <a class="btn" href="#/compare?preset=quant">${esc(t(locale, "ctaQuantCompare"))}</a>
        <a class="btn" href="#/learn">${esc(t(locale, "ctaLearn"))}</a>
        <a class="btn btn-ghost" href="#/handbook">${esc(t(locale, "ctaHandbook"))}</a>
      </div>
      <p class="muted tiny">${esc(t(locale, "academyTeaser"))}</p>
    </section>
    <section class="how-section">
      <h2>${esc(t(locale, "howTitle"))}</h2>
      <ol class="how-steps">
        <li>${esc(t(locale, "howStep1"))}</li>
        <li>${esc(t(locale, "howStep2"))}</li>
        <li>${esc(t(locale, "howStep3"))}</li>
      </ol>
      <p class="muted">${esc(t(locale, "toolsTeaser"))}</p>
      <p class="muted tiny">${esc(t(locale, "handbookAcademy"))}: ${esc(t(locale, "presetQuant"))} → <a href="#/learn">${esc(t(locale, "navLearn"))}</a> / <a href="#/handbook">${esc(t(locale, "navHandbook"))}</a></p>
    </section>
    <section class="tools-secondary">
      <h2>${esc(t(locale, "toolsSecondaryNote"))}</h2>
      <p class="muted tiny">${esc(t(locale, "toolsQuantEntry"))}</p>
      <div class="cta-row">
        <a class="btn btn-ghost" href="#/tools">${esc(t(locale, "ctaTools"))}</a>
      </div>
    </section>
  `;
  root.innerHTML = renderShell(locale, "home", body, {
    subtitle: t(locale, "homeSub"),
  });
  document.title = `${t(locale, "homeH1")} · ${t(locale, "homeSub")}`;
}
