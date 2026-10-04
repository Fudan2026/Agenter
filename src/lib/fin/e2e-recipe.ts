/**
 * E2E strategy loop helpers — validate Lab recipe ids + deep links.
 * Educational closed loop: bake → LLM recipe → Lab/Paper. No live orders.
 */

export const LAB_STRATEGY_IDS = [
  "ma_cross",
  "rsi_reversion",
  "confluence",
  "ml_lite",
] as const;

export type LabStrategyId = (typeof LAB_STRATEGY_IDS)[number];

export function isLabStrategyId(id: string): id is LabStrategyId {
  return (LAB_STRATEGY_IDS as readonly string[]).includes(id);
}

export function labDeepLink(id: string): string {
  const safe = isLabStrategyId(id) ? id : "ma_cross";
  return `#/quant?panel=lab&lab=${safe}`;
}

export function paperDeepLink(symbol?: string): string {
  if (symbol) return `#/paper?symbol=${encodeURIComponent(symbol)}`;
  return "#/paper";
}

/** Normalize LLM-proposed recipe against known Lab strategies. */
export function normalizeE2eRecipe(raw: {
  lab_id?: string;
  params?: Record<string, unknown>;
  symbols?: string[];
}): {
  lab_id: LabStrategyId;
  params: Record<string, unknown>;
  deep_links: string[];
  valid: boolean;
} {
  const proposed = String(raw.lab_id || "").trim();
  const valid = isLabStrategyId(proposed);
  const lab_id: LabStrategyId = valid ? proposed : "ma_cross";
  const symbols = Array.isArray(raw.symbols)
    ? raw.symbols.map(String).slice(0, 5)
    : [];
  const deep_links = [
    labDeepLink(lab_id),
    ...symbols.slice(0, 2).map((s) => paperDeepLink(s)),
    "#/quant?panel=studio",
  ];
  return {
    lab_id,
    params: raw.params && typeof raw.params === "object" ? raw.params : {},
    deep_links,
    valid,
  };
}
