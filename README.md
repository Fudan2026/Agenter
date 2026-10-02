# Agenter

**for better agents**

Live site (GitHub Pages): [https://fudan2026.github.io/Agenter/](https://fudan2026.github.io/Agenter/)

Intended custom domain: [https://agenter.si](https://agenter.si) — Cloudflare DNS bind documented below (**not** cut this round).

Agenter helps people **filter, compare, and pick** AI / Agent products. Quant review, signal boards, and **快速实盘** (checklist export + in-browser paper at **¥100,000,000** start) are **secondary tools**.

This README is the **canonical English build brief**.

---

## Information architecture

| Route | Purpose |
|-------|---------|
| `/#/` | Brand home — **Agenter** / for better agents (primary CTA → Compare) |
| `/#/compare` | Apple-style sticky shortlist + dimension matrix + harness presets |
| `/#/learn` | Guided tour + practice scenarios |
| `/#/tools` | **Sole hub** for Quant / Paper / Sim / News (secondary tools) |
| `/#/news` | AI news + A-share announcements + Iwencai finance news digest (via Tools) |
| `/#/quant` | Quant review + Tier-2 Strategy Lab (deep link; not primary nav) |
| `/#/paper` | Paper workstation — next-open educational desk (deep link) |
| `/#/sim` | Sim Desk — SkillHub「模拟炒股」distill (local ¥100M; deep link) |
| `/#/asset/:symbol` | Candlestick + MA + factor exposures |

**Primary nav = Home · Compare · Learn · Tools only.** Quant/Paper/Sim are tools — not the brand face.  
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
| Stack | Vite + TS SPA; `quant:bake` + `news:bake` + `announcements:bake` + `iwencai-news:bake` + `indices:bake` + `screens:bake`; GitHub Pages |
| Quant scope | **15** patterns (5 legacy + 10 additive) · **26** symbols (16 legacy + 10 additive) |
| DNS | Docs only this round — no cutover |

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
npm run screens:bake         # selector CLI → public/data/screens.json (3 editorial screens)
npm run build
npm run dev
```

Bake gate: `ok+stale >= max(8, floor(n/2))`.

Iwencai bake scripts (`announcements` / `iwencai-news` / `indices` / `screens`) need `IWENCAI_API_KEY` in the shell or GitHub Actions secret. Missing key → fail-open and keep the committed JSON. The browser never embeds the key.

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
| Markets | CN A-share + CN ETF — **26** symbols |
| Patterns | **15** IDs (legacy five unchanged) |
| Indicators | SMA20/60, RSI14, MA align, volume spike (OpenCool distill) |
| Bake window | **250** trading days |
| Board | Confluence 0–100, filters, pattern heatmap, stale banner |
| Factor Board | OHLC-proxy momentum / low-vol / ADV / quality · TopN ranks (`factors:bake`) |
| ADF strip | Log-price stationarity diagnostics (量化统计方法 distill) |
| Strategy Lab | In-browser no-lookahead backtests + fixed/√-impact slippage toggle |
| Data | East Money → Yahoo → cache; browser reads baked JSON only |

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

## Paper desk

- Start **¥100,000,000**; A-share cost model **default ON** (commission 2.5 bps/side min ¥5, stamp 5 bps sell, transfer 0.1 bps, slippage 5/10 bps fixed **or** optional √-impact); lots 100; T+1; limit-band rejects
- Workstation panels: Account · Ticket (half-Kelly) · Positions · Fills · Risk · Performance · Ops
- Fills: signal-date → next-open; MTM equity / PnL% / drawdown
- Soft + optional hard gates; checklist export with next-open wording
- No xiadan / THS / broker SDKs

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

## Phase 4: Cloudflare DNS (docs only — not this round)

Do **not** commit `CNAME` until owner DNS is ready (protects `github.io`).

1. Cloudflare Pages or GitHub Pages custom domain
2. DNS CNAME/ALIAS for `agenter.si` / `www`
3. HTTPS; optional redirect from github.io
4. For apex on CF Pages, consider Vite `base: '/'` in a follow-up deploy profile

---

## Distill sources

- OpenCool OHLC + indicators/signals spirit → `src/lib/ohlc`, `src/lib/indicators`, `src/lib/signals`
- Skills: `quant-no-lookahead`, `quant-daily-ops` (list not live), `quant-risk-gates` (UI warnings), `quant-backtest-review` (tear-sheet R/Y/G)
- Interactive agents: see root **`Skills.md`** (Iwencai OpenAPI skills + nine methodology packages under `skills/`: K线形态识别, 执行模型, factor/ML/stats frameworks, etc.).
- Site distill: 15 patterns · Factor Board · ADF strip · recipe cards · √-impact costs — agents keep full SkillHub workflows.
- Site: bake-time JSON only (`latest.json`, `announcements.json`, `iwencai-news.json`, `indices.json`, `screens.json`). **`#/news`** shows RSS AI news + announcements + Iwencai finance news. **`#/quant`** shows index snapshot + three fixed editorial screens. **`#/sim`** is a local distill of SkillHub 模拟炒股. Agents use vendored CLIs; the browser never embeds broker SDKs or `IWENCAI_API_KEY`.

---

## NOT this round

- Broker / 同花顺 **live browser** API · DNS cutover · Computer Use QA · removing zh or brand home · HK/US/crypto · mandatory Supabase

Bake-time + agent CLI for Iwencai skills is allowed; browser-side Iwencai / THS trade calls remain forbidden.

---

## Dependency allowlist

**Allowed:** `vite`, `typescript`, `tsx`, `@types/node`, `lightweight-charts`  
**Forbidden:** broker/THS SDKs, Playwright, Huachuang clients

---

## Quick links

| Resource | URL |
|----------|-----|
| Live Pages | https://fudan2026.github.io/Agenter/ |
| Intended domain | https://agenter.si |
| Repo | https://github.com/Fudan2026/Agenter |
