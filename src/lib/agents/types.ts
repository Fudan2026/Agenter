/** Curated agent catalog schema (plan Phase 1). */

export type AgentRegion = "CN" | "US" | "Global";
export type AgentCategory =
  | "coding"
  | "chat"
  | "research"
  | "image"
  | "tooling";

export type DimensionId =
  | "codingAbility"
  | "toolUse"
  | "contextMemory"
  | "privacyControl"
  | "costEfficiency"
  | "cnAccessibility"
  | "learningCurve";

export const DIMENSION_IDS: DimensionId[] = [
  "codingAbility",
  "toolUse",
  "contextMemory",
  "privacyControl",
  "costEfficiency",
  "cnAccessibility",
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
  /** Scores 1–5; coding-agent dimensions prioritized in defaults. */
  scores: Record<DimensionId, number>;
  notesZh?: string;
  notesEn?: string;
}

export interface AgentsPayload {
  generatedAt: string;
  sourceNote: string;
  agents: AgentRecord[];
}
