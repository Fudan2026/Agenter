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
      zh: "factors:ic-bake → public/data/factors-ic.json（含多周期 IC）",
      en: "factors:ic-bake → public/data/factors-ic.json (incl. multi-horizon IC)",
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
      zh: "Supro 是什么 · JTBD",
      en: "What Supro is · JTBD",
    },
    body: {
      zh: "Supro（supro.si · Super Professional · 苏坡）帮你**过滤、对比、挑选** AI / Agent，并以极度专业服务承载量化投资与**苏坡大模型**。中文名「苏坡」取自苏东坡姓名首尾字，寓意在量化与超级智能浪潮中保持乐观平和。品牌首页是 AI 目录（Logo · 名称 · 官网）与周更排名（自动爬取，不耗 LLM），并展示量化入口。\n\n核心 JTBD：场景过滤 → Harness 加权对比 → 短名单。次要 JTBD：烘焙信号练习纸盘/模拟；苏坡大模型按实际 Token 扣共用金币（100 金币=$1，低于 20 禁止调用）。\n\n默认英文；账户与硬金币与 letusIELTS 共用同一 Supabase 项目。",
      en: "Supro (supro.si · Super Professional · SuPo) helps you **filter, compare, and pick** AI / Agent products and hosts a serious quant desk plus **SuPo Model**. The Chinese name 苏坡 takes the first and last characters of Su Dongpo — a calm, optimistic stance toward quant and Super Intelligence. Home is an AI directory (logo · name · site) with weekly ranks (crawl-only, no LLM) plus Quant entry.\n\nPrimary JTBD: scenario filter → Harness-weighted compare → shortlist. Secondary: paper/sim on baked signals; SuPo Model debits shared gold after actual tokens (100 gold=$1; floor 20).\n\nEnglish default. Auth and hard gold share the Letus Supabase project.",
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
      zh: "品牌首页：主标题是 Supro（Super Professional）。主区是 AI 目录与周排名；量化投资条带在首页可见，不只藏在工具箱。",
      en: "Brand home: H1 is Supro (Super Professional). Primary block is the AI directory + weekly ranks; Quant investing is visible on Home — not Tools-only.",
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
      { href: "#/quant?panel=signals", label: { zh: "打开量化", en: "Open Quant" } },
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
      { href: "#/paper?panel=ticket", label: { zh: "打开纸盘", en: "Open Paper" } },
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
      { href: "#/quant?panel=signals", label: { zh: "量化", en: "Quant" } },
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
      { href: "#/quant?panel=lab", label: { zh: "量化 / Lab", en: "Quant / Lab" } },
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
  {
    id: "academy-retail-path",
    title: {
      zh: "研学学院 · 零售→量化路径",
      en: "Academy · Retail → quant path",
    },
    body: {
      zh: "本课把「随便看看盘」变成可复盘的量化习惯。目标不是一夜变成对冲基金，而是建立三条可检查的链路：选工具（Agent）→ 读信号（Quant）→ 练习成交与导出（Paper）。\n\n**第一步：用对比页选工具，而不是选神话。** 打开 `#/compare`，先按场景过滤（编码 / 国内可达 / 隐私 / **量化 / AI 金融**）。量化预设会抬高研究编排、因子工具、记忆反思、风控与回测严谨度；缺失维度不参与加权，因此编码型 Agent 与量化型 Agent 可以同屏比较而不被「空分」拖垮。分数是编辑启发式，不是实盘夏普。\n\n**第二步：在量化页只读「已发生」的证据。** 信号看板、形态、因子看板与公告分桶都来自 bake JSON。你要养成提问：这条信号的 bar 日期是哪天？形态识别有没有偷看未来 K？公告事件桶是关键词规则还是 LLM？答案应分别是：历史 bar、无未来函数、关键词规则。\n\n**第三步：纸盘强制「信号日 t → 成交 t+1 开盘」。** 起点壹亿、手数 100、往返约 3 bps。导出券商清单时措辞必须是【次日开盘】——本站永不代下单。若你把当日收盘当成交价，你就在练习未来函数，而不是练习可执行流程。\n\n**练习作业：** 完成 Learn 场景 12–15；在对比页应用量化预设并复制短名单链接；在量化页打开一只标的核对公告事件桶；在纸盘下一笔买入再导出 CSV。把三份产物（链接 / 截图思路 / CSV）当作个人研学档案。",
      en: "This lesson turns casual chart browsing into a repeatable quant habit. The goal is not overnight hedge-fund status — it is three auditable loops: pick tools (Agent) → read signals (Quant) → practice fills and export (Paper).\n\n**Step 1: Choose tools on Compare, not myths.** Open `#/compare`, filter by scenario (coding / CN access / privacy / **Quant / AI-finance**). The Quant preset raises research orchestration, factor tooling, memory/reflection, risk controls, and backtest rigor; missing dims are skipped so coding and quant agents can share a matrix without empty-score penalties. Scores are editorial heuristics — not live Sharpe.\n\n**Step 2: On Quant, only trust evidence that already happened.** Signal board, patterns, Factor Board, and filing buckets come from bake JSON. Ask: which bar date is this signal? Did pattern detection peek ahead? Are event buckets keyword rules or LLM? Answers should be: historical bars, no lookahead, keyword rules.\n\n**Step 3: Paper enforces signal bar t → fill at t+1 open.** Start ¥100M; lots of 100; ~3 bps RT. Checklist export must say NEXT OPEN — this site never submits. Using the same-bar close as a fill practices lookahead, not an executable workflow.\n\n**Homework:** Finish Learn scenarios 12–15; apply the Quant preset and copy a shortlist link; open one Asset and check filing buckets; place one Paper buy and export CSV. Keep the trio (link / notes / CSV) as your personal academy packet.",
    },
    deepLinks: [
      { href: "#/compare?preset=quant", label: { zh: "对比 · 量化预设", en: "Compare · Quant preset" } },
      { href: "#/quant?panel=signals", label: { zh: "量化复盘", en: "Quant review" } },
      { href: "#/paper", label: { zh: "纸盘", en: "Paper" } },
      { href: "#/learn", label: { zh: "入门场景 12", en: "Learn scenario 12" } },
    ],
    skills: ["candlestick", "execution-model", "announcement-search"],
  },
  {
    id: "academy-no-lookahead",
    title: {
      zh: "研学学院 · 无未来函数",
      en: "Academy · No-lookahead discipline",
    },
    body: {
      zh: "「无未来函数」是零售量化最容易口头承认、最容易在实现里违反的一条。定义很短：**在决策时刻 t，算法只能使用 ≤ t 的信息；成交与评估若假设用到了 t 之后的价格，就必须显式标注或改成可执行规则。**\n\n**形态与指标。** Agenter 的 K 线形态与均线只扫描历史 candles；命中日是形态完成的那天，不是「事后知道涨了才贴标签」。若你在研究笔记里用未来 5 日收益去「挑选」形态定义，那是样本内数据挖掘，不是策略。\n\n**成交假设。** 纸盘与 Lab 默认：信号日 t 的目标仓位，在有下一根 K 时按 **t+1 开盘**成交；否则标注收盘回退。这不是「更准」，而是更接近人工在券商按次日开盘核对清单的操作。关掉成本模型或改用同 bar 收盘，只适合做对照实验，不可当作实操建议。\n\n**回测诚实度。** 惩罚后夏普、幸存者宇宙横幅、样本内/外切分，都在提醒：你看到的曲线已经过选择。无未来函数解决的是信息泄漏；它不自动解决过拟合、成本忽略与发表后衰减。\n\n**自检清单：** (1) 信号特征是否只用 ≤ t？ (2) 成交价是否来自 t 之后且规则固定？ (3) 标签/收益是否泄漏进特征？ (4) 导出清单是否仍写【次日开盘】？四条都过，才算本课合格。",
      en: "No-lookahead is the rule retail quants agree with in speech and break in code. Short definition: **at decision time t, the algorithm may use only information ≤ t; if fills or evaluation assume prices after t, that must be labeled explicitly or rewritten as an executable rule.**\n\n**Patterns and indicators.** Agenter candlestick patterns and MAs scan historical candles only; the hit date is when the pattern completes — not a post-hoc label after a rally. Using future 5-day returns to cherry-pick pattern definitions is in-sample mining, not a strategy.\n\n**Fill assumptions.** Paper and Lab default: target position from signal bar t fills at **t+1 open** when a next bar exists; otherwise a labeled close fallback. That is not “more accurate” — it mirrors a human checklist at NEXT OPEN. Turning costs off or filling on the same-bar close is a controlled contrast, not actionable practice.\n\n**Backtest honesty.** Haircut Sharpe, survivor-universe banners, and IS/OOS splits remind you the curve is already selected. No-lookahead fixes information leakage; it does not fix overfitting, ignored costs, or post-publication decay.\n\n**Checklist:** (1) Features only ≤ t? (2) Fill price after t with a fixed rule? (3) Labels/returns leaking into features? (4) Checklist still says NEXT OPEN? Pass all four to clear this lesson.",
    },
    deepLinks: [
      { href: "#/quant?panel=lab", label: { zh: "量化 · 形态/Lab", en: "Quant · patterns/Lab" } },
      { href: "#/paper", label: { zh: "纸盘成交规则", en: "Paper fill rules" } },
      { href: "#/learn", label: { zh: "入门场景 13", en: "Learn scenario 13" } },
    ],
    skills: ["candlestick", "execution-model", "quant-statistics"],
  },
  {
    id: "academy-factors-ic",
    title: {
      zh: "研学学院 · 因子与 IC",
      en: "Academy · Factors & IC",
    },
    body: {
      zh: "因子课要把三件事分开：**经济故事、可计算代理、样本外诚实。** Agenter 站点上的动量 / 低波 / ADV / 质量分数是 OHLC 代理，不是实时 PE/PB 或经典账面市值比；HML-proxy 标注为 12−1 反转代理，避免把演示分数误读成学术复刻。\n\n**IC / IR 面板。** 横截面 IC 均值与 IR 告诉你：在这段烘焙历史上，代理因子与前瞻收益的相关性有多稳。分位收益展示分层，不是实盘组合。IC 高也不等于「下周能赚」——宇宙固定、幸存者偏差、成本未全计时，数字只是教育 distill。\n\n**McLean 式警示。** 学术上常见「发表后可预测性衰减」：一旦因子被广泛知晓，拥挤交易会压薄 α。本站用惩罚后夏普、样本外切分与披露文案提醒你：先问衰减与成本，再问能不能上杠杆。\n\n**与 Compare / Paper 的衔接。** 对比页的「因子 / Alpha 工具」维度评价的是 Agent 是否擅长因子研究编排，不是站点因子分数本身。纸盘批量下单只是把 TopN 练习成可导出清单，不构成投顾。\n\n**练习：** 打开因子看板与 IC 面板，写下一句「该分数是什么代理、缺什么真实基本面」；再在 Lab 对比固定 bps 与 √冲击下的成本差异。",
      en: "Separate three ideas: **economic story, computable proxy, out-of-sample honesty.** Site momentum / low-vol / ADV / quality scores are OHLC proxies — not live PE/PB or classic book-to-market; HML-proxy is labeled as a 12−1 reversal proxy so demo scores are not mistaken for academic replicas.\n\n**IC / IR panel.** Cross-section IC mean and IR ask how stable the proxy–forward-return link was on this bake. Quantile returns show layers, not a live book. High IC ≠ “profits next week” — fixed universe, survivorship, and incomplete costs make the numbers an educational distill.\n\n**McLean-style caution.** Predictability often decays after publication as crowded trades thin alpha. Haircut Sharpe, OOS splits, and disclosure copy push you to ask about decay and costs before leverage.\n\n**Link to Compare / Paper.** Compare’s factor/alpha tooling dimension rates whether an agent orchestrates factor research — not the site factor scores themselves. Paper batch sizing only practices TopN → checklist export; it is not advice.\n\n**Drill:** Open Factor Board + IC; write one sentence on what the score proxies and which live fundamentals are missing; in Lab compare fixed bps vs √-impact costs.",
    },
    deepLinks: [
      { href: "#/quant?panel=ic", label: { zh: "因子看板 / IC", en: "Factor Board / IC" } },
      { href: "#/compare?preset=quant", label: { zh: "对比 · 因子维度", en: "Compare · factor dims" } },
      { href: "#/paper", label: { zh: "纸盘批量练习", en: "Paper batch practice" } },
      { href: "#/learn", label: { zh: "入门场景 14", en: "Learn scenario 14" } },
    ],
    skills: [
      "multi-factor",
      "factor-research",
      "fundamental-filter",
      "quant-factor-select",
      "quant-statistics",
    ],
  },
  {
    id: "academy-committee",
    title: {
      zh: "研学学院 · 委员会识字",
      en: "Academy · Committee literacy",
    },
    body: {
      zh: "「多智能体委员会」是研学营 AI 篇常见叙事：基本面、情绪、技术、新闻/公告、风控、组合等角色辩论后给出共识。Agenter 已在量化页落地 **Committee Desk**：六角色 bake-only 投票，无浏览器 LLM 调用。\n\n**它解决什么。** 把单一模型的一次性答案，拆成可检查的证据桶（财报/回购/增减持公告、形态偏向、因子暴露、风险闸、问财资讯命中）。TradingAgents、FinRobot、FinMem 等开源栈强调角色、记忆与工具调用——对比页量化目录用编辑分刻画这些能力。\n\n**它不解决什么。** 浏览器里没有实时 LLM 券商下单；bake 投票不是真实投委会纪要。没有无未来函数与成本模型，再多角色也只是故事。FinCast / TSFM / AlphaFormer 等论文能力在本站是**前沿识字**，不是权重推理。\n\n**练习：** 打开 `#/quant` Committee Desk，读 Top8 角色分与共识；仅把偏多共识 Promote → 纸盘清单或 JSON。合格标准：能解释「共识 ≠ 成交许可」。",
      en: "“Multi-agent committee” is a common camp AI-track story: fundamentals, sentiment, technicals, news/filings, risk, and portfolio roles debate toward consensus. Agenter now ships **Committee Desk** on Quant: six-role bake-only votes, no browser LLM calls.\n\n**What they solve.** They split one-shot answers into checkable evidence buckets (filings, pattern bias, factor exposure, risk gates, Iwencai news hits). Stacks like TradingAgents / FinRobot / FinMem stress roles, memory, and tools — Compare scores those editorially.\n\n**What they do not solve.** No live LLM broker orders; bake votes are not real IC minutes. Without no-lookahead and costs, more roles are still a story. FinCast / TSFM / AlphaFormer remain **frontier literacy** — not in-browser weight inference.\n\n**Drill:** Open `#/quant` Committee Desk; read Top8 role scores + consensus; Promote only bullish consensus → Paper checklist/JSON. Pass when you can say: consensus ≠ permission to trade.",
    },
    deepLinks: [
      { href: "#/compare?preset=quant", label: { zh: "对比量化 Agent", en: "Compare quant agents" } },
      { href: "#/quant?panel=committee", label: { zh: "委员会桌", en: "Committee Desk" } },
      { href: "#/handbook", label: { zh: "手册目录", en: "Handbook TOC" } },
      { href: "#/learn", label: { zh: "入门场景 15", en: "Learn scenario 15" } },
    ],
    skills: ["announcement-search", "news-search", "multi-factor", "sim-trading"],
  },
  {
    id: "academy-paper-pro",
    title: {
      zh: "研学学院 · 纸盘专业台（预告）",
      en: "Academy · Paper Pro desk (preview)",
    },
    body: {
      zh: "纸盘要把「想法」变成可审计的操作记录。当前站点已有：壹亿起点、次日开盘成交、日记、持仓、CSV/JSON 券商清单、可选硬闸。**Paper Pro（Step Three）** 会补齐驾驶舱 KPI、流水过滤、按标的/来源归因、TWAP/VWAP 切片入账，以及研究审计卡（成本开关、幸存者横幅、惩罚后夏普、无未来函数成交规则）。\n\n**现在就能练的纪律。** (1) 信号日与成交日必须分开；(2) 导出清单措辞永远是【次日开盘】；(3) 批量买入按权益百分比 sizing，不是「全仓梭哈」；(4) 把 Lab 门禁打红的结果当对照实验，不要 Promote 成「可交易」。\n\n**与委员会 / 因子工作室衔接。** Factor Studio TopN 与 Committee 偏多共识可以喂进纸盘批量路径，但两者都只是**练习输入**，不是投顾。审计卡问的是：你是否诚实记录了假设，而不是曲线漂不漂亮。\n\n**作业：** 从量化清单或委员会 Promote 下一笔纸盘买入；导出 JSON；用自己的话写出三条审计勾选项（成本 / 无未来函数 / 幸存者宇宙）。Step Three 上线后，核对这些勾选项是否出现在驾驶舱。",
      en: "Paper turns ideas into an auditable ops log. Today the site already has: ¥100M start, next-open fills, journal, positions, CSV/JSON broker checklists, optional hard gates. **Paper Pro (Step Three)** adds cockpit KPIs, blotter filters, P&L attribution by symbol/source, TWAP/VWAP slice fills into the journal, and a Research Audit card (costs on, survivor banner, haircut Sharpe, no-lookahead fill rule).\n\n**Discipline you can practice now.** (1) Keep signal date and fill date separate; (2) checklist wording is always NEXT OPEN; (3) batch buys size by equity percent — not all-in; (4) treat Lab gate-red results as contrasts, not actionable Promotes.\n\n**Links to Committee / Factor Studio.** Studio TopN and bullish committee consensus can feed Paper batch paths — both are **practice inputs**, not advice. The audit card asks whether you recorded assumptions honestly, not whether the equity curve looks pretty.\n\n**Homework:** Paper one buy from Quant checklist or Committee Promote; export JSON; write three audit toggles in your own words (costs / no-lookahead / survivor universe). When Step Three lands, check those toggles appear in the cockpit.",
    },
    deepLinks: [
      { href: "#/paper?panel=export", label: { zh: "纸盘", en: "Paper" } },
      { href: "#/quant?panel=committee", label: { zh: "量化 · 清单/委员会", en: "Quant · checklist/committee" } },
      { href: "#/learn", label: { zh: "入门场景 16", en: "Learn scenario 16" } },
    ],
    skills: ["execution-model", "sim-trading", "strategy-generate"],
  },
  {
    id: "academy-quant-agents",
    title: {
      zh: "研学学院 · 量化 Agent 深读",
      en: "Academy · Quant agents deep-dive",
    },
    body: {
      zh: "对比页的「量化」类别与「量化 / AI 金融」预设，是研学营 AI 篇工具选型的入口。编辑维度包括：研究编排、因子/Alpha 工具、记忆与反思、风控、回测严谨度，以及共享的国内可达、成本、学习曲线。**缺失维度不参与加权**，因此编码型与量化型 Agent 可同屏。\n\n**怎么读一条目录。** TradingAgents / FinRobot 强调多角色协作；FinGPT / FinMem 强调金融语料与记忆；QFinZero / R&D-Agent-Quant 偏研究—回测闭环；Fin-R1 / LightAgent / Fin Manus 以苏财生态参考标签出现在备注——没有公开可复现分数时不做假打分。\n\n**与站点表面的分工。** Compare 回答「选哪个 Agent 帮你研究」；Quant 回答「在固定 bake 宇宙上，信号/因子/委员会长什么样」；Paper 回答「如何练习可导出成交」。三者不可互相替代。\n\n**作业：** 应用量化预设，并排至少三个 Agent，写下「我会用谁做因子研究、谁做回测审计」各一句；把短名单链接存进研学档案。",
      en: "Compare’s Quant category and Quant / AI-finance preset are the camp AI-track tool-selection entry. Editorial dims include research orchestration, factor/alpha tooling, memory/reflection, risk controls, backtest rigor, plus shared CN access, cost, and learning curve. **Missing dims are skipped**, so coding and quant agents can share one matrix.\n\n**How to read a catalog row.** TradingAgents / FinRobot stress multi-role collab; FinGPT / FinMem stress finance corpora and memory; QFinZero / R&D-Agent-Quant lean research→backtest loops; Fin-R1 / LightAgent / Fin Manus appear as SUFE-ecosystem reference tags — no fake scores without public evidence.\n\n**Division of labor.** Compare answers “which agent helps you research”; Quant answers “what signals/factors/committee look like on a fixed bake universe”; Paper answers “how to practice exportable fills.” None replaces the others.\n\n**Homework:** Apply the Quant preset; side-by-side ≥3 agents; write one sentence each on who you’d use for factor research vs backtest audit; save the shortlist link.",
    },
    deepLinks: [
      { href: "#/compare?preset=quant", label: { zh: "对比 · 量化预设", en: "Compare · Quant preset" } },
      { href: "#/handbook", label: { zh: "委员会识字", en: "Committee literacy" } },
      { href: "#/learn", label: { zh: "入门场景 15", en: "Learn scenario 15" } },
    ],
    skills: ["multi-factor", "factor-research", "strategy-generate"],
  },
  {
    id: "academy-fincast-frontier",
    title: {
      zh: "研学学院 · FinCast / TSFM 前沿识字",
      en: "Academy · FinCast / TSFM frontier literacy",
    },
    body: {
      zh: "研学营与论文（Das 2024 TSFM、Zhu 2025 FinCast、Faw 2025 上下文微调等）讨论的是**时间序列基础模型与金融迁移学习**：用大规模序列预训练，再适配下游预测/分类。这与「在浏览器里跑完整 FinCast 权重」是两件完全不同的事。\n\n**本站边界。** Agenter 是静态 SPA + bake JSON。因子、IC、形态、委员会投票全部是 OHLC / 文本关键词 distill。我们**不**在客户端加载 TSFM 权重，也不假装站点夏普来自基础模型推理。Compare 目录可用标签标注「前沿 / 研究向」Agent 或论文栈，但分数仍是编辑启发式。\n\n**你该带走的三句话。** (1) 迁移学习降低冷启动成本，不自动消除过拟合与成本；(2) 上下文微调改变的是提示—样本协议，不是无未来函数物理定律；(3) 若论文曲线漂亮，先问样本外切分、交易成本与发表后衰减，再问能不能上杠杆。\n\n**作业：** 读完本课，打开因子工作室与 Lab，指出一处「代理分数」与一处「真实基础模型会需要、但本站没有」的数据（例如 tick LOB、完整财报时间序列）。",
      en: "Camp themes and papers (Das 2024 TSFM, Zhu 2025 FinCast, Faw 2025 in-context FT, …) discuss **time-series foundation models and finance transfer learning**: pretrain on large sequences, then adapt to downstream forecast/classification. That is not the same as “run full FinCast weights in the browser.”\n\n**Site boundary.** Agenter is a static SPA + bake JSON. Factors, IC, patterns, and committee votes are OHLC / keyword distill. We **do not** load TSFM weights client-side, and we do not pretend site Sharpe comes from foundation-model inference. Compare may tag frontier/research stacks, but scores stay editorial heuristics.\n\n**Three takeaways.** (1) Transfer learning cuts cold-start cost — it does not erase overfitting or trading costs; (2) in-context FT changes the prompt–example protocol, not the physics of no-lookahead; (3) when a paper curve looks great, ask OOS splits, costs, and post-publication decay before leverage.\n\n**Homework:** After this lesson, open Factor Studio and Lab; point to one proxy score and one data need a real foundation model would require that this site lacks (e.g. tick LOB, full filing time series).",
    },
    deepLinks: [
      { href: "#/quant?panel=studio", label: { zh: "因子工作室 / Lab", en: "Factor Studio / Lab" } },
      { href: "#/compare", label: { zh: "对比前沿标签", en: "Compare frontier tags" } },
      { href: "#/learn", label: { zh: "入门场景 17", en: "Learn scenario 17" } },
    ],
    skills: ["ml-strategy", "quant-statistics", "factor-research"],
  },
  {
    id: "academy-mclean-decay",
    title: {
      zh: "研学学院 · McLean 发表后衰减",
      en: "Academy · McLean post-publication decay",
    },
    body: {
      zh: "McLean & Pontiff (2016) 等文献的核心警示：**学术上显著的可预测性，在发表与广泛传播后往往会衰减**——拥挤交易、数据挖掘与制度变化都会压薄 α。研学营基础篇讲「因子」，进阶与 AI 篇讲「可解释 Alpha」时，都应默认带上这条警示。\n\n**在 Agenter 上怎么用。** IC 面板高 ≠ 下周能赚；惩罚后夏普与样本外切分是最小诚实装置；Alpha 配方卡把「动量 12−1 / 低波 / 质量代理」写成经济故事 + 衰减提醒，而不是「保证超额」。Kou 2025 / AlphaFormer 讨论的可解释策略发现，在本站是**识字**——表达式好看也不免除衰减与成本。\n\n**错误用法。** 看到 TopN 综合分就全仓；把委员会共识当成交许可；关掉成本模型只展示漂亮曲线。正确用法：先写清假设与衰减风险，再决定是否把清单导出到人工券商核对。\n\n**作业：** 选一张 Alpha 配方卡，用两句话写出「经济故事」与「若因子已众所周知会发生什么」；对照 Lab 的 haircut Sharpe。",
      en: "McLean & Pontiff (2016) and related work warn that **academic predictability often decays after publication and wide awareness** — crowded trades, data mining, and regime shifts thin alpha. Camp basics on “factors” and advanced/AI tracks on “interpretable alpha” should carry this caution by default.\n\n**How to use it on Agenter.** High IC ≠ next-week profits; haircut Sharpe and OOS splits are the minimum honesty kit; Alpha recipe cards write momentum 12−1 / low-vol / quality-proxy as economic story + decay caution — not guaranteed excess return. Kou 2025 / AlphaFormer-style interpretable discovery is **literacy** here — pretty expressions still face decay and costs.\n\n**Misuse.** All-in on TopN composites; treating committee consensus as trade permission; turning costs off to beautify curves. Correct use: write assumptions and decay risk first, then decide whether to export a human broker checklist.\n\n**Homework:** Pick one Alpha recipe card; write two sentences — economic story vs what happens if the factor is common knowledge; compare to Lab haircut Sharpe.",
    },
    deepLinks: [
      { href: "#/quant?panel=ic", label: { zh: "Alpha 配方 / IC", en: "Alpha recipes / IC" } },
      { href: "#/quant?panel=lab", label: { zh: "策略 Lab", en: "Strategy Lab" } },
      { href: "#/learn", label: { zh: "入门场景 17", en: "Learn scenario 17" } },
    ],
    skills: ["multi-factor", "factor-research", "quant-statistics"],
  },
  {
    id: "academy-limits-l1l4",
    title: {
      zh: "研学学院 · 边界与 L1–L4",
      en: "Academy · Limits & L1–L4 maturity",
    },
    body: {
      zh: "苏财 / Fin Manus 全景常用 **L1→L4** 描述 Agent 成熟度：从响应式工具与洞察看板，到编排型研究助手，再到更高自治。**本站产品定位 ≈ L1–L2**（静态工具 + 本地纸盘/模拟 distill）；Agent CLI / Skills 是通往 L3 的路径；浏览器内全自动实盘（L4）**明确不在范围**。\n\n**硬边界清单。** 不下真单；不嵌券商/同花顺交易 SDK；不向客户端下发 IWENCAI_API_KEY；不跑 FinCast/AlphaFormer 权重；不做 tick LOB / 期货价差实盘。Skills 目录只增不减。\n\n**为什么要写清楚。** 研学营容易把「多智能体协作」误读成「站点会替你下单」。把 L 级写进手册，是为了保护学习者：你可以练流程与审计，但责任仍在人工券商端。\n\n**作业：** 用自己的话各写一句 L1、L2、L3、L4；圈出本站属于哪两级，并指出一个你想用 CLI Skill 补的 L3 能力。",
      en: "SUFE / Fin Manus panoramas often use **L1→L4** for agent maturity: from responsive tools and insight boards, through orchestrated research assistants, toward higher autonomy. **This site ≈ L1–L2** (static tools + local Paper/Sim distill); Agent CLI / Skills are the path toward L3; fully autonomous live trading in the browser (**L4**) is **explicitly out of scope**.\n\n**Hard limits.** No live orders; no broker/THS trade SDKs in-page; IWENCAI_API_KEY never ships to the client; no FinCast/AlphaFormer weights; no tick LOB / futures arb live books. Skills are add-only.\n\n**Why state it.** Camp narratives about multi-agent collab are easy to misread as “the site will submit for you.” Writing L-levels into the Handbook protects learners: you practice process and audit; responsibility stays at the human broker.\n\n**Homework:** Define L1–L4 in one sentence each; circle which two levels this site occupies; name one L3 capability you’d add via a CLI Skill.",
    },
    deepLinks: [
      { href: "#/tools", label: { zh: "工具箱", en: "Tools" } },
      { href: "#/handbook", label: { zh: "边界与披露", en: "Limits & disclosures" } },
      { href: "#/learn", label: { zh: "入门场景 18", en: "Learn scenario 18" } },
    ],
    skills: ["sim-trading", "execution-model", "announcement-search"],
  },
  {
    id: "ecosystem-fin-desk",
    title: {
      zh: "Ecosystem · Fin Desk AIaaS 与金币",
      en: "Ecosystem · Fin Desk AIaaS & gold",
    },
    body: {
      zh: "对标匡时产教全景：**基础设施** = bake + `fin-corpus`；**中台** = Cloudflare Functions 上的**苏坡大模型**；**产品**不训练 Fin-R1 权重，而是 DeepSeek AIaaS + RAG。\n\n**账户与金币。** 与 letusIELTS **共用** Auth 与硬金币（`GOLD_PER_USD=100`）。先调用模型，再按**实际 Token** 扣币；非管理员余额 &lt; 20 禁止调用。管理员 `seanfudan@163.com` 负责人额度 ≥100000。周排名 / bake **不耗** LLM。\n\n**域名。** `supro.si`（Pages 项目 `supro`）。SQL：仅在 Letus 项目执行 `supabase/supro_on_letus.sql`，禁止新建项目、禁止 `economy.sql`。\n\n**作业：** Letus 账号登录；看金币；用苏坡「多因子/端到端」各跑一轮；写一句苏坡 vs Fin-R1。",
      en: "Kuangshi map: **infra** = bake + `fin-corpus`; **mid-platform** = **SuPo Model** on Cloudflare Functions; **product** does not train Fin-R1 — DeepSeek AIaaS + RAG.\n\n**Accounts & gold.** Shared with letusIELTS (`GOLD_PER_USD=100`). Call the model first, then debit **actual tokens**; non-admins with gold &lt; 20 are blocked. Admin `seanfudan@163.com` steward grant ≥100000. Weekly ranks / bakes use **no** LLM.\n\n**Domain.** `supro.si` (Pages `supro`). SQL: apply `supabase/supro_on_letus.sql` only on the Letus project — never a new project, never `economy.sql`.\n\n**Homework:** Log in with a Letus account; check gold; run SuPo multi-factor and e2e once each; write one sentence SuPo vs Fin-R1.",
    },
    deepLinks: [
      { href: "#/fin", label: { zh: "Fin Desk", en: "Fin Desk" } },
      { href: "#/account", label: { zh: "账户 / 金币", en: "Account / gold" } },
      { href: "#/login", label: { zh: "登录", en: "Log in" } },
    ],
    skills: ["hithink-astock-selector", "factor-research", "strategy-generate"],
  },
  {
    id: "academy-markowitz-lite",
    title: {
      zh: "研学学院 · Markowitz 精简版",
      en: "Academy · Markowitz lite",
    },
    body: {
      zh: "基础篇常从 **均值—方差（Markowitz）** 与「全天候」直觉开始：收益、风险、相关，以及分散化为何不是「买很多票」那么简单。本站不做完整二次规划求解器，但用相关热力、低波因子、组合角色投票与纸盘仓位比例，帮你建立**可检查的组合思维**。\n\n**三件可落地的事。** (1) 看相关热力：高相关标的放在一起并不等于分散；(2) 低波 / 质量倾斜改变的是横截面暴露，不是无风险套利；(3) 纸盘按权益百分比下单，是在练习仓位预算，而不是在优化全局有效前沿。\n\n**与前沿课的边界。** Markowitz lite 不替代基础模型预测，也不解决发表后衰减。它回答的是：在固定宇宙里，你是否至少意识到风险与相关。\n\n**作业：** 打开相关热力与因子工作室，选两只高相关名与一只低相关名，写一句「若等权持有，风险主要来自哪里」；再在纸盘用 1% 权益练习一笔。",
      en: "Camp basics often start from **mean–variance (Markowitz)** and “all-weather” intuition: return, risk, correlation, and why diversification is not “own many tickers.” This site does not ship a full QP solver, but correlation heatmaps, low-vol factors, portfolio-role votes, and Paper position sizing build **checkable portfolio thinking**.\n\n**Three practical moves.** (1) Read the corr heatmap — high-corr names together are not diversification; (2) low-vol / quality tilts change cross-section exposure, not risk-free arb; (3) Paper sizing by equity percent practices a risk budget — it does not optimize a global efficient frontier.\n\n**Boundary vs frontier lessons.** Markowitz lite does not replace foundation-model forecasts or fix post-publication decay. It asks whether, on a fixed universe, you at least notice risk and correlation.\n\n**Homework:** Open corr heatmap + Factor Studio; pick two high-corr names and one low-corr name; write one sentence on where risk would come from if equally weighted; Paper a 1% equity practice fill.",
    },
    deepLinks: [
      { href: "#/quant?panel=studio", label: { zh: "相关热力 / 工作室", en: "Corr heatmap / Studio" } },
      { href: "#/paper", label: { zh: "纸盘仓位练习", en: "Paper sizing drill" } },
      { href: "#/learn", label: { zh: "入门场景 18", en: "Learn scenario 18" } },
    ],
    skills: ["quant-statistics", "multi-factor", "execution-model"],
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
