/**
 * Mode-tiered gold multipliers for Supro Fin Desk commercial value.
 * Base cost = ceil(tokens/1000); bill = base * multiplier (admin free).
 */

const TIER_1 = new Set(["review", "pick", "factor", "strategy"]);
const TIER_2 = new Set(["multifactor", "allocate", "transformer"]);
const TIER_3 = new Set(["report"]);
const TIER_4 = new Set(["e2e"]);

export function modeGoldMultiplier(mode) {
  const m = String(mode || "");
  if (TIER_4.has(m)) return 4;
  if (TIER_3.has(m)) return 3;
  if (TIER_2.has(m)) return 2;
  if (TIER_1.has(m)) return 1;
  return 1;
}

export function billGoldForMode(tokens, mode, { admin = false } = {}) {
  if (admin) return 0;
  const t = Math.max(0, Number(tokens) || 0);
  if (t <= 0) return 0;
  const base = Math.max(1, Math.ceil(t / 1000));
  return base * modeGoldMultiplier(mode);
}

/** Trim chat history for model context (keep last maxMsgs, prefer pairs). */
export function trimHistoryForModel(messages, maxMsgs = 30) {
  const list = Array.isArray(messages) ? messages.slice() : [];
  const cleaned = list
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        String(m.content || "").trim(),
    )
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 8000),
    }));
  if (cleaned.length <= maxMsgs) return cleaned;
  return cleaned.slice(-maxMsgs);
}
