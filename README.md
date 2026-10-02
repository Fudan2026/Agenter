# Agenter

**for better agents**

Live site (GitHub Pages): [https://fudan2026.github.io/Agenter/](https://fudan2026.github.io/Agenter/)

Intended custom domain: [https://agenter.si](https://agenter.si) — see **Phase 4: Cloudflare bind** below (owner DNS required).

Agenter helps people **filter, compare, and pick** AI / Agent products (coding agents prioritized, mixed catalog). Quant review and **快速实盘** (signal/list export + in-browser paper) are **secondary tools**, not the homepage face.

This README is the **canonical English build brief**.

---

## Information architecture

| Route | Purpose |
|-------|---------|
| `/#/` | Brand home — **Agenter** / ZH「挑选更合适的 Agent」 · EN「for better agents — compare and choose」 |
| `/#/compare` | Catalog filter + side-by-side + Harness weights (`localStorage`) |
| `/#/learn` | Guided tour + ≥5 practice scenarios |
| `/#/tools` | Tools hub (Quant / Paper / export / AI-news stub) |
| `/#/quant` | Quant review (moved off home) |
| `/#/paper` | Paper desk + broker checklist CSV/JSON export |
| `/#/asset/:symbol` | Candlestick detail (under Quant) |

**Home must not be Quant-only.** Primary H1 is the brand name **Agenter**.

---

## Locked decisions

| Topic | Decision |
|-------|----------|
| Domain / brand | **Agenter.si**; tagline **for better agents** |
| Homepage | Brand / compare JTBD — not Quant facade |
| 快速实盘 | **A + C only**: signals/list export + paper loop. **No** broker/THS API (no B) |
| Paper | `localStorage` journal; start **1,000,000 CNY**; **3 bps** round-trip simplified; A-share/ETF lots of **100** |
| Paper / signals fill | Signal bar `t` → fill at **`t+1` open** (else labeled close fallback) — no lookahead |
| Export checklist | **Next-open** wording; humans order elsewhere |
| Locales | **zh** and **en** only |
| Stack | Vite + TypeScript SPA; `quant:bake`; GitHub Pages (`/Agenter/` base) |
| Quant scope | Exactly **5** patterns · **16** symbols — no growth without plan revision |
| Cloudflare | Documented in Phase 4; cutover needs owner CF account |

---

## Commands

```bash
npm ci
npm test                 # pattern + paper no-lookahead tests
npm run quant:bake       # fetch OHLC → public/data/latest.json (gate: ok+stale ≥ 8)
npm run build            # vite build → dist/
npm run dev              # local preview
```

Bake success gate: `symbolsOk + symbolsStale ≥ 8`, else exit code 1. Fixture `public/data/latest.json` is committed for offline builds.

---

## Compare catalog (`public/data/agents.json`)

Curated **16** agents/products (coding + chat mix, CN/US/Global). Scores are **editorial heuristics (1–5)**, not vendor benchmarks. Owner may edit anytime.

### Agent catalog sources (public knowledge)

Drafted from public product pages / docs (not scraped registries):

| Product | Public reference |
|---------|------------------|
| Claude Code / Claude | anthropic.com / claude.ai |
| Cursor | cursor.com / docs.cursor.com |
| GitHub Copilot | github.com/features/copilot |
| Windsurf | windsurf.com |
| Aider | aider.chat |
| Continue | continue.dev |
| 通义灵码 | lingma.aliyun.com |
| Trae | trae.ai |
| ChatGPT | chatgpt.com |
| Kimi | kimi.moonshot.cn |
| 豆包 | doubao.com |
| DeepSeek | deepseek.com |
| Perplexity | perplexity.ai |
| Gemini | gemini.google.com |
| OpenClaw | public GitHub org references |

Field ideas distilled (not forked wholesale) from open compare landscapes such as Doris26/ai-agent-compare, sehoon787/agent-hub, odykyi/agentic-comparison.

Harness weights default to **coding-agent dimensions prioritized** (`codingAbility`, `toolUse`, …) and persist in `localStorage`.

---

## Quant tool (secondary)

| Item | Value |
|------|-------|
| Markets | CN A-share + CN ETF — **16** symbols |
| Patterns | Exactly **5** (unchanged IDs) |
| Data | East Money → Yahoo → last-good cache |
| Browser | Reads baked JSON only |

### Five patterns (fixed IDs)

| patternId | EN | ZH |
|-----------|----|----|
| `bullish_engulfing` | Bullish engulfing | 看涨吞没 |
| `bearish_engulfing` | Bearish engulfing | 看跌吞没 |
| `hammer` | Hammer | 锤子线 |
| `shooting_star` | Shooting star | 射击之星 |
| `doji` | Doji | 十字星 |

**No-lookahead:** pattern at bar `i` uses only candles `≤ i` (unit-tested).

### Watchlist (16)

Macro: `000001.SS`, `399001.SZ`  
ETF: `510300.SS`, `510500.SS`, `159915.SZ`, `588000.SS`, `512880.SS`, `512480.SS`  
A-share: `600519.SS`, `600036.SS`, `000858.SZ`, `002594.SZ`, `601012.SS`, `000001.SZ`, `600276.SS`, `601888.SS`

---

## Paper desk + checklist (A + C)

- Virtual cash / positions / journal in **`localStorage`** (`agenter.paper.journal.v1`).
- Fill rule aligns with `quant-no-lookahead`: next session **open**.
- Export CSV/JSON broker checklist with **next-open** notes — **list not live order** (`quant-daily-ops` spirit).
- **No** `xiadan` / THS / broker SDKs.

---

## Phase 4: Cloudflare DNS bind for `agenter.si`

GitHub Pages stays the primary ship path until the owner completes DNS. **Do not** commit a `CNAME` that points away from Pages until Cloudflare (or registrar) is ready — that would break `fudan2026.github.io/Agenter/`.

### Owner steps (Cloudflare)

1. Create a **Cloudflare Pages** project (or keep GitHub Pages and only proxy DNS — pick one source of truth).
2. Preferred mirror path:
   - Connect the `Fudan2026/Agenter` repo, production branch `main`, build command `npm ci && npm test && npm run quant:bake && npm run build`, output `dist`.
   - Set Pages path base carefully: this Vite app uses `base: "/Agenter/"` for GitHub project pages. For apex `agenter.si`, change `vite.config.ts` `base` to `'/'` in a follow-up deploy profile **or** host under a Workers/Pages rewrite — owner chooses. Document choice in the CF project env before cutting DNS.
3. In Cloudflare DNS for `agenter.si`:
   - Apex: `CNAME` flattened / `ALIAS` to the Pages target Cloudflare shows, **or** A/AAAA records Cloudflare provides for Pages.
   - `www`: `CNAME` → same Pages hostname.
4. Enable HTTPS (Cloudflare Universal SSL).
5. Optional: redirect `https://fudan2026.github.io/Agenter/` → `https://agenter.si/` (GitHub Pages custom domain + `CNAME` file **only after** DNS answers correctly).
6. Verify: `curl -sI https://agenter.si/` → 200; HTML/JS shows brand H1 **Agenter**, not Quant-only title; `/#/quant` still loads the pattern demo.

### If using GitHub Pages custom domain instead of CF Pages

1. Repo **Settings → Pages → Custom domain** → `agenter.si`.
2. At Cloudflare DNS (domain must use CF nameservers):
   - `CNAME` `agenter.si` → `fudan2026.github.io` (Cloudflare CNAME flattening), or the A records GitHub documents for Pages.
   - `CNAME` `www` → `fudan2026.github.io`.
3. GitHub will then expect a `CNAME` file in `dist/` / `public/`. Add `public/CNAME` containing `agenter.si` **only when** DNS is ready; until then leave it out so project Pages keep working on `github.io`.
4. Turn on “Enforce HTTPS” after the certificate provisions.

### API note

This agent cannot cut DNS or bind Cloudflare without the owner’s Cloudflare credentials. README steps above are the deliverable for Phase 4 docs; GH Pages must remain green.

---

## Distill sources

### OpenCool — [`fudan2026/opencool`](https://github.com/fudan2026/opencool)

OHLC bake modules under `src/lib/ohlc/` (CN only). Upstream lineage: [`leiting-eric/DailyBrief`](https://github.com/leiting-eric/DailyBrief).

### Skills spirit

- `quant-no-lookahead` — enforced on pattern detectors + paper fills.
- `quant-daily-ops` — **list not live order**; checklist export only.

---

## NOT in scope (hard stop)

- Broker / 同花顺 / any live order API (capability B)
- Claiming the site places real trades or gives investment advice
- Agent runtime / orchestration (“arrange agents for me”)
- Quant as homepage identity
- New pattern IDs or watchlist growth without plan revision
- HK/US equity expansion in Quant/paper
- Locales beyond zh/en
- Computer Use–based QA
- Mandatory Supabase in this ship
- Huachuang / 看线宝 commercial APIs

---

## Dependency allowlist

**Allowed:** `vite`, `typescript`, `tsx`, `@types/node`, `lightweight-charts`  
**Forbidden:** Supabase (this round), wrangler (optional later), Playwright, Puppeteer, broker/THS SDKs, OpenAI/Anthropic SDKs in the SPA, Huachuang clients

---

## Agent operating notes

1. English README is canonical; homepage is brand-first.
2. Verify with `npm test`, `npm run build`, and HTTP fetch of Pages — no Computer Use.
3. No secrets in git. Pages workflow uses default `GITHUB_TOKEN` only.
4. Touch only this repo unless a separate task says otherwise.

---

## License / status

**Status:** Brand-first SPA on GitHub Pages; Quant/paper as tools; `agenter.si` DNS bind pending owner Cloudflare.

License: TBD by maintainers.

---

## Quick links

| Resource | URL |
|----------|-----|
| Live Pages | https://fudan2026.github.io/Agenter/ |
| Intended domain | https://agenter.si |
| This repo | https://github.com/Fudan2026/Agenter |
| OpenCool (OHLC distill) | https://github.com/fudan2026/opencool |
