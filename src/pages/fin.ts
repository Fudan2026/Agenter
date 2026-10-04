import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  callFinDesk,
  fetchBalance,
  listFinConversations,
  loadFinConversation,
  modeGoldMultiplier,
  type ChatMessage,
  type FinConversationMeta,
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
import type { AlphaLitePayload } from "../lib/factors/alpha-lite";
import type { TransformerPvProxyPayload } from "../lib/fin/attention-proxy";
import type { ScreensPayload } from "../lib/screens/map";
import type { AnnouncementsPayload } from "../lib/announcements/map";
import type { IwencaiNewsPayload } from "../lib/iwencai-news/map";
import { LAB_STRATEGY_IDS } from "../lib/fin/e2e-recipe";

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
  alphaLite: AlphaLitePayload | null = null,
  transformerPv: TransformerPvProxyPayload | null = null,
  announcements: AnnouncementsPayload | null = null,
  iwencaiNews: IwencaiNewsPayload | null = null,
): void {
  if (!isLoggedIn()) {
    location.hash = `#/login`;
    return;
  }

  let mode: FinMode = "multifactor";
  let goldLabel = "…";
  let flash = "";
  let isAdmin = false;
  let promptSeed = readQueryPrompt();
  let turns: ChatMessage[] = [];
  let conversationId: string | null = null;
  let conversations: FinConversationMeta[] = [];
  let busy = false;

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
    if (alphaLite?.topN?.length) {
      const w = alphaLite.suggestedWeights || {};
      parts.push(
        `AlphaLiteWeights:\n` +
          Object.entries(w)
            .slice(0, 10)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join("\n"),
      );
      parts.push(
        `AlphaLiteTop:\n` +
          alphaLite.topN
            .slice(0, 10)
            .map(
              (r) =>
                `- ${r.symbol} rank=${r.rank} composite=${r.composite == null ? "—" : r.composite.toFixed(3)} ROC20=${r.factors?.ROC20 ?? "—"} RSV20=${r.factors?.RSV20 ?? "—"} STD20=${r.factors?.STD20 ?? "—"}`,
            )
            .join("\n"),
      );
    }
    if (transformerPv?.rows?.length) {
      parts.push(
        `TransformerPv:\n` +
          transformerPv.rows
            .slice(0, 8)
            .map(
              (r) =>
                `- ${r.symbol} P=${r.priceFocus.toFixed(2)} V=${r.volumeFocus.toFixed(2)} slow=${r.slowFocus.toFixed(2)} fast=${r.fastFocus.toFixed(2)} T=${r.temporalShare.toFixed(2)} X=${r.crossShare.toFixed(2)}`,
            )
            .join("\n"),
      );
      const lim =
        locale === "zh"
          ? transformerPv.limitations?.zh
          : transformerPv.limitations?.en;
      if (lim?.length) {
        parts.push(`TransformerLimits:\n- ${lim.slice(0, 3).join("\n- ")}`);
      }
    }
    parts.push(`LabIdsAllowed: ${LAB_STRATEGY_IDS.join(", ")}`);
    type AnnRow = { symbol?: string; title?: string; event?: string };
    const annBag = announcements as { rows?: AnnRow[]; items?: AnnRow[] } | null;
    const annRows: AnnRow[] = annBag?.rows || annBag?.items || [];
    if (annRows.length) {
      parts.push(
        `Announcements:\n` +
          annRows
            .slice(0, 8)
            .map(
              (a) =>
                `- ${a.symbol || "?"} ${a.event || ""} ${String(a.title || "").slice(0, 80)}`,
            )
            .join("\n"),
      );
    }
    const newsRows =
      (iwencaiNews as { rows?: Array<{ title?: string; summary?: string }> } | null)
        ?.rows ||
      (iwencaiNews as { items?: Array<{ title?: string }> } | null)?.items ||
      [];
    if (Array.isArray(newsRows) && newsRows.length) {
      parts.push(
        `IwencaiNews:\n` +
          newsRows
            .slice(0, 6)
            .map((n) => `- ${String(n.title || "").slice(0, 100)}`)
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

  const renderThread = (): string => {
    if (!turns.length) {
      return `<p class="muted">${esc(t(locale, "finAnswerEmpty"))}</p>`;
    }
    return turns
      .map((turn) => {
        const isUser = turn.role === "user";
        if (isUser) {
          return `<article class="fin-turn fin-turn-user"><header>${esc(locale === "zh" ? "你" : "You")}</header><pre class="fin-answer-body">${esc(turn.content)}</pre></article>`;
        }
        const parsed = parseStructuredAnswer(turn.content);
        const html = parsed.structured
          ? renderStructuredHtml(locale, parsed.structured)
          : "";
        const narrative = parsed.narrative || turn.content;
        return `<article class="fin-turn fin-turn-assistant"><header>${esc(locale === "zh" ? "苏大学士" : "Supro Model")}</header>${html}<pre class="fin-answer-body">${esc(narrative)}</pre></article>`;
      })
      .join("");
  };

  const paint = (): void => {
    const tier = modeGoldMultiplier(mode);
    const body = `
      <h1 class="type-heading-m">${esc(t(locale, "finDeskTitle"))}</h1>
      <p class="lead">${esc(t(locale, "finDeskLead"))}</p>
      <p class="fin-scholar-tagline">${esc(t(locale, "finScholarTagline"))}</p>
      <p class="muted tiny">${esc(t(locale, "finDeskStamp"))} · ${esc(t(locale, "goldBalance"))}: <strong>${esc(goldLabel)}</strong>
        ${isAdmin ? ` · ${esc(locale === "zh" ? "管理员" : "admin")}` : ""}
        · ${esc(t(locale, "finGoldTier"))}: <strong>${tier}x</strong></p>
      <p class="muted tiny">${esc(t(locale, "goldFloorNote"))}</p>
      ${flash ? `<p class="notice notice-error">${esc(flash)}</p>` : ""}
      <div class="fin-conv-bar cta-row wrap">
        <button type="button" class="btn btn-ghost" id="fin-new-chat">${esc(t(locale, "finNewChat"))}</button>
        <label class="fin-conv-select muted tiny">${esc(t(locale, "finLoadChat"))}
          <select id="fin-conv-select">
            <option value="">—</option>
            ${conversations
              .map(
                (c) =>
                  `<option value="${esc(c.id)}" ${c.id === conversationId ? "selected" : ""}>${esc(c.title || c.id.slice(0, 8))}</option>`,
              )
              .join("")}
          </select>
        </label>
      </div>
      <form class="fin-desk-form composer-card" id="fin-form">
        <div class="fin-modes" role="tablist">
          ${modes
            .map((m) => {
              const mx = modeGoldMultiplier(m);
              return `<button type="button" class="fin-mode ${mode === m ? "active" : ""}" data-mode="${m}">${esc(modeLabel(locale, m))} <span class="fin-tier">${mx}x</span></button>`;
            })
            .join("")}
        </div>
        <label>${esc(t(locale, "finPrompt"))}
          <textarea id="fin-prompt" rows="4" ${busy ? "disabled" : ""} placeholder="${esc(t(locale, "finPromptPh"))}">${esc(promptSeed)}</textarea>
        </label>
        <div class="cta-row wrap">
          <button type="submit" class="btn btn-ink" ${busy ? "disabled" : ""}>${esc(busy ? t(locale, "loading") : t(locale, "finRun"))}</button>
          <a class="btn btn-ghost" href="#/quant?panel=lab">${esc(t(locale, "openLab"))}</a>
          <a class="btn btn-ghost" href="#/account">${esc(t(locale, "accountTitle"))}</a>
        </div>
      </form>
      <section class="fin-thread">
        <h2>${esc(t(locale, "finAnswer"))}</h2>
        ${attentionHtml()}
        ${renderThread()}
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

    root.querySelector("#fin-new-chat")?.addEventListener("click", () => {
      conversationId = null;
      turns = [];
      promptSeed = "";
      flash = "";
      paint();
    });

    root.querySelector("#fin-conv-select")?.addEventListener("change", (e) => {
      const id = (e.target as HTMLSelectElement).value;
      if (!id) return;
      void loadFinConversation(id).then((loaded) => {
        conversationId = loaded.conversation?.id || id;
        turns = loaded.messages;
        if (loaded.conversation?.mode) {
          mode = loaded.conversation.mode as FinMode;
        }
        flash = "";
        paint();
      });
    });

    root.querySelector("#fin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
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
      busy = true;
      const history = turns.slice();
      turns = [...turns, { role: "user", content: prompt }];
      paint();
      const r = await callFinDesk({
        mode,
        prompt,
        locale,
        context: buildContext(),
        messages: history,
        conversation_id: conversationId,
      });
      busy = false;
      if (!r.ok) {
        turns = history;
        flash =
          r.code === "insufficient_gold_floor"
            ? t(locale, "insufficientGoldFloor")
            : r.code === "email_not_confirmed"
              ? t(locale, "loginEmailNotConfirmed")
              : r.code === "llm_not_configured" ||
                  r.code === "llm_error" ||
                  r.code === "llm_network_error"
                ? t(locale, "finLlmUnavailable")
                : r.error === "insufficient_gold" ||
                    r.code === "insufficient_gold"
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
        paint();
        return;
      }
      turns = [...history, { role: "user", content: prompt }, { role: "assistant", content: r.answer }];
      if (r.conversation_id) conversationId = r.conversation_id;
      if (r.gold_remaining != null) goldLabel = String(r.gold_remaining);
      promptSeed = "";
      void listFinConversations().then((list) => {
        conversations = list;
        paint();
      });
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
  void listFinConversations().then((list) => {
    conversations = list;
    paint();
  });
}
