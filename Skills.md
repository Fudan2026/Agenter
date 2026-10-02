# Skills.md

Workspace skill catalog for **all coding agents** (Cursor Cloud Agent, Claude Code, Codex, Continue, Aider, etc.). When a user question matches a skill below, **read this section first**, then run the documented CLI or workflow. Do not reimplement API calls ad hoc.

## How agents should use this file

1. Match the user intent to a skill in the **index**.
2. Confirm required **environment variables** (see [Environment](#environment)).
3. Execute commands from the skill section using **absolute paths** under this repo (`agenter`).
4. Interpret API JSON in the agent layer; bundled scripts must pass through raw gateway bodies unchanged.
5. For answers sourced from Iwencai skills, state: **数据来源：同花顺问财**.

The Agenter **website** never calls Iwencai or THS trade APIs from the browser. Announcements come from bake-time `npm run announcements:bake` → `public/data/announcements.json`. Sim Desk `#/sim` is a local distill. Agents use SkillHub CLIs interactively.

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
| `模拟炒股` | A股模拟开户、买入/卖出、持仓/资金/成交/近30日收益 | `skills/模拟炒股/` |

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

## Cursor discovery

Project-local Cursor skills live under `.cursor/skills/<slug>/SKILL.md`. For `announcement-search` and `模拟炒股`, this repo symlinks those directories to `skills/<slug>/` so Cursor indexes the same content as SkillHub.
