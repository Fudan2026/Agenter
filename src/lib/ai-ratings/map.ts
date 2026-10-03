/**
 * Map Arena / Artificial Analysis style rows → Agenter agent overlay scores.
 */

export interface AiRatingAlias {
  agentId: string;
  arenaNames: string[];
  aaNames: string[];
}

export interface ArenaLeaderboardRow {
  name?: string;
  model?: string;
  elo?: number;
  rating?: number;
  rank?: number;
  url?: string;
}

export interface AaModelRow {
  name?: string;
  model?: string;
  iq?: number;
  intelligence_index?: number;
  rank?: number;
  url?: string;
}

export interface AiRatingRow {
  agentId: string;
  arenaElo: number | null;
  aaIq: number | null;
  rank: number | null;
  url: string | null;
  matchedArena?: string;
  matchedAa?: string;
}

export interface AiRatingsPayload {
  generatedAt: string;
  sources: string[];
  rows: AiRatingRow[];
  note: { zh: string; en: string };
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_\-./]+/g, "");
}

function pickName(row: { name?: string; model?: string }): string {
  return (row.name || row.model || "").trim();
}

export function mapAiRatings(
  aliases: AiRatingAlias[],
  arenaRows: ArenaLeaderboardRow[],
  aaRows: AaModelRow[],
  sources: string[],
): AiRatingsPayload {
  const arenaByNorm = new Map<string, ArenaLeaderboardRow>();
  for (const r of arenaRows) {
    const n = pickName(r);
    if (n) arenaByNorm.set(norm(n), r);
  }
  const aaByNorm = new Map<string, AaModelRow>();
  for (const r of aaRows) {
    const n = pickName(r);
    if (n) aaByNorm.set(norm(n), r);
  }

  const rows: AiRatingRow[] = [];
  for (const a of aliases) {
    let arena: ArenaLeaderboardRow | undefined;
    let matchedArena: string | undefined;
    for (const name of a.arenaNames) {
      const hit = arenaByNorm.get(norm(name));
      if (hit) {
        arena = hit;
        matchedArena = name;
        break;
      }
    }
    let aa: AaModelRow | undefined;
    let matchedAa: string | undefined;
    for (const name of a.aaNames) {
      const hit = aaByNorm.get(norm(name));
      if (hit) {
        aa = hit;
        matchedAa = name;
        break;
      }
    }
    if (!arena && !aa) continue;
    const arenaElo =
      arena?.elo ?? arena?.rating ?? null;
    const aaIq = aa?.iq ?? aa?.intelligence_index ?? null;
    rows.push({
      agentId: a.agentId,
      arenaElo: arenaElo != null && Number.isFinite(arenaElo) ? arenaElo : null,
      aaIq: aaIq != null && Number.isFinite(aaIq) ? aaIq : null,
      rank: arena?.rank ?? aa?.rank ?? null,
      url: arena?.url ?? aa?.url ?? null,
      matchedArena,
      matchedAa,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    sources,
    rows,
    note: {
      zh: "自动更新 · 来源 Arena/AA 快照 · 不构成建议；不改写编辑分。",
      en: "Auto-updated · Arena/AA snapshots · not advice; never replaces editorial scores.",
    },
  };
}
