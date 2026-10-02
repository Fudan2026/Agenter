/** Structured bilingual Handbook modules (zh + en). Source of truth for #/handbook. */

export type HandbookLocale = "zh" | "en";

export interface HandbookSkillChip {
  id: string;
  name: string;
  skillPath: string;
}

export interface HandbookModule {
  id: string;
  title: { zh: string; en: string };
  body: { zh: string; en: string };
  deepLinks?: Array<{ href: string; label: { zh: string; en: string } }>;
  skills?: string[];
}

/** All skill package folders as chips (14). Plan table lists 13 rows — ML + 策略生成 combined as #13. */
export const HANDBOOK_SKILLS: Array<{
  id: string;
  nameZh: string;
  nameEn: string;
  site: { zh: string; en: string };
  cli: { zh: string; en: string };
  bake: { zh: string; en: string };
}> = [
  {
    id: "announcement-search",
    nameZh: "announcement-search",
    nameEn: "announcement-search",
    site: {
      zh: "动态页公告区 · 标的页 filings",
      en: "News announcements · Asset filings",
    },
    cli: {
      zh: "skills/announcement-search/scripts/announcement_search.py",
      en: "skills/announcement-search/scripts/announcement_search.py",
    },
    bake: {
      zh: "announcements:bake → public/data/announcements.json",
      en: "announcements:bake → public/data/announcements.json",
    },
  },
  {
    id: "news-search",
    nameZh: "news-search",
    nameEn: "news-search",
    site: {
      zh: "动态页问财财经资讯区",
      en: "News · Iwencai finance news section",
    },
    cli: {
      zh: "skills/news-search/scripts/news_search.py",
      en: "skills/news-search/scripts/news_search.py",
    },
    bake: {
      zh: "iwencai-news:bake → public/data/iwencai-news.json",
      en: "iwencai-news:bake → public/data/iwencai-news.json",
    },
  },
  {
    id: "hithink-zhishu-query",
    nameZh: "hithink-zhishu-query",
    nameEn: "hithink-zhishu-query",
    site: {
      zh: "量化页指数快照条",
      en: "Quant index snapshot strip",
    },
    cli: {
      zh: "skills/hithink-zhishu-query/scripts/cli.py",
      en: "skills/hithink-zhishu-query/scripts/cli.py",
    },
    bake: {
      zh: "indices:bake → public/data/indices.json",
      en: "indices:bake → public/data/indices.json",
    },
  },
  {
    id: "hithink-astock-selector",
    nameZh: "hithink-astock-selector",
    nameEn: "hithink-astock-selector",
    site: {
      zh: "量化页问财精选屏（固定编辑屏，非浏览器 NL）",
      en: "Quant Iwencai screens (fixed editorial; no browser NL)",
    },
    cli: {
      zh: "skills/hithink-astock-selector/scripts/cli.py",
      en: "skills/hithink-astock-selector/scripts/cli.py",
    },
    bake: {
      zh: "screens:bake → public/data/screens.json",
      en: "screens:bake → public/data/screens.json",
    },
  },
  {
    id: "sim-trading",
    nameZh: "模拟炒股",
    nameEn: "模拟炒股 (sim trading)",
    site: {
      zh: "#/sim 本地 distill（不调 trade.10jqka）",
      en: "#/sim local distill (no trade.10jqka in browser)",
    },
    cli: {
      zh: "skills/模拟炒股/scripts/{account_manager,open_account,stock_trading,stock_query}.py",
      en: "skills/模拟炒股/scripts/{account_manager,open_account,stock_trading,stock_query}.py",
    },
    bake: {
      zh: "无 bake；报价取 latest.json 收盘",
      en: "No bake; quotes from latest.json last close",
    },
  },
  {
    id: "candlestick",
    nameZh: "K线形态识别",
    nameEn: "K-line pattern recognition",
    site: {
      zh: "量化信号看板 · 标的页形态（15 种）",
      en: "Quant signal board · Asset patterns (15 IDs)",
    },
    cli: {
      zh: "skills/K线形态识别/candlestick/SKILL.md",
      en: "skills/K线形态识别/candlestick/SKILL.md",
    },
    bake: {
      zh: "quant:bake → latest.json patterns",
      en: "quant:bake → latest.json patterns",
    },
  },
  {
    id: "execution-model",
    nameZh: "执行模型",
    nameEn: "Execution model",
    site: {
      zh: "纸盘 / Lab 滑点：固定 bps 或 √冲击",
      en: "Paper / Lab slippage: fixed bps or √-impact",
    },
    cli: {
      zh: "skills/执行模型/execution-model/SKILL.md",
      en: "skills/执行模型/execution-model/SKILL.md",
    },
    bake: {
      zh: "无独立 bake；站点内纯 TS distill",
      en: "No separate bake; in-site TS distill",
    },
  },
  {
    id: "fundamental-filter",
    nameZh: "基本面因子筛选",
    nameEn: "Fundamental factor screen",
    site: {
      zh: "因子看板质量/价值代理列",
      en: "Factor Board quality / value proxy columns",
    },
    cli: {
      zh: "skills/基本面因子筛选/fundamental-filter/SKILL.md",
      en: "skills/基本面因子筛选/fundamental-filter/SKILL.md",
    },
    bake: {
      zh: "factors:bake OHLC 代理（非真实 PE/PB）",
      en: "factors:bake OHLC proxies (not live PE/PB)",
    },
  },
  {
    id: "multi-factor",
    nameZh: "多因子选股策略",
    nameEn: "Multi-factor stock selection",
    site: {
      zh: "因子看板综合分 / TopN",
      en: "Factor Board composite / TopN",
    },
    cli: {
      zh: "skills/多因子选股策略/multi-factor/SKILL.md",
      en: "skills/多因子选股策略/multi-factor/SKILL.md",
    },
    bake: {
      zh: "factors:bake → public/data/factors.json",
      en: "factors:bake → public/data/factors.json",
    },
  },
  {
    id: "factor-research",
    nameZh: "因子研究框架",
    nameEn: "Factor research framework",
    site: {
      zh: "因子看板归因 · IC 面板（若已 bake）",
      en: "Factor Board attribution · IC panel (when baked)",
    },
    cli: {
      zh: "skills/因子研究框架/factor-research/SKILL.md",
      en: "skills/因子研究框架/factor-research/SKILL.md",
    },
    bake: {
      zh: "factors:bake / factors-ic（规划中）",
      en: "factors:bake / factors-ic (planned)",
    },
  },
  {
    id: "quant-factor-select",
    nameZh: "量化因子选股",
    nameEn: "Quant factor stock pick",
    site: {
      zh: "因子看板风格暴露 / 倾斜预设",
      en: "Factor Board style exposures / tilt presets",
    },
    cli: {
      zh: "skills/量化因子选股/SKILL.md",
      en: "skills/量化因子选股/SKILL.md",
    },
    bake: {
      zh: "factors.json OHLC-proxy 宇宙",
      en: "factors.json OHLC-proxy universe",
    },
  },
  {
    id: "quant-statistics",
    nameZh: "量化统计方法",
    nameEn: "Quant statistics",
    site: {
      zh: "量化页 ADF 平稳性诊断条",
      en: "Quant ADF stationarity strip",
    },
    cli: {
      zh: "skills/量化统计方法/quant-statistics/SKILL.md",
      en: "skills/量化统计方法/quant-statistics/SKILL.md",
    },
    bake: {
      zh: "随 quant/factors bake 计算 ADF",
      en: "ADF computed with quant/factors bake",
    },
  },
  {
    id: "ml-strategy",
    nameZh: "机器学习策略",
    nameEn: "ML strategy",
    site: {
      zh: "Agent 配方卡 · Lab ML-lite（无浏览器 sklearn）",
      en: "Recipe cards · Lab ML-lite (no browser sklearn)",
    },
    cli: {
      zh: "skills/机器学习策略/ml-strategy/SKILL.md",
      en: "skills/机器学习策略/ml-strategy/SKILL.md",
    },
    bake: {
      zh: "recipes.json 配方卡；训练在 Agent CLI",
      en: "recipes.json cards; training via Agent CLI",
    },
  },
  {
    id: "strategy-generate",
    nameZh: "策略生成与优化",
    nameEn: "Strategy generate & tune",
    site: {
      zh: "配方卡 → Strategy Lab 回测 / 调参",
      en: "Recipe cards → Strategy Lab backtest / tune",
    },
    cli: {
      zh: "skills/策略生成与优化/strategy-generate/SKILL.md",
      en: "skills/策略生成与优化/strategy-generate/SKILL.md",
    },
    bake: {
      zh: "与机器学习策略同属计划表第 13 行",
      en: "Paired with ML strategy as plan-table row #13",
    },
  },
];

