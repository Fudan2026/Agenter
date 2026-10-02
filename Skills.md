# Skills.md

Workspace skill catalog for **all coding agents** (Cursor Cloud Agent, Claude Code, Codex, Continue, Aider, etc.). When a user question matches a skill below, **read this section first**, then run the documented CLI or workflow. Do not reimplement API calls ad hoc.

## How agents should use this file

1. Match the user intent to a skill in the **index**.
2. Confirm required **environment variables** (see [Environment](#environment)).
3. Execute commands from the skill section using **absolute paths** under this repo (`agenter`).
4. Interpret API JSON in the agent layer; bundled scripts must pass through raw gateway bodies unchanged.
5. For answers sourced from Iwencai skills, state: **数据来源：同花顺问财**.

The Agenter **website** never calls Iwencai or THS trade APIs from the browser. Bake-time JSON only: `announcements.json`, `iwencai-news.json`, `indices.json`, `screens.json`. Sim Desk `#/sim` is a local distill. Agents use SkillHub CLIs interactively.

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `IWENCAI_API_KEY` | yes (for agent CLI / bake) | — | Bearer token from [i问财 SkillHub](https://www.iwencai.com/skillhub) (Agent 安装指引) |
| `IWENCAI_BASE_URL` | no | `https://openapi.iwencai.com` | OpenAPI gateway base URL |
| `AGENTER_SIM_ACCOUNTS_DIR` | no | `~/.agenter/user_accounts` | Local JSON dir for `模拟炒股` account_manager (never commit) |

Cloud Agent shells may not load `~/.bashrc`. If `IWENCAI_API_KEY` is missing in a run, ask the user to add it to the Cloud Agent environment secrets, or export it in the same shell before calling the script.

## SkillHub CLI (maintain skills)

Install CLI (once per machine):

```bash
curl -fsSL "https://www.iwencai.com/skillhub/static/0.0.4/download_and_install.sh" | bash
```

Install or refresh a skill from the store (default install root: `./skills` in the current directory):

```bash
iwencai-skillhub-cli install <slug>
# example:
iwencai-skillhub-cli install announcement-search
```

After installing a new SkillHub skill, add or update its section in **this file** and optionally link it under `.cursor/skills/<slug>` (see [Cursor discovery](#cursor-discovery)).

## Index

| Slug | Trigger (when to load) | Package path |
|------|------------------------|--------------|
| `announcement-search` | A股/港股/基金/ETF 公告；分红、回购、业绩预告、重组等 | `skills/announcement-search/` |
| `news-search` | 财经资讯 / 政策动态 / 行业与上市公司新闻检索 | `skills/news-search/` |
| `hithink-zhishu-query` | 上证指数、沪深300、创业板指等指数点位/涨跌幅/成交量 | `skills/hithink-zhishu-query/` |
| `hithink-astock-selector` | A股自然语言选股（行情、财务、形态、概念组合） | `skills/hithink-astock-selector/` |
| `模拟炒股` | A股模拟开户、买入/卖出、持仓/资金/成交/近30日收益 | `skills/模拟炒股/` |
| `基本面因子筛选` | PE/PB/ROE 等基本面筛选（方法论） | `skills/基本面因子筛选/fundamental-filter/` |
| `多因子选股策略` | 横截面多因子打分与 TopN | `skills/多因子选股策略/multi-factor/` |
| `机器学习策略` | sklearn 滚动训练 / walk-forward 信号 | `skills/机器学习策略/ml-strategy/` |
| `量化统计方法` | ADF / 协整 / GARCH / 回归诊断 | `skills/量化统计方法/quant-statistics/` |
| `因子研究框架` | IC/IR、分层回测、因子组合 | `skills/因子研究框架/factor-research/` |
| `量化因子选股` | 学术因子模型 A 股筛选 | `skills/量化因子选股/` |
| `策略生成与优化` | 策略起草、回测与调参 | `skills/策略生成与优化/strategy-generate/` |
| `K线形态识别` | 15 种经典 K 线形态 | `skills/K线形态识别/candlestick/` |
| `执行模型` | 固定 / 平方根冲击滑点与 VWAP/TWAP | `skills/执行模型/execution-model/` |

---

## announcement-search

**Description:** 支持 A股、港股、基金、ETF 等金融标的公告查询（定期报告、分红派息、回购增持、资产重组等）。

**Version:** `1.0.0` (SkillHub)

**Paths (agenter repo root):**

| Artifact | Path |
|----------|------|
| Full skill doc | `skills/announcement-search/SKILL.md` |
| API reference | `skills/announcement-search/references/api.md` |
| CLI script | `skills/announcement-search/scripts/announcement_search.py` |

**Absolute CLI (Cloud Agent):**

```bash
python3 /agent/repos/agenter/skills/announcement-search/scripts/announcement_search.py "<查询语句>" --size 10
```

### Workflow

1. Verify `IWENCAI_API_KEY` is set. If missing or auth fails, direct the user to SkillHub to obtain a key and configure env vars (do not embed secrets in repo files).
2. Turn the user request into one or more concise Chinese (or user-language) search queries—one per distinct target or announcement type.
3. Run the Python script **once per query**; stdout is the raw gateway JSON body.
4. If results are thin, run a follow-up query; combine with other tools when appropriate.
5. Answer from the parsed data; include **数据来源：同花顺问财**. Prefer newer items when the user asks for “最新/近期”.

### CLI options

- `query` (positional): natural-language announcement search.
- `--size`: result count (default `10`).
- `--base-url`: override gateway base (default env or `https://openapi.iwencai.com`).
- `--endpoint`: override path (default `/v1/comprehensive/search`).
- `--timeout`: seconds (default `30`).
- `--output`: write raw response body to a file instead of stdout.

### Examples

```bash
cd /agent/repos/agenter/skills/announcement-search
python3 scripts/announcement_search.py "贵州茅台 分红公告" --size 10
python3 scripts/announcement_search.py "上市公司业绩预告" --size 5 --output /tmp/announcement-raw.json
```

### Gateway contract (summary)

- `POST {IWENCAI_BASE_URL}/v1/comprehensive/search`
- Body: `{"query":"<q>","channels":["announcement"],"app_id":"AIME_SKILL","size":<n>}`
- Auth: `Authorization: Bearer $IWENCAI_API_KEY`
- Claw headers: `X-Claw-Skill-Id: announcement-search`, `X-Claw-Skill-Version: 1.0.0`, plus trace id per request (handled by the script).

The script must not reshape API fields; summarization happens in the agent after reading raw JSON.

---

## news-search

**Description:** 财经资讯搜索（官媒、主流财经媒体、垂直站、公司官网等）。Attribution: **数据来源：同花顺问财**.

**Version:** `1.0.0` (SkillHub)

**Paths (agenter repo root):**

| Artifact | Path |
|----------|------|
| Full skill doc | `skills/news-search/SKILL.md` |
| API reference | `skills/news-search/references/api.md` |
| CLI script | `skills/news-search/scripts/news_search.py` |

**Absolute CLI (Cloud Agent):**

```bash
python3 /agent/repos/agenter/skills/news-search/scripts/news_search.py "<查询语句>" --size 10
```

### Workflow

1. Verify `IWENCAI_API_KEY`.
2. Rewrite the user ask into concise Chinese news queries (one topic each).
3. Run the script once per query; stdout is the raw gateway JSON (`channels: ["news"]`).
4. Answer from parsed rows; end with **数据来源：同花顺问财**.

### Website distill

`npm run iwencai-news:bake` → `public/data/iwencai-news.json` → third section on `#/news` (+ Tools stub). Browser never holds the key.

### Examples

```bash
python3 /agent/repos/agenter/skills/news-search/scripts/news_search.py "人工智能 最新消息" --size 5
python3 /agent/repos/agenter/skills/news-search/scripts/news_search.py "A股政策 最新消息" --size 5
```

---

## hithink-zhishu-query

**Description:** 指数行情查询（上证、沪深300、创业板指、海外主要指数等）。Attribution: **数据来源：同花顺问财**.

**Version:** `1.0.0` (SkillHub)

**Paths (agenter repo root):**

| Artifact | Path |
|----------|------|
| Full skill doc | `skills/hithink-zhishu-query/SKILL.md` |
| CLI script | `skills/hithink-zhishu-query/scripts/cli.py` |

**Absolute CLI (Cloud Agent):**

```bash
python3 /agent/repos/agenter/skills/hithink-zhishu-query/scripts/cli.py --query "上证指数最新点位"
```

### Workflow

1. Verify `IWENCAI_API_KEY`.
2. Rewrite to a standard index query (点位 / 涨跌幅 / 成交量).
3. Call `scripts/cli.py` (`POST /v1/query2data`); inspect `datas`.
4. Answer with **数据来源：同花顺问财**.

### Website distill

`npm run indices:bake` → `public/data/indices.json` → **指数快照** strip atop `#/quant` (SSE / CSI 300 / ChiNext).

### Examples

```bash
python3 /agent/repos/agenter/skills/hithink-zhishu-query/scripts/cli.py --query "沪深300最新点位"
python3 /agent/repos/agenter/skills/hithink-zhishu-query/scripts/cli.py --query "创业板指涨跌幅"
```

---

## hithink-astock-selector

**Description:** 自然语言 A 股筛选（行情、技术形态、财务、行业概念）。Attribution: **数据来源：同花顺问财**.

**Version:** `1.0.0` (SkillHub)

**Paths (agenter repo root):**

| Artifact | Path |
|----------|------|
| Full skill doc | `skills/hithink-astock-selector/SKILL.md` |
| CLI script | `skills/hithink-astock-selector/scripts/cli.py` |

**Absolute CLI (Cloud Agent):**

```bash
python3 /agent/repos/agenter/skills/hithink-astock-selector/scripts/cli.py --query "近5日放量上涨" --limit 10
```

### Workflow

1. Verify `IWENCAI_API_KEY`.
2. Rewrite user NL into a standard screen query; split multi-intent asks.
3. Call `scripts/cli.py` (`POST /v1/query2data`); respect `code_count` + pagination.
4. Answer with **数据来源：同花顺问财**.

### Website distill

`npm run screens:bake` → `public/data/screens.json` → **问财精选屏** on `#/quant` (exactly three fixed editorial screens). Agents keep full NL CLI; browser is not interactive NL.

### Examples

```bash
python3 /agent/repos/agenter/skills/hithink-astock-selector/scripts/cli.py --query "低估值白酒"
python3 /agent/repos/agenter/skills/hithink-astock-selector/scripts/cli.py --query "半导体ETF成分强势" --limit 8
```

---

## 模拟炒股

**Description:** 同花顺模拟炒股服务 — A股开户、委托买卖、持仓/资金/成交/盈利查询。Attribution: **同花顺问财提供模拟炒股服务**.

**Paths (agenter repo root):**

| Artifact | Path |
|----------|------|
| Full skill doc | `skills/模拟炒股/SKILL.md` |
| API reference | `skills/模拟炒股/references/api-spec.md` |
| Account format | `skills/模拟炒股/references/account-data-format.md` |
| Account manager | `skills/模拟炒股/scripts/account_manager.py` |
| Open account | `skills/模拟炒股/scripts/open_account.py` |
| Trading | `skills/模拟炒股/scripts/stock_trading.py` |
| Queries | `skills/模拟炒股/scripts/stock_query.py` |
| Stock search | `skills/模拟炒股/scripts/stock_search.py` |

**Account storage (patched for Agenter):** default `~/.agenter/user_accounts/default.json`. Override with `AGENTER_SIM_ACCOUNTS_DIR`. Never store account JSON in the skill package or git.

**Absolute CLI (Cloud Agent):**

```bash
# check / generate username
python3 /agent/repos/agenter/skills/模拟炒股/scripts/account_manager.py --action check
python3 /agent/repos/agenter/skills/模拟炒股/scripts/account_manager.py --action generate

# open fund account (needs network to trade.10jqka.com.cn:8088)
python3 /agent/repos/agenter/skills/模拟炒股/scripts/open_account.py --action create --username skill_<ms>

# place order (qty multiples of 100; market 1=SZ 2=SH; B=buy S=sell)
python3 /agent/repos/agenter/skills/模拟炒股/scripts/stock_trading.py \
  --usrid <资金账号> --stock-code 600519 --shareholder-account <股东账号> \
  --market-code 2 --price 1800 --quantity 100 --direction B
```

### Workflow

1. `account_manager.py --action check`. If missing, generate `skill_<ms>`, `open_account.py --action create`, query shareholders, `save_account` via manager.
2. Map user intent → buy/sell/positions/fund/today trades/history/30d gain.
3. Resolve names via `stock_search.py` when needed.
4. Call the matching script; end every user-facing answer with **同花顺问财提供模拟炒股服务**.

### Website distill

The SPA route `#/sim` (Tools → 模拟炒股台) mirrors open-account / order / positions / funds UX on a **local** ledger (`agenter.sim.ledger.v1`, ¥100M, lot 100, T+1, quotes from baked `latest.json`). It does **not** call `trade.10jqka.com.cn` from the browser. Keep `#/paper` (next-open educational desk) unchanged.

---

## Methodology skills (nine packages)

These SkillHub packages are **agent methodology / signal frameworks** (SKILL.md + examples). They do **not** call Iwencai OpenAPI and need no per-skill API key. Install:

```bash
iwencai-skillhub-cli --dir ./skills install 基本面因子筛选
iwencai-skillhub-cli --dir ./skills install 多因子选股策略
iwencai-skillhub-cli --dir ./skills install 机器学习策略
iwencai-skillhub-cli --dir ./skills install 量化统计方法
iwencai-skillhub-cli --dir ./skills install 因子研究框架
iwencai-skillhub-cli --dir ./skills install 量化因子选股
iwencai-skillhub-cli --dir ./skills install 策略生成与优化
iwencai-skillhub-cli --dir ./skills install K线形态识别
iwencai-skillhub-cli --dir ./skills install 执行模型
```

| Slug | SKILL.md path | Agent use | Website distill |
|------|---------------|-----------|-----------------|
| `基本面因子筛选` | `skills/基本面因子筛选/fundamental-filter/SKILL.md` | PE/PB/ROE screens | Factor Board quality/value proxies |
| `多因子选股策略` | `skills/多因子选股策略/multi-factor/SKILL.md` | Cross-section TopN | `factors:bake` composite ranks |
| `机器学习策略` | `skills/机器学习策略/ml-strategy/SKILL.md` | sklearn walk-forward | Learn + recipe cards (no browser ML) |
| `量化统计方法` | `skills/量化统计方法/quant-statistics/SKILL.md` | ADF / cointegration | Quant ADF diagnostics strip |
| `因子研究框架` | `skills/因子研究框架/factor-research/SKILL.md` | IC/IR research | Factor Board attribution |
| `量化因子选股` | `skills/量化因子选股/SKILL.md` | Formal factor models | OHLC-proxy factor board |
| `策略生成与优化` | `skills/策略生成与优化/strategy-generate/SKILL.md` | Draft + tune strategies | Recipe cards → Strategy Lab |
| `K线形态识别` | `skills/K线形态识别/candlestick/SKILL.md` | 15 candlestick patterns | Site detectors → **15** IDs |
| `执行模型` | `skills/执行模型/execution-model/SKILL.md` | Fixed / √-impact slippage | Paper + Lab `slippageModel` |

**Agent vs site:** Agents read the SKILL.md workflows above. The SPA only ships OHLC-proxy bakes (`factors.json`, 15 patterns, ADF strip, recipe cards). Never embed SkillHub API keys in the browser.

---

## Cursor discovery

Project-local Cursor skills live under `.cursor/skills/<slug>/SKILL.md`. OpenAPI skills and the nine methodology packages are symlinked from `skills/` (nested packages point at the inner folder that contains `SKILL.md`) so Cursor indexes the same content as SkillHub.
