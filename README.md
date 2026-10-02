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
| `/#/` | Brand home — **Agenter** / ZH「挑选更合适的 Agent」 · EN「for better agents — compare and choose」 |
| `/#/compare` | Catalog filter/search + side-by-side + Harness presets/weights + share links |
| `/#/learn` | Guided tour + ≥8 practice scenarios + Harness / no-lookahead explainers |
| `/#/tools` | Tools hub |
| `/#/news` | AI news digest (baked RSS / fixture) |
| `/#/quant` | Quant review + signal board + next-open checklist |
| `/#/paper` | Paper desk (¥100M) + risk strip + equity curve + checklist export |
| `/#/asset/:symbol` | Candlestick + MA overlays |

**Home must not be Quant-only.** Primary H1 is **Agenter**.

---

## Locked decisions

| Topic | Decision |
|-------|----------|
| Domain / brand | **Agenter.si**; tagline **for better agents** |
| Homepage | Brand / compare JTBD — not Quant facade |
| 快速实盘 | **A + C only** — checklist export + paper. **No** broker/THS API |
| Paper | `localStorage` v2 journal; start **100,000,000 CNY**; **3 bps** RT; lots of **100**; one-click top-up from legacy 1M |
| Fill rule | Signal `t` → fill **`t+1` open** (else labeled close fallback) |
| Locales | **zh** + **en** |
| Stack | Vite + TS SPA; `quant:bake` + `news:bake`; GitHub Pages |
| Quant scope | **10** patterns (5 legacy + 5 additive) · **26** symbols (16 legacy + 10 additive) |
| DNS | Docs only this round — no cutover |

---

## Commands

```bash
npm ci
npm test                 # patterns + paper (incl. ¥100M + no-lookahead)
npm run quant:bake       # OHLC → public/data/latest.json
npm run news:bake        # RSS → public/data/ai-news.json (fail-open)
npm run build
npm run dev
```

Bake gate: `ok+stale >= max(8, floor(n/2))`.

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
| Patterns | **10** IDs (legacy five unchanged) |
| Indicators | SMA20/60, RSI14, MA align, volume spike (OpenCool distill) |
| Data | East Money → Yahoo → cache; browser reads baked JSON only |

### Patterns

Legacy: `bullish_engulfing`, `bearish_engulfing`, `hammer`, `shooting_star`, `doji`  
Additive: `morning_star`, `evening_star`, `three_white_soldiers`, `three_black_crows`, `piercing_line`

### Watchlist

Legacy 16 unchanged + additive: `510050.SS`, `159919.SZ`, `512690.SS`, `515790.SS`, `601318.SS`, `600900.SS`, `000333.SZ`, `002415.SZ`, `300750.SZ`, `601166.SS`

---

## Paper desk

- Start **¥100,000,000**; fee 3 bps RT; A-share/ETF lots 100
- Equity curve, portfolio weights / unrealized PnL, soft risk strip (`quant-risk-gates` spirit)
- Import/export journal JSON; broker checklist CSV/JSON with **next-open** wording
- No xiadan / THS / broker SDKs

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
- Skills: `quant-no-lookahead`, `quant-daily-ops` (list not live), `quant-risk-gates` (UI warnings)

---

## NOT this round

- Broker / 同花顺 live API · DNS cutover · Computer Use QA · removing zh or brand home · HK/US/crypto · mandatory Supabase

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
