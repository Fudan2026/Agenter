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
    href: "#/compare?preset=coding",
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
    href: "#/compare?preset=cn",
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
    href: "#/compare?preset=privacy",
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
    href: "#/quant?panel=signals",
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
    href: "#/paper?panel=ticket",
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
      "完整链路说明见手册「选 Agent → 量化 → 纸盘」。",
    ],
    stepsEn: [
      "On Quant signal board, pick a bullish/bearish name.",
      "Click Open paper; confirm symbol preselect.",
      "Place one paper order under next-open fill rules.",
      "Full path: Handbook chapter Pick agent → Quant → Paper.",
    ],
    href: "#/quant?panel=signals",
  },
  {
    id: "news-skim",
    titleZh: "场景 8：浏览 AI 动态",
    titleEn: "Scenario 8: Skim AI news",
    stepsZh: [
      "打开动态页，阅读 2–3 条摘要。",
      "思考哪条会影响你的对比维度权重。",
      "回到对比页应用一个预设。",
      "公告/问财分诊细节见手册「动态与公告」。",
    ],
    stepsEn: [
      "Open News; read 2–3 digests items.",
      "Note which item would shift your Harness weights.",
      "Return to Compare and apply a preset.",
      "Filings triage depth: Handbook News + announcements chapter.",
    ],
    href: "#/news?section=ai",
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
    href: "#/quant?panel=lab&lab=ml_lite",
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
    href: "#/quant?panel=lab",
  },
  {
    id: "factor-board",
    titleZh: "场景 11：因子看板 TopN",
    titleEn: "Scenario 11: Factor Board TopN",
    stepsZh: [
      "在量化页打开因子看板，确认分数是 OHLC 代理。",
      "对比 ADF 诊断条中主要标的的平稳性。",
      "点开 Top 综合分标的，核对形态与信号。",
      "需要完整因子 → Lab → 纸盘说明时，打开手册对应章节。",
    ],
    stepsEn: [
      "Open the Factor Board; confirm OHLC-proxy attribution.",
      "Check the ADF strip for major symbols.",
      "Open a top composite name; verify patterns and signals.",
      "For Factor Board → Lab → Paper depth, open the Handbook chapter.",
    ],
    href: "#/quant?panel=studio",
  },
  {
    id: "academy-retail",
    titleZh: "场景 12：零售→量化研学路径",
    titleEn: "Scenario 12: Retail → quant Academy path",
    stepsZh: [
      "打开手册，找到「研学学院 · 零售→量化路径」（academy-retail-path）。",
      "读完信号日、纸盘与导出清单三段，记下与券商核对的边界。",
      "回到入门页勾选本场景；需要练习时再开纸盘。",
    ],
    stepsEn: [
      "Open Handbook; find Academy · Retail→quant path (academy-retail-path).",
      "Read signal-day, paper, and checklist export sections; note broker boundaries.",
      "Mark this scenario done on Learn; open Paper when ready to practice.",
    ],
    href: "#/handbook",
  },
  {
    id: "academy-lookahead",
    titleZh: "场景 13：无未来函数研学",
    titleEn: "Scenario 13: No-lookahead Academy",
    stepsZh: [
      "打开手册「研学学院 · 无未来函数」（academy-no-lookahead）。",
      "对照量化页：形态与均线是否只用历史 K 线。",
      "在纸盘确认成交默认 t+1 开盘；不要用当日收盘当信号日成交价。",
    ],
    stepsEn: [
      "Open Handbook Academy · No-lookahead (academy-no-lookahead).",
      "On Quant, confirm patterns/MAs use historical bars only.",
      "On Paper, confirm fills default to t+1 open — never treat same-bar close as the fill.",
    ],
    href: "#/handbook",
  },
  {
    id: "academy-factors",
    titleZh: "场景 14：因子 IC 研学",
    titleEn: "Scenario 14: Factor IC Academy",
    stepsZh: [
      "阅读手册「研学学院 · 因子与 IC」（academy-factors-ic）。",
      "打开量化页因子看板与 IC 面板，确认分数是 OHLC 代理。",
      "记下 McLean 式「发表后衰减」警示，再回 Lab 看惩罚后夏普。",
    ],
    stepsEn: [
      "Read Handbook Academy · Factors & IC (academy-factors-ic).",
      "Open Quant Factor Board + IC panel; confirm OHLC-proxy attribution.",
      "Note the McLean-style post-publication decay caution; check haircut Sharpe in Lab.",
    ],
    href: "#/quant?panel=ic",
  },
  {
    id: "academy-committee-compare",
    titleZh: "场景 15：委员会识字 + 量化 Agent 对比",
    titleEn: "Scenario 15: Committee literacy + quant Compare",
    stepsZh: [
      "阅读手册「研学学院 · 委员会识字」（academy-committee）。",
      "打开对比页，点「量化 / AI 金融」预设，类别筛「量化」。",
      "勾选 2–4 个量化 Agent，看研究编排 / 回测严谨度权重变化。",
    ],
    stepsEn: [
      "Read Handbook Academy · Committee literacy (academy-committee).",
      "Open Compare; apply Quant / AI-finance preset; filter category Quant.",
      "Pick 2–4 quant agents; watch research orchestration / backtest rigor weights.",
    ],
    href: "#/compare?preset=quant",
  },
  {
    id: "academy-paper-pro",
    titleZh: "场景 16：纸盘专业台研学",
    titleEn: "Scenario 16: Paper Pro Academy",
    stepsZh: [
      "阅读手册「研学学院 · 纸盘专业台」（academy-paper-pro）。",
      "打开量化页，从清单或委员会 Promote 一笔到纸盘练习路径。",
      "在纸盘导出 JSON，核对「次日开盘」措辞与信号日/成交日分离。",
    ],
    stepsEn: [
      "Read Handbook Academy · Paper Pro (academy-paper-pro).",
      "On Quant, Promote one checklist/committee name toward Paper practice.",
      "Export Paper JSON; verify NEXT OPEN wording and signal/fill date separation.",
    ],
    href: "#/handbook",
  },
  {
    id: "academy-frontier-decay",
    titleZh: "场景 17：前沿识字 + McLean 衰减",
    titleEn: "Scenario 17: Frontier literacy + McLean decay",
    stepsZh: [
      "阅读手册 academy-fincast-frontier 与 academy-mclean-decay。",
      "打开量化页 Alpha 配方卡，记下一条衰减警示。",
      "在 Lab 看惩罚后夏普，写一句「高 IC ≠ 下周能赚」。",
    ],
    stepsEn: [
      "Read Handbook academy-fincast-frontier and academy-mclean-decay.",
      "Open Quant Alpha recipe cards; note one decay caution.",
      "In Lab, check haircut Sharpe; write “high IC ≠ next-week profits.”",
    ],
    href: "#/quant?panel=lab",
  },
  {
    id: "academy-limits-markowitz",
    titleZh: "场景 18：L1–L4 边界 + Markowitz 精简",
    titleEn: "Scenario 18: L1–L4 limits + Markowitz lite",
    stepsZh: [
      "阅读手册 academy-limits-l1l4 与 academy-markowitz-lite。",
      "用自己的话写出本站属于 L1–L2，L4 不在浏览器范围。",
      "打开相关热力，指出一对高相关标的为何不等于分散。",
    ],
    stepsEn: [
      "Read Handbook academy-limits-l1l4 and academy-markowitz-lite.",
      "State in your words: site ≈ L1–L2; L4 is out of browser scope.",
      "Open the corr heatmap; explain why one high-corr pair is not diversification.",
    ],
    href: "#/handbook",
  },
  {
    id: "sim-desk",
    titleZh: "场景 19：模拟炒股台 → 纸盘",
    titleEn: "Scenario 19: Sim Desk → Paper",
    stepsZh: [
      "从工具箱打开模拟炒股台（SkillHub distill，本地账本）。",
      "开户后下一笔限价练习单，确认持仓与资金变化。",
      "导出清单或导入纸盘，核对次日开盘规则与对账面板。",
    ],
    stepsEn: [
      "Open Sim Desk from Tools (SkillHub distill, local ledger).",
      "Open an account and place one limit practice order; confirm cash/positions.",
      "Export checklist or import into Paper; check next-open rules and reconcile panel.",
    ],
    href: "#/sim",
  },
  {
    id: "ecosystem-review",
    titleZh: "场景 20：每日复盘 + ETF 轮动 + 评分叠加",
    titleEn: "Scenario 20: Daily review + ETF rotation + ratings overlay",
    stepsZh: [
      "从工具箱量化卡片的「每日复盘日报」芯片进入 `#/quant?panel=review`。",
      "打开 Macro / Rotation 面板，对比 daily 与 fixed_5d；点一只 ETF 看指数跳转。",
      "到对比页确认 Arena/AA 实时评分叠加在编辑分旁，未改写 1–5 分。",
    ],
    stepsEn: [
      "From Tools Quant card, open the Daily review chip → `#/quant?panel=review`.",
      "Open Macro / Rotation; compare daily vs fixed_5d; jump an ETF → its index.",
      "On Compare, confirm Arena/AA live overlay sits beside editorial 1–5 scores.",
    ],
    href: "#/quant?panel=review",
  },
];

export function renderLearn(root: HTMLElement, locale: Locale): void {
  const done = isLearnDone();
  const progress = loadScenarioProgress();
  const handbookBanner =
    locale === "zh"
      ? `深手册 → <a href="#/handbook">${esc(t(locale, "navHandbook"))}</a>：模块、13 技能目录与工作流。`
      : `Deep manual → <a href="#/handbook">${esc(t(locale, "navHandbook"))}</a>: modules, 13-skill catalog, workflows.`;

  const body = `
    <h1>${esc(t(locale, "learnTitle"))}</h1>
    <p class="lead">${esc(t(locale, "learnLead"))}</p>
    <p class="learn-handbook-banner muted">${handbookBanner}</p>
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
      <a class="btn btn-ghost" href="#/handbook">${esc(t(locale, "ctaHandbook"))}</a>
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