export const HANDBOOK_MODULES: HandbookModule[] = [
  {
    id: "what",
    title: {
      zh: "Agenter 是什么 · JTBD",
      en: "What Agenter is · JTBD",
    },
    body: {
      zh: "Agenter（agenter.si）帮你**过滤、对比、挑选**更合适的 AI / Agent 产品。品牌首页只讲「挑选更合适的 Agent」；量化复盘、纸盘、模拟炒股与资讯都在工具区，不抢首页。\n\n核心 JTBD：场景过滤 → Harness 加权对比 → 留下清晰短名单。次要 JTBD：用烘焙信号练习纸盘/模拟，导出人工券商清单（本站永不下真单）。\n\n站点是 Vite + TypeScript SPA；浏览器不嵌入问财 / 券商 API Key。Agent CLI 通过仓库根目录 Skills.md 与 skills/ 包调用 SkillHub。",
      en: "Agenter (agenter.si) helps you **filter, compare, and pick** better AI / Agent products. The brand home is only “for better agents”; Quant, Paper, Sim, and News live under Tools — not the brand face.\n\nPrimary JTBD: scenario filter → Harness-weighted compare → leave with a shortlist. Secondary JTBD: practice paper/sim on baked signals and export a human broker checklist (this site never places live orders).\n\nThe site is a Vite + TypeScript SPA; the browser never embeds Iwencai / broker API keys. Agents use SkillHub via repo-root Skills.md and the skills/ packages.",
    },
    deepLinks: [
      { href: "#/", label: { zh: "首页", en: "Home" } },
      { href: "#/compare", label: { zh: "开始对比", en: "Compare" } },
      { href: "#/learn", label: { zh: "入门练习", en: "Learn" } },
    ],
  },
  {
    id: "mod-home",
    title: { zh: "模块 · 首页", en: "Module · Home" },
    body: {
      zh: "品牌首页：主标题是 Agenter，副文案强调挑选 Agent。主 CTA 进对比；次 CTA 进入门。工具箱入口在次级区，避免把首页做成量化看板。",
      en: "Brand home: H1 is Agenter; copy stresses picking agents. Primary CTA → Compare; secondary → Learn. Tools sit in a secondary block so Home is never Quant-only.",
    },
    deepLinks: [{ href: "#/", label: { zh: "打开首页", en: "Open Home" } }],
  },
  {
    id: "mod-compare",
    title: { zh: "模块 · 对比", en: "Module · Compare" },
    body: {
      zh: "对比页：从 agents.json 目录勾选 2–4 个 Agent，按地区/类别/定价/工具过滤，调节 Harness 七维权重，看加权分与并排矩阵。预设：编码 IDE、国内可达、隐私/BYOK、研究。可复制分享链接与导出短名单 CSV。分数为编辑启发式 1–5，非厂商基准。",
      en: "Compare: pick 2–4 agents from agents.json, filter by region/category/pricing/tools, tune seven Harness weights, see ranked scores and a side-by-side matrix. Presets: Coding IDE, CN-reachable, Privacy/BYOK, Research. Share links and export shortlist CSV. Scores are editorial heuristics 1–5 — not vendor benchmarks.",
    },
    deepLinks: [
      { href: "#/compare", label: { zh: "打开对比", en: "Open Compare" } },
    ],
  },
  {
    id: "mod-learn",
    title: { zh: "模块 · 入门", en: "Module · Learn" },
    body: {
      zh: "入门是短练习场景清单（Harness 101、无未来函数、信号→纸盘等）。勾选进度保存在本机。深度说明在本手册；入门只负责走通路径。",
      en: "Learn is a short practice checklist (Harness 101, no-lookahead, signal→paper, …). Progress is local. Depth lives in this Handbook; Learn only walks the path.",
    },
    deepLinks: [
      { href: "#/learn", label: { zh: "打开入门", en: "Open Learn" } },
    ],
  },
  {
    id: "mod-tools",
    title: { zh: "模块 · 工具箱", en: "Module · Tools" },
    body: {
      zh: "工具箱是量化 / 纸盘 / 模拟 / 动态 / 本手册的枢纽。快速实盘 = 信号清单导出（A）+ 浏览器纸盘（C）；无券商 API。Quant、Paper、Sim、News、Asset 都是深链，不进顶栏主导航（Handbook 除外）。",
      en: "Tools is the hub for Quant / Paper / Sim / News / this Handbook. Fast practice = checklist export (A) + in-browser paper (C); no broker APIs. Quant, Paper, Sim, News, Asset are deep links — not primary nav (except Handbook).",
    },
    deepLinks: [
      { href: "#/tools", label: { zh: "打开工具箱", en: "Open Tools" } },
    ],
  },
  {
    id: "mod-quant",
    title: { zh: "模块 · 量化", en: "Module · Quant" },
    body: {
      zh: "量化复盘：烘焙 K 线、15 种形态、信号看板、每日复盘、因子看板、指数快照、问财精选屏、ADF 诊断、Agent 配方卡与 Strategy Lab。形态与信号只用历史 OHLC（无未来函数）。从信号可一键去纸盘。",
      en: "Quant review: baked OHLC, 15 patterns, signal board, daily review, Factor Board, index strip, Iwencai screens, ADF strip, recipe cards, and Strategy Lab. Patterns/signals use historical OHLC only (no lookahead). Jump from a signal into Paper.",
    },
    deepLinks: [
      { href: "#/quant", label: { zh: "打开量化", en: "Open Quant" } },
    ],
    skills: [
      "candlestick",
      "multi-factor",
      "fundamental-filter",
      "factor-research",
      "quant-factor-select",
      "quant-statistics",
      "hithink-zhishu-query",
      "hithink-astock-selector",
      "ml-strategy",
      "strategy-generate",
      "execution-model",
    ],
  },
  {
    id: "mod-paper",
    title: { zh: "模块 · 纸盘", en: "Module · Paper" },
    body: {
      zh: "纸盘：信号日 t → 默认 t+1 开盘成交；起点壹亿 CNY；手数 100；往返约 3 bps。日记在 localStorage。可导出券商核对清单（CSV/JSON），措辞强调【次日开盘】。本站永不提交订单。",
      en: "Paper: signal bar t → default fill at t+1 open; start ¥100M; lots of 100; ~3 bps RT. Journal in localStorage. Export broker checklists (CSV/JSON) with NEXT OPEN wording. This site never submits orders.",
    },
    deepLinks: [
      { href: "#/paper", label: { zh: "打开纸盘", en: "Open Paper" } },
    ],
    skills: ["execution-model"],
  },
  {
    id: "mod-sim",
    title: { zh: "模块 · 模拟炒股台", en: "Module · Sim Desk" },
    body: {
      zh: "模拟炒股台是 SkillHub「模拟炒股」的站点 distill：本地开户、限价委托、持仓与当日成交。报价取 latest.json 收盘（可改限价）；T+1。浏览器不调用 trade.10jqka.com.cn。Agent/CLI 走 skills/模拟炒股。",
      en: "Sim Desk is the site distill of SkillHub「模拟炒股」: local open-account, limit orders, positions, today’s fills. Quotes from latest.json last close (editable limit); T+1. The browser never calls trade.10jqka.com.cn. Agents/CLI use skills/模拟炒股.",
    },
    deepLinks: [
      { href: "#/sim", label: { zh: "打开模拟台", en: "Open Sim" } },
    ],
    skills: ["sim-trading"],
  },
  {
    id: "mod-news",
    title: { zh: "模块 · 动态", en: "Module · News" },
    body: {
      zh: "动态页三块：AI 资讯摘要、问财公告、问财财经资讯。均来自 bake JSON；缺 Key 时 fail-open 保留已提交数据。归因：数据来源：同花顺问财。",
      en: "News has three blocks: AI digest, Iwencai filings, Iwencai finance news. All from bake JSON; missing key fail-opens to committed data. Attribution: 数据来源：同花顺问财.",
    },
    deepLinks: [
      { href: "#/news", label: { zh: "打开动态", en: "Open News" } },
    ],
    skills: ["announcement-search", "news-search"],
  },
  {
    id: "mod-asset",
    title: { zh: "模块 · 标的页", en: "Module · Asset" },
    body: {
      zh: "标的页：单票 K 线 + 均线 + 近期形态 + 风格暴露；可挂相关公告。从量化看板点入，深链形如 #/asset/:symbol。",
      en: "Asset: single-name candles + MAs + recent patterns + style exposures; related filings when available. Open from Quant; deep link #/asset/:symbol.",
    },
    deepLinks: [
      {
        href: "#/asset/600519.SS",
        label: { zh: "示例：贵州茅台", en: "Example: 600519.SS" },
      },
    ],
    skills: ["candlestick", "announcement-search", "quant-factor-select"],
  },
  {
    id: "skills",
    title: {
      zh: "技能目录（计划表 13 行 · 包文件夹 14）",
      en: "Skill catalog (13 plan rows · 14 package folders)",
    },
    body: {
      zh: "Agenter 对齐 SkillHub：**5** 个 OpenAPI/THS 技能 + **9** 个方法论包。计划表合并「机器学习策略」与「策略生成与优化」为第 13 行，故称 **13 skills**；仓库 skills/ 下仍是 **14** 个包文件夹，下方每条均可跳转高亮。\n\n站点只消费 bake distill；Agent 读 Skills.md 后跑 CLI。问财答案须标注「数据来源：同花顺问财」；模拟炒股标注「同花顺问财提供模拟炒股服务」。",
      en: "Agenter aligns with SkillHub: **5** OpenAPI/THS skills + **9** methodology packages. The plan table merges「机器学习策略」+「策略生成与优化」as row #13 (**13 skills**); the repo still has **14** skills/ folders — each chip below can jump and highlight.\n\nThe site only consumes bake distills; agents read Skills.md then run CLIs. Iwencai answers must cite「数据来源：同花顺问财」; sim trading cites「同花顺问财提供模拟炒股服务」.",
    },
    deepLinks: [
      { href: "#/handbook", label: { zh: "本手册 · 技能", en: "This Handbook · skills" } },
    ],
    skills: HANDBOOK_SKILLS.map((s) => s.id),
  },
  {
    id: "flow-pick-quant",
    title: {
      zh: "工作流 · 选 Agent → 量化信号 → 纸盘/模拟 → 导出",
      en: "Workflow · Pick agent → Quant signal → Paper/Sim → export",
    },
    body: {
      zh: "1. 在对比页按场景预设筛出短名单，复制链接备查。\n2. 打开量化页，读信号看板与每日复盘；确认形态日只用历史 K 线。\n3. 点「去纸盘」预选标的，按次日开盘规则下一笔；或在模拟台用限价练习委托。\n4. 导出券商清单 CSV/JSON，人工在券商/同花顺按【次日开盘】核对 — 本站永不代下单。",
      en: "1. On Compare, apply a preset and shortlist; copy the share link.\n2. Open Quant; read the signal board and daily review; confirm patterns use historical bars only.\n3. Use Open paper to preselect a name under next-open rules — or practice limit orders on Sim Desk.\n4. Export checklist CSV/JSON and place orders manually at your broker/THS with NEXT OPEN wording — this site never submits.",
    },
    deepLinks: [
      { href: "#/compare", label: { zh: "对比", en: "Compare" } },
      { href: "#/quant", label: { zh: "量化", en: "Quant" } },
      { href: "#/paper", label: { zh: "纸盘", en: "Paper" } },
      { href: "#/sim", label: { zh: "模拟", en: "Sim" } },
    ],
    skills: ["candlestick", "execution-model", "sim-trading"],
  },
  {
    id: "flow-news",
    title: {
      zh: "工作流 · 动态与公告分诊",
      en: "Workflow · News + announcements triage",
    },
    body: {
      zh: "1. 打开动态页，先扫 AI 摘要，再看问财公告与财经资讯。\n2. 想想哪条会改变你的 Harness 权重（隐私、国内可达、研究…），回到对比页调预设。\n3. 需要更深查询时，让 Agent 读 Skills.md 跑 announcement-search / news-search（需 IWENCAI_API_KEY）；站点只显示已 bake 结果。",
      en: "1. Open News: skim AI digest, then Iwencai filings and finance news.\n2. Note which item would shift Harness weights (privacy, CN access, research…); return to Compare and apply a preset.\n3. For deeper queries, have an agent follow Skills.md announcement-search / news-search (needs IWENCAI_API_KEY); the site only shows baked results.",
    },
    deepLinks: [
      { href: "#/news", label: { zh: "动态", en: "News" } },
      { href: "#/compare", label: { zh: "对比", en: "Compare" } },
    ],
    skills: ["announcement-search", "news-search"],
  },
  {
    id: "flow-factor",
    title: {
      zh: "工作流 · 因子看板 → Lab → 纸盘",
      en: "Workflow · Factor Board → Lab → Paper",
    },
    body: {
      zh: "1. 在量化页打开因子看板，确认分数是 OHLC 代理（非实时基本面）。\n2. 对照 ADF 条看主要标的平稳性；点开 Top 综合分核对形态与信号。\n3. 在 Strategy Lab 选规则/配方，切换固定 bps 与 √冲击，观察成本。\n4. 把满意的回测成交发送到纸盘练习，再导出清单。",
      en: "1. Open the Factor Board; confirm scores are OHLC proxies — not live fundamentals.\n2. Check the ADF strip; open a top composite name and verify patterns/signals.\n3. In Strategy Lab, pick a rule/recipe; toggle fixed vs √-impact slippage and note costs.\n4. Send gated backtest fills to Paper, then export the checklist.",
    },
    deepLinks: [
      { href: "#/quant", label: { zh: "量化 / Lab", en: "Quant / Lab" } },
      { href: "#/paper", label: { zh: "纸盘", en: "Paper" } },
    ],
    skills: [
      "multi-factor",
      "factor-research",
      "fundamental-filter",
      "quant-factor-select",
      "quant-statistics",
      "execution-model",
      "ml-strategy",
      "strategy-generate",
    ],
  },
  {
    id: "limits",
    title: { zh: "边界与披露", en: "Limits & disclosures" },
    body: {
      zh: "教育演示，不构成投资建议。本站不下真单、不接券商/同花顺交易 API；浏览器不持有 IWENCAI_API_KEY。\n\n因子多为 OHLC 代理（动量/低波/ADV/质量），≠ 经典账面市值比或实时 PE/PB。宇宙=烘焙存活集，存在幸存者偏差。\n\n纸盘：次日开盘成交假设；软风控提示 + 可选硬闸（单票/现金）。模拟台是本地 distill，与 Agent CLI 真连 trade.10jqka 是两条路径。\n\n形态 15 种、标的烘焙集有限；数据可能滞后（stale）。问财 bake 缺密钥时 fail-open。",
      en: "Educational only — not investment advice. No live orders; no broker/THS trade APIs in the browser; IWENCAI_API_KEY never ships to the client.\n\nFactors are mostly OHLC proxies (momentum / low-vol / ADV / quality) — not classic book-to-market or live PE/PB. Universe = baked survivors (survivorship bias).\n\nPaper uses next-open fill assumptions; soft risk strip + optional hard gates. Sim Desk is a local distill; Agent CLI may talk to trade.10jqka on a separate path.\n\nFifteen patterns and a finite bake set; data can be stale. Iwencai bakes fail-open when the key is missing.",
    },
    deepLinks: [
      { href: "#/tools", label: { zh: "工具箱", en: "Tools" } },
      { href: "#/learn", label: { zh: "入门 101", en: "Learn 101" } },
    ],
  },
];

export function handbookSearchHaystack(
  mod: HandbookModule,
  locale: HandbookLocale,
): string {
  const title = mod.title[locale];
  const body = mod.body[locale];
  const linkLabels = (mod.deepLinks ?? [])
    .map((d) => d.label[locale])
    .join(" ");
  const skillNames = (mod.skills ?? [])
    .map((id) => {
      const s = HANDBOOK_SKILLS.find((x) => x.id === id);
      if (!s) return id;
      return `${s.nameZh} ${s.nameEn} ${s.site[locale]} ${s.cli[locale]} ${s.bake[locale]}`;
    })
    .join(" ");
  return `${mod.id} ${title} ${body} ${linkLabels} ${skillNames}`.toLowerCase();
}

export function handbookSkillChip(
  id: string,
  locale: HandbookLocale,
): HandbookSkillChip | null {
  const s = HANDBOOK_SKILLS.find((x) => x.id === id);
  if (!s) return null;
  return {
    id: s.id,
    name: locale === "zh" ? s.nameZh : s.nameEn,
    skillPath: s.cli[locale],
  };
}
