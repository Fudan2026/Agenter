import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import { isLearnDone, setLearnDone } from "../lib/harness/weights";
import { esc } from "../lib/util/esc";
import { renderShell } from "./shell";

interface Scenario {
  id: string;
  titleZh: string;
  titleEn: string;
  stepsZh: string[];
  stepsEn: string[];
  href: string;
}

/** ≥5 practice scenarios (Phase 3). */
const SCENARIOS: Scenario[] = [
  {
    id: "pick-coding",
    titleZh: "场景 1：选一个编码 Agent",
    titleEn: "Scenario 1: Pick a coding agent",
    stepsZh: [
      "打开对比页，类别筛选「编码」。",
      "勾选 2–3 个（例如 Cursor / Claude Code / 通义灵码）。",
      "提高「编码能力」与「工具调用」权重，看加权分变化。",
    ],
    stepsEn: [
      "Open Compare and filter category Coding.",
      "Pick 2–3 (e.g. Cursor / Claude Code / Tongyi Lingma).",
      "Raise Coding ability and Tool use weights; watch scores.",
    ],
    href: "#/compare",
  },
  {
    id: "cn-access",
    titleZh: "场景 2：国内可达优先",
    titleEn: "Scenario 2: CN accessibility first",
    stepsZh: [
      "地区筛选 CN，或提高「国内可达」权重。",
      "并排对比 Kimi / DeepSeek / Trae。",
      "记下短名单，不必追求海外最强模型。",
    ],
    stepsEn: [
      "Filter region CN, or raise CN accessibility weight.",
      "Side-by-side Kimi / DeepSeek / Trae.",
      "Leave with a shortlist — no need for overseas-only picks.",
    ],
    href: "#/compare",
  },
  {
    id: "privacy",
    titleZh: "场景 3：隐私 / 自托管",
    titleEn: "Scenario 3: Privacy / self-host",
    stepsZh: [
      "提高「隐私可控」权重。",
      "对比 Aider / Continue / OpenClaw 与云端产品。",
      "确认定价带与 BYOK 是否匹配你的约束。",
    ],
    stepsEn: [
      "Raise Privacy control weight.",
      "Compare Aider / Continue / OpenClaw vs cloud products.",
      "Check pricing band and BYOK against your constraints.",
    ],
    href: "#/compare",
  },
  {
    id: "quant-read",
    titleZh: "场景 4：读懂量化工具页",
    titleEn: "Scenario 4: Read the Quant tool",
    stepsZh: [
      "从工具箱进入量化复盘（不是首页）。",
      "看每日复盘要点与形态命中芯片。",
      "点开一只标的，确认形态仅用历史 K 线。",
    ],
    stepsEn: [
      "Open Quant from Tools (not Home).",
      "Read daily review bullets and pattern chips.",
      "Open one symbol; confirm patterns use historical OHLC only.",
    ],
    href: "#/quant",
  },
  {
    id: "paper-drill",
    titleZh: "场景 5：纸盘一次买卖",
    titleEn: "Scenario 5: One paper buy/sell",
    stepsZh: [
      "进入纸盘，选一只 A 股/ETF，数量用 100 的倍数。",
      "买入后刷新页面，确认日记与持仓仍在（localStorage）。",
      "导出券商清单 CSV，核对「次日开盘」措辞；本站不下单。",
    ],
    stepsEn: [
      "Open Paper; pick an A-share/ETF; qty multiple of 100.",
      "After buy, reload — journal/positions should persist.",
      "Export checklist CSV; verify NEXT OPEN wording; site never submits.",
    ],
    href: "#/paper",
  },
];

export function renderLearn(root: HTMLElement, locale: Locale): void {
  const done = isLearnDone();
  const body = `
    <h1>${esc(t(locale, "learnTitle"))}</h1>
    <p class="lead">${esc(t(locale, "learnLead"))}</p>
    <p class="learn-status ${done ? "done" : ""}">${done ? esc(t(locale, "learnDone")) : ""}</p>
    <div class="scenario-list">
      ${SCENARIOS.map((s, i) => {
        const title = locale === "zh" ? s.titleZh : s.titleEn;
        const steps = locale === "zh" ? s.stepsZh : s.stepsEn;
        return `<article class="scenario" data-scenario="${esc(s.id)}">
          <h2>${esc(title)}</h2>
          <ol>${steps.map((st) => `<li>${esc(st)}</li>`).join("")}</ol>
          <a class="btn" href="${s.href}">${esc(t(locale, "scenarioStart"))} ${i + 1}</a>
        </article>`;
      }).join("")}
    </div>
    <div class="cta-row">
      <button type="button" class="btn btn-primary" id="learn-done">${esc(t(locale, "learnMarkDone"))}</button>
      <button type="button" class="btn" id="learn-reset">${esc(t(locale, "learnReset"))}</button>
    </div>
  `;
  root.innerHTML = renderShell(locale, "learn", body);
  document.title = `${t(locale, "learnTitle")} · Agenter`;

  root.querySelector("#learn-done")?.addEventListener("click", () => {
    setLearnDone(true);
    renderLearn(root, locale);
  });
  root.querySelector("#learn-reset")?.addEventListener("click", () => {
    setLearnDone(false);
    renderLearn(root, locale);
  });
}
