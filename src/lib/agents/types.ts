/** Curated agent catalog schema (coding + quant AI-finance). */

export type AgentRegion = "CN" | "US" | "Global";
export type AgentCategory =
  | "coding"
  | "chat"
  | "research"
  | "image"
  | "tooling"
  | "quant";

export type DimensionId =
  | "codingAbility"
  | "toolUse"
  | "contextMemory"
  | "privacyControl"
  | "costEfficiency"
  | "cnAccessibility"
  | "learningCurve"
  | "researchOrchestration"
  | "factorAlphaTooling"
  | "memoryReflection"
  | "riskControls"
  | "backtestRigor";

/** Full harness dimension list (coding + quant). */
export const DIMENSION_IDS: DimensionId[] = [
  "codingAbility",
  "toolUse",
  "contextMemory",
  "privacyControl",
  "costEfficiency",
  "cnAccessibility",
  "learningCurve",
  "researchOrchestration",
  "factorAlphaTooling",
  "memoryReflection",
  "riskControls",
  "backtestRigor",
];

export const CODING_DIMENSION_IDS: DimensionId[] = [
  "codingAbility",
  "toolUse",
  "contextMemory",
  "privacyControl",
  "costEfficiency",
  "cnAccessibility",
  "learningCurve",
];

export const QUANT_DIMENSION_IDS: DimensionId[] = [
  "researchOrchestration",
  "factorAlphaTooling",
  "memoryReflection",
  "riskControls",
  "backtestRigor",
  "cnAccessibility",
  "costEfficiency",
  "learningCurve",
];

export interface AgentRecord {
  id: string;
  nameZh: string;
  nameEn: string;
  region: AgentRegion;
  category: AgentCategory;
  pricingBand: string;
  contextWindow: string;
  toolsMcp: string;
  privacy: string;
  links: { homepage?: string; docs?: string };
  /** Optional logo path under site root (e.g. logos/claude.svg). */
  logo?: string;
  /** Scores 1–5; missing dims ignored in weightedScore. */
  scores: Partial<Record<DimensionId, number>>;
  notesZh?: string;
  notesEn?: string;
}

export interface AgentsPayload {
  generatedAt: string;
  sourceNote: string;
  agents: AgentRecord[];
}
