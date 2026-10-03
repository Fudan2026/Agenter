import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  callFinDesk,
  fetchBalance,
  type FinMode,
} from "../lib/auth/economy";
import { isLoggedIn } from "../lib/auth/session";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";
import type { LatestPayload } from "./types";
import type { FactorsIcPayload } from "../lib/factors/ic";
import type { ScreensPayload } from "../lib/screens/map";

export function renderFinDesk(
  root: HTMLElement,
  locale: Locale,
  data: LatestPayload | null,
  screens: ScreensPayload | null = null,
  factorsIc: FactorsIcPayload | null = null,
): void {
  if (!isLoggedIn()) {
    location.hash = `#/login`;
    return;
  }

  let mode: FinMode = "pick";
  let goldLabel = "…";
  let answer = "";
  let flash = "";

  const buildContext = (): string => {
    const parts: string[] = [];
    if (data?.dailyReview) {
      const bullets =
        locale === "zh" ? data.dailyReview.zh : data.dailyReview.en;
      parts.push(`DailyReview:\n- ${bullets.slice(0, 6).join("\n- ")}`);
    }
    if (screens?.screens?.length) {
      parts.push(
        `Screens:\n` +
          screens.screens
            .slice(0, 6)
            .map(
              (s) =>
                `- ${s.id}: ${locale === "zh" ? s.nameZh : s.nameEn} (n=${s.codeCount})`,
            )
            .join("\n"),
      );
    }
    if (factorsIc?.rows?.length) {
      parts.push(
        `IC:\n` +
          factorsIc.rows
            .slice(0, 8)
            .map(
              (r) =>
                `- ${r.factor}: IC=${r.icMean == null ? "—" : r.icMean.toFixed(3)} IR=${r.ir == null ? "—" : r.ir.toFixed(3)}`,
            )
            .join("\n"),
      );
    }
    if (data?.timing?.length) {
      parts.push(
        `TimingTop:\n` +
          data.timing
            .slice(0, 5)
            .map((t) => `- ${t.symbol} score=${t.score}`)
            .join("\n"),
      );
    }
    return parts.join("\n\n").slice(0, 10000);
  };

  const paint = (): void => {
    const modes: FinMode[] = ["pick", "factor", "strategy", "review"];
    const body = `
      <h1>${esc(t(locale, "finDeskTitle"))}</h1>
      <p class="lead">${esc(t(locale, "finDeskLead"))}</p>
      <p class="muted tiny">${esc(t(locale, "finDeskStamp"))} · ${esc(t(locale, "goldBalance"))}: <strong>${esc(goldLabel)}</strong>
        · <a href="#/account">${esc(t(locale, "accountTitle"))}</a></p>
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
      <div class="cta-row wrap">
        ${modes
          .map((m) => {
            const label =
              m === "pick"
                ? t(locale, "finModePick")
                : m === "factor"
                  ? t(locale, "finModeFactor")
                  : m === "strategy"
                    ? t(locale, "finModeStrategy")
                    : t(locale, "finModeReview");
            return `<button type="button" class="btn ${mode === m ? "btn-primary" : ""}" data-mode="${m}">${esc(label)}</button>`;
          })
          .join("")}
      </div>
      <section class="paper-ticket fin-desk-form">
        <label>${esc(t(locale, "finPrompt"))}
          <textarea id="fin-prompt" rows="5" placeholder="${esc(t(locale, "finPromptPh"))}"></textarea>
        </label>
        <button type="button" class="btn btn-primary" id="fin-run">${esc(t(locale, "finRun"))}</button>
      </section>
      <section class="review fin-answer">
        <h2>${esc(t(locale, "finAnswer"))}</h2>
        ${
          answer
            ? `<pre class="fin-answer-body">${esc(answer)}</pre>`
            : `<p class="muted">${esc(t(locale, "finAnswerEmpty"))}</p>`
        }
      </section>
      <p class="muted tiny"><a href="#/quant?panel=lab">${esc(t(locale, "openLab"))}</a>
        · <a href="#/quant?panel=screens">${esc(t(locale, "screensTitle"))}</a>
        · <a href="#/quant?panel=review">${esc(t(locale, "dailyReview"))}</a></p>
    `;
    root.innerHTML = renderShell(locale, "fin", body, {
      subtitle: t(locale, "finDeskTitle"),
    });
    document.title = `${t(locale, "finDeskTitle")} · Supro`;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = ((btn as HTMLElement).dataset.mode as FinMode) || "pick";
        paint();
      });
    });

    root.querySelector("#fin-run")?.addEventListener("click", async () => {
      const prompt = (
        root.querySelector("#fin-prompt") as HTMLTextAreaElement
      ).value.trim();
      if (!prompt) {
        flash = t(locale, "finPromptRequired");
        paint();
        return;
      }
      flash = t(locale, "loading");
      paint();
      (root.querySelector("#fin-prompt") as HTMLTextAreaElement).value = prompt;
      const r = await callFinDesk({
        mode,
        prompt,
        locale,
        context: buildContext(),
      });
      if (!r.ok) {
        flash =
          r.error === "insufficient_gold"
            ? t(locale, "insufficientGold")
            : r.error;
        answer = "";
        paint();
        (root.querySelector("#fin-prompt") as HTMLTextAreaElement).value =
          prompt;
        return;
      }
      answer = r.answer;
      flash =
        locale === "zh"
          ? `已扣 ${r.gold_spent} 金币`
          : `Spent ${r.gold_spent} gold`;
      if (r.gold_remaining != null) goldLabel = String(r.gold_remaining);
      paint();
      (root.querySelector("#fin-prompt") as HTMLTextAreaElement).value = prompt;
    });
  };

  paint();
  void fetchBalance().then((b) => {
    if (b) goldLabel = String(b.gold);
    else goldLabel = "—";
    paint();
  });
}
