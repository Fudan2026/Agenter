import type { Locale } from "../i18n/strings";
import { t } from "../i18n/strings";
import {
  isLearnDone,
  loadScenarioProgress,
  setLearnDone,
  setScenarioDone,
} from "../lib/harness/weights";
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

/** ≥8 practice scenarios (keep original 5 + additives). */
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
      "点预设「国内可达」，或提高 cnAccessibility 权重。",
      "并排对比 Kimi / DeepSeek / Trae。",
      "记下短名单，不必追求海外最强模型。",
    ],
    stepsEn: [
      "Apply the CN-reachable preset, or raise cnAccessibility.",
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
      "应用「隐私 / BYOK」预设。",
      "对比 Aider / Continue / OpenClaw / Dify 与云端产品。",
      "确认定价带与 BYOK 是否匹配你的约束。",
    ],
    stepsEn: [
      "Apply Privacy / BYOK preset.",
      "Compare Aider / Continue / OpenClaw / Dify vs cloud products.",
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
      "看信号看板与每日复盘要点。",
      "点开一只标的，确认形态与均线仅用历史 K 线。",
    ],
    stepsEn: [
      "Open Quant from Tools (not Home).",
      "Read the signal board and daily review.",
      "Open one symbol; confirm patterns/MAs use historical OHLC only.",
    ],
    href: "#/quant",
  },
  {
    id: "paper-drill",
    titleZh: "场景 5：纸盘一次买卖",
    titleEn: "Scenario 5: One paper buy/sell",
    stepsZh: [
      "进入纸盘（壹亿起始），选 A 股/ETF，数量用 100 的倍数。",
      "买入后刷新，确认日记与持仓仍在。",
      "导出券商清单 CSV，核对「次日开盘」措辞。",
    ],
    stepsEn: [
      "Open Paper (¥100M start); pick A-share/ETF; qty ×100.",
      "After buy, reload — journal/positions should persist.",
      "Export checklist CSV; verify NEXT OPEN wording.",
    ],
    href: "#/paper",
  },
  {
    id: "share-compare",
    titleZh: "场景 6：分享对比链接",
    titleEn: "Scenario 6: Share a compare link",
    stepsZh: [
      "勾选 2–4 个 Agent，调节权重。",
      "点「复制对比链接」。",
      "在新标签打开，确认 picks 与权重还原。",
    ],
    stepsEn: [
      "Pick 2–4 agents and tune weights.",
      "Click Copy compare link.",
      "Open in a new tab; confirm picks and weights restore.",
    ],
    href: "#/compare",
  },
  {
    id: "signal-to-paper",
    titleZh: "场景 7：信号 → 纸盘",
    titleEn: "Scenario 7: Signal → paper",
    stepsZh: [
      "在量化页信号看板选一个偏多/偏空标的。",
      "点「去纸盘」，确认标的预选。",
      "按次日开盘规则下一笔纸盘单。",
    ],
    stepsEn: [
      "On Quant signal board, pick a bullish/bearish name.",
      "Click Open paper; confirm symbol preselect.",
      "Place one paper order under next-open fill rules.",
    ],
    href: "#/quant",
  },
  {
    id: "news-skim",
    titleZh: "场景 8：浏览 AI 动态",
    titleEn: "Scenario 8: Skim AI news",
    stepsZh: [
      "打开动态页，阅读 2–3 条摘要。",
      "思考哪条会影响你的对比维度权重。",
      "回到对比页应用一个预设。",
    ],
    stepsEn: [
      "Open News; read 2–3 digests items.",
      "Note which item would shift your Harness weights.",
      "Return to Compare and apply a preset.",
    ],
    href: "#/news",
  },
  {
    id: "ml-recipe",
    titleZh: "场景 9：机器学习策略配方",
    titleEn: "Scenario 9: ML strategy recipe",
    stepsZh: [
      "打开量化页的 Agent 配方卡，阅读「滚动训练 → Walk-forward」。",
      "在 Skills.md / skills/机器学习策略 了解 sklearn 流程（浏览器不跑训练）。",
      "回到 Strategy Lab 用规则策略对照无未来函数成交假设。",
    ],
    stepsEn: [
      "Open Quant Agent recipes; read the walk-forward ML card.",
      "Read Skills.md / skills/机器学习策略 for sklearn (no browser training).",
      "Compare against Strategy Lab rule fills (no lookahead).",
    ],
    href: "#/quant",
  },
  {
    id: "strategy-gen",
    titleZh: "场景 10：策略生成与优化",
    titleEn: "Scenario 10: Strategy generate & tune",
    stepsZh: [
      "阅读配方卡「策略生成 → 回测 → 调参」。",
      "在 Lab 切换固定 bps / 平方根冲击滑点，观察成本差异。",
      "把满意的回测成交发送到纸盘练习。",
    ],
    stepsEn: [
      "Read the generate → backtest → tune recipe card.",
      "In Lab, toggle fixed vs √-impact slippage; note cost differences.",
      "Send a gated backtest to Paper for practice.",
    ],
    href: "#/quant",
  },
  {
    id: "factor-board",
    titleZh: "场景 11：因子看板 TopN",
    titleEn: "Scenario 11: Factor Board TopN",
    stepsZh: [
      "在量化页打开因子看板，确认分数是 OHLC 代理。",
      "对比 ADF 诊断条中主要标的的平稳性。",
      "点开 Top 综合分标的，核对形态与信号。",
    ],
    stepsEn: [
      "Open the Factor Board; confirm OHLC-proxy attribution.",
      "Check the ADF strip for major symbols.",
      "Open a top composite name; verify patterns and signals.",
    ],
    href: "#/quant",
  },
];

export function renderLearn(root: HTMLElement, locale: Locale): void {
  const done = isLearnDone();
  const progress = loadScenarioProgress();
  const body = `
    <h1>${esc(t(locale, "learnTitle"))}</h1>
    <p class="lead">${esc(t(locale, "learnLead"))}</p>
    <p class="learn-status ${done ? "done" : ""}">${done ? esc(t(locale, "learnDone")) : ""}</p>
    <section class="explainers">
      <article class="scenario">
        <h2>${esc(t(locale, "learnHarness101"))}</h2>
        <p>${esc(t(locale, "learnHarnessBody"))}</p>
      </article>
      <article class="scenario">
        <h2>${esc(t(locale, "learnNoLookahead101"))}</h2>
        <p>${esc(t(locale, "learnNoLookaheadBody"))}</p>
      </article>
    </section>
    <div class="scenario-list">
      ${SCENARIOS.map((s, i) => {
        const title = locale === "zh" ? s.titleZh : s.titleEn;
        const steps = locale === "zh" ? s.stepsZh : s.stepsEn;
        const checked = !!progress[s.id];
        return `<article class="scenario" data-scenario="${esc(s.id)}">
          <h2>${esc(title)}</h2>
          <ol>${steps.map((st) => `<li>${esc(st)}</li>`).join("")}</ol>
          <div class="cta-row">
            <a class="btn" href="${s.href}">${esc(t(locale, "scenarioStart"))} ${i + 1}</a>
            <label class="tiny"><input type="checkbox" data-scenario-check="${esc(s.id)}" ${checked ? "checked" : ""}/> ${esc(t(locale, "scenarioDone"))}</label>
          </div>
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
    for (const s of SCENARIOS) setScenarioDone(s.id, false);
    renderLearn(root, locale);
  });
  root.querySelectorAll<HTMLInputElement>("[data-scenario-check]").forEach((el) => {
    el.addEventListener("change", () => {
      setScenarioDone(el.dataset.scenarioCheck!, el.checked);
    });
  });
}
