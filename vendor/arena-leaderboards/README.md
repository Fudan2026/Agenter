# Arena leaderboard vendor snapshot

Fail-open bake input for `npm run ai-ratings:bake`.

Provenance intent: consume **published** LMSYS/Arena-style leaderboard JSON
(e.g. community snapshot repos such as `oolong-tea-2026/arena-ai-leaderboards`).
This folder holds a small committed `text.json` so CI remains deterministic when
remote raw URLs are unreachable.

The bake never mutates editorial `agents.json` / `quant-agents.json` scores.
