# Supro

**Super Professional**

Live site (GitHub Pages mirror): [https://fudan2026.github.io/Agenter/](https://fudan2026.github.io/Agenter/)

Production domain: [https://supro.si](https://supro.si) — Cloudflare Pages + Functions (letusIELTS-style). Apply `public/CNAME` + CF custom domain; set Pages secrets (Supabase / LLM / Iwencai).

Supro helps people **filter, compare, and pick** AI / Agent products with a Super Professional home (America.gov-grade chrome + composer), an AI directory (logo · name · site · weekly ranks), and **SuPo Model / 苏坡大模型** — DeepSeek AIaaS metered by shared gold after actual tokens. Chinese name **苏坡** takes Su Dongpo’s first and last characters (calm optimism under Super Intelligence). Quant + paper remain first-class.

This README is the **canonical English build brief**. Default UI language is **English** (Chinese via toggle).

---

## Information architecture

| Route | Purpose |
|-------|---------|
| `/#/` | Brand home — Hello / **Supro** composer → SuPo Model · AI directory · weekly ranks · Quant |
| `/#/compare` | Sticky shortlist + dimension matrix + harness presets |
| `/#/learn` | Guided tour + practice scenarios |
| `/#/handbook` | Bilingual deep manual — modules, skill catalog, workflows |
| `/#/tools` | Hub — Handbook · Quant · Paper · Sim · News · **SuPo Model** |
| `/#/fin` | **苏坡大模型 / SuPo Model** (login + gold ≥20) — pick/factor/strategy/review/multifactor/e2e/transformer |
| `/#/login` · `/#/account` | Letus-parity auth + shared gold / redeem |
| `/#/admin` | Steward prototype (`seanfudan@163.com`) |
| `/#/news` | AI · filings · Iwencai on one page (`?section=ai|filings|iwencai`) |
| `/#/quant` | Factor Studio · Committee · screens→Paper · Strategy Lab (`?panel=…`) |
| `/#/paper` | Paper Pro — brackets · risk pack · Sim reconcile · TWAP/VWAP (`?panel=…`) |
| `/#/sim` | Sim Desk — SkillHub「模拟炒股」distill; handoff `#/paper?panel=reconcile` |
| `/#/asset/:symbol` | Candlestick + MA + factor exposures |

**Chrome:** official banner · wordmark + Menu sheet · EN/ZH footer. **Home** = composer + directory + Quant strip.

---

## Locked decisions

| Topic | Decision |
|-------|----------|
| Domain / brand | **supro.si** · **Supro** / **Super Professional** · ZH **苏坡** / **苏坡大模型** |
| Homepage | America.gov-grade white/navy/serif composer + AI directory + weekly ranks + Quant |
| SuPo Model | DeepSeek **only** paid path; debit **after** actual tokens; floor **20** gold; admin unlimited |
| LLM elsewhere | Weekly ranks + OHLC/RSS/Iwencai bakes = crawl — **zero** LLM tokens |
| 快速实盘 | **A + C only** — checklist export + paper. **No** broker/THS API in the browser |
| Paper | `localStorage` journal; start **100,000,000 CNY**; **3 bps** RT; lots of **100** |
| Sim Desk | `#/sim` distill; ledger key with legacy `agenter.sim.ledger.v1` read-fallback |
| Fill rule | Paper: signal `t` → fill **`t+1` open**. Sim: editable limit @ last close |
| Locales | **English default**; zh via toggle (苏坡 Dongpo literacy) |
| Stack | Vite + TS SPA; Cloudflare Pages project **`supro`** + Functions; bake scripts; GH Pages mirror |
| Quant scope | **15** patterns · multi-year OHLC · SuPo Model AIaaS (login + shared gold) |
| Compare ratings | Editorial 1–5 stay; Arena/AA overlay additive (weekly bake, no LLM) |
| Auth / gold | **Shared Letus Supabase only** (never a new project); `GOLD_PER_USD=100`; post-usage spend |
| Admin | `seanfudan@163.com` ≥100000 gold; `#/admin` prototype |
| Soft Soft | Letus-only — not ported |
| DNS | CF custom domain for apex/www on project `supro` |

---

## Commands

```bash
npm ci
npm test                 # patterns + paper MTM + backtest + board + auth guards
npm run quant:bake           # OHLC → public/data/latest.json
npm run factors:bake         # latest.json → public/data/factors.json
npm run news:bake            # RSS → public/data/ai-news.json (fail-open)
npm run announcements:bake   # Iwencai CLI → announcements.json (needs IWENCAI_API_KEY)
npm run iwencai-news:bake    # news-search CLI → iwencai-news.json
npm run indices:bake         # zhishu CLI → indices.json
npm run screens:bake         # selector CLI → screens.json
npm run factors:ic-bake      # factors-ic.json
npm run ai-ratings:bake      # Arena/AA → ai-ratings.json (weekly ranks)
npm run fin-corpus:bake      # fin-corpus.json (Fin Desk RAG)
npm run build                # default base `/` (CF / supro.si); GH Pages uses VITE_BASE=/Agenter/
npm run dev
```

Bake gate: `ok+stale >= max(8, floor(n/2))`.

### Deploy

| Target | Workflow | Notes |
|--------|----------|-------|
| Cloudflare Pages `supro` | `.github/workflows/cloudflare.yml` | Primary for `supro.si` + Functions |
| GitHub Pages | `.github/workflows/pages.yml` | Mirror |
| Daily bake | `.github/workflows/daily-bake.yml` | Cron refresh `public/data` fail-open |
| Weekly ratings | `.github/workflows/weekly-ratings.yml` | Monday Arena/AA refresh |

**Supabase (shared Letus project `jrnabzfvdcmcoxyadmax` — do NOT create a new project):**

1. Apply [`supabase/supro_on_letus.sql`](supabase/supro_on_letus.sql) — **do not** apply legacy [`supabase/economy.sql`](supabase/economy.sql).
2. Auth URL allowlist: `https://supro.si/**`, `https://www.supro.si/**`, Pages preview hosts.
3. Optional: set `app_metadata.role=admin` on `seanfudan@163.com` (SQL also bootstraps ≥100000 gold by email).
4. Secrets: see [`.env.example`](.env.example) — Pages needs `SUPABASE_*` + `LLM_BACKEND=deepseek` + `LLM_API_KEY` (**never commit the key**).

Hard gold peg: **100 gold = $1**. SuPo Model: preflight `gold >= 20` (non-admin) → DeepSeek → debit **after** actual tokens. Soft Soft stays Letus-local.

---

## Compare catalog

Curated **36** coding/chat agents + **12** quant agents. Scores are editorial heuristics 1–5.

Home directory links each agent’s `links.homepage` with a logo under `public/logos/`. Weekly ranks come from `ai-ratings.json` (Arena/AA overlay — never replaces editorial scores).

Harness presets: Coding IDE · CN-reachable · Privacy/BYOK · Research. Share via `#/compare?ids=…&w=…`.

---

## Phase 4: Cloudflare DNS + Pages

1. Create Cloudflare Pages project **`supro`** (matches `wrangler.toml`).
2. Add custom domains **`supro.si`** and **`www.supro.si`**. Retire any `agenter.si` attachment.
3. Repo ships `public/CNAME` → `supro.si`.
4. Put secrets (shared Letus Supabase + LLM + Iwencai) — see `.env.example`.
5. Apply `supabase/supro_on_letus.sql` in the Letus Supabase SQL editor.
6. Deploy via `.github/workflows/cloudflare.yml` on `main`.
7. Keep GitHub Pages as fail-open mirror.

---

## Distill sources

- OpenCool OHLC + indicators/signals spirit → `src/lib/ohlc`, `src/lib/indicators`, `src/lib/signals`
- Skills: see root **`Skills.md`** and `skills/` packages
- Site: bake-time JSON (`latest.json`, `ai-ratings.json`, `fin-corpus.json`, …). **`#/fin`** is login + shared-gold Fin Desk AIaaS. Browser never embeds broker SDKs or `IWENCAI_API_KEY`.

---

## NOT this round

- Broker / 同花顺 **live browser** API · Computer Use QA · silent cross-site SSO · Soft Soft port · applying Agenter `economy.sql` onto Letus · Fin-R1/FinCast **weight training** · L4 autonomous live trading · renaming the GitHub repo path `/Agenter/`

Bake-time + agent CLI for Iwencai skills is allowed; browser-side Iwencai / THS trade calls remain forbidden.

---

## Dependency allowlist

**Allowed:** `vite`, `typescript`, `tsx`, `@types/node`, `lightweight-charts`  
**Forbidden:** broker/THS SDKs, Playwright, Huachuang clients

---

## Quick links

| Resource | URL |
|----------|-----|
| Live Pages (mirror) | https://fudan2026.github.io/Agenter/ |
| Production domain | https://supro.si |
| Repo | https://github.com/Fudan2026/Agenter |
