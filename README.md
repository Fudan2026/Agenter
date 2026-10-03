# Agenter

**for better agents**

Live site (GitHub Pages mirror): [https://fudan2026.github.io/Agenter/](https://fudan2026.github.io/Agenter/)

Production domain: [https://supro.si](https://supro.si) — Cloudflare Pages + Functions (letusIELTS-style). Apply `public/CNAME` + CF custom domain; set Pages secrets (Supabase / LLM / Iwencai).

Agenter helps people **filter, compare, and pick** AI / Agent products. Quant review, signal boards, and **快速实盘** (checklist export + in-browser paper at **¥100,000,000** start) are **secondary tools**.

This README is the **canonical English build brief**.

---

## Information architecture

| Route | Purpose |
|-------|---------|
| `/#/` | Brand home — **Agenter** / for better agents (primary CTA → Compare) |
| `/#/compare` | Apple-style sticky shortlist + dimension matrix + harness presets |
| `/#/learn` | Guided tour + practice scenarios |
| `/#/handbook` | Bilingual deep manual — modules, 13-skill catalog, workflows |
| `/#/tools` | Hub — Handbook · Quant · Paper · Sim · News · **Fin Desk** |
| `/#/fin` | Fin Desk AIaaS (login + gold) — smart screen / factors / strategy / review |
| `/#/login` · `/#/account` | Auth + gold balance / redeem |
| `/#/news` | AI · filings · Iwencai on one page (`?section=ai|filings|iwencai`) |
| `/#/quant` | Factor Studio · Committee · screens→Paper · Strategy Lab (`?panel=…`) |
| `/#/paper` | Paper Pro — brackets · risk pack · Sim reconcile · TWAP/VWAP (`?panel=…`) |
| `/#/sim` | Sim Desk — SkillHub「模拟炒股」distill; handoff `#/paper?panel=reconcile` |
| `/#/asset/:symbol` | Candlestick + MA + factor exposures |
| `/#/compare` | Sticky shortlist + harness (`?preset=quant` applies Quant weights) |

**Primary nav = Home · Compare · Learn · Handbook · Tools.** Quant/Paper/Sim are tools — not the brand face.  
**Correction:** Round-1 Quant-as-home was wrong; corrected this round.

**Home must not be Quant-only.** Primary H1 is **Agenter**.

---

## Locked decisions

| Topic | Decision |
|-------|----------|
| Domain / brand | **Agenter.si**; tagline **for better agents** |
| Homepage | Brand / compare JTBD — not Quant facade |
| 快速实盘 | **A + C only** — checklist export + paper. **No** broker/THS API in the browser |
| Paper | `localStorage` v2 journal; start **100,000,000 CNY**; **3 bps** RT; lots of **100**; one-click top-up from legacy 1M |
| Sim Desk | `#/sim` distill of SkillHub「模拟炒股」; `agenter.sim.ledger.v1`; ¥100M; lot 100; T+1; quotes from baked `latest.json` |
| Fill rule | Paper: signal `t` → fill **`t+1` open**. Sim: editable limit @ last close |
| Locales | **zh** + **en** |
| Stack | Vite + TS SPA; Cloudflare Pages + Functions (letus mirror); bake scripts; GitHub Pages secondary mirror |
| Quant scope | **15** patterns · **≥26** symbols floor (add-only) · multi-year OHLC · Fin Desk AIaaS (login+gold) |
| Compare ratings | Editorial 1–5 stay; Arena/AA overlay additive |
| Auth / gold | Supabase Auth + `user_economy`; Fin Desk gated; server token→gold spend |
| Domain | **agenter.si** on Cloudflare Pages (cutover this round); `public/CNAME` |
| DNS | Execute CF custom domain for apex/www |

---

## Commands

```bash
npm ci
npm test                 # patterns + paper MTM + backtest + board
npm run quant:bake           # OHLC → public/data/latest.json
npm run factors:bake         # latest.json → public/data/factors.json (OHLC-proxy Factor Board)
npm run news:bake            # RSS → public/data/ai-news.json (fail-open)
npm run announcements:bake   # Iwencai CLI → public/data/announcements.json (fail-open; needs IWENCAI_API_KEY)
npm run iwencai-news:bake    # news-search CLI → public/data/iwencai-news.json
npm run indices:bake         # zhishu CLI → public/data/indices.json (Quant strip)
npm run screens:bake         # selector CLI → public/data/screens.json (editorial screens)
npm run factors:ic-bake      # latest.json → factors-ic.json (multi-horizon IC)
npm run ai-ratings:bake      # Arena/AA fork JSON → ai-ratings.json (fail-open overlay)
npm run fin-corpus:bake      # announcements/news/review → fin-corpus.json (Fin Desk RAG)
npm run build                # default base `/` (CF / agenter.si); GH Pages uses VITE_BASE=/Agenter/
npm run dev
```

Bake gate: `ok+stale >= max(8, floor(n/2))`.

### Deploy

| Target | Workflow | Notes |
|--------|----------|-------|
| Cloudflare Pages `agenter` | `.github/workflows/cloudflare.yml` | Primary for `agenter.si` + Functions |
| GitHub Pages | `.github/workflows/pages.yml` | Mirror until DNS cut confirmed |
| Daily bake | `.github/workflows/daily-bake.yml` | Cron refresh `public/data` fail-open |

Apply [`supabase/economy.sql`](supabase/economy.sql) in your Supabase project. Put secrets via `wrangler pages secret put` / Actions (see [`.env.example`](.env.example)).

---

## Compare catalog

Curated **36** agents in `public/data/agents.json` (16 original IDs kept; 20 additive). Scores are editorial heuristics 1–5.

Harness presets: Coding IDE · CN-reachable · Privacy/BYOK · Research. Share via `#/compare?ids=…&w=…`.

### Catalog sources (public knowledge)

Claude / Cursor / Copilot / Windsurf / Aider / Continue / 通义灵码 / Trae / ChatGPT / Kimi / 豆包 / DeepSeek / Perplexity / Gemini / OpenClaw / Codex CLI / Devin / Replit / Zed / Tabnine / Codeium / Qwen / Comate / CodeBuddy / Grok / 元宝 / 文心 / Midjourney / FLUX / LangChain / LlamaIndex / Dify / Coze / You.com — public product pages. Field ideas from open compare landscapes (not forked wholesale).

---

## Quant tool

| Item | Value |
|------|-------|
| Markets | CN A-share + CN ETF — **29** symbols (26 floor + 3 index add-ons) |
| Patterns | **15** IDs (legacy five unchanged) |
| Indicators | SMA20/60, RSI14, MACD, BOLL, MA align, volume spike |
| Bake window | up to **~10y** daily bars (`lmt≈2600` / Yahoo `max`→`10y`); disclose `sampleYears` / `nBars` if shorter |
| Pattern efficacy | Per-symbol `patternStats` (horizons 1/5/10/20) + Asset win-rate filter + Effective list |
| Pro chart | Asset fullscreen / TF tabs **D/W/M** (daily resample) + MA/RSI/MACD/BOLL |
| Macro timing | Proxy-constituent confluence → ETF timing score (`#/quant?panel=macro`) |
| ETF Rotation Lab | daily vs `fixed_5d` (+ optional timing overlay); checklist → Paper |
| Daily Review | Enriched sector / eval / outlook literacy (`#/quant?panel=review`) |
| Board | Confluence 0–100, filters, pattern heatmap, stale banner, pattern monitor |
| Factor Board | OHLC-proxy momentum / low-vol / ADV / quality · TopN ranks (`factors:bake`) |
| Factor Studio | Weight sliders, recipes, IC override, TopN→Paper batch |
| Committee Desk | Six-role bake-only votes → checklist / Paper batch (no browser LLM) |
| Strategy Composer | Lab params for MA / RSI / confluence / lag strategies |
| ADF strip | Log-price stationarity diagnostics (量化统计方法 distill) |
| Strategy Lab | In-browser no-lookahead backtests + Research Audit strip + fixed/√-impact slip |
| Data | East Money → Yahoo → cache; browser reads baked JSON only |
| AI ratings | Forked Arena JSON (+ AA when reachable) → `ai-ratings.json` Compare overlay; fail-open; never replaces editorial scores |

### Camp themes (cite briefly)

Site pillars distill **AI金融研学实训营** + SUFE Fin Manus/FinAgent panorama: Quant Agents Compare (P1), multi-agent screening (P2 Committee), interpretable multi-factor Alpha (P3 Studio/Composer; McLean/Kou/AlphaFormer literacy), auditable backtest + Paper Pro (P4; AI篇主题三 / 进阶主题十), event-bucket + Academy (P5). FinCast/TSFM weights and tick LOB remain out of browser scope.

### Patterns

Legacy: `bullish_engulfing`, `bearish_engulfing`, `hammer`, `shooting_star`, `doji`  
Additive: `morning_star`, `evening_star`, `three_white_soldiers`, `three_black_crows`, `piercing_line`, `inverted_hammer`, `spinning_top`, `bullish_harami`, `bearish_harami`, `dark_cloud_cover`

### Watchlist

Legacy 16 unchanged + additive: `510050.SS`, `159919.SZ`, `512690.SS`, `515790.SS`, `601318.SS`, `600900.SS`, `000333.SZ`, `002415.SZ`, `300750.SZ`, `601166.SS`

### Strategy Lab

- Execution: signal on bar **t** close → fill at **t+1** open (never same-bar)
- Fees 3 bps RT; A-share/ETF lots 100; long-only
- Tear sheet: return, max DD, Sharpe, win rate, profit factor, IS/OOS split
- **Send fills to Paper** appends labeled `source: backtest` journal entries (additive)

---

## Paper desk (Paper Pro)

- Start **¥100,000,000**; A-share cost model **default ON** (commission 2.5 bps/side min ¥5, stamp 5 bps sell, transfer 0.1 bps, slippage 5/10 bps fixed **or** optional √-impact); lots 100; T+1; limit-band rejects
- **Cockpit** strip: equity, cash, day PnL%, max DD, win rate, profit factor, open names, trades
- **Blotter**: filter by symbol/side/source; playbook + slice columns; top-N journal
- **Attribution**: by symbol and by playbook (momentum / mean_rev / committee / lab / manual)
- **Exec desk**: TWAP/VWAP + presets (TWAP-8 / VWAP-√ / TWAP-tight); **Materialize slices → journal**
- **Brackets**: attach stop%/TP% on positions; sweep on OHLC — same-bar conflict fills **stop first**
- **Risk pack**: soft strip + optional hard gates (max name %, min cash %, max open names, daily MTM loss halt)
- **CN calendar lite**: `public/data/cn-calendar.json` skips educational non-sessions when resolving next-open
- **Sim reconcile**: import Sim positions → Paper (`source: sim`); `#/paper?panel=reconcile`
- **Research Audit** card; checklist export with next-open wording
- Deep links: `#/paper?panel=export|exec|ticket|blotter|audit|risk|reconcile`
- No xiadan / THS / broker SDKs

### Compare · Academy · skills

- **Quant Agents Compare** (`#/compare` Quant preset): curated quant/AI-finance agents alongside product agents
- **Academy**: long Handbook modules + Learn pointers (camp curriculum distill)
- **Skills**: add-only — do not remove vendored SkillHub packages; site distills methodology, agents keep full CLIs

### Tier 2 paper mechanisms (product, not blog)

| Paper / idea | Product mechanism |
|--------------|-------------------|
| Fama–French | Style exposures β / Size ADV / HML-proxy 12−1 on asset + lab |
| Harvey / DSR | Haircut Sharpe with N=12; gates block false greens |
| López de Prado | Expanding purged + embargo walk-forward (≥3 OOS folds) |
| Kelly / Thorp | Half-Kelly ticket suggestion + failure modes |
| Microstructure costs | Shared cost model default ON; OFF cannot be “actionable” |

### Four hard gates

Multiple testing · lookahead · IS→OOS degradation · cost/liquidity — plus survivorship disclosure on Quant/Paper.

---

## Phase 4: Cloudflare DNS + Pages (this round)

1. Create Cloudflare Pages project **`supro`** (matches `wrangler.toml`).
2. Add custom domains **`supro.si`** and **`www.supro.si`** (CNAME/ALIAS to Pages). Retire any `agenter.si` custom-domain attachment.
3. Repo ships `public/CNAME` → `supro.si`.
4. Put secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_*`, plus Actions `CF_API_TOKEN` / `CF_ACCOUNT_ID` / `VITE_SUPABASE_*` (see `.env.example`). Point Supabase at the **shared Letus project**.
5. Apply [`supabase/supro_on_letus.sql`](supabase/supro_on_letus.sql) in that Supabase SQL editor (**do not** apply legacy `economy.sql` onto Letus).
6. Deploy via `.github/workflows/cloudflare.yml` on `main`.
7. Keep GitHub Pages workflow as fail-open mirror until apex cutover verified.

---

## Distill sources

- OpenCool OHLC + indicators/signals spirit → `src/lib/ohlc`, `src/lib/indicators`, `src/lib/signals`
- Skills: `quant-no-lookahead`, `quant-daily-ops` (list not live), `quant-risk-gates` (UI warnings), `quant-backtest-review` (tear-sheet R/Y/G)
- Interactive agents: see root **`Skills.md`** (Iwencai OpenAPI skills + nine methodology packages under `skills/`: K线形态识别, 执行模型, factor/ML/stats frameworks, etc.).
- Site distill: 15 patterns · Factor Board · ADF strip · recipe cards · √-impact costs — agents keep full SkillHub workflows.
- Site: bake-time JSON (`latest.json`, `pattern-stats.json`, `etf-meta.json`, `ai-ratings.json`, `fin-corpus.json`, …). **`#/fin`** is login+gold Fin Desk AIaaS. **`#/quant`** Macro/Rotation/Review + screens. Agents use vendored CLIs; browser never embeds broker SDKs or `IWENCAI_API_KEY`. Owner sets Actions/CF secrets for fresher bakes and Fin Desk LLM.

---

## NOT this round

- Broker / 同花顺 **live browser** API · Computer Use QA · removing zh or brand home · HK/US/crypto · Soft Soft · inventing greenfield leaderboard scrapers · replacing editorial Compare scores · putting 日报/Fin Desk on brand-home hero · Fin-R1/FinCast **weight training** · L4 autonomous live trading

Bake-time + agent CLI for Iwencai skills is allowed; browser-side Iwencai / THS trade calls remain forbidden. Supabase is required for Fin Desk (public Quant tools remain anonymous).

---

## Dependency allowlist

**Allowed:** `vite`, `typescript`, `tsx`, `@types/node`, `lightweight-charts`  
**Forbidden:** broker/THS SDKs, Playwright, Huachuang clients

---

## Quick links

| Resource | URL |
|----------|-----|
| Live Pages | https://fudan2026.github.io/Agenter/ |
| Intended domain | https://supro.si |
| Repo | https://github.com/Fudan2026/Agenter |
