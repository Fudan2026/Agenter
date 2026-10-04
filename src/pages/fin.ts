import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  callFinDesk,
  fetchBalance,
  type FinMode,
} from "../lib/auth/economy";
import { MIN_GOLD_FLOOR } from "../lib/auth/config";
import { isLoggedIn } from "../lib/auth/session";
import {
  parseStructuredAnswer,
  renderStructuredHtml,
} from "../lib/fin/structured";
import {
  attentionProxyFromSeries,
  renderAttentionBoard,
} from "../lib/fin/attention-proxy";
import { esc } from "../lib/util/esc";
import { bindShellChrome, renderShell } from "./shell";
import type { LatestPayload } from "./types";
import type { FactorsIcPayload } from "../lib/factors/ic";
import type { ScreensPayload } from "../lib/screens/map";

function readQueryPrompt(): string {
  try {
    const h = location.hash || "";
    const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
    return new URLSearchParams(q).get("q") || "";
  } catch {
    return "";
  }
}

function modeLabel(locale: Locale, mode: FinMode): string {
  const map: Record<FinMode, string> = {
    pick: t(locale, "finModePick"),
    factor: t(locale, "finModeFactor"),
    strategy: t(locale, "finModeStrategy"),
    review: t(locale, "finModeReview"),
    multifactor: t(locale, "finModeMultifactor"),
    e2e: t(locale, "finModeE2e"),
    transformer: t(locale, "finModeTransformer"),
    report: t(locale, "finModeReport"),
    allocate: t(locale, "finModeAllocate"),
  };
  return map[mode];
}

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

  let mode: FinMode = "multifactor";
  let goldLabel = "…";
  let answerRaw = "";
  let structuredHtml = "";
  let flash = "";
  let isAdmin = false;
  let promptSeed = readQueryPrompt();

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
            .map((row) => `- ${row.symbol} score=${row.score}`)
            .join("\n"),
      );
    }
    // SkillHub methodology distill (text only — no live THS)
    parts.push(
      locale === "zh"
        ? "Skills: 多因子选股策略 · 机器学习策略 · 因子研究框架 · 策略生成与优化（方法论蒸馏，非实盘）。"
        : "Skills: multi-factor · ML strategy · factor research · strategy generate (methodology distill; not live broker).",
    );
    return parts.join("\n\n").slice(0, 12000);
  };

  const attentionHtml = (): string => {
    if (mode !== "transformer" || !data?.symbols?.length) return "";
    const rows = data.symbols
      .filter((s) => s.dataStatus !== "missing")
      .slice(0, 6)
      .map((s) =>
        attentionProxyFromSeries(
          s.symbol,
          (s.candles || []).map((c) => ({ c: c.close, v: c.volume })),
          locale,
        ),
      )
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    if (!rows.length) return "";
    return `<section><h3>${esc(t(locale, "finAttention"))}</h3>${renderAttentionBoard(rows)}</section>`;
  };

  const modes: FinMode[] = [
    "pick",
    "factor",
    "strategy",
    "review",
    "multifactor",
    "e2e",
    "transformer",
    "report",
    "allocate",
  ];

  const paint = (): void => {
    const parsed = answerRaw
      ? parseStructuredAnswer(answerRaw)
      : { structured: null, narrative: "" };
    structuredHtml = parsed.structured
      ? renderStructuredHtml(locale, parsed.structured)
      : "";
    const narrative =
      parsed.narrative ||
      (answerRaw ? answerRaw : t(locale, "finAnswerEmpty"));

    const body = `
      <h1 class="type-heading-m">${esc(t(locale, "finDeskTitle"))}</h1>
      <p class="lead">${esc(t(locale, "finDeskLead"))}</p>
      <p class="muted tiny">${esc(t(locale, "finDeskStamp"))} · ${esc(t(locale, "goldBalance"))}: <strong>${esc(goldLabel)}</strong>
        ${isAdmin ? ` · ${esc(locale === "zh" ? "管理员" : "admin")}` : ""}</p>
      <p class="muted tiny">${esc(t(locale, "goldFloorNote"))}</p>
      ${flash ? `<p class="notice notice-error">${esc(flash)}</p>` : ""}
      <form class="fin-desk-form composer-card" id="fin-form">
        <div class="fin-modes" role="tablist">
          ${modes
            .map(
              (m) =>
                `<button type="button" class="fin-mode ${mode === m ? "active" : ""}" data-mode="${m}">${esc(modeLabel(locale, m))}</button>`,
            )
            .join("")}
        </div>
        <label>${esc(t(locale, "finPrompt"))}
          <textarea id="fin-prompt" rows="5" placeholder="${esc(t(locale, "finPromptPh"))}">${esc(promptSeed)}</textarea>
        </label>
        <div class="cta-row wrap">
          <button type="submit" class="btn btn-ink">${esc(t(locale, "finRun"))}</button>
          <a class="btn btn-ghost" href="#/quant?panel=lab">${esc(t(locale, "openLab"))}</a>
          <a class="btn btn-ghost" href="#/account">${esc(t(locale, "accountTitle"))}</a>
        </div>
      </form>
      <section class="fin-answer">
        <h2>${esc(t(locale, "finAnswer"))}</h2>
        ${structuredHtml || ""}
        ${attentionHtml()}
        <pre class="fin-answer-body">${esc(narrative)}</pre>
      </section>
    `;
    root.innerHTML = renderShell(locale, "fin", body, {
      subtitle: t(locale, "finDeskStamp"),
    });
    bindShellChrome(root);
    document.title = `${t(locale, "finDeskTitle")} · Supro`;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = (btn as HTMLElement).dataset.mode as FinMode;
        promptSeed = (
          root.querySelector("#fin-prompt") as HTMLTextAreaElement
        ).value;
        paint();
      });
    });

    root.querySelector("#fin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const prompt = (
        root.querySelector("#fin-prompt") as HTMLTextAreaElement
      ).value.trim();
      promptSeed = prompt;
      if (!prompt) {
        flash = t(locale, "finPromptRequired");
        paint();
        return;
      }
      flash = "";
      answerRaw = t(locale, "loading");
      structuredHtml = "";
      paint();
      const r = await callFinDesk({
        mode,
        prompt,
        locale,
        context: buildContext(),
      });
      if (!r.ok) {
        flash =
          r.code === "insufficient_gold_floor"
            ? t(locale, "insufficientGoldFloor")
            : r.code === "email_not_confirmed"
              ? t(locale, "loginEmailNotConfirmed")
              : r.code === "llm_not_configured" ||
                  r.code === "llm_error" ||
                  r.code === "llm_network_error"
                ? t(locale, "finLlmUnavailable")
                : r.error === "insufficient_gold" || r.code === "insufficient_gold"
                  ? t(locale, "insufficientGold")
                  : r.error;
        if (
          (r.code === "llm_not_configured" ||
            r.code === "llm_error" ||
            r.code === "llm_network_error") &&
          r.error
        ) {
          flash = `${flash} ${r.error}`;
        }
        answerRaw = "";
        paint();
        return;
      }
      answerRaw = r.answer;
      if (r.gold_remaining != null) goldLabel = String(r.gold_remaining);
      paint();
    });
  };

  paint();
  void fetchBalance().then((b) => {
    if (!b) {
      flash = t(locale, "economyUnavailable");
      goldLabel = "—";
      paint();
      return;
    }
    goldLabel = String(b.gold);
    isAdmin = Boolean(b.is_admin);
    void MIN_GOLD_FLOOR;
    paint();
  });
}
